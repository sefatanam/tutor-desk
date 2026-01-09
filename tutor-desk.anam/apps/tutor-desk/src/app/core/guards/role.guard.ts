// @REVIEW: Role-based Guard Factory
// Creates guards that check for specific user roles

import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { SupabaseClientService } from '../services/supabase-client.service';
import type { UserRole } from '../models';

/**
 * Factory function to create role-based guards
 * @param allowedRoles - Array of roles that are allowed to access the route
 */
export const roleGuard = (...allowedRoles: UserRole[]): CanActivateFn => {
  return async () => {
    const supabase = inject(SupabaseClientService);
    const router = inject(Router);

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return router.createUrlTree(['/auth/login']);
    }

    // Get user role from the users table
    const { data: user, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (error || !user) {
      console.error('Error fetching user role:', error);
      return router.createUrlTree(['/auth/login']);
    }

    const userRole = user.role as UserRole;

    if (allowedRoles.includes(userRole)) {
      return true;
    }

    // Redirect to appropriate dashboard based on role
    const redirectMap: Record<UserRole, string> = {
      super_admin: '/admin/dashboard',
      teacher: '/teacher/dashboard',
      student: '/student/dashboard',
    };

    return router.createUrlTree([redirectMap[userRole] || '/']);
  };
};

// Convenience guards for common role checks
export const superAdminGuard: CanActivateFn = roleGuard('super_admin');
export const teacherGuard: CanActivateFn = roleGuard('teacher');
export const studentGuard: CanActivateFn = roleGuard('student');
export const teacherOrAdminGuard: CanActivateFn = roleGuard('super_admin', 'teacher');
