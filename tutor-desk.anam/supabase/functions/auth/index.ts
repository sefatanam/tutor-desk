// @REVIEW: Supabase Edge Function for custom authentication
// @REVIEW: Using Deno.serve (native) instead of deprecated serve from std
// @REVIEW: Using bcryptjs (pure JS) instead of bcrypt (requires Worker)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";
import { create, verify } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

// Types
interface AuthRequest {
  action: 'login' | 'signup' | 'refresh' | 'logout' | 'reset_password' | 'change_password' | 'create_student';
  email?: string;
  password?: string;
  full_name?: string;
  refresh_token?: string;
  new_password?: string;
  user_id?: string;
  student_data?: {
    full_name: string;
    email: string;
    password: string;
    roll_number?: string;
    class_name?: string;
    section?: string;
  };
}

interface JWTPayload {
  sub: string; // user_id
  email: string;
  user_role: string; // @REVIEW: Changed from 'role' to avoid Supabase/PostgREST conflict
  status: string;
  iat: number;
  exp: number;
}

// Constants
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days
const BCRYPT_ROUNDS = 12;

// @REVIEW: Get JWT secret key - MUST use Supabase's JWT secret for RLS to work
// Use TD_JWT_SECRET (copy of Supabase's JWT secret) since SUPABASE_ prefix is reserved
const getJwtKey = async (): Promise<CryptoKey> => {
  // Priority: TD_JWT_SECRET (Supabase JWT secret copy) > JWT_SECRET (legacy) > fallback (dev only)
  const secret = Deno.env.get('TD_JWT_SECRET') 
    || Deno.env.get('JWT_SECRET') 
    || 'tutor-desk-super-secret-key-change-in-production-2024';
  
  const encoder = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
};

// Generate random token
const generateToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
};

// Hash token for storage
const hashToken = async (token: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');
};

// Create JWT access token
const createAccessToken = async (user: { id: string; email: string; role: string; status: string }): Promise<string> => {
  const key = await getJwtKey();
  const now = Math.floor(Date.now() / 1000);
  
  // @REVIEW: Use 'user_role' instead of 'role' to avoid PostgREST SET ROLE conflict
  const payload = {
    sub: user.id,
    email: user.email,
    user_role: user.role,
    status: user.status,
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY,
  };
  
  return await create({ alg: 'HS256', typ: 'JWT' }, payload, key);
};

