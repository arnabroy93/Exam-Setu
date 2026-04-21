import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where, getDocs, getCountFromServer, doc, deleteDoc, orderBy, limit, getDoc } from 'firebase/firestore';
import { Exam, ExamAttempt, UserProfile } from '../types';
import { metadataCache } from '../lib/metadataCache';
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
import { useAuth } from '../lib/AuthContext';
import { logUserActivity } from '../lib/activityLogger';
import { getSystemStats, seedSystemStats } from '../lib/stats';

export const AdminDashboard: React.FC<{ onAction: (view: any) => void }> = ({ onAction }) => {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalExams: 0,
    submittedAttempts: 0,
    totalStudents: 0,
    activeExams: 0,
    inactiveExams: 0,
    totalExaminers: 0,
    activeStudents: 0,
    totalUsers: 0
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
    // Check cache first - use localStorage for cross-refresh persistence
    const localCacheKey = 'admin_stats_persistent';
    if (!force) {
      const cached = localStorage.getItem(localCacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 900000) { // 15 minutes cache
          setStats(data);
          setLoading(false);
          return;
        }
      }
    }

    setIsRefreshing(true);
    try {
      // Use the optimized stats document
      let statsData = await getSystemStats();
      
      // Fallback for initial setup
      if (!statsData) {
        statsData = await seedSystemStats();
      }

      const newStats = {
        totalExams: statsData.totalExams,
        activeExams: statsData.activeExams,
        inactiveExams: statsData.totalExams - statsData.activeExams,
        submittedAttempts: statsData.submittedAttempts,
        totalStudents: statsData.totalStudents,
        totalExaminers: statsData.totalExaminers,
        activeStudents: statsData.activeExams > 0 ? statsData.activeStudents : 0,
        totalUsers: statsData.totalUsers
      };

      setStats(newStats);
      localStorage.setItem(localCacheKey, JSON.stringify({ data: newStats, timestamp: Date.now() }));
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const fetchDetailData = async (statId: string) => {
    // Check session cache for detail data
    const cacheKey = `admin_detail_${statId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { data, students: cachedStudents, exams: cachedExams, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 300000) { // 5 minutes cache for details
        setAttempts(data);
        setStudents(cachedStudents);
        setExams(cachedExams);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      let detailAttempts: ExamAttempt[] = [];
      let detailStudents: UserProfile[] = [];
      let detailExams: Exam[] = [];

      switch (statId) {
        case 'active-exams':
        case 'inactive-exams':
        case 'total-exams':
          const examsSnap = await getDocs(query(collection(db, 'exams'), limit(50)));
          detailExams = examsSnap.docs.map(doc => doc.data() as Exam);
          setExams(detailExams);
          break;
        case 'total-attempts':
          const attemptsSnap = await getDocs(query(collection(db, 'attempts'), where('status', 'in', ['submitted', 'graded']), limit(50), orderBy('startTime', 'desc')));
          detailAttempts = attemptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as ExamAttempt));
          setAttempts(detailAttempts);
          
          // Fetch only necessary student and exam metadata for these 50 attempts in batches
          const studentIds = Array.from(new Set(detailAttempts.map(a => a.studentId)));
          const examIds = Array.from(new Set(detailAttempts.map(a => a.examId)));
          
          const studentBatches = [];
          for (let i = 0; i < studentIds.length; i += 30) {
            const batch = studentIds.slice(i, i + 30);
            studentBatches.push(getDocs(query(collection(db, 'users'), where('__name__', 'in', batch))));
          }

          const examBatches = [];
          for (let i = 0; i < examIds.length; i += 30) {
            const batch = examIds.slice(i, i + 30);
            examBatches.push(getDocs(query(collection(db, 'exams'), where('__name__', 'in', batch))));
          }

          const [studentSnaps, examSnaps] = await Promise.all([
            Promise.all(studentBatches),
            Promise.all(examBatches)
          ]);
          
        studentSnaps.forEach(snap => snap.docs.forEach(d => detailStudents.push({ uid: d.id, ...d.data() } as UserProfile)));
        examSnaps.forEach(snap => snap.docs.forEach(d => detailExams.push({ id: d.id, ...d.data() } as Exam)));

        setStudents(detailStudents);
        setExams(detailExams);
          break;
        case 'total-students':
          const studentsSnap2 = await getDocs(query(collection(db, 'users'), where('role', '==', 'student'), limit(50)));
          detailStudents = studentsSnap2.docs.map(doc => ({ uid: doc.id, ...doc.data() as any } as UserProfile));
          setStudents(detailStudents);
          break;
        case 'total-examiners':
          const examinersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'examiner'), limit(50)));
          detailStudents = examinersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() as any } as UserProfile));
          setStudents(detailStudents);
          break;
        case 'active-students':
        case 'total-users':
          const usersQuery = statId === 'total-users' ? query(collection(db, 'users'), limit(100)) : query(collection(db, 'attempts'), where('status', '==', 'in-progress'), limit(50));
          if (statId === 'total-users') {
            const usersSnap = await getDocs(usersQuery);
            detailStudents = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() as any } as UserProfile));
            setStudents(detailStudents);
          } else {
            const activeAttemptsSnap = await getDocs(usersQuery);
            const activeStudentIds = Array.from(new Set(activeAttemptsSnap.docs.map(d => (d.data() as any as ExamAttempt).studentId)));
            
            if (activeStudentIds.length > 0) {
              const activeStudentBatches = [];
              for (let i = 0; i < activeStudentIds.length; i += 30) {
                const batch = activeStudentIds.slice(i, i + 30);
                activeStudentBatches.push(getDocs(query(collection(db, 'users'), where('__name__', 'in', batch))));
              }
              const activeStudentSnaps = await Promise.all(activeStudentBatches);
              activeStudentSnaps.forEach(snap => snap.docs.forEach(d => detailStudents.push({ uid: d.id, ...d.data() as any } as UserProfile)));
              setStudents(detailStudents);
            } else {
              setStudents([]);
            }
          }
          break;
      }

      // Cache the result
      sessionStorage.setItem(cacheKey, JSON.stringify({
        data: detailAttempts,
        students: detailStudents,
        exams: detailExams,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error fetching detail data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async (force = false) => {
    // Persistent cache check
    const localCacheKey = 'admin_recent_activity_persistent';
    if (!force) {
      const cached = localStorage.getItem(localCacheKey);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 1800000) { // 30 mins cache
            setRecentAttempts(data);
            return;
          }
        } catch (e) {}
      }
    }

    try {
      const recentQuery = query(collection(db, 'attempts'), orderBy('startTime', 'desc'), limit(5));
      const snapshot = await getDocs(recentQuery);
      const recentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as ExamAttempt));
      
      const enriched = await Promise.all(recentData.map(async (attempt) => {
        const student = await metadataCache.getUser(attempt.studentId);
        const exam = await metadataCache.getExam(attempt.examId);
        return {
          ...attempt,
          studentName: student?.displayName || 'Unknown Student',
          examTitle: exam?.title || 'Unknown Exam'
        };
      }));

      setRecentAttempts(enriched);
      localStorage.setItem(localCacheKey, JSON.stringify({ data: enriched, timestamp: Date.now() }));
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
      await logUserActivity(profile, 'RESET_ATTEMPT', `Reset attempt: ${attemptToReset}`);
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
    { id: 'active-students', title: 'Total Active Users', value: stats.activeStudents, icon: Activity, color: 'text-indigo-500', bg: 'bg-indigo-500/10', desc: 'Users currently active' },
    { id: 'total-users', title: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-cyan-500', bg: 'bg-cyan-500/10', desc: 'All registered accounts' },
    { id: 'total-examiners', title: 'Total Examiners', value: stats.totalExaminers, icon: Users, color: 'text-pink-500', bg: 'bg-pink-500/10', desc: 'Registered examiners' },
    { id: 'total-exams', title: 'Exams Created', value: stats.totalExams, icon: FileText, color: 'text-orange-500', bg: 'bg-orange-500/10', desc: 'All created exams' },
  ].sort((a, b) => a.title.localeCompare(b.title));

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
          data: attempts.filter(a => a.status === 'submitted' || a.status === 'graded').filter(a => {
            const student = students.find(s => s.uid === a.studentId);
            const exam = exams.find(e => e.id === a.examId);
            const searchLower = searchTerm.toLowerCase();
            return (
              (student?.displayName || '').toLowerCase().includes(searchLower) ||
              (student?.email || '').toLowerCase().includes(searchLower) ||
              (exam?.title || '').toLowerCase().includes(searchLower) ||
              a.id.toLowerCase().includes(searchLower)
            );
          }),
          columns: ['Student', 'Exam', 'Status', 'Score', 'Date', 'Actions'],
          renderRow: (attempt: ExamAttempt) => {
            const student = students.find(s => s.uid === attempt.studentId);
            const exam = exams.find(e => e.id === attempt.examId);
            const scoreDisplay = attempt.score !== undefined ? `${attempt.score}%` : (attempt.autoScore !== undefined ? `Auto: ${attempt.autoScore}` : 'N/A');
            
            return (
              <TableRow key={attempt.id}>
                <TableCell className="font-medium">{student?.displayName || attempt.studentId}</TableCell>
                <TableCell>{exam?.title || attempt.examId}</TableCell>
                <TableCell>
                  <Badge variant={attempt.status === 'graded' ? 'default' : 'secondary'}>
                    {attempt.status === 'submitted' ? 'Pending Grading' : attempt.status}
                  </Badge>
                </TableCell>
                <TableCell>{scoreDisplay}</TableCell>
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
      case 'total-examiners':
        return {
          title: 'Registered Examiners',
          description: 'All examiners registered on the platform.',
          data: students.filter(s => s.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || s.email.toLowerCase().includes(searchTerm.toLowerCase())),
          columns: ['Name', 'Email', 'Joined', 'Role'],
          renderRow: (examiner: UserProfile) => (
            <TableRow key={examiner.uid}>
              <TableCell className="font-medium">{examiner.displayName}</TableCell>
              <TableCell>{examiner.email}</TableCell>
              <TableCell>{new Date(examiner.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">{examiner.role}</Badge>
              </TableCell>
            </TableRow>
          )
        };
      case 'active-students':
        return {
          title: 'Total Active Users',
          description: 'Users currently performing activities (e.g., taking exams).',
          data: students.filter(s => s.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || s.email.toLowerCase().includes(searchTerm.toLowerCase())),
          columns: ['Name', 'Email', 'Joined', 'Status'],
          renderRow: (student: UserProfile) => (
            <TableRow key={student.uid}>
              <TableCell className="font-medium">{student.displayName}</TableCell>
              <TableCell>{student.email}</TableCell>
              <TableCell>{new Date(student.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>
                <Badge variant="default" className="bg-indigo-500 hover:bg-indigo-600">Active</Badge>
              </TableCell>
            </TableRow>
          )
        };
      case 'total-users':
        return {
          title: 'Total Users',
          description: 'All users registered in the system across all roles.',
          data: students.filter(s => s.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || s.email.toLowerCase().includes(searchTerm.toLowerCase())),
          columns: ['Name', 'Email', 'Role', 'Joined'],
          renderRow: (user: UserProfile) => (
            <TableRow key={user.uid}>
              <TableCell className="font-medium">{user.displayName}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">{user.role}</Badge>
              </TableCell>
              <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
            </TableRow>
          )
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
          <h2 className="text-3xl font-bold tracking-tight">Welcome, {profile?.displayName}</h2>
          <p className="text-muted-foreground mt-1">Overview of system performance and activity.</p>
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
                        <p className="text-sm text-muted-foreground">{attempt.examTitle}</p>
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
