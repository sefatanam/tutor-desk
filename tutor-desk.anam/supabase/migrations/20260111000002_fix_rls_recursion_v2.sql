-- =============================================
-- FIX: Infinite recursion in RLS policies (v2)
-- 
-- The issue: Even with SECURITY DEFINER functions,
-- subqueries in RLS policies still evaluate RLS on 
-- the referenced tables, causing infinite recursion.
--
-- SOLUTION: Create security-definer wrapper functions
-- that return the teacher_id/student_id, and use these
-- in simple equality checks (no subqueries in policies).
-- =============================================

-- =============================================
-- STEP 1: Drop ALL policies that might cause recursion
-- =============================================

-- Users table
DROP POLICY IF EXISTS "users_teacher_view_students" ON users;

-- Students table  
DROP POLICY IF EXISTS "students_teacher_all" ON students;

-- Subjects table
DROP POLICY IF EXISTS "subjects_teacher_all" ON subjects;
DROP POLICY IF EXISTS "subjects_student_enrolled" ON subjects;

-- Subject enrollments table
DROP POLICY IF EXISTS "enrollments_teacher_all" ON subject_enrollments;
DROP POLICY IF EXISTS "enrollments_student_select" ON subject_enrollments;

-- Exams table
DROP POLICY IF EXISTS "exams_teacher_all" ON exams;
DROP POLICY IF EXISTS "exams_student_select" ON exams;

-- Questions table
DROP POLICY IF EXISTS "questions_teacher_all" ON questions;
DROP POLICY IF EXISTS "questions_student_select" ON questions;

-- Exam submissions table
DROP POLICY IF EXISTS "submissions_teacher_all" ON exam_submissions;
DROP POLICY IF EXISTS "submissions_student_all" ON exam_submissions;

-- Submission answers table
DROP POLICY IF EXISTS "answers_teacher_select" ON submission_answers;
DROP POLICY IF EXISTS "answers_teacher_update" ON submission_answers;
DROP POLICY IF EXISTS "answers_student_all" ON submission_answers;

-- Assets table
DROP POLICY IF EXISTS "assets_teacher_all" ON assets;
DROP POLICY IF EXISTS "assets_student_select" ON assets;

-- Asset comments table
DROP POLICY IF EXISTS "comments_teacher_all" ON asset_comments;

-- =============================================
-- STEP 2: Drop and recreate helper functions
-- These MUST bypass RLS completely
-- =============================================

DROP FUNCTION IF EXISTS public.get_teacher_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_student_id() CASCADE;

-- Create get_teacher_id that bypasses RLS completely
-- The key is SECURITY DEFINER runs as the function owner (superuser)
-- Combined with explicit SET search_path
CREATE FUNCTION public.get_teacher_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT t.id 
  FROM public.teachers t 
  WHERE t.user_id = (
    SELECT (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid
  )
  LIMIT 1;
$$;

-- Create get_student_id that bypasses RLS completely
CREATE FUNCTION public.get_student_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT s.id 
  FROM public.students s 
  WHERE s.user_id = (
    SELECT (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid
  )
  LIMIT 1;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_teacher_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_id() TO anon, authenticated, service_role;

-- =============================================
-- STEP 3: Recreate policies using simple equality
-- with the SECURITY DEFINER functions (no subqueries)
-- =============================================

-- SUBJECTS: Teachers can manage their own subjects
CREATE POLICY "subjects_teacher_all" ON subjects
  FOR ALL
  USING (public.is_teacher() AND teacher_id = public.get_teacher_id())
  WITH CHECK (public.is_teacher() AND teacher_id = public.get_teacher_id());

-- SUBJECTS: Students can view enrolled subjects
-- This one needs a subquery, but it queries subject_enrollments, not subjects
CREATE POLICY "subjects_student_enrolled" ON subjects
  FOR SELECT
  USING (
    public.is_student() AND
    EXISTS (
      SELECT 1 FROM public.subject_enrollments se
      WHERE se.subject_id = subjects.id
      AND se.student_id = public.get_student_id()
    )
  );

-- STUDENTS: Teachers can manage their own students
CREATE POLICY "students_teacher_all" ON students
  FOR ALL
  USING (public.is_teacher() AND teacher_id = public.get_teacher_id())
  WITH CHECK (public.is_teacher() AND teacher_id = public.get_teacher_id());

-- USERS: Teachers can view their students' user records
CREATE POLICY "users_teacher_view_students" ON users
  FOR SELECT
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.user_id = users.id
      AND s.teacher_id = public.get_teacher_id()
    )
  );

-- SUBJECT ENROLLMENTS: Teachers can manage enrollments for their subjects
CREATE POLICY "enrollments_teacher_all" ON subject_enrollments
  FOR ALL
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_enrollments.subject_id
      AND s.teacher_id = public.get_teacher_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = subject_enrollments.subject_id
      AND s.teacher_id = public.get_teacher_id()
    )
  );

