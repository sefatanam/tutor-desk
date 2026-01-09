-- =============================================
-- TUTOR DESK - Database Schema Migration
-- Version: 001
-- Description: Initial schema setup with all tables
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================

-- User roles enum
CREATE TYPE user_role AS ENUM ('super_admin', 'teacher', 'student');

-- User status enum
CREATE TYPE user_status AS ENUM ('pending', 'active', 'disabled', 'suspended');

-- Exam status enum
CREATE TYPE exam_status AS ENUM ('draft', 'scheduled', 'active', 'completed', 'cancelled');

-- Submission status enum
CREATE TYPE submission_status AS ENUM ('in_progress', 'submitted', 'auto_submitted', 'evaluated', 'retake_allowed');

-- Asset type enum
CREATE TYPE asset_type AS ENUM ('document', 'image', 'video', 'link', 'other');

-- =============================================
-- TABLES
-- =============================================

-- ---------------------------------------------
-- Users Table (Base table for all user types)
-- ---------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL for Google OAuth users
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'student',
    status user_status NOT NULL DEFAULT 'pending',
    phone VARCHAR(20),
    
    -- OAuth fields
    auth_provider VARCHAR(50) DEFAULT 'email', -- 'email', 'google'
    auth_provider_id VARCHAR(255), -- Google user ID
    
    -- Metadata
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Index for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- ---------------------------------------------
-- Teachers Table (Extended info for teachers)
-- ---------------------------------------------
CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Teacher-specific fields
    qualification VARCHAR(255),
    specialization VARCHAR(255),
    bio TEXT,
    
    -- Settings
    allow_student_comments BOOLEAN DEFAULT true,
    show_exam_results_immediately BOOLEAN DEFAULT true,
    
    -- Statistics (cached for performance)
    total_students INT DEFAULT 0,
    total_subjects INT DEFAULT 0,
    total_exams INT DEFAULT 0,
    
    -- Metadata
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teachers_user_id ON teachers(user_id);

-- ---------------------------------------------
-- Students Table (Extended info for students)
-- ---------------------------------------------
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    
    -- Student-specific fields
    roll_number VARCHAR(50),
    class_name VARCHAR(100),
    section VARCHAR(50),
    guardian_name VARCHAR(255),
    guardian_phone VARCHAR(20),
    address TEXT,
    date_of_birth DATE,
    
    -- Statistics (cached for performance)
    total_exams_taken INT DEFAULT 0,
    average_score DECIMAL(5, 2) DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_teacher_id ON students(teacher_id);

-- ---------------------------------------------
-- Subjects Table
-- ---------------------------------------------
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    code VARCHAR(50),
    color VARCHAR(7) DEFAULT '#4CAF50', -- Hex color for UI
    icon VARCHAR(100) DEFAULT 'pi-book',
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    
    -- Statistics
    total_students INT DEFAULT 0,
    total_exams INT DEFAULT 0,
    total_assets INT DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique subject code per teacher
    CONSTRAINT unique_subject_code_per_teacher UNIQUE (teacher_id, code)
);

CREATE INDEX idx_subjects_teacher_id ON subjects(teacher_id);

-- ---------------------------------------------
-- Subject Enrollments (Student-Subject M:M)
-- ---------------------------------------------
CREATE TABLE subject_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    enrolled_by UUID REFERENCES users(id),
    
    -- Unique enrollment
    CONSTRAINT unique_enrollment UNIQUE (student_id, subject_id)
);

CREATE INDEX idx_enrollments_student ON subject_enrollments(student_id);
CREATE INDEX idx_enrollments_subject ON subject_enrollments(subject_id);

