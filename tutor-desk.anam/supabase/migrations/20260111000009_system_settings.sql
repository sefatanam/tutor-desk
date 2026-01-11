-- @REVIEW: Dynamic System Settings Tables
-- This migration creates tables for the flexible settings system
-- Allows SuperAdmin to create unlimited key-value configuration settings

-- =============================================
-- SETTINGS CATEGORIES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS settings_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  icon VARCHAR(50) DEFAULT 'pi-cog',
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE settings_categories IS 'Categories for grouping system settings (e.g., Branding, Security, Notifications)';
COMMENT ON COLUMN settings_categories.name IS 'Unique identifier key (e.g., branding, security)';
COMMENT ON COLUMN settings_categories.label IS 'Display name shown in UI';
COMMENT ON COLUMN settings_categories.icon IS 'PrimeIcons icon class (e.g., pi-palette, pi-shield)';

-- =============================================
-- SYSTEM SETTINGS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES settings_categories(id) ON DELETE CASCADE,
  key VARCHAR(200) NOT NULL UNIQUE,
  label VARCHAR(200) NOT NULL,
  value TEXT,
  value_type VARCHAR(50) DEFAULT 'text',
  options JSONB,
  default_value TEXT,
  description TEXT,
  is_required BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint for value_type enum
ALTER TABLE system_settings 
ADD CONSTRAINT value_type_check 
CHECK (value_type IN ('text', 'number', 'boolean', 'color', 'url', 'textarea', 'select', 'json'));

