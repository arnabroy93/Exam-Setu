-- Run this in your Supabase SQL Editor to add the missing columns
-- and remember to click "Reload schema cache" if prompted.

ALTER TABLE users ADD COLUMN IF NOT EXISTS "createdAt" BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "updatedAt" BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "photoURL" TEXT;

ALTER TABLE exams ADD COLUMN IF NOT EXISTS "createdAt" BIGINT;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS "updatedAt" BIGINT;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS "groups" JSONB;

ALTER TABLE attempts ADD COLUMN IF NOT EXISTS "autoScore" NUMERIC;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS "isPassed" BOOLEAN;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS "totalQuestions" INTEGER;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS "correctCount" INTEGER;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS "evaluatorId" TEXT;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS "evaluatorName" TEXT;

ALTER TABLE user_activities ADD COLUMN IF NOT EXISTS "userEmail" TEXT;
ALTER TABLE user_activities ADD COLUMN IF NOT EXISTS "browser" TEXT;

-- Notify postgrest to reload the schema cache so it recognizes the newly added columns
NOTIFY pgrst, 'reload schema';
