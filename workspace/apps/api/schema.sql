-- =============================================
-- TUTOR DESK - Consolidated Database Schema
-- Generated from 25 Supabase migrations
-- Single source of truth for the Go backend
--
-- RLS is DISABLED on all data tables.
-- Security is enforced at the application layer
-- via JWT validation and query-level filtering.
-- =============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================

CREATE TYPE user_role AS ENUM ('super_admin', 'teacher', 'student');
CREATE TYPE user_status AS ENUM ('pending', 'active', 'disabled', 'suspended');
CREATE TYPE exam_status AS ENUM ('draft', 'scheduled', 'active', 'completed', 'cancelled');
CREATE TYPE submission_status AS ENUM ('in_progress', 'submitted', 'auto_submitted', 'evaluated', 'retake_allowed');
CREATE TYPE asset_type AS ENUM ('document', 'image', 'video', 'link', 'other');
CREATE TYPE exam_assignment_status AS ENUM ('assigned', 'started', 'completed', 'expired', 'cancelled');

-- =============================================
-- FUNCTIONS (before tables that use them in triggers)
-- =============================================

-- Generic updated_at updater
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TABLES
-- =============================================

-- ---------------------------------------------
-- Users
-- ---------------------------------------------
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name     VARCHAR(255) NOT NULL,
    avatar_url    TEXT,
    user_role     user_role NOT NULL DEFAULT 'student',
    status        user_status NOT NULL DEFAULT 'pending',
    phone         VARCHAR(20),
    auth_provider    VARCHAR(50) DEFAULT 'email',
    auth_provider_id VARCHAR(255),
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    UUID REFERENCES users(id),
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email  ON users(email);
CREATE INDEX idx_users_role   ON users(user_role);
CREATE INDEX idx_users_status ON users(status);

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS disabled (security enforced at app layer)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Teachers
-- ---------------------------------------------
CREATE TABLE teachers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    qualification   VARCHAR(255),
    specialization  VARCHAR(255),
    bio             TEXT,
    status          VARCHAR(50) NOT NULL DEFAULT 'pending',
    allow_student_comments          BOOLEAN DEFAULT true,
    show_exam_results_immediately   BOOLEAN DEFAULT true,
    total_students  INT DEFAULT 0,
    total_subjects  INT DEFAULT 0,
    total_exams     INT DEFAULT 0,
    approved_at     TIMESTAMPTZ,
    approved_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teachers_user_id ON teachers(user_id);

CREATE TRIGGER update_teachers_updated_at
    BEFORE UPDATE ON teachers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE teachers DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Students
-- ---------------------------------------------
CREATE TABLE students (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    teacher_id      UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    roll_number     VARCHAR(50),
    class_name      VARCHAR(100),
    section         VARCHAR(50),
    guardian_name   VARCHAR(255),
    guardian_phone  VARCHAR(20),
    address         TEXT,
    date_of_birth   DATE,
    total_exams_taken INT DEFAULT 0,
    average_score     DECIMAL(5,2) DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_user_id    ON students(user_id);
CREATE INDEX idx_students_teacher_id ON students(teacher_id);

CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE students DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Subjects
-- ---------------------------------------------
CREATE TABLE subjects (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id   UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    description  TEXT,
    code         VARCHAR(50),
    color        VARCHAR(7) DEFAULT '#4CAF50',
    icon         VARCHAR(100) DEFAULT 'pi-book',
    is_active    BOOLEAN DEFAULT true,
    total_students INT DEFAULT 0,
    total_exams    INT DEFAULT 0,
    total_assets   INT DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_subject_code_per_teacher UNIQUE (teacher_id, code)
);

CREATE INDEX idx_subjects_teacher_id ON subjects(teacher_id);

CREATE TRIGGER update_subjects_updated_at
    BEFORE UPDATE ON subjects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE subjects DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Subject Enrollments
-- ---------------------------------------------
CREATE TABLE subject_enrollments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id  UUID NOT NULL REFERENCES subjects(id)  ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    enrolled_by UUID REFERENCES users(id),
    CONSTRAINT unique_enrollment UNIQUE (student_id, subject_id)
);

CREATE INDEX idx_enrollments_student ON subject_enrollments(student_id);
CREATE INDEX idx_enrollments_subject ON subject_enrollments(subject_id);

