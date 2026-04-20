import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Exam, ExamAttempt, ActivityLog } from '../types';
import { Timer, AlertTriangle, ChevronLeft, ChevronRight, Send, ShieldCheck, Lock, Eye, EyeOff, CheckCircle2, Circle, LayoutGrid, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { calculateAutoScore } from '../lib/gradingUtils';
import { logUserActivity } from '../lib/activityLogger';
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

export const ExamInterface: React.FC<{ exam: Exam, onFinish: () => void }> = ({ exam, onFinish }) => {
  const { profile } = useAuth();
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(exam.duration * 60);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [attemptId] = useState(Math.random().toString(36).substr(2, 9));
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState(!exam.settings?.requirePassword);
  const [hasStarted, setHasStarted] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [shuffledQuestions, setShuffledQuestions] = useState(exam.questions);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [checkingAttempt, setCheckingAttempt] = useState(exam.settings?.restrictAttempts);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [lastLog, setLastLog] = useState<ActivityLog | null>(null);
  const lastSyncRef = React.useRef<{ answers: Record<string, any>, logsCount: number }>({ answers: {}, logsCount: 0 });

  useEffect(() => {
    if (!exam.settings?.restrictAttempts || !profile) {
      setCheckingAttempt(false);
      return;
    }

    const checkAttempt = async () => {
      const q = query(
        collection(db, 'attempts'),
        where('examId', '==', exam.id),
        where('studentId', '==', profile.uid)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setHasAttempted(true);
      }
      setCheckingAttempt(false);
    };
    checkAttempt();
  }, [exam.id, exam.settings?.restrictAttempts, profile]);

  useEffect(() => {
    if (exam.settings?.shuffleQuestions) {
      setShuffledQuestions([...exam.questions].sort(() => Math.random() - 0.5));
    } else {
      setShuffledQuestions(exam.questions);
    }
  }, [exam.questions, exam.settings?.shuffleQuestions]);

  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mediaStream]);

  const currentQuestion = shuffledQuestions[currentQuestionIdx];

  const addLog = useCallback((type: ActivityLog['type'], details: string) => {
    const newLog: ActivityLog = { timestamp: Date.now(), type, details };
    setLogs(prev => [...prev, newLog]);
    setLastLog(newLog);
    setShowToast(true);
    console.warn(`Suspicious activity: ${type} - ${details}`);
  }, []);

  // Sync attempt to Firestore for live monitoring
  useEffect(() => {
    if (!hasStarted || isSubmitted || isSubmitting || !profile) return;

    const syncAttempt = async () => {
      if (!profile) return;

      const sanitizedAnswers: Record<string, any> = {};
      Object.keys(answers).forEach(key => {
        if (answers[key] !== undefined && answers[key] !== null) {
          sanitizedAnswers[key] = answers[key];
        }
      });

      // Check if anything actually changed since last sync
      const hasAnswersChanged = JSON.stringify(sanitizedAnswers) !== JSON.stringify(lastSyncRef.current.answers);
      const hasLogsChanged = logs.length !== lastSyncRef.current.logsCount;

      if (!hasAnswersChanged && !hasLogsChanged && lastSyncRef.current.logsCount > 0) {
        return; // Skip sync if nothing changed
      }

      const attempt: any = {
        id: attemptId,
        examId: exam.id,
        studentId: profile.uid,
        answers: sanitizedAnswers,
        startTime: endTime ? (endTime - exam.duration * 60 * 1000) : Date.now(),
        status: 'in-progress',
        suspiciousActivity: logs,
        updatedAt: Date.now(),
      };

      try {
        // Remove any undefined values that might crash Firestore
        const cleanAttempt = JSON.parse(JSON.stringify(attempt));
        await setDoc(doc(db, 'attempts', attemptId), cleanAttempt);
        
        // Update sync ref
        lastSyncRef.current = {
          answers: sanitizedAnswers,
          logsCount: logs.length
        };
      } catch (error) {
        console.error('Error syncing attempt:', error);
      }
    };

    const timeoutId = setTimeout(syncAttempt, 30000); // Sync every 30 seconds instead of 2
    return () => clearTimeout(timeoutId);
  }, [hasStarted, isSubmitted, profile, attemptId, exam.id, exam.duration, answers, logs, endTime]);

  const submitExam = useCallback(async () => {
    if (isSubmitting || isSubmitted) return;
    
    console.log('Initiating exam submission...');
    setSubmissionError(null);
    setIsSubmitting(true);

    try {
      // Auto-grading for MCQ, Boolean, and Fill
      const autoScore = calculateAutoScore(shuffledQuestions, answers);

      const hasSubjective = shuffledQuestions.some(q => q.type === 'short' || q.type === 'long');

      // Sanitize answers: remove any undefined values
      const sanitizedAnswers: Record<string, any> = {};
      Object.keys(answers).forEach(key => {
        if (answers[key] !== undefined && answers[key] !== null) {
          sanitizedAnswers[key] = answers[key];
        }
      });

      const totalPossibleMarks = shuffledQuestions.reduce((sum, q) => sum + (q.points || 0), 0);

      const attemptData: any = {
        id: attemptId,
        examId: exam.id,
        studentId: profile?.uid || 'anonymous',
        answers: sanitizedAnswers,
        startTime: endTime ? (endTime - exam.duration * 60 * 1000) : Date.now(),
        endTime: Date.now(),
        status: hasSubjective ? 'submitted' : 'graded',
        autoScore: autoScore,
        totalPossibleMarks,
        suspiciousActivity: logs.map(log => ({
          timestamp: log.timestamp || Date.now(),
          type: log.type || 'unknown',
          details: log.details || ''
        })),
      };

      if (!hasSubjective) {
        attemptData.score = autoScore;
      }

      console.log('Submitting attempt to Firestore:', attemptId);
      
      // Final safety check: JSON stringify/parse removes all undefined values
      const finalAttempt = JSON.parse(JSON.stringify(attemptData));

      await setDoc(doc(db, 'attempts', attemptId), finalAttempt);
      console.log('Submission successful');
      
      if (profile) {
        logUserActivity(profile, 'SUBMITTED_EXAM', `Submitted exam attempt: ${exam.title}${!hasSubjective ? ` (Auto-Score: ${autoScore}%)` : ''}`);
      }
      
      setIsSubmitted(true);
      setIsSubmitDialogOpen(false);
      
      // Stop media tracks
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    } catch (error: any) {
      console.error('Error submitting exam:', error);
      setSubmissionError(error.message || 'Failed to submit exam. Please check your connection and try again.');
      setIsSubmitting(false); // Only reset if it failed, so user can retry
    }
  }, [attemptId, exam, profile?.uid, answers, endTime, logs, shuffledQuestions, mediaStream, isSubmitting, isSubmitted]);

  // Anti-cheating: Tab switch detection
  useEffect(() => {
    if (!exam.settings?.enableAntiCheating) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        addLog('tab-switch', 'User switched tabs or minimized the window');
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [addLog]);

  // Anti-cheating: Disable right-click and copy-paste
  useEffect(() => {
    if (!exam.settings?.enableAntiCheating) return;

    const handleContextMenu = (e: Event) => {
      e.preventDefault();
      addLog('right-click', 'User tried to right-click');
    };

    const handleCopy = (e: Event) => {
      e.preventDefault();
      addLog('copy-paste', 'User tried to copy content');
    };

    const handlePaste = (e: Event) => {
      e.preventDefault();
      addLog('copy-paste', 'User tried to paste content');
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, [addLog]);

  // Anti-cheating: Full-screen exit detection
  useEffect(() => {
    if (!exam.settings?.enableAntiCheating || !hasStarted) return;

    const handleFullScreenChange = () => {
      if (!document.fullscreenElement) {
        addLog('fullscreen-exit', 'User exited full-screen mode');
        setIsFullScreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, [addLog, exam.settings?.enableAntiCheating, hasStarted]);

  // Timer logic
  useEffect(() => {
    if (!hasStarted || !endTime) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
        submitExam();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStarted, endTime, submitExam]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const enterFullScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);
    } catch (err) {
      console.error("Failed to get media permissions:", err);
      alert("Camera and microphone access is required to start the exam. Please allow permissions.");
      return;
    }

    const end = Date.now() + exam.duration * 60 * 1000;
    setEndTime(end);
    
    if (exam.settings?.enableAntiCheating) {
      const elem = document.documentElement as any;
      const requestFS = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.msRequestFullscreen;
      if (requestFS) {
        try {
          await requestFS.call(elem);
        } catch (err) {
          console.error("Error attempting to enable full-screen mode:", err);
          // Continue even if full-screen fails (e.g., blocked by iframe)
        }
      }
      setIsFullScreen(true);
      setHasStarted(true);
    } else {
      setIsFullScreen(true);
      setHasStarted(true);
    }
    
    if (profile) {
      logUserActivity(profile, 'STARTED_EXAM', `Started taking exam: ${exam.title}`);
    }
  };

  const verifyPassword = () => {
    if (passwordInput === exam.settings?.requirePassword) {
      setIsPasswordVerified(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  if (checkingAttempt) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center space-y-6">
            <p>Checking exam status...</p>
          </Card>
        </div>
        <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border bg-background mt-auto">
          An Initiative by Academic Excellence Team - Anudip Foundation
        </footer>
      </div>
    );
  }

  if (hasAttempted) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl">Attempt Restricted</CardTitle>
              <p className="text-muted-foreground">You have already attempted this exam. You cannot take it again.</p>
            </div>
            <Button onClick={onFinish} className="w-full">Return to Dashboard</Button>
          </Card>
        </div>
        <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border bg-background mt-auto">
          An Initiative by Academic Excellence Team - Anudip Foundation
        </footer>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl">Thanks for submission</CardTitle>
              <p className="text-muted-foreground">Your exam has been submitted successfully. Your score will be published soon.</p>
            </div>
            <Button onClick={onFinish} className="w-full">Return to Dashboard</Button>
          </Card>
        </div>
        <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border bg-background mt-auto">
          An Initiative by Academic Excellence Team - Anudip Foundation
        </footer>
      </div>
    );
  }

  if (!isPasswordVerified) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 space-y-6">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <CardTitle className="text-2xl">Password Required</CardTitle>
              <p className="text-muted-foreground">This exam is password protected. Please enter the password to continue.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Enter password" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className={`pr-10 ${passwordError ? 'border-destructive' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordError && <p className="text-xs text-destructive">Incorrect password. Please try again.</p>}
              </div>
              <Button onClick={verifyPassword} className="w-full">Verify & Continue</Button>
              <Button variant="ghost" onClick={onFinish} className="w-full">Cancel</Button>
            </div>
          </Card>
        </div>
        <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border bg-background mt-auto">
          An Initiative by Academic Excellence Team - Anudip Foundation
        </footer>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full p-6 md:p-8 space-y-6 md:space-y-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl md:text-2xl">{exam.title}</CardTitle>
                <p className="text-sm text-muted-foreground">Ready to begin your examination?</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold flex items-center gap-2 text-sm md:text-base">
                <Eye className="w-4 h-4 text-primary" />
                Exam Instructions
              </h4>
              <div className="p-4 md:p-6 bg-muted/50 rounded-xl border border-border prose prose-sm max-w-none max-h-48 overflow-y-auto">
                <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
                  {exam.instructions || 'Please read all questions carefully. Your progress will be saved automatically.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 bg-primary/5 border-primary/10">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Duration</p>
                <p className="text-lg font-bold">{exam.duration} Minutes</p>
              </Card>
              <Card className="p-4 bg-primary/5 border-primary/10">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Questions</p>
                <p className="text-lg font-bold">{exam.questions.length} Total</p>
              </Card>
            </div>

            {exam.settings?.enableAntiCheating && (
              <div className="p-4 bg-destructive/5 border border-destructive/10 rounded-xl flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive leading-relaxed">
                  <strong>Anti-Cheating Enabled:</strong> This exam requires full-screen mode. Switching tabs or exiting full-screen will be logged and reported to the examiner.
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <Button variant="ghost" onClick={onFinish} className="flex-1 h-12">Cancel</Button>
              <Button onClick={enterFullScreen} className="flex-1 h-12 text-lg font-bold">
                {exam.settings?.enableAntiCheating ? 'Enter Full-Screen & Start' : 'Start Examination'}
              </Button>
            </div>
          </Card>
        </div>
        <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border bg-background mt-auto">
          An Initiative by Academic Excellence Team - Anudip Foundation
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col select-none">
      {/* Header */}
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-lg">{exam.title}</h1>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
            Question {currentQuestionIdx + 1} of {shuffledQuestions.length}
          </Badge>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end mr-4">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Progress</p>
            <p className="text-sm font-bold">{Math.round((Object.keys(answers).length / shuffledQuestions.length) * 100)}% Complete</p>
          </div>
          <div className={`flex items-center gap-2 font-mono text-xl font-bold px-3 py-1 rounded-lg transition-colors ${
            timeLeft < 60 
              ? 'bg-destructive text-destructive-foreground animate-[pulse_0.5s_ease-in-out_infinite]' 
              : timeLeft < 300 
                ? 'bg-destructive/10 text-destructive animate-pulse' 
                : 'text-primary'
          }`}>
            <Timer className="w-5 h-5" />
            {formatTime(timeLeft)}
          </div>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => setIsSubmitDialogOpen(true)}
            disabled={isSubmitting}
          >
            <Send className="mr-2 w-4 h-4" />
            {isSubmitting ? 'Submitting...' : 'Finish Exam'}
          </Button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="h-1.5 bg-muted w-full overflow-hidden sticky top-16 z-20">
        <div 
          className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_10px_rgba(var(--primary),0.5)]"
          style={{ width: `${(Object.keys(answers).length / shuffledQuestions.length) * 100}%` }}
        />
      </div>

      {/* Low Time Warning Banner */}
      {timeLeft > 0 && timeLeft <= 300 && (
        <div className="bg-destructive text-destructive-foreground py-2 px-4 text-center text-sm font-bold animate-pulse sticky top-16 z-10 flex items-center justify-center gap-2 shadow-lg">
          <AlertTriangle className="w-4 h-4" />
          TIME IS RUNNING LOW! {Math.ceil(timeLeft / 60)} MINUTES REMAINING
          <AlertTriangle className="w-4 h-4" />
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {exam.settings?.showOneAtATime ? (
            <>
              <Card className="border-2 border-primary/10 shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Question {currentQuestionIdx + 1}</span>
                    <Badge variant="secondary">{currentQuestion.points} Marks</Badge>
                  </div>
                  <CardTitle className="text-2xl mt-4 leading-relaxed">
                    {currentQuestion.text}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {currentQuestion.type === 'mcq' && (
                    <div className="grid gap-4">
                      {currentQuestion.options?.map((opt, idx) => (
                        <button
                          key={idx}
                          onClick={() => setAnswers({ ...answers, [currentQuestion.id]: opt })}
                          className={`flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left ${
                            answers[currentQuestion.id] === opt 
                              ? 'border-primary bg-primary/5 shadow-md' 
                              : 'border-border hover:border-primary/30 hover:bg-muted/50'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold ${
                            answers[currentQuestion.id] === opt ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                          }`}>
                            {String.fromCharCode(65 + idx)}
                          </div>
                          <span className="text-lg">{opt}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {currentQuestion.type === 'boolean' && (
                    <div className="flex gap-6">
                      {['true', 'false'].map((val) => (
                        <button
                          key={val}
                          onClick={() => setAnswers({ ...answers, [currentQuestion.id]: val })}
                          className={`flex-1 p-8 rounded-xl border-2 text-2xl font-bold capitalize transition-all ${
                            answers[currentQuestion.id] === val 
                              ? 'border-primary bg-primary/5 shadow-md' 
                              : 'border-border hover:border-primary/30 hover:bg-muted/50'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  )}

                  {(currentQuestion.type === 'short' || currentQuestion.type === 'long') && (
                    <textarea
                      className={`w-full ${currentQuestion.type === 'long' ? 'min-h-[400px]' : 'min-h-[200px]'} p-6 rounded-xl border-2 border-border focus:border-primary outline-none text-lg transition-all`}
                      placeholder={currentQuestion.type === 'long' ? "Type your long answer here (no character limit)..." : "Type your short answer here..."}
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  size="lg"
                  disabled={currentQuestionIdx === 0}
                  onClick={() => setCurrentQuestionIdx(prev => prev - 1)}
                  className="h-14 px-8 text-lg"
                >
                  <ChevronLeft className="mr-2 w-6 h-6" />
                  Previous
                </Button>
                
                <Button
                  variant={currentQuestionIdx === shuffledQuestions.length - 1 ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => {
                    if (currentQuestionIdx === shuffledQuestions.length - 1) {
                      setIsSubmitDialogOpen(true);
                    } else {
                      setCurrentQuestionIdx(prev => prev + 1);
                    }
                  }}
                  className="h-14 px-8 text-lg"
                >
                  {currentQuestionIdx === shuffledQuestions.length - 1 ? 'Submit Exam' : 'Next'}
                  {currentQuestionIdx !== shuffledQuestions.length - 1 && <ChevronRight className="ml-2 w-6 h-6" />}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-8">
              {shuffledQuestions.map((q, qIdx) => (
                <Card key={q.id} id={`question-${q.id}`} className="border-2 border-primary/10 shadow-lg">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Question {qIdx + 1}</span>
                      <Badge variant="secondary">{q.points} Marks</Badge>
                    </div>
                    <CardTitle className="text-2xl mt-4 leading-relaxed">
                      {q.text}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {q.type === 'mcq' && (
                      <div className="grid gap-4">
                        {q.options?.map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                            className={`flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left ${
                              answers[q.id] === opt 
                                ? 'border-primary bg-primary/5 shadow-md' 
                                : 'border-border hover:border-primary/30 hover:bg-muted/50'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold ${
                              answers[q.id] === opt ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                            }`}>
                              {String.fromCharCode(65 + idx)}
                            </div>
                            <span className="text-lg">{opt}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === 'boolean' && (
                      <div className="flex gap-6">
                        {['true', 'false'].map((val) => (
                          <button
                            key={val}
                            onClick={() => setAnswers({ ...answers, [q.id]: val })}
                            className={`flex-1 p-8 rounded-xl border-2 text-2xl font-bold capitalize transition-all ${
                              answers[q.id] === val 
                                ? 'border-primary bg-primary/5 shadow-md' 
                                : 'border-border hover:border-primary/30 hover:bg-muted/50'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    )}

                    {(q.type === 'short' || q.type === 'long') && (
                      <textarea
                        className={`w-full ${q.type === 'long' ? 'min-h-[300px]' : 'min-h-[150px]'} p-6 rounded-xl border-2 border-border focus:border-primary outline-none text-lg transition-all`}
                        placeholder={q.type === 'long' ? "Type your long answer here (no character limit)..." : "Type your short answer here..."}
                        value={answers[q.id] || ''}
                        onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
              <div className="flex justify-center pt-8">
                <Button size="lg" className="h-14 px-12 text-xl" onClick={() => setIsSubmitDialogOpen(true)}>
                  <Send className="mr-2 w-6 h-6" />
                  Finish & Submit Exam
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Question Palette Sidebar */}
        <aside className="lg:col-span-1 space-y-6">
          <Card className="border-2 border-primary/10 shadow-lg sticky top-24">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-primary" />
                Question Palette
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-center">
                  <p className="text-[10px] uppercase font-bold text-green-600 tracking-wider">Attempted</p>
                  <p className="text-xl font-bold text-green-700">{Object.keys(answers).length}</p>
                </div>
                <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg text-center">
                  <p className="text-[10px] uppercase font-bold text-orange-600 tracking-wider">Left</p>
                  <p className="text-xl font-bold text-orange-700">{shuffledQuestions.length - Object.keys(answers).length}</p>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {shuffledQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentQuestionIdx(idx);
                      if (!exam.settings?.showOneAtATime) {
                        const element = document.getElementById(`question-${q.id}`);
                        if (element) {
                          const headerOffset = 100;
                          const elementPosition = element.getBoundingClientRect().top;
                          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                          window.scrollTo({
                            top: offsetPosition,
                            behavior: "smooth"
                          });
                        }
                      }
                    }}
                    className={`w-full aspect-square rounded-lg border-2 flex items-center justify-center text-xs font-bold transition-all ${
                      idx === currentQuestionIdx 
                        ? 'border-primary bg-primary text-primary-foreground shadow-md scale-110 z-10' 
                        : answers[q.id] 
                          ? 'border-green-500 bg-green-50 text-green-600' 
                          : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/20'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-border space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 rounded bg-primary" />
                  <span>Current</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 rounded bg-green-50 border border-green-500" />
                  <span>Attempted</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 rounded bg-muted/30 border border-border" />
                  <span>Unattempted</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full mt-4" 
                onClick={() => setIsSubmitDialogOpen(true)}
                disabled={isSubmitting}
              >
                <Send className="mr-2 w-4 h-4" />
                Finish Exam
              </Button>
            </CardContent>
          </Card>
        </aside>
      </main>

      <AlertDialog open={isSubmitDialogOpen} onOpenChange={(open) => !isSubmitting && setIsSubmitDialogOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ready to submit?</AlertDialogTitle>
            <AlertDialogDescription>
              Please make sure you have answered all questions. You cannot change your answers after submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {submissionError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm animate-in fade-in zoom-in-95">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p>{submissionError}</p>
            </div>
          )}

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel variant="outline" size="default" disabled={isSubmitting}>
              Review Answers
            </AlertDialogCancel>
            <Button 
              onClick={(e) => {
                e.preventDefault();
                submitExam();
              }} 
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[140px]"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </div>
              ) : 'Confirm Submission'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Warning Toast */}
      {showToast && lastLog && (
        <div className="fixed bottom-8 right-8 max-w-xs bg-destructive text-destructive-foreground p-4 rounded-xl shadow-2xl flex items-start gap-3 animate-in slide-in-from-bottom-5 group z-50">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Integrity Warning!</p>
            <p className="text-xs opacity-90">{lastLog.details}</p>
          </div>
          <button 
            onClick={() => setShowToast(false)}
            className="p-1 hover:bg-destructive-foreground/10 rounded transition-colors"
            title="Close warning"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border bg-background mt-auto">
        An Initiative by Academic Excellence Team - Anudip Foundation
      </footer>
    </div>
  );
};
