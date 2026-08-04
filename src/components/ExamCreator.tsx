import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Question, Exam, ExamSettings, UserProfile } from '../types';
import { Plus, Trash2, Save, ArrowLeft, Shield, Shuffle, Layout, Lock, Users, FileSpreadsheet, Download, Upload, Clock, Globe, Search, CheckSquare, Square, X, UserCheck, UserX, Mail, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from './RichTextEditor';
import { ExcelQuestionModal } from './ExcelQuestionModal';
import { downloadQuestionTemplate } from '../utils/excelQuestionParser';
import { 
  timestampToISTInputValue, 
  istInputValueToTimestamp, 
  formatInIST, 
  getExamAvailabilityState, 
  getAvailabilityBadgeInfo 
} from '../utils/timeUtils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { logUserActivity } from '../lib/activityLogger';
import { updateStat } from '../lib/stats';

export const ExamCreator: React.FC<{ onBack: () => void, initialExam?: Exam }> = ({ onBack, initialExam }) => {
  const { profile } = useAuth();
  const [title, setTitle] = useState(initialExam?.title || '');
  const [description, setDescription] = useState(initialExam?.description || '');
  const [instructions, setInstructions] = useState(initialExam?.instructions || 'Please read all questions carefully.');
  const [duration, setDuration] = useState(initialExam?.duration || 60);
  const [startTime, setStartTime] = useState<string>(
    initialExam?.startTime ? timestampToISTInputValue(initialExam.startTime) : ''
  );
  const [endTime, setEndTime] = useState<string>(
    initialExam?.endTime ? timestampToISTInputValue(initialExam.endTime) : ''
  );
  const [questions, setQuestions] = useState<Question[]>(initialExam?.questions || []);
  const [status, setStatus] = useState<Exam['status']>(initialExam?.status || 'published');
  const [settings, setSettings] = useState<ExamSettings>(initialExam?.settings ? {
    enableAntiCheating: initialExam.settings.enableAntiCheating ?? true,
    shuffleQuestions: initialExam.settings.shuffleQuestions ?? false,
    showOneAtATime: initialExam.settings.showOneAtATime ?? false,
    requirePassword: initialExam.settings.requirePassword ?? '',
    restrictAttempts: initialExam.settings.restrictAttempts ?? false,
    allowedStudents: initialExam.settings.allowedStudents ?? [],
  } : {
    enableAntiCheating: true,
    shuffleQuestions: false,
    showOneAtATime: false,
    requirePassword: '',
    restrictAttempts: false,
    allowedStudents: initialExam?.settings?.allowedStudents ?? [],
  });
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [isSelectiveMode, setIsSelectiveMode] = useState<boolean>(
    Boolean(initialExam?.settings?.allowedStudents && initialExam.settings.allowedStudents.length > 0)
  );
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [studentFilterTab, setStudentFilterTab] = useState<'all' | 'selected' | 'unselected'>('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  const handleExcelImport = (importedQuestions: Question[], mode: 'append' | 'replace') => {
    if (mode === 'replace') {
      setQuestions(importedQuestions);
    } else {
      setQuestions(prev => [...prev, ...importedQuestions]);
    }
  };

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const { data } = await supabase.from('users').select('*').eq('role', 'student');
        const studentsData = ((data || []) as any[]).map(s => ({
          ...s,
          uid: s.uid || s.id,
          displayName: s.displayName || s.email?.split('@')[0] || 'Student',
          email: s.email || ''
        })) as UserProfile[];
        setStudents(studentsData);
      } catch (error) {
        console.error('Error fetching students:', error);
      }
    };
    fetchStudents();
  }, []);

  // Selective Students Helper Functions
  const filteredStudents = students.filter(student => {
    const query = studentSearchQuery.trim().toLowerCase();
    const nameMatch = student.displayName ? student.displayName.toLowerCase().includes(query) : false;
    const emailMatch = student.email ? student.email.toLowerCase().includes(query) : false;
    const matchesSearch = !query || nameMatch || emailMatch;

    const isSelected = settings.allowedStudents?.includes(student.uid);
    if (studentFilterTab === 'selected') return matchesSearch && isSelected;
    if (studentFilterTab === 'unselected') return matchesSearch && !isSelected;
    return matchesSearch;
  });

  const handleToggleStudent = (studentUid: string) => {
    const currentAllowed = settings.allowedStudents || [];
    const isSelected = currentAllowed.includes(studentUid);
    const updatedAllowed = isSelected
      ? currentAllowed.filter(id => id !== studentUid)
      : [...currentAllowed, studentUid];
    setSettings({ ...settings, allowedStudents: updatedAllowed });
  };

  const handleSelectAllFiltered = () => {
    const filteredUids = filteredStudents.map(s => s.uid);
    const currentAllowed = settings.allowedStudents || [];
    const newAllowed = Array.from(new Set([...currentAllowed, ...filteredUids]));
    setSettings({ ...settings, allowedStudents: newAllowed });
  };

  const handleDeselectAllFiltered = () => {
    const filteredUidSet = new Set(filteredStudents.map(s => s.uid));
    const currentAllowed = settings.allowedStudents || [];
    const newAllowed = currentAllowed.filter(id => !filteredUidSet.has(id));
    setSettings({ ...settings, allowedStudents: newAllowed });
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'mcq',
      text: '',
      options: ['', '', '', ''],
      correctAnswer: '',
      points: 1,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => {
      if (q.id !== id) return q;

      let newQuestion = { ...q, ...updates };

      if (updates.type === 'sjt') {
        const currentOptions = newQuestion.options?.length ? newQuestion.options : ['Action Option A', 'Action Option B', 'Action Option C', 'Action Option D'];
        const currentOptionMarks = newQuestion.optionMarks?.length ? newQuestion.optionMarks : [5, 3, 1, 0];
        const maxMarks = Math.max(...currentOptionMarks, 1);

        newQuestion = {
          ...newQuestion,
          options: currentOptions,
          optionMarks: currentOptionMarks,
          allowMultipleSJT: newQuestion.allowMultipleSJT ?? false,
          points: newQuestion.points || maxMarks
        };
      }

      return newQuestion;
    }));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSave = async () => {
    setError(null);
    if (!title || questions.length === 0) {
      setError('Please provide a title and at least one question.');
      return;
    }

    const examId = initialExam?.id || Math.random().toString(36).substr(2, 9);
    const totalPossibleMarks = questions.reduce((sum, q) => sum + (q.points || 0), 0);

    const newExam: any = {
      id: examId,
      title,
      description,
      instructions,
      duration,
      questions,
      createdBy: initialExam?.createdBy || profile?.uid || (profile as any)?.id || '',
      status: status,
      createdAt: initialExam?.createdAt || Date.now(),
      settings: settings,
      updatedAt: Date.now()
    };

    if (startTime) {
      const startTs = istInputValueToTimestamp(startTime);
      if (startTs) newExam.startTime = startTs;
    }
    if (endTime) {
      const endTs = istInputValueToTimestamp(endTime);
      if (endTs) newExam.endTime = endTs;
    }

    try {
      const { error: upsertError } = await supabase.from('exams').upsert(newExam, { onConflict: 'id' });
      if (upsertError) throw upsertError;

      // Update counters if it's a new exam
      if (!initialExam) {
        await updateStat('totalExams', 1);
        if (status === 'published') {
          await updateStat('activeExams', 1);
        }
      } else if (initialExam.status !== status) {
        // Handle status changes (Draft -> Published, etc.)
        if (initialExam.status !== 'published' && status === 'published') {
          await updateStat('activeExams', 1);
        } else if (initialExam.status === 'published' && status !== 'published') {
          await updateStat('activeExams', -1);
        }
      }
      
      // Clear relevant caches
      Object.keys(localStorage).forEach(key => {
        if (key.includes('exam_management') || key.includes('student_dashboard')) {
          localStorage.removeItem(key);
        }
      });
      
      const action = initialExam ? 'UPDATE_EXAM' : 'CREATE_EXAM';
      await logUserActivity(profile, action, `${initialExam ? 'Updated' : 'Created'} exam: ${title}`);
      
      setSuccess(true);
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (error) {
      console.error(error);
      setError('Failed to save exam. Please try again.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back
        </Button>
        <div className="flex gap-4">
          {error && <div className="text-destructive text-sm flex items-center">{error}</div>}
          {success && <div className="text-green-500 text-sm flex items-center">Exam saved successfully!</div>}
          <Select value={status} onValueChange={(v: any) => setStatus(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
            <Save className="mr-2 w-4 h-4" />
            {initialExam ? 'Update Exam' : 'Save & Publish'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exam Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Exam Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mid-term Mathematics" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input id="duration" type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-teal-50/50 p-4 rounded-xl border border-teal-100">
            <div className="space-y-2">
              <Label htmlFor="startTime" className="font-bold text-xs text-teal-950 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600" /> Start Date & Time (IST / GMT+5:30)
              </Label>
              <Input 
                id="startTime" 
                type="datetime-local" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)} 
                className="font-mono text-xs border-teal-200 bg-white"
              />
              <div className="flex items-center justify-between text-[11px] text-teal-700/80">
                <span>{startTime ? formatInIST(istInputValueToTimestamp(startTime)) : 'Available immediately'}</span>
                <button
                  type="button"
                  onClick={() => setStartTime(timestampToISTInputValue(Date.now()))}
                  className="text-teal-700 underline font-semibold hover:text-teal-900"
                >
                  Start Now (IST)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime" className="font-bold text-xs text-teal-950 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600" /> Due Date & Time (IST / GMT+5:30)
              </Label>
              <Input 
                id="endTime" 
                type="datetime-local" 
                value={endTime} 
                onChange={(e) => setEndTime(e.target.value)} 
                className="font-mono text-xs border-teal-200 bg-white"
              />
              <div className="flex items-center justify-between text-[11px] text-teal-700/80">
                <span>{endTime ? formatInIST(istInputValueToTimestamp(endTime)) : 'No due date'}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const startTs = istInputValueToTimestamp(startTime) || Date.now();
                      setEndTime(timestampToISTInputValue(startTs + 24 * 3600 * 1000));
                    }}
                    className="text-teal-700 underline font-semibold hover:text-teal-900"
                  >
                    +24h
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const startTs = istInputValueToTimestamp(startTime) || Date.now();
                      setEndTime(timestampToISTInputValue(startTs + 7 * 24 * 3600 * 1000));
                    }}
                    className="text-teal-700 underline font-semibold hover:text-teal-900"
                  >
                    +7 Days
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Briefly describe the exam..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Enter exam instructions for students..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Exam Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="anti-cheating" 
                checked={settings.enableAntiCheating} 
                onCheckedChange={(checked) => setSettings({ ...settings, enableAntiCheating: !!checked })}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="anti-cheating" className="flex items-center gap-2 cursor-pointer">
                  Enable Anti-Cheating
                </Label>
                <p className="text-xs text-muted-foreground">
                  Detects tab switching, disables right-click, and requires full-screen.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="shuffle" 
                checked={settings.shuffleQuestions} 
                onCheckedChange={(checked) => setSettings({ ...settings, shuffleQuestions: !!checked })}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="shuffle" className="flex items-center gap-2 cursor-pointer">
                  <Shuffle className="w-3 h-3" />
                  Shuffle Questions
                </Label>
                <p className="text-xs text-muted-foreground">
                  Randomize the order of questions for each student.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="one-at-a-time" 
                checked={settings.showOneAtATime} 
                onCheckedChange={(checked) => setSettings({ ...settings, showOneAtATime: !!checked })}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="one-at-a-time" className="flex items-center gap-2 cursor-pointer">
                  <Layout className="w-3 h-3" />
                  Show One Question at a Time
                </Label>
                <p className="text-xs text-muted-foreground">
                  Students see only one question per page.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="restrict-attempts" 
                checked={settings.restrictAttempts} 
                onCheckedChange={(checked) => setSettings({ ...settings, restrictAttempts: !!checked })}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="restrict-attempts" className="flex items-center gap-2 cursor-pointer">
                  Restrict to One Attempt
                </Label>
                <p className="text-xs text-muted-foreground">
                  Students can only submit the exam once.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Exam Password (Optional)
              </Label>
              <Input 
                id="password" 
                type="password" 
                value={settings.requirePassword} 
                onChange={(e) => setSettings({ ...settings, requirePassword: e.target.value })} 
                placeholder="Leave blank for no password"
              />
              <p className="text-xs text-muted-foreground italic">
                Students will need this password to start the exam.
              </p>
            </div>
            <div className="space-y-3 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-xs font-bold text-teal-950">
                  <Users className="w-4 h-4 text-teal-600" />
                  Student Access Assignment
                </Label>
                <Badge variant="outline" className="bg-teal-50 text-teal-800 border-teal-200 text-[10px] font-bold">
                  {isSelectiveMode ? `${settings.allowedStudents?.length || 0} of ${students.length} Selected` : 'Public (All Students)'}
                </Badge>
              </div>

              {/* Mode Toggle Buttons */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsSelectiveMode(false);
                    setSettings({ ...settings, allowedStudents: [] });
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    !isSelectiveMode 
                      ? 'bg-white text-teal-950 shadow-xs border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-teal-600" />
                  <span>All Students</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSelectiveMode(true);
                    if (!settings.allowedStudents || settings.allowedStudents.length === 0) {
                      setSettings({ ...settings, allowedStudents: students.map(s => s.uid) });
                    }
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    isSelectiveMode 
                      ? 'bg-teal-600 text-white shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Selective Students</span>
                </button>
              </div>

              {/* Selective Student Management Panel */}
              {isSelectiveMode && (
                <div className="space-y-3 p-3.5 rounded-2xl border border-teal-200/80 bg-teal-50/40 animate-in fade-in duration-200">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input 
                      placeholder="Search student by name or email address..."
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="pl-8 pr-8 text-xs font-medium bg-white rounded-xl border-teal-200 focus:border-teal-500 h-9"
                    />
                    {studentSearchQuery && (
                      <button 
                        type="button"
                        onClick={() => setStudentSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filter Tabs & Quick Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-teal-200/80 text-[11px] font-semibold text-slate-600">
                      <button
                        type="button"
                        onClick={() => setStudentFilterTab('all')}
                        className={`px-2 py-0.5 rounded-md transition-colors ${
                          studentFilterTab === 'all' ? 'bg-teal-100 text-teal-950 font-bold' : 'hover:text-slate-900'
                        }`}
                      >
                        All ({students.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentFilterTab('selected')}
                        className={`px-2 py-0.5 rounded-md transition-colors ${
                          studentFilterTab === 'selected' ? 'bg-teal-100 text-teal-950 font-bold' : 'hover:text-slate-900'
                        }`}
                      >
                        Selected ({settings.allowedStudents?.length || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentFilterTab('unselected')}
                        className={`px-2 py-0.5 rounded-md transition-colors ${
                          studentFilterTab === 'unselected' ? 'bg-teal-100 text-teal-950 font-bold' : 'hover:text-slate-900'
                        }`}
                      >
                        Unselected ({students.length - (settings.allowedStudents?.length || 0)})
                      </button>
                    </div>

                    {/* Select / Deselect All Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAllFiltered}
                        className="h-7 text-[11px] font-bold border-teal-300 text-teal-900 bg-white hover:bg-teal-50 rounded-lg px-2"
                        title="Select all visible/filtered students"
                      >
                        <CheckSquare className="w-3 h-3 mr-1 text-teal-600" />
                        Select All {studentSearchQuery ? 'Filtered' : ''}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDeselectAllFiltered}
                        className="h-7 text-[11px] font-bold border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-lg px-2"
                        title="Deselect all visible/filtered students"
                      >
                        <Square className="w-3 h-3 mr-1 text-slate-400" />
                        Deselect All {studentSearchQuery ? 'Filtered' : ''}
                      </Button>
                    </div>
                  </div>

                  {/* Student List */}
                  <div className="max-h-52 overflow-y-auto border border-teal-200/80 rounded-xl bg-white divide-y divide-slate-100 shadow-2xs">
                    {filteredStudents.length === 0 ? (
                      <div className="p-5 text-center text-xs text-slate-500 space-y-1">
                        <UserX className="w-6 h-6 mx-auto text-slate-300" />
                        <p className="font-semibold">No students match your filter.</p>
                        {studentSearchQuery && (
                          <button 
                            type="button" 
                            onClick={() => setStudentSearchQuery('')}
                            className="text-teal-600 underline font-bold hover:text-teal-800 text-[11px]"
                          >
                            Clear Search
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredStudents.map(student => {
                        const isChecked = settings.allowedStudents?.includes(student.uid);
                        return (
                          <div 
                            key={student.uid}
                            onClick={() => handleToggleStudent(student.uid)}
                            className={`flex items-center justify-between p-2 px-3 cursor-pointer transition-colors ${
                              isChecked ? 'bg-teal-50/60 hover:bg-teal-100/50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Checkbox 
                                id={`student-${student.uid}`}
                                checked={isChecked}
                                onCheckedChange={() => handleToggleStudent(student.uid)}
                                onClick={(e) => e.stopPropagation()}
                                className="border-teal-400 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                              />
                              <div className="min-w-0">
                                <p className={`text-xs font-bold truncate ${isChecked ? 'text-teal-950' : 'text-slate-800'}`}>
                                  {student.displayName}
                                </p>
                                <p className="text-[10px] text-slate-500 font-mono truncate flex items-center gap-1">
                                  <Mail className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  {student.email}
                                </p>
                              </div>
                            </div>

                            <Badge 
                              variant="outline" 
                              className={`shrink-0 text-[10px] font-bold rounded-md px-1.5 py-0 ${
                                isChecked 
                                  ? 'bg-teal-100/80 text-teal-900 border-teal-300' 
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {isChecked ? 'Selected' : 'Excluded'}
                            </Badge>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <p className="text-[10px] text-teal-800/80 italic font-medium">
                    💡 Click on any student row or checkbox to select/deselect individual students.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-teal-50/50 p-4 rounded-xl border border-teal-100">
          <div>
            <h3 className="text-xl font-bold text-teal-950">Questions ({questions.length})</h3>
            <p className="text-xs text-teal-800/80">Add individual questions manually or import in bulk using Excel</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              type="button"
              variant="outline"
              onClick={downloadQuestionTemplate}
              className="border-teal-300 text-teal-800 hover:bg-teal-100/60 font-semibold rounded-xl text-xs h-9"
              title="Download Excel Question Template"
            >
              <Download className="mr-1.5 w-3.5 h-3.5 text-teal-600" />
              Download Template
            </Button>
            <Button 
              type="button"
              variant="outline"
              onClick={() => setIsExcelModalOpen(true)}
              className="border-teal-400 bg-white text-teal-900 hover:bg-teal-50 font-bold rounded-xl text-xs h-9 shadow-sm"
              title="Import Questions from Excel"
            >
              <FileSpreadsheet className="mr-1.5 w-3.5 h-3.5 text-teal-600" />
              Import Excel
            </Button>
            <Button 
              type="button"
              onClick={addQuestion} 
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs h-9 shadow-md shadow-teal-600/15"
            >
              <Plus className="mr-1.5 w-3.5 h-3.5" />
              Add Question
            </Button>
          </div>
        </div>

        {questions.map((q, index) => (
          <Card key={q.id} className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <Label>Question {index + 1}</Label>
                  {q.type === 'practical' ? (
                    <RichTextEditor value={q.text} onChange={(val) => updateQuestion(q.id, { text: val })} placeholder="Enter question text (paste will insert as plain text)..." />
                  ) : (
                    <Textarea value={q.text} onChange={(e) => updateQuestion(q.id, { text: e.target.value })} placeholder="Enter question text..." className="min-h-[100px]" />
                  )}
                </div>
                <div className="w-24 space-y-2">
                  <Label>Marks</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    value={q.points} 
                    onChange={(e) => updateQuestion(q.id, { points: parseInt(e.target.value) || 1 })} 
                  />
                </div>
                <div className="w-40 space-y-2">
                  <Label>Type</Label>
                  <Select value={q.type} onValueChange={(v: any) => updateQuestion(q.id, { type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq">MCQ</SelectItem>
                      <SelectItem value="sjt">SJT (Situational Judgement)</SelectItem>
                      <SelectItem value="short">Short Answer</SelectItem>
                      <SelectItem value="long">Long Answer</SelectItem>
                      <SelectItem value="boolean">True/False</SelectItem>
                      <SelectItem value="practical">Practical / File Upload</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive mt-8" onClick={() => removeQuestion(q.id)}>
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>

              {q.type === 'sjt' && (
                <div className="space-y-4 mt-4 p-4 rounded-xl border border-teal-200/80 bg-teal-50/30 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-lg border border-teal-100">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-teal-600" />
                        Situational Judgement Test (SJT)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Assign individual marks to each option choice. Student marks will be calculated automatically based on selected option(s).
                      </p>
                    </div>
                    <div className="flex items-center gap-2 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200 shrink-0">
                      <Checkbox 
                        id={`sjt-multi-${q.id}`}
                        checked={q.allowMultipleSJT || false}
                        onCheckedChange={(checked) => updateQuestion(q.id, { allowMultipleSJT: Boolean(checked) })}
                        className="border-teal-400 data-[state=checked]:bg-teal-600"
                      />
                      <Label htmlFor={`sjt-multi-${q.id}`} className="text-xs font-bold text-teal-950 cursor-pointer">
                        Allow Multiple Selections
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-700">Options & Assigned Marks</Label>
                      <p className="text-[10px] text-teal-800 font-medium">
                        Max option score: <span className="font-bold">{Math.max(...(q.optionMarks || [0]), 0)} Marks</span>
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      {q.options?.map((opt, optIdx) => {
                        const currentMarks = q.optionMarks?.[optIdx] ?? 0;
                        return (
                          <div key={optIdx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                            <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {String.fromCharCode(65 + optIdx)}
                            </div>
                            <Input 
                              value={opt} 
                              onChange={(e) => {
                                const newOpts = [...(q.options || [])];
                                newOpts[optIdx] = e.target.value;
                                updateQuestion(q.id, { options: newOpts });
                              }} 
                              placeholder={`Option ${optIdx + 1} description / response action...`}
                              className="flex-1 text-xs h-9 font-medium"
                            />
                            <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Marks:</span>
                              <Input 
                                type="number"
                                step="0.5"
                                value={currentMarks}
                                onChange={(e) => {
                                  const newMarks = [...(q.optionMarks || [])];
                                  newMarks[optIdx] = parseFloat(e.target.value) || 0;
                                  const maxOptMark = Math.max(...newMarks, 1);
                                  updateQuestion(q.id, { optionMarks: newMarks, points: Math.max(q.points, maxOptMark) });
                                }}
                                className="w-16 h-7 text-xs text-center font-bold bg-white"
                              />
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-400 hover:text-red-600 shrink-0"
                              onClick={() => {
                                const newOpts = (q.options || []).filter((_, idx) => idx !== optIdx);
                                const newMarks = (q.optionMarks || []).filter((_, idx) => idx !== optIdx);
                                updateQuestion(q.id, { options: newOpts, optionMarks: newMarks });
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-1 flex items-center justify-between">
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          const newOpts = [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`];
                          const newMarks = [...(q.optionMarks || []), 0];
                          updateQuestion(q.id, { options: newOpts, optionMarks: newMarks });
                        }}
                        className="h-8 text-xs font-bold border-teal-300 text-teal-800 hover:bg-teal-50 bg-white"
                      >
                        <Plus className="mr-1.5 w-3.5 h-3.5 text-teal-600" />
                        Add SJT Option
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const maxMark = Math.max(...(q.optionMarks || [1]), 1);
                          updateQuestion(q.id, { points: maxMark });
                        }}
                        className="text-[11px] font-bold text-teal-700 hover:text-teal-900 underline"
                      >
                        Auto-set Question Marks to Max Option Score ({Math.max(...(q.optionMarks || [1]), 1)})
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {q.type === 'mcq' && (
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    {q.options?.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${q.correctAnswer === opt ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>
                          {String.fromCharCode(65 + optIdx)}
                        </div>
                        <Input 
                          value={opt} 
                          onChange={(e) => {
                            const newOpts = [...(q.options || [])];
                            newOpts[optIdx] = e.target.value;
                            updateQuestion(q.id, { options: newOpts });
                          }} 
                          placeholder={`Option ${optIdx + 1}`}
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={Array.isArray(q.correctAnswer) && q.correctAnswer.includes(opt) ? 'text-primary' : 'text-muted-foreground'}
                          onClick={() => {
                            const currentCorrect = Array.isArray(q.correctAnswer) ? q.correctAnswer : (q.correctAnswer ? [q.correctAnswer] : []);
                            const newCorrect = currentCorrect.includes(opt)
                              ? currentCorrect.filter(c => c !== opt)
                              : [...currentCorrect, opt];
                            updateQuestion(q.id, { correctAnswer: newCorrect });
                          }}
                        >
                          {Array.isArray(q.correctAnswer) && q.correctAnswer.includes(opt) ? 'Selected' : 'Select'}
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      const newOpts = [...(q.options || []), ''];
                      updateQuestion(q.id, { options: newOpts });
                    }}
                  >
                    <Plus className="mr-2 w-4 h-4" />
                    Add Option
                  </Button>
                </div>
              )}

              {q.type === 'boolean' && (
                <div className="flex gap-4 mt-4">
                  <Button 
                    variant={q.correctAnswer === 'true' ? 'default' : 'outline'}
                    onClick={() => updateQuestion(q.id, { correctAnswer: 'true' })}
                  >
                    True
                  </Button>
                  <Button 
                    variant={q.correctAnswer === 'false' ? 'default' : 'outline'}
                    onClick={() => updateQuestion(q.id, { correctAnswer: 'false' })}
                  >
                    False
                  </Button>
                </div>
              )}

              {(q.type === 'short' || q.type === 'long') && (
                <div className="space-y-2 mt-4">
                  <Label className="text-primary font-bold">Recommended/Model Answer (For Grading Reference)</Label>
                  <Textarea 
                    value={q.correctAnswer as string || ''} 
                    onChange={(e) => updateQuestion(q.id, { correctAnswer: e.target.value })} 
                    placeholder="Enter the correct or model answer for this subjective question..."
                    className="bg-muted/30"
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    This answer will be shown to students in their reports and helps you (the examiner) while manually grading.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <ExcelQuestionModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImport={handleExcelImport}
        existingQuestionCount={questions.length}
      />
    </div>
  );
};
