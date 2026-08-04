import React, { useState } from 'react';
import { Question } from '../types';
import { downloadQuestionTemplate, parseQuestionsFromExcel, ParseResult } from '../utils/excelQuestionParser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  FileCheck, 
  HelpCircle,
  Plus,
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface ExcelQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (questions: Question[], mode: 'append' | 'replace') => void;
  existingQuestionCount: number;
}

export const ExcelQuestionModal: React.FC<ExcelQuestionModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingQuestionCount
}) => {
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    setIsParsing(true);
    setFileName(file.name);
    try {
      const result = await parseQuestionsFromExcel(file);
      setParseResult(result);
    } catch (err) {
      console.error(err);
      setParseResult({
        questions: [],
        warnings: [],
        errors: ['Failed to read file. Please ensure it is a valid Excel spreadsheet.'],
        totalParsed: 0
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = () => {
    if (parseResult && parseResult.questions.length > 0) {
      onImport(parseResult.questions, importMode);
      onClose();
    }
  };

  const getTypeBadge = (type: Question['type']) => {
    switch (type) {
      case 'mcq':
        return <Badge className="bg-teal-100 text-teal-800 border-teal-200">MCQ</Badge>;
      case 'sjt':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold">SJT</Badge>;
      case 'boolean':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">True/False</Badge>;
      case 'short':
        return <Badge className="bg-sky-100 text-sky-800 border-sky-200">Short Answer</Badge>;
      case 'long':
        return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">Long Answer</Badge>;
      case 'practical':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Practical / File</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatCorrectAnswerDisplay = (ans: Question['correctAnswer']) => {
    if (!ans) return <span className="text-gray-400 italic">None specified</span>;
    if (Array.isArray(ans)) {
      return ans.join(', ');
    }
    return String(ans);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-teal-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-teal-100 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-teal-100 bg-gradient-to-r from-teal-50/80 via-white to-teal-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-teal-950">Excel Question Manager</h3>
              <p className="text-xs text-teal-800/80">Download standard template & import questions accurately</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-teal-100/50">
            <X className="w-5 h-5 text-teal-800" />
          </Button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Section 1: Template Download */}
          <div className="bg-gradient-to-br from-teal-50/60 to-emerald-50/40 border border-teal-100/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <h4 className="font-bold text-sm text-teal-950">1. Download Question Excel Template</h4>
              </div>
              <p className="text-xs text-teal-800/80">
                Pre-formatted `.xlsx` template with sample questions & guide for MCQ, True/False, Short & Long answer questions.
              </p>
            </div>
            <Button
              onClick={downloadQuestionTemplate}
              className="bg-teal-700 hover:bg-teal-800 text-white shrink-0 font-bold rounded-xl shadow-md shadow-teal-700/15"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template (.xlsx)
            </Button>
          </div>

          {/* Section 2: Upload Area or Results */}
          {!parseResult ? (
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-teal-950 flex items-center gap-2">
                <Upload className="w-4 h-4 text-teal-600" />
                2. Upload Completed Excel File
              </h4>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                  dragActive
                    ? 'border-teal-500 bg-teal-50/80 scale-[1.01]'
                    : 'border-teal-200 hover:border-teal-400 bg-teal-50/20 hover:bg-teal-50/40'
                }`}
              >
                <input
                  type="file"
                  id="excel-file-input"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="excel-file-input" className="cursor-pointer space-y-3 block">
                  <div className="w-14 h-14 rounded-2xl bg-teal-100/80 mx-auto flex items-center justify-center text-teal-700 shadow-inner">
                    {isParsing ? (
                      <RefreshCw className="w-7 h-7 animate-spin text-teal-600" />
                    ) : (
                      <Upload className="w-7 h-7" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-teal-950">
                      {isParsing ? 'Parsing Excel File...' : 'Click to browse or drag & drop Excel file here'}
                    </p>
                    <p className="text-xs text-teal-800/70 mt-1">Supports .xlsx, .xls, and .csv files</p>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            /* Results & Verification Section */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-teal-600" />
                  <h4 className="font-bold text-base text-teal-950">File Analysis & Question Preview</h4>
                  <Badge variant="outline" className="bg-teal-50 text-teal-800 border-teal-200 font-semibold">
                    {fileName}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setParseResult(null);
                    setFileName(null);
                  }}
                  className="text-xs text-teal-700 border-teal-200 hover:bg-teal-50"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Upload Different File
                </Button>
              </div>

              {/* Errors */}
              {parseResult.errors.length > 0 && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
                  <p className="font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Error Processing File:
                  </p>
                  <ul className="list-disc list-inside">
                    {parseResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {parseResult.warnings.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Format Notices / Adjustments:
                  </p>
                  <ul className="list-disc list-inside max-h-24 overflow-y-auto space-y-0.5">
                    {parseResult.warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Questions List Preview Table */}
              {parseResult.questions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-teal-900">
                      Parsed Questions ({parseResult.questions.length}):
                    </p>
                    <span className="text-[11px] text-teal-700/80">
                      Review question types and correct answer mappings below
                    </span>
                  </div>

                  <div className="border border-teal-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-teal-50">
                    {parseResult.questions.map((q, idx) => (
                      <div key={idx} className="p-3 bg-white hover:bg-teal-50/30 transition-colors text-xs space-y-1.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 flex-1">
                            <span className="font-bold text-teal-800 shrink-0">#{idx + 1}</span>
                            <p className="font-semibold text-teal-950 line-clamp-2">{q.text}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {getTypeBadge(q.type)}
                            <Badge variant="outline" className="text-[10px] bg-gray-50">
                              {q.points} {q.points === 1 ? 'Mark' : 'Marks'}
                            </Badge>
                          </div>
                        </div>

                        {/* Options preview for MCQ */}
                        {q.options && q.options.length > 0 && (
                          <div className="pl-6 flex flex-wrap gap-1.5 text-[11px] text-teal-800/80">
                            {q.options.map((opt, optI) => (
                              <span
                                key={optI}
                                className={`px-2 py-0.5 rounded border ${
                                  Array.isArray(q.correctAnswer)
                                    ? q.correctAnswer.includes(opt)
                                      ? 'bg-teal-100 border-teal-300 font-bold text-teal-900'
                                      : 'bg-gray-50 border-gray-200'
                                    : q.correctAnswer === opt
                                    ? 'bg-teal-100 border-teal-300 font-bold text-teal-900'
                                    : 'bg-gray-50 border-gray-200'
                                }`}
                              >
                                {String.fromCharCode(65 + optI)}. {opt}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Correct Answer Row */}
                        <div className="pl-6 flex items-center gap-2 text-[11px]">
                          <span className="font-bold text-teal-900">Mapped Correct Answer:</span>
                          <span className="text-teal-700 font-medium">
                            {formatCorrectAnswerDisplay(q.correctAnswer)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Import Mode Radio selection */}
                  <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-100 space-y-2">
                    <p className="text-xs font-bold text-teal-950">Select Import Action:</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <label className="flex items-center gap-2 text-xs font-medium text-teal-900 cursor-pointer">
                        <input
                          type="radio"
                          name="import-mode"
                          value="append"
                          checked={importMode === 'append'}
                          onChange={() => setImportMode('append')}
                          className="accent-teal-600"
                        />
                        Append to existing questions ({existingQuestionCount} existing + {parseResult.questions.length} new = {existingQuestionCount + parseResult.questions.length} total)
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium text-teal-900 cursor-pointer">
                        <input
                          type="radio"
                          name="import-mode"
                          value="replace"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                          className="accent-teal-600"
                        />
                        Replace all existing questions ({parseResult.questions.length} total)
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-teal-100 bg-gray-50/80 flex items-center justify-between">
          <div className="text-xs text-teal-800/70 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            Excel format matches single/multiple choice, boolean, short/long answers accurately.
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="rounded-xl border-teal-200">
              Cancel
            </Button>
            {parseResult && parseResult.questions.length > 0 && (
              <Button
                onClick={handleConfirmImport}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md shadow-teal-600/15"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Import {parseResult.questions.length} Questions
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
