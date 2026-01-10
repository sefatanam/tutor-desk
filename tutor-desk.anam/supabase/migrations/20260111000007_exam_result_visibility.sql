-- @REVIEW: Add result visibility settings to exams table
-- This migration adds columns to control when and what students can see in their results

-- Add result visibility columns
ALTER TABLE exams
ADD COLUMN IF NOT EXISTS result_visibility TEXT NOT NULL DEFAULT 'immediate',
ADD COLUMN IF NOT EXISTS result_release_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_result_released BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS show_score BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_percentage BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_pass_fail BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_correct_answers BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_student_answers BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_explanations BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_question_review BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_time_spent BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_teacher_remarks BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_rank BOOLEAN NOT NULL DEFAULT FALSE;

-- Add constraint for result_visibility enum values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'result_visibility_check'
  ) THEN
    ALTER TABLE exams 
    ADD CONSTRAINT result_visibility_check 
    CHECK (result_visibility IN ('immediate', 'after_due_date', 'manual_release', 'never'));
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN exams.result_visibility IS 'When students can view results: immediate (right after submission), after_due_date (after scheduled_end), manual_release (teacher controls), never (no access)';
COMMENT ON COLUMN exams.result_release_date IS 'For manual_release mode: optional scheduled date to auto-release results';
COMMENT ON COLUMN exams.is_result_released IS 'For manual_release mode: teacher sets this to true to release results';
COMMENT ON COLUMN exams.show_score IS 'Whether students can see their score (marks obtained)';
COMMENT ON COLUMN exams.show_percentage IS 'Whether students can see their percentage';
COMMENT ON COLUMN exams.show_pass_fail IS 'Whether students can see pass/fail status';
COMMENT ON COLUMN exams.show_correct_answers IS 'Whether students can see the correct answers';
COMMENT ON COLUMN exams.show_student_answers IS 'Whether students can see their selected answers';
COMMENT ON COLUMN exams.show_explanations IS 'Whether students can see question explanations';
COMMENT ON COLUMN exams.show_question_review IS 'Whether students can review questions one by one';
COMMENT ON COLUMN exams.show_time_spent IS 'Whether students can see time spent per question';
COMMENT ON COLUMN exams.show_teacher_remarks IS 'Whether students can see teacher remarks';
COMMENT ON COLUMN exams.show_rank IS 'Whether students can see their rank among all students';
