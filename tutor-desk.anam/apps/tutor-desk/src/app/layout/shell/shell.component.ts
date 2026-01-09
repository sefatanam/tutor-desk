// @REVIEW: Main Application Shell Component
// Provides the layout structure for authenticated pages

import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FooterComponent } from '../footer/footer.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, FooterComponent],
  template: `
    <div class="shell" [class.sidebar-collapsed]="sidebarCollapsed()">
      <app-header 
        [sidebarCollapsed]="sidebarCollapsed()" 
        (toggleSidebar)="toggleSidebar()" 
      />
      
      <app-sidebar 
        [collapsed]="sidebarCollapsed()" 
        (collapsedChange)="sidebarCollapsed.set($event)" 
      />
      
      <main class="shell__content">
        <div class="shell__content-inner">
          <router-outlet />
        </div>
        <app-footer />
      </main>
    </div>
  `,
  styles: `
    .shell {
      display: grid;
      grid-template-columns: var(--td-sidebar-width) 1fr;
      grid-template-rows: var(--td-header-height) 1fr;
      grid-template-areas:
        "sidebar header"
        "sidebar content";
      min-height: 100vh;
      transition: grid-template-columns var(--td-transition-normal);
      
      &.sidebar-collapsed {
        grid-template-columns: var(--td-sidebar-collapsed-width) 1fr;
      }
    }
    
    .shell__content {
      grid-area: content;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      background: var(--td-background);
    }
    
    .shell__content-inner {
      flex: 1;
      padding: 1.5rem;
      
      @media (max-width: 768px) {
        padding: 1rem;
      }
    }
    
    /* Mobile: Stack layout */
    @media (max-width: 768px) {
      .shell {
        grid-template-columns: 1fr;
        grid-template-rows: var(--td-header-height) 1fr;
        grid-template-areas:
          "header"
          "content";
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  readonly sidebarCollapsed = signal(false);
  
  toggleSidebar(): void {
    this.sidebarCollapsed.update(collapsed => !collapsed);
  }
}
