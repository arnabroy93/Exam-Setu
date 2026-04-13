export type UserRole = 'admin' | 'student' | 'examiner';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: number;
  settings?: {
    emailNotifications: boolean;
    theme: 'light' | 'dark';
  };
}

export interface Question {
  id: string;
  type: 'mcq' | 'short' | 'long' | 'fill' | 'boolean';
  text: string;
  options?: string[]; // For MCQ
  correctAnswer?: string | string[]; // For MCQ, boolean, fill
  points: number;
}

export interface ExamSettings {
  enableAntiCheating: boolean;
  requirePassword?: string;
  shuffleQuestions: boolean;
  showOneAtATime: boolean;
  restrictAttempts: boolean;
  allowedStudents?: string[]; // Array of student UIDs, if empty/undefined, it means all students
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  instructions: string;
  duration: number; // in minutes
  startTime?: number;
  endTime?: number;
  questions: Question[];
  createdBy: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: number;
  settings: ExamSettings;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  answers: Record<string, any>;
  manualGrades?: Record<string, number>;
  startTime: number;
  endTime?: number;
  status: 'in-progress' | 'submitted' | 'graded';
  score?: number;
  isPublished?: boolean;
  feedback?: string;
  suspiciousActivity: ActivityLog[];
}

export interface ActivityLog {
  timestamp: number;
  type: 'tab-switch' | 'fullscreen-exit' | 'copy-paste' | 'right-click';
  details: string;
}
