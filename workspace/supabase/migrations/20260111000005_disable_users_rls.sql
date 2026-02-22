-- =============================================
-- Disable RLS on users table too
-- The join from students to users fails because
-- users table still has RLS enabled
-- =============================================

-- Drop all user policies
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_admin_all" ON users;

-- Disable RLS on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
