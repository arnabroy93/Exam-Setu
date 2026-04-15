import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where, getDocs, getCountFromServer, doc, deleteDoc, orderBy, limit, getDoc } from 'firebase/firestore';
import { Exam, ExamAttempt, UserProfile } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Users, CheckCircle, CheckCircle2, TrendingUp, Clock, FileText, ArrowRight, Search, Mail, Calendar, Activity, Trash2, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const AdminDashboard: React.FC<{ onAction: (view: any) => void }> = ({ onAction }) => {
  const [stats, setStats] = useState({
    totalExams: 0,
    submittedAttempts: 0,
    totalStudents: 0,
    activeExams: 0,
    inactiveExams: 0
  });
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<(ExamAttempt & { studentName?: string, examTitle?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [attemptToReset, setAttemptToReset] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = async (force = false) => {
    // Check cache first
    if (!force) {
      const cached = sessionStorage.getItem('admin_stats');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 120000) { // 2 minutes cache
          setStats(data);
          setLoading(false);
          return;
        }
      }
    }

    setIsRefreshing(true);
    try {
      const examsCol = collection(db, 'exams');
      const attemptsCol = collection(db, 'attempts');
      const studentsCol = collection(db, 'users');

      const [
        totalExamsCount,
        activeExamsCount,
        submittedAttemptsCount,
        totalStudentsCount
      ] = await Promise.all([
        getCountFromServer(examsCol),
        getCountFromServer(query(examsCol, where('status', '==', 'published'))),
        getCountFromServer(query(attemptsCol, where('status', 'in', ['submitted', 'graded']))),
        getCountFromServer(query(studentsCol, where('role', '==', 'student')))
      ]);

      const newStats = {
        totalExams: totalExamsCount.data().count,
        activeExams: activeExamsCount.data().count,
        inactiveExams: totalExamsCount.data().count - activeExamsCount.data().count,
        submittedAttempts: submittedAttemptsCount.data().count,
        totalStudents: totalStudentsCount.data().count
      };

      setStats(newStats);
      sessionStorage.setItem('admin_stats', JSON.stringify({ data: newStats, timestamp: Date.now() }));
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const fetchDetailData = async (statId: string) => {
    setLoading(true);
    try {
      switch (statId) {
        case 'active-exams':
        case 'inactive-exams':
        case 'total-exams':
          const examsSnap = await getDocs(collection(db, 'exams'));
          setExams(examsSnap.docs.map(doc => doc.data() as Exam));
          break;
        case 'total-attempts':
          const attemptsSnap = await getDocs(query(collection(db, 'attempts'), where('status', 'in', ['submitted', 'graded'])));
          setAttempts(attemptsSnap.docs.map(doc => doc.data() as ExamAttempt));
          // Also need students and exams for names
          const [studentsSnap, examsSnap2] = await Promise.all([
            getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
            getDocs(collection(db, 'exams'))
          ]);
          setStudents(studentsSnap.docs.map(doc => doc.data() as UserProfile));
          setExams(examsSnap2.docs.map(doc => doc.data() as Exam));
          break;
        case 'total-students':
          const studentsSnap2 = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
          setStudents(studentsSnap2.docs.map(doc => doc.data() as UserProfile));
          // Need attempts to show count
          const attemptsSnap2 = await getDocs(collection(db, 'attempts'));
          setAttempts(attemptsSnap2.docs.map(doc => doc.data() as ExamAttempt));
          break;
      }
    } catch (error) {
      console.error('Error fetching detail data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async (force = false) => {
    // Check cache
    if (!force) {
      const cached = sessionStorage.getItem('admin_recent_activity');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 120000) { // 2 minutes cache
          setRecentAttempts(data);
          return;
        }
      }
    }

    try {
      const recentQuery = query(collection(db, 'attempts'), orderBy('startTime', 'desc'), limit(5));
      const snapshot = await getDocs(recentQuery);
      const recentData = snapshot.docs.map(doc => doc.data() as ExamAttempt);
      
      // Fetch names for these 5 attempts only
      const enriched = await Promise.all(recentData.map(async (attempt) => {
        const [studentDoc, examDoc] = await Promise.all([
          getDoc(doc(db, 'users', attempt.studentId)),
          getDoc(doc(db, 'exams', attempt.examId))
        ]);
        return {
          ...attempt,
          studentName: studentDoc.exists() ? (studentDoc.data() as UserProfile).displayName : 'Unknown Student',
          examTitle: examDoc.exists() ? (examDoc.data() as Exam).title : 'Unknown Exam'
        };
      }));
      setRecentAttempts(enriched);
      sessionStorage.setItem('admin_recent_activity', JSON.stringify({ data: enriched, timestamp: Date.now() }));
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const handleRefresh = () => {
    fetchStats(true);
    fetchRecentActivity(true);
  };

  useEffect(() => {
    fetchStats();
    fetchRecentActivity();
  }, []);

  useEffect(() => {
    if (selectedStat) {
      fetchDetailData(selectedStat);
    }
  }, [selectedStat]);

  const handleResetAttempt = async () => {
    if (!attemptToReset) return;
    setIsResetting(true);
    try {
      await deleteDoc(doc(db, 'attempts', attemptToReset));
      setAttemptToReset(null);
      fetchStats(); // Refresh stats after delete
    } catch (error) {
      console.error('Error resetting attempt:', error);
      alert('Failed to reset attempt.');
    } finally {
      setIsResetting(false);
    }
  };

  const statCards = [
    { id: 'active-exams', title: 'Active Exams', value: stats.activeExams, icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10', desc: 'Currently published' },
    { id: 'inactive-exams', title: 'Inactive Exams', value: stats.inactiveExams, icon: FileText, color: 'text-slate-500', bg: 'bg-slate-500/10', desc: 'Drafts & Archived' },
    { id: 'total-attempts', title: 'Submitted Attempts', value: stats.submittedAttempts, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', desc: 'Exams completed' },
    { id: 'total-students', title: 'Total Students', value: stats.totalStudents, icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10', desc: 'Registered students' },
    { id: 'total-exams', title: 'Exams Created', value: stats.totalExams, icon: FileText, color: 'text-orange-500', bg: 'bg-orange-500/10', desc: 'All created exams' },
  ];

  const getDetailContent = () => {
    switch (selectedStat) {
      case 'active-exams':
        return {
          title: 'Active Examinations',
          description: 'List of all currently published exams.',
          data: exams.filter(e => e.status === 'published').filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())),
          columns: ['Title', 'Duration', 'Questions', 'Created At'],
          renderRow: (exam: Exam) => (
            <TableRow key={exam.id}>
              <TableCell className="font-medium">{exam.title}</TableCell>
              <TableCell>{exam.duration} mins</TableCell>
              <TableCell>{exam.questions.length}</TableCell>
              <TableCell>{new Date(exam.createdAt).toLocaleDateString()}</TableCell>
            </TableRow>
          )
        };
      case 'inactive-exams':
        return {
          title: 'Inactive Examinations',
          description: 'List of all exams currently in Draft or Archived status.',
          data: exams.filter(e => e.status !== 'published').filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())),
          columns: ['Title', 'Status', 'Duration', 'Created At'],
          renderRow: (exam: Exam) => (
            <TableRow key={exam.id}>
              <TableCell className="font-medium">{exam.title}</TableCell>
              <TableCell>
                <Badge variant={exam.status === 'draft' ? 'secondary' : 'outline'}>
                  {exam.status}
                </Badge>
              </TableCell>
              <TableCell>{exam.duration} mins</TableCell>
              <TableCell>{new Date(exam.createdAt).toLocaleDateString()}</TableCell>
            </TableRow>
          )
        };
      case 'total-attempts':
        return {
          title: 'Submitted Exam Attempts',
          description: 'Complete history of all submitted and graded exams.',
          data: attempts.filter(a => a.status === 'submitted' || a.status === 'graded').filter(a => a.id.toLowerCase().includes(searchTerm.toLowerCase())),
          columns: ['Student', 'Exam', 'Status', 'Score', 'Date', 'Actions'],
          renderRow: (attempt: ExamAttempt) => {
            const student = students.find(s => s.uid === attempt.studentId);
            const exam = exams.find(e => e.id === attempt.examId);
            return (
              <TableRow key={attempt.id}>
                <TableCell className="font-medium">{student?.displayName || attempt.studentId}</TableCell>
                <TableCell>{exam?.title || attempt.examId}</TableCell>
                <TableCell>
                  <Badge variant={attempt.status === 'graded' ? 'default' : 'secondary'}>
                    {attempt.status === 'submitted' ? 'Pending Grading' : attempt.status}
                  </Badge>
                </TableCell>
                <TableCell>{attempt.score !== undefined ? `${attempt.score}%` : 'N/A'}</TableCell>
                <TableCell>{new Date(attempt.endTime || attempt.startTime).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setAttemptToReset(attempt.id)}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                </TableCell>
              </TableRow>
            );
          }
        };
      case 'total-students':
        return {
          title: 'Registered Students',
          description: 'All students registered on the platform.',
          data: students.filter(s => s.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || s.email.toLowerCase().includes(searchTerm.toLowerCase())),
          columns: ['Name', 'Email', 'Joined', 'Exams Taken'],
          renderRow: (student: UserProfile) => {
            const studentAttempts = attempts.filter(a => a.studentId === student.uid).length;
            return (
              <TableRow key={student.uid}>
                <TableCell className="font-medium">{student.displayName}</TableCell>
                <TableCell>{student.email}</TableCell>
                <TableCell>{new Date(student.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant="outline">{studentAttempts}</Badge>
                </TableCell>
              </TableRow>
            );
          }
        };
      case 'total-exams':
        return {
          title: 'All Examinations',
          description: 'Complete list of all exams (Draft, Published, Archived).',
          data: exams.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())),
          columns: ['Title', 'Status', 'Duration', 'Created At'],
          renderRow: (exam: Exam) => (
            <TableRow key={exam.id}>
              <TableCell className="font-medium">{exam.title}</TableCell>
              <TableCell>
                <Badge variant={exam.status === 'published' ? 'default' : exam.status === 'draft' ? 'secondary' : 'outline'}>
                  {exam.status}
                </Badge>
              </TableCell>
              <TableCell>{exam.duration} mins</TableCell>
              <TableCell>{new Date(exam.createdAt).toLocaleDateString()}</TableCell>
            </TableRow>
          )
        };
      default:
        return null;
    }
  };

  const detail = getDetailContent();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
          <p className="text-muted-foreground">Overview of system performance and activity.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className="cursor-pointer hover:shadow-md transition-all border-transparent hover:border-primary/20" onClick={() => setSelectedStat(stat.id)}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-50" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-3xl font-bold mt-1">{stat.value}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">{stat.desc}</p>
                  <span className="text-[10px] font-medium text-primary hover:underline">View Details</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedStat} onOpenChange={(open) => !open && setSelectedStat(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>{detail?.description}</DialogDescription>
          </DialogHeader>
          
          <div className="relative my-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {detail?.columns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={detail.columns.length} className="text-center py-8 text-muted-foreground">
                      No records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  detail?.data.map((item: any) => detail.renderRow(item))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!attemptToReset} onOpenChange={(open) => !open && setAttemptToReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Exam Attempt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this exam submission. The student will be able to retake the exam from the beginning. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default" disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetAttempt} disabled={isResetting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isResetting ? 'Resetting...' : 'Reset Attempt'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest exam submissions from students</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentAttempts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No recent activity found.</div>
              ) : (
                recentAttempts.map((attempt) => (
                  <div key={attempt.id} className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {attempt.studentName?.[0]}
                      </div>
                      <div>
                        <p className="font-medium">{attempt.studentName}</p>
                        <p className="text-sm text-muted-foreground">Completed: {attempt.examTitle}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={attempt.status === 'graded' ? 'default' : 'secondary'}>
                          {attempt.status === 'submitted' ? 'Pending Grading' : (attempt.score !== undefined ? `${attempt.score} Marks` : attempt.status)}
                        </Badge>
                        {attempt.isPublished ? (
                          <span className="text-[10px] text-green-600 font-bold flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Published
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">Pending Publication</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {new Date(attempt.endTime || attempt.startTime).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button 
              onClick={() => onAction('create-exam')}
              className="w-full text-left p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2 hover:bg-primary/10 transition-colors"
            >
              <p className="text-sm font-medium">Need more exams?</p>
              <p className="text-xs text-muted-foreground">Create a new examination with various question types.</p>
            </button>
            <button 
              onClick={() => onAction('student-reports')}
              className="w-full text-left p-4 rounded-xl bg-green-500/5 border border-green-500/10 space-y-2 hover:bg-green-500/10 transition-colors"
            >
              <p className="text-sm font-medium">Review Results</p>
              <p className="text-xs text-muted-foreground">Check student performance and provide feedback.</p>
            </button>
            <button 
              onClick={() => onAction('live-monitoring')}
              className="w-full text-left p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-2 hover:bg-blue-500/10 transition-colors"
            >
              <p className="text-sm font-medium">Live Monitoring</p>
              <p className="text-xs text-muted-foreground">Track active exams and integrity alerts in real-time.</p>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
