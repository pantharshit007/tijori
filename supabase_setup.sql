-- ============================================================================
-- SUPABASE SETUP: TRIGGERS AND AUTOMATION
-- ============================================================================
-- This file contains triggers and automation for the Tijori application.
-- These ensure proper initialization of user profiles and project ownership.
--
-- IMPORTANT: Run this file AFTER running supabase_rls_policies.sql
-- ============================================================================

-- ============================================================================
-- AUTOMATIC USER PROFILE CREATION
-- ============================================================================
-- When a new user signs up via Supabase Auth, automatically create their
-- profile in the tijori_user table.

-- Function to create user profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tijori_user (id, email, name, image)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run the function when a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- AUTOMATIC PROJECT OWNERSHIP
-- ============================================================================
-- When a user creates a new project, automatically add them as the owner
-- in the project_member table. This is critical for RLS to work correctly.

-- Function to add creator as project owner
CREATE OR REPLACE FUNCTION handle_new_project()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tijori_project_member (project_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run the function when a new project is created
DROP TRIGGER IF EXISTS on_project_created ON tijori_project;
CREATE TRIGGER on_project_created
  AFTER INSERT ON tijori_project
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_project();

-- ============================================================================
-- UPDATE LAST ACCESSED TIMESTAMP FOR SHARED SECRETS
-- ============================================================================
-- When a shared secret is accessed (selected), update the last_accessed_at
-- timestamp. This helps track usage and can be used for analytics.

-- Function to update last accessed timestamp
CREATE OR REPLACE FUNCTION update_shared_secret_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if more than 1 minute has passed since last access
  -- (to avoid excessive updates from the same session)
  UPDATE tijori_shared_secret
  SET last_accessed_at = NOW()
  WHERE id = NEW.id
    AND (last_accessed_at IS NULL OR last_accessed_at < NOW() - INTERVAL '1 minute');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger is commented out by default as it can impact performance
-- for high-traffic shared secrets. Enable it if you need access tracking.
-- 
-- DROP TRIGGER IF EXISTS on_shared_secret_accessed ON tijori_shared_secret;
-- CREATE TRIGGER on_shared_secret_accessed
--   AFTER SELECT ON tijori_shared_secret
--   FOR EACH ROW
--   EXECUTE FUNCTION update_shared_secret_access();

-- ============================================================================
-- HELPER FUNCTION: CHECK IF USER CAN ACCESS PROJECT
-- ============================================================================
-- Useful for application-level checks before making database queries

CREATE OR REPLACE FUNCTION can_user_access_project(
  p_project_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tijori_project_member
    WHERE project_id = p_project_id
      AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: GET USER'S PROJECTS
-- ============================================================================
-- Returns all projects that a user is a member of, with their role

CREATE OR REPLACE FUNCTION get_user_projects(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  project_id UUID,
  project_name VARCHAR,
  user_role VARCHAR,
  joined_at TIMESTAMP WITH TIME ZONE
) AS $$
  SELECT 
    p.id as project_id,
    p.name as project_name,
    pm.role as user_role,
    pm.created_at as joined_at
  FROM tijori_project p
  INNER JOIN tijori_project_member pm ON p.id = pm.project_id
  WHERE pm.user_id = p_user_id
  ORDER BY pm.created_at DESC;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- 1. AUTOMATIC USER PROFILE CREATION:
--    When a user signs up via Supabase Auth, their profile is automatically
--    created in tijori_user. The trigger pulls metadata from the auth.users
--    table (email, name, avatar) to populate the profile.
--
-- 2. AUTOMATIC PROJECT OWNERSHIP:
--    When a user creates a project, they are automatically added as the owner
--    in tijori_project_member. Without this, the RLS policies would prevent
--    them from accessing their own project!
--
-- 3. SECURITY DEFINER:
--    These functions run with elevated privileges to bypass RLS during setup.
--    This is necessary for the triggers to work correctly.
--
-- 4. HELPER FUNCTIONS:
--    The can_user_access_project and get_user_projects functions can be called
--    from your application code to check permissions before making queries.
--
-- 5. SHARED SECRET ACCESS TRACKING:
--    The trigger for updating last_accessed_at is commented out by default
--    as SELECT triggers can impact performance. Enable it only if needed.
--
-- ============================================================================
