-- Step 1: Create Tables

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  uid TEXT UNIQUE,
  email TEXT,
  "displayName" TEXT,
  role TEXT,
  settings JSONB,
  metadata JSONB,
  "createdAt" BIGINT,
  "updatedAt" BIGINT
);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  instructions TEXT,
  duration INTEGER,
  "startTime" BIGINT,
  "endTime" BIGINT,
  "scheduledStart" BIGINT,
  "scheduledEnd" BIGINT,
  questions JSONB,
  "createdBy" TEXT,
  status TEXT,
  settings JSONB,
  "createdAt" BIGINT,
  "updatedAt" BIGINT
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  "examId" TEXT,
  "studentId" TEXT,
  answers JSONB,
  "startTime" BIGINT,
  "endTime" BIGINT,
  duration INTEGER,
  score NUMERIC,
  status TEXT,
  feedback TEXT,
  "suspiciousActivity" JSONB,
  "gradedByName" TEXT,
  "gradedBy" TEXT,
  "manualGrades" JSONB
);

CREATE TABLE IF NOT EXISTS user_activities (
  id TEXT PRIMARY KEY,
  "userId" TEXT,
  "userName" TEXT,
  "userRole" TEXT,
  action TEXT,
  details TEXT,
  timestamp BIGINT,
  "ipAddress" TEXT,
  "userAgent" TEXT
);

-- Note: Ensure Row Level Security (RLS) is disabled initially during the migration
-- After confirming migration success, you can configure Supabase Auth and RLS. 
-- In Supabase dashboard, you can turn off RLS for these tables temporarily.
