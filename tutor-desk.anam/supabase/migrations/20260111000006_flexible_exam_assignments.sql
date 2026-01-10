-- @REVIEW: Migration for flexible exam assignments
-- Allows exams to be created independently and assigned to subjects/students later

-- ============================================================================
-- 1. Make subject_id nullable in exams table
-- ============================================================================
ALTER TABLE exams 
ALTER COLUMN subject_id DROP NOT NULL;

-- ============================================================================
-- 2. Create exam_assignments table for direct student assignments
-- ============================================================================
CREATE TYPE exam_assignment_status AS ENUM ('assigned', 'started', 'completed', 'expired', 'cancelled');

CREATE TABLE exam_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    -- Assignment details
    assigned_by UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Scheduling
    available_from TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    
    -- Status tracking
    status exam_assignment_status NOT NULL DEFAULT 'assigned',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Custom settings per assignment (overrides exam defaults)
    max_attempts INT DEFAULT 1,
    time_limit_minutes INT,
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT unique_exam_student UNIQUE (exam_id, student_id)
);

-- ============================================================================
-- 3. Create exam_subject_assignments for assigning exams to subjects
-- ============================================================================
CREATE TABLE exam_subject_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    
    -- Assignment details
    assigned_by UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Scheduling for this subject
    available_from TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    
    -- Whether students enrolled in this subject auto-get access
    auto_assign_students BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT unique_exam_subject UNIQUE (exam_id, subject_id)
);

-- ============================================================================
-- 4. Create indexes for performance
-- ============================================================================
CREATE INDEX idx_exam_assignments_exam_id ON exam_assignments(exam_id);
CREATE INDEX idx_exam_assignments_student_id ON exam_assignments(student_id);
CREATE INDEX idx_exam_assignments_status ON exam_assignments(status);
CREATE INDEX idx_exam_assignments_due_date ON exam_assignments(due_date);
CREATE INDEX idx_exam_subject_assignments_exam_id ON exam_subject_assignments(exam_id);
CREATE INDEX idx_exam_subject_assignments_subject_id ON exam_subject_assignments(subject_id);

-- ============================================================================
-- 5. Add updated_at trigger for new tables
-- ============================================================================
CREATE TRIGGER update_exam_assignments_updated_at
    BEFORE UPDATE ON exam_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_subject_assignments_updated_at
    BEFORE UPDATE ON exam_subject_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. Disable RLS for new tables (matching existing pattern)
-- ============================================================================
ALTER TABLE exam_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_subject_assignments DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. Create helper view for student's available exams
-- ============================================================================
CREATE OR REPLACE VIEW student_available_exams AS
SELECT DISTINCT
    e.id AS exam_id,
    e.title,
    e.description,
    e.status AS exam_status,
    e.total_questions,
    e.total_marks,
    e.time_per_question_seconds,
    e.teacher_id,
    -- From direct assignment
    ea.student_id,
    ea.status AS assignment_status,
    ea.available_from,
    ea.due_date,
    ea.max_attempts,
    ea.assigned_at,
    'direct' AS assignment_type
FROM exams e
INNER JOIN exam_assignments ea ON e.id = ea.exam_id
WHERE ea.status != 'cancelled'

UNION ALL

-- From subject assignment (for enrolled students)
SELECT DISTINCT
    e.id AS exam_id,
    e.title,
    e.description,
    e.status AS exam_status,
    e.total_questions,
    e.total_marks,
    e.time_per_question_seconds,
    e.teacher_id,
    se.student_id,
    'assigned'::exam_assignment_status AS assignment_status,
    esa.available_from,
    esa.due_date,
    1 AS max_attempts,
    esa.assigned_at,
    'subject' AS assignment_type
FROM exams e
INNER JOIN exam_subject_assignments esa ON e.id = esa.exam_id
INNER JOIN subject_enrollments se ON esa.subject_id = se.subject_id
WHERE esa.auto_assign_students = true;

-- ============================================================================
-- 8. Grant permissions
-- ============================================================================
GRANT ALL ON exam_assignments TO authenticated;
GRANT ALL ON exam_subject_assignments TO authenticated;
GRANT SELECT ON student_available_exams TO authenticated;
GRANT USAGE ON TYPE exam_assignment_status TO authenticated;
