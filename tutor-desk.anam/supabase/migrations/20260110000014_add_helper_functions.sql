-- =============================================
-- TUTOR DESK - Add Missing Helper Functions
-- =============================================

-- revoke_all_user_tokens - Called by Edge Function for security
CREATE OR REPLACE FUNCTION revoke_all_user_tokens(
    p_user_id UUID,
    p_reason TEXT DEFAULT 'manual'
)
RETURNS void AS $$
BEGIN
    UPDATE refresh_tokens
    SET is_revoked = true,
        revoked_at = NOW(),
        revoked_reason = p_reason
    WHERE user_id = p_user_id
      AND is_revoked = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- update_teacher_stats - Called when student is created
CREATE OR REPLACE FUNCTION update_teacher_stats(p_teacher_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE teachers
    SET total_students = (SELECT COUNT(*) FROM students WHERE teacher_id = p_teacher_id),
        total_subjects = (SELECT COUNT(*) FROM subjects WHERE teacher_id = p_teacher_id),
        total_exams = (SELECT COUNT(*) FROM exams WHERE teacher_id = p_teacher_id),
        updated_at = NOW()
    WHERE id = p_teacher_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION revoke_all_user_tokens(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_teacher_stats(UUID) TO anon, authenticated, service_role;
