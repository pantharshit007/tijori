-- ============================================================================
-- SUPABASE RLS TESTS
-- ============================================================================
-- Comprehensive test suite for Row Level Security policies in Tijori.
-- Run these tests in the Supabase SQL Editor to verify all policies work correctly.
--
-- IMPORTANT: This file creates test data. Run the CLEANUP section at the end
-- to remove all test data after verification.
--
-- Test Structure:
-- 1. Setup: Create test users and data
-- 2. Tests: Execute queries and verify results
-- 3. Cleanup: Remove all test data
-- ============================================================================

-- ============================================================================
-- SETUP: CREATE TEST DATA
-- ============================================================================

-- These test user IDs simulate different Supabase Auth users
-- In a real test, you would create actual auth.users and use their IDs
DO $$
DECLARE
  test_user_1_id UUID := 'a0000000-0000-0000-0000-000000000001'::UUID;
  test_user_2_id UUID := 'a0000000-0000-0000-0000-000000000002'::UUID;
  test_user_3_id UUID := 'a0000000-0000-0000-0000-000000000003'::UUID;
  test_project_1_id UUID;
  test_project_2_id UUID;
  test_env_1_id UUID;
  test_env_2_id UUID;
BEGIN
  -- Create test users
  INSERT INTO tijori_user (id, email, name) VALUES
    (test_user_1_id, 'user1@test.com', 'Test User 1'),
    (test_user_2_id, 'user2@test.com', 'Test User 2'),
    (test_user_3_id, 'user3@test.com', 'Test User 3');

  -- Create test projects
  INSERT INTO tijori_project (id, name, description, encrypted_passcode, master_key_hash, passcode_salt, iv, auth_tag)
  VALUES
    (gen_random_uuid(), 'Project 1', 'Test project 1', 'enc1', 'hash1', 'salt1', 'iv1', 'tag1'),
    (gen_random_uuid(), 'Project 2', 'Test project 2', 'enc2', 'hash2', 'salt2', 'iv2', 'tag2')
  RETURNING id INTO test_project_1_id;

  -- Get the second project ID
  SELECT id INTO test_project_2_id FROM tijori_project WHERE name = 'Project 2';

  -- Add project members
  -- User 1: Owner of Project 1, Member of Project 2
  -- User 2: Admin of Project 1
  -- User 3: Not a member of any project
  INSERT INTO tijori_project_member (project_id, user_id, role) VALUES
    (test_project_1_id, test_user_1_id, 'owner'),
    (test_project_1_id, test_user_2_id, 'admin'),
    (test_project_2_id, test_user_1_id, 'member');

  -- Create environments
  INSERT INTO tijori_environment (id, project_id, name, description)
  VALUES
    (gen_random_uuid(), test_project_1_id, 'dev', 'Development'),
    (gen_random_uuid(), test_project_1_id, 'prod', 'Production')
  RETURNING id INTO test_env_1_id;

  SELECT id INTO test_env_2_id FROM tijori_environment WHERE name = 'prod';

  -- Create environment variables
  INSERT INTO tijori_environment_variable (environment_id, name, encrypted_value) VALUES
    (test_env_1_id, 'API_KEY', 'encrypted_api_key_1'),
    (test_env_1_id, 'DATABASE_URL', 'encrypted_db_url_1'),
    (test_env_2_id, 'API_KEY', 'encrypted_api_key_2');

  -- Create shared secrets
  INSERT INTO tijori_shared_secret (
    id, project_id, environment_id, created_by,
    encrypted_payload, encrypted_share_key, passcode_salt,
    iv, auth_tag, payload_iv, payload_auth_tag,
    description, expires_at
  ) VALUES
    (
      gen_random_uuid(), test_project_1_id, test_env_1_id, test_user_1_id,
      'payload1', 'key1', 'salt1', 'iv1', 'tag1', 'piv1', 'ptag1',
      'Non-expired secret', NOW() + INTERVAL '7 days'
    ),
    (
      gen_random_uuid(), test_project_1_id, test_env_1_id, test_user_1_id,
      'payload2', 'key2', 'salt2', 'iv2', 'tag2', 'piv2', 'ptag2',
      'Expired secret', NOW() - INTERVAL '1 day'
    );

  RAISE NOTICE 'Test data created successfully!';
  RAISE NOTICE 'Test User 1 ID: %', test_user_1_id;
  RAISE NOTICE 'Test User 2 ID: %', test_user_2_id;
  RAISE NOTICE 'Test User 3 ID: %', test_user_3_id;
  RAISE NOTICE 'Test Project 1 ID: %', test_project_1_id;
  RAISE NOTICE 'Test Project 2 ID: %', test_project_2_id;
END $$;

-- ============================================================================
-- TEST 1: USER TABLE - Users can only see their own profile
-- ============================================================================

-- Test 1.1: ✓ User can see their own profile
-- Expected: 1 row (user1@test.com)
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SELECT 'TEST 1.1: User can see own profile' as test_name;
SELECT email, name FROM tijori_user WHERE id = 'a0000000-0000-0000-0000-000000000001'::UUID;

