// @REVIEW: Header Component with PrimeNG
// Responsive header with user menu and mobile navigation

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { RippleModule } from 'primeng/ripple';
import { MenuItem } from 'primeng/api';
import { AuthStore } from '../../core/store/auth.store';

@Component({
  selector: 'app-header',
  imports: [
    RouterLink,
    ButtonModule,
    MenuModule,
    AvatarModule,
    BadgeModule,
    RippleModule,
  ],
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  // @REVIEW: Inject AuthStore for signout functionality
  private readonly authStore = inject(AuthStore);

  readonly sidebarCollapsed = input<boolean>(false);
  readonly toggleSidebar = output<void>();

  readonly darkMode = signal(false);

  readonly userMenuItems: MenuItem[] = [
    {
      label: 'Profile',
      icon: 'pi pi-user',
      routerLink: '/profile',
    },
    {
      label: 'Settings',
      icon: 'pi pi-cog',
      routerLink: '/settings',
    },
    {
      separator: true,
    },
    {
      label: 'Sign Out',
      icon: 'pi pi-sign-out',
      command: () => this.signOut(),
    },
  ];

  toggleTheme(): void {
    this.darkMode.update((dark) => !dark);
    document.documentElement.classList.toggle('dark-mode', this.darkMode());
  }

  // @REVIEW: Implemented signout using AuthStore
  private signOut(): void {
    this.authStore.logout();
  }
}
