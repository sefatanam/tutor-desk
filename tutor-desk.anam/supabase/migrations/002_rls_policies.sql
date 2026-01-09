-- =============================================
-- TUTOR DESK - Row Level Security Policies
-- Version: 002
-- Description: RLS policies for multi-tenant access control
-- =============================================

-- =============================================
-- HELPER FUNCTIONS FOR RLS
-- =============================================

-- Get current user's role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
    SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if current user is super admin
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND role = 'super_admin'
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if current user is a teacher
CREATE OR REPLACE FUNCTION auth.is_teacher()
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND role = 'teacher'
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Get current user's teacher_id (if teacher)
CREATE OR REPLACE FUNCTION auth.teacher_id()
RETURNS UUID AS $$
    SELECT id FROM teachers WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Get current user's student_id (if student)
CREATE OR REPLACE FUNCTION auth.student_id()
RETURNS UUID AS $$
    SELECT id FROM students WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if student belongs to teacher
CREATE OR REPLACE FUNCTION auth.student_belongs_to_teacher(p_student_id UUID)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM students s
        JOIN teachers t ON s.teacher_id = t.id
        WHERE s.id = p_student_id AND t.user_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================
-- USERS TABLE POLICIES
-- =============================================

-- Super admin can see all users
CREATE POLICY "Super admin can view all users" ON users
    FOR SELECT USING (auth.is_super_admin());

-- Super admin can manage all users
CREATE POLICY "Super admin can manage users" ON users
    FOR ALL USING (auth.is_super_admin());

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND role = (SELECT role FROM users WHERE id = auth.uid()));

-- Teachers can view their students
CREATE POLICY "Teachers can view their students" ON users
    FOR SELECT USING (
        auth.is_teacher() AND 
        EXISTS (
            SELECT 1 FROM students s 
            JOIN teachers t ON s.teacher_id = t.id 
            WHERE s.user_id = users.id AND t.user_id = auth.uid()
        )
    );

-- =============================================
-- TEACHERS TABLE POLICIES
-- =============================================

-- Super admin full access to teachers
CREATE POLICY "Super admin manages teachers" ON teachers
    FOR ALL USING (auth.is_super_admin());

-- Teachers can view and update their own record
CREATE POLICY "Teachers can view own record" ON teachers
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Teachers can update own record" ON teachers
    FOR UPDATE USING (user_id = auth.uid());

-- =============================================
-- STUDENTS TABLE POLICIES
-- =============================================

-- Super admin full access to students
CREATE POLICY "Super admin manages students" ON students
    FOR ALL USING (auth.is_super_admin());

-- Teachers can manage their own students
CREATE POLICY "Teachers manage their students" ON students
    FOR ALL USING (
        auth.is_teacher() AND 
        teacher_id = auth.teacher_id()
    );

-- Students can view their own record
CREATE POLICY "Students view own record" ON students
    FOR SELECT USING (user_id = auth.uid());

-- =============================================
-- SUBJECTS TABLE POLICIES
-- =============================================

-- Super admin full access
CREATE POLICY "Super admin manages subjects" ON subjects
    FOR ALL USING (auth.is_super_admin());

-- Teachers manage their own subjects
CREATE POLICY "Teachers manage own subjects" ON subjects
    FOR ALL USING (
        auth.is_teacher() AND 
        teacher_id = auth.teacher_id()
    );

-- Students can view enrolled subjects
CREATE POLICY "Students view enrolled subjects" ON subjects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM subject_enrollments se
            WHERE se.subject_id = subjects.id 
            AND se.student_id = auth.student_id()
        )
    );

-- =============================================
-- SUBJECT ENROLLMENTS POLICIES
-- =============================================

-- Super admin full access
CREATE POLICY "Super admin manages enrollments" ON subject_enrollments
    FOR ALL USING (auth.is_super_admin());

-- Teachers manage enrollments for their subjects
CREATE POLICY "Teachers manage subject enrollments" ON subject_enrollments
    FOR ALL USING (
        auth.is_teacher() AND 
        EXISTS (
            SELECT 1 FROM subjects s 
            WHERE s.id = subject_enrollments.subject_id 
            AND s.teacher_id = auth.teacher_id()
        )
    );

-- Students can view their own enrollments
CREATE POLICY "Students view own enrollments" ON subject_enrollments
    FOR SELECT USING (student_id = auth.student_id());

-- =============================================
-- EXAMS TABLE POLICIES
-- =============================================

-- Super admin full access
CREATE POLICY "Super admin manages exams" ON exams
    FOR ALL USING (auth.is_super_admin());

-- Teachers manage their own exams
CREATE POLICY "Teachers manage own exams" ON exams
    FOR ALL USING (
        auth.is_teacher() AND 
        teacher_id = auth.teacher_id()
    );

