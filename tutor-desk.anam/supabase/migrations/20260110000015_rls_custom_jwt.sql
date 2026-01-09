-- =============================================
-- TUTOR DESK - RLS Policies for Custom JWT
-- Version: 015
-- Description: Update RLS to work with custom JWT (not Supabase Auth)
-- 
-- IMPORTANT: Your Edge Function MUST sign JWTs with Supabase's JWT secret
-- =============================================

-- =============================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- =============================================

-- Users table
DROP POLICY IF EXISTS "Super admin can view all users" ON users;
DROP POLICY IF EXISTS "Super admin can manage users" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Teachers can view their students" ON users;
DROP POLICY IF EXISTS "users_super_admin_all" ON users;
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_teacher_view_students" ON users;

-- Teachers table
DROP POLICY IF EXISTS "Super admin manages teachers" ON teachers;
DROP POLICY IF EXISTS "Teachers can view own record" ON teachers;
DROP POLICY IF EXISTS "Teachers can update own record" ON teachers;
DROP POLICY IF EXISTS "teachers_super_admin_all" ON teachers;
DROP POLICY IF EXISTS "teachers_select_own" ON teachers;
DROP POLICY IF EXISTS "teachers_update_own" ON teachers;

-- Students table
DROP POLICY IF EXISTS "Super admin manages students" ON students;
DROP POLICY IF EXISTS "Teachers manage their students" ON students;
DROP POLICY IF EXISTS "Students view own record" ON students;
DROP POLICY IF EXISTS "students_super_admin_all" ON students;
DROP POLICY IF EXISTS "students_teacher_all" ON students;
DROP POLICY IF EXISTS "students_select_own" ON students;

-- Subjects table
DROP POLICY IF EXISTS "Super admin manages subjects" ON subjects;
DROP POLICY IF EXISTS "Teachers manage own subjects" ON subjects;
DROP POLICY IF EXISTS "Students view enrolled subjects" ON subjects;
DROP POLICY IF EXISTS "subjects_super_admin_all" ON subjects;
DROP POLICY IF EXISTS "subjects_teacher_all" ON subjects;
DROP POLICY IF EXISTS "subjects_student_enrolled" ON subjects;

-- Subject enrollments table
DROP POLICY IF EXISTS "Super admin manages enrollments" ON subject_enrollments;
DROP POLICY IF EXISTS "Teachers manage subject enrollments" ON subject_enrollments;
DROP POLICY IF EXISTS "Students view own enrollments" ON subject_enrollments;
DROP POLICY IF EXISTS "enrollments_super_admin_all" ON subject_enrollments;
DROP POLICY IF EXISTS "enrollments_teacher_all" ON subject_enrollments;
DROP POLICY IF EXISTS "enrollments_student_select" ON subject_enrollments;

-- Exams table
DROP POLICY IF EXISTS "Super admin manages exams" ON exams;
DROP POLICY IF EXISTS "Teachers manage own exams" ON exams;
DROP POLICY IF EXISTS "Students view available exams" ON exams;
DROP POLICY IF EXISTS "exams_super_admin_all" ON exams;
DROP POLICY IF EXISTS "exams_teacher_all" ON exams;
DROP POLICY IF EXISTS "exams_student_select" ON exams;

-- Questions table
DROP POLICY IF EXISTS "Super admin manages questions" ON questions;
DROP POLICY IF EXISTS "Teachers manage exam questions" ON questions;
DROP POLICY IF EXISTS "Students view questions during exam" ON questions;
DROP POLICY IF EXISTS "questions_super_admin_all" ON questions;
DROP POLICY IF EXISTS "questions_teacher_all" ON questions;
DROP POLICY IF EXISTS "questions_student_select" ON questions;

