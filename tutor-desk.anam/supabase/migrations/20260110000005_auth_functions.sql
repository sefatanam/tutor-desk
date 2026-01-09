-- =============================================
-- TUTOR DESK - Auth Helper Functions Only
-- Creates/replaces functions needed by Edge Function
-- =============================================

-- First, let's check and fix the rate_limits table if needed
DO $$
BEGIN
    -- Add action_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rate_limits' AND column_name = 'action_type') THEN
        ALTER TABLE rate_limits ADD COLUMN action_type VARCHAR(100);
    END IF;
    
    -- Add scope column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rate_limits' AND column_name = 'scope') THEN
        ALTER TABLE rate_limits ADD COLUMN scope VARCHAR(50) DEFAULT 'ip';
    END IF;
    
    -- Add max_attempts column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rate_limits' AND column_name = 'max_attempts') THEN
        ALTER TABLE rate_limits ADD COLUMN max_attempts INT DEFAULT 5;
    END IF;
    
    -- Add window_seconds column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rate_limits' AND column_name = 'window_seconds') THEN
        ALTER TABLE rate_limits ADD COLUMN window_seconds INT DEFAULT 900;
    END IF;
    
    -- Add lockout_duration_seconds column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rate_limits' AND column_name = 'lockout_duration_seconds') THEN
        ALTER TABLE rate_limits ADD COLUMN lockout_duration_seconds INT DEFAULT 1800;
    END IF;
    
    -- Add is_active column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rate_limits' AND column_name = 'is_active') THEN
        ALTER TABLE rate_limits ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_rate_limit_action') THEN
        ALTER TABLE rate_limits ADD CONSTRAINT unique_rate_limit_action UNIQUE (action_type, scope);
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Constraint may fail if data doesn't allow it, ignore
    NULL;
END $$;

-- Insert default rate limit rules
INSERT INTO rate_limits (action_type, max_attempts, window_seconds, lockout_duration_seconds, scope, is_active) VALUES
    ('login', 5, 900, 1800, 'ip_email', true),
    ('signup', 3, 3600, 7200, 'ip', true),
    ('password_reset', 3, 3600, 3600, 'email', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

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
    v_limit RECORD;
    v_attempt_count INT;
    v_window_start TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_limit
    FROM rate_limits
    WHERE action_type = p_action_type AND is_active = true
    LIMIT 1;
    
    IF v_limit IS NULL THEN
        RETURN QUERY SELECT false::BOOLEAN, 999::INT, 0::INT;
        RETURN;
    END IF;
    
    v_window_start := NOW() - (v_limit.window_seconds || ' seconds')::INTERVAL;
    
    IF v_limit.scope = 'ip' THEN
        SELECT COUNT(*) INTO v_attempt_count
        FROM login_attempts
        WHERE ip_address = p_ip_address
          AND attempted_at > v_window_start
          AND NOT success;
    ELSIF v_limit.scope = 'email' AND p_email IS NOT NULL THEN
        SELECT COUNT(*) INTO v_attempt_count
        FROM login_attempts
        WHERE email = p_email
          AND attempted_at > v_window_start
          AND NOT success;
    ELSIF v_limit.scope = 'ip_email' THEN
        SELECT COUNT(*) INTO v_attempt_count
        FROM login_attempts
        WHERE ip_address = p_ip_address
          AND (p_email IS NULL OR email = p_email)
          AND attempted_at > v_window_start
          AND NOT success;
    ELSE
        v_attempt_count := 0;
    END IF;
    
    IF v_attempt_count >= v_limit.max_attempts THEN
        RETURN QUERY SELECT 
            true::BOOLEAN,
            0::INT,
            GREATEST(0, EXTRACT(EPOCH FROM (v_window_start + (v_limit.window_seconds || ' seconds')::INTERVAL - NOW()))::INT)::INT;
    ELSE
        RETURN QUERY SELECT 
            false::BOOLEAN,
            (v_limit.max_attempts - v_attempt_count)::INT,
            0::INT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
