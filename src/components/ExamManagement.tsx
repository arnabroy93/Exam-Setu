import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Exam } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Eye, Search, Filter, Download, Clock, Copy, Calendar, Globe, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { updateStat } from '../lib/stats';
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
import { ScheduleExamModal } from './ScheduleExamModal';
import { 
  formatInIST, 
  formatShortIST, 
  getExamAvailabilityState, 
  getAvailabilityBadgeInfo, 
  getCurrentISTDisplay 
} from '../utils/timeUtils';

interface ExamManagementProps {
  onEdit: (exam: Exam) => void;
  onView: (exam: Exam) => void;
}

export const ExamManagement: React.FC<ExamManagementProps> = ({ onEdit, onView }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Schedule & Reuse state
  const [selectedExamForSchedule, setSelectedExamForSchedule] = useState<Exam | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);

  const fetchExams = async (force = false) => {
    // Persistent cache check
    const cacheKey = 'exam_management_list_persistent';
    if (!force) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 900000) { // 15 mins cache
            setExams(data);
            setLoading(false);
            return;
          }
        } catch (e) {}
      }
    }

    setLoading(true);
    try {
      const { data } = await supabase.from('exams').select('*').order('createdAt', { ascending: false }).limit(100);
      const examsData = (data || []) as any as Exam[];
      setExams(examsData);
      localStorage.setItem(cacheKey, JSON.stringify({ data: examsData, timestamp: Date.now() }));
    } catch (error) {
      console.error('Error fetching exams:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleDelete = async () => {
    if (!examToDelete) return;
    
    try {
      const exam = exams.find(e => e.id === examToDelete);
      await supabase.from('exams').delete().eq('id', examToDelete);
      
      // Update counters
      if (exam) {
        await updateStat('totalExams', -1);
        if (exam.status === 'published') {
          await updateStat('activeExams', -1);
        }
      }

      localStorage.removeItem('exam_management_list_persistent'); // Invalidate cache
      setExamToDelete(null);
      setIsDeleteDialogOpen(false);
      fetchExams(true); // Force refresh
    } catch (error) {
      console.error('Error deleting exam:', error);
    }
  };

  const handleDuplicateExam = async (examToClone: Exam) => {
    try {
      const now = Date.now();
      const newExamData = {
        title: `${examToClone.title} (Copy)`,
        description: examToClone.description,
        instructions: examToClone.instructions,
        duration: examToClone.duration,
        questions: examToClone.questions,
        createdBy: examToClone.createdBy,
        status: 'published' as const,
        createdAt: now,
        startTime: now, // starts now in IST by default
        endTime: now + 24 * 3600 * 1000, // +24 hours due in IST
        settings: examToClone.settings || {
          enableAntiCheating: false,
          shuffleQuestions: false,
          showOneAtATime: false,
          restrictAttempts: false
        },
        totalPossibleMarks: examToClone.totalPossibleMarks
      };
      
      const { data, error } = await supabase.from('exams').insert(newExamData).select('*').single();
      if (error) throw error;

      localStorage.removeItem('exam_management_list_persistent');
      await fetchExams(true);
      if (data) {
        setSelectedExamForSchedule(data as Exam);
        setIsScheduleModalOpen(true);
      }
    } catch (err) {
      console.error('Error duplicating exam:', err);
    }
  };

  const filteredExams = exams.filter(exam => {
    const matchesSearch = exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exam.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const availabilityState = getExamAvailabilityState(exam);
    let matchesStatus = true;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'active' || statusFilter === 'upcoming' || statusFilter === 'expired') {
      matchesStatus = availabilityState === statusFilter;
    } else {
      matchesStatus = exam.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  const exportToCSV = () => {
    const data = filteredExams.map(exam => ({
      Title: exam.title,
      Duration: `${exam.duration} mins`,
      Questions: exam.questions.length,
      'Publication Status': exam.status,
      'Availability State (IST)': getExamAvailabilityState(exam),
      'Start Date (IST)': exam.startTime ? formatInIST(exam.startTime) : 'Immediately Available',
      'Due Date (IST)': exam.endTime ? formatInIST(exam.endTime) : 'No Due Date',
      'Created Date (IST)': formatInIST(exam.createdAt)
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exams_report_ist.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    const data = filteredExams.map(exam => ({
      Title: exam.title,
      Duration: `${exam.duration} mins`,
      Questions: exam.questions.length,
      'Publication Status': exam.status,
      'Availability State (IST)': getExamAvailabilityState(exam),
      'Start Date (IST)': exam.startTime ? formatInIST(exam.startTime) : 'Immediately Available',
      'Due Date (IST)': exam.endTime ? formatInIST(exam.endTime) : 'No Due Date',
      'Created Date (IST)': formatInIST(exam.createdAt)
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exams");
    XLSX.writeFile(wb, "exams_report_ist.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Exams Availability Report (IST)", 14, 15);
    
    const tableColumn = ["Title", "Duration", "Questions", "Availability (IST)", "Start Date (IST)", "Due Date (IST)"];
    const tableRows = filteredExams.map(exam => {
      const badgeInfo = getAvailabilityBadgeInfo(exam);
      return [
        exam.title,
        `${exam.duration} mins`,
        exam.questions.length.toString(),
        badgeInfo.label,
        exam.startTime ? formatShortIST(exam.startTime) : 'Immediate',
        exam.endTime ? formatShortIST(exam.endTime) : 'No Due Date'
      ];
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });
    
    doc.save("exams_report_ist.pdf");
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 text-white p-5 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-black tracking-tight">Exam Management</h3>
            <Badge className="bg-teal-700/80 text-white border-teal-500/50 text-[11px] font-bold">
              <Globe className="w-3 h-3 mr-1 text-teal-300" /> India Standard Time (GMT+5:30)
            </Badge>
          </div>
          <p className="text-xs text-teal-100/80 mt-1">
            Control exam visibility, availability schedules, and extend or reuse dates seamlessly in IST.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/15 text-xs font-mono font-bold">
          <Clock className="w-4 h-4 text-teal-300" />
          <span>{getCurrentISTDisplay()}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 rounded-xl border-teal-200 text-xs font-semibold">
                <SelectValue placeholder="Availability / Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Exams</SelectItem>
                <SelectItem value="active">🟢 Active / Live Now (IST)</SelectItem>
                <SelectItem value="upcoming">🔵 Scheduled / Upcoming (IST)</SelectItem>
                <SelectItem value="expired">🔴 Expired / Closed (IST)</SelectItem>
                <SelectItem value="draft">🟡 Drafts</SelectItem>
                <SelectItem value="archived">⚪ Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by title or topic..." 
              className="pl-10 rounded-xl border-teal-200 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" className="gap-2 rounded-xl border-teal-200 text-xs font-semibold" />}>
            <Download className="w-4 h-4 text-teal-600" />
            Export Schedule Report
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportToExcel}>Export as Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem onClick={exportToCSV}>Export as CSV (.csv)</DropdownMenuItem>
            <DropdownMenuItem onClick={exportToPDF}>Export as PDF (.pdf)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Exams Table */}
      <Card className="rounded-2xl border-teal-100 overflow-hidden shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-teal-50/60">
              <TableRow>
                <TableHead className="font-bold text-teal-950">Exam Title</TableHead>
                <TableHead className="font-bold text-teal-950">Duration</TableHead>
                <TableHead className="font-bold text-teal-950">Availability Status (IST)</TableHead>
                <TableHead className="font-bold text-teal-950">Start Date & Time (IST)</TableHead>
                <TableHead className="font-bold text-teal-950">Due Date & Time (IST)</TableHead>
                <TableHead className="text-right font-bold text-teal-950">Quick Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No examinations match the selected filter or search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredExams.map((exam) => {
                  const badgeInfo = getAvailabilityBadgeInfo(exam);
                  return (
                    <TableRow key={exam.id} className="hover:bg-teal-50/30 transition-colors">
                      <TableCell className="font-semibold text-teal-950">
                        <div>
                          <p>{exam.title}</p>
                          <p className="text-[11px] text-teal-700/70 font-normal">{exam.questions.length} Questions</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-teal-900">{exam.duration} mins</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs font-bold py-1 px-2.5 rounded-lg border ${badgeInfo.badgeClass}`}>
                          <span className={`w-2 h-2 rounded-full mr-1.5 ${badgeInfo.dotClass}`} />
                          {badgeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-teal-900 font-mono">
                        {exam.startTime ? (
                          <span>{formatShortIST(exam.startTime)}</span>
                        ) : (
                          <span className="text-teal-600/70 italic">Immediately Available</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-teal-900 font-mono">
                        {exam.endTime ? (
                          <span>{formatShortIST(exam.endTime)}</span>
                        ) : (
                          <span className="text-teal-600/70 italic">No Due Date</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          {/* Schedule / Extend Date Modal Launcher */}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 px-2 text-xs font-bold border-teal-300 bg-teal-50/60 text-teal-900 hover:bg-teal-100 rounded-lg shadow-2xs"
                            onClick={() => {
                              setSelectedExamForSchedule(exam);
                              setIsScheduleModalOpen(true);
                            }}
                            title="Adjust Start / Due Dates in IST"
                          >
                            <Clock className="w-3.5 h-3.5 mr-1 text-teal-600" />
                            Schedule (IST)
                          </Button>

                          {/* Reuse / Duplicate Exam Launcher */}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 px-2 text-xs font-bold border-emerald-300 bg-emerald-50/60 text-emerald-900 hover:bg-emerald-100 rounded-lg shadow-2xs"
                            onClick={() => handleDuplicateExam(exam)}
                            title="Reuse & Duplicate this exam with fresh dates"
                          >
                            <Copy className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            Reuse
                          </Button>

                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-xs text-teal-800 hover:bg-teal-100/50 rounded-lg"
                            onClick={() => onView(exam)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-xs text-teal-800 hover:bg-teal-100/50 rounded-lg"
                            onClick={() => onEdit(exam)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>

                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" 
                            onClick={() => {
                              setExamToDelete(exam.id);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
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
        </CardContent>
      </Card>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the exam
              and remove all associated data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default" onClick={() => setExamToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
              Delete Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Schedule & Availability Modal */}
      <ScheduleExamModal
        exam={selectedExamForSchedule}
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setSelectedExamForSchedule(null);
        }}
        onSaved={() => fetchExams(true)}
      />
    </div>
  );
};

