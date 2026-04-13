import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where, writeBatch, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Exam, ExamAttempt, UserProfile, ActivityLog } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Download, FileText, FileSpreadsheet, File as FilePdf, ChevronRight, AlertTriangle, Clock, User, CheckCircle2, XCircle, Send, Trash2, ShieldCheck, Save } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF with autotable types
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export const StudentReports: React.FC = () => {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [studentAttempts, setStudentAttempts] = useState<ExamAttempt[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<ExamAttempt | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
  const [gradingAttempt, setGradingAttempt] = useState<ExamAttempt | null>(null);
  const [manualGrades, setManualGrades] = useState<Record<string, number>>({});
  const [isSavingGrades, setIsSavingGrades] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studentsToDelete, setStudentsToDelete] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [attemptToReset, setAttemptToReset] = useState<string | null>(null);
  const [isResettingAttempt, setIsResettingAttempt] = useState(false);

  const handleResetAttempt = async () => {
    if (!attemptToReset) return;
    setIsResettingAttempt(true);
    try {
      await deleteDoc(doc(db, 'attempts', attemptToReset));
      setAttemptToReset(null);
      // Also clear selected attempt if it's the one being reset
      if (selectedAttempt?.id === attemptToReset) {
        setSelectedAttempt(null);
      }
    } catch (error) {
      console.error('Error resetting attempt:', error);
      alert('Failed to reset attempt.');
    } finally {
      setIsResettingAttempt(false);
    }
  };

  useEffect(() => {
    const studentsUnsubscribe = onSnapshot(query(collection(db, 'users'), where('role', '==', 'student')), (snapshot) => {
      setStudents(snapshot.docs.map(doc => doc.data() as UserProfile));
    });

    const attemptsUnsubscribe = onSnapshot(collection(db, 'attempts'), (snapshot) => {
      setAttempts(snapshot.docs.map(doc => doc.data() as ExamAttempt));
    });

    const examsUnsubscribe = onSnapshot(collection(db, 'exams'), (snapshot) => {
      setExams(snapshot.docs.map(doc => doc.data() as Exam));
    });

    return () => {
      studentsUnsubscribe();
      attemptsUnsubscribe();
      examsUnsubscribe();
    };
  }, []);

  const getStudentStats = (studentId: string) => {
    const studentAttempts = attempts.filter(a => a.studentId === studentId && (a.status === 'submitted' || a.status === 'graded'));
    let totalScore = 0;
    let totalFullMarks = 0;
    let lastSubmissionTime = 0;

    studentAttempts.forEach(attempt => {
      const exam = exams.find(e => e.id === attempt.examId);
      if (exam) {
        const examFullMarks = exam.questions.reduce((sum, q) => sum + (q.points || 0), 0);
        totalFullMarks += examFullMarks;
      }
      totalScore += attempt.score || 0;
      const submissionTime = attempt.endTime || attempt.startTime;
      if (submissionTime > lastSubmissionTime) {
        lastSubmissionTime = submissionTime;
      }
    });

    const percentage = totalFullMarks > 0 ? (totalScore / totalFullMarks) * 100 : 0;

    return {
      attemptsCount: studentAttempts.length,
      totalScore,
      totalFullMarks,
      percentage,
      lastSubmissionTime,
      allPublished: studentAttempts.length > 0 && studentAttempts.every(a => a.isPublished),
      hasPending: studentAttempts.some(a => a.status === 'submitted')
    };
  };

  const handleBatchPublishStatus = async (publish: boolean) => {
    if (selectedStudentIds.length === 0) return;
    
    setIsPublishing(true);
    try {
      const batch = writeBatch(db);
      const attemptsToUpdate = attempts.filter(a => 
        selectedStudentIds.includes(a.studentId) && 
        (a.status === 'submitted' || a.status === 'graded') &&
        (publish ? !a.isPublished : a.isPublished)
      );

      attemptsToUpdate.forEach(attempt => {
        const attemptRef = doc(db, 'attempts', attempt.id);
        batch.update(attemptRef, { isPublished: publish });
      });

      await batch.commit();
      setSelectedStudentIds([]);
    } catch (error) {
      console.error(`Error ${publish ? 'publishing' : 'unpublishing'} scores:`, error);
    } finally {
      setIsPublishing(false);
    }
  };

  const confirmDeleteSelected = () => {
    setStudentsToDelete(selectedStudentIds);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteIndividual = (studentId: string) => {
    setStudentsToDelete([studentId]);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteStudents = async () => {
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      
      // Delete user documents
      studentsToDelete.forEach(studentId => {
        batch.delete(doc(db, 'users', studentId));
      });

      // Find and delete all attempts for these students
      const attemptsToDelete = attempts.filter(a => studentsToDelete.includes(a.studentId));
      attemptsToDelete.forEach(attempt => {
        batch.delete(doc(db, 'attempts', attempt.id));
      });

      await batch.commit();
      
      // Clear selection if deleted students were selected
      setSelectedStudentIds(prev => prev.filter(id => !studentsToDelete.includes(id)));
      setIsDeleteDialogOpen(false);
      setStudentsToDelete([]);
    } catch (error) {
      console.error('Error deleting students:', error);
      alert('Failed to delete student records.');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map(s => s.uid));
    }
  };

  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const filteredStudents = students.filter(s => 
    s.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToExcel = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reports");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const exportToCSV = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = (data: any[], title: string, fileName: string) => {
    const doc = new jsPDF();
    doc.text(title, 14, 15);
    const headers = Object.keys(data[0]);
    const body = data.map(row => Object.values(row));
    doc.autoTable({
      head: [headers],
      body: body,
      startY: 20,
    });
    doc.save(`${fileName}.pdf`);
  };

  const handleExportAll = (format: 'excel' | 'csv' | 'pdf') => {
    const data = filteredStudents.map(s => {
      const stats = getStudentStats(s.uid);
      return {
        'Student Name': s.displayName,
        'Email': s.email,
        'Exams Taken': stats.attemptsCount,
        'Total Marks': stats.totalScore,
        'Full Marks': stats.totalFullMarks,
        'Percentage': `${stats.percentage.toFixed(2)}%`
      };
    });

    if (format === 'excel') exportToExcel(data, 'All_Students_Report');
    else if (format === 'csv') exportToCSV(data, 'All_Students_Report');
    else exportToPDF(data, 'All Students Performance Report', 'All_Students_Report');
  };

  const handleStudentClick = (student: UserProfile) => {
    setSelectedStudent(student);
    setStudentAttempts(attempts.filter(a => a.studentId === student.uid).sort((a, b) => b.startTime - a.startTime));
  };

  const handleTogglePublish = async (attempt: ExamAttempt) => {
    setIsPublishing(attempt.id);
    try {
      await updateDoc(doc(db, 'attempts', attempt.id), {
        isPublished: !attempt.isPublished
      });
    } catch (error) {
      console.error('Error toggling publish status:', error);
      alert('Failed to update publish status.');
    } finally {
      setIsPublishing(null);
    }
  };

  const handleStartGrading = (attempt: ExamAttempt) => {
    setGradingAttempt(attempt);
    setManualGrades(attempt.manualGrades || {});
  };

  const handleSaveManualGrades = async () => {
    if (!gradingAttempt) return;
    
    setIsSavingGrades(true);
    try {
      const exam = exams.find(e => e.id === gradingAttempt.examId);
      if (!exam) throw new Error('Exam not found');

      // Calculate total score
      let autoScore: number = 0;
      exam.questions.forEach(q => {
        if (q.type === 'mcq' || q.type === 'boolean') {
          if (gradingAttempt.answers[q.id] === q.correctAnswer) {
            autoScore += q.points;
          }
        }
      });

      const manualTotal: number = (Object.values(manualGrades) as any[]).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
      const totalScore: number = autoScore + manualTotal;

      await updateDoc(doc(db, 'attempts', gradingAttempt.id), {
        manualGrades,
        score: totalScore,
        status: 'graded'
      });

      setGradingAttempt(null);
      setManualGrades({});
    } catch (error) {
      console.error('Error saving grades:', error);
      alert('Failed to save grades.');
    } finally {
      setIsSavingGrades(false);
    }
  };

  const handleExportProctoringLogs = (attempt: ExamAttempt, format: 'excel' | 'csv' | 'pdf') => {
    const exam = exams.find(e => e.id === attempt.examId);
    const student = students.find(s => s.uid === attempt.studentId);
    const logs = attempt.suspiciousActivity || [];
    
    const data = logs.map(log => ({
      'Time': new Date(log.timestamp).toLocaleString(),
      'Type': log.type.replace('-', ' ').toUpperCase(),
      'Details': log.details
    }));

    const fileName = `Proctoring_Logs_${student?.displayName || 'Student'}_${exam?.title || 'Exam'}`;
    const title = `Proctoring Logs: ${student?.displayName} - ${exam?.title}`;

    if (data.length === 0) {
      data.push({ 'Time': 'N/A', 'Type': 'NO ACTIVITY', 'Details': 'No suspicious activity detected.' });
    }

    if (format === 'excel') exportToExcel(data, fileName);
    else if (format === 'csv') exportToCSV(data, fileName);
    else exportToPDF(data, title, fileName);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Student Reports</h2>
          <p className="text-muted-foreground">Monitor student performance and anti-cheating logs.</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedStudentIds.length > 0 && (
            <div className="flex items-center gap-2 mr-4 border-r pr-4">
              <span className="text-xs font-medium text-muted-foreground">{selectedStudentIds.length} selected</span>
              <Button size="sm" onClick={() => handleBatchPublishStatus(true)} disabled={isPublishing}>
                <Send className="w-4 h-4 mr-2" />
                Publish
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBatchPublishStatus(false)} disabled={isPublishing || isDeleting}>
                <XCircle className="w-4 h-4 mr-2" />
                Unpublish
              </Button>
              <Button size="sm" variant="destructive" onClick={confirmDeleteSelected} disabled={isPublishing || isDeleting}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => handleExportAll('excel')}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExportAll('csv')}>
            <FileText className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExportAll('pdf')}>
            <FilePdf className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search students by name or email..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      checked={selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Exams Taken</TableHead>
                  <TableHead>Total Marks</TableHead>
                  <TableHead>Full Marks</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Last Submission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No students found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => {
                    const stats = getStudentStats(student.uid);
                    return (
                      <TableRow key={student.uid} className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedStudentIds.includes(student.uid)}
                            onCheckedChange={() => toggleSelectStudent(student.uid)}
                          />
                        </TableCell>
                        <TableCell onClick={() => handleStudentClick(student)}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {student.displayName[0]}
                            </div>
                            <div>
                              <p className="font-medium">{student.displayName}</p>
                              <p className="text-xs text-muted-foreground">{student.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell onClick={() => handleStudentClick(student)}>{stats.attemptsCount}</TableCell>
                        <TableCell onClick={() => handleStudentClick(student)}>
                          <Badge variant="secondary">{stats.totalScore}</Badge>
                        </TableCell>
                        <TableCell onClick={() => handleStudentClick(student)}>
                          <Badge variant="outline">{stats.totalFullMarks}</Badge>
                        </TableCell>
                        <TableCell onClick={() => handleStudentClick(student)}>
                          <span className={`font-bold ${stats.percentage >= 40 ? 'text-green-600' : 'text-destructive'}`}>
                            {stats.percentage.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell onClick={() => handleStudentClick(student)}>
                          <span className="text-xs text-muted-foreground">
                            {stats.lastSubmissionTime > 0 ? new Date(stats.lastSubmissionTime).toLocaleString() : 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell onClick={() => handleStudentClick(student)}>
                          {stats.attemptsCount > 0 ? (
                            stats.hasPending ? (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending Grading
                              </Badge>
                            ) : stats.allPublished ? (
                              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Published
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending Publication
                              </Badge>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">No attempts</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleStudentClick(student)}>
                              View Details
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => confirmDeleteIndividual(student.uid)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Student Detail Full Screen Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="max-w-[100vw] w-screen h-screen m-0 rounded-none overflow-hidden flex flex-col p-0">
          <div className="h-16 border-b flex items-center justify-between px-6 bg-card shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {selectedStudent?.displayName[0]}
              </div>
              <div>
                <DialogTitle className="text-xl">{selectedStudent?.displayName}'s Performance Report</DialogTitle>
                <p className="text-xs text-muted-foreground">{selectedStudent?.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedStudent(null)}>
              <XCircle className="w-6 h-6" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-6">
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  const stats = selectedStudent ? getStudentStats(selectedStudent.uid) : { attemptsCount: 0, totalScore: 0, totalFullMarks: 0, percentage: 0 };
                  return (
                    <>
                      <Card className="bg-primary/5 border-primary/10">
                        <CardContent className="p-6">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Marks Obtained</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <p className="text-3xl font-bold text-primary">{stats.totalScore}</p>
                            <p className="text-sm text-muted-foreground">/ {stats.totalFullMarks}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-green-500/5 border-green-500/10">
                        <CardContent className="p-6">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Overall Percentage</p>
                          <p className={`text-3xl font-bold mt-1 ${stats.percentage >= 40 ? 'text-green-600' : 'text-destructive'}`}>
                            {stats.percentage.toFixed(2)}%
                          </p>
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-xl flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Examination History
                </h3>
                {studentAttempts.length === 0 ? (
                  <div className="text-center py-12 border rounded-2xl border-dashed bg-muted/30">
                    <p className="text-muted-foreground">No examination attempts found for this student.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {studentAttempts.map((attempt) => {
                      const exam = exams.find(e => e.id === attempt.examId);
                      const suspiciousCount = attempt.suspiciousActivity?.length || 0;
                      const examFullMarks = exam?.questions.reduce((sum, q) => sum + (q.points || 0), 0) || 0;
                      const attemptPercentage = examFullMarks > 0 ? ((attempt.score || 0) / examFullMarks) * 100 : 0;

                      return (
                        <Card key={attempt.id} className={`overflow-hidden border-2 ${suspiciousCount > 0 ? 'border-destructive/20' : 'border-primary/10'}`}>
                          <div className={`h-1.5 ${suspiciousCount > 0 ? 'bg-destructive' : 'bg-green-500'}`} />
                          <CardContent className="p-6">
                              <div className="flex flex-col md:flex-row justify-between gap-6">
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3">
                                    <h4 className="font-bold text-xl">{exam?.title || 'Unknown Exam'}</h4>
                                    <Badge variant={attempt.status === 'graded' ? 'default' : 'secondary'} className="h-6">
                                      {attempt.status === 'graded' ? 'Graded' : 'Pending Grading'}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap gap-4">
                                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                      <Clock className="w-4 h-4" />
                                      {new Date(attempt.endTime || attempt.startTime).toLocaleString()}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 font-bold">
                                        Score: {attempt.score !== undefined ? attempt.score : 'N/A'} / {examFullMarks}
                                      </Badge>
                                      <Badge variant="outline" className={`${attemptPercentage >= 40 ? 'text-green-600 border-green-200 bg-green-50' : 'text-destructive border-destructive/20 bg-destructive/5'} font-bold`}>
                                        {attemptPercentage.toFixed(1)}%
                                      </Badge>
                                    </div>
                                    {suspiciousCount > 0 && (
                                      <Badge variant="destructive" className="animate-pulse">
                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                        {suspiciousCount} Security Alerts
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border">
                                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleExportProctoringLogs(attempt, 'excel')} title="Export Logs to Excel">
                                      <FileSpreadsheet className="w-4 h-4 text-green-600" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleExportProctoringLogs(attempt, 'csv')} title="Export Logs to CSV">
                                      <FileText className="w-4 h-4 text-blue-600" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleExportProctoringLogs(attempt, 'pdf')} title="Export Logs to PDF">
                                      <FilePdf className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </div>
                                  {(attempt.status === 'submitted' || attempt.status === 'graded') && (
                                    <div className="flex items-center gap-2">
                                      <Button 
                                        variant={attempt.status === 'graded' ? 'outline' : 'default'} 
                                        size="sm" 
                                        className={attempt.status === 'submitted' ? "bg-yellow-600 hover:bg-yellow-700" : ""}
                                        onClick={() => handleStartGrading(attempt)}
                                      >
                                        {attempt.status === 'graded' ? 'Regrade Subjective' : 'Grade Subjective'}
                                      </Button>
                                      <Button
                                        variant={attempt.isPublished ? "secondary" : "default"}
                                        size="sm"
                                        className={!attempt.isPublished ? "bg-green-600 hover:bg-green-700" : ""}
                                        onClick={() => handleTogglePublish(attempt)}
                                        disabled={isPublishing === attempt.id}
                                      >
                                        {attempt.isPublished ? 'Unpublish' : 'Publish'}
                                      </Button>
                                    </div>
                                  )}
                                  <Button variant="outline" size="sm" onClick={() => setSelectedAttempt(selectedAttempt?.id === attempt.id ? null : attempt)}>
                                    {selectedAttempt?.id === attempt.id ? 'Hide Logs' : 'View Logs'}
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => setAttemptToReset(attempt.id)} title="Reset Attempt">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>

                            {selectedAttempt?.id === attempt.id && (
                              <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="bg-muted/30 rounded-2xl p-6 border-2 border-dashed">
                                  <h5 className="font-bold text-base mb-4 flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-primary" />
                                    Proctoring & Security Logs
                                  </h5>
                                  {attempt.suspiciousActivity && attempt.suspiciousActivity.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {attempt.suspiciousActivity.map((log, idx) => (
                                        <div key={idx} className="flex gap-4 p-4 bg-background rounded-xl border-2 border-destructive/10 shadow-sm">
                                          <div className="mt-1 shrink-0">
                                            <AlertTriangle className="w-5 h-5 text-destructive" />
                                          </div>
                                          <div>
                                            <p className="font-bold capitalize text-destructive text-sm">{log.type.replace('-', ' ')}</p>
                                            <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{log.details}</p>
                                            <p className="text-[10px] text-muted-foreground mt-2 font-mono bg-muted px-2 py-0.5 rounded inline-block">
                                              {new Date(log.timestamp).toLocaleTimeString()}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                      <CheckCircle2 className="w-12 h-12 text-green-500 mb-2 opacity-50" />
                                      <p className="text-sm text-muted-foreground font-medium">Perfect! No suspicious activity detected during this examination.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Manual Grading Full Screen Dialog */}
      <Dialog open={!!gradingAttempt} onOpenChange={(open) => !open && setGradingAttempt(null)}>
        <DialogContent className="max-w-[100vw] w-screen h-screen m-0 rounded-none overflow-hidden flex flex-col p-0">
          <div className="h-16 border-b flex items-center justify-between px-6 bg-card shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-600 font-bold">
                G
              </div>
              <div>
                <DialogTitle className="text-xl">Manual Grading Interface</DialogTitle>
                <DialogDescription>
                  Grading {students.find(s => s.uid === gradingAttempt?.studentId)?.displayName}'s subjective responses
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setGradingAttempt(null)}>
              <XCircle className="w-6 h-6" />
            </Button>
          </div>
          
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-4xl mx-auto space-y-8">
              {(() => {
                const exam = exams.find(e => e.id === gradingAttempt?.examId);
                const subjectiveQuestions = exam?.questions.filter(q => q.type === 'short' || q.type === 'long') || [];
                
                if (subjectiveQuestions.length === 0) {
                  return (
                    <div className="text-center py-12 border-2 border-dashed rounded-2xl">
                      <p className="text-muted-foreground">No subjective questions to grade for this exam.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {subjectiveQuestions.map((q, idx) => (
                      <Card key={q.id} className="border-2 border-primary/5 shadow-sm overflow-hidden">
                        <div className="h-1 bg-primary/20" />
                        <CardHeader className="pb-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-primary uppercase tracking-widest">Question {idx + 1}</p>
                              <CardTitle className="text-lg leading-relaxed">{q.text}</CardTitle>
                            </div>
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                              {q.points} Max Marks
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="p-6 bg-muted/30 rounded-2xl border-2 border-dashed">
                            <p className="text-xs font-bold text-muted-foreground uppercase mb-3 tracking-wider">Student's Response:</p>
                            <p className="text-base leading-relaxed whitespace-pre-wrap">
                              {gradingAttempt?.answers[q.id] || <span className="italic text-muted-foreground">No answer provided by the student.</span>}
                            </p>
                          </div>
                          
                          <div className="flex flex-col md:flex-row items-end gap-6 pt-4 border-t">
                            <div className="flex-1 w-full">
                              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Award Marks:</label>
                              <div className="flex items-center gap-3">
                                <Input 
                                  type="number" 
                                  min="0" 
                                  max={q.points} 
                                  step="0.5"
                                  value={manualGrades[q.id] || 0}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (val > q.points) {
                                      setManualGrades(prev => ({ ...prev, [q.id]: q.points }));
                                    } else if (val < 0) {
                                      setManualGrades(prev => ({ ...prev, [q.id]: 0 }));
                                    } else {
                                      setManualGrades(prev => ({ ...prev, [q.id]: val }));
                                    }
                                  }}
                                  className="text-lg font-bold h-12"
                                />
                                <span className="text-xl font-bold text-muted-foreground">/ {q.points}</span>
                              </div>
                            </div>
                            <div className="shrink-0">
                              <Badge variant={manualGrades[q.id] > 0 ? "default" : "secondary"} className="h-12 px-6 text-sm">
                                {manualGrades[q.id] || 0} Marks Awarded
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })()}
            </div>
          </ScrollArea>

          <div className="h-20 border-t bg-card flex items-center justify-end px-8 gap-4 shrink-0">
            <Button variant="outline" onClick={() => setGradingAttempt(null)} disabled={isSavingGrades}>
              Cancel
            </Button>
            <Button onClick={handleSaveManualGrades} disabled={isSavingGrades} className="px-8">
              {isSavingGrades ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Saving Marks...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Finalize & Save Marks
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {studentsToDelete.length} student record(s) and all of their associated exam attempts and grades from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default" disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStudents} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? 'Deleting...' : 'Delete Records'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Attempt Confirmation Dialog */}
      <AlertDialog open={!!attemptToReset} onOpenChange={(open) => !open && setAttemptToReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Exam Attempt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this exam submission. The student will be able to retake the exam from the beginning. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default" disabled={isResettingAttempt}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetAttempt} disabled={isResettingAttempt} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isResettingAttempt ? 'Resetting...' : 'Reset Attempt'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Shield = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);
