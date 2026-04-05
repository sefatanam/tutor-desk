-- =============================================
-- FIX: Infinite recursion in RLS policies
-- The get_teacher_id() and get_student_id() functions query
-- teachers/students tables which have RLS enabled.
-- Even with SECURITY DEFINER, this causes recursion when
-- called from within an RLS policy.
-- 
-- SOLUTION: Drop all dependent policies first, then recreate
-- the functions and policies with direct JWT user_id comparison.
-- =============================================

-- =============================================
-- STEP 1: Drop ALL policies that depend on get_teacher_id()
-- =============================================

DROP POLICY IF EXISTS "users_teacher_view_students" ON users;
DROP POLICY IF EXISTS "students_teacher_all" ON students;
DROP POLICY IF EXISTS "subjects_teacher_all" ON subjects;
DROP POLICY IF EXISTS "subjects_student_enrolled" ON subjects;
DROP POLICY IF EXISTS "enrollments_teacher_all" ON subject_enrollments;
DROP POLICY IF EXISTS "enrollments_student_select" ON subject_enrollments;
DROP POLICY IF EXISTS "exams_teacher_all" ON exams;
DROP POLICY IF EXISTS "exams_student_select" ON exams;
DROP POLICY IF EXISTS "questions_teacher_all" ON questions;
DROP POLICY IF EXISTS "questions_student_select" ON questions;
DROP POLICY IF EXISTS "submissions_teacher_all" ON exam_submissions;
DROP POLICY IF EXISTS "submissions_student_all" ON exam_submissions;
DROP POLICY IF EXISTS "answers_teacher_select" ON submission_answers;
DROP POLICY IF EXISTS "answers_teacher_update" ON submission_answers;
DROP POLICY IF EXISTS "answers_student_all" ON submission_answers;
DROP POLICY IF EXISTS "assets_teacher_all" ON assets;
DROP POLICY IF EXISTS "assets_student_select" ON assets;
DROP POLICY IF EXISTS "comments_teacher_all" ON asset_comments;

-- =============================================
-- STEP 2: Drop existing helper functions
-- =============================================

DROP FUNCTION IF EXISTS public.get_teacher_id();
DROP FUNCTION IF EXISTS public.get_student_id();

-- Recreate get_teacher_id with explicit RLS bypass
-- Using SET clause to run as superuser bypasses RLS
CREATE OR REPLACE FUNCTION public.get_teacher_id()
RETURNS UUID AS $$
DECLARE
  v_teacher_id UUID;
  v_user_id UUID;
  jwt_claims json;
BEGIN
  -- Get user_id directly from JWT to avoid function call overhead
  jwt_claims := current_setting('request.jwt.claims', true)::json;
  IF jwt_claims IS NULL THEN
    RETURN NULL;
  END IF;
  v_user_id := (jwt_claims ->> 'sub')::UUID;
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Query teachers table - SECURITY DEFINER + SET ensures RLS bypass
  SELECT id INTO v_teacher_id 
  FROM teachers 
  WHERE user_id = v_user_id;
  
  RETURN v_teacher_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
   SET search_path = public;

-- Recreate get_student_id with explicit RLS bypass
CREATE OR REPLACE FUNCTION public.get_student_id()
RETURNS UUID AS $$
DECLARE
  v_student_id UUID;
  v_user_id UUID;
  jwt_claims json;
BEGIN
  -- Get user_id directly from JWT to avoid function call overhead
  jwt_claims := current_setting('request.jwt.claims', true)::json;
  IF jwt_claims IS NULL THEN
    RETURN NULL;
  END IF;
  v_user_id := (jwt_claims ->> 'sub')::UUID;
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Query students table - SECURITY DEFINER + SET ensures RLS bypass
  SELECT id INTO v_student_id 
  FROM students 
  WHERE user_id = v_user_id;
  
  RETURN v_student_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
   SET search_path = public;

-- Grant execute to all roles
GRANT EXECUTE ON FUNCTION public.get_teacher_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_id() TO anon, authenticated, service_role;

-- =============================================
-- ALTERNATIVE FIX: Simplify subject policies
-- Instead of calling get_teacher_id(), compare directly
-- with JWT user_id and use a subquery without RLS
-- =============================================

