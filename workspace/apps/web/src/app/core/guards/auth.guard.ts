// @REVIEW: Authentication Guard
// Protects routes that require authentication
// Uses custom auth store (NO Supabase Auth)

import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthStore } from '../store/auth.store';

/**
 * Guard that requires authentication
 * Waits for auth initialization before checking
 * Redirects to login if not authenticated
 */
export const authGuard: CanActivateFn = async () => {
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

  return true;
};
