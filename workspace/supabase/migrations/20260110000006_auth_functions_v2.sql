-- =============================================
-- TUTOR DESK - Auth Helper Functions v2
-- Just creates functions, no table modifications
-- =============================================

-- Drop existing functions to recreate them
DROP FUNCTION IF EXISTS check_rate_limit(VARCHAR, INET, VARCHAR);
DROP FUNCTION IF EXISTS record_login_attempt(VARCHAR, INET, BOOLEAN, VARCHAR, TEXT, VARCHAR);
DROP FUNCTION IF EXISTS cleanup_expired_tokens();

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Rate limit check - adapted to work with existing table structure
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_action_type VARCHAR(100),
    p_ip_address INET,
    p_email VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
    is_limited BOOLEAN,
    remaining_attempts INT,
    retry_after_seconds INT
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
        WHERE (rl.action_type = p_action_type OR rl.limit_type = p_action_type)
          AND COALESCE(rl.is_active, true) = true
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        -- Use defaults if table structure doesn't match
        v_max_attempts := 5;
        v_window_seconds := 900;
    END;
    
    v_window_start := NOW() - (v_window_seconds || ' seconds')::INTERVAL;
    
    -- Count failed attempts
    SELECT COUNT(*) INTO v_attempt_count
    FROM login_attempts
    WHERE ip_address = p_ip_address
      AND (p_email IS NULL OR email = p_email)
      AND attempted_at > v_window_start
      AND NOT success;
    
    IF v_attempt_count >= v_max_attempts THEN
        RETURN QUERY SELECT 
            true::BOOLEAN,
            0::INT,
            GREATEST(0, EXTRACT(EPOCH FROM (v_window_start + (v_window_seconds || ' seconds')::INTERVAL - NOW()))::INT)::INT;
    ELSE
        RETURN QUERY SELECT 
            false::BOOLEAN,
            (v_max_attempts - v_attempt_count)::INT,
            0::INT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record login attempt
CREATE OR REPLACE FUNCTION record_login_attempt(
    p_email VARCHAR(255),
    p_ip_address INET,
    p_success BOOLEAN,
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
        p_ip_address,
        p_success,
        p_failure_reason,
        p_user_agent,
        p_device_fingerprint,
        NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM refresh_tokens WHERE expires_at < NOW();
    DELETE FROM password_reset_tokens WHERE expires_at < NOW();
    DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to service_role
GRANT EXECUTE ON FUNCTION check_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION record_login_attempt TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_tokens TO service_role;