ALTER TABLE subject_enrollments DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Exams
-- (includes columns from migrations 006, 007, 008)
-- ---------------------------------------------
CREATE TABLE exams (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id  UUID REFERENCES subjects(id) ON DELETE CASCADE,  -- nullable (migration 006)
    teacher_id  UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,

    -- Status & basic config
    status               exam_status NOT NULL DEFAULT 'draft',
    total_questions      INT NOT NULL DEFAULT 0,
    total_marks          INT NOT NULL DEFAULT 0,
    passing_marks        INT DEFAULT 0,

    -- Per-question timer (standard mode)
    time_per_question_seconds INT NOT NULL DEFAULT 60,
    allow_skip_return         BOOLEAN NOT NULL DEFAULT true,

    -- Anti-cheat
    fullscreen_required   BOOLEAN NOT NULL DEFAULT true,
    auto_submit_on_blur   BOOLEAN NOT NULL DEFAULT true,
    allow_retake          BOOLEAN NOT NULL DEFAULT false,
    max_retakes           INT DEFAULT 0,

    -- Scheduling
    scheduled_start    TIMESTAMPTZ,
    scheduled_end      TIMESTAMPTZ,
    duration_minutes   INT,

    -- Result visibility (migration 007)
    result_visibility    TEXT NOT NULL DEFAULT 'immediate'
        CONSTRAINT result_visibility_check
        CHECK (result_visibility IN ('immediate', 'after_due_date', 'manual_release', 'never')),
    result_release_date  TIMESTAMPTZ,
    is_result_released   BOOLEAN NOT NULL DEFAULT false,
    show_score           BOOLEAN NOT NULL DEFAULT true,
    show_percentage      BOOLEAN NOT NULL DEFAULT true,
    show_pass_fail       BOOLEAN NOT NULL DEFAULT true,
    show_correct_answers BOOLEAN NOT NULL DEFAULT true,
    show_student_answers BOOLEAN NOT NULL DEFAULT true,
    show_explanations    BOOLEAN NOT NULL DEFAULT true,
    show_question_review BOOLEAN NOT NULL DEFAULT true,
    show_time_spent      BOOLEAN NOT NULL DEFAULT true,
    show_teacher_remarks BOOLEAN NOT NULL DEFAULT true,
    show_rank            BOOLEAN NOT NULL DEFAULT false,

    -- Exam style/mode (migration 008)
    exam_style           TEXT NOT NULL DEFAULT 'standard'
        CONSTRAINT exam_style_check
        CHECK (exam_style IN ('standard', 'free_navigation', 'practice', 'quiz', 'section_based')),
    total_time_limit_minutes INT,
    show_immediate_feedback  BOOLEAN NOT NULL DEFAULT false,
    shuffle_questions        BOOLEAN NOT NULL DEFAULT false,
    shuffle_options          BOOLEAN NOT NULL DEFAULT false,

    -- Stats
    total_submissions INT DEFAULT 0,
    average_score     DECIMAL(5,2) DEFAULT 0,

    -- Metadata
    published_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exams_subject   ON exams(subject_id);
CREATE INDEX idx_exams_teacher   ON exams(teacher_id);
CREATE INDEX idx_exams_status    ON exams(status);
CREATE INDEX idx_exams_scheduled ON exams(scheduled_start, scheduled_end);

CREATE TRIGGER update_exams_updated_at
    BEFORE UPDATE ON exams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE exams DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Exam Assignments (direct student assignment) — migration 006
-- ---------------------------------------------
CREATE TABLE exam_assignments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id       UUID NOT NULL REFERENCES exams(id)    ON DELETE CASCADE,
    student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    assigned_by   UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    available_from TIMESTAMPTZ,
    due_date       TIMESTAMPTZ,
    status         exam_assignment_status NOT NULL DEFAULT 'assigned',
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    max_attempts   INT DEFAULT 1,
    time_limit_minutes INT,
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_exam_student UNIQUE (exam_id, student_id)
);

CREATE INDEX idx_exam_assignments_exam_id    ON exam_assignments(exam_id);
CREATE INDEX idx_exam_assignments_student_id ON exam_assignments(student_id);
CREATE INDEX idx_exam_assignments_status     ON exam_assignments(status);
CREATE INDEX idx_exam_assignments_due_date   ON exam_assignments(due_date);