-- Exam submissions table
DROP POLICY IF EXISTS "Super admin manages submissions" ON exam_submissions;
DROP POLICY IF EXISTS "Teachers manage exam submissions" ON exam_submissions;
DROP POLICY IF EXISTS "Students manage own submissions" ON exam_submissions;
DROP POLICY IF EXISTS "submissions_super_admin_all" ON exam_submissions;
DROP POLICY IF EXISTS "submissions_teacher_all" ON exam_submissions;
DROP POLICY IF EXISTS "submissions_student_all" ON exam_submissions;

-- Submission answers table
DROP POLICY IF EXISTS "Super admin manages answers" ON submission_answers;
DROP POLICY IF EXISTS "Teachers view submission answers" ON submission_answers;
DROP POLICY IF EXISTS "Students manage own answers" ON submission_answers;
DROP POLICY IF EXISTS "answers_super_admin_all" ON submission_answers;
DROP POLICY IF EXISTS "answers_teacher_select" ON submission_answers;
DROP POLICY IF EXISTS "answers_teacher_update" ON submission_answers;
DROP POLICY IF EXISTS "answers_student_all" ON submission_answers;

-- Assets table
DROP POLICY IF EXISTS "Super admin manages assets" ON assets;
DROP POLICY IF EXISTS "Teachers manage own assets" ON assets;
DROP POLICY IF EXISTS "Students view published assets" ON assets;
DROP POLICY IF EXISTS "assets_super_admin_all" ON assets;
DROP POLICY IF EXISTS "assets_teacher_all" ON assets;
DROP POLICY IF EXISTS "assets_student_select" ON assets;

-- Asset comments table
DROP POLICY IF EXISTS "Super admin manages comments" ON asset_comments;
DROP POLICY IF EXISTS "Teachers manage asset comments" ON asset_comments;
DROP POLICY IF EXISTS "Users manage own comments" ON asset_comments;
DROP POLICY IF EXISTS "Users view visible comments" ON asset_comments;
DROP POLICY IF EXISTS "comments_super_admin_all" ON asset_comments;
DROP POLICY IF EXISTS "comments_teacher_all" ON asset_comments;
DROP POLICY IF EXISTS "comments_own_all" ON asset_comments;

-- Refresh tokens table
DROP POLICY IF EXISTS "Users manage own refresh tokens" ON refresh_tokens;
DROP POLICY IF EXISTS "Service can manage refresh tokens" ON refresh_tokens;

-- =============================================
-- STEP 2: DROP POLICIES THAT DEPEND ON OLD FUNCTIONS
-- =============================================

DROP POLICY IF EXISTS "Super admin manages rate limits" ON rate_limits;
DROP POLICY IF EXISTS "Super admin views all tokens" ON refresh_tokens;
DROP POLICY IF EXISTS "rate_limits_super_admin_all" ON rate_limits;

-- =============================================
-- STEP 2b: DROP OLD HELPER FUNCTIONS (in public schema)
-- =============================================

DROP FUNCTION IF EXISTS public.get_user_role();
DROP FUNCTION IF EXISTS public.jwt_user_id();
DROP FUNCTION IF EXISTS public.jwt_role();
DROP FUNCTION IF EXISTS public.is_super_admin();
DROP FUNCTION IF EXISTS public.is_teacher();
DROP FUNCTION IF EXISTS public.is_student();
DROP FUNCTION IF EXISTS public.get_teacher_id();
DROP FUNCTION IF EXISTS public.get_student_id();

-- =============================================
-- STEP 3: CREATE HELPER FUNCTIONS IN PUBLIC SCHEMA
-- These read JWT claims from request.jwt.claims (set by PostgREST)
-- NOT from auth.jwt() which only works with Supabase Auth
-- IMPORTANT: We use 'user_role' not 'role' to avoid PostgREST SET ROLE conflict
-- =============================================

-- Get user ID from JWT 'sub' claim
CREATE OR REPLACE FUNCTION public.jwt_user_id()
RETURNS UUID AS $$
DECLARE
  jwt_claims json;
