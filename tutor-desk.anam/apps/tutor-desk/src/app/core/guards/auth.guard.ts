// @REVIEW: Authentication Guard
// Protects routes that require authentication

import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { SupabaseClientService } from '../services/supabase-client.service';

export const authGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseClientService);
  const router = inject(Router);

  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    return true;
  }

  // Redirect to login if not authenticated
  return router.createUrlTree(['/auth/login']);
};
