// @REVIEW: Header Component with PrimeNG
// Responsive header with user menu and mobile navigation

import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { RippleModule } from 'primeng/ripple';
import { MenuItem } from 'primeng/api';

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
  template: `
    <header class="header">
      <div class="header__left">
        <!-- Mobile menu toggle -->
        <button 
          pButton 
          pRipple
          type="button"
          icon="pi pi-bars"
          class="p-button-text p-button-rounded header__menu-btn"
          (click)="toggleSidebar.emit()"
          aria-label="Toggle sidebar"
        ></button>
        
        <!-- Logo (mobile only) -->
        <a routerLink="/" class="header__logo md:hidden">
          <span class="header__logo-icon">
            <i class="pi pi-book"></i>
          </span>
          <span class="header__logo-text">Tutor Desk</span>
        </a>
      </div>
      
      <div class="header__center">
        <!-- Search (placeholder for future) -->
        <div class="header__search hidden md:flex">
          <i class="pi pi-search"></i>
          <input 
            type="text" 
            placeholder="Search..." 
            class="header__search-input"
          />
          <kbd class="header__search-kbd">⌘K</kbd>
        </div>
      </div>
      
      <div class="header__right">
        <!-- Notifications -->
        <button 
          pButton 
          pRipple
          type="button"
          icon="pi pi-bell"
          class="p-button-text p-button-rounded"
          pBadge
          value="3"
          severity="danger"
          aria-label="Notifications"
        ></button>
        
        <!-- Theme toggle -->
        <button 
          pButton 
          pRipple
          type="button"
          [icon]="darkMode() ? 'pi pi-sun' : 'pi pi-moon'"
          class="p-button-text p-button-rounded"
          (click)="toggleTheme()"
          aria-label="Toggle theme"
        ></button>
        
        <!-- User menu -->
        <div class="header__user">
          <p-avatar 
            icon="pi pi-user" 
            shape="circle"
            [style]="{ 'background-color': 'var(--td-primary)', 'color': 'white' }"
            (click)="userMenu.toggle($event)"
            class="cursor-pointer"
          />
          <p-menu 
            #userMenu 
            [model]="userMenuItems" 
            [popup]="true"
            appendTo="body"
          />
        </div>
      </div>
    </header>
  `,
  styles: `
    .header {
      grid-area: header;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0 1.5rem;
      background: var(--td-surface);
      border-bottom: 1px solid var(--p-surface-200);
      position: sticky;
      top: 0;
      z-index: 100;
      height: var(--td-header-height);
    }
    
    .header__left,
    .header__right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .header__center {
      flex: 1;
      display: flex;
      justify-content: center;
      max-width: 600px;
      margin: 0 auto;
    }
    
    .header__menu-btn {
      display: none;
      
      @media (max-width: 768px) {
        display: flex;
      }
    }
    
    .header__logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      color: var(--td-text);
      font-weight: 600;
    }
    
    .header__logo-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: var(--td-primary);
      color: white;
      border-radius: var(--td-radius-md);
      
      i {
        font-size: 1rem;
      }
    }
    
    .header__search {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      max-width: 400px;
      padding: 0.5rem 1rem;
      background: var(--td-background);
      border: 1px solid var(--p-surface-200);
      border-radius: var(--td-radius-lg);
      transition: all var(--td-transition-fast);
      
      &:focus-within {
        border-color: var(--td-primary);
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
      }
      
      i {
        color: var(--td-text-secondary);
      }
    }
    
    .header__search-input {
      flex: 1;
      border: none;
      background: none;
      outline: none;
      font-size: 0.875rem;
      color: var(--td-text);
      
      &::placeholder {
        color: var(--td-text-secondary);
      }
    }
    
    .header__search-kbd {
      padding: 0.125rem 0.5rem;
      font-size: 0.75rem;
      font-family: monospace;
      background: var(--p-surface-100);
      border: 1px solid var(--p-surface-200);
      border-radius: var(--td-radius-sm);
      color: var(--td-text-secondary);
    }
    
    .header__user {
      margin-left: 0.5rem;
    }
    
    @media (max-width: 768px) {
      .header {
        padding: 0 1rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
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
    this.darkMode.update(dark => !dark);
    document.documentElement.classList.toggle('dark-mode', this.darkMode());
  }
  
  private signOut(): void {
    // TODO: Implement sign out
    console.log('Sign out');
  }
}