-- SUBJECT ENROLLMENTS: Students can view their own enrollments
CREATE POLICY "enrollments_student_select" ON subject_enrollments
  FOR SELECT
  USING (public.is_student() AND student_id = public.get_student_id());

-- EXAMS: Teachers can manage their own exams
CREATE POLICY "exams_teacher_all" ON exams
  FOR ALL
  USING (public.is_teacher() AND teacher_id = public.get_teacher_id())
  WITH CHECK (public.is_teacher() AND teacher_id = public.get_teacher_id());

-- EXAMS: Students can view scheduled/active exams for enrolled subjects
CREATE POLICY "exams_student_select" ON exams
  FOR SELECT
  USING (
    public.is_student() AND
    status IN ('scheduled', 'active') AND
    EXISTS (
      SELECT 1 FROM public.subject_enrollments se
      WHERE se.subject_id = exams.subject_id
      AND se.student_id = public.get_student_id()
    )
  );

-- QUESTIONS: Teachers can manage questions for their exams
CREATE POLICY "questions_teacher_all" ON questions
  FOR ALL
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = questions.exam_id
      AND e.teacher_id = public.get_teacher_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = questions.exam_id
      AND e.teacher_id = public.get_teacher_id()
    )
  );

-- QUESTIONS: Students can view questions during active exam
CREATE POLICY "questions_student_select" ON questions
  FOR SELECT
  USING (
    public.is_student() AND
    EXISTS (
      SELECT 1 FROM public.exam_submissions es
      WHERE es.exam_id = questions.exam_id
      AND es.student_id = public.get_student_id()
      AND es.status = 'in_progress'
    )
  );

-- EXAM SUBMISSIONS: Teachers can manage submissions for their exams
CREATE POLICY "submissions_teacher_all" ON exam_submissions
  FOR ALL
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_submissions.exam_id
      AND e.teacher_id = public.get_teacher_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_submissions.exam_id
      AND e.teacher_id = public.get_teacher_id()
    )
  );

-- EXAM SUBMISSIONS: Students can manage their own submissions
CREATE POLICY "submissions_student_all" ON exam_submissions
  FOR ALL
  USING (public.is_student() AND student_id = public.get_student_id())
  WITH CHECK (public.is_student() AND student_id = public.get_student_id());

-- SUBMISSION ANSWERS: Teachers can view answers
CREATE POLICY "answers_teacher_select" ON submission_answers
  FOR SELECT
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM public.exam_submissions es
      JOIN public.exams e ON e.id = es.exam_id
      WHERE es.id = submission_answers.submission_id
      AND e.teacher_id = public.get_teacher_id()
    )
  );

-- SUBMISSION ANSWERS: Teachers can update answers (grading)
CREATE POLICY "answers_teacher_update" ON submission_answers
  FOR UPDATE
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM public.exam_submissions es
      JOIN public.exams e ON e.id = es.exam_id
      WHERE es.id = submission_answers.submission_id
      AND e.teacher_id = public.get_teacher_id()
    )
  );

-- SUBMISSION ANSWERS: Students can manage their own answers
CREATE POLICY "answers_student_all" ON submission_answers
  FOR ALL
  USING (
    public.is_student() AND
    EXISTS (
      SELECT 1 FROM public.exam_submissions es
      WHERE es.id = submission_answers.submission_id
      AND es.student_id = public.get_student_id()
    )
  )
  WITH CHECK (
    public.is_student() AND
    EXISTS (
      SELECT 1 FROM public.exam_submissions es
      WHERE es.id = submission_answers.submission_id
      AND es.student_id = public.get_student_id()
    )
  );

-- ASSETS: Teachers can manage their own assets
CREATE POLICY "assets_teacher_all" ON assets
  FOR ALL
  USING (public.is_teacher() AND teacher_id = public.get_teacher_id())
  WITH CHECK (public.is_teacher() AND teacher_id = public.get_teacher_id());

-- ASSETS: Students can view published assets for enrolled subjects
CREATE POLICY "assets_student_select" ON assets
  FOR SELECT
  USING (
    public.is_student() AND
    is_published = true AND
    EXISTS (
      SELECT 1 FROM public.subject_enrollments se
      WHERE se.subject_id = assets.subject_id
      AND se.student_id = public.get_student_id()
    )
  );

-- ASSET COMMENTS: Teachers can manage comments on their assets
CREATE POLICY "comments_teacher_all" ON asset_comments
  FOR ALL
  USING (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_comments.asset_id
      AND a.teacher_id = public.get_teacher_id()
    )
  )
  WITH CHECK (
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_comments.asset_id
      AND a.teacher_id = public.get_teacher_id()
    )
  );
