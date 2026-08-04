import React from 'react';
import { Exam } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, FileText, User, Calendar, CheckCircle2, Shield, Shuffle, Layout, Lock, Check, X, Globe } from 'lucide-react';
import { formatInIST, getAvailabilityBadgeInfo } from '../utils/timeUtils';

interface ExamDetailsViewProps {
  exam: Exam;
  onBack: () => void;
}

export const ExamDetailsView: React.FC<ExamDetailsViewProps> = ({ exam, onBack }) => {
  const badgeInfo = getAvailabilityBadgeInfo(exam);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back to Management
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs font-bold py-1 px-3 rounded-lg border ${badgeInfo.badgeClass}`}>
            <span className={`w-2 h-2 rounded-full mr-1.5 ${badgeInfo.dotClass}`} />
            {badgeInfo.label} (IST)
          </Badge>
          <Badge variant="outline" className="capitalize text-xs font-bold">
            Status: {exam.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Metadata */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="rounded-2xl border-teal-100">
            <CardHeader className="bg-teal-50/50 rounded-t-2xl pb-3">
              <CardTitle className="text-base font-bold text-teal-950 flex items-center justify-between">
                <span>Exam Schedule</span>
                <Globe className="w-4 h-4 text-teal-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Exam ID:</span>
                <span className="font-mono text-slate-900 font-bold">{exam.id}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Duration:</span>
                <span className="font-semibold text-slate-900">{exam.duration} minutes</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Created By:</span>
                <span className="font-medium text-slate-900">{exam.createdBy || 'Administrator'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Created (IST):</span>
                <span className="font-mono text-slate-800 text-[11px]">{formatInIST(exam.createdAt)}</span>
              </div>
              <div className="border-t border-teal-100 pt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-teal-950">Start Time (IST):</span>
                  <span className="font-mono text-teal-900 text-[11px] font-bold">
                    {exam.startTime ? formatInIST(exam.startTime) : 'Immediately Available'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-teal-950">Due Time (IST):</span>
                  <span className="font-mono text-teal-900 text-[11px] font-bold">
                    {exam.endTime ? formatInIST(exam.endTime) : 'No Due Date'}
                  </span>
                </div>
              </div>
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
                {q.type === 'practical' ? (
                  <CardTitle className="text-lg mt-2 flex gap-2">
                    <span>{idx + 1}.</span>
                    <div dangerouslySetInnerHTML={{ __html: q.text }} />
                  </CardTitle>
                ) : (
                  <CardTitle className="text-lg mt-2">{idx + 1}. {q.text}</CardTitle>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {q.type === 'sjt' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-teal-900 bg-teal-50 p-2 px-3 rounded-md border border-teal-200">
                      <span>Situational Judgement Test Options</span>
                      <Badge variant="outline" className="text-[10px] bg-white border-teal-300 font-bold">
                        {q.allowMultipleSJT ? 'Multiple Selection' : 'Single Selection'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options?.map((opt, optIdx) => {
                        const mark = q.optionMarks?.[optIdx] ?? 0;
                        return (
                          <div 
                            key={optIdx} 
                            className="p-3 rounded-lg border border-teal-200 bg-teal-50/20 text-sm flex items-center justify-between gap-2"
                          >
                            <span className="font-medium text-slate-800">{String.fromCharCode(65 + optIdx)}. {opt}</span>
                            <Badge className="bg-teal-600 text-white border-none font-bold text-[10px] shrink-0">
                              {mark > 0 ? `+${mark}` : mark} Marks
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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
