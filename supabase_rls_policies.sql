-- ============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES FOR TIJORI
-- ============================================================================
-- This file contains all RLS policies for the Tijori application.
-- It ensures proper data isolation and authorization based on project membership.
--
-- IMPORTANT: Run this file AFTER creating your schema with Drizzle migrations.
--
-- Security Model:
-- - Users can only access their own profile
-- - Projects are accessible only to project members
-- - Environments and variables inherit access from their parent project
-- - Shared secrets support both authenticated (project members) and 
--   anonymous (public sharing via link) access
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS FOR AUTHORIZATION CHECKS
-- ============================================================================

-- Check if a user is a member of a project with at least the specified role
-- Role hierarchy: owner > admin > member
CREATE OR REPLACE FUNCTION is_project_member(
  p_project_id UUID,
  p_user_id UUID,
  p_min_role TEXT DEFAULT 'member'
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  role_hierarchy INTEGER;
  min_role_hierarchy INTEGER;
BEGIN
  -- Get the user's role in the project
  SELECT role INTO user_role
  FROM tijori_project_member
  WHERE project_id = p_project_id AND user_id = p_user_id;
  
  -- If user is not a member, return false
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Define role hierarchy (higher number = more permissions)
  role_hierarchy := CASE user_role
    WHEN 'owner' THEN 3
    WHEN 'admin' THEN 2
    WHEN 'member' THEN 1
    ELSE 0
  END;
  
  min_role_hierarchy := CASE p_min_role
    WHEN 'owner' THEN 3
    WHEN 'admin' THEN 2
    WHEN 'member' THEN 1
    ELSE 0
  END;
  
  -- Check if user's role meets the minimum requirement
  RETURN role_hierarchy >= min_role_hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get the project ID for a given environment
CREATE OR REPLACE FUNCTION get_project_for_environment(p_environment_id UUID)
RETURNS UUID AS $$
  SELECT project_id
  FROM tijori_environment
  WHERE id = p_environment_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if a shared secret has expired
CREATE OR REPLACE FUNCTION is_shared_secret_expired(p_secret_id UUID)
RETURNS BOOLEAN AS $$
  SELECT CASE
    WHEN expires_at IS NULL THEN FALSE
    WHEN expires_at > NOW() THEN FALSE
    ELSE TRUE
  END
  FROM tijori_shared_secret
  WHERE id = p_secret_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

ALTER TABLE tijori_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE tijori_project ENABLE ROW LEVEL SECURITY;
ALTER TABLE tijori_environment ENABLE ROW LEVEL SECURITY;
ALTER TABLE tijori_environment_variable ENABLE ROW LEVEL SECURITY;
ALTER TABLE tijori_project_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE tijori_shared_secret ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON tijori_user
  FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile (must match auth.uid())
CREATE POLICY "Users can create their own profile"
  ON tijori_user
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON tijori_user
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "Users can delete their own profile"
  ON tijori_user
  FOR DELETE
  USING (auth.uid() = id);

-- ============================================================================
-- PROJECTS TABLE POLICIES
-- ============================================================================

-- Project members can view project details
CREATE POLICY "Project members can view projects"
  ON tijori_project
  FOR SELECT
  USING (
    is_project_member(id, auth.uid(), 'member')
  );

-- Any authenticated user can create a project
CREATE POLICY "Authenticated users can create projects"
  ON tijori_project
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only owners and admins can update projects
CREATE POLICY "Project owners and admins can update projects"
  ON tijori_project
  FOR UPDATE
  USING (is_project_member(id, auth.uid(), 'admin'))
  WITH CHECK (is_project_member(id, auth.uid(), 'admin'));

-- Only owners can delete projects
CREATE POLICY "Project owners can delete projects"
  ON tijori_project
  FOR DELETE
  USING (is_project_member(id, auth.uid(), 'owner'));

-- ============================================================================
-- ENVIRONMENTS TABLE POLICIES
-- ============================================================================

-- Project members can view environments
CREATE POLICY "Project members can view environments"
  ON tijori_environment
  FOR SELECT
  USING (
    is_project_member(project_id, auth.uid(), 'member')
  );

-- Project owners and admins can create environments
CREATE POLICY "Project owners and admins can create environments"
  ON tijori_environment
  FOR INSERT
  WITH CHECK (
    is_project_member(project_id, auth.uid(), 'admin')
  );

-- Project owners and admins can update environments
CREATE POLICY "Project owners and admins can update environments"
  ON tijori_environment
  FOR UPDATE
  USING (is_project_member(project_id, auth.uid(), 'admin'))
  WITH CHECK (is_project_member(project_id, auth.uid(), 'admin'));

-- Project owners and admins can delete environments
CREATE POLICY "Project owners and admins can delete environments"
  ON tijori_environment
  FOR DELETE
  USING (is_project_member(project_id, auth.uid(), 'admin'));

-- ============================================================================
-- ENVIRONMENT VARIABLES TABLE POLICIES
-- ============================================================================

-- Project members can view environment variables
CREATE POLICY "Project members can view environment variables"
  ON tijori_environment_variable
  FOR SELECT
  USING (
    is_project_member(
      get_project_for_environment(environment_id),
      auth.uid(),
      'member'
    )
  );

-- Project members can create environment variables
CREATE POLICY "Project members can create environment variables"
  ON tijori_environment_variable
  FOR INSERT
  WITH CHECK (
    is_project_member(
      get_project_for_environment(environment_id),
      auth.uid(),
      'member'
    )
  );

-- Project members can update environment variables
CREATE POLICY "Project members can update environment variables"
  ON tijori_environment_variable
  FOR UPDATE
  USING (
    is_project_member(
      get_project_for_environment(environment_id),
      auth.uid(),
      'member'
    )
  )
  WITH CHECK (
    is_project_member(
      get_project_for_environment(environment_id),
      auth.uid(),
      'member'
    )
  );

-- Project members can delete environment variables
CREATE POLICY "Project members can delete environment variables"
  ON tijori_environment_variable
  FOR DELETE
  USING (
    is_project_member(
      get_project_for_environment(environment_id),
      auth.uid(),
      'member'
    )
  );

-- ============================================================================
-- PROJECT MEMBERS TABLE POLICIES
-- ============================================================================

-- Project members can view other members of their projects
CREATE POLICY "Project members can view members"
  ON tijori_project_member
  FOR SELECT
  USING (
    is_project_member(project_id, auth.uid(), 'member')
  );

-- Project owners and admins can add new members
CREATE POLICY "Project owners and admins can add members"
  ON tijori_project_member
  FOR INSERT
  WITH CHECK (
    is_project_member(project_id, auth.uid(), 'admin')
  );

-- Project owners and admins can update member roles
CREATE POLICY "Project owners and admins can update member roles"
  ON tijori_project_member
  FOR UPDATE
  USING (is_project_member(project_id, auth.uid(), 'admin'))
  WITH CHECK (is_project_member(project_id, auth.uid(), 'admin'));

-- Project owners and admins can remove members
CREATE POLICY "Project owners and admins can remove members"
  ON tijori_project_member
  FOR DELETE
  USING (is_project_member(project_id, auth.uid(), 'admin'));

-- ============================================================================
-- SHARED SECRETS TABLE POLICIES
-- ============================================================================

-- Policy 1: Authenticated project members can view all shared secrets from their projects
CREATE POLICY "Project members can view shared secrets"
  ON tijori_shared_secret
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    is_project_member(project_id, auth.uid(), 'member')
  );

