// @REVIEW: Development environment configuration
// Replace with your actual Supabase credentials

export const environment = {
  production: false,
  
  // Supabase Configuration
  supabase: {
    url: 'https://ynkiftmzeclkthpcaoqy.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlua2lmdG16ZWNsa3RocGNhb3F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzUxNjcsImV4cCI6MjA4MzU1MTE2N30.U7eHPFqd-6tmpZe6YbNH0KGMIul7otoNkQyNJC8tsKI',
    // @REVIEW: Custom Auth Edge Function URL
    authFunctionUrl: 'https://ynkiftmzeclkthpcaoqy.supabase.co/functions/v1/auth',
  },
  
  // App Configuration
  app: {
    name: 'Tutor Desk',
    version: '1.0.0',
    description: 'A modern platform for teachers to manage students and exams',
  },
  
  // SuperAdmin Credentials (Hardcoded)
  superAdmin: {
    email: 'admin@tutordesk.app',
    // Password: adminoftutordesk@app (for development reference only)
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