CREATE TRIGGER update_exam_assignments_updated_at
    BEFORE UPDATE ON exam_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE exam_assignments DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Exam Subject Assignments — migration 006
-- ---------------------------------------------
CREATE TABLE exam_subject_assignments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id        UUID NOT NULL REFERENCES exams(id)    ON DELETE CASCADE,
    subject_id     UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    assigned_by    UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    available_from TIMESTAMPTZ,
    due_date       TIMESTAMPTZ,
    auto_assign_students BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_exam_subject UNIQUE (exam_id, subject_id)
);

CREATE INDEX idx_exam_subject_assignments_exam_id     ON exam_subject_assignments(exam_id);
CREATE INDEX idx_exam_subject_assignments_subject_id  ON exam_subject_assignments(subject_id);

CREATE TRIGGER update_exam_subject_assignments_updated_at
    BEFORE UPDATE ON exam_subject_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE exam_subject_assignments DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Questions (MCQ)
-- ---------------------------------------------
CREATE TABLE questions (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id           UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question_text     TEXT NOT NULL,
    question_image_url TEXT,
    options           JSONB NOT NULL,
    correct_option_id VARCHAR(10) NOT NULL,
    marks             INT NOT NULL DEFAULT 1,
    negative_marks    DECIMAL(3,2) DEFAULT 0,
    time_limit_seconds INT,
    sequence_number   INT NOT NULL,
    explanation       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_exam      ON questions(exam_id);
CREATE INDEX idx_questions_sequence  ON questions(exam_id, sequence_number);

CREATE TRIGGER update_questions_updated_at
    BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE questions DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Exam Submissions
-- ---------------------------------------------
CREATE TABLE exam_submissions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id       UUID NOT NULL REFERENCES exams(id)    ON DELETE CASCADE,
    student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status        submission_status NOT NULL DEFAULT 'in_progress',
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at  TIMESTAMPTZ,
    auto_submit_reason VARCHAR(100),
    total_answered INT DEFAULT 0,
    total_correct  INT DEFAULT 0,
    total_wrong    INT DEFAULT 0,
    total_skipped  INT DEFAULT 0,
    score          DECIMAL(5,2) DEFAULT 0,
    percentage     DECIMAL(5,2) DEFAULT 0,
    attempt_number INT NOT NULL DEFAULT 1,
    evaluated_at   TIMESTAMPTZ,
    evaluated_by   UUID REFERENCES users(id),
    remarks        TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_active_submission UNIQUE (exam_id, student_id, attempt_number)
);

CREATE INDEX idx_submissions_exam    ON exam_submissions(exam_id);
CREATE INDEX idx_submissions_student ON exam_submissions(student_id);
CREATE INDEX idx_submissions_status  ON exam_submissions(status);

CREATE TRIGGER update_submissions_updated_at
    BEFORE UPDATE ON exam_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE exam_submissions DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Submission Answers
-- ---------------------------------------------
CREATE TABLE submission_answers (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id        UUID NOT NULL REFERENCES exam_submissions(id) ON DELETE CASCADE,
    question_id          UUID NOT NULL REFERENCES questions(id)        ON DELETE CASCADE,
    selected_option_id   VARCHAR(10),
    is_correct           BOOLEAN,
    marks_obtained       DECIMAL(5,2) DEFAULT 0,
    time_spent_seconds   INT DEFAULT 0,
    time_remaining_seconds INT,
    was_skipped          BOOLEAN DEFAULT false,
    returned_to          BOOLEAN DEFAULT false,
    answered_at          TIMESTAMPTZ,
    sequence_answered    INT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_answer UNIQUE (submission_id, question_id)
);

CREATE INDEX idx_answers_submission ON submission_answers(submission_id);
CREATE INDEX idx_answers_question   ON submission_answers(question_id);

CREATE TRIGGER update_answers_updated_at
    BEFORE UPDATE ON submission_answers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE submission_answers DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Assets (Subject materials)
