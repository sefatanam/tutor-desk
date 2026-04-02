// @REVIEW: New routing structure for Tutor Desk
// Protected routes use authGuard + roleGuard with custom auth (NO Supabase Auth)
import { Route } from '@angular/router';
import {
  authGuard,
  superAdminGuard,
  teacherGuard,
  studentGuard,
} from './core/guards';

export const appRoutes: Route[] = [
  // Public routes (no layout shell)
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(
        (m) => m.LandingComponent
      ),
    title: 'Tutor Desk - Empowering Education',
  },

  // Auth routes (no layout shell)
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },

  // Protected routes with layout shell
  {
    path: 'admin',
    loadComponent: () =>
      import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [superAdminGuard],
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/super-admin/super-admin.routes').then(
            (m) => m.superAdminRoutes
          ),
      },
    ],
  },

  {
    path: 'teacher',
    loadComponent: () =>
      import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [teacherGuard],
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/teacher/teacher.routes').then(
            (m) => m.teacherRoutes
          ),
      },
    ],
  },

  {
    path: 'student',
    loadComponent: () =>
      import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [studentGuard],
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/student/student.routes').then(
            (m) => m.studentRoutes
          ),
      },
    ],
  },

  // bKash payment callback — public, no shell, no auth guard
  {
    path: 'payment/callback',
    loadComponent: () =>
      import('./features/billing/callback/callback.component').then(
        (m) => m.PaymentCallbackComponent
      ),
    title: 'Payment - Tutor Desk',
  },

  // Fallback
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];
