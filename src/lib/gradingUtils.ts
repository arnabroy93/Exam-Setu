import { Question, Exam, ExamAttempt } from '../types';

export const isAnswerCorrect = (question: Question, studentAnswer: any): boolean => {
  if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') return false;
  if (!question.correctAnswer) return false;
  
  if (question.type === 'mcq' || question.type === 'boolean') {
    if (Array.isArray(question.correctAnswer)) {
      // If it's an array, check if the student's single answer is one of the correct ones
      if (!Array.isArray(studentAnswer)) {
        return question.correctAnswer.includes(studentAnswer);
      }
      // If student also provided an array (multi-select), check if they match
      return JSON.stringify([...studentAnswer].sort()) === JSON.stringify([...question.correctAnswer].sort());
    }
    return studentAnswer === question.correctAnswer;
  }
  
  if (question.type === 'fill') {
    const student = String(studentAnswer).trim().toLowerCase();
    if (Array.isArray(question.correctAnswer)) {
      return question.correctAnswer.some(ans => String(ans).trim().toLowerCase() === student);
    }
    return String(question.correctAnswer).trim().toLowerCase() === student;
  }
  
  return false;
};

export const calculateAutoScore = (questions: Question[], answers: Record<string, any>): number => {
  let score = 0;
  questions.forEach(q => {
    if (q.type === 'mcq' || q.type === 'boolean' || q.type === 'fill') {
      if (isAnswerCorrect(q, answers[q.id])) {
        score += q.points || 0;
      }
    }
  });
  return score;
};

export const calculateTotalObtained = (attempt: ExamAttempt, exam?: Exam): number => {
  // 1. Use already finalized score if available
  if ((attempt.status === 'graded' || attempt.status === 'submitted') && attempt.score !== undefined) {
    return attempt.score;
  }

  // 2. Use stored autoScore if available
  const autoScore = attempt.autoScore ?? (exam ? calculateAutoScore(exam.questions, attempt.answers) : 0);
  
  // 3. Sum manual grades
  const manualTotal = attempt.manualGrades 
    ? (Object.values(attempt.manualGrades) as any[]).reduce((sum, val) => sum + (Number(val) || 0), 0)
    : 0;
  
  const total = autoScore + manualTotal;
  
  // If exam is provided and attempt is finalized but lacks a score, we might want to return it but it's safer to just return calculated
  return total;
};
