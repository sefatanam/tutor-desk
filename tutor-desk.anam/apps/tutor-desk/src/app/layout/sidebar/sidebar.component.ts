// @REVIEW: Sidebar Component with PrimeNG
// Collapsible navigation sidebar with role-based menu

import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { RippleModule } from 'primeng/ripple';
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
  imports: [
    RouterLink,
    RouterLinkActive,
    TooltipModule,
    RippleModule,
  ],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed()">
      <!-- Logo -->
      <div class="sidebar__header">
          @if (!collapsed()) {
            <a [routerLink]="dashboardRoute()" class="sidebar__logo">
              <span class="sidebar__logo-icon">
                <i class="pi pi-book"></i>
              </span>
                <span class="sidebar__logo-text animate-fade-in">Tutor Desk</span>
            </a>
          }
        <!-- Collapse button (desktop) -->
        <button
          type="button"
          class="sidebar__collapse-btn"
          (click)="collapsedChange.emit(!collapsed())"
          [pTooltip]="collapsed() ? 'Expand' : 'Collapse'"
          tooltipPosition="right"
        >
          <i class="pi" [class]="collapsed() ? 'pi-angle-right' : 'pi-angle-left'"></i>
        </button>
      </div>

      <!-- Navigation -->
      <nav class="sidebar__nav">
        @for (item of menuItems(); track item.label) {
          <a
            [routerLink]="item.routerLink"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
            class="sidebar__nav-item"
            [pTooltip]="collapsed() ? item.label : ''"
            [tooltipDisabled]="!collapsed()"
            tooltipPosition="right"
            pRipple
          >
            <i [class]="'sidebar__nav-icon pi ' + item.icon"></i>
            @if (!collapsed()) {
              <span class="sidebar__nav-label">{{ item.label }}</span>
            }
            @if (item.badge && !collapsed()) {
              <span class="sidebar__nav-badge">{{ item.badge }}</span>
            }
          </a>
        }
      </nav>

      <!-- Footer -->
      <div class="sidebar__footer">
        @if (!collapsed()) {
          <div class="sidebar__version animate-fade-in">
            <span>v1.0.0</span>
          </div>
        }
      </div>
    </aside>

    <!-- Mobile overlay -->
    @if (mobileOpen()) {
      <div
        class="sidebar__overlay md:hidden"
        (click)="mobileOpen.set(false)"
      ></div>
    }
  `,
  styles: `
    /* @REVIEW: Removed grid-area: sidebar - using implicit grid column */
    .sidebar {
      display: flex;
      flex-direction: column;
      width: var(--td-sidebar-width);
      height: 100vh;
      background: var(--td-surface);
      border-right: 1px solid var(--p-surface-200);
      position: sticky;
      top: 0;
      transition: width var(--td-transition-normal);
      overflow: hidden;
      z-index: 200;

      &.collapsed {
        width: var(--td-sidebar-collapsed-width);

        .sidebar__nav-item {
          justify-content: center;
          padding: 0.75rem;
        }
      }
    }

    .sidebar__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      height: var(--td-header-height);
      border-bottom: 1px solid var(--p-surface-200);
    }

    .sidebar__logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: var(--td-text);
      font-weight: 700;
      font-size: 1.125rem;
    }

    .sidebar__logo-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, var(--td-primary), var(--td-primary-dark));
      color: white;
      border-radius: var(--td-radius-md);
      flex-shrink: 0;

      i {
        font-size: 1.25rem;
      }
    }

    .sidebar__logo-text {
      white-space: nowrap;
    }

    .sidebar__collapse-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: var(--td-background);
      border: 1px solid var(--p-surface-200);
      border-radius: var(--td-radius-sm);
      cursor: pointer;
      transition: all var(--td-transition-fast);

      &:hover {
        background: var(--p-surface-100);
        border-color: var(--td-primary);
        color: var(--td-primary);
      }

      @media (max-width: 768px) {
        display: none;
      }
    }

    .sidebar__nav {
      flex: 1;
      padding: 1rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      overflow-y: auto;
    }

    .sidebar__nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      color: var(--td-text-secondary);
      text-decoration: none;
      border-radius: var(--td-radius-md);
      transition: all var(--td-transition-fast);
      white-space: nowrap;

      &:hover {
        background: var(--p-surface-100);
        color: var(--td-text);
      }

      &.active {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05));
        color: var(--td-primary);
        font-weight: 500;

        .sidebar__nav-icon {
          color: var(--td-primary);
        }
      }
    }

    .sidebar__nav-icon {
      font-size: 1.125rem;
      flex-shrink: 0;
    }

    .sidebar__nav-label {
      flex: 1;
    }

    .sidebar__nav-badge {
      padding: 0.125rem 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      background: var(--td-primary);
      color: white;
      border-radius: var(--td-radius-lg);
    }

    .sidebar__footer {
      padding: 1rem;
      border-top: 1px solid var(--p-surface-200);
    }

    .sidebar__version {
      text-align: center;
      font-size: 0.75rem;
      color: var(--td-text-secondary);
    }

    .sidebar__overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 150;
      animation: fadeIn var(--td-transition-fast) forwards;
    }

    /* Mobile: Hidden by default, shown with overlay */
    @media (max-width: 768px) {
      .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        transform: translateX(-100%);

        &.open {
          transform: translateX(0);
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly authStore = inject(AuthStore);

  readonly collapsed = input<boolean>(false);
  readonly collapsedChange = output<boolean>();

  readonly mobileOpen = signal(false);

  // @REVIEW: Role-based dashboard route
  readonly dashboardRoute = computed(() => {
    const role = this.authStore.userRole();
    switch (role) {
      case 'super_admin': return '/admin/dashboard';
      case 'teacher': return '/teacher/dashboard';
      case 'student': return '/student/dashboard';
      default: return '/';
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
