import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getCountFromServer, getDocFromServer } from 'firebase/firestore';

export interface SystemStats {
  totalExams: number;
  activeExams: number;
  submittedAttempts: number;
  totalStudents: number;
  totalExaminers: number;
  totalUsers: number;
  totalLogs: number;
  activeStudents: number;
  lastUpdated: number;
}

const STATS_DOC_PATH = 'system/stats';

export async function getSystemStats(forceServer = false): Promise<SystemStats | null> {
  const CACHE_KEY = 'acadex_system_stats_cache';
  
  // 1. Check local cache first unless forceServer
  if (!forceServer) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        // Use cache if it's less than 5 minutes old
        if (Date.now() - timestamp < 300000) {
          return data;
        }
      } catch (e) {}
    }
  }

  try {
    const statsDoc = doc(db, STATS_DOC_PATH);
    const snap = forceServer ? await getDocFromServer(statsDoc) : await getDoc(statsDoc);
    
    if (snap.exists()) {
      const data = snap.data();
      const stats: SystemStats = {
        totalExams: data.totalExams || 0,
        activeExams: data.activeExams || 0,
        submittedAttempts: data.submittedAttempts || 0,
        totalStudents: data.totalStudents || 0,
        totalExaminers: data.totalExaminers || 0,
        totalUsers: data.totalUsers || 0,
        totalLogs: data.totalLogs || 0,
        activeStudents: data.activeStudents || 0,
        lastUpdated: data.lastUpdated || Date.now()
      };

      // Update cache
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: stats, timestamp: Date.now() }));
      return stats;
    }

    // Fallback to old cache if network fails but document exists in cache
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached).data;

    return null;
  } catch (error: any) {
    // Silently handle quota errors and return cached data if available
    if (error.message?.includes('Quota exceeded')) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached).data;
    }
    console.error('Error fetching system stats:', error);
    return null;
  }
}

export async function updateStat(field: keyof Omit<SystemStats, 'lastUpdated'>, value: number) {
  try {
    const statsDoc = doc(db, STATS_DOC_PATH);
    const snap = await getDoc(statsDoc);
    
    if (!snap.exists()) {
      // If doc doesn't exist, we don't increment, we might need to initialize it
      // but usually the first admin dashboard load will seed it.
      return;
    }
    
    await updateDoc(statsDoc, {
      [field]: increment(value),
      lastUpdated: Date.now()
    });
  } catch (error) {
    console.error(`Error updating stat ${field}:`, error);
  }
}

export async function seedSystemStats(): Promise<SystemStats> {
  const examsCol = collection(db, 'exams');
  const attemptsCol = collection(db, 'attempts');
  const usersCol = collection(db, 'users');
  const logsCol = collection(db, 'user_activities');

  const [
    totalExams,
    activeExams,
    submittedAttempts,
    totalStudents,
    totalExaminers,
    totalUsers,
    totalLogs,
    activeStudents
  ] = await Promise.all([
    getCountFromServer(examsCol),
    getCountFromServer(query(examsCol, where('status', '==', 'published'))),
    getCountFromServer(query(attemptsCol, where('status', 'in', ['submitted', 'graded']))),
    getCountFromServer(query(usersCol, where('role', '==', 'student'))),
    getCountFromServer(query(usersCol, where('role', '==', 'examiner'))),
    getCountFromServer(usersCol),
    getCountFromServer(logsCol),
    getCountFromServer(query(attemptsCol, where('status', '==', 'in-progress')))
  ]);

  const stats: SystemStats = {
    totalExams: totalExams.data().count,
    activeExams: activeExams.data().count,
    submittedAttempts: submittedAttempts.data().count,
    totalStudents: totalStudents.data().count,
    totalExaminers: totalExaminers.data().count,
    totalUsers: totalUsers.data().count,
    totalLogs: totalLogs.data().count,
    activeStudents: activeStudents.data().count,
    lastUpdated: Date.now()
  };

  await setDoc(doc(db, STATS_DOC_PATH), stats);
  return stats;
}
