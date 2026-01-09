// @REVIEW: Footer Component
// Simple footer with links and copyright

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  template: `
    <footer class="footer">
      <div class="footer__content">
        <div class="footer__copyright">
          <span>&copy; {{ currentYear }} Tutor Desk. All rights reserved.</span>
        </div>
        
        <div class="footer__links">
          <a routerLink="/privacy">Privacy Policy</a>
          <span class="footer__divider">|</span>
          <a routerLink="/terms">Terms of Service</a>
          <span class="footer__divider">|</span>
          <a routerLink="/contact">Contact</a>
        </div>
      </div>
    </footer>
  `,
  styles: `
    .footer {
      padding: 1rem 1.5rem;
      background: var(--td-surface);
      border-top: 1px solid var(--p-surface-200);
      margin-top: auto;
    }
    
    .footer__content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      font-size: 0.875rem;
      color: var(--td-text-secondary);
    }
    
    .footer__links {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      
      a {
        color: var(--td-text-secondary);
        text-decoration: none;
        transition: color var(--td-transition-fast);
        
        &:hover {
          color: var(--td-primary);
        }
      }
    }
    
    .footer__divider {
      color: var(--p-surface-300);
    }
    
    @media (max-width: 768px) {
      .footer__content {
        flex-direction: column;
        text-align: center;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  readonly currentYear = new Date().getFullYear();
}
