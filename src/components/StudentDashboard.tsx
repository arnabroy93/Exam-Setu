import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Exam, ExamAttempt } from '../types';
import { metadataCache } from '../lib/metadataCache';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Clock, Trophy, Calendar, ArrowRight, AlertCircle, RefreshCw, Lock, Globe, CheckCircle2 } from 'lucide-react';
import { 
  formatInIST, 
  formatShortIST, 
  getExamAvailabilityState, 
  getAvailabilityBadgeInfo, 
  getCurrentISTDisplay 
} from '../utils/timeUtils';

export const StudentDashboard: React.FC<{ onStartExam: (exam: Exam) => void, onViewResults: () => void }> = ({ onStartExam, onViewResults }) => {
  const { profile } = useAuth();
  const [view, setView] = useState<'dashboard' | 'available-exams'>('dashboard');
  const [availableExams, setAvailableExams] = useState<Exam[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<(ExamAttempt & { examTitle?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async (force = false) => {
    if (!profile) return;
    if (force) setIsRefreshing(true);
      
    // Check cache - Persistent localStorage
    if (!force) {
      const localCacheKey = `student_dashboard_v2_${profile.uid}`;
      const cached = localStorage.getItem(localCacheKey);
      if (cached) {
        try {
          const { availableExams, recentAttempts, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 3600000) { // 1 hour persistent cache
            setAvailableExams(availableExams);
            setRecentAttempts(recentAttempts);
            setLoading(false);
            return;
          }
        } catch (e) {}
      }
    }

    try {
      // Fetch available exams (limit to 12 to save quota)
      const { data: examsData } = await supabase
        .from('exams')
        .select('*')
        .eq('status', 'published')
        .limit(12);

      setAvailableExams(examsData as any as Exam[] || []);

      // Fetch recent attempts using multiple possible IDs (legacy uid and supabase id)
      const searchIds = [profile.uid];
      if ((profile as any).id && (profile as any).id !== profile.uid) {
        searchIds.push((profile as any).id);
      }

      const { data: attemptsData } = await supabase
        .from('attempts')
        .select('*')
        .in('studentId', searchIds)
        .order('startTime', { ascending: false })
        .limit(5);
      
      // Enrich attempts with exam titles using the cache
      const enrichedAttempts = await Promise.all((attemptsData as any as ExamAttempt[] || []).map(async (attempt) => {
        const exam = await metadataCache.getExam(attempt.examId);
        return {
          ...attempt,
          examTitle: exam?.title || 'Unknown Exam'
        };
      }));

      setAvailableExams(examsData);
      setRecentAttempts(enrichedAttempts);
      
      // Cache data persistently
      localStorage.setItem(`student_dashboard_v2_${profile.uid}`, JSON.stringify({
        availableExams: examsData,
        recentAttempts: enrichedAttempts,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile]);

  const handleRefresh = () => {
    fetchData(true);
  };

  const stats = [
    { title: 'Available Exams', value: availableExams.length, icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10', view: 'available-exams' },
    { title: 'Completed', value: recentAttempts.length, icon: Trophy, color: 'text-green-500', bg: 'bg-green-500/10', view: 'dashboard' },
  ];

  return (
    <div className="space-y-8">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome, {profile?.displayName}</h2>
          <p className="text-muted-foreground mt-1">Track your progress and available examinations.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((stat, i) => (
          <Card 
            key={i} 
            className={`cursor-pointer hover:border-primary transition-colors ${view === stat.view ? 'border-primary shadow-md' : ''}`} 
            onClick={() => setView(stat.view as 'dashboard' | 'available-exams')}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {view === 'dashboard' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Enrolled Exams */}
          <div className="lg:col-span-3 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-teal-600" />
                  Available & Scheduled Examinations
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Exam availability & due dates strictly follow India Standard Time (IST / GMT+5:30).
                </p>
              </div>
              <Badge className="bg-teal-50 text-teal-800 border-teal-200 self-start sm:self-auto font-mono text-xs">
                <Globe className="w-3 h-3 mr-1 text-teal-600" />
                IST: {getCurrentISTDisplay()}
              </Badge>
            </div>
            
            <div className="grid gap-5 md:grid-cols-2">
              {availableExams.length === 0 ? (
                <Card className="p-12 text-center border-dashed col-span-2 rounded-2xl bg-teal-50/20">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-teal-600/30" />
                  <p className="text-muted-foreground font-medium">No active or scheduled examinations are currently assigned.</p>
                </Card>
              ) : (
                availableExams.map((exam) => {
                  const badgeInfo = getAvailabilityBadgeInfo(exam);
                  return (
                    <Card key={exam.id} className="group hover:border-teal-300 transition-all shadow-xs rounded-2xl border-teal-100/80 overflow-hidden">
                      <CardContent className="p-6 flex flex-col justify-between gap-5">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-lg text-slate-900 group-hover:text-teal-700 transition-colors leading-snug">
                              {exam.title}
                            </h4>
                            <Badge variant="outline" className={`shrink-0 text-xs font-bold py-1 px-2.5 rounded-lg border ${badgeInfo.badgeClass}`}>
                              <span className={`w-2 h-2 rounded-full mr-1.5 ${badgeInfo.dotClass}`} />
                              {badgeInfo.label}
                            </Badge>
                          </div>

                          <p className="text-xs text-slate-600 line-clamp-2">{exam.description || 'No additional description provided.'}</p>

                          <div className="pt-2 grid grid-cols-2 gap-2 text-xs text-teal-900 font-medium">
                            <div className="flex items-center gap-1.5 bg-teal-50/60 p-2 rounded-lg border border-teal-100/60">
                              <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span>{exam.duration} mins</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-teal-50/60 p-2 rounded-lg border border-teal-100/60">
                              <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span className="truncate">{exam.endTime ? formatShortIST(exam.endTime) : 'No due date'}</span>
                            </div>
                          </div>

                          {exam.startTime && (
                            <div className="text-[11px] text-teal-700/80 font-mono bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex items-center justify-between">
                              <span className="font-sans font-medium text-slate-500">Start Schedule:</span>
                              <span className="font-bold">{formatInIST(exam.startTime)}</span>
                            </div>
                          )}
                        </div>

                        {/* Action button based on availability */}
                        {badgeInfo.canStudentStart ? (
                          <Button 
                            onClick={() => onStartExam(exam)} 
                            className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs font-bold"
                          >
                            Start Exam Now
                            <ArrowRight className="ml-2 w-4 h-4" />
                          </Button>
                        ) : badgeInfo.state === 'upcoming' ? (
                          <Button 
                            disabled 
                            className="w-full bg-slate-100 text-slate-400 border border-slate-200 rounded-xl font-semibold cursor-not-allowed"
                          >
                            <Lock className="w-4 h-4 mr-2 text-slate-400" />
                            Opens on {exam.startTime ? formatShortIST(exam.startTime) : 'Scheduled Date'}
                          </Button>
                        ) : (
                          <Button 
                            disabled 
                            className="w-full bg-red-50 text-red-400 border border-red-100 rounded-xl font-semibold cursor-not-allowed"
                          >
                            <AlertCircle className="w-4 h-4 mr-2 text-red-400" />
                            Exam Closed / Expired
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Upcoming & Due Schedules */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              Schedule & Due Dates (IST)
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              {availableExams.length === 0 ? (
                <p className="text-sm text-muted-foreground italic col-span-3">No active or upcoming deadlines.</p>
              ) : (
                availableExams.map((exam) => {
                  const badgeInfo = getAvailabilityBadgeInfo(exam);
                  return (
                    <div key={exam.id} className="flex items-start gap-3 p-4 rounded-xl bg-white border border-teal-100 shadow-2xs">
                      <Clock className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-900">{exam.title}</p>
                        <p className="text-xs text-teal-800 font-mono">
                          {exam.endTime ? `Due: ${formatInIST(exam.endTime)}` : 'No due date'}
                        </p>
                        <Badge variant="outline" className={`text-[10px] font-bold py-0.5 px-2 rounded ${badgeInfo.badgeClass}`}>
                          {badgeInfo.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">All Assigned Examinations</h3>
              <p className="text-xs text-muted-foreground">Times indicated in India Standard Time (GMT+5:30)</p>
            </div>
            <Button variant="outline" onClick={() => setView('dashboard')} className="rounded-xl">Back to Dashboard</Button>
          </div>
          <Card className="rounded-2xl border-teal-100 overflow-hidden shadow-2xs">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-teal-50/60 border-b border-teal-100 text-teal-950 font-bold">
                  <tr>
                    <th className="p-4 text-left">Exam Title</th>
                    <th className="p-4 text-left">Duration</th>
                    <th className="p-4 text-left">Status (IST)</th>
                    <th className="p-4 text-left">Start Date (IST)</th>
                    <th className="p-4 text-left">Due Date (IST)</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {availableExams.map(exam => {
                    const badgeInfo = getAvailabilityBadgeInfo(exam);
                    return (
                      <tr key={exam.id} className="border-b last:border-0 hover:bg-teal-50/20 transition-colors">
                        <td className="p-4 font-semibold text-slate-900">{exam.title}</td>
                        <td className="p-4 text-xs">{exam.duration} mins</td>
                        <td className="p-4">
                          <Badge variant="outline" className={`text-xs font-bold ${badgeInfo.badgeClass}`}>
                            {badgeInfo.label}
                          </Badge>
                        </td>
                        <td className="p-4 text-xs font-mono">
                          {exam.startTime ? formatShortIST(exam.startTime) : 'Immediate'}
                        </td>
                        <td className="p-4 text-xs font-mono">
                          {exam.endTime ? formatShortIST(exam.endTime) : 'No due date'}
                        </td>
                        <td className="p-4 text-right">
                          {badgeInfo.canStudentStart ? (
                            <Button size="sm" onClick={() => onStartExam(exam)} className="bg-teal-600 hover:bg-teal-700 rounded-lg text-xs font-bold">
                              Start Exam
                            </Button>
                          ) : (
                            <Button size="sm" disabled variant="outline" className="text-xs rounded-lg">
                              Not Available
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
