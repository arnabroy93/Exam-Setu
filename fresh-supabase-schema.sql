-- Run this EXACT SQL in your Supabase SQL Editor.
-- It will recreate the tables with EXACT case-sensitive column names
-- to match Firebase, and then reload the Supabase schema cache.

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS exams;
DROP TABLE IF EXISTS attempts;
DROP TABLE IF EXISTS user_activities;

CREATE TABLE users (
  "id" TEXT PRIMARY KEY,
  "uid" TEXT UNIQUE,
  "email" TEXT,
  "displayName" TEXT,
  "role" TEXT,
  "settings" JSONB,
  "metadata" JSONB,
  "createdAt" BIGINT,
  "updatedAt" BIGINT,
  "photoURL" TEXT,
  "tenantId" TEXT,
  "active" BOOLEAN
);

CREATE TABLE exams (
  "id" TEXT PRIMARY KEY,
  "title" TEXT,
  "description" TEXT,
  "instructions" TEXT,
  "duration" INTEGER,
  "startTime" BIGINT,
  "endTime" BIGINT,
  "scheduledStart" BIGINT,
  "scheduledEnd" BIGINT,
  "questions" JSONB,
  "createdBy" TEXT,
  "status" TEXT,
  "settings" JSONB,
  "createdAt" BIGINT,
  "updatedAt" BIGINT,
  "groups" JSONB,
  "tenantId" TEXT
);

CREATE TABLE attempts (
  "id" TEXT PRIMARY KEY,
  "examId" TEXT,
  "studentId" TEXT,
  "answers" JSONB,
  "startTime" BIGINT,
  "endTime" BIGINT,
  "duration" INTEGER,
  "score" NUMERIC,
  "status" TEXT,
  "feedback" TEXT,
  "suspiciousActivity" JSONB,
  "gradedByName" TEXT,
  "gradedBy" TEXT,
  "manualGrades" JSONB,
  "autoScore" NUMERIC,
  "isPassed" BOOLEAN,
  "totalQuestions" INTEGER,
  "correctCount" INTEGER,
  "evaluatorId" TEXT,
  "evaluatorName" TEXT,
  "tenantId" TEXT
);

CREATE TABLE user_activities (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "userName" TEXT,
  "userRole" TEXT,
  "action" TEXT,
  "details" TEXT,
  "timestamp" BIGINT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userEmail" TEXT,
  "browser" TEXT,
  "tenantId" TEXT
);

-- CRITICAL: This line forces Supabase to instantly refresh its API cache!
NOTIFY pgrst, 'reload schema';