BEGIN
  -- PostgREST sets this from the Authorization header JWT
  jwt_claims := current_setting('request.jwt.claims', true)::json;
  IF jwt_claims IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN (jwt_claims ->> 'sub')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get user role from JWT 'user_role' claim (NOT 'role' to avoid PostgREST conflict)
CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS TEXT AS $$
DECLARE
  jwt_claims json;
BEGIN
  jwt_claims := current_setting('request.jwt.claims', true)::json;
  IF jwt_claims IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jwt_claims ->> 'user_role';
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
  jwt_claims json;
BEGIN
  jwt_claims := current_setting('request.jwt.claims', true)::json;
  IF jwt_claims IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN (jwt_claims ->> 'user_role') = 'super_admin';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is a teacher
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
DECLARE
  jwt_claims json;
BEGIN
  jwt_claims := current_setting('request.jwt.claims', true)::json;
  IF jwt_claims IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN (jwt_claims ->> 'user_role') = 'teacher';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is a student
CREATE OR REPLACE FUNCTION public.is_student()
RETURNS BOOLEAN AS $$
DECLARE
  jwt_claims json;
BEGIN
  jwt_claims := current_setting('request.jwt.claims', true)::json;
  IF jwt_claims IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN (jwt_claims ->> 'user_role') = 'student';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get teacher_id for current user (if teacher)
CREATE OR REPLACE FUNCTION public.get_teacher_id()
RETURNS UUID AS $$
DECLARE
  v_teacher_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := public.jwt_user_id();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id INTO v_teacher_id 
  FROM teachers 
  WHERE user_id = v_user_id;
  RETURN v_teacher_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get student_id for current user (if student)
CREATE OR REPLACE FUNCTION public.get_student_id()
RETURNS UUID AS $$
DECLARE
  v_student_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := public.jwt_user_id();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id INTO v_student_id 
  FROM students 
  WHERE user_id = v_user_id;
  RETURN v_student_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- STEP 4: ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 5: USERS TABLE POLICIES
-- =============================================

-- Super admin can do everything
CREATE POLICY "users_super_admin_all" ON users
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Users can view their own profile
CREATE POLICY "users_select_own" ON users
  FOR SELECT
  USING (id = public.jwt_user_id());

-- Users can update their own profile (but not role/status)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (id = public.jwt_user_id())
  WITH CHECK (id = public.jwt_user_id());

-- Teachers can view their students' user records
CREATE POLICY "users_teacher_view_students" ON users
  FOR SELECT
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.user_id = users.id
      AND s.teacher_id = public.get_teacher_id()
    )
  );

-- =============================================
-- STEP 6: TEACHERS TABLE POLICIES
-- =============================================

-- Super admin can do everything
CREATE POLICY "teachers_super_admin_all" ON teachers
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Teachers can view their own record
CREATE POLICY "teachers_select_own" ON teachers
  FOR SELECT
  USING (user_id = public.jwt_user_id());

-- Teachers can update their own record
CREATE POLICY "teachers_update_own" ON teachers
  FOR UPDATE
  USING (user_id = public.jwt_user_id())
  WITH CHECK (user_id = public.jwt_user_id());

-- =============================================
-- STEP 7: STUDENTS TABLE POLICIES
-- =============================================

-- Super admin can do everything
CREATE POLICY "students_super_admin_all" ON students
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Teachers can manage their own students
CREATE POLICY "students_teacher_all" ON students
  FOR ALL
  USING (public.is_teacher() AND teacher_id = public.get_teacher_id())
  WITH CHECK (public.is_teacher() AND teacher_id = public.get_teacher_id());

-- Students can view their own record
CREATE POLICY "students_select_own" ON students
  FOR SELECT
  USING (user_id = public.jwt_user_id());

-- =============================================
-- STEP 8: SUBJECTS TABLE POLICIES
-- =============================================

-- Super admin can do everything
CREATE POLICY "subjects_super_admin_all" ON subjects
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Teachers can manage their own subjects
CREATE POLICY "subjects_teacher_all" ON subjects
  FOR ALL
  USING (public.is_teacher() AND teacher_id = public.get_teacher_id())
  WITH CHECK (public.is_teacher() AND teacher_id = public.get_teacher_id());

