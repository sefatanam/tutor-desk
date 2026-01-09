// @REVIEW: Student Results - Placeholder
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-results',
  imports: [CardModule],
  template: `
    <div class="page">
      <div class="page__header">
        <h1>My Results</h1>
        <p>View all your exam results and scores</p>
      </div>

      <p-card>
        <div class="placeholder">
          <i class="pi pi-chart-bar"></i>
          <h2>Results History</h2>
          <p>This feature is coming soon in Release 4</p>
        </div>
      </p-card>
    </div>
  `,
  styles: `
    .page { padding: 1.5rem; }
    .page__header { margin-bottom: 2rem; }
    .page__header h1 { margin: 0 0 0.5rem; font-size: 1.75rem; font-weight: 600; }
    .page__header p { margin: 0; color: var(--text-color-secondary); }
    .placeholder { text-align: center; padding: 4rem 2rem; }
    .placeholder i { font-size: 4rem; color: var(--primary-color); opacity: 0.5; margin-bottom: 1rem; }
    .placeholder h2 { margin: 0 0 0.5rem; font-size: 1.25rem; color: var(--text-color); }
    .placeholder p { margin: 0; color: var(--text-color-secondary); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsComponent {}
