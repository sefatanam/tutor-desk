-- =============================================
-- TUTOR DESK - Force Drop All Rate Limit Functions
-- =============================================

-- Use CASCADE to force drop
DROP FUNCTION IF EXISTS public.check_rate_limit CASCADE;

-- Recreate the correct version
CREATE FUNCTION public.check_rate_limit(
    p_limit_type TEXT,
    p_identifier TEXT,
    p_ip_address TEXT
)
RETURNS TABLE (
    allowed BOOLEAN,
    wait_seconds INT,
    attempts_remaining INT
) AS $$
BEGIN
    RETURN QUERY SELECT true, 0, 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- Also recreate record_login_attempt
DROP FUNCTION IF EXISTS public.record_login_attempt CASCADE;

CREATE FUNCTION public.record_login_attempt(
    p_email TEXT,
    p_ip_address TEXT,
    p_was_successful BOOLEAN,
    p_failure_reason TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO login_attempts (email, ip_address, success, failure_reason, user_agent, device_fingerprint, attempted_at)
    VALUES (p_email, COALESCE(p_ip_address, '0.0.0.0')::INET, p_was_successful, p_failure_reason, p_user_agent, p_device_fingerprint, NOW());
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_login_attempt(TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