-- Policy 2: Anonymous users can view non-expired shared secrets by ID
-- This enables the "share via link" functionality for external users
CREATE POLICY "Anonymous users can view non-expired shared secrets"
  ON tijori_shared_secret
  FOR SELECT
  USING (
    NOT is_shared_secret_expired(id)
  );

-- Project members can create shared secrets
CREATE POLICY "Project members can create shared secrets"
  ON tijori_shared_secret
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    is_project_member(project_id, auth.uid(), 'member') AND
    created_by = auth.uid()
  );

-- Project members can update shared secrets they created
CREATE POLICY "Creators can update their shared secrets"
  ON tijori_shared_secret
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    created_by = auth.uid() AND
    is_project_member(project_id, auth.uid(), 'member')
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    created_by = auth.uid() AND
    is_project_member(project_id, auth.uid(), 'member')
  );

-- Project members can delete shared secrets they created
CREATE POLICY "Creators can delete their shared secrets"
  ON tijori_shared_secret
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    created_by = auth.uid() AND
    is_project_member(project_id, auth.uid(), 'member')
  );

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- 1. SECURITY DEFINER functions run with the privileges of the function owner,
--    allowing them to access tables even when RLS is enabled.
--
-- 2. The shared_secret table has TWO SELECT policies that work together:
--    - One for authenticated project members (can see all project secrets)
--    - One for anonymous users (can see specific secrets by ID if not expired)
--    This enables secure sharing with external users who don't have accounts.
--
-- 3. All encrypted data (passwords, secrets, etc.) remains encrypted in the
--    database. RLS only controls who can ACCESS the encrypted data, not
--    decrypt it. Decryption happens client-side with the user's passcode.
--
-- 4. When a user creates a project, they must be added to tijori_project_member
--    with role='owner' immediately, or they won't be able to access it.
--    See supabase_setup.sql for the trigger that handles this automatically.
--
-- ============================================================================
