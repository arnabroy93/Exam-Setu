import { Question } from '../types';

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
