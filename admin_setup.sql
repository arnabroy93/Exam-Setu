-- ==============================================================================
-- AcadEx Admin Database Setup File
-- NOTE: You MUST run this script in your Supabase SQL Editor.
-- This script creates the required administrative functions needed to 
-- reset user passwords securely directly from the User Management panel.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION reset_user_password(target_user_id TEXT, new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Update the user's password using the proper bcrypt salt
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id::uuid;
  
  -- 2. Mark the user as requiring a password reset on their next login
  -- This sets password_reset_required flag to true inside raw_app_meta_data
  UPDATE auth.users
  SET raw_app_meta_data = 
      COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"password_reset_required": true}'::jsonb,
      updated_at = now()
  WHERE id = target_user_id::uuid;
END;
$$;