-- Drop existing subject policies that cause recursion
DROP POLICY IF EXISTS "subjects_teacher_all" ON subjects;
DROP POLICY IF EXISTS "subjects_student_enrolled" ON subjects;

-- Recreate teacher policy using direct JWT comparison
-- This avoids the function call that was causing recursion
CREATE POLICY "subjects_teacher_all" ON subjects
  FOR ALL
  USING (
    public.is_teacher() AND 
    teacher_id IN (
      SELECT t.id FROM teachers t 
      WHERE t.user_id = public.jwt_user_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND 
    teacher_id IN (
      SELECT t.id FROM teachers t 
      WHERE t.user_id = public.jwt_user_id()
    )
  );

-- Recreate student policy - simplified to avoid recursion
CREATE POLICY "subjects_student_enrolled" ON subjects
  FOR SELECT
  USING (
    public.is_student() AND
    id IN (
      SELECT se.subject_id 
      FROM subject_enrollments se
      JOIN students s ON s.id = se.student_id
      WHERE s.user_id = public.jwt_user_id()
    )
  );

-- =============================================
-- Also fix subject_enrollments policies
-- =============================================

DROP POLICY IF EXISTS "enrollments_teacher_all" ON subject_enrollments;

CREATE POLICY "enrollments_teacher_all" ON subject_enrollments
  FOR ALL
  USING (
    public.is_teacher() AND
    subject_id IN (
      SELECT s.id FROM subjects s
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = public.jwt_user_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND
    subject_id IN (
      SELECT s.id FROM subjects s
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = public.jwt_user_id()
    )
  );

DROP POLICY IF EXISTS "enrollments_student_select" ON subject_enrollments;

CREATE POLICY "enrollments_student_select" ON subject_enrollments
  FOR SELECT
  USING (
    public.is_student() AND 
    student_id IN (
      SELECT st.id FROM students st
      WHERE st.user_id = public.jwt_user_id()
    )
  );

-- =============================================
-- Fix exams policies
-- =============================================

DROP POLICY IF EXISTS "exams_teacher_all" ON exams;

CREATE POLICY "exams_teacher_all" ON exams
  FOR ALL
  USING (
    public.is_teacher() AND 
    teacher_id IN (
      SELECT t.id FROM teachers t 
      WHERE t.user_id = public.jwt_user_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND 
    teacher_id IN (
      SELECT t.id FROM teachers t 
      WHERE t.user_id = public.jwt_user_id()
    )
  );

DROP POLICY IF EXISTS "exams_student_select" ON exams;

CREATE POLICY "exams_student_select" ON exams
  FOR SELECT
  USING (
    public.is_student() AND
    status IN ('scheduled', 'active') AND
    subject_id IN (
      SELECT se.subject_id 
      FROM subject_enrollments se
      JOIN students s ON s.id = se.student_id
      WHERE s.user_id = public.jwt_user_id()
    )
  );

-- =============================================
-- Recreate all other dropped policies
-- Using direct JWT user_id comparison to avoid recursion
-- =============================================

-- Users: Teachers can view their students' user records
CREATE POLICY "users_teacher_view_students" ON users
  FOR SELECT
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM students s
      JOIN teachers t ON t.id = s.teacher_id
      WHERE s.user_id = users.id
      AND t.user_id = public.jwt_user_id()
    )
  );

-- Students: Teachers can manage their own students
CREATE POLICY "students_teacher_all" ON students
  FOR ALL
  USING (
    public.is_teacher() AND 
    teacher_id IN (
      SELECT t.id FROM teachers t 
      WHERE t.user_id = public.jwt_user_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND 
    teacher_id IN (
      SELECT t.id FROM teachers t 
      WHERE t.user_id = public.jwt_user_id()
    )
  );

-- Questions: Teachers can manage questions for their exams
CREATE POLICY "questions_teacher_all" ON questions
  FOR ALL
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM exams e
      JOIN teachers t ON t.id = e.teacher_id
      WHERE e.id = questions.exam_id
      AND t.user_id = public.jwt_user_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM exams e
      JOIN teachers t ON t.id = e.teacher_id
      WHERE e.id = questions.exam_id
      AND t.user_id = public.jwt_user_id()
    )
  );

