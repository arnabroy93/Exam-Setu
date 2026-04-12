import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { Exam, ExamAttempt, UserProfile, ActivityLog } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Download, FileText, FileSpreadsheet, File as FilePdf, ChevronRight, AlertTriangle, Clock, User, CheckCircle2, XCircle, Send, Trash2 } from 'lucide-react';
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
  const [isPublishing, setIsPublishing] = useState(false);
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
    let totalRight = 0;
    let totalWrong = 0;
    let totalScore = 0;
    let lastSubmissionTime = 0;

    studentAttempts.forEach(attempt => {
      const exam = exams.find(e => e.id === attempt.examId);
      if (exam) {
        exam.questions.forEach(q => {
          const answer = attempt.answers[q.id];
          if (answer !== undefined) {
            if (JSON.stringify(answer) === JSON.stringify(q.correctAnswer)) {
              totalRight++;
            } else {
              totalWrong++;
            }
          }
        });
      }
      totalScore += attempt.score || 0;
      const submissionTime = attempt.endTime || attempt.startTime;
      if (submissionTime > lastSubmissionTime) {
        lastSubmissionTime = submissionTime;
      }
    });

    return {
      attemptsCount: studentAttempts.length,
      totalRight,
      totalWrong,
      totalScore,
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
        'Total Right': stats.totalRight,
        'Total Wrong': stats.totalWrong,
        'Total Marks': stats.totalScore
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
                  <TableHead>Total Right</TableHead>
                  <TableHead>Total Wrong</TableHead>
                  <TableHead>Total Marks</TableHead>
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
                        <TableCell onClick={() => handleStudentClick(student)} className="text-green-600 font-medium">{stats.totalRight}</TableCell>
                        <TableCell onClick={() => handleStudentClick(student)} className="text-destructive font-medium">{stats.totalWrong}</TableCell>
                        <TableCell onClick={() => handleStudentClick(student)}>
                          <Badge variant="secondary">{stats.totalScore}</Badge>
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

      {/* Student Detail Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {selectedStudent?.displayName}'s Detailed Report
            </DialogTitle>
            <DialogDescription>
              View all exam attempts and detailed proctoring logs for this student.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(() => {
                const stats = selectedStudent ? getStudentStats(selectedStudent.uid) : { attemptsCount: 0, totalRight: 0, totalWrong: 0, totalScore: 0 };
                return (
                  <>
                    <Card className="bg-primary/5 border-primary/10">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Total Marks</p>
                        <p className="text-2xl font-bold text-primary">{stats.totalScore}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-500/5 border-green-500/10">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Total Right</p>
                        <p className="text-2xl font-bold text-green-600">{stats.totalRight}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-destructive/5 border-destructive/10">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Total Wrong</p>
                        <p className="text-2xl font-bold text-destructive">{stats.totalWrong}</p>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-lg">Exam History</h3>
              {studentAttempts.length === 0 ? (
                <div className="text-center py-8 border rounded-xl border-dashed">No exam attempts found.</div>
              ) : (
                <div className="space-y-4">
                  {studentAttempts.map((attempt) => {
                    const exam = exams.find(e => e.id === attempt.examId);
                    const suspiciousCount = attempt.suspiciousActivity?.length || 0;
                    return (
                      <Card key={attempt.id} className={`overflow-hidden border-l-4 ${suspiciousCount > 0 ? 'border-l-destructive' : 'border-l-green-500'}`}>
                        <CardContent className="p-4">
                            <div className="flex flex-col md:flex-row justify-between gap-4">
                              <div>
                                <h4 className="font-bold text-lg">{exam?.title || 'Unknown Exam'}</h4>
                                <div className="flex flex-wrap gap-3 mt-2">
                                  <span className="text-xs flex items-center gap-1 text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    Submitted: {new Date(attempt.endTime || attempt.startTime).toLocaleString()}
                                  </span>
                                  <Badge variant={attempt.status === 'graded' ? 'default' : 'secondary'}>
                                    Score: {attempt.score !== undefined ? attempt.score : 'Pending'}
                                  </Badge>
                                  <Badge variant={attempt.isPublished ? 'outline' : 'secondary'} className={attempt.isPublished ? 'text-green-600 border-green-200 bg-green-50' : 'text-muted-foreground'}>
                                    {attempt.isPublished ? 'Published' : 'Unpublished'}
                                  </Badge>
                                  {suspiciousCount > 0 && (
                                    <Badge variant="destructive" className="animate-pulse">
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      {suspiciousCount} Alerts
                                    </Badge>
                                  )}
                                  {attempt.status === 'submitted' && (
                                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                                      Pending Grading
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 border-r pr-2 mr-2">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExportProctoringLogs(attempt, 'excel')} title="Export Logs to Excel">
                                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExportProctoringLogs(attempt, 'csv')} title="Export Logs to CSV">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExportProctoringLogs(attempt, 'pdf')} title="Export Logs to PDF">
                                    <FilePdf className="w-4 h-4 text-red-600" />
                                  </Button>
                                </div>
                                {attempt.status === 'submitted' && (
                                  <Button variant="default" size="sm" className="bg-yellow-600 hover:bg-yellow-700" onClick={() => handleStartGrading(attempt)}>
                                    Grade Subjective
                                  </Button>
                                )}
                                <Button variant="outline" size="sm" onClick={() => setSelectedAttempt(selectedAttempt?.id === attempt.id ? null : attempt)}>
                                  {selectedAttempt?.id === attempt.id ? 'Hide Logs' : 'View Logs'}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setAttemptToReset(attempt.id)} title="Reset Attempt">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>

                          {selectedAttempt?.id === attempt.id && (
                            <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                              <div className="bg-muted/50 rounded-lg p-4">
                                <h5 className="font-bold text-sm mb-3 flex items-center gap-2">
                                  <Shield className="w-4 h-4 text-primary" />
                                  Proctoring Logs
                                </h5>
                                {attempt.suspiciousActivity && attempt.suspiciousActivity.length > 0 ? (
                                  <div className="space-y-3">
                                    {attempt.suspiciousActivity.map((log, idx) => (
                                      <div key={idx} className="flex gap-3 text-sm border-b border-border/50 pb-2 last:border-0">
                                        <div className="mt-1">
                                          <AlertTriangle className="w-4 h-4 text-destructive" />
                                        </div>
                                        <div>
                                          <p className="font-medium capitalize text-destructive">{log.type.replace('-', ' ')}</p>
                                          <p className="text-muted-foreground text-xs">{log.details}</p>
                                          <p className="text-[10px] text-muted-foreground mt-1">
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">No suspicious activity detected during this exam.</p>
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
        </DialogContent>
      </Dialog>

      {/* Manual Grading Dialog */}
      <Dialog open={!!gradingAttempt} onOpenChange={(open) => !open && setGradingAttempt(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manual Grading</DialogTitle>
            <DialogDescription>
              Grade subjective questions for {students.find(s => s.uid === gradingAttempt?.studentId)?.displayName}'s attempt.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {(() => {
                const exam = exams.find(e => e.id === gradingAttempt?.examId);
                const subjectiveQuestions = exam?.questions.filter(q => q.type === 'short' || q.type === 'long') || [];
                
                return subjectiveQuestions.map((q, idx) => (
                  <Card key={q.id} className="border-primary/10">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-sm font-bold">Question {idx + 1}</CardTitle>
                        <Badge variant="outline">{q.points} Points Max</Badge>
                      </div>
                      <p className="text-sm mt-1">{q.text}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-3 bg-muted rounded-lg border border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Student Answer:</p>
                        <p className="text-sm whitespace-pre-wrap">{gradingAttempt?.answers[q.id] || <span className="italic text-muted-foreground">No answer provided</span>}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <label className="text-xs font-bold text-muted-foreground uppercase">Award Marks:</label>
                          <Input 
                            type="number" 
                            min="0" 
                            max={q.points} 
                            value={manualGrades[q.id] || 0}
                            onChange={(e) => setManualGrades(prev => ({ ...prev, [q.id]: Number(e.target.value) }))}
                            className="mt-1"
                          />
                        </div>
                        <div className="pt-5">
                          <span className="text-sm font-medium">/ {q.points}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ));
              })()}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setGradingAttempt(null)}>Cancel</Button>
            <Button onClick={handleSaveManualGrades} disabled={isSavingGrades}>
              {isSavingGrades ? 'Saving...' : 'Complete Grading'}
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
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
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
            <AlertDialogCancel disabled={isResettingAttempt}>Cancel</AlertDialogCancel>
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
