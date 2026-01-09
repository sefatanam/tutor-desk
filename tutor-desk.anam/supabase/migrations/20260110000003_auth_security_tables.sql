-- =============================================
-- TUTOR DESK - Auth Security Tables Migration
-- Version: 003
-- Description: Tables required for custom auth Edge Function
-- =============================================

-- @REVIEW: Auth security tables for Edge Function support

-- ---------------------------------------------
-- Refresh Tokens Table
-- Stores active refresh tokens for token rotation
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Token data
    token_hash VARCHAR(255) NOT NULL UNIQUE, -- SHA-256 hash of refresh token
    
    -- Device/session info
    device_fingerprint VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    
    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Revocation
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(100), -- 'logout', 'rotation', 'suspicious_activity', 'admin_revoke'
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Enable RLS
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Login Attempts Table
-- Tracks login attempts for security/rate limiting
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identification
    email VARCHAR(255), -- Can be NULL for rate limit by IP only
    ip_address INET NOT NULL,
    
    -- Attempt details
    success BOOLEAN NOT NULL DEFAULT false,
    failure_reason VARCHAR(100), -- 'invalid_credentials', 'account_locked', 'account_pending', etc.
    
    -- Device info
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    
    -- Metadata
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_time ON login_attempts(attempted_at);

-- Enable RLS
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Rate Limits Table
-- Configurable rate limiting rules
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Rate limit key (e.g., 'login', 'signup', 'password_reset')
    action_type VARCHAR(100) NOT NULL,
    
    -- Limit configuration
    max_attempts INT NOT NULL DEFAULT 5,
    window_seconds INT NOT NULL DEFAULT 900, -- 15 minutes default
    
    -- Lockout configuration
    lockout_duration_seconds INT DEFAULT 1800, -- 30 minutes default
    
    -- Scope
    scope VARCHAR(50) NOT NULL DEFAULT 'ip', -- 'ip', 'email', 'ip_email'
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_rate_limit_action UNIQUE (action_type, scope)
);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Insert default rate limit rules
INSERT INTO rate_limits (action_type, max_attempts, window_seconds, lockout_duration_seconds, scope) VALUES
    ('login', 5, 900, 1800, 'ip_email'),      -- 5 attempts per 15 min per IP+email, 30 min lockout
    ('signup', 3, 3600, 7200, 'ip'),           -- 3 signups per hour per IP, 2 hour lockout
    ('password_reset', 3, 3600, 3600, 'email') -- 3 resets per hour per email, 1 hour lockout
ON CONFLICT (action_type, scope) DO NOTHING;

-- Apply updated_at trigger
CREATE TRIGGER update_rate_limits_updated_at BEFORE UPDATE ON rate_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------
-- Password Reset Tokens Table
-- For password reset functionality
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Token data
    token_hash VARCHAR(255) NOT NULL UNIQUE, -- SHA-256 hash of reset token
    
    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Usage tracking
    used_at TIMESTAMPTZ,
    
    -- Request info
    ip_address INET,
    user_agent TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at);

-- Enable RLS
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTIONS FOR EDGE FUNCTION
-- =============================================

-- @REVIEW: Rate limiting check function
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
    v_lockout_until TIMESTAMPTZ;
BEGIN
    -- Get rate limit config
    SELECT * INTO v_limit
    FROM rate_limits
    WHERE action_type = p_action_type AND is_active = true
    LIMIT 1;
    
    -- If no rate limit configured, allow
    IF v_limit IS NULL THEN
        RETURN QUERY SELECT false, 999, 0;
        RETURN;
    END IF;
    
    v_window_start := NOW() - (v_limit.window_seconds || ' seconds')::INTERVAL;
    
    -- Count attempts based on scope
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
    
    -- Check if limited
    IF v_attempt_count >= v_limit.max_attempts THEN
        RETURN QUERY SELECT 
            true,
            0,
            GREATEST(0, EXTRACT(EPOCH FROM (v_window_start + (v_limit.window_seconds || ' seconds')::INTERVAL - NOW()))::INT);
    ELSE
        RETURN QUERY SELECT 
            false,
            (v_limit.max_attempts - v_attempt_count)::INT,
            0;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- @REVIEW: Record login attempt function
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

-- @REVIEW: Clean up expired tokens (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    -- Delete expired refresh tokens
    DELETE FROM refresh_tokens WHERE expires_at < NOW();
    
    -- Delete expired password reset tokens
    DELETE FROM password_reset_tokens WHERE expires_at < NOW();
    
    -- Delete old login attempts (older than 30 days)
    DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GRANT PERMISSIONS FOR SERVICE ROLE
-- =============================================

-- The Edge Function uses service role key, which bypasses RLS
-- These grants ensure the functions can be called
GRANT EXECUTE ON FUNCTION check_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION record_login_attempt TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_tokens TO service_role;