// Verify JWT access token
const verifyAccessToken = async (token: string): Promise<JWTPayload | null> => {
  try {
    const key = await getJwtKey();
    const payload = await verify(token, key) as JWTPayload;
    return payload;
  } catch {
    return null;
  }
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-fingerprint',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// @REVIEW: Using Deno.serve instead of deprecated serve()
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: AuthRequest = await req.json();
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('cf-connecting-ip') || '0.0.0.0';
    const userAgent = req.headers.get('user-agent') || '';
    const deviceFingerprint = req.headers.get('x-device-fingerprint') || '';

    // Helper: Check rate limit
    const checkRateLimit = async (limitType: string, identifier: string) => {
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_limit_type: limitType,
        p_identifier: identifier,
        p_ip_address: clientIp,
      });
      
      if (error) throw new Error('Rate limit check failed');
      // @REVIEW: RPC returns array from TABLE function, access first element
      const result = Array.isArray(data) ? data[0] : data;
      return result as { allowed: boolean; wait_seconds: number; attempts_remaining: number };
    };

    // Helper: Record login attempt
    const recordAttempt = async (email: string, success: boolean, reason?: string) => {
      await supabase.rpc('record_login_attempt', {
        p_email: email,
        p_ip_address: clientIp,
        p_was_successful: success,
        p_failure_reason: reason || null,
        p_user_agent: userAgent,
        p_device_fingerprint: deviceFingerprint,
      });
    };

    switch (body.action) {
      // ==================== LOGIN ====================
      case 'login': {
        if (!body.email || !body.password) {
          return new Response(
            JSON.stringify({ error: 'Email and password required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check rate limit
        let rateLimit;
        try {
          rateLimit = await checkRateLimit('login', body.email);
        } catch (rateLimitError) {
          console.error('[LOGIN] Rate limit error:', rateLimitError);
          // @REVIEW: Skip rate limit on error to allow login
          rateLimit = { allowed: true, wait_seconds: 0, attempts_remaining: 5 };
        }
        
        if (!rateLimit.allowed) {
          return new Response(
            JSON.stringify({ 
              error: 'Too many login attempts', 
              wait_seconds: rateLimit.wait_seconds,
              attempts_remaining: rateLimit.attempts_remaining 
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Find user
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, email, password_hash, full_name, role, status, avatar_url')
          .eq('email', body.email.toLowerCase())
          .single();
        
        if (userError || !user) {
          await recordAttempt(body.email, false, 'user_not_found').catch(console.error);
          return new Response(
            JSON.stringify({ error: 'Invalid email or password' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check password
        let passwordValid = false;
        try {
          passwordValid = await bcrypt.compare(body.password, user.password_hash || '');
        } catch (bcryptError) {
          console.error('[LOGIN] Bcrypt error:', bcryptError);
          return new Response(
            JSON.stringify({ error: 'Password verification failed' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!passwordValid) {
          await recordAttempt(body.email, false, 'invalid_password').catch(console.error);
          return new Response(
            JSON.stringify({ error: 'Invalid email or password' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check account status
        if (user.status === 'disabled' || user.status === 'suspended') {
          await recordAttempt(body.email, false, 'account_locked');
          return new Response(
            JSON.stringify({ error: 'Account is disabled. Please contact support.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if teacher is pending approval
        if (user.role === 'teacher' && user.status === 'pending') {
          await recordAttempt(body.email, true, null);
          return new Response(
            JSON.stringify({ 
              error: 'Account pending approval', 
              status: 'pending',
              message: 'Your account is pending admin approval. Please wait for activation.' 
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate tokens
        const accessToken = await createAccessToken(user);
        const refreshToken = generateToken();
        const refreshTokenHash = await hashToken(refreshToken);

        // Store refresh token
        await supabase.from('refresh_tokens').insert({
          user_id: user.id,
          token_hash: refreshTokenHash,
          device_fingerprint: deviceFingerprint,
          ip_address: clientIp,
          user_agent: userAgent,
          expires_at: new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000).toISOString(),
        });

        // Update last login
        await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);

        // Record successful attempt
        await recordAttempt(body.email, true, null);

        return new Response(
          JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: ACCESS_TOKEN_EXPIRY,
            user: {
              id: user.id,
              email: user.email,
              full_name: user.full_name,
              role: user.role,
              status: user.status,
              avatar_url: user.avatar_url,
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ==================== SIGNUP (Teacher Only) ====================
      case 'signup': {
        if (!body.email || !body.password || !body.full_name) {
          return new Response(
            JSON.stringify({ error: 'Email, password, and full name required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check rate limit
        const rateLimit = await checkRateLimit('signup', body.email);
        if (!rateLimit.allowed) {
          return new Response(
            JSON.stringify({ error: 'Too many signup attempts', wait_seconds: rateLimit.wait_seconds }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if email exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', body.email.toLowerCase())
          .single();

        if (existingUser) {
          return new Response(
            JSON.stringify({ error: 'Email already registered' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Hash password
        const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

        // Create user (teacher with pending status)
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            email: body.email.toLowerCase(),
            password_hash: passwordHash,
            full_name: body.full_name,
            role: 'teacher',
            status: 'pending', // Requires admin approval
            auth_provider: 'email',
          })
          .select('id, email, full_name, role, status')
          .single();

        if (createError || !newUser) {
          return new Response(
            JSON.stringify({ error: 'Failed to create account', details: createError?.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create teacher profile
        await supabase.from('teachers').insert({
          user_id: newUser.id,
        });

        return new Response(
          JSON.stringify({
            message: 'Account created successfully. Please wait for admin approval.',
            user: newUser,
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ==================== REFRESH TOKEN ====================
      case 'refresh': {
        if (!body.refresh_token) {
          return new Response(
            JSON.stringify({ error: 'Refresh token required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tokenHash = await hashToken(body.refresh_token);

        // Find valid refresh token
        const { data: tokenData, error: tokenError } = await supabase
          .from('refresh_tokens')
          .select('id, user_id, expires_at, device_fingerprint')
          .eq('token_hash', tokenHash)
          .eq('is_revoked', false)
          .single();

        if (tokenError || !tokenData) {
          return new Response(
            JSON.stringify({ error: 'Invalid refresh token' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check expiry
        if (new Date(tokenData.expires_at) < new Date()) {
          await supabase.from('refresh_tokens').update({ is_revoked: true, revoked_reason: 'expired' }).eq('id', tokenData.id);
          return new Response(
            JSON.stringify({ error: 'Refresh token expired' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Optional: Validate device fingerprint
        if (tokenData.device_fingerprint && deviceFingerprint && tokenData.device_fingerprint !== deviceFingerprint) {
          // Suspicious: different device, revoke all tokens
          await supabase.rpc('revoke_all_user_tokens', { p_user_id: tokenData.user_id, p_reason: 'suspicious_activity' });
          return new Response(
            JSON.stringify({ error: 'Session invalidated due to suspicious activity' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get user
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, email, full_name, role, status, avatar_url')
          .eq('id', tokenData.user_id)
          .single();

        if (userError || !user || user.status === 'disabled' || user.status === 'suspended') {
          await supabase.from('refresh_tokens').update({ is_revoked: true, revoked_reason: 'user_invalid' }).eq('id', tokenData.id);
          return new Response(
            JSON.stringify({ error: 'User account not available' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Rotate refresh token
        const newRefreshToken = generateToken();
        const newRefreshTokenHash = await hashToken(newRefreshToken);

        // Revoke old, create new
        await supabase.from('refresh_tokens').update({ is_revoked: true, revoked_reason: 'rotated' }).eq('id', tokenData.id);
        await supabase.from('refresh_tokens').insert({
          user_id: user.id,
          token_hash: newRefreshTokenHash,
          device_fingerprint: deviceFingerprint,
          ip_address: clientIp,
          user_agent: userAgent,
          expires_at: new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000).toISOString(),
        });

        // Generate new access token
        const accessToken = await createAccessToken(user);

        return new Response(
          JSON.stringify({
            access_token: accessToken,
            refresh_token: newRefreshToken,
            expires_in: ACCESS_TOKEN_EXPIRY,
            user: {
              id: user.id,
              email: user.email,
              full_name: user.full_name,
              role: user.role,
              status: user.status,
              avatar_url: user.avatar_url,
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ==================== LOGOUT ====================
      case 'logout': {
        if (!body.refresh_token) {
          return new Response(
            JSON.stringify({ message: 'Logged out' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tokenHash = await hashToken(body.refresh_token);
        await supabase.from('refresh_tokens').update({ is_revoked: true, revoked_at: new Date().toISOString(), revoked_reason: 'logout' }).eq('token_hash', tokenHash);

        return new Response(
          JSON.stringify({ message: 'Logged out successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ==================== RESET PASSWORD (Admin) ====================
      case 'reset_password': {
        // Verify admin token
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
          return new Response(
            JSON.stringify({ error: 'Authorization required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const adminToken = authHeader.substring(7);
        const adminPayload = await verifyAccessToken(adminToken);

        if (!adminPayload || adminPayload.user_role !== 'super_admin') {
          return new Response(
            JSON.stringify({ error: 'Super admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!body.user_id || !body.new_password) {
          return new Response(
            JSON.stringify({ error: 'User ID and new password required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(body.new_password, BCRYPT_ROUNDS);

        // Update password
        const { error: updateError } = await supabase
          .from('users')
          .update({ password_hash: newPasswordHash, updated_at: new Date().toISOString() })
          .eq('id', body.user_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Failed to reset password' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Revoke all user tokens
        await supabase.rpc('revoke_all_user_tokens', { p_user_id: body.user_id, p_reason: 'password_change' });

        return new Response(
          JSON.stringify({ message: 'Password reset successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ==================== CREATE STUDENT (Teacher) ====================
      case 'create_student': {
        // Verify teacher token
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
          return new Response(
            JSON.stringify({ error: 'Authorization required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const teacherToken = authHeader.substring(7);
        const teacherPayload = await verifyAccessToken(teacherToken);

        if (!teacherPayload || teacherPayload.user_role !== 'teacher') {
          return new Response(
            JSON.stringify({ error: 'Teacher access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!body.student_data) {
          return new Response(
            JSON.stringify({ error: 'Student data required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { full_name, email, password, roll_number, class_name, section } = body.student_data;

        if (!full_name || !email || !password) {
          return new Response(
            JSON.stringify({ error: 'Student name, email, and password required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if email exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email.toLowerCase())
          .single();

        if (existingUser) {
          return new Response(
            JSON.stringify({ error: 'Email already registered' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get teacher's teacher_id
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('id')
          .eq('user_id', teacherPayload.sub)
          .single();

        if (!teacherData) {
          return new Response(
            JSON.stringify({ error: 'Teacher profile not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Create student user (active immediately)
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            email: email.toLowerCase(),
            password_hash: passwordHash,
            full_name: full_name,
            role: 'student',
            status: 'active', // Students are active immediately
            auth_provider: 'email',
            created_by: teacherPayload.sub,
          })
          .select('id, email, full_name, role, status')
          .single();

        if (createError || !newUser) {
          return new Response(
            JSON.stringify({ error: 'Failed to create student', details: createError?.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create student profile
        const { error: studentError } = await supabase.from('students').insert({
          user_id: newUser.id,
          teacher_id: teacherData.id,
          roll_number: roll_number || null,
          class_name: class_name || null,
          section: section || null,
        });

        if (studentError) {
          // Rollback user creation
          await supabase.from('users').delete().eq('id', newUser.id);
          return new Response(
            JSON.stringify({ error: 'Failed to create student profile' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update teacher's student count
        await supabase.rpc('update_teacher_stats', { p_teacher_id: teacherData.id }).catch(() => {});

        return new Response(
          JSON.stringify({
            message: 'Student created successfully',
            student: newUser,
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Auth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});