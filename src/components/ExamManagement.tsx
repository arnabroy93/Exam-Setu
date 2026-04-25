import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Exam } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Eye, Search, Filter, Download } from 'lucide-react';
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

  const filteredExams = exams.filter(exam => {
    const matchesSearch = exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exam.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || exam.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: Exam['status']) => {
    switch (status) {
      case 'published': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'draft': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'archived': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default: return '';
    }
  };

  const exportToCSV = () => {
    const data = filteredExams.map(exam => ({
      Title: exam.title,
      Duration: `${exam.duration} mins`,
      Questions: exam.questions.length,
      Status: exam.status,
      'Created Date': new Date(exam.createdAt).toLocaleString(),
      'Start Date': exam.startTime ? new Date(exam.startTime).toLocaleString() : 'N/A',
      'Due Date': exam.endTime ? new Date(exam.endTime).toLocaleString() : 'N/A'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exams_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    const data = filteredExams.map(exam => ({
      Title: exam.title,
      Duration: `${exam.duration} mins`,
      Questions: exam.questions.length,
      Status: exam.status,
      'Created Date': new Date(exam.createdAt).toLocaleString(),
      'Start Date': exam.startTime ? new Date(exam.startTime).toLocaleString() : 'N/A',
      'Due Date': exam.endTime ? new Date(exam.endTime).toLocaleString() : 'N/A'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exams");
    XLSX.writeFile(wb, "exams_report.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Exams Report", 14, 15);
    
    const tableColumn = ["Title", "Duration", "Questions", "Status", "Start Date", "Due Date"];
    const tableRows = filteredExams.map(exam => [
      exam.title,
      `${exam.duration} mins`,
      exam.questions.length.toString(),
      exam.status,
      exam.startTime ? new Date(exam.startTime).toLocaleString() : 'N/A',
      exam.endTime ? new Date(exam.endTime).toLocaleString() : 'N/A'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });
    
    doc.save("exams_report.pdf");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold">Exam Management</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search exams..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className="gap-2" />}>
              <Download className="w-4 h-4" />
              Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToExcel}>Export as Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={exportToCSV}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF}>Export as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No exams found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredExams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.title}</TableCell>
                    <TableCell>{exam.duration} mins</TableCell>
                    <TableCell>{exam.questions.length}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(exam.status)}>
                        {exam.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{exam.startTime ? new Date(exam.startTime).toLocaleString() : 'N/A'}</TableCell>
                    <TableCell>{exam.endTime ? new Date(exam.endTime).toLocaleString() : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-2 text-xs"
                          onClick={() => onView(exam)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View Details
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-2 text-xs"
                          onClick={() => onEdit(exam)}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive" 
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the exam
              and remove all associated data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default" onClick={() => setExamToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
