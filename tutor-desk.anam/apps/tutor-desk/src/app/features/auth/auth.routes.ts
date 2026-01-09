// @REVIEW: Authentication routes
// Protected by guestGuard - authenticated users are redirected to their dashboard
import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards';

export const authRoutes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard],
    title: 'Sign In - Tutor Desk',
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./register/register.component').then(m => m.RegisterComponent),
    canActivate: [guestGuard],
    title: 'Teacher Registration - Tutor Desk',
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    canActivate: [guestGuard],
    title: 'Reset Password - Tutor Desk',
  },
  {
    path: 'pending',
    loadComponent: () =>
      import('./pending/pending.component').then(m => m.PendingComponent),
    title: 'Pending Approval - Tutor Desk',
  },
];