-- ---------------------------------------------
-- Exams Table
-- ---------------------------------------------
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    
    -- Exam configuration
    status exam_status NOT NULL DEFAULT 'draft',
    total_questions INT NOT NULL DEFAULT 0,
    total_marks INT NOT NULL DEFAULT 0,
    passing_marks INT DEFAULT 0,
    
    -- Time configuration (CRITICAL for MCQ timer)
    time_per_question_seconds INT NOT NULL DEFAULT 60, -- Configurable per exam
    allow_skip_return BOOLEAN NOT NULL DEFAULT true, -- If skipped, can return with remaining time
    
    -- Anti-cheat settings
    fullscreen_required BOOLEAN NOT NULL DEFAULT true,
    auto_submit_on_blur BOOLEAN NOT NULL DEFAULT true, -- Submit when leaving window/tab
    allow_retake BOOLEAN NOT NULL DEFAULT false,
    max_retakes INT DEFAULT 0,
    
    -- Scheduling
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    duration_minutes INT, -- Optional overall duration
    
    -- Statistics
    total_submissions INT DEFAULT 0,
    average_score DECIMAL(5, 2) DEFAULT 0,
    
    -- Metadata
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exams_subject ON exams(subject_id);
CREATE INDEX idx_exams_teacher ON exams(teacher_id);
CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_exams_scheduled ON exams(scheduled_start, scheduled_end);

-- ---------------------------------------------
-- Questions Table (MCQ Only)
-- ---------------------------------------------
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    
    -- Question content
    question_text TEXT NOT NULL,
    question_image_url TEXT, -- Optional image
    
    -- MCQ Options (stored as JSONB for flexibility)
    options JSONB NOT NULL, -- Array of {id, text, image_url?}
    correct_option_id VARCHAR(10) NOT NULL, -- References option id
    
    -- Scoring
    marks INT NOT NULL DEFAULT 1,
    negative_marks DECIMAL(3, 2) DEFAULT 0, -- For negative marking
    
    -- Per-question timer override (if NULL, uses exam default)
    time_limit_seconds INT,
    
    -- Ordering
    sequence_number INT NOT NULL,
    
    -- Explanation (shown after submission)
    explanation TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_exam ON questions(exam_id);
CREATE INDEX idx_questions_sequence ON questions(exam_id, sequence_number);

-- ---------------------------------------------
-- Exam Submissions Table
-- ---------------------------------------------
CREATE TABLE exam_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    -- Submission details
    status submission_status NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    
    -- Auto-submit tracking
    auto_submit_reason VARCHAR(100), -- 'tab_blur', 'window_blur', 'time_expired', 'visibility_change'
    
    -- Scoring
    total_answered INT DEFAULT 0,
    total_correct INT DEFAULT 0,
    total_wrong INT DEFAULT 0,
    total_skipped INT DEFAULT 0,
    score DECIMAL(5, 2) DEFAULT 0,
    percentage DECIMAL(5, 2) DEFAULT 0,
    
    -- Retake tracking
    attempt_number INT NOT NULL DEFAULT 1,
    
    -- Evaluation
    evaluated_at TIMESTAMPTZ,
    evaluated_by UUID REFERENCES users(id),
    remarks TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate active submissions
    CONSTRAINT unique_active_submission UNIQUE (exam_id, student_id, attempt_number)
);

CREATE INDEX idx_submissions_exam ON exam_submissions(exam_id);
CREATE INDEX idx_submissions_student ON exam_submissions(student_id);
CREATE INDEX idx_submissions_status ON exam_submissions(status);

-- ---------------------------------------------
-- Submission Answers Table (Individual answers)
-- ---------------------------------------------
CREATE TABLE submission_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES exam_submissions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    
    -- Answer details
    selected_option_id VARCHAR(10), -- NULL if skipped
    is_correct BOOLEAN,
    marks_obtained DECIMAL(5, 2) DEFAULT 0,
    
    -- Time tracking (CRITICAL for skip-return feature)
    time_spent_seconds INT DEFAULT 0,
    time_remaining_seconds INT, -- Remaining time when skipped
    was_skipped BOOLEAN DEFAULT false,
    returned_to BOOLEAN DEFAULT false, -- Did student return to this question?
    
    -- Ordering
    answered_at TIMESTAMPTZ,
    sequence_answered INT, -- Order in which questions were answered
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_answer UNIQUE (submission_id, question_id)
);

CREATE INDEX idx_answers_submission ON submission_answers(submission_id);
CREATE INDEX idx_answers_question ON submission_answers(question_id);

-- ---------------------------------------------
-- Assets Table (Subject materials)
-- ---------------------------------------------
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    
    -- Asset details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    asset_type asset_type NOT NULL DEFAULT 'document',
    
    -- File/URL
    file_url TEXT,
    file_name VARCHAR(255),
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    external_url TEXT, -- For link type
    
    -- Display
    thumbnail_url TEXT,
    sequence_number INT DEFAULT 0,
    
    -- Settings
    is_published BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assets_subject ON assets(subject_id);
