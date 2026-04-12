import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { ExamAttempt, Exam } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const ResultsView: React.FC = () => {
  const { profile } = useAuth();
  const [attempts, setAttempts] = useState<(ExamAttempt & { exam?: Exam })[]>([]);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'attempts'), where('studentId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const attemptsData = snapshot.docs.map(doc => doc.data() as ExamAttempt);
      
      // Fetch exam titles for each attempt
      const enrichedAttempts = await Promise.all(attemptsData.map(async (attempt) => {
        // In a real app, you'd probably cache these or use a join-like structure
        // For now, we'll just show the ID if the exam isn't loaded
        return attempt;
      }));
      
      setAttempts(enrichedAttempts);
    });
    return unsubscribe;
  }, [profile]);

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
                    <CardTitle className="text-lg">Attempt ID: {attempt.id.substr(0, 8)}</CardTitle>
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
                        attempt.score !== undefined ? `${attempt.score} Points` : 'Pending'
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
                    <Button variant="outline" size="sm" disabled={!attempt.isPublished}>
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
