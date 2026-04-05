// @REVIEW: Super Admin routes
import { Routes } from '@angular/router';

export const superAdminRoutes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
    title: 'Admin Dashboard - Tutor Desk',
  },
  {
    path: 'teachers',
    loadComponent: () =>
      import('./teachers/teachers.component').then((m) => m.TeachersComponent),
    title: 'Manage Teachers - Tutor Desk',
  },
  // @REVIEW: SuperAdmin browse teacher workspace
  {
    path: 'teachers/:id/workspace',
    loadComponent: () =>
      import('./teacher-workspace/teacher-workspace.component').then(
        (m) => m.TeacherWorkspaceComponent
      ),
    title: 'Teacher Workspace - Tutor Desk',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/settings.component').then((m) => m.SettingsComponent),
    title: 'Settings - Tutor Desk',
  },
];
