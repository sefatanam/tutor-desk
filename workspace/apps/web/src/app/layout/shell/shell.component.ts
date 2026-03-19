// @REVIEW: Main Application Shell Component
// Provides the layout structure for authenticated pages

import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FooterComponent } from '../footer/footer.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, FooterComponent],
  templateUrl: './shell.component.html',
  styles: `
    .shell {
      display: grid;
      grid-template-columns: var(--td-sidebar-width) 1fr;
      min-height: 100vh;
      transition: grid-template-columns var(--td-transition-normal);

      &.sidebar-collapsed {
        grid-template-columns: var(--td-sidebar-collapsed-width) 1fr;
      }
    }

    .shell__main {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      overflow-x: hidden;
    }

    .shell__content {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: var(--td-background);
    }

    .shell__content-inner {
      flex: 1;
      padding: 1.5rem;

      @media (max-width: 768px) {
        padding: 1rem;
      }
    }

    /* Mobile: Sidebar becomes overlay/hidden */
    @media (max-width: 768px) {
      .shell {
        grid-template-columns: 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  readonly sidebarCollapsed = signal(false);

  toggleSidebar(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }
}
