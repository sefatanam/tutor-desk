// @REVIEW: Guest Guard
// Prevents authenticated users from accessing auth pages (login, register)
// Redirects to appropriate dashboard if already logged in

import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthStore } from '../store/auth.store';

/**
 * Guard that only allows unauthenticated users
 * Redirects authenticated users to their dashboard
 */
export const guestGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  // Wait for auth to initialize (max 5 seconds)
  await authStore.waitForInitialization();

  // If authenticated, redirect to dashboard
  if (authStore.isAuthenticated()) {
    return router.createUrlTree([authStore.getDashboardRoute()]);
  }

  // Not authenticated, allow access to auth pages
  return true;
};
