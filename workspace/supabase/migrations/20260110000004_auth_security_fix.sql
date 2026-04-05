-- =============================================
-- TUTOR DESK - Auth Security Tables Fix
-- Safe to run multiple times (idempotent)
-- =============================================

-- ---------------------------------------------
-- Refresh Tokens Table (skip if exists)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    device_fingerprint VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Login Attempts Table (skip if exists)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255),
    ip_address INET NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    failure_reason VARCHAR(100),
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempted_at);
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Rate Limits Table (skip if exists)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type VARCHAR(100) NOT NULL,
    max_attempts INT NOT NULL DEFAULT 5,
    window_seconds INT NOT NULL DEFAULT 900,
    lockout_duration_seconds INT DEFAULT 1800,
    scope VARCHAR(50) NOT NULL DEFAULT 'ip',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_rate_limit_action UNIQUE (action_type, scope)
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Insert default rate limit rules (ignore conflicts)
INSERT INTO rate_limits (action_type, max_attempts, window_seconds, lockout_duration_seconds, scope) VALUES
    ('login', 5, 900, 1800, 'ip_email'),
    ('signup', 3, 3600, 7200, 'ip'),
    ('password_reset', 3, 3600, 3600, 'email')
ON CONFLICT (action_type, scope) DO NOTHING;

-- ---------------------------------------------
-- Password Reset Tokens Table (skip if exists)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTIONS (CREATE OR REPLACE)
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION record_login_attempt TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_tokens TO service_role;