-- Students can view active exams for enrolled subjects
CREATE POLICY "Students view available exams" ON exams
    FOR SELECT USING (
        status IN ('scheduled', 'active') AND
        EXISTS (
            SELECT 1 FROM subject_enrollments se
            WHERE se.subject_id = exams.subject_id 
            AND se.student_id = auth.student_id()
        )
    );

-- =============================================
-- QUESTIONS TABLE POLICIES
-- =============================================

-- Super admin full access
CREATE POLICY "Super admin manages questions" ON questions
    FOR ALL USING (auth.is_super_admin());

-- Teachers manage questions for their exams
CREATE POLICY "Teachers manage exam questions" ON questions
    FOR ALL USING (
        auth.is_teacher() AND 
        EXISTS (
            SELECT 1 FROM exams e 
            WHERE e.id = questions.exam_id 
            AND e.teacher_id = auth.teacher_id()
        )
    );

-- Students can view questions during active exam
CREATE POLICY "Students view questions during exam" ON questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM exam_submissions es
            JOIN exams e ON e.id = es.exam_id
            WHERE es.student_id = auth.student_id()
            AND es.exam_id = questions.exam_id
            AND es.status = 'in_progress'
        )
    );

-- =============================================
-- EXAM SUBMISSIONS POLICIES
-- =============================================

-- Super admin full access
CREATE POLICY "Super admin manages submissions" ON exam_submissions
    FOR ALL USING (auth.is_super_admin());

-- Teachers can view and evaluate submissions for their exams
CREATE POLICY "Teachers manage exam submissions" ON exam_submissions
    FOR ALL USING (
        auth.is_teacher() AND 
        EXISTS (
            SELECT 1 FROM exams e 
            WHERE e.id = exam_submissions.exam_id 
            AND e.teacher_id = auth.teacher_id()
        )
    );

-- Students can view and create their own submissions
CREATE POLICY "Students manage own submissions" ON exam_submissions
    FOR ALL USING (student_id = auth.student_id());

-- =============================================
-- SUBMISSION ANSWERS POLICIES
-- =============================================

-- Super admin full access
CREATE POLICY "Super admin manages answers" ON submission_answers
    FOR ALL USING (auth.is_super_admin());

-- Teachers can view answers for their exams
CREATE POLICY "Teachers view submission answers" ON submission_answers
    FOR SELECT USING (
        auth.is_teacher() AND 
        EXISTS (
            SELECT 1 FROM exam_submissions es
            JOIN exams e ON e.id = es.exam_id
            WHERE es.id = submission_answers.submission_id 
            AND e.teacher_id = auth.teacher_id()
        )
    );

-- Students can manage their own answers
CREATE POLICY "Students manage own answers" ON submission_answers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exam_submissions es
            WHERE es.id = submission_answers.submission_id 
            AND es.student_id = auth.student_id()
        )
    );

-- =============================================
-- ASSETS TABLE POLICIES
-- =============================================

-- Super admin full access
CREATE POLICY "Super admin manages assets" ON assets
    FOR ALL USING (auth.is_super_admin());

-- Teachers manage their own assets
CREATE POLICY "Teachers manage own assets" ON assets
    FOR ALL USING (
        auth.is_teacher() AND 
        teacher_id = auth.teacher_id()
    );

-- Students can view published assets for enrolled subjects
CREATE POLICY "Students view published assets" ON assets
    FOR SELECT USING (
        is_published = true AND
        EXISTS (
            SELECT 1 FROM subject_enrollments se
            WHERE se.subject_id = assets.subject_id 
            AND se.student_id = auth.student_id()
        )
    );

-- =============================================
-- ASSET COMMENTS POLICIES
-- =============================================

-- Super admin full access
CREATE POLICY "Super admin manages comments" ON asset_comments
    FOR ALL USING (auth.is_super_admin());

-- Teachers can manage comments on their assets
CREATE POLICY "Teachers manage asset comments" ON asset_comments
    FOR ALL USING (
        auth.is_teacher() AND 
        EXISTS (
            SELECT 1 FROM assets a 
            WHERE a.id = asset_comments.asset_id 
            AND a.teacher_id = auth.teacher_id()
        )
    );

-- Users can manage their own comments
CREATE POLICY "Users manage own comments" ON asset_comments
    FOR ALL USING (user_id = auth.uid());

-- Users can view visible comments on accessible assets
CREATE POLICY "Users view visible comments" ON asset_comments
    FOR SELECT USING (
        is_visible = true AND
        EXISTS (
            SELECT 1 FROM assets a
            JOIN subject_enrollments se ON se.subject_id = a.subject_id
            WHERE a.id = asset_comments.asset_id 
            AND (
                se.student_id = auth.student_id() OR
                a.teacher_id = auth.teacher_id()
            )
        )
    );
