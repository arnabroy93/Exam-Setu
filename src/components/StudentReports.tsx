import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where, writeBatch, doc, updateDoc, deleteDoc, getDocs, limit, orderBy, startAfter, endBefore, limitToLast, getCountFromServer } from 'firebase/firestore';
import { Exam, ExamAttempt, UserProfile, ActivityLog } from '../types';
import { metadataCache } from '../lib/metadataCache';
import { useAuth } from '../lib/AuthContext';
import { logUserActivity } from '../lib/activityLogger';
import { updateStat, getSystemStats, seedSystemStats } from '../lib/stats';
import { calculateAutoScore, calculateTotalObtained } from '../lib/gradingUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Download, FileText, FileSpreadsheet, File as FilePdf, ChevronRight, AlertTriangle, Clock, User, CheckCircle2, XCircle, Send, Trash2, ShieldCheck, Save, RefreshCw, Activity, ChevronLeft } from 'lucide-react';
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
import { useDebounce } from '../hooks/useDebounce';
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
  const { profile } = useAuth();
  const [view, setView] = useState<'list' | 'student-details' | 'grading'>('list');
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);

  // Main List Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalStudentsCount, setTotalStudentsCount] = useState(0);
  const [firstDoc, setFirstDoc] = useState<any>(null);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [searchBuffer, setSearchBuffer] = useState<UserProfile[] | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  // Detail List Pagination
  const [detailCurrentPage, setDetailCurrentPage] = useState(1);
  const [detailItemsPerPage] = useState(5);

  const studentAttempts = useMemo(() => {
    if (!selectedStudent) return [];
    return attempts
      .filter(a => a.studentId === selectedStudent.uid)
      .sort((a, b) => b.startTime - a.startTime);
  }, [attempts, selectedStudent]);

  // Reset detail page when student changes
  useEffect(() => {
    setDetailCurrentPage(1);
  }, [selectedStudent]);
  
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState<string | boolean | null>(null);
  const [gradingAttempt, setGradingAttempt] = useState<ExamAttempt | null>(null);
  const [manualGrades, setManualGrades] = useState<Record<string, number>>({});
  const [isSavingGrades, setIsSavingGrades] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studentsToDelete, setStudentsToDelete] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [attemptToReset, setAttemptToReset] = useState<string | null>(null);
  const [isResettingAttempt, setIsResettingAttempt] = useState(false);
  const [hasLoadedReports, setHasLoadedReports] = useState(false);
  const [attemptsFetchedUids, setAttemptsFetchedUids] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async (direction?: 'next' | 'prev' | 'first') => {
    setIsRefreshing(true);
    try {
      const studentsCol = collection(db, 'users');
      let q;

      // Optimisation: Search Buffer logic
      if (debouncedSearchTerm) {
        // If we have a buffer and the new term is a refinement, don't fetch from Firestore
        if (searchBuffer && debouncedSearchTerm.startsWith(lastSearchQuery) && lastSearchQuery !== '') {
          setIsRefreshing(false);
          setLoading(false);
          return;
        }

        // Fetch new buffer - reduced from 1000 to 200 to save quota
        q = query(studentsCol, where('role', '==', 'student'), orderBy('createdAt', 'desc'), limit(200));
        setLastSearchQuery(debouncedSearchTerm);
      } else {
        // Not searching, clear buffer
        setSearchBuffer(null);
        setLastSearchQuery('');
        
        const baseConstraints = [where('role', '==', 'student'), orderBy('createdAt', 'desc'), limit(itemsPerPage)];
        if (direction === 'next' && lastDoc) {
          q = query(studentsCol, ...baseConstraints, startAfter(lastDoc));
        } else if (direction === 'prev' && firstDoc) {
          q = query(studentsCol, where('role', '==', 'student'), orderBy('createdAt', 'desc'), limitToLast(itemsPerPage), endBefore(firstDoc));
        } else {
          q = query(studentsCol, ...baseConstraints);
        }
      }

      // Check count persistence
      const cacheKey = 'total_students_count_persistent';
      if (direction === 'first' || !direction) {
        const cached = localStorage.getItem(cacheKey);
        if (cached && !isRefreshing) {
          try {
            const { count, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 1800000) { // 30 mins persistent cache
              setTotalStudentsCount(count);
            } else {
              throw new Error('stale');
            }
          } catch (e) {
            // Use the optimized stats document
            const stats = await getSystemStats();
            const count = stats ? stats.totalStudents : 0;
            setTotalStudentsCount(count);
            localStorage.setItem(cacheKey, JSON.stringify({ count, timestamp: Date.now() }));
          }
        } else {
          const stats = await getSystemStats();
          const count = stats ? stats.totalStudents : 0;
          setTotalStudentsCount(count);
          localStorage.setItem(cacheKey, JSON.stringify({ count, timestamp: Date.now() }));
        }
      }

      const studentsSnap = await getDocs(q);
      let studentsData = studentsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() as any } as UserProfile));
      
      if (debouncedSearchTerm) {
        setSearchBuffer(studentsData);
      } else {
        setStudents(studentsData);
        setFirstDoc(studentsSnap.docs[0]);
        setLastDoc(studentsSnap.docs[studentsSnap.docs.length - 1]);
      }

      if (!direction || direction === 'first') setCurrentPage(1);
      else if (direction === 'next') setCurrentPage(prev => prev + 1);
      else if (direction === 'prev') setCurrentPage(prev => prev - 1);

    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, [itemsPerPage, debouncedSearchTerm, lastDoc, firstDoc, isRefreshing, searchBuffer, lastSearchQuery]);

  // Effect to handle attempts fetching for visible page only (Massive optimization)
  useEffect(() => {
    const fetchAttemptsForVisibleStudents = async () => {
      let visibleIds: string[] = [];
      if (debouncedSearchTerm && searchBuffer) {
        const term = debouncedSearchTerm.toLowerCase();
        const filtered = searchBuffer.filter(s => 
          s.displayName.toLowerCase().includes(term) ||
          s.email.toLowerCase().includes(term)
        );
        const start = (currentPage - 1) * itemsPerPage;
        visibleIds = filtered.slice(start, start + itemsPerPage).map(s => s.uid);
      } else {
        visibleIds = students.map(s => s.uid);
      }

      // Optimization: Only fetch IDs that haven't been fetched in this session/component lifecycle
      const idsToFetch = visibleIds.filter(id => !attemptsFetchedUids.has(id));
      if (idsToFetch.length === 0) return;

      try {
        let newAttempts: ExamAttempt[] = [];
        // Chunk 'in' queries to respect Firestore's 30-item limit
        for (let i = 0; i < idsToFetch.length; i += 30) {
          const batchIds = idsToFetch.slice(i, i + 30);
          const attemptsSnap = await getDocs(query(
            collection(db, 'attempts'), 
            where('studentId', 'in', batchIds)
          ));
          newAttempts = [...newAttempts, ...attemptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as ExamAttempt))];
        }
        
        // Append to existing attempts state (unique only)
        setAttempts(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const filteredNew = newAttempts.filter(a => !existingIds.has(a.id));
          return [...prev, ...filteredNew];
        });
        
        // Mark these UIDs as fetched
        setAttemptsFetchedUids(prev => {
          const next = new Set(prev);
          idsToFetch.forEach(id => next.add(id));
          return next;
        });

        setHasLoadedReports(true);
      } catch (e) {
        console.error("Error fetching attempts for page:", e);
      }
    };

    if (students.length > 0 || searchBuffer) {
      fetchAttemptsForVisibleStudents();
    }
  }, [students, searchBuffer, currentPage, debouncedSearchTerm, itemsPerPage, attemptsFetchedUids]);

  // Lazy fetch exams only when needed for detail view or grading
  useEffect(() => {
    const loadExams = async () => {
      if ((view === 'student-details' || view === 'grading') && exams.length === 0) {
        const examsData = await metadataCache.getExamsList();
        setExams(examsData);
      }
    };
    loadExams();
  }, [view, exams.length]);

  useEffect(() => {
    fetchData('first');
  }, [debouncedSearchTerm]);

  const handleRefresh = () => {
    fetchData('first');
  };

  const handleResetAttempt = async () => {
    if (!attemptToReset) return;
    setIsResettingAttempt(true);
    try {
      await deleteDoc(doc(db, 'attempts', attemptToReset));
      await updateStat('submittedAttempts', -1);
      setAttemptToReset(null);
      if (selectedAttemptId === attemptToReset) {
        setSelectedAttemptId(null);
      }
      fetchData('first'); // Refresh data after reset
    } catch (error) {
      console.error('Error resetting attempt:', error);
      alert('Failed to reset attempt.');
    } finally {
      setIsResettingAttempt(false);
    }
  };

  const getStudentStats = (studentId: string) => {
    const studentAttempts = attempts.filter(a => a.studentId === studentId && (a.status === 'submitted' || a.status === 'graded'));
    
    // Group attempts by examId to find the best attempt for each exam
    const attemptsByExam: Record<string, ExamAttempt> = {};
    studentAttempts.forEach(attempt => {
      const exam = exams.find(e => e.id === attempt.examId);
      const currentBest = attemptsByExam[attempt.examId];
      const attemptScore = calculateTotalObtained(attempt, exam);
      const currentBestScore = currentBest ? calculateTotalObtained(currentBest, exams.find(e => e.id === currentBest.examId)) : -1;
      
      if (!currentBest || attemptScore > currentBestScore) {
        attemptsByExam[attempt.examId] = attempt;
      }
    });

    let totalScore = 0;
    let totalFullMarks = 0;
    let lastSubmissionTime = 0;

    Object.values(attemptsByExam).forEach(attempt => {
      const exam = exams.find(e => e.id === attempt.examId);
      
      // Use stored totalPossibleMarks or calculate from exam if missing (legacy compatibility)
      const examFullMarks = attempt.totalPossibleMarks || (exam ? exam.questions.reduce((sum, q) => sum + (q.points || 0), 0) : 0);
      
      if (examFullMarks > 0) {
        totalFullMarks += examFullMarks;
        totalScore += calculateTotalObtained(attempt, exam);
      }
    });

    studentAttempts.forEach(attempt => {
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
      
      if (profile) {
        const deletedNames = studentsToDelete.map(id => students.find(s => s.uid === id)?.displayName || 'Unknown').join(', ');
        await logUserActivity(profile, 'DELETE_REPORT', `Deleted student records for: ${deletedNames}`);
      }
      
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

  const filteredStudents = useMemo(() => {
    if (debouncedSearchTerm && searchBuffer) {
      const term = debouncedSearchTerm.toLowerCase();
      return searchBuffer.filter(s => 
        s.displayName.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term)
      );
    }
    return students;
  }, [students, searchBuffer, debouncedSearchTerm]);

  // Main List Pagination logic 
  const mainPaginatedStudents = useMemo(() => {
    if (debouncedSearchTerm && searchBuffer) {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredStudents.slice(start, start + itemsPerPage);
    }
    return students;
  }, [students, filteredStudents, currentPage, itemsPerPage, debouncedSearchTerm, searchBuffer]);

  const handlePageChange = (newPage: number) => {
    if (newPage > currentPage) {
      if (debouncedSearchTerm && searchBuffer) {
        setCurrentPage(newPage);
      } else {
        fetchData('next');
      }
    } else if (newPage < currentPage) {
      if (newPage < 1) return;
      if (debouncedSearchTerm && searchBuffer) {
        setCurrentPage(newPage);
      } else {
        fetchData('prev');
      }
    }
  };

  const totalPagesForSearch = useMemo(() => {
    if (debouncedSearchTerm && searchBuffer) {
      return Math.ceil(filteredStudents.length / itemsPerPage);
    }
    return 1;
  }, [debouncedSearchTerm, filteredStudents.length, searchBuffer, itemsPerPage]);

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

  const detailTotalPages = Math.ceil(studentAttempts.length / detailItemsPerPage);
  const detailPaginatedAttempts = studentAttempts.slice((detailCurrentPage - 1) * detailItemsPerPage, detailCurrentPage * detailItemsPerPage);

  const handleDetailPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= detailTotalPages) {
      setDetailCurrentPage(newPage);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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

  const [isExporting, setIsExporting] = useState(false);

  const getExportData = async () => {
    setIsExporting(true);
    try {
      let exportStudents: UserProfile[] = [];
      
      // Optimization: If search buffer is active, use it for export (up to the buffer size)
      if (debouncedSearchTerm && searchBuffer && searchBuffer.length > 0) {
        exportStudents = filteredStudents;
      } else {
        const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student'), limit(5000)));
        exportStudents = studentsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() as any } as UserProfile));
      }

      let exportAttempts: ExamAttempt[] = [];
      const studentIds = exportStudents.map(s => s.uid);
      
      if (studentIds.length > 0) {
        // Optimization: Check what we already have in attemptsMemory (attemptsFetchedUids)
        // If we have all of them, just filter attempts state
        const allFetched = studentIds.every(id => attemptsFetchedUids.has(id));
        if (allFetched) {
          exportAttempts = attempts.filter(a => studentIds.includes(a.studentId));
        } else {
          // Fetch missing ones or all for export
          for(let i=0; i<studentIds.length; i+=30) {
            const batchIds = studentIds.slice(i, i+30);
            const atmptSnap = await getDocs(query(collection(db, 'attempts'), where('studentId', 'in', batchIds)));
            exportAttempts = [...exportAttempts, ...atmptSnap.docs.map(d => ({id: d.id, ...d.data() as any} as ExamAttempt))];
          }
        }
      }

      let currentExams = exams;
      if (currentExams.length === 0) {
        currentExams = await metadataCache.getExamsList();
      }

      const calculatedData = exportStudents.map(s => {
        const studentAttempts = exportAttempts.filter(a => a.studentId === s.uid && (a.status === 'submitted' || a.status === 'graded'));
        const attemptsByExam: Record<string, ExamAttempt> = {};
        
        studentAttempts.forEach(attempt => {
          const exam = currentExams.find(e => e.id === attempt.examId);
          if (!exam) return;
          const currentBest = attemptsByExam[attempt.examId];
          const attemptScore = calculateTotalObtained(attempt, exam);
          const currentBestScore = currentBest ? calculateTotalObtained(currentBest, currentExams.find(e => e.id === currentBest.examId)) : -1;
          
          if (!currentBest || attemptScore > currentBestScore) {
            attemptsByExam[attempt.examId] = attempt;
          }
        });

        let totalScore = 0;
        let totalFullMarks = 0;

        Object.values(attemptsByExam).forEach(attempt => {
          const exam = currentExams.find(e => e.id === attempt.examId);
          if (exam) {
            const examFullMarks = exam.questions.reduce((sum, q) => sum + (q.points || 0), 0);
            totalFullMarks += examFullMarks;
            totalScore += calculateTotalObtained(attempt, exam);
          }
        });

        const percentage = totalFullMarks > 0 ? (totalScore / totalFullMarks) * 100 : 0;

        return {
          'Student Name': s.displayName,
          'Email': s.email,
          'Exams Taken': studentAttempts.length,
          'Total Marks Obtained': totalScore,
          'Full Marks': totalFullMarks,
          'Overall Percentage': `${percentage.toFixed(2)}%`
        };
      });

      return calculatedData;
    } catch(err) {
      console.error(err);
      return [];
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async (format: 'excel' | 'csv' | 'pdf') => {
    const data = await getExportData();
    if (data.length === 0) return;

    if (format === 'excel') exportToExcel(data, 'All_Students_Report');
    else if (format === 'csv') exportToCSV(data, 'All_Students_Report');
    else exportToPDF(data, 'All Students Performance Report', 'All_Students_Report');
  };

  const handleStudentClick = (student: UserProfile) => {
    setSelectedStudent(student);
    setView('student-details');
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
    setView('grading');
  };

  const handleSaveManualGrades = async () => {
    if (!gradingAttempt) return;
    
    setIsSavingGrades(true);
    try {
      const exam = exams.find(e => e.id === gradingAttempt.examId);
      if (!exam) throw new Error('Exam not found');

      // Calculate total score
      const autoScore = gradingAttempt.autoScore !== undefined 
        ? gradingAttempt.autoScore 
        : calculateAutoScore(exam.questions, gradingAttempt.answers);

      const manualTotal: number = (Object.values(manualGrades) as any[]).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
      const totalScore: number = autoScore + manualTotal;

      await updateDoc(doc(db, 'attempts', gradingAttempt.id), {
        manualGrades,
        autoScore,
        score: totalScore,
        status: 'graded'
      });
      
      const student = students.find(s => s.uid === gradingAttempt.studentId);
      const action = gradingAttempt.status === 'graded' ? 'REGRADED_EXAM' : 'GRADED_EXAM';
      if (profile && student) {
        await logUserActivity(profile, action, `${action === 'REGRADED_EXAM' ? 'Regraded' : 'Graded'} exam "${exam.title}" for student ${student.displayName}`);
      }
      
      setGradingAttempt(null);
      setManualGrades({});
      setView('student-details');
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

  if (view === 'student-details' && selectedStudent) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setView('list')}>
              <ChevronRight className="w-5 h-5 rotate-180 mr-2" />
              Back to List
            </Button>
            <div className="h-8 w-[1px] bg-border" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {selectedStudent.displayName[0]}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{selectedStudent.displayName}</h2>
                <p className="text-sm text-muted-foreground">{selectedStudent.email}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const studentAttempts = attempts.filter(a => a.studentId === selectedStudent.uid && (a.status === 'submitted' || a.status === 'graded'));
              const data = studentAttempts.map(a => {
                const exam = exams.find(e => e.id === a.examId);
                const fullMarks = exam ? exam.questions.reduce((sum, q) => sum + (q.points || 0), 0) : 0;
                const score = calculateTotalObtained(a, exam);
                return {
                  'Exam': exam?.title || 'Unknown',
                  'Date': new Date(a.endTime || a.startTime).toLocaleString(),
                  'Score': score,
                  'Total Marks': fullMarks,
                  'Percentage': fullMarks > 0 ? `${((score / fullMarks) * 100).toFixed(2)}%` : 'N/A',
                  'Status': a.isPublished ? 'Published' : 'Pending'
                };
              });
              exportToExcel(data, `${selectedStudent.displayName}_History`);
            }}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export History
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(() => {
            const stats = getStudentStats(selectedStudent.uid);
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
                <Card className="bg-blue-500/5 border-blue-500/10">
                  <CardContent className="p-6">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Exams Attempted</p>
                    <p className="text-3xl font-bold mt-1 text-blue-600">
                      {stats.attemptsCount}
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
          {detailPaginatedAttempts.length === 0 ? (
            <div className="text-center py-12 border rounded-2xl border-dashed bg-muted/30">
              <p className="text-muted-foreground">No examination attempts found for this student.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {detailPaginatedAttempts.map((attempt) => {
                const exam = exams.find(e => e.id === attempt.examId);
                const suspiciousCount = attempt.suspiciousActivity?.length || 0;
                const examFullMarks = exam?.questions.reduce((sum, q) => sum + (q.points || 0), 0) || 0;
                
                // Calculate MCQ vs Subjective breakdown
                const mcqMarks = attempt.autoScore !== undefined 
                  ? attempt.autoScore 
                  : (exam ? calculateAutoScore(exam.questions, attempt.answers) : 0);
                
                let subjectiveMarks = 0;
                if (attempt.manualGrades) {
                  subjectiveMarks = (Object.values(attempt.manualGrades) as number[]).reduce((sum, val) => sum + (val || 0), 0);
                }

                const currentTotalScore = calculateTotalObtained(attempt, exam);
                const attemptPercentage = examFullMarks > 0 ? (currentTotalScore / examFullMarks) * 100 : 0;

                return (
                  <Card key={attempt.id} className={`overflow-hidden border-2 ${suspiciousCount > 0 ? 'border-destructive/20' : 'border-primary/10'}`}>
                    <div className={`h-1.5 ${suspiciousCount > 0 ? 'bg-destructive' : 'bg-green-500'}`} />
                    <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row justify-between gap-6">
                          <div className="space-y-4 flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-bold text-xl">{exam?.title || 'Unknown Exam'}</h4>
                              <Badge variant={attempt.status === 'graded' ? 'default' : 'secondary'} className="h-6">
                                {attempt.status === 'graded' ? 'Graded' : 'Pending Grading'}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="p-3 rounded-lg bg-muted/50 border">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">MCQ Marks</p>
                                <p className="text-lg font-bold">{mcqMarks}</p>
                              </div>
                              <div className="p-3 rounded-lg bg-muted/50 border">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Subjective Marks</p>
                                <p className="text-lg font-bold">{subjectiveMarks}</p>
                              </div>
                              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                                <p className="text-[10px] uppercase font-bold text-primary tracking-wider mb-1">Total Marks Obtained</p>
                                <p className="text-lg font-bold text-primary">{currentTotalScore} / {examFullMarks}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-4 items-center">
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                {new Date(attempt.endTime || attempt.startTime).toLocaleString()}
                              </div>
                              <Badge variant="outline" className={`${attemptPercentage >= 40 ? 'text-green-600 border-green-200 bg-green-50' : 'text-destructive border-destructive/20 bg-destructive/5'} font-bold`}>
                                {attemptPercentage.toFixed(1)}%
                              </Badge>
                              {suspiciousCount > 0 && (
                                <Badge variant="destructive" className="animate-pulse">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  {suspiciousCount} Security Alerts
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row lg:flex-col items-end gap-3 shrink-0">
                            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border w-full sm:w-auto">
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
                            
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              {(attempt.status === 'submitted' || attempt.status === 'graded') && (
                                <>
                                  <Button 
                                    variant={attempt.status === 'graded' ? 'outline' : 'default'} 
                                    size="sm" 
                                    className={attempt.status === 'submitted' ? "bg-yellow-600 hover:bg-yellow-700 flex-1 sm:flex-none" : "flex-1 sm:flex-none"}
                                    onClick={() => handleStartGrading(attempt)}
                                  >
                                    {attempt.status === 'graded' ? 'Regrade Subjective' : 'Grade Subjective'}
                                  </Button>
                                  <Button
                                    variant={attempt.isPublished ? "secondary" : "default"}
                                    size="sm"
                                    className={!attempt.isPublished ? "bg-green-600 hover:bg-green-700 flex-1 sm:flex-none" : "flex-1 sm:flex-none"}
                                    onClick={() => handleTogglePublish(attempt)}
                                    disabled={isPublishing === attempt.id}
                                  >
                                    {attempt.isPublished ? 'Unpublish' : 'Publish'}
                                  </Button>
                                </>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 sm:flex-none"
                                onClick={() => setSelectedAttemptId(selectedAttemptId === attempt.id ? null : attempt.id)}
                              >
                                {selectedAttemptId === attempt.id ? 'Hide Logs' : 'View Logs'}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => setAttemptToReset(attempt.id)} title="Reset Attempt">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                      {selectedAttemptId === attempt.id && (
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

              {/* Detail Pagination Controls */}
              {detailTotalPages > 1 && (
                <div className="mt-6 flex items-center justify-between bg-muted/30 p-4 rounded-2xl border-2 border-dashed">
                  <div className="text-sm text-muted-foreground font-medium">
                    Showing <span className="text-foreground">{((detailCurrentPage - 1) * detailItemsPerPage) + 1}</span> to <span className="text-foreground">{Math.min(detailCurrentPage * detailItemsPerPage, studentAttempts.length)}</span> of <span className="text-foreground">{studentAttempts.length}</span> attempts
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDetailPageChange(detailCurrentPage - 1)}
                      disabled={detailCurrentPage === 1}
                      className="px-4"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: detailTotalPages }).map((_, i) => (
                        <Button
                          key={i}
                          variant={detailCurrentPage === i + 1 ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => handleDetailPageChange(i + 1)}
                          className="w-8 h-8 p-0"
                        >
                          {i + 1}
                        </Button>
                      ))}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDetailPageChange(detailCurrentPage + 1)}
                      disabled={detailCurrentPage === detailTotalPages}
                      className="px-4"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'grading' && gradingAttempt) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setView('student-details')}>
              <ChevronRight className="w-5 h-5 rotate-180 mr-2" />
              Back to Details
            </Button>
            <div className="h-8 w-[1px] bg-border" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-600 font-bold">
                G
              </div>
              <div>
                <h2 className="text-2xl font-bold">Manual Grading Interface</h2>
                <p className="text-sm text-muted-foreground">
                  Grading {students.find(s => s.uid === gradingAttempt.studentId)?.displayName}'s subjective responses
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setView('student-details')} disabled={isSavingGrades}>
              Cancel
            </Button>
            <Button onClick={handleSaveManualGrades} disabled={isSavingGrades} className="px-8 bg-primary hover:bg-primary/90">
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
        </div>

        <div className="max-w-4xl mx-auto space-y-8 pb-12">
          {(() => {
            const exam = exams.find(e => e.id === gradingAttempt.examId);
            const subjectiveQuestions = exam?.questions.filter(q => q.type === 'short' || q.type === 'long') || [];
            
            if (subjectiveQuestions.length === 0) {
              return (
                <Card className="p-12 text-center border-2 border-dashed rounded-2xl">
                  <p className="text-muted-foreground">No subjective questions to grade for this exam.</p>
                  <Button variant="outline" className="mt-4" onClick={() => setView('student-details')}>Return to Details</Button>
                </Card>
              );
            }

            return (
              <div className="space-y-8">
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
                          {gradingAttempt.answers[q.id] || <span className="italic text-muted-foreground">No answer provided by the student.</span>}
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
                            <span className="text-xl font-bold text-muted-foreground">/ {q.points} Marks</span>
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Student Reports</h2>
          <p className="text-muted-foreground">Monitor student performance and anti-cheating logs.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchData('first')} 
            disabled={isRefreshing}
            className="gap-2 mr-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
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
                  <TableHead>Total Marks Obtained</TableHead>
                  <TableHead>Full Marks</TableHead>
                  <TableHead>Overall Percentage</TableHead>
                  <TableHead>Last Submission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mainPaginatedStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No students found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  mainPaginatedStudents.map((student) => {
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

          {/* Pagination Controls */}
          <div className="mt-4 flex items-center justify-between bg-muted/20 p-2 rounded-lg border border-border">
            <div className="text-xs text-muted-foreground px-2">
              {searchTerm 
                ? `Showing matching students` 
                : `Page ${currentPage} (approx ${totalStudentsCount} total students)`
              }
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1 || loading}
              >
                First
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <span className="text-xs font-medium px-2">
                Page {currentPage} {debouncedSearchTerm && searchBuffer ? `of ${totalPagesForSearch}` : ''}
              </span>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={loading || (debouncedSearchTerm && searchBuffer ? currentPage >= totalPagesForSearch : students.length < itemsPerPage)}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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

