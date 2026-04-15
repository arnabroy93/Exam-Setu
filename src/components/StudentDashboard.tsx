import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit, orderBy, getDoc, doc } from 'firebase/firestore';
import { Exam, ExamAttempt } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Clock, Trophy, Calendar, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';

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
      
    // Check cache
    if (!force) {
      const cached = sessionStorage.getItem(`student_dashboard_${profile.uid}`);
      if (cached) {
        const { availableExams, recentAttempts, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 120000) { // 2 minutes cache
          setAvailableExams(availableExams);
          setRecentAttempts(recentAttempts);
          setLoading(false);
          return;
        }
      }
    }

    try {
      // Fetch available exams (limit to 12 to save quota)
      const examsQuery = query(
        collection(db, 'exams'), 
        where('status', '==', 'published'),
        limit(12)
      );
      const examsSnapshot = await getDocs(examsQuery);
      const examsData = examsSnapshot.docs.map(doc => doc.data() as Exam);
      setAvailableExams(examsData);

      // Fetch recent attempts
      const attemptsQuery = query(
        collection(db, 'attempts'),
        where('studentId', '==', profile.uid),
        orderBy('startTime', 'desc'),
        limit(3)
      );
      const attemptsSnapshot = await getDocs(attemptsQuery);
      const attemptsData = attemptsSnapshot.docs.map(doc => doc.data() as ExamAttempt);
      
      // Fetch unique exam IDs for titles
      const examIds = Array.from(new Set(attemptsData.map(a => a.examId)));
      const examMap: Record<string, string> = {};

      // First check if we already have the exam in availableExams
      examIds.forEach(id => {
        const found = examsData.find(e => e.id === id);
        if (found) examMap[id] = found.title;
      });

      // Fetch missing titles only
      const missingIds = examIds.filter(id => !examMap[id]);
      if (missingIds.length > 0) {
        await Promise.all(missingIds.map(async (id) => {
          try {
            const examDoc = await getDoc(doc(db, 'exams', id));
            examMap[id] = examDoc.exists() ? (examDoc.data() as Exam).title : 'Unknown Exam';
          } catch (error) {
            console.error('Error fetching exam title:', error);
            examMap[id] = 'Unknown Exam';
          }
        }));
      }

      const enrichedAttempts = attemptsData.map(attempt => ({
        ...attempt,
        examTitle: examMap[attempt.examId]
      }));

      setRecentAttempts(enrichedAttempts);
      
      // Cache data
      sessionStorage.setItem(`student_dashboard_${profile.uid}`, JSON.stringify({
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
          <h2 className="text-2xl font-bold">Welcome, {profile?.displayName}</h2>
          <p className="text-muted-foreground">Track your progress and available examinations.</p>
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
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Enrolled Exams</h3>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              {availableExams.length === 0 ? (
                <Card className="p-12 text-center border-dashed col-span-2">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-muted-foreground">No exams are currently available for you.</p>
                </Card>
              ) : (
                availableExams.map((exam) => (
                  <Card key={exam.id} className="group hover:border-primary/50 transition-colors">
                    <CardContent className="p-6 flex flex-col justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="font-bold text-lg group-hover:text-primary transition-colors">{exam.title}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {exam.duration} mins
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {exam.endTime ? `Due: ${new Date(exam.endTime).toLocaleDateString()}` : 'No due date'}
                          </span>
                        </div>
                      </div>
                      <Button onClick={() => onStartExam(exam)} className="w-full">
                        Start Exam
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="lg:col-span-3 space-y-6">
            <h3 className="text-xl font-bold">Upcoming Deadlines</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {availableExams.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No upcoming deadlines.</p>
              ) : (
                availableExams.map((exam) => (
                  <div key={exam.id} className="flex items-start gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/10">
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-destructive">{exam.title}</p>
                      <p className="text-xs text-muted-foreground">{exam.endTime ? `Due: ${new Date(exam.endTime).toLocaleDateString()}` : 'No due date'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Available Exams</h3>
            <Button variant="outline" onClick={() => setView('dashboard')}>Back to Dashboard</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-4 text-left">Exam Title</th>
                    <th className="p-4 text-left">Duration</th>
                    <th className="p-4 text-left">Due Date</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {availableExams.map(exam => (
                    <tr key={exam.id} className="border-b last:border-0">
                      <td className="p-4 font-medium">{exam.title}</td>
                      <td className="p-4">{exam.duration} mins</td>
                      <td className="p-4">{exam.endTime ? new Date(exam.endTime).toLocaleDateString() : 'N/A'}</td>
                      <td className="p-4 text-right">
                        <Button size="sm" onClick={() => onStartExam(exam)}>Start Exam</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
