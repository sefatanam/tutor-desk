// @REVIEW: Role-based Guard Factory
// Creates guards that check for specific user roles
// Uses custom auth store (NO Supabase Auth)

import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthStore } from '../store/auth.store';
import type { UserRole } from '../types/database.types';
import { StyleLoaderService } from '../services/style-loader.service';

/**
 * Factory function to create role-based guards
 * @param allowedRoles - Array of roles that are allowed to access the route
 */
export const roleGuard = (...allowedRoles: UserRole[]): CanActivateFn => {
  return async () => {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    // Wait for auth to initialize (max 5 seconds)
    await authStore.waitForInitialization();

    // Check if authenticated
    if (!authStore.isAuthenticated()) {
      return router.createUrlTree(['/auth/login']);
    }

    // Check if user can access (not disabled/suspended, approved if teacher)
    if (!authStore.canAccess()) {
      // Pending teachers go to pending page
      if (authStore.isPendingApproval()) {
        return router.createUrlTree(['/auth/pending']);
      }

      // Disabled/suspended users are logged out
      await authStore.logout();
      return router.createUrlTree(['/auth/login']);
    }

    // Check if user has required role
    const userRole = authStore.userRole();
    if (userRole && allowedRoles.includes(userRole)) {
      return true;
    }

    // Redirect to appropriate dashboard based on actual role
    return router.createUrlTree([authStore.getDashboardRoute()]);
  };
};

// Convenience guards — load role-specific CSS bundle before activating
export const superAdminGuard: CanActivateFn = (route, state) => {
  inject(StyleLoaderService).load('feature-admin');
  return roleGuard('super_admin')(route, state);
};
export const teacherGuard: CanActivateFn = (route, state) => {
  inject(StyleLoaderService).load('feature-teacher');
  return roleGuard('teacher')(route, state);
};
export const studentGuard: CanActivateFn = (route, state) => {
  inject(StyleLoaderService).load('feature-student');
  return roleGuard('student')(route, state);
};
export const teacherOrAdminGuard: CanActivateFn = roleGuard(
  'super_admin',
  'teacher'
);
