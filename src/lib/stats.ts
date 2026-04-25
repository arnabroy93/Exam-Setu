import { supabase } from './supabase';

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

export async function getSystemStats(forceServer = false): Promise<SystemStats | null> {
  const CACHE_KEY = 'acadex_system_stats_cache';
  
  if (!forceServer) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 300000) {
          return data;
        }
      } catch (e) {}
    }
  }

  try {
    return await seedSystemStats();
  } catch (error: any) {
    console.error('Error fetching system stats:', error);
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached).data;
    return null;
  }
}

export async function updateStat(field: keyof Omit<SystemStats, 'lastUpdated'>, value: number) {
  // Not needed with on-the-fly counts. Left here to satisfy callers.
}

export async function seedSystemStats(): Promise<SystemStats> {
  const [
    { count: totalExams },
    { count: activeExams },
    { count: submittedAttempts },
    { count: totalStudents },
    { count: totalExaminers },
    { count: totalUsers },
    { count: totalLogs },
    { count: activeStudents }
  ] = await Promise.all([
    supabase.from('exams').select('*', { count: 'exact', head: true }),
    supabase.from('exams').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('attempts').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'graded']),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'examiner'),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('user_activities').select('*', { count: 'exact', head: true }),
    supabase.from('attempts').select('*', { count: 'exact', head: true }).eq('status', 'in-progress')
  ]);

  const stats: SystemStats = {
    totalExams: totalExams || 0,
    activeExams: activeExams || 0,
    submittedAttempts: submittedAttempts || 0,
    totalStudents: totalStudents || 0,
    totalExaminers: totalExaminers || 0,
    totalUsers: totalUsers || 0,
    totalLogs: totalLogs || 0,
    activeStudents: activeStudents || 0,
    lastUpdated: Date.now()
  };

  const CACHE_KEY = 'acadex_system_stats_cache';
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data: stats, timestamp: Date.now() }));
  return stats;
}

