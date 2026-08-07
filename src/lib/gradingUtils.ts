import { Question, Exam, ExamAttempt } from '../types';

export const calculateSJTScore = (question: Question, studentAnswer: any): number => {
  if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') return 0;

  const options = question.options || [];
  const optionMarks = question.optionMarks || [];

  const getItemMark = (item: any): number => {
    if (item === undefined || item === null) return 0;

    // Check if item is an index number or string index (e.g. 0, "0")
    if (typeof item === 'number') {
      return optionMarks[item] !== undefined ? Number(optionMarks[item]) : 0;
    }

    const parsedIndex = parseInt(String(item), 10);
    if (!isNaN(parsedIndex) && String(parsedIndex) === String(item).trim() && parsedIndex >= 0 && parsedIndex < options.length) {
      return optionMarks[parsedIndex] !== undefined ? Number(optionMarks[parsedIndex]) : 0;
    }

    // Match item against option text
    const foundIndex = options.findIndex(opt => opt.trim().toLowerCase() === String(item).trim().toLowerCase());
    if (foundIndex !== -1 && optionMarks[foundIndex] !== undefined) {
      return Number(optionMarks[foundIndex]);
    }

    return 0;
  };

  if (Array.isArray(studentAnswer)) {
    let totalMarks = 0;
    studentAnswer.forEach(ans => {
      totalMarks += getItemMark(ans);
    });
    return totalMarks;
  }

  return getItemMark(studentAnswer);
};

export const isAnswerCorrect = (question: Question, studentAnswer: any): boolean => {
  if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') return false;

  if (question.type === 'sjt') {
    return calculateSJTScore(question, studentAnswer) > 0;
  }

  if (!question.correctAnswer) return false;
  
  if (question.type === 'mcq' || question.type === 'boolean') {
    if (Array.isArray(question.correctAnswer)) {
      if (!Array.isArray(studentAnswer)) {
        return question.correctAnswer.includes(studentAnswer);
      }
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
    } else if (q.type === 'sjt') {
      score += calculateSJTScore(q, answers[q.id]);
    }
  });
  return score;
};

export const calculateTotalObtained = (attempt: ExamAttempt, exam?: Exam): number => {
  if (attempt.status === 'graded' && attempt.score !== undefined) {
    return attempt.score;
  }

  const autoScore = attempt.autoScore ?? (exam ? calculateAutoScore(exam.questions, attempt.answers) : 0);
  
  const manualTotal = attempt.manualGrades 
    ? (Object.values(attempt.manualGrades) as any[]).reduce((sum, val) => sum + (Number(val) || 0), 0)
    : 0;
  
  if (exam && attempt.status === 'submitted') {
    const hasSubjective = exam.questions.some(q => q.type === 'short' || q.type === 'long' || q.type === 'practical');
    if (hasSubjective) {
      return autoScore;
    }
  }
  
  const total = autoScore + manualTotal;
  
  return total;
};

export const calculateEffectiveFullMarks = (questions: Question[], attemptStatus: string): number => {
  const hasSubjective = questions.some(q => q.type === 'short' || q.type === 'long' || q.type === 'practical');
  
  if (hasSubjective && attemptStatus === 'submitted') {
    return questions.reduce((sum, q) => {
      if (q.type === 'mcq' || q.type === 'boolean' || q.type === 'fill' || q.type === 'sjt') {
        return sum + (q.points || 0);
      }
      return sum;
    }, 0);
  }
  
  return questions.reduce((sum, q) => sum + (q.points || 0), 0);
};

export const isAttemptPublished = (attempt: Partial<ExamAttempt> | null | undefined): boolean => {
  if (!attempt) return false;
  if (attempt.isPublished === true) return true;
  if ((attempt as any).is_published === true) return true;
  if ((attempt.manualGrades as any)?._isPublished === true) return true;
  if (attempt.answers?._isPublished === true) return true;
  return false;
};

export const prepareAttemptForSupabase = (attempt: any): any => {
  if (!attempt) return attempt;
  const published = isAttemptPublished(attempt);
  const copy = { ...attempt };

  if (copy.answers && typeof copy.answers === 'object') {
    copy.answers = { ...copy.answers, _isPublished: published };
  } else {
    copy.answers = { _isPublished: published };
  }

  if (copy.manualGrades && typeof copy.manualGrades === 'object') {
    copy.manualGrades = { ...copy.manualGrades, _isPublished: published };
  } else {
    copy.manualGrades = { _isPublished: published };
  }

  delete copy.isPublished;
  delete copy.is_published;
  delete copy.exam;
  delete copy.examTitle;

  return copy;
};