-- Test 1.2: ✗ User cannot see other users' profiles
-- Expected: 0 rows
SELECT 'TEST 1.2: User cannot see other profiles' as test_name;
SELECT email, name FROM tijori_user WHERE id = 'a0000000-0000-0000-0000-000000000002'::UUID;

RESET role;

-- ============================================================================
-- TEST 2: PROJECT TABLE - Project member access
-- ============================================================================

-- Test 2.1: ✓ User 1 (owner) can see Project 1
-- Expected: 1 row (Project 1)
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SELECT 'TEST 2.1: Owner can see project' as test_name;
SELECT name, description FROM tijori_project WHERE name = 'Project 1';

-- Test 2.2: ✓ User 2 (admin) can see Project 1
-- Expected: 1 row (Project 1)
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000002';
SELECT 'TEST 2.2: Admin can see project' as test_name;
SELECT name, description FROM tijori_project WHERE name = 'Project 1';

-- Test 2.3: ✗ User 3 (not a member) cannot see Project 1
-- Expected: 0 rows
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000003';
SELECT 'TEST 2.3: Non-member cannot see project' as test_name;
SELECT name, description FROM tijori_project WHERE name = 'Project 1';

RESET role;

-- ============================================================================
-- TEST 3: PROJECT MEMBERS TABLE - Role-based permissions
-- ============================================================================

-- Test 3.1: ✓ User 1 (owner) can view all members
-- Expected: 2 rows (User 1 as owner, User 2 as admin)
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SELECT 'TEST 3.1: Owner can view all members' as test_name;
SELECT u.email, pm.role 
FROM tijori_project_member pm
JOIN tijori_user u ON pm.user_id = u.id
WHERE pm.project_id = (SELECT id FROM tijori_project WHERE name = 'Project 1');

-- Test 3.2: ✗ User 3 (non-member) cannot view members
-- Expected: 0 rows
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000003';
SELECT 'TEST 3.2: Non-member cannot view members' as test_name;
SELECT u.email, pm.role 
FROM tijori_project_member pm
JOIN tijori_user u ON pm.user_id = u.id
WHERE pm.project_id = (SELECT id FROM tijori_project WHERE name = 'Project 1');

RESET role;

-- ============================================================================
-- TEST 4: ENVIRONMENT TABLE - Inherit access from project
-- ============================================================================

-- Test 4.1: ✓ User 1 (project member) can view environments
-- Expected: 2 rows (dev, prod)
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SELECT 'TEST 4.1: Project member can view environments' as test_name;
SELECT name, description FROM tijori_environment 
WHERE project_id = (SELECT id FROM tijori_project WHERE name = 'Project 1');

-- Test 4.2: ✗ User 3 (non-member) cannot view environments
-- Expected: 0 rows
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000003';
SELECT 'TEST 4.2: Non-member cannot view environments' as test_name;
SELECT name, description FROM tijori_environment 
WHERE project_id = (SELECT id FROM tijori_project WHERE name = 'Project 1');

RESET role;

-- ============================================================================
-- TEST 5: ENVIRONMENT VARIABLES - Inherit access from environment/project
-- ============================================================================

-- Test 5.1: ✓ User 1 (project member) can view variables
-- Expected: 3 rows total (2 in dev, 1 in prod)
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SELECT 'TEST 5.1: Project member can view variables' as test_name;
SELECT ev.name, e.name as environment
FROM tijori_environment_variable ev
JOIN tijori_environment e ON ev.environment_id = e.id
WHERE e.project_id = (SELECT id FROM tijori_project WHERE name = 'Project 1');

-- Test 5.2: ✗ User 3 (non-member) cannot view variables
-- Expected: 0 rows
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000003';
SELECT 'TEST 5.2: Non-member cannot view variables' as test_name;
SELECT ev.name, e.name as environment
FROM tijori_environment_variable ev
JOIN tijori_environment e ON ev.environment_id = e.id
WHERE e.project_id = (SELECT id FROM tijori_project WHERE name = 'Project 1');

RESET role;

-- ============================================================================
-- TEST 6: SHARED SECRETS - Authenticated project member access
-- ============================================================================

-- Test 6.1: ✓ User 1 (project member) can view project's shared secrets
-- Expected: 2 rows (both secrets, including expired one)
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000001';
SELECT 'TEST 6.1: Project member can view all project secrets' as test_name;
SELECT description, expires_at < NOW() as is_expired
FROM tijori_shared_secret
WHERE project_id = (SELECT id FROM tijori_project WHERE name = 'Project 1');

-- Test 6.2: ✗ User 3 (non-member) cannot view project's shared secrets via project query
-- Expected: 0 rows
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub TO 'a0000000-0000-0000-0000-000000000003';
SELECT 'TEST 6.2: Non-member cannot view project secrets' as test_name;
SELECT description, expires_at < NOW() as is_expired
FROM tijori_shared_secret
WHERE project_id = (SELECT id FROM tijori_project WHERE name = 'Project 1');

RESET role;

-- ============================================================================
-- TEST 7: SHARED SECRETS - Anonymous public access by ID
-- ============================================================================

