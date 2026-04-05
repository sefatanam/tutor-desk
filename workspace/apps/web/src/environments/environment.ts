export const environment = {
  production: false,

  // Go API Configuration
  apiBaseUrl: 'http://localhost:8080/api/v1',

  // App Configuration
  app: {
    name: 'Tutor Desk',
    version: '1.0.0',
    description: 'A modern platform for teachers to manage students and exams',
  },

  // SuperAdmin Credentials (for development reference only)
  superAdmin: {
    email: 'admin@tutordesk.app',
  },

  // Feature Flags
  features: {
    googleAuth: false,
    darkMode: true,
    pwa: true,
  },

  // API Configuration
  api: {
    timeout: 30000,
    retryAttempts: 1,
  },
};
