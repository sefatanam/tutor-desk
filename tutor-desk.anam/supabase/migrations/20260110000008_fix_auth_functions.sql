-- =============================================
-- TUTOR DESK - Fix Auth Functions to Match Edge Function
-- The Edge Function expects specific parameter names
-- =============================================

-- Drop existing functions
DROP FUNCTION IF EXISTS check_rate_limit(VARCHAR, INET, VARCHAR);
DROP FUNCTION IF EXISTS record_login_attempt(VARCHAR, INET, BOOLEAN, VARCHAR, TEXT, VARCHAR);
DROP FUNCTION IF EXISTS revoke_all_user_tokens(UUID, VARCHAR);
DROP FUNCTION IF EXISTS update_teacher_stats(UUID);

-- =============================================
-- check_rate_limit - Match Edge Function signature
-- Edge Function calls: rpc('check_rate_limit', { p_limit_type, p_identifier, p_ip_address })
-- =============================================
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_limit_type VARCHAR(100),
    p_identifier VARCHAR(255),
    p_ip_address VARCHAR(50)
)
RETURNS TABLE (
    allowed BOOLEAN,
    wait_seconds INT,
    attempts_remaining INT
) AS $$
DECLARE
    v_max_attempts INT := 5;
    v_window_seconds INT := 900;
    v_attempt_count INT;
    v_window_start TIMESTAMPTZ;
BEGIN
    -- Try to get config from rate_limits table
    BEGIN
        SELECT COALESCE(rl.max_attempts, 5), COALESCE(rl.window_seconds, 900)
        INTO v_max_attempts, v_window_seconds
        FROM rate_limits rl
        WHERE rl.limit_type = p_limit_type
          AND COALESCE(rl.is_active, true) = true
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_max_attempts := 5;
        v_window_seconds := 900;
    END;
    
    v_window_start := NOW() - (v_window_seconds || ' seconds')::INTERVAL;
    
    -- Count failed attempts for this identifier or IP
    SELECT COUNT(*) INTO v_attempt_count
    FROM login_attempts
    WHERE (email = p_identifier OR ip_address::TEXT = p_ip_address)
      AND attempted_at > v_window_start
      AND NOT success;
    
    IF v_attempt_count >= v_max_attempts THEN
        RETURN QUERY SELECT 
            false::BOOLEAN,
            GREATEST(0, EXTRACT(EPOCH FROM (v_window_start + (v_window_seconds || ' seconds')::INTERVAL - NOW()))::INT)::INT,
            0::INT;
    ELSE
        RETURN QUERY SELECT 
            true::BOOLEAN,
            0::INT,
            (v_max_attempts - v_attempt_count)::INT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- record_login_attempt - Match Edge Function signature
-- Edge Function calls: rpc('record_login_attempt', { p_email, p_ip_address, p_was_successful, p_failure_reason, p_user_agent, p_device_fingerprint })
-- =============================================
CREATE OR REPLACE FUNCTION record_login_attempt(
    p_email VARCHAR(255),
    p_ip_address VARCHAR(50),
    p_was_successful BOOLEAN,
    p_failure_reason VARCHAR(100) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_device_fingerprint VARCHAR(255) DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO login_attempts (
        email,
        ip_address,
        success,
        failure_reason,
        user_agent,
        device_fingerprint,
        attempted_at
    ) VALUES (
        p_email,
        p_ip_address::INET,
        p_was_successful,
        p_failure_reason,
        p_user_agent,
        p_device_fingerprint,
        NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- revoke_all_user_tokens - Called by Edge Function
-- =============================================
CREATE OR REPLACE FUNCTION revoke_all_user_tokens(
    p_user_id UUID,
    p_reason VARCHAR(100) DEFAULT 'manual'
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

-- =============================================
-- update_teacher_stats - Called by Edge Function
-- =============================================
CREATE OR REPLACE FUNCTION update_teacher_stats(p_teacher_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE teachers
    SET total_students = (
            SELECT COUNT(*) FROM students WHERE teacher_id = p_teacher_id
        ),
        total_subjects = (
            SELECT COUNT(*) FROM subjects WHERE teacher_id = p_teacher_id
        ),
        total_exams = (
            SELECT COUNT(*) FROM exams WHERE teacher_id = p_teacher_id
        ),
        updated_at = NOW()
    WHERE id = p_teacher_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_rate_limit(VARCHAR, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION record_login_attempt(VARCHAR, VARCHAR, BOOLEAN, VARCHAR, TEXT, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION revoke_all_user_tokens(UUID, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION update_teacher_stats(UUID) TO service_role;