-- Students can view subjects they're enrolled in
CREATE POLICY "subjects_student_enrolled" ON subjects
  FOR SELECT
  USING (
    public.is_student() AND
    EXISTS (
      SELECT 1 FROM subject_enrollments se
      WHERE se.subject_id = subjects.id
      AND se.student_id = public.get_student_id()
    )
  );

-- =============================================
-- STEP 9: SUBJECT ENROLLMENTS POLICIES
-- =============================================

-- Super admin can do everything
CREATE POLICY "enrollments_super_admin_all" ON subject_enrollments
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Teachers can manage enrollments for their subjects
CREATE POLICY "enrollments_teacher_all" ON subject_enrollments
  FOR ALL
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM subjects s
      WHERE s.id = subject_enrollments.subject_id
      AND s.teacher_id = public.get_teacher_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM subjects s
      WHERE s.id = subject_enrollments.subject_id
      AND s.teacher_id = public.get_teacher_id()
    )
  );

-- Students can view their own enrollments
CREATE POLICY "enrollments_student_select" ON subject_enrollments
  FOR SELECT
  USING (public.is_student() AND student_id = public.get_student_id());

-- =============================================
-- STEP 10: EXAMS TABLE POLICIES
-- =============================================

-- Super admin can do everything
CREATE POLICY "exams_super_admin_all" ON exams
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Teachers can manage their own exams
CREATE POLICY "exams_teacher_all" ON exams
  FOR ALL
  USING (public.is_teacher() AND teacher_id = public.get_teacher_id())
  WITH CHECK (public.is_teacher() AND teacher_id = public.get_teacher_id());

-- Students can view scheduled/active exams for enrolled subjects
CREATE POLICY "exams_student_select" ON exams
  FOR SELECT
  USING (
    public.is_student() AND
    status IN ('scheduled', 'active') AND
    EXISTS (
      SELECT 1 FROM subject_enrollments se
      WHERE se.subject_id = exams.subject_id
      AND se.student_id = public.get_student_id()
    )
  );

-- =============================================
-- STEP 11: QUESTIONS TABLE POLICIES
-- =============================================

-- Super admin can do everything
CREATE POLICY "questions_super_admin_all" ON questions
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Teachers can manage questions for their exams
CREATE POLICY "questions_teacher_all" ON questions
  FOR ALL
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM exams e
      WHERE e.id = questions.exam_id
      AND e.teacher_id = public.get_teacher_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM exams e
      WHERE e.id = questions.exam_id
      AND e.teacher_id = public.get_teacher_id()
    )
  );

-- Students can view questions during active exam submission
CREATE POLICY "questions_student_select" ON questions
  FOR SELECT
  USING (
    public.is_student() AND
    EXISTS (
      SELECT 1 FROM exam_submissions es
      WHERE es.exam_id = questions.exam_id
      AND es.student_id = public.get_student_id()
      AND es.status = 'in_progress'
    )
  );

-- =============================================
-- STEP 12: EXAM SUBMISSIONS POLICIES
-- =============================================

-- Super admin can do everything
CREATE POLICY "submissions_super_admin_all" ON exam_submissions
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Teachers can view/evaluate submissions for their exams
CREATE POLICY "submissions_teacher_all" ON exam_submissions
  FOR ALL
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM exams e
      WHERE e.id = exam_submissions.exam_id
      AND e.teacher_id = public.get_teacher_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM exams e
      WHERE e.id = exam_submissions.exam_id
      AND e.teacher_id = public.get_teacher_id()
    )
  );

-- Students can manage their own submissions
CREATE POLICY "submissions_student_all" ON exam_submissions
  FOR ALL
  USING (public.is_student() AND student_id = public.get_student_id())
  WITH CHECK (public.is_student() AND student_id = public.get_student_id());

