import { Route } from '@angular/router';

// @REVIEW: New routing structure for Tutor Desk
export const appRoutes: Route[] = [
  // Public routes (no layout shell)
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent),
    title: 'Tutor Desk - Empowering Education',
  },
  
  // Auth routes (no layout shell)
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.authRoutes),
  },
  
  // Protected routes with layout shell
  {
    path: 'admin',
    loadComponent: () =>
      import('./layout/shell/shell.component').then(m => m.ShellComponent),
    // canActivate: [authGuard, roleGuard('super_admin')], // @TODO: Enable when guards are ready
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/super-admin/super-admin.routes').then(m => m.superAdminRoutes),
      },
    ],
  },
  
  {
    path: 'teacher',
    loadComponent: () =>
      import('./layout/shell/shell.component').then(m => m.ShellComponent),
    // canActivate: [authGuard, roleGuard('teacher')], // @TODO: Enable when guards are ready
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/teacher/teacher.routes').then(m => m.teacherRoutes),
      },
    ],
  },
  
  {
    path: 'student',
    loadComponent: () =>
      import('./layout/shell/shell.component').then(m => m.ShellComponent),
    // canActivate: [authGuard, roleGuard('student')], // @TODO: Enable when guards are ready
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/student/student.routes').then(m => m.studentRoutes),
      },
    ],
  },
  
  // Fallback
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];