CREATE INDEX idx_assets_teacher ON assets(teacher_id);

-- ---------------------------------------------
-- Asset Comments Table
-- ---------------------------------------------
CREATE TABLE asset_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES asset_comments(id) ON DELETE CASCADE, -- For replies
    
    content TEXT NOT NULL,
    
    -- Moderation
    is_visible BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_asset ON asset_comments(asset_id);
CREATE INDEX idx_comments_user ON asset_comments(user_id);
CREATE INDEX idx_comments_parent ON asset_comments(parent_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
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

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON teachers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON subjects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON exams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON exam_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_answers_updated_at BEFORE UPDATE ON submission_answers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON asset_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-evaluate MCQ submission
CREATE OR REPLACE FUNCTION evaluate_submission(p_submission_id UUID)
RETURNS void AS $$
DECLARE
    v_total_correct INT := 0;
    v_total_wrong INT := 0;
    v_total_skipped INT := 0;
    v_total_score DECIMAL(5, 2) := 0;
    v_total_marks INT := 0;
    v_percentage DECIMAL(5, 2) := 0;
BEGIN
    -- Calculate statistics
    SELECT 
        COALESCE(SUM(CASE WHEN is_correct = true THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN is_correct = false AND selected_option_id IS NOT NULL THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN selected_option_id IS NULL THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(marks_obtained), 0)
    INTO v_total_correct, v_total_wrong, v_total_skipped, v_total_score
    FROM submission_answers
    WHERE submission_id = p_submission_id;
    
    -- Get total marks for the exam
    SELECT COALESCE(e.total_marks, 0) INTO v_total_marks
    FROM exam_submissions es
    JOIN exams e ON e.id = es.exam_id
    WHERE es.id = p_submission_id;
    
    -- Calculate percentage
    IF v_total_marks > 0 THEN
        v_percentage := (v_total_score / v_total_marks) * 100;
    END IF;
    
    -- Update submission
    UPDATE exam_submissions
    SET 
        total_correct = v_total_correct,
        total_wrong = v_total_wrong,
        total_skipped = v_total_skipped,
        total_answered = v_total_correct + v_total_wrong,
        score = v_total_score,
        percentage = v_percentage,
        status = 'evaluated',
        evaluated_at = NOW()
    WHERE id = p_submission_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- VIEWS
-- =============================================

-- Teacher dashboard statistics view
CREATE OR REPLACE VIEW teacher_dashboard_stats AS
SELECT 
    t.id AS teacher_id,
    t.user_id,
    COUNT(DISTINCT s.id) AS total_students,
    COUNT(DISTINCT sub.id) AS total_subjects,
    COUNT(DISTINCT e.id) AS total_exams,
    COUNT(DISTINCT CASE WHEN e.status = 'active' THEN e.id END) AS active_exams,
    COUNT(DISTINCT es.id) AS total_submissions,
    COALESCE(AVG(es.percentage), 0) AS average_student_score
FROM teachers t
LEFT JOIN students s ON s.teacher_id = t.id
LEFT JOIN subjects sub ON sub.teacher_id = t.id
LEFT JOIN exams e ON e.teacher_id = t.id
LEFT JOIN exam_submissions es ON es.exam_id = e.id AND es.status = 'evaluated'
GROUP BY t.id, t.user_id;

-- Student dashboard statistics view
CREATE OR REPLACE VIEW student_dashboard_stats AS
SELECT 
    s.id AS student_id,
    s.user_id,
    COUNT(DISTINCT se.subject_id) AS enrolled_subjects,
    COUNT(DISTINCT es.id) AS total_exams_taken,
    COALESCE(AVG(es.percentage), 0) AS average_score,
    COUNT(DISTINCT CASE WHEN e.status = 'active' AND es.id IS NULL THEN e.id END) AS pending_exams
FROM students s
LEFT JOIN subject_enrollments se ON se.student_id = s.id
LEFT JOIN exams e ON e.subject_id = se.subject_id
LEFT JOIN exam_submissions es ON es.student_id = s.id AND es.exam_id = e.id
GROUP BY s.id, s.user_id;