-- =============================================
-- STEP 13: SUBMISSION ANSWERS POLICIES
-- =============================================

-- Super admin can do everything
CREATE POLICY "answers_super_admin_all" ON submission_answers
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Teachers can view answers for their exams
CREATE POLICY "answers_teacher_select" ON submission_answers
  FOR SELECT
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM exam_submissions es
      JOIN exams e ON e.id = es.exam_id
      WHERE es.id = submission_answers.submission_id
      AND e.teacher_id = public.get_teacher_id()
    )
  );

-- Teachers can update answers (for grading)
CREATE POLICY "answers_teacher_update" ON submission_answers
  FOR UPDATE
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM exam_submissions es
      JOIN exams e ON e.id = es.exam_id
      WHERE es.id = submission_answers.submission_id
      AND e.teacher_id = public.get_teacher_id()
    )
  );

-- Students can manage their own answers
CREATE POLICY "answers_student_all" ON submission_answers
  FOR ALL
  USING (
    public.is_student() AND
    EXISTS (
      SELECT 1 FROM exam_submissions es
      WHERE es.id = submission_answers.submission_id
      AND es.student_id = public.get_student_id()
    )
  )
  WITH CHECK (
    public.is_student() AND
    EXISTS (
      SELECT 1 FROM exam_submissions es
      WHERE es.id = submission_answers.submission_id
      AND es.student_id = public.get_student_id()
    )
  );

-- =============================================
-- STEP 14: ASSETS TABLE POLICIES
-- =============================================

-- Super admin can do everything
CREATE POLICY "assets_super_admin_all" ON assets
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Teachers can manage their own assets
CREATE POLICY "assets_teacher_all" ON assets
  FOR ALL
  USING (public.is_teacher() AND teacher_id = public.get_teacher_id())
  WITH CHECK (public.is_teacher() AND teacher_id = public.get_teacher_id());

-- Students can view published assets for enrolled subjects
CREATE POLICY "assets_student_select" ON assets
  FOR SELECT
  USING (
    public.is_student() AND
    is_published = true AND
    EXISTS (
      SELECT 1 FROM subject_enrollments se
      WHERE se.subject_id = assets.subject_id
      AND se.student_id = public.get_student_id()
    )
  );

-- =============================================
-- STEP 15: ASSET COMMENTS POLICIES
-- =============================================

-- Super admin can do everything
CREATE POLICY "comments_super_admin_all" ON asset_comments
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Teachers can manage comments on their assets
CREATE POLICY "comments_teacher_all" ON asset_comments
  FOR ALL
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_comments.asset_id
      AND a.teacher_id = public.get_teacher_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_comments.asset_id
      AND a.teacher_id = public.get_teacher_id()
    )
  );

-- Users can manage their own comments
CREATE POLICY "comments_own_all" ON asset_comments
  FOR ALL
  USING (user_id = public.jwt_user_id())
  WITH CHECK (user_id = public.jwt_user_id());

-- =============================================
-- STEP 16: REFRESH TOKENS POLICIES
-- (Service role only - no user access via RLS)
-- =============================================

-- No policies = only service role can access
-- This is intentional for security

-- =============================================
-- STEP 17: GRANT NECESSARY PERMISSIONS
-- =============================================

-- Ensure authenticated users can use helper functions
GRANT EXECUTE ON FUNCTION public.jwt_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_teacher_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_id() TO authenticated;

-- Grant anon same permissions (for initial queries before auth)
GRANT EXECUTE ON FUNCTION public.jwt_user_id() TO anon;
GRANT EXECUTE ON FUNCTION public.jwt_role() TO anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO anon;
GRANT EXECUTE ON FUNCTION public.is_student() TO anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_id() TO anon;
GRANT EXECUTE ON FUNCTION public.get_student_id() TO anon;

-- =============================================
-- STEP 18: RECREATE RATE LIMITS POLICY
-- =============================================

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limits_super_admin_all" ON rate_limits
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
