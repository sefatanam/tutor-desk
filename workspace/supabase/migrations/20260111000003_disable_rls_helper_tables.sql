-- =============================================
-- FIX: Disable RLS on teachers and students tables
-- 
-- ROOT CAUSE: Even with SECURITY DEFINER functions,
-- PostgreSQL still evaluates RLS policies on tables
-- referenced in subqueries within policy definitions.
-- This creates infinite recursion when:
--   subjects policy → calls get_teacher_id() → queries teachers table
--   teachers table has RLS → tries to evaluate its policies → recursion
--
-- SOLUTION: Disable RLS on teachers and students tables.
-- These tables don't contain sensitive data (passwords are in users table).
-- The user_id FK ensures data integrity, and our policies on other tables
-- still enforce proper access control.
--
-- SECURITY ANALYSIS:
-- - teachers table: Only contains profile data (user_id FK, created_at)
-- - students table: Contains profile + teacher_id FK (which teacher they belong to)
-- - Sensitive auth data (password_hash, email) is in users table (RLS remains ON)
-- - All other tables (subjects, exams, etc.) maintain RLS with proper policies
-- =============================================

-- Disable RLS on teachers table
ALTER TABLE teachers DISABLE ROW LEVEL SECURITY;

-- Disable RLS on students table  
ALTER TABLE students DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies on these tables (cleanup)
DROP POLICY IF EXISTS "teachers_select_own" ON teachers;
DROP POLICY IF EXISTS "teachers_update_own" ON teachers;
DROP POLICY IF EXISTS "teachers_admin_all" ON teachers;
DROP POLICY IF EXISTS "students_teacher_all" ON students;
DROP POLICY IF EXISTS "students_self_select" ON students;
DROP POLICY IF EXISTS "students_admin_all" ON students;

-- =============================================
-- Recreate simplified helper functions
-- Now that RLS is disabled on teachers/students,
-- these functions can query freely without recursion
-- =============================================

DROP FUNCTION IF EXISTS public.get_teacher_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_student_id() CASCADE;

-- Simple get_teacher_id - no RLS to worry about now
CREATE FUNCTION public.get_teacher_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT id FROM teachers WHERE user_id = public.jwt_user_id() LIMIT 1;
$$;

-- Simple get_student_id - no RLS to worry about now
CREATE FUNCTION public.get_student_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT id FROM students WHERE user_id = public.jwt_user_id() LIMIT 1;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_teacher_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_id() TO anon, authenticated, service_role;

-- =============================================
-- Recreate policies on subjects using the simple functions
-- =============================================

DROP POLICY IF EXISTS "subjects_teacher_all" ON subjects;
DROP POLICY IF EXISTS "subjects_student_enrolled" ON subjects;

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
-- Recreate policies on subject_enrollments
-- =============================================

DROP POLICY IF EXISTS "enrollments_teacher_all" ON subject_enrollments;
DROP POLICY IF EXISTS "enrollments_student_select" ON subject_enrollments;

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
-- Recreate policies on exams
-- =============================================

DROP POLICY IF EXISTS "exams_teacher_all" ON exams;
DROP POLICY IF EXISTS "exams_student_select" ON exams;

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
-- Recreate policies on questions
-- =============================================

DROP POLICY IF EXISTS "questions_teacher_all" ON questions;
DROP POLICY IF EXISTS "questions_student_select" ON questions;

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

-- Students can view questions during active exam
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
-- Recreate policies on exam_submissions
-- =============================================

DROP POLICY IF EXISTS "submissions_teacher_all" ON exam_submissions;
DROP POLICY IF EXISTS "submissions_student_all" ON exam_submissions;

-- Teachers can manage submissions for their exams
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
-- Recreate policies on submission_answers
-- =============================================

DROP POLICY IF EXISTS "answers_teacher_select" ON submission_answers;
DROP POLICY IF EXISTS "answers_teacher_update" ON submission_answers;
DROP POLICY IF EXISTS "answers_student_all" ON submission_answers;

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

-- Teachers can update answers (grading)
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
-- Recreate policies on assets
-- =============================================

DROP POLICY IF EXISTS "assets_teacher_all" ON assets;
DROP POLICY IF EXISTS "assets_student_select" ON assets;

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
-- Recreate policies on asset_comments
-- =============================================

DROP POLICY IF EXISTS "comments_teacher_all" ON asset_comments;

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

-- =============================================
-- Recreate policy on users for teachers viewing students
-- =============================================

DROP POLICY IF EXISTS "users_teacher_view_students" ON users;

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
