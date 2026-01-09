-- =============================================
-- TUTOR DESK - Seed Data
-- Description: Initial data for fresh deployment
-- =============================================

-- =============================================
-- SUPER ADMIN (Hardcoded credentials)
-- Email: admin@tutordesk.com
-- Password: SuperAdmin@123 (hashed with bcrypt)
-- =============================================

-- Note: Password hash is for 'SuperAdmin@123' using bcrypt
-- In production, generate a new hash using: 
-- SELECT crypt('YourPassword', gen_salt('bf', 12));

INSERT INTO users (
    id,
    email,
    password_hash,
    full_name,
    role,
    status,
    auth_provider,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@tutordesk.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4DkMfU.ZdNFKIKHi', -- SuperAdmin@123
    'Super Administrator',
    'super_admin',
    'active',
    'email',
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- =============================================
-- DEMO DATA (Optional - for development)
-- Uncomment below for demo data
-- =============================================

/*
-- Demo Teacher (pending approval)
INSERT INTO users (
    id,
    email,
    full_name,
    role,
    status,
    auth_provider,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    'teacher@demo.com',
    'Demo Teacher',
    'teacher',
    'pending',
    'google',
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Demo Teacher profile
INSERT INTO teachers (
    id,
    user_id,
    qualification,
    specialization,
    bio,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000002',
    'M.Sc. Mathematics',
    'Mathematics & Physics',
    'Experienced teacher with 10+ years of teaching mathematics and physics.',
    NOW(),
    NOW()
) ON CONFLICT (user_id) DO NOTHING;

-- Demo Subject
INSERT INTO subjects (
    id,
    teacher_id,
    name,
    description,
    code,
    color,
    icon,
    is_active,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000102',
    'Mathematics',
    'Basic mathematics including algebra, geometry, and calculus.',
    'MATH101',
    '#4CAF50',
    'pi-calculator',
    true,
    NOW(),
    NOW()
) ON CONFLICT (teacher_id, code) DO NOTHING;

-- Demo Exam
INSERT INTO exams (
    id,
    subject_id,
    teacher_id,
    title,
    description,
    instructions,
    status,
    total_questions,
    total_marks,
    passing_marks,
    time_per_question_seconds,
    allow_skip_return,
    fullscreen_required,
    auto_submit_on_blur,
    allow_retake,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000102',
    'Chapter 1: Algebra Basics',
    'Test your knowledge of basic algebraic expressions and equations.',
    '1. Each question has 60 seconds time limit.\n2. You can skip and return to questions with remaining time.\n3. Do not switch tabs or minimize the browser.\n4. Exam will auto-submit if you leave the window.',
    'draft',
    5,
    10,
    6,
    60,
    true,
    true,
    true,
    false,
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;

-- Demo Questions
INSERT INTO questions (exam_id, question_text, options, correct_option_id, marks, sequence_number) VALUES
(
    '00000000-0000-0000-0000-000000000301',
    'What is the value of x in the equation: 2x + 5 = 15?',
    '[{"id": "a", "text": "3"}, {"id": "b", "text": "5"}, {"id": "c", "text": "7"}, {"id": "d", "text": "10"}]',
    'b',
    2,
    1
),
(
    '00000000-0000-0000-0000-000000000301',
    'Simplify: 3(x + 2) - 2(x - 1)',
    '[{"id": "a", "text": "x + 4"}, {"id": "b", "text": "x + 8"}, {"id": "c", "text": "5x + 4"}, {"id": "d", "text": "x + 6"}]',
    'b',
    2,
    2
),
(
    '00000000-0000-0000-0000-000000000301',
    'What is the product of (x + 3)(x - 3)?',
    '[{"id": "a", "text": "x² - 9"}, {"id": "b", "text": "x² + 9"}, {"id": "c", "text": "x² - 6"}, {"id": "d", "text": "2x"}]',
    'a',
    2,
    3
),
(
    '00000000-0000-0000-0000-000000000301',
    'Solve for y: y/4 = 8',
    '[{"id": "a", "text": "2"}, {"id": "b", "text": "12"}, {"id": "c", "text": "32"}, {"id": "d", "text": "4"}]',
    'c',
    2,
    4
),
(
    '00000000-0000-0000-0000-000000000301',
    'If a = 3 and b = 4, what is a² + b²?',
    '[{"id": "a", "text": "7"}, {"id": "b", "text": "12"}, {"id": "c", "text": "25"}, {"id": "d", "text": "49"}]',
    'c',
    2,
    5
);

-- Update exam total_questions count
UPDATE exams SET total_questions = 5 WHERE id = '00000000-0000-0000-0000-000000000301';
*/
