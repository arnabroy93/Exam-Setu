import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where, orderBy, getDocs } from 'firebase/firestore';
import { Exam, ExamAttempt, UserProfile, ActivityLog } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Clock, AlertTriangle, User, Users, BookOpen, Activity, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export const LiveMonitoring: React.FC = () => {
  const [activeAttempts, setActiveAttempts] = useState<(ExamAttempt & { student?: UserProfile, exam?: Exam })[]>([]);
  const [recentLogs, setRecentLogs] = useState<{ log: ActivityLog, studentName: string, examTitle: string, attemptId: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [allStudents, setAllStudents] = useState<Record<string, UserProfile>>({});
  const [allExams, setAllExams] = useState<Record<string, Exam>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStaticData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [studentsSnap, examsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'exams'))
      ]);
      
      const studentsMap: Record<string, UserProfile> = {};
      studentsSnap.docs.forEach(doc => {
        studentsMap[doc.id] = doc.data() as UserProfile;
      });
      setAllStudents(studentsMap);

      const examsMap: Record<string, Exam> = {};
      examsSnap.docs.forEach(doc => {
        examsMap[doc.id] = doc.data() as Exam;
      });
      setAllExams(examsMap);
    } catch (error) {
      console.error('Error fetching static data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStaticData();

    const attemptsUnsub = onSnapshot(query(collection(db, 'attempts'), where('status', '==', 'in-progress')), (snapshot) => {
      const attemptsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamAttempt));
      setActiveAttempts(attemptsData);
      setLoading(false);
    });

    return () => {
      attemptsUnsub();
    };
  }, [fetchStaticData]);

  // Compute logs separately when state updates
  useEffect(() => {
    if (activeAttempts.length === 0) {
      setRecentLogs([]);
      return;
    }

    const logs: { log: ActivityLog, studentName: string, examTitle: string, attemptId: string }[] = [];
    activeAttempts.forEach(attempt => {
      const student = allStudents[attempt.studentId];
      const exam = allExams[attempt.examId];
      if (attempt.suspiciousActivity) {
        attempt.suspiciousActivity.forEach(log => {
          logs.push({
            log,
            studentName: student?.displayName || 'Unknown',
            examTitle: exam?.title || 'Unknown',
            attemptId: attempt.id
          });
        });
      }
    });
    setRecentLogs(logs.sort((a, b) => b.log.timestamp - a.log.timestamp).slice(0, 20));
  }, [activeAttempts, allStudents, allExams]);

  const calculateProgress = (attempt: ExamAttempt) => {
    const exam = allExams[attempt.examId];
    if (!exam) return 0;
    const totalQuestions = exam.questions.length;
    const answeredQuestions = Object.keys(attempt.answers).length;
    return Math.round((answeredQuestions / totalQuestions) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-8 h-8 text-primary animate-pulse" />
          <p className="text-muted-foreground animate-pulse">Initializing Live Monitor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Live Exam Monitoring
          </h2>
          <p className="text-muted-foreground">Real-time tracking of active student attempts and integrity alerts.</p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchStaticData} 
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Names
          </Button>
          <Badge variant="outline" className="px-3 py-1 gap-2 bg-primary/5 border-primary/20">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {activeAttempts.length} Active Students
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Students List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Active Candidates
            </CardTitle>
            <CardDescription>Live progress of students currently taking exams</CardDescription>
          </CardHeader>
          <CardContent>
            {activeAttempts.length === 0 ? (
              <div className="text-center py-12 border rounded-xl border-dashed">
                <BookOpen className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground">No active examinations at the moment.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeAttempts.map((attempt) => {
                  const student = allStudents[attempt.studentId];
                  const exam = allExams[attempt.examId];
                  const progress = calculateProgress(attempt);
                  const suspiciousCount = attempt.suspiciousActivity?.length || 0;

                  return (
                    <div key={attempt.id} className="p-4 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {student?.displayName?.[0] || '?'}
                          </div>
                          <div>
                            <p className="font-bold">{student?.displayName || 'Unknown Student'}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              {exam?.title || 'Unknown Exam'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right hidden md:block">
                            <p className="text-xs text-muted-foreground">Started</p>
                            <p className="text-sm font-medium">{new Date(attempt.startTime).toLocaleTimeString()}</p>
                          </div>
                          {suspiciousCount > 0 && (
                            <Badge variant="destructive" className="animate-pulse gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {suspiciousCount} Alerts
                            </Badge>
                          )}
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                            {progress}% Complete
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Progress</span>
                          <span>{Object.keys(attempt.answers).length} / {exam?.questions.length || 0} Questions</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Real-time Alerts Feed */}
        <Card className="flex flex-col h-full">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              Integrity Alerts
            </CardTitle>
            <CardDescription>Real-time proctoring notifications</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <ScrollArea className="h-[500px] pr-4">
              {recentLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 text-green-500/20 mx-auto mb-4" />
                  <p className="text-sm">No suspicious activity detected.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentLogs.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-destructive/5 border border-destructive/10 space-y-2 animate-in slide-in-from-right-2 duration-300">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                          <span className="text-xs font-bold uppercase text-destructive tracking-wider">
                            {item.log.type.replace('-', ' ')}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-tight">{item.studentName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{item.examTitle}</p>
                      </div>
                      <p className="text-xs text-muted-foreground bg-white/50 p-2 rounded border border-destructive/5">
                        {item.log.details}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
