// @REVIEW: Development environment configuration
// Replace with your actual Supabase credentials

export const environment = {
  production: false,
  
  // Supabase Configuration
  supabase: {
    url: 'YOUR_SUPABASE_URL', // e.g., https://xxxxx.supabase.co
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
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
    // Password: SuperAdmin@123 (for development reference only)
  },
  
  // Feature Flags
  features: {
    googleAuth: true,
    darkMode: true,
    pwa: true,
  },
  
  // API Configuration
  api: {
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
  },
};
