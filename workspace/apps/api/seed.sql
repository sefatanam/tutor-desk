-- =============================================
-- TUTOR DESK - Seed Data
-- Run after schema.sql
--
-- Super admin password: adminoftutordesk@app
-- (bcrypt cost 12, pre-hashed)
-- =============================================

-- =============================================
-- RATE LIMITS
-- =============================================

INSERT INTO rate_limits (action_type, max_attempts, window_seconds, lockout_duration_seconds, scope) VALUES
    ('login',          5, 900,  1800, 'ip_email'),
    ('signup',         3, 3600, 7200, 'ip'),
    ('password_reset', 3, 3600, 3600, 'email')
ON CONFLICT (action_type, scope) DO NOTHING;

-- =============================================
-- SETTINGS CATEGORIES
-- =============================================

INSERT INTO settings_categories (name, label, icon, description, sort_order) VALUES
    ('branding',      'Branding',         'pi-palette', 'Application branding, logos, and appearance settings', 0),
    ('security',      'Security',         'pi-shield',  'Password policies, session settings, and authentication options', 1),
    ('users',         'User Management',  'pi-users',   'User registration, approval workflows, and default settings', 2),
    ('notifications', 'Notifications',    'pi-bell',    'Email notifications and alert settings', 3),
    ('system',        'System',           'pi-cog',     'General system configuration and maintenance options', 4)
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- SYSTEM SETTINGS
-- =============================================

DO $$
DECLARE
    branding_id      UUID;
    security_id      UUID;
    users_id         UUID;
    notifications_id UUID;
    system_id        UUID;
BEGIN
    SELECT id INTO branding_id      FROM settings_categories WHERE name = 'branding';
    SELECT id INTO security_id      FROM settings_categories WHERE name = 'security';
    SELECT id INTO users_id         FROM settings_categories WHERE name = 'users';
    SELECT id INTO notifications_id FROM settings_categories WHERE name = 'notifications';
    SELECT id INTO system_id        FROM settings_categories WHERE name = 'system';

    -- Branding
    INSERT INTO system_settings (category_id, key, label, value, value_type, description, sort_order) VALUES
        (branding_id, 'app_name',     'Application Name', 'Tutor Desk',          'text',  'Name displayed in header and browser title', 0),
        (branding_id, 'app_tagline',  'Tagline',          'Your Learning Partner','text',  'Short tagline shown on login page', 1),
        (branding_id, 'primary_color','Primary Color',    '#10b981',             'color', 'Main brand color used throughout the app', 2),
        (branding_id, 'logo_url',     'Logo URL',         NULL,                  'url',   'URL to the application logo image', 3),
        (branding_id, 'footer_text',  'Footer Text',      '© 2026 Tutor Desk. All rights reserved.', 'text', 'Text displayed in the footer', 4)
    ON CONFLICT (key) DO NOTHING;

    -- Security
    INSERT INTO system_settings (category_id, key, label, value, value_type, description, is_required, sort_order) VALUES
        (security_id, 'password_min_length',        'Minimum Password Length',    '8',     'number',  'Minimum chars required for passwords', true,  0),
        (security_id, 'session_timeout_minutes',    'Session Timeout (minutes)',  '60',    'number',  'Auto-logout after inactivity (0 = never)', false, 1),
        (security_id, 'max_login_attempts',         'Max Login Attempts',         '5',     'number',  'Lock account after this many failed attempts', false, 2),
        (security_id, 'require_email_verification', 'Require Email Verification', 'false', 'boolean', 'Users must verify email before accessing the platform', false, 3)
    ON CONFLICT (key) DO NOTHING;

    -- User Management
    INSERT INTO system_settings (category_id, key, label, value, value_type, description, sort_order) VALUES
        (users_id, 'auto_approve_teachers',          'Auto-Approve Teachers',          'false',  'boolean', 'Automatically approve new teacher registrations', 0),
        (users_id, 'allow_student_self_registration','Allow Student Self-Registration', 'false',  'boolean', 'Students can register themselves', 1),
        (users_id, 'default_student_status',         'Default Student Status',          'active', 'select',  'Default status for new students', 2)
    ON CONFLICT (key) DO NOTHING;
    UPDATE system_settings SET options = '["active", "pending", "disabled"]'::jsonb WHERE key = 'default_student_status';

    -- Notifications
    INSERT INTO system_settings (category_id, key, label, value, value_type, description, sort_order) VALUES
        (notifications_id, 'email_notifications_enabled', 'Enable Email Notifications',    'true',                   'boolean', 'Send email notifications for important events', 0),
        (notifications_id, 'notify_on_new_teacher',       'Notify on New Teacher',         'true',                   'boolean', 'Send email to admin when a new teacher registers', 1),
        (notifications_id, 'notify_on_exam_submission',   'Notify on Exam Submission',     'true',                   'boolean', 'Send email to teacher when student submits exam', 2),
        (notifications_id, 'smtp_from_email',             'From Email Address',            'noreply@tutordesk.com',  'text',    'Email address used as sender for notifications', 3)
    ON CONFLICT (key) DO NOTHING;

    -- System
    INSERT INTO system_settings (category_id, key, label, value, value_type, description, sort_order) VALUES
        (system_id, 'maintenance_mode',    'Maintenance Mode',    'false',  'boolean',  'Put the application in maintenance mode', 0),
        (system_id, 'maintenance_message', 'Maintenance Message', 'We are currently performing scheduled maintenance. Please check back soon.', 'textarea', 'Message shown during maintenance mode', 1),
        (system_id, 'timezone',            'Default Timezone',    'UTC',    'select',   'Default timezone for date/time display', 2),
        (system_id, 'date_format',         'Date Format',         'MMM dd, yyyy', 'select', 'Format for displaying dates', 3),
        (system_id, 'items_per_page',      'Items Per Page',      '10',     'number',   'Default pagination size for tables', 4)
    ON CONFLICT (key) DO NOTHING;
    UPDATE system_settings SET options = '["UTC","America/New_York","America/Los_Angeles","Europe/London","Europe/Paris","Asia/Tokyo","Asia/Shanghai","Asia/Kolkata","Australia/Sydney"]'::jsonb WHERE key = 'timezone';
    UPDATE system_settings SET options = '["MMM dd, yyyy","dd/MM/yyyy","MM/dd/yyyy","yyyy-MM-dd"]'::jsonb WHERE key = 'date_format';
END $$;

-- =============================================
-- SUPER ADMIN USER
-- Password: adminoftutordesk@app
-- bcrypt hash (cost 12) generated offline
-- =============================================

-- Insert the super admin user
-- NOTE: The password_hash below is a placeholder.
-- Generate the real hash with: htpasswd or Go bcrypt at cost 12.
-- For production, replace this with a properly generated hash.
INSERT INTO users (
    id,
    email,
    password_hash,
    full_name,
    user_role,
    status
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@tutordesk.app',
    -- bcrypt hash of 'adminoftutordesk@app' at cost 12
    -- Generated via: Go bcrypt.GenerateFromPassword([]byte("adminoftutordesk@app"), 12)
    '$2a$12$YN5Q2z9fCWLtNEfNlnmDmOcIlOH7IJiEfqy9jKUUF32ZCth4WTzyi',
    'Super Admin',
    'super_admin',
    'active'
) ON CONFLICT (id) DO NOTHING;