-- Add comments
COMMENT ON TABLE system_settings IS 'Key-value system configuration settings';
COMMENT ON COLUMN system_settings.key IS 'Unique setting key (e.g., app_name, primary_color)';
COMMENT ON COLUMN system_settings.value IS 'Current value (stored as text, parsed based on value_type)';
COMMENT ON COLUMN system_settings.value_type IS 'Data type: text, number, boolean, color, url, textarea, select, json';
COMMENT ON COLUMN system_settings.options IS 'For select type: array of available options';
COMMENT ON COLUMN system_settings.default_value IS 'Default value used when value is null';

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_settings_category ON system_settings(category_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON settings_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_settings_sort ON system_settings(category_id, sort_order);

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to settings_categories
DROP TRIGGER IF EXISTS settings_categories_updated_at ON settings_categories;
CREATE TRIGGER settings_categories_updated_at
  BEFORE UPDATE ON settings_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_updated_at();

-- Apply trigger to system_settings
DROP TRIGGER IF EXISTS system_settings_updated_at ON system_settings;
CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_updated_at();

-- =============================================
-- SEED DEFAULT CATEGORIES
-- =============================================

INSERT INTO settings_categories (name, label, icon, description, sort_order) VALUES
  ('branding', 'Branding', 'pi-palette', 'Application branding, logos, and appearance settings', 0),
  ('security', 'Security', 'pi-shield', 'Password policies, session settings, and authentication options', 1),
  ('users', 'User Management', 'pi-users', 'User registration, approval workflows, and default settings', 2),
  ('notifications', 'Notifications', 'pi-bell', 'Email notifications and alert settings', 3),
  ('system', 'System', 'pi-cog', 'General system configuration and maintenance options', 4)
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- SEED DEFAULT SETTINGS
-- =============================================

-- Get category IDs for seeding
DO $$
DECLARE
  branding_id UUID;
  security_id UUID;
  users_id UUID;
  notifications_id UUID;
  system_id UUID;
BEGIN
  SELECT id INTO branding_id FROM settings_categories WHERE name = 'branding';
  SELECT id INTO security_id FROM settings_categories WHERE name = 'security';
  SELECT id INTO users_id FROM settings_categories WHERE name = 'users';
  SELECT id INTO notifications_id FROM settings_categories WHERE name = 'notifications';
  SELECT id INTO system_id FROM settings_categories WHERE name = 'system';

  -- Branding settings
  INSERT INTO system_settings (category_id, key, label, value, value_type, description, sort_order) VALUES
    (branding_id, 'app_name', 'Application Name', 'Tutor Desk', 'text', 'The name displayed in the header and browser title', 0),
    (branding_id, 'app_tagline', 'Tagline', 'Your Learning Partner', 'text', 'Short tagline shown on login page', 1),
    (branding_id, 'primary_color', 'Primary Color', '#10b981', 'color', 'Main brand color used throughout the application', 2),
    (branding_id, 'logo_url', 'Logo URL', NULL, 'url', 'URL to the application logo image', 3),
    (branding_id, 'footer_text', 'Footer Text', '© 2026 Tutor Desk. All rights reserved.', 'text', 'Text displayed in the footer', 4)
  ON CONFLICT (key) DO NOTHING;

  -- Security settings
  INSERT INTO system_settings (category_id, key, label, value, value_type, description, is_required, sort_order) VALUES
    (security_id, 'password_min_length', 'Minimum Password Length', '8', 'number', 'Minimum characters required for passwords', true, 0),
    (security_id, 'session_timeout_minutes', 'Session Timeout (minutes)', '60', 'number', 'Auto-logout after inactivity (0 = never)', false, 1),
    (security_id, 'max_login_attempts', 'Max Login Attempts', '5', 'number', 'Lock account after this many failed attempts', false, 2),
    (security_id, 'require_email_verification', 'Require Email Verification', 'false', 'boolean', 'Users must verify email before accessing the platform', false, 3)
  ON CONFLICT (key) DO NOTHING;

  -- User Management settings
  INSERT INTO system_settings (category_id, key, label, value, value_type, description, sort_order) VALUES
    (users_id, 'auto_approve_teachers', 'Auto-Approve Teachers', 'false', 'boolean', 'Automatically approve new teacher registrations', 0),
    (users_id, 'allow_student_self_registration', 'Allow Student Self-Registration', 'false', 'boolean', 'Students can register themselves (vs teacher-created only)', 1),
    (users_id, 'default_student_status', 'Default Student Status', 'active', 'select', 'Default status for new students', 2)
  ON CONFLICT (key) DO NOTHING;

  -- Update options for select type
  UPDATE system_settings SET options = '["active", "pending", "disabled"]'::jsonb WHERE key = 'default_student_status';

  -- Notification settings
  INSERT INTO system_settings (category_id, key, label, value, value_type, description, sort_order) VALUES
    (notifications_id, 'email_notifications_enabled', 'Enable Email Notifications', 'true', 'boolean', 'Send email notifications for important events', 0),
    (notifications_id, 'notify_on_new_teacher', 'Notify on New Teacher', 'true', 'boolean', 'Send email to admin when a new teacher registers', 1),
    (notifications_id, 'notify_on_exam_submission', 'Notify on Exam Submission', 'true', 'boolean', 'Send email to teacher when student submits exam', 2),
    (notifications_id, 'smtp_from_email', 'From Email Address', 'noreply@tutordesk.com', 'text', 'Email address used as sender for notifications', 3)
  ON CONFLICT (key) DO NOTHING;

  -- System settings
  INSERT INTO system_settings (category_id, key, label, value, value_type, description, sort_order) VALUES
    (system_id, 'maintenance_mode', 'Maintenance Mode', 'false', 'boolean', 'Put the application in maintenance mode (only admins can access)', 0),
    (system_id, 'maintenance_message', 'Maintenance Message', 'We are currently performing scheduled maintenance. Please check back soon.', 'textarea', 'Message shown during maintenance mode', 1),
    (system_id, 'timezone', 'Default Timezone', 'UTC', 'select', 'Default timezone for date/time display', 2),
    (system_id, 'date_format', 'Date Format', 'MMM dd, yyyy', 'select', 'Format for displaying dates', 3),
    (system_id, 'items_per_page', 'Items Per Page', '10', 'number', 'Default pagination size for tables', 4)
  ON CONFLICT (key) DO NOTHING;

  -- Update options for select types
  UPDATE system_settings SET options = '["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata", "Australia/Sydney"]'::jsonb WHERE key = 'timezone';
  UPDATE system_settings SET options = '["MMM dd, yyyy", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"]'::jsonb WHERE key = 'date_format';

END $$;
