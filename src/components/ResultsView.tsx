import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { ExamAttempt, Exam } from '../types';
import { metadataCache } from '../lib/metadataCache';
import { isAnswerCorrect, calculateTotalObtained } from '../lib/gradingUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Clock, AlertTriangle, ChevronLeft, FileText, ShieldCheck, CheckCircle2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const ResultsView: React.FC = () => {
  const { profile } = useAuth();
  const [attempts, setAttempts] = useState<(ExamAttempt & { exam?: Exam })[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<(ExamAttempt & { exam?: Exam }) | null>(null);

  const handleExportPDF = () => {
    if (!selectedAttempt || !profile) return;
    const exam = selectedAttempt.exam;
    if (!exam) return;

    const doc = new jsPDF();
    const examFullMarks = exam.questions.reduce((sum, q) => sum + (q.points || 0), 0) || 0;
    const currentScore = calculateTotalObtained(selectedAttempt, exam);
    const percentage = examFullMarks > 0 ? (currentScore / examFullMarks) * 100 : 0;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(41, 128, 185);
    doc.text('Examination Performance Report', 105, 15, { align: 'center' });
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 20, 190, 20);

    // Student Info
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Student Name: ${profile.displayName}`, 20, 30);
    doc.text(`Student Email: ${profile.email}`, 20, 37);
    doc.text(`Exam Title: ${exam.title}`, 20, 44);
    doc.text(`Date Taken: ${new Date(selectedAttempt.startTime).toLocaleString()}`, 20, 51);

    // Summary Box
    doc.setFillColor(245, 247, 250);
    doc.rect(20, 58, 170, 25, 'F');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('PERFORMANCE SUMMARY', 25, 65);
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Score: ${currentScore} / ${examFullMarks}`, 25, 75);
    doc.text(`Percentage: ${percentage.toFixed(2)}%`, 85, 75);
    doc.text(`Status: ${selectedAttempt.status.toUpperCase()}`, 145, 75);

    // Question Details Table
    const tableData = exam.questions.map((q, idx) => {
      const studentAnswer = selectedAttempt.answers[q.id];
      const isCorrect = isAnswerCorrect(q, studentAnswer);
      const manualMarks = selectedAttempt.manualGrades?.[q.id];
      
      let marksAwarded = '0';
      if (q.type === 'short' || q.type === 'long') {
        marksAwarded = manualMarks !== undefined ? manualMarks.toString() : 'Pending';
      } else {
        marksAwarded = isCorrect ? q.points.toString() : '0';
      }

      const answerText = Array.isArray(studentAnswer) ? studentAnswer.join(', ') : (studentAnswer || 'No response');
      const correctText = Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : (q.correctAnswer || 'N/A');

      return [
        idx + 1,
        q.text,
        answerText,
        correctText,
        marksAwarded,
        q.points
      ];
    });

    autoTable(doc, {
      startY: 90,
      head: [['#', 'Question', 'Your Answer', 'Correct Answer / Rubric', 'Marks', 'Max']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 50 },
        2: { cellWidth: 45 },
        3: { cellWidth: 45 },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 15, halign: 'center' }
      },
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      margin: { top: 20 }
    });

    doc.save(`${profile.displayName}_${exam.title.replace(/\s+/g, '_')}_Report.pdf`);
  };

  useEffect(() => {
    const fetchAttempts = async () => {
      if (!profile) return;
      
      const cacheKey = `student_results_${profile.uid}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 900000) { // 15 mins cache
          setAttempts(data);
          return;
        }
      }

      try {
        const { data: attemptsData } = await supabase
          .from('attempts')
          .select('*')
          .eq('studentId', profile.uid)
          .order('startTime', { ascending: false })
          .limit(20);
        
        // Fetch enriched data
        const enrichedAttempts = await Promise.all((attemptsData as any as ExamAttempt[] || []).map(async (attempt) => {
          const exam = await metadataCache.getExam(attempt.examId);
          return { ...attempt, exam: exam || undefined };
        }));
        
        setAttempts(enrichedAttempts);
        localStorage.setItem(cacheKey, JSON.stringify({ data: enrichedAttempts, timestamp: Date.now() }));
      } catch (error) {
        console.error('Error fetching results:', error);
      }
    };

    fetchAttempts();
  }, [profile]);

  if (selectedAttempt) {
    const exam = selectedAttempt.exam;
    const examFullMarks = exam?.questions.reduce((sum, q) => sum + (q.points || 0), 0) || 0;
    const currentScore = calculateTotalObtained(selectedAttempt, exam);
    const percentage = examFullMarks > 0 ? (currentScore / examFullMarks) * 100 : 0;

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedAttempt(null)}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Results
          </Button>
          <h3 className="text-2xl font-bold">Examination Report</h3>
          <div className="ml-auto">
            <Button onClick={handleExportPDF} className="gap-2 bg-primary hover:bg-primary/90">
              <Download className="w-4 h-4" />
              Download Report PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Marks Obtained</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-3xl font-bold text-primary">{currentScore}</p>
                <p className="text-sm text-muted-foreground">/ {examFullMarks}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/10">
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Overall Percentage</p>
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
                  {(selectedAttempt.status === 'graded') && (
                    <div className="flex justify-between text-sm pt-2 border-t mt-2">
                      <span className="text-muted-foreground">Graded By:</span>
                      <span className="font-bold text-primary">System</span>
                    </div>
                  )}
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
                  const isCorrect = isAnswerCorrect(q, studentAnswer);
                  const isSubjective = q.type === 'short' || q.type === 'long';
                  
                  return (
                    <div key={q.id} className="p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-muted-foreground uppercase">Question {idx + 1}</p>
                          <p className="font-medium">{q.text}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="shrink-0">
                            {q.points} Marks
                          </Badge>
                          {!isSubjective && (
                            <Badge variant={isCorrect ? "default" : "destructive"} className="text-[10px] h-5">
                              {isCorrect ? "Correct" : "Incorrect"}
                            </Badge>
                          )}
                          {isSubjective && selectedAttempt.manualGrades?.[q.id] !== undefined && (
                            <Badge variant="secondary" className="text-[10px] h-5">
                              Awarded: {selectedAttempt.manualGrades[q.id]}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="p-2 rounded bg-muted/50">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Your Answer:</p>
                          <p>{studentAnswer || <span className="italic text-muted-foreground">No answer</span>}</p>
                        </div>
                        {(q.type === 'mcq' || q.type === 'boolean') && (
                          <div className="p-2 rounded bg-green-500/5 border border-green-500/10">
                            <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Correct Answer:</p>
                            <p className="text-green-700 font-medium">
                              {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
                            </p>
                          </div>
                        )}
                        {(q.type === 'short' || q.type === 'long') && q.correctAnswer && (
                          <div className="p-2 rounded bg-primary/5 border border-primary/10">
                            <p className="text-[10px] font-bold text-primary uppercase mb-1">Model Answer / Rubric:</p>
                            <p className="text-primary font-medium whitespace-pre-wrap">
                              {q.correctAnswer as string}
                            </p>
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
                      {attempt.isPublished !== false ? (
                        `${calculateTotalObtained(attempt, attempt.exam)}`
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
                      disabled={attempt.isPublished === false}
                      onClick={() => setSelectedAttempt(attempt)}
                    >
                      {attempt.isPublished !== false ? 'View Detailed Report' : 'Report Locked'}
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
