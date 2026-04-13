import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { ExamAttempt, Exam } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Clock, AlertTriangle, ChevronLeft, FileText, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export const ResultsView: React.FC = () => {
  const { profile } = useAuth();
  const [attempts, setAttempts] = useState<(ExamAttempt & { exam?: Exam })[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<(ExamAttempt & { exam?: Exam }) | null>(null);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'attempts'), where('studentId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const attemptsData = snapshot.docs.map(doc => doc.data() as ExamAttempt);
      
      // Fetch exam details for each attempt
      const enrichedAttempts = await Promise.all(attemptsData.map(async (attempt) => {
        try {
          const examDoc = await getDoc(doc(db, 'exams', attempt.examId));
          if (examDoc.exists()) {
            return { ...attempt, exam: examDoc.data() as Exam };
          }
        } catch (error) {
          console.error('Error fetching exam for attempt:', attempt.id, error);
        }
        return attempt;
      }));
      
      setAttempts(enrichedAttempts.sort((a, b) => b.startTime - a.startTime));
    });
    return unsubscribe;
  }, [profile]);

  if (selectedAttempt) {
    const exam = selectedAttempt.exam;
    const examFullMarks = exam?.questions.reduce((sum, q) => sum + (q.points || 0), 0) || 0;
    const percentage = examFullMarks > 0 ? ((selectedAttempt.score || 0) / examFullMarks) * 100 : 0;

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedAttempt(null)}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Results
          </Button>
          <h3 className="text-2xl font-bold">Examination Report</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Score Obtained</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-3xl font-bold text-primary">{selectedAttempt.score}</p>
                <p className="text-sm text-muted-foreground">/ {examFullMarks}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/10">
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Percentage</p>
              <p className={`text-3xl font-bold mt-1 ${percentage >= 40 ? 'text-green-600' : 'text-destructive'}`}>
                {percentage.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/10">
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Status</p>
              <p className="text-3xl font-bold text-blue-600 mt-1 capitalize">{selectedAttempt.status}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {exam?.title || 'Exam Details'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="font-bold text-sm uppercase text-muted-foreground tracking-widest">Exam Information</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Date Taken:</span>
                    <span className="font-medium">{new Date(selectedAttempt.startTime).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-medium">{selectedAttempt.endTime ? Math.floor((selectedAttempt.endTime - selectedAttempt.startTime) / 60000) : 'N/A'} Mins</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Questions:</span>
                    <span className="font-medium">{exam?.questions.length || 0}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-sm uppercase text-muted-foreground tracking-widest">Integrity Status</h4>
                <div className="p-4 rounded-xl bg-muted/50 border flex items-center gap-4">
                  {selectedAttempt.suspiciousActivity.length > 0 ? (
                    <>
                      <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                      </div>
                      <div>
                        <p className="font-bold text-destructive">Warnings Recorded</p>
                        <p className="text-xs text-muted-foreground">{selectedAttempt.suspiciousActivity.length} suspicious activities detected.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-bold text-green-600">Integrity Verified</p>
                        <p className="text-xs text-muted-foreground">No suspicious activity detected during the exam.</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t">
              <h4 className="font-bold text-lg mb-4">Question Summary</h4>
              <div className="space-y-4">
                {exam?.questions.map((q, idx) => {
                  const studentAnswer = selectedAttempt.answers[q.id];
                  const isCorrect = q.type === 'mcq' || q.type === 'boolean' || q.type === 'fill' 
                    ? JSON.stringify(studentAnswer) === JSON.stringify(q.correctAnswer)
                    : null;
                  
                  return (
                    <div key={q.id} className="p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-muted-foreground uppercase">Question {idx + 1}</p>
                          <p className="font-medium">{q.text}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {q.points} Marks
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="p-2 rounded bg-muted/50">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Your Answer:</p>
                          <p>{studentAnswer || <span className="italic text-muted-foreground">No answer</span>}</p>
                        </div>
                        {(q.type === 'mcq' || q.type === 'boolean') && (
                          <div className="p-2 rounded bg-green-500/5 border border-green-500/10">
                            <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Correct Answer:</p>
                            <p className="text-green-700 font-medium">{q.correctAnswer}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold">Your Examination Results</h3>
      
      {attempts.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <p>You haven't attempted any exams yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {attempts.map((attempt) => (
            <Card key={attempt.id} className="overflow-hidden">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg">{attempt.exam?.title || `Attempt ID: ${attempt.id.substr(0, 8)}`}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Taken on {new Date(attempt.startTime).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={attempt.status === 'graded' ? 'default' : 'secondary'} className="capitalize">
                    {attempt.status === 'submitted' ? 'Pending Grading' : attempt.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Score</p>
                    <p className="text-2xl font-bold text-primary">
                      {attempt.status === 'submitted' ? (
                        <span className="text-sm font-normal text-yellow-600 italic">Grading in progress...</span>
                      ) : attempt.isPublished ? (
                        attempt.score !== undefined ? attempt.score : 'Pending'
                      ) : (
                        <span className="text-sm font-normal text-muted-foreground italic">Score not published yet</span>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Duration</p>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <p className="font-medium">
                        {attempt.endTime ? Math.floor((attempt.endTime - attempt.startTime) / 60000) : 'N/A'} Mins
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Integrity</p>
                    <div className="flex items-center gap-2">
                      {attempt.suspiciousActivity.length > 0 ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                          <p className="font-medium text-destructive">{attempt.suspiciousActivity.length} Warnings</p>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 text-primary" />
                          <p className="font-medium text-primary">Clean Record</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-end justify-end">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={!attempt.isPublished}
                      onClick={() => setSelectedAttempt(attempt)}
                    >
                      {attempt.isPublished ? 'View Detailed Report' : 'Report Locked'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
