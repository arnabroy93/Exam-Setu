import React from 'react';
import { Exam } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, FileText, User, Calendar, CheckCircle2, Shield, Shuffle, Layout, Lock, Check, X } from 'lucide-react';

interface ExamDetailsViewProps {
  exam: Exam;
  onBack: () => void;
}

export const ExamDetailsView: React.FC<ExamDetailsViewProps> = ({ exam, onBack }) => {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back to Management
        </Button>
        <div className="flex gap-2">
          <Badge variant="outline" className="capitalize">
            {exam.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Metadata */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Exam Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <FileText className="w-4 h-4 text-primary" />
                <span className="font-medium">ID:</span>
                <span className="text-muted-foreground font-mono">{exam.id}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-primary" />
                <span className="font-medium">Duration:</span>
                <span className="text-muted-foreground">{exam.duration} minutes</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <User className="w-4 h-4 text-primary" />
                <span className="font-medium">Created By:</span>
                <span className="text-muted-foreground">{exam.createdBy}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-medium">Created At:</span>
                <span className="text-muted-foreground">{new Date(exam.createdAt).toLocaleString()}</span>
              </div>
              {exam.startTime && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="font-medium">Starts:</span>
                  <span className="text-muted-foreground">{new Date(exam.startTime).toLocaleString()}</span>
                </div>
              )}
              {exam.endTime && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="font-medium">Due:</span>
                  <span className="text-muted-foreground">{new Date(exam.endTime).toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {exam.description || "No description provided."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {exam.instructions || "No instructions provided."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Exam Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-muted-foreground" />
                  <span>Anti-Cheating</span>
                </div>
                {exam.settings?.enableAntiCheating ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-destructive" />}
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Shuffle className="w-3 h-3 text-muted-foreground" />
                  <span>Shuffle Questions</span>
                </div>
                {exam.settings?.shuffleQuestions ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-destructive" />}
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Layout className="w-3 h-3 text-muted-foreground" />
                  <span>One at a Time</span>
                </div>
                {exam.settings?.showOneAtATime ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-destructive" />}
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Lock className="w-3 h-3 text-muted-foreground" />
                  <span>Password Protected</span>
                </div>
                {exam.settings?.requirePassword ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-destructive" />}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Questions Preview */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            Questions ({exam.questions.length})
          </h3>
          
          {exam.questions.map((q, idx) => (
            <Card key={q.id} className="relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary/20" />
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                    {q.type}
                  </Badge>
                  <span className="text-xs font-bold text-primary">{q.points} Marks</span>
                </div>
                <CardTitle className="text-lg mt-2">{idx + 1}. {q.text}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {q.type === 'mcq' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options?.map((opt, optIdx) => (
                      <div 
                        key={optIdx} 
                        className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
                          q.correctAnswer === opt 
                            ? 'bg-primary/5 border-primary/30 text-primary font-medium' 
                            : 'bg-muted/30 border-border'
                        }`}
                      >
                        <span>{String.fromCharCode(65 + optIdx)}. {opt}</span>
                        {q.correctAnswer === opt && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'boolean' && (
                  <div className="flex gap-4">
                    <div className={`flex-1 p-3 rounded-lg border text-center text-sm ${q.correctAnswer === 'true' ? 'bg-primary/5 border-primary/30 text-primary font-medium' : 'bg-muted/30 border-border'}`}>
                      True {q.correctAnswer === 'true' && "✓"}
                    </div>
                    <div className={`flex-1 p-3 rounded-lg border text-center text-sm ${q.correctAnswer === 'false' ? 'bg-primary/5 border-primary/30 text-primary font-medium' : 'bg-muted/30 border-border'}`}>
                      False {q.correctAnswer === 'false' && "✓"}
                    </div>
                  </div>
                )}

                {q.type === 'short' && (
                  <div className="p-4 bg-muted/30 rounded-lg border border-border italic text-sm text-muted-foreground">
                    Short answer question - Manual grading required.
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