-- Questions: Students can view questions during active exam submission
CREATE POLICY "questions_student_select" ON questions
  FOR SELECT
  USING (
    public.is_student() AND
    EXISTS (
      SELECT 1 FROM exam_submissions es
      JOIN students s ON s.id = es.student_id
      WHERE es.exam_id = questions.exam_id
      AND s.user_id = public.jwt_user_id()
      AND es.status = 'in_progress'
    )
  );

-- Exam submissions: Teachers can view/evaluate submissions for their exams
CREATE POLICY "submissions_teacher_all" ON exam_submissions
  FOR ALL
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM exams e
      JOIN teachers t ON t.id = e.teacher_id
      WHERE e.id = exam_submissions.exam_id
      AND t.user_id = public.jwt_user_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM exams e
      JOIN teachers t ON t.id = e.teacher_id
      WHERE e.id = exam_submissions.exam_id
      AND t.user_id = public.jwt_user_id()
    )
  );

-- Exam submissions: Students can manage their own submissions
CREATE POLICY "submissions_student_all" ON exam_submissions
  FOR ALL
  USING (
    public.is_student() AND 
    student_id IN (
      SELECT s.id FROM students s
      WHERE s.user_id = public.jwt_user_id()
    )
  )
  WITH CHECK (
    public.is_student() AND 
    student_id IN (
      SELECT s.id FROM students s
      WHERE s.user_id = public.jwt_user_id()
    )
  );

-- Submission answers: Teachers can view answers for their exams
CREATE POLICY "answers_teacher_select" ON submission_answers
  FOR SELECT
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM exam_submissions es
      JOIN exams e ON e.id = es.exam_id
      JOIN teachers t ON t.id = e.teacher_id
      WHERE es.id = submission_answers.submission_id
      AND t.user_id = public.jwt_user_id()
    )
  );

-- Submission answers: Teachers can update answers (for grading)
CREATE POLICY "answers_teacher_update" ON submission_answers
  FOR UPDATE
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM exam_submissions es
      JOIN exams e ON e.id = es.exam_id
      JOIN teachers t ON t.id = e.teacher_id
      WHERE es.id = submission_answers.submission_id
      AND t.user_id = public.jwt_user_id()
    )
  );

-- Submission answers: Students can manage their own answers
CREATE POLICY "answers_student_all" ON submission_answers
  FOR ALL
  USING (
    public.is_student() AND
    EXISTS (
      SELECT 1 FROM exam_submissions es
      JOIN students s ON s.id = es.student_id
      WHERE es.id = submission_answers.submission_id
      AND s.user_id = public.jwt_user_id()
    )
  )
  WITH CHECK (
    public.is_student() AND
    EXISTS (
      SELECT 1 FROM exam_submissions es
      JOIN students s ON s.id = es.student_id
      WHERE es.id = submission_answers.submission_id
      AND s.user_id = public.jwt_user_id()
    )
  );

-- Assets: Teachers can manage their own assets
CREATE POLICY "assets_teacher_all" ON assets
  FOR ALL
  USING (
    public.is_teacher() AND 
    teacher_id IN (
      SELECT t.id FROM teachers t 
      WHERE t.user_id = public.jwt_user_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND 
    teacher_id IN (
      SELECT t.id FROM teachers t 
      WHERE t.user_id = public.jwt_user_id()
    )
  );

-- Assets: Students can view published assets for enrolled subjects
CREATE POLICY "assets_student_select" ON assets
  FOR SELECT
  USING (
    public.is_student() AND
    is_published = true AND
    subject_id IN (
      SELECT se.subject_id 
      FROM subject_enrollments se
      JOIN students s ON s.id = se.student_id
      WHERE s.user_id = public.jwt_user_id()
    )
  );

-- Asset comments: Teachers can manage comments on their assets
CREATE POLICY "comments_teacher_all" ON asset_comments
  FOR ALL
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM assets a
      JOIN teachers t ON t.id = a.teacher_id
      WHERE a.id = asset_comments.asset_id
      AND t.user_id = public.jwt_user_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM assets a
      JOIN teachers t ON t.id = a.teacher_id
      WHERE a.id = asset_comments.asset_id
      AND t.user_id = public.jwt_user_id()
    )
  );