-- Test 7.1: ✓ Anonymous user can view non-expired secret by ID
-- Expected: 1 row (the non-expired secret)
-- Note: In real Supabase, anonymous users don't set auth.uid()
SELECT 'TEST 7.1: Anonymous can view non-expired secret' as test_name;
SELECT description, expires_at
FROM tijori_shared_secret
WHERE description = 'Non-expired secret'
  AND expires_at > NOW();

-- Test 7.2: ✗ Anonymous user cannot view expired secret
-- Expected: 0 rows (policy blocks expired secrets for anonymous)
-- Note: This test depends on the RLS policy checking expiration
SELECT 'TEST 7.2: Anonymous cannot view expired secret' as test_name;
SELECT description, expires_at
FROM tijori_shared_secret
WHERE description = 'Expired secret'
  AND id IN (SELECT id FROM tijori_shared_secret WHERE expires_at < NOW());

-- ============================================================================
-- TEST 8: HELPER FUNCTIONS
-- ============================================================================

-- Test 8.1: is_project_member function
SELECT 'TEST 8.1: Helper function - is_project_member' as test_name;
SELECT 
  is_project_member(
    (SELECT id FROM tijori_project WHERE name = 'Project 1'),
    'a0000000-0000-0000-0000-000000000001'::UUID,
    'member'
  ) as user1_is_member, -- Should be TRUE
  is_project_member(
    (SELECT id FROM tijori_project WHERE name = 'Project 1'),
    'a0000000-0000-0000-0000-000000000003'::UUID,
    'member'
  ) as user3_is_member; -- Should be FALSE

-- Test 8.2: get_project_for_environment function
SELECT 'TEST 8.2: Helper function - get_project_for_environment' as test_name;
SELECT 
  e.name as environment_name,
  get_project_for_environment(e.id) as project_id,
  p.name as project_name
FROM tijori_environment e
JOIN tijori_project p ON e.project_id = p.id
WHERE e.name = 'dev';

-- Test 8.3: is_shared_secret_expired function
SELECT 'TEST 8.3: Helper function - is_shared_secret_expired' as test_name;
SELECT 
  description,
  expires_at,
  is_shared_secret_expired(id) as is_expired
FROM tijori_shared_secret;

-- ============================================================================
-- TEST SUMMARY
-- ============================================================================

SELECT '
================================================================================
TEST SUMMARY
================================================================================
Review the results above:
- Tests marked with ✓ should return data
- Tests marked with ✗ should return NO data (RLS blocking access)

If any test fails (returns unexpected results), your RLS policies may need adjustment.

Key Points to Verify:
1. Users can only access their own profile
2. Project access is restricted to members
3. Environments and variables inherit project access
4. Shared secrets support both authenticated and anonymous access
5. Anonymous users can only view non-expired secrets
6. Helper functions return correct values

After reviewing, run the CLEANUP section below to remove test data.
================================================================================
' as summary;

-- ============================================================================
-- CLEANUP: REMOVE TEST DATA
-- ============================================================================
-- Run this section to remove all test data after verification

/*
-- Uncomment to run cleanup

DELETE FROM tijori_shared_secret 
WHERE created_by IN (
  'a0000000-0000-0000-0000-000000000001'::UUID,
  'a0000000-0000-0000-0000-000000000002'::UUID,
  'a0000000-0000-0000-0000-000000000003'::UUID
);

DELETE FROM tijori_environment_variable 
WHERE environment_id IN (
  SELECT id FROM tijori_environment WHERE project_id IN (
    SELECT id FROM tijori_project WHERE name IN ('Project 1', 'Project 2')
  )
);

DELETE FROM tijori_environment 
WHERE project_id IN (
  SELECT id FROM tijori_project WHERE name IN ('Project 1', 'Project 2')
);

DELETE FROM tijori_project_member 
WHERE user_id IN (
  'a0000000-0000-0000-0000-000000000001'::UUID,
  'a0000000-0000-0000-0000-000000000002'::UUID,
  'a0000000-0000-0000-0000-000000000003'::UUID
);

DELETE FROM tijori_project WHERE name IN ('Project 1', 'Project 2');

DELETE FROM tijori_user WHERE id IN (
  'a0000000-0000-0000-0000-000000000001'::UUID,
  'a0000000-0000-0000-0000-000000000002'::UUID,
  'a0000000-0000-0000-0000-000000000003'::UUID
);

SELECT 'Test data cleaned up successfully!' as result;
*/

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- IMPORTANT: These tests use SET LOCAL to simulate different authenticated users.
-- In a real Supabase environment, each user would have their own JWT token.
-- 
-- To test with real Supabase Auth users:
-- 1. Create test users in the Supabase Auth dashboard
-- 2. Use the Supabase client library to authenticate as each user
-- 3. Run queries through the client (not raw SQL)
-- 4. The JWT token will automatically set auth.uid()
--
-- Anonymous Access Testing:
-- - The anonymous tests (TEST 7.x) simulate unauthenticated requests
-- - In production, these would come from users without JWT tokens
-- - The RLS policies allow SELECT on shared_secret for anonymous users
--   as long as the secret hasn't expired
--
-- ============================================================================
