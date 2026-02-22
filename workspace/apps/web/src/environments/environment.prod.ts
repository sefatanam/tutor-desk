export const environment = {
  production: true,

  // Go API Configuration
  apiBaseUrl: '/api/v1',

  // App Configuration
  app: {
    name: 'Tutor Desk',
    version: '1.0.0',
    description: 'A modern platform for teachers to manage students and exams',
  },

  // SuperAdmin Credentials
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
