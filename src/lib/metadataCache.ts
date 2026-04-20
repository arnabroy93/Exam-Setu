import { db } from './firebase';
import { doc, getDoc, getDocFromCache, getDocFromServer, getDocs, query, collection, limit } from 'firebase/firestore';
import { UserProfile, Exam } from '../types';

class MetadataCache {
  private userCache: Record<string, { profile: UserProfile, timestamp: number }> = {};
  private examCache: Record<string, { exam: Exam, timestamp: number }> = {};
  private readonly TTL = 30 * 60 * 1000; // 30 minutes

  async getUser(uid: string): Promise<UserProfile | null> {
    // 1. Memory Cache
    if (this.userCache[uid] && (Date.now() - this.userCache[uid].timestamp < this.TTL)) {
      return this.userCache[uid].profile;
    }

    // 2. Session/Local Storage
    const cacheKey = `user_meta_${uid}`;
    const storageData = sessionStorage.getItem(cacheKey) || localStorage.getItem(cacheKey);
    if (storageData) {
      try {
        const { profile, timestamp } = JSON.parse(storageData);
        if (Date.now() - timestamp < this.TTL) {
          this.userCache[uid] = { profile, timestamp };
          return profile;
        }
      } catch (e) {}
    }

    // 3. Firestore Cache
    try {
      const docRef = doc(db, 'users', uid);
      const cachedDoc = await getDocFromCache(docRef);
      if (cachedDoc.exists()) {
        const profile = cachedDoc.data() as UserProfile;
        this.cacheUser(uid, profile);
        return profile;
      }
    } catch (e) {
      // Not in cache, proceed to server
    }

    // 4. Firestore Server
    try {
      const docRef = doc(db, 'users', uid);
      const serverDoc = await getDocFromServer(docRef);
      if (serverDoc.exists()) {
        const profile = serverDoc.data() as UserProfile;
        this.cacheUser(uid, profile);
        return profile;
      }
    } catch (error) {
      console.error(`Error fetching user meta for ${uid}:`, error);
    }

    return null;
  }

  async getExam(id: string): Promise<Exam | null> {
    if (this.examCache[id] && (Date.now() - this.examCache[id].timestamp < this.TTL)) {
      return this.examCache[id].exam;
    }

    const cacheKey = `exam_meta_${id}`;
    const storageData = sessionStorage.getItem(cacheKey) || localStorage.getItem(cacheKey);
    if (storageData) {
      try {
        const { exam, timestamp } = JSON.parse(storageData);
        if (Date.now() - timestamp < this.TTL) {
          this.examCache[id] = { exam, timestamp };
          return exam;
        }
      } catch (e) {}
    }

    try {
      const docRef = doc(db, 'exams', id);
      const cachedDoc = await getDocFromCache(docRef);
      if (cachedDoc.exists()) {
        const exam = cachedDoc.data() as Exam;
        this.cacheExam(id, exam);
        return exam;
      }
    } catch (e) {}

    try {
      const docRef = doc(db, 'exams', id);
      const serverDoc = await getDocFromServer(docRef);
      if (serverDoc.exists()) {
        const exam = serverDoc.data() as Exam;
        this.cacheExam(id, exam);
        return exam;
      }
    } catch (error) {
      console.error(`Error fetching exam meta for ${id}:`, error);
    }

    return null;
  }

  private cacheUser(uid: string, profile: UserProfile) {
    const data = { profile, timestamp: Date.now() };
    this.userCache[uid] = data;
    const json = JSON.stringify(data);
    sessionStorage.setItem(`user_meta_${uid}`, json);
    localStorage.setItem(`user_meta_${uid}`, json);
  }

  private cacheExam(id: string, exam: Exam) {
    const data = { exam, timestamp: Date.now() };
    this.examCache[id] = data;
    const json = JSON.stringify(data);
    sessionStorage.setItem(`exam_meta_${id}`, json);
    localStorage.setItem(`exam_meta_${id}`, json);
  }

  async getExamsList(): Promise<Exam[]> {
    const cacheKey = 'global_exams_list_persistent';
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 7200000) { // 2 hour cache
          return data;
        }
      } catch (e) {}
    }

    try {
      const q = query(collection(db, 'exams'), limit(250));
      const snapshot = await getDocs(q);
      const exams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as Exam));
      
      localStorage.setItem(cacheKey, JSON.stringify({ data: exams, timestamp: Date.now() }));
      return exams;
    } catch (e) {
      return [];
    }
  }

  clear() {
    this.userCache = {};
    this.examCache = {};
  }
}

export const metadataCache = new MetadataCache();
