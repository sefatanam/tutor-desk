/* eslint-disable @angular-eslint/template/click-events-have-key-events */
// @REVIEW: Sidebar Component with PrimeNG
// Collapsible navigation sidebar with role-based menu

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { RippleModule } from 'primeng/ripple';
import { DrawerModule } from 'primeng/drawer';
import { AuthStore } from '../../core/store/auth.store';

interface MenuItem {
  readonly label: string;
  readonly icon: string;
  readonly routerLink: string;
  readonly exact?: boolean;
  readonly badge?: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, TooltipModule, RippleModule, DrawerModule],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly authStore = inject(AuthStore);

  readonly collapsed = input<boolean>(false);
  readonly collapsedChange = output<boolean>();

  readonly mobileOpen = input<boolean>(false);
  readonly mobileOpenChange = output<boolean>();

  // @REVIEW: Role-based dashboard route
  readonly dashboardRoute = computed(() => {
    const role = this.authStore.userRole();
    switch (role) {
      case 'super_admin':
        return '/admin/dashboard';
      case 'teacher':
        return '/teacher/dashboard';
      case 'student':
        return '/student/dashboard';
      default:
        return '/';
    }
  });

  // @REVIEW: Role-based menu items using computed signal
  readonly menuItems = computed<readonly MenuItem[]>(() => {
    const role = this.authStore.userRole();

    switch (role) {
      case 'super_admin':
        return this.superAdminMenu;
      case 'teacher':
        return this.teacherMenu;
      case 'student':
        return this.studentMenu;
      default:
        return [];
    }
  });

  // @REVIEW: Super Admin menu items
  private readonly superAdminMenu: readonly MenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'pi-home',
      routerLink: '/admin/dashboard',
      exact: true,
    },
    {
      label: 'Teachers',
      icon: 'pi-users',
      routerLink: '/admin/teachers',
    },
    {
      label: 'Settings',
      icon: 'pi-cog',
      routerLink: '/admin/settings',
    },
  ];

  // @REVIEW: Teacher menu items
  private readonly teacherMenu: readonly MenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'pi-home',
      routerLink: '/teacher/dashboard',
      exact: true,
    },
    {
      label: 'Subjects',
      icon: 'pi-book',
      routerLink: '/teacher/subjects',
    },
    {
      label: 'Students',
      icon: 'pi-users',
      routerLink: '/teacher/students',
    },
    {
      label: 'Exams',
      icon: 'pi-file-edit',
      routerLink: '/teacher/exams',
    },
    {
      label: 'Results',
      icon: 'pi-chart-bar',
      routerLink: '/teacher/results',
    },
  ];

  // @REVIEW: Student menu items
  private readonly studentMenu: readonly MenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'pi-home',
      routerLink: '/student/dashboard',
      exact: true,
    },
    {
      label: 'Subjects',
      icon: 'pi-book',
      routerLink: '/student/subjects',
    },
    {
      label: 'Exams',
      icon: 'pi-file-edit',
      routerLink: '/student/exams',
    },
    {
      label: 'Results',
      icon: 'pi-chart-bar',
      routerLink: '/student/results',
    },
  ];
}
