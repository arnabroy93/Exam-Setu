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
  try {
    const statsDoc = doc(db, STATS_DOC_PATH);
    const snap = forceServer ? await getDocFromServer(statsDoc) : await getDoc(statsDoc);
    
    if (snap.exists()) {
      return snap.data() as SystemStats;
    }
    return null;
  } catch (error) {
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
