-- ==============================================================================
-- AcadEx Admin Database Setup File
-- NOTE: You MUST run this script in your Supabase SQL Editor.
-- This script creates the required administrative functions needed to 
-- reset user passwords securely directly from the User Management panel.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION reset_user_password(target_email TEXT, new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Update the user's password using the proper bcrypt salt
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf'))
  WHERE email = target_email;
  
  -- 2. Mark the user as requiring a password reset on their next login
  -- This sets password_reset_required flag to true inside raw_user_meta_data
  -- We also clean up the old raw_app_meta_data flag if it exists from previous versions
  UPDATE auth.users
  SET raw_user_meta_data = 
      COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"password_reset_required": true}'::jsonb,
      raw_app_meta_data = raw_app_meta_data - 'password_reset_required',
      updated_at = now()
  WHERE email = target_email;
END;
$$;
