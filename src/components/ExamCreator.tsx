import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Question, Exam, ExamSettings, UserProfile } from '../types';
import { Plus, Trash2, Save, ArrowLeft, Shield, Shuffle, Layout, Lock, Users } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { OperationType, handleFirestoreError } from '../lib/firebase';

export const ExamCreator: React.FC<{ onBack: () => void, initialExam?: Exam }> = ({ onBack, initialExam }) => {
  const { profile } = useAuth();
  const [title, setTitle] = useState(initialExam?.title || '');
  const [description, setDescription] = useState(initialExam?.description || '');
  const [instructions, setInstructions] = useState(initialExam?.instructions || 'Please read all questions carefully.');
  const [duration, setDuration] = useState(initialExam?.duration || 60);
  const [startTime, setStartTime] = useState<string>(
    initialExam?.startTime ? new Date(initialExam.startTime).toISOString().slice(0, 16) : ''
  );
  const [endTime, setEndTime] = useState<string>(
    initialExam?.endTime ? new Date(initialExam.endTime).toISOString().slice(0, 16) : ''
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
    allowedStudents: [],
  });
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'student'));
        const querySnapshot = await getDocs(q);
        const studentsData = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        setStudents(studentsData);
      } catch (error) {
        console.error('Error fetching students:', error);
      }
    };
    fetchStudents();
  }, []);

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
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
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
    const newExam: Exam = {
      id: examId,
      title,
      description,
      instructions,
      duration,
      questions,
      createdBy: initialExam?.createdBy || profile?.uid || '',
      status: status,
      createdAt: initialExam?.createdAt || Date.now(),
      settings: settings,
    };

    if (startTime) newExam.startTime = new Date(startTime).getTime();
    if (endTime) newExam.endTime = new Date(endTime).getTime();

    try {
      await setDoc(doc(db, 'exams', examId), newExam);
      setSuccess(true);
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `exams/${examId}`);
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Date & Time (Optional)</Label>
              <Input id="startTime" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Due Date & Time (Optional)</Label>
              <Input id="endTime" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
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
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Allowed Students
              </Label>
              <div className="flex items-center gap-2">
                <Button 
                  variant={settings.allowedStudents?.length === 0 ? 'default' : 'outline'}
                  onClick={() => setSettings({ ...settings, allowedStudents: [] })}
                >
                  All Students
                </Button>
                <Button 
                  variant={settings.allowedStudents && settings.allowedStudents.length > 0 ? 'default' : 'outline'}
                  onClick={() => setSettings({ ...settings, allowedStudents: students.map(s => s.uid) })}
                >
                  Selective
                </Button>
              </div>
              {settings.allowedStudents && settings.allowedStudents.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                  {students.map(student => (
                    <div key={student.uid} className="flex items-center gap-2">
                      <Checkbox 
                        id={student.uid}
                        checked={settings.allowedStudents?.includes(student.uid)}
                        onCheckedChange={(checked) => {
                          const newAllowed = checked 
                            ? [...(settings.allowedStudents || []), student.uid]
                            : (settings.allowedStudents || []).filter(id => id !== student.uid);
                          setSettings({ ...settings, allowedStudents: newAllowed });
                        }}
                      />
                      <Label htmlFor={student.uid}>{student.displayName}</Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">Questions ({questions.length})</h3>
          <Button onClick={addQuestion} variant="outline" className="border-primary text-primary hover:bg-primary/10">
            <Plus className="mr-2 w-4 h-4" />
            Add Question
          </Button>
        </div>

        {questions.map((q, index) => (
          <Card key={q.id} className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <Label>Question {index + 1}</Label>
                  <Input value={q.text} onChange={(e) => updateQuestion(q.id, { text: e.target.value })} placeholder="Enter question text..." />
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
                      <SelectItem value="short">Short Answer</SelectItem>
                      <SelectItem value="long">Long Answer</SelectItem>
                      <SelectItem value="boolean">True/False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive mt-8" onClick={() => removeQuestion(q.id)}>
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>

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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
