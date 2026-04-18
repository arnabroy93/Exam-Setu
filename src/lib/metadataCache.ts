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

    // 2. Session Storage
    const sessionKey = `user_meta_${uid}`;
    const sessionData = sessionStorage.getItem(sessionKey);
    if (sessionData) {
      const { profile, timestamp } = JSON.parse(sessionData);
      if (Date.now() - timestamp < this.TTL) {
        this.userCache[uid] = { profile, timestamp };
        return profile;
      }
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

    const sessionKey = `exam_meta_${id}`;
    const sessionData = sessionStorage.getItem(sessionKey);
    if (sessionData) {
      const { exam, timestamp } = JSON.parse(sessionData);
      if (Date.now() - timestamp < this.TTL) {
        this.examCache[id] = { exam, timestamp };
        return exam;
      }
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
    sessionStorage.setItem(`user_meta_${uid}`, JSON.stringify(data));
  }

  private cacheExam(id: string, exam: Exam) {
    const data = { exam, timestamp: Date.now() };
    this.examCache[id] = data;
    sessionStorage.setItem(`exam_meta_${id}`, JSON.stringify(data));
  }

  async getExamsList(): Promise<Exam[]> {
    const cacheKey = 'global_exams_list';
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 3600000) { // 1 hour cache
        return data;
      }
    }

    try {
      // Try cache first
      const q = query(collection(db, 'exams'), limit(200));
      const snapshot = await getDocs(q);
      const exams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as Exam));
      
      sessionStorage.setItem(cacheKey, JSON.stringify({ data: exams, timestamp: Date.now() }));
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
