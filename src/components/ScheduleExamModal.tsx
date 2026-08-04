import React, { useState, useEffect } from 'react';
import { Exam, UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { 
  formatInIST, 
  timestampToISTInputValue, 
  istInputValueToTimestamp,
  getExamAvailabilityState,
  getAvailabilityBadgeInfo,
  getCurrentISTDisplay
} from '../utils/timeUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar, 
  Clock, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Globe, 
  RotateCcw,
  Zap,
  Users,
  UserCheck,
  Search,
  CheckSquare,
  Square,
  Mail,
  UserX
} from 'lucide-react';

interface ScheduleExamModalProps {
  exam: Exam | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ScheduleExamModal: React.FC<ScheduleExamModalProps> = ({
  exam,
  isOpen,
  onClose,
  onSaved
}) => {
  const [startTimeStr, setStartTimeStr] = useState<string>('');
  const [endTimeStr, setEndTimeStr] = useState<string>('');
  const [status, setStatus] = useState<Exam['status']>('published');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIST, setCurrentIST] = useState<string>(getCurrentISTDisplay());

  // Selective Student State
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [allowedStudents, setAllowedStudents] = useState<string[]>([]);
  const [isSelectiveMode, setIsSelectiveMode] = useState<boolean>(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [studentFilterTab, setStudentFilterTab] = useState<'all' | 'selected' | 'unselected'>('all');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIST(getCurrentISTDisplay());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

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
      } catch (e) {
        console.error('Error fetching students:', e);
      }
    };
    fetchStudents();
  }, []);

  useEffect(() => {
    if (exam) {
      setStartTimeStr(timestampToISTInputValue(exam.startTime));
      setEndTimeStr(timestampToISTInputValue(exam.endTime));
      setStatus(exam.status);
      setError(null);
      const initialAllowed = exam.settings?.allowedStudents || [];
      setAllowedStudents(initialAllowed);
      setIsSelectiveMode(initialAllowed.length > 0);
      setStudentSearchQuery('');
      setStudentFilterTab('all');
    }
  }, [exam]);

  if (!isOpen || !exam) return null;

  const startTimestamp = istInputValueToTimestamp(startTimeStr);
  const endTimestamp = istInputValueToTimestamp(endTimeStr);

  // Selective Students Helper Functions
  const filteredStudents = students.filter(student => {
    const query = studentSearchQuery.trim().toLowerCase();
    const nameMatch = student.displayName ? student.displayName.toLowerCase().includes(query) : false;
    const emailMatch = student.email ? student.email.toLowerCase().includes(query) : false;
    const matchesSearch = !query || nameMatch || emailMatch;

    const isSelected = allowedStudents.includes(student.uid);
    if (studentFilterTab === 'selected') return matchesSearch && isSelected;
    if (studentFilterTab === 'unselected') return matchesSearch && !isSelected;
    return matchesSearch;
  });

  const handleToggleStudent = (studentUid: string) => {
    const isSelected = allowedStudents.includes(studentUid);
    if (isSelected) {
      setAllowedStudents(allowedStudents.filter(id => id !== studentUid));
    } else {
      setAllowedStudents([...allowedStudents, studentUid]);
    }
  };

  const handleSelectAllFiltered = () => {
    const filteredUids = filteredStudents.map(s => s.uid);
    setAllowedStudents(Array.from(new Set([...allowedStudents, ...filteredUids])));
  };

  const handleDeselectAllFiltered = () => {
    const filteredUidSet = new Set(filteredStudents.map(s => s.uid));
    setAllowedStudents(allowedStudents.filter(id => !filteredUidSet.has(id)));
  };

  const previewExamObj = {
    ...exam,
    status,
    startTime: startTimestamp || undefined,
    endTime: endTimestamp || undefined,
  };

  const badgeInfo = getAvailabilityBadgeInfo(previewExamObj);

  // Quick Preset Actions
  const handleStartNow = () => {
    const nowTs = Date.now();
    setStartTimeStr(timestampToISTInputValue(nowTs));
    setStatus('published');
  };

  const handleAddDueHours = (hours: number) => {
    const baseTs = startTimestamp && startTimestamp > Date.now() ? startTimestamp : Date.now();
    const newEndTs = baseTs + hours * 3600 * 1000;
    setEndTimeStr(timestampToISTInputValue(newEndTs));
    setStatus('published');
  };

  const handleReopenExam = () => {
    const nowTs = Date.now();
    const newEndTs = nowTs + 48 * 3600 * 1000; // 48 hours from now
    setStartTimeStr(timestampToISTInputValue(nowTs));
    setEndTimeStr(timestampToISTInputValue(newEndTs));
    setStatus('published');
  };

  const handleClearSchedule = () => {
    setStartTimeStr('');
    setEndTimeStr('');
  };

  const handleSave = async () => {
    setError(null);
    if (startTimestamp && endTimestamp && startTimestamp >= endTimestamp) {
      setError('Start Date & Time must be earlier than Due Date & Time.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedSettings = {
        ...(exam.settings || {
          enableAntiCheating: true,
          shuffleQuestions: false,
          showOneAtATime: false,
          restrictAttempts: false
        }),
        allowedStudents: isSelectiveMode ? allowedStudents : []
      };

      const updates: Partial<Exam> = {
        status,
        startTime: startTimestamp || undefined,
        endTime: endTimestamp || undefined,
        settings: updatedSettings
      };

      const { error: dbError } = await supabase
        .from('exams')
        .update(updates)
        .eq('id', exam.id);

      if (dbError) throw dbError;

      localStorage.removeItem('exam_management_list_persistent');
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error saving schedule:', err);
      setError(err.message || 'Failed to update schedule in database.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-teal-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-teal-100 w-full max-w-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-teal-100 bg-gradient-to-r from-teal-50/90 via-white to-teal-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-teal-950">Manage Schedule & Availability</h3>
                <Badge variant="outline" className="bg-teal-100/80 text-teal-900 border-teal-300 text-[10px] font-bold">
                  <Globe className="w-3 h-3 mr-1 text-teal-700" /> GMT+5:30 IST
                </Badge>
              </div>
              <p className="text-xs text-teal-800/80 line-clamp-1">{exam.title}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-teal-100/50">
            <X className="w-5 h-5 text-teal-800" />
          </Button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Current IST Time Banner */}
          <div className="p-3 bg-teal-50 border border-teal-200/80 rounded-xl flex items-center justify-between text-xs text-teal-950">
            <span className="flex items-center gap-1.5 font-bold">
              <Clock className="w-4 h-4 text-teal-600" /> Current India Standard Time (IST):
            </span>
            <span className="font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-teal-200 text-teal-900 shadow-xs">
              {currentIST}
            </span>
          </div>

          {/* Error alert */}
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Form Controls */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sched-startTime" className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  Start Date & Time (IST)
                </Label>
                <Input
                  id="sched-startTime"
                  type="datetime-local"
                  value={startTimeStr}
                  onChange={(e) => setStartTimeStr(e.target.value)}
                  className="rounded-xl border-teal-200 focus:border-teal-500 font-mono text-xs"
                />
                <p className="text-[11px] text-teal-700/80">
                  {startTimestamp ? formatInIST(startTimestamp) : 'Immediately available'}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sched-endTime" className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  Due Date & Time (IST)
                </Label>
                <Input
                  id="sched-endTime"
                  type="datetime-local"
                  value={endTimeStr}
                  onChange={(e) => setEndTimeStr(e.target.value)}
                  className="rounded-xl border-teal-200 focus:border-teal-500 font-mono text-xs"
                />
                <p className="text-[11px] text-teal-700/80">
                  {endTimestamp ? formatInIST(endTimestamp) : 'No due date'}
                </p>
              </div>
            </div>

            {/* Quick Presets Bar */}
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-bold text-teal-900 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" /> Quick Time Presets (IST):
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleStartNow}
                  className="text-[11px] h-7 rounded-lg border-teal-200 bg-teal-50/50 hover:bg-teal-100 text-teal-900"
                >
                  ⚡ Start Now
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddDueHours(24)}
                  className="text-[11px] h-7 rounded-lg border-teal-200 bg-teal-50/50 hover:bg-teal-100 text-teal-900"
                >
                  +24 Hours Due
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddDueHours(72)}
                  className="text-[11px] h-7 rounded-lg border-teal-200 bg-teal-50/50 hover:bg-teal-100 text-teal-900"
                >
                  +3 Days Due
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddDueHours(168)}
                  className="text-[11px] h-7 rounded-lg border-teal-200 bg-teal-50/50 hover:bg-teal-100 text-teal-900"
                >
                  +7 Days Due
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReopenExam}
                  className="text-[11px] h-7 rounded-lg border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-bold"
                >
                  🔓 Re-open (+48h)
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSchedule}
                  className="text-[11px] h-7 rounded-lg text-teal-700 hover:bg-teal-100/50"
                >
                  Clear Schedule
                </Button>
              </div>
            </div>

            {/* Exam Status Selector */}
            <div className="space-y-1.5 pt-2">
              <Label className="text-xs font-bold text-teal-950">Publication Status</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger className="rounded-xl border-teal-200 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Published (Visible to Students)</SelectItem>
                  <SelectItem value="draft">Draft (Hidden from Students)</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selective Student Access Assignment Section */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-xs font-bold text-teal-950">
                  <Users className="w-4 h-4 text-teal-600" />
                  Student Access Assignment
                </Label>
                <Badge variant="outline" className="bg-teal-50 text-teal-800 border-teal-200 text-[10px] font-bold">
                  {isSelectiveMode ? `${allowedStudents.length} of ${students.length} Selected` : 'Public (All Students)'}
                </Badge>
              </div>

              {/* Mode Toggle Buttons */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => {
                    setIsSelectiveMode(false);
                    setAllowedStudents([]);
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
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
                    if (allowedStudents.length === 0) {
                      setAllowedStudents(students.map(s => s.uid));
                    }
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
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
                <div className="space-y-2.5 p-3 rounded-xl border border-teal-200/80 bg-teal-50/40 animate-in fade-in duration-200">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input 
                      placeholder="Search student by name or email address..."
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="pl-8 pr-8 text-xs font-medium bg-white rounded-xl border-teal-200 focus:border-teal-500 h-8"
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-teal-200/80 text-[10px] font-semibold text-slate-600">
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
                        Selected ({allowedStudents.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudentFilterTab('unselected')}
                        className={`px-2 py-0.5 rounded-md transition-colors ${
                          studentFilterTab === 'unselected' ? 'bg-teal-100 text-teal-950 font-bold' : 'hover:text-slate-900'
                        }`}
                      >
                        Unselected ({students.length - allowedStudents.length})
                      </button>
                    </div>

                    {/* Select / Deselect All Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAllFiltered}
                        className="h-6 text-[10px] font-bold border-teal-300 text-teal-900 bg-white hover:bg-teal-50 rounded-md px-1.5"
                        title="Select all visible/filtered students"
                      >
                        <CheckSquare className="w-2.5 h-2.5 mr-1 text-teal-600" />
                        Select All {studentSearchQuery ? 'Filtered' : ''}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDeselectAllFiltered}
                        className="h-6 text-[10px] font-bold border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-md px-1.5"
                        title="Deselect all visible/filtered students"
                      >
                        <Square className="w-2.5 h-2.5 mr-1 text-slate-400" />
                        Deselect All {studentSearchQuery ? 'Filtered' : ''}
                      </Button>
                    </div>
                  </div>

                  {/* Student List */}
                  <div className="max-h-44 overflow-y-auto border border-teal-200/80 rounded-xl bg-white divide-y divide-slate-100 shadow-2xs">
                    {filteredStudents.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                        <UserX className="w-5 h-5 mx-auto text-slate-300" />
                        <p className="font-semibold text-[11px]">No students match your filter.</p>
                        {studentSearchQuery && (
                          <button 
                            type="button" 
                            onClick={() => setStudentSearchQuery('')}
                            className="text-teal-600 underline font-bold hover:text-teal-800 text-[10px]"
                          >
                            Clear Search
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredStudents.map(student => {
                        const isChecked = allowedStudents.includes(student.uid);
                        return (
                          <div 
                            key={student.uid}
                            onClick={() => handleToggleStudent(student.uid)}
                            className={`flex items-center justify-between p-1.5 px-2.5 cursor-pointer transition-colors ${
                              isChecked ? 'bg-teal-50/60 hover:bg-teal-100/50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Checkbox 
                                id={`sched-student-${student.uid}`}
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
                              className={`shrink-0 text-[9px] font-bold rounded-md px-1.5 py-0 ${
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
                </div>
              )}
            </div>
          </div>

          {/* Live Resulting Availability Preview Box */}
          <div className="p-4 rounded-xl border border-teal-200/80 bg-gradient-to-br from-teal-50/80 to-emerald-50/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" /> Calculated Availability Status (IST):
              </span>
              <Badge variant="outline" className={`text-xs font-bold ${badgeInfo.badgeClass}`}>
                <span className={`w-2 h-2 rounded-full mr-1.5 ${badgeInfo.dotClass}`} />
                {badgeInfo.label}
              </Badge>
            </div>
            <p className="text-xs text-teal-900 font-medium">
              {badgeInfo.description}
            </p>
            <p className="text-[11px] text-teal-700/80">
              {badgeInfo.canStudentStart
                ? '✅ Students can start and take this exam now.'
                : '🔒 Students cannot take this exam at this time.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-teal-100 bg-gray-50/80 flex items-center justify-between">
          <Button variant="outline" onClick={onClose} className="rounded-xl border-teal-200 text-xs">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md shadow-teal-600/15"
          >
            {isSaving ? (
              <RotateCcw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            )}
            Save Schedule Changes
          </Button>
        </div>
      </div>
    </div>
  );
};
