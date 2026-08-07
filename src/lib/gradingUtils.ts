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
  
  const options = question.options || [];
  const normalizeVal = (val: any): string => {
    if (options.length > 0) {
      if (typeof val === 'number' && val >= 0 && val < options.length) {
        return options[val].trim().toLowerCase();
      }
      if (typeof val === 'string') {
        const trimmed = val.trim();
        const num = Number(trimmed);
        if (!isNaN(num) && num >= 0 && num < options.length && String(Math.floor(num)) === trimmed) {
          return options[num].trim().toLowerCase();
        }
      }
    }
    return String(val).trim().toLowerCase();
  };

  if (question.type === 'mcq' || question.type === 'boolean') {
    if (Array.isArray(question.correctAnswer)) {
      const correctNorms = question.correctAnswer.map(normalizeVal);
      if (!Array.isArray(studentAnswer)) {
        return correctNorms.includes(normalizeVal(studentAnswer));
      }
      const studentNorms = studentAnswer.map(normalizeVal);
      return JSON.stringify([...studentNorms].sort()) === JSON.stringify([...correctNorms].sort());
    }
    return normalizeVal(studentAnswer) === normalizeVal(question.correctAnswer);
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

export const formatStudentAnswer = (question: Question, studentAnswer: any): string => {
  if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') {
    return 'No response';
  }

  if (typeof studentAnswer === 'object' && !Array.isArray(studentAnswer)) {
    if (studentAnswer.name) return String(studentAnswer.name);
    if (studentAnswer.title) return String(studentAnswer.title);
    return JSON.stringify(studentAnswer);
  }

  const options = question.options || [];

  const resolveSingleValue = (val: any): string => {
    if (val === undefined || val === null || val === '') return 'No response';
    
    if (options.length > 0) {
      if (typeof val === 'number' && val >= 0 && val < options.length) {
        return options[val];
      }
      if (typeof val === 'string') {
        const trimmed = val.trim();
        const num = Number(trimmed);
        if (!isNaN(num) && num >= 0 && num < options.length && String(Math.floor(num)) === trimmed) {
          return options[num];
        }
      }
    }
    return String(val);
  };

  if (Array.isArray(studentAnswer)) {
    if (studentAnswer.length === 0) return 'No response';
    const resolved = studentAnswer.map(resolveSingleValue).filter(s => s && s !== 'No response');
    return resolved.length > 0 ? resolved.join('; ') : 'No response';
  }

  return resolveSingleValue(studentAnswer);
};

export const formatCorrectAnswer = (question: Question): string => {
  const options = question.options || [];
  const optionMarks = question.optionMarks || [];

  if (question.type === 'sjt') {
    if (options.length > 0) {
      return options
        .map((opt, i) => {
          const m = optionMarks[i] ?? 0;
          const markStr = m >= 0 ? `+${m}` : `${m}`;
          return `${String.fromCharCode(65 + i)}. ${opt} [${markStr} pts]`;
        })
        .join(' | ');
    }
    return 'Situational Judgement Scoring';
  }

  if (question.type === 'short' || question.type === 'long' || question.type === 'practical') {
    if (question.correctAnswer) {
      return Array.isArray(question.correctAnswer) ? question.correctAnswer.join('; ') : String(question.correctAnswer);
    }
    return 'Subjective Evaluation / Rubric';
  }

  if (question.correctAnswer !== undefined && question.correctAnswer !== null) {
    const resolveAns = (val: any) => {
      if (options.length > 0) {
        if (typeof val === 'number' && val >= 0 && val < options.length) {
          return options[val];
        }
        if (typeof val === 'string') {
          const num = Number(val.trim());
          if (!isNaN(num) && num >= 0 && num < options.length && String(Math.floor(num)) === val.trim()) {
            return options[num];
          }
        }
      }
      return String(val);
    };

    if (Array.isArray(question.correctAnswer)) {
      return question.correctAnswer.map(resolveAns).join('; ');
    }
    return resolveAns(question.correctAnswer);
  }

  return 'N/A';
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

export const getManualGradesTotal = (manualGrades?: Record<string, any> | null): number => {
  if (!manualGrades) return 0;
  return Object.entries(manualGrades)
    .filter(([key]) => !key.startsWith('_'))
    .reduce((sum, [_, val]) => sum + (typeof val === 'number' ? val : (Number(val) || 0)), 0);
};

export const calculateTotalObtained = (attempt: ExamAttempt, exam?: Exam): number => {
  if (attempt.status === 'graded' && attempt.score !== undefined) {
    return attempt.score;
  }

  const autoScore = attempt.autoScore ?? (exam ? calculateAutoScore(exam.questions, attempt.answers) : 0);
  
  const manualTotal = getManualGradesTotal(attempt.manualGrades);
  
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
  
  const mgPub = (attempt.manualGrades as any)?._isPublished;
  if (mgPub === true || String(mgPub) === 'true') return true;

  const ansPub = (attempt.answers as any)?._isPublished;
  if (ansPub === true || String(ansPub) === 'true') return true;

  return false;
};

export const isQuestionAttempted = (questionId: string, answersMap: Record<string, any>): boolean => {
  if (!answersMap || !(questionId in answersMap)) return false;
  const val = answersMap[questionId];
  if (val === undefined || val === null) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'number') return true;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return Boolean(val);
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