-- ---------------------------------------------
CREATE TABLE assets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id      UUID NOT NULL REFERENCES subjects(id)  ON DELETE CASCADE,
    teacher_id      UUID NOT NULL REFERENCES teachers(id)  ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    asset_type      asset_type NOT NULL DEFAULT 'document',
    file_url        TEXT,
    file_name       VARCHAR(255),
    file_size_bytes BIGINT,
    mime_type       VARCHAR(100),
    external_url    TEXT,
    thumbnail_url   TEXT,
    sequence_number INT DEFAULT 0,
    is_published    BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assets_subject ON assets(subject_id);
CREATE INDEX idx_assets_teacher ON assets(teacher_id);

CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE assets DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Asset Comments
-- ---------------------------------------------
CREATE TABLE asset_comments (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id   UUID NOT NULL REFERENCES assets(id)        ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    parent_id  UUID REFERENCES asset_comments(id)         ON DELETE CASCADE,
    content    TEXT NOT NULL,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_asset  ON asset_comments(asset_id);
CREATE INDEX idx_comments_user   ON asset_comments(user_id);
CREATE INDEX idx_comments_parent ON asset_comments(parent_id);

CREATE TRIGGER update_comments_updated_at
    BEFORE UPDATE ON asset_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE asset_comments DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Auth Security Tables (RLS ENABLED)
-- ---------------------------------------------

CREATE TABLE refresh_tokens (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash         VARCHAR(255) NOT NULL UNIQUE,
    device_fingerprint VARCHAR(255),
    user_agent         TEXT,
    ip_address         INET,
    expires_at         TIMESTAMPTZ NOT NULL,
    is_revoked         BOOLEAN DEFAULT false,
    revoked_at         TIMESTAMPTZ,
    revoked_reason     VARCHAR(100),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user    ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash    ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

CREATE TABLE login_attempts (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email              VARCHAR(255),
    ip_address         INET NOT NULL,
    success            BOOLEAN NOT NULL DEFAULT false,
    failure_reason     VARCHAR(100),
    user_agent         TEXT,
    device_fingerprint VARCHAR(255),
    attempted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_login_attempts_ip    ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_time  ON login_attempts(attempted_at);

CREATE TABLE rate_limits (
    id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type               VARCHAR(100) NOT NULL,
    max_attempts              INT NOT NULL DEFAULT 5,
    window_seconds            INT NOT NULL DEFAULT 900,
    lockout_duration_seconds  INT DEFAULT 1800,
    scope                     VARCHAR(50) NOT NULL DEFAULT 'ip',
    is_active                 BOOLEAN DEFAULT true,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_rate_limit_action UNIQUE (action_type, scope)
);

CREATE TRIGGER update_rate_limits_updated_at
    BEFORE UPDATE ON rate_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE password_reset_tokens (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_user    ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_hash    ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at);

-- ---------------------------------------------
-- Settings (migration 009)
-- ---------------------------------------------

CREATE TABLE settings_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    label       VARCHAR(100) NOT NULL,
    icon        VARCHAR(50) DEFAULT 'pi-cog',
    description TEXT,
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_sort ON settings_categories(sort_order);

CREATE TRIGGER settings_categories_updated_at
    BEFORE UPDATE ON settings_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE system_settings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id   UUID NOT NULL REFERENCES settings_categories(id) ON DELETE CASCADE,
    key           VARCHAR(200) NOT NULL UNIQUE,
    label         VARCHAR(200) NOT NULL,
    value         TEXT,
    value_type    VARCHAR(50) DEFAULT 'text',
    options       JSONB,
    default_value TEXT,
    description   TEXT,
    is_required   BOOLEAN DEFAULT false,
    sort_order    INT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT value_type_check CHECK (value_type IN ('text', 'number', 'boolean', 'color', 'url', 'textarea', 'select', 'json'))
);

CREATE INDEX idx_settings_category ON system_settings(category_id);
CREATE INDEX idx_settings_key      ON system_settings(key);
CREATE INDEX idx_settings_sort     ON system_settings(category_id, sort_order);

CREATE TRIGGER system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- BUSINESS LOGIC FUNCTIONS
-- =============================================

-- Auto-evaluate MCQ submission
CREATE OR REPLACE FUNCTION evaluate_submission(p_submission_id UUID)
RETURNS void AS $$
DECLARE
    v_total_correct INT := 0;
    v_total_wrong   INT := 0;
    v_total_skipped INT := 0;
    v_total_score   DECIMAL(5,2) := 0;
    v_total_marks   INT := 0;
    v_percentage    DECIMAL(5,2) := 0;
BEGIN
    SELECT
        COALESCE(SUM(CASE WHEN is_correct = true THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN is_correct = false AND selected_option_id IS NOT NULL THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN selected_option_id IS NULL THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(marks_obtained), 0)
    INTO v_total_correct, v_total_wrong, v_total_skipped, v_total_score
    FROM submission_answers
    WHERE submission_id = p_submission_id;

    SELECT COALESCE(e.total_marks, 0) INTO v_total_marks
    FROM exam_submissions es
    JOIN exams e ON e.id = es.exam_id
    WHERE es.id = p_submission_id;

    IF v_total_marks > 0 THEN
        v_percentage := (v_total_score / v_total_marks) * 100;
    END IF;

    UPDATE exam_submissions SET
        total_correct  = v_total_correct,
        total_wrong    = v_total_wrong,
        total_skipped  = v_total_skipped,
        total_answered = v_total_correct + v_total_wrong,
        score          = v_total_score,
        percentage     = v_percentage,
        status         = 'evaluated',
        evaluated_at   = NOW()
    WHERE id = p_submission_id;
END;
$$ LANGUAGE plpgsql;

-- Rate limit check
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_action_type VARCHAR(100),
    p_ip_address  INET,
    p_email       VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
    is_limited         BOOLEAN,
    remaining_attempts INT,
    retry_after_seconds INT
) AS $$
DECLARE
    v_limit         RECORD;
    v_attempt_count INT;
    v_window_start  TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_limit
    FROM rate_limits
    WHERE action_type = p_action_type AND is_active = true
    LIMIT 1;

    IF v_limit IS NULL THEN
        RETURN QUERY SELECT false, 999, 0;
        RETURN;
    END IF;

    v_window_start := NOW() - (v_limit.window_seconds || ' seconds')::INTERVAL;

    IF v_limit.scope = 'ip' THEN
        SELECT COUNT(*) INTO v_attempt_count
        FROM login_attempts
        WHERE ip_address = p_ip_address AND attempted_at > v_window_start AND NOT success;
    ELSIF v_limit.scope = 'email' AND p_email IS NOT NULL THEN
        SELECT COUNT(*) INTO v_attempt_count
        FROM login_attempts
        WHERE email = p_email AND attempted_at > v_window_start AND NOT success;
    ELSE
        SELECT COUNT(*) INTO v_attempt_count
        FROM login_attempts
        WHERE ip_address = p_ip_address
          AND (p_email IS NULL OR email = p_email)
          AND attempted_at > v_window_start AND NOT success;
    END IF;

    IF v_attempt_count >= v_limit.max_attempts THEN
        RETURN QUERY SELECT true, 0,
            GREATEST(0, EXTRACT(EPOCH FROM (v_window_start + (v_limit.window_seconds || ' seconds')::INTERVAL - NOW()))::INT);
    ELSE
        RETURN QUERY SELECT false, (v_limit.max_attempts - v_attempt_count)::INT, 0;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record login attempt
CREATE OR REPLACE FUNCTION record_login_attempt(
    p_email              VARCHAR(255),
    p_ip_address         INET,
    p_success            BOOLEAN,
    p_failure_reason     VARCHAR(100) DEFAULT NULL,
    p_user_agent         TEXT         DEFAULT NULL,
    p_device_fingerprint VARCHAR(255) DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO login_attempts (email, ip_address, success, failure_reason, user_agent, device_fingerprint)
    VALUES (p_email, p_ip_address, p_success, p_failure_reason, p_user_agent, p_device_fingerprint);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM refresh_tokens      WHERE expires_at < NOW();
    DELETE FROM password_reset_tokens WHERE expires_at < NOW();
    DELETE FROM login_attempts      WHERE attempted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- VIEWS
-- =============================================

CREATE OR REPLACE VIEW teacher_dashboard_stats AS
SELECT
    t.id AS teacher_id,
    t.user_id,
    COUNT(DISTINCT s.id)                                              AS total_students,
    COUNT(DISTINCT sub.id)                                            AS total_subjects,
    COUNT(DISTINCT e.id)                                              AS total_exams,
    COUNT(DISTINCT CASE WHEN e.status = 'active' THEN e.id END)      AS active_exams,
    COUNT(DISTINCT es.id)                                             AS total_submissions,
    COALESCE(AVG(es.percentage), 0)                                   AS average_student_score
FROM teachers t
LEFT JOIN students s   ON s.teacher_id  = t.id
LEFT JOIN subjects sub ON sub.teacher_id = t.id
LEFT JOIN exams e      ON e.teacher_id  = t.id
LEFT JOIN exam_submissions es ON es.exam_id = e.id AND es.status = 'evaluated'
GROUP BY t.id, t.user_id;

CREATE OR REPLACE VIEW student_dashboard_stats AS
SELECT
    s.id AS student_id,
    s.user_id,
    COUNT(DISTINCT se.subject_id)                                     AS enrolled_subjects,
    COUNT(DISTINCT es.id)                                             AS total_exams_taken,
    COALESCE(AVG(es.percentage), 0)                                   AS average_score,
    COUNT(DISTINCT CASE WHEN e.status = 'active' AND es.id IS NULL THEN e.id END) AS pending_exams
FROM students s
LEFT JOIN subject_enrollments se ON se.student_id = s.id
LEFT JOIN exams e                ON e.subject_id  = se.subject_id
LEFT JOIN exam_submissions es    ON es.student_id = s.id AND es.exam_id = e.id
GROUP BY s.id, s.user_id;

CREATE OR REPLACE VIEW student_available_exams AS
-- Direct student assignments
SELECT DISTINCT
    e.id AS exam_id,
    e.title, e.description,
    e.status AS exam_status,
    e.total_questions, e.total_marks,
    e.time_per_question_seconds, e.teacher_id,
    ea.student_id,
    ea.status AS assignment_status,
    ea.available_from, ea.due_date, ea.max_attempts, ea.assigned_at,
    'direct' AS assignment_type
FROM exams e
INNER JOIN exam_assignments ea ON e.id = ea.exam_id
WHERE ea.status != 'cancelled'

UNION ALL

-- Subject-based assignments (enrolled students)
SELECT DISTINCT
    e.id AS exam_id,
    e.title, e.description,
    e.status AS exam_status,
    e.total_questions, e.total_marks,
    e.time_per_question_seconds, e.teacher_id,
    se.student_id,
    'assigned'::exam_assignment_status AS assignment_status,
    esa.available_from, esa.due_date, 1 AS max_attempts, esa.assigned_at,
    'subject' AS assignment_type
FROM exams e
INNER JOIN exam_subject_assignments esa ON e.id = esa.exam_id
INNER JOIN subject_enrollments se       ON esa.subject_id = se.subject_id
WHERE esa.auto_assign_students = true;

-- =============================================
-- BILLING
-- =============================================

-- billing_plans: defines the available subscription tiers
CREATE TABLE billing_plans (
    id           SERIAL PRIMARY KEY,
    name         TEXT    NOT NULL UNIQUE,  -- 'starter', 'pro', 'school'
    display_name TEXT    NOT NULL,
    price_bdt    INTEGER NOT NULL,         -- monthly price in BDT (0 = free)
    max_subjects INTEGER,                  -- NULL = unlimited
    max_exams    INTEGER,                  -- NULL = unlimited
    max_students INTEGER,                  -- NULL = unlimited
    can_export   BOOLEAN NOT NULL DEFAULT FALSE,
    seat_count   INTEGER NOT NULL DEFAULT 1,
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- subscriptions: one active subscription per teacher
CREATE TABLE subscriptions (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id              INTEGER NOT NULL REFERENCES billing_plans(id),
    status               TEXT NOT NULL DEFAULT 'active', -- active, cancelled, expired
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end   TIMESTAMPTZ NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (teacher_id)
);

-- payment_transactions: bKash payment audit log
CREATE TABLE payment_transactions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id       UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id          INTEGER NOT NULL REFERENCES billing_plans(id),
    bkash_payment_id TEXT    NOT NULL UNIQUE,
    trx_id           TEXT,            -- set after successful execute
    amount_bdt       INTEGER NOT NULL,
    status           TEXT    NOT NULL DEFAULT 'pending', -- pending, completed, failed, cancelled
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
