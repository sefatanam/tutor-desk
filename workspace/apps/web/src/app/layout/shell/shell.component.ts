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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  readonly sidebarCollapsed = signal(false);
  readonly mobileSidebarVisible = signal(false);

  toggleSidebar(): void {
    if (this.isMobileViewport()) {
      this.mobileSidebarVisible.update((visible) => !visible);
      return;
    }

    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  private isMobileViewport(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 768px)').matches
    );
  }
}
