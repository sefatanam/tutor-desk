-- @REVIEW: Add exam style/mode settings to exams table
-- This migration adds columns to control different exam-taking experiences

-- Add exam style columns
ALTER TABLE exams
ADD COLUMN IF NOT EXISTS exam_style TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS total_time_limit_minutes INT,
ADD COLUMN IF NOT EXISTS show_immediate_feedback BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS shuffle_options BOOLEAN NOT NULL DEFAULT FALSE;

-- Add constraint for exam_style enum values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_style_check'
  ) THEN
    ALTER TABLE exams 
    ADD CONSTRAINT exam_style_check 
    CHECK (exam_style IN ('standard', 'free_navigation', 'practice', 'quiz', 'section_based'));
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN exams.exam_style IS 'Exam mode: standard (per-question timer), free_navigation (total time), practice (no timer), quiz (sequential), section_based (per-section timer)';
COMMENT ON COLUMN exams.total_time_limit_minutes IS 'For free_navigation and practice modes: total time limit for the entire exam (NULL means no limit)';
COMMENT ON COLUMN exams.show_immediate_feedback IS 'Whether to show correct/incorrect feedback immediately after answering (for practice and quiz modes)';
COMMENT ON COLUMN exams.shuffle_questions IS 'Whether to randomize question order for each student';
COMMENT ON COLUMN exams.shuffle_options IS 'Whether to randomize option order within each question';
