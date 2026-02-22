// @REVIEW: Production environment configuration
// These values should be set via CI/CD environment variables

export const environment = {
  production: true,

  // Supabase Configuration
  supabase: {
    url: 'YOUR_PRODUCTION_SUPABASE_URL',
    anonKey: 'YOUR_PRODUCTION_SUPABASE_ANON_KEY',
  },

  // App Configuration
  app: {
    name: 'Tutor Desk',
    version: '1.0.0',
    description: 'A modern platform for teachers to manage students and exams',
  },

  // SuperAdmin Credentials (Hardcoded)
  superAdmin: {
    email: 'admin@tutordesk.com',
  },

  // Feature Flags
  features: {
    googleAuth: true,
    darkMode: true,
    pwa: true,
  },

  // API Configuration
  api: {
    timeout: 30000,
    retryAttempts: 3,
  },
};
