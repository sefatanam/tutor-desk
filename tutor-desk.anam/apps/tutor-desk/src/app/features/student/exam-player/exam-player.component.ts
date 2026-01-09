// @REVIEW: Exam Player - Placeholder
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-exam-player',
  imports: [CardModule],
  template: `
    <div class="page">
      <div class="page__header">
        <h1>Exam in Progress</h1>
        <p>Focus and do your best!</p>
      </div>

      <p-card>
        <div class="placeholder">
          <i class="pi pi-play"></i>
          <h2>Exam Player</h2>
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
export class ExamPlayerComponent {}
