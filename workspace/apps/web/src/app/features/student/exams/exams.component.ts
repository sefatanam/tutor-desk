// @REVIEW: Student Available Exams - Full implementation
import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { ExamWithSubject, ExamSubmission } from '../../../core/models';

// @REVIEW: Exam card data with submission status
interface ExamCard {
  readonly exam: ExamWithSubject;
  readonly submission: ExamSubmission | null;
  readonly canTake: boolean;
  readonly canResume: boolean;
  readonly isCompleted: boolean;
  readonly attemptsUsed: number;
  readonly attemptsRemaining: number;
}

@Component({
  selector: 'app-exams',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './exams.component.html',
  styles: `
    .exams-page { padding: 1.5rem; }
    
    /* Page Header */
    .page-header { margin-bottom: 1.5rem; }
    .page-header__title { margin: 0 0 0.25rem; font-size: 1.75rem; font-weight: 600; }
    .page-header__subtitle { margin: 0; color: var(--text-color-secondary); }
    
    /* Stats Row */
    .stats-row { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 1rem; 
      margin-bottom: 1.5rem; 
    }
    :host ::ng-deep .stat-card { height: 100%; }
    :host ::ng-deep .stat-card .p-card-body { padding: 1rem; }
    .stat-card__content { display: flex; align-items: center; gap: 1rem; }
    .stat-card__icon { 
      width: 48px; height: 48px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 1.25rem;
    }
    .stat-card__text { display: flex; flex-direction: column; }
    .stat-card__value { font-size: 1.5rem; font-weight: 600; line-height: 1.2; }
    .stat-card__label { font-size: 0.875rem; color: var(--text-color-secondary); }
    
    /* Filter Section */
    .filter-section { 
      display: flex; 
      flex-wrap: wrap; 
      gap: 1rem; 
      align-items: center; 
      margin-bottom: 1.5rem; 
    }
    .filter-input { min-width: 280px; }
    .filter-tabs { display: flex; gap: 0.25rem; background: var(--surface-100); padding: 0.25rem; border-radius: 8px; }
    .filter-tab { 
      padding: 0.5rem 1rem; 
      border: none; 
      background: transparent; 
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      color: var(--text-color-secondary);
      transition: all 0.2s;
    }
    .filter-tab:hover { background: var(--surface-200); }
    .filter-tab--active { background: var(--primary-color); color: white; }
    
    /* Exams Grid */
    .exams-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); 
      gap: 1.5rem; 
    }
    :host ::ng-deep .exam-card { height: 100%; }
    :host ::ng-deep .exam-card .p-card-body { padding: 0; display: flex; flex-direction: column; height: 100%; }
    :host ::ng-deep .exam-card .p-card-content { flex: 1; display: flex; flex-direction: column; }
    
    .exam-card__header { padding: 1.25rem 1.25rem 0; }
    .exam-card__title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem; }
    .exam-card__title { margin: 0; font-size: 1.125rem; font-weight: 600; }
    .exam-card__subject { 
      display: inline-flex; 
      align-items: center; 
      gap: 0.375rem; 
      font-size: 0.875rem; 
      font-weight: 500;
    }
    
    .exam-card__body { padding: 1rem 1.25rem; flex: 1; display: flex; flex-direction: column; gap: 0.75rem; }
    .exam-card__description { 
      margin: 0; 
      font-size: 0.875rem; 
      color: var(--text-color-secondary);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    .exam-card__meta { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .meta-item { 
      display: flex; 
      align-items: center; 
      gap: 0.375rem; 
      font-size: 0.8125rem;
      color: var(--text-color-secondary);
    }
    .meta-item i { font-size: 0.875rem; }
    
    .exam-card__schedule { font-size: 0.8125rem; color: var(--text-color-secondary); }
    .schedule-item { display: flex; gap: 0.5rem; }
    .schedule-label { font-weight: 500; }
    
    .exam-card__result { 
      display: flex; 
      align-items: center; 
      gap: 1rem;
      padding: 0.75rem;
      background: var(--surface-100);
      border-radius: 8px;
    }
    .result-score { display: flex; align-items: baseline; gap: 0.25rem; }
    .result-score__value { font-size: 1.5rem; font-weight: 700; color: var(--red-500); }
    .result-score--pass .result-score__value { color: var(--green-500); }
    .result-score__label { font-size: 0.875rem; color: var(--text-color-secondary); }
    .result-percentage { font-size: 1.125rem; font-weight: 600; color: var(--text-color-secondary); }
    
    .exam-card__attempts { 
      font-size: 0.8125rem; 
      color: var(--text-color-secondary);
    }
    .attempts-remaining { color: var(--primary-color); }
    
    .exam-card__footer { 
      padding: 1rem 1.25rem; 
      border-top: 1px solid var(--surface-200);
      display: flex;
      justify-content: flex-end;
    }
    
    /* Empty State */
    .empty-state { 
      grid-column: 1 / -1;
      text-align: center; 
      padding: 4rem 2rem;
      background: var(--surface-card);
      border-radius: 12px;
    }
    .empty-state__icon { font-size: 4rem; color: var(--primary-color); opacity: 0.5; margin-bottom: 1rem; }
    .empty-state__title { margin: 0 0 0.5rem; font-size: 1.25rem; }
    .empty-state__text { margin: 0 0 1.5rem; color: var(--text-color-secondary); }
    
    /* Instructions Dialog */
    .instructions-dialog { display: flex; flex-direction: column; gap: 1.5rem; }
    .instructions-header { display: flex; justify-content: space-between; align-items: center; }
    .instructions-header h3 { margin: 0; font-size: 1.25rem; }
    
    .instructions-stats { 
      display: grid; 
      grid-template-columns: repeat(2, 1fr); 
      gap: 1rem;
      padding: 1rem;
      background: var(--surface-100);
      border-radius: 8px;
    }
    .instructions-stats .stat { display: flex; align-items: center; gap: 0.5rem; }
    .instructions-stats .stat i { color: var(--primary-color); }
    
    .instructions-content h4, .instructions-rules h4 { margin: 0 0 0.75rem; font-size: 1rem; }
    .instructions-content p { margin: 0; color: var(--text-color-secondary); }
    
    .instructions-rules ul { 
      margin: 0; 
      padding: 0; 
      list-style: none; 
      display: flex; 
      flex-direction: column; 
      gap: 0.5rem;
    }
    .instructions-rules li { 
      display: flex; 
      align-items: center; 
      gap: 0.75rem;
      color: var(--text-color-secondary);
    }
    .instructions-rules li i { color: var(--primary-color); width: 1rem; }
    
    .instructions-actions { 
      display: flex; 
      justify-content: flex-end; 
      gap: 0.75rem;
      padding-top: 1rem;
      border-top: 1px solid var(--surface-200);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamsComponent implements OnInit {
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly loading = signal(true);
  readonly starting = signal(false);
  readonly exams = signal<ExamCard[]>([]);
  readonly activeTab = signal<
    'all' | 'available' | 'in_progress' | 'completed'
  >('all');
  searchTerm = '';
  showInstructionsDialog = false;
  readonly selectedExam = signal<ExamCard | null>(null);

  // Computed
  readonly filteredExams = computed(() => {
    let result = this.exams();

    // Filter by tab
    const tab = this.activeTab();
    if (tab === 'available') {
      result = result.filter((c) => c.canTake && !c.canResume);
    } else if (tab === 'in_progress') {
      result = result.filter((c) => c.canResume);
    } else if (tab === 'completed') {
      result = result.filter((c) => c.isCompleted);
    }

    // Filter by search
    // @REVIEW: Handle nullable subject for independent exams
    const search = this.searchTerm.toLowerCase().trim();
    if (search) {
      result = result.filter(
        (c) =>
          c.exam.title.toLowerCase().includes(search) ||
          (c.exam.subject?.name?.toLowerCase().includes(search) ?? false)
      );
    }

    return result;
  });

  readonly statsCards = computed(() => {
    const cards = this.exams();
    const available = cards.filter((c) => c.canTake && !c.canResume).length;
    const inProgress = cards.filter((c) => c.canResume).length;
    const completed = cards.filter((c) => c.isCompleted).length;
    const avgScore =
      cards
        .filter((c) => c.submission?.percentage != null)
        .reduce((sum, c) => sum + (c.submission?.percentage ?? 0), 0) /
      (completed || 1);

    return [
      {
        icon: 'pi pi-file-edit',
        label: 'Available',
        value: available,
        color: 'var(--primary-color)',
      },
      {
        icon: 'pi pi-play',
        label: 'In Progress',
        value: inProgress,
        color: 'var(--orange-500)',
      },
      {
        icon: 'pi pi-check-circle',
        label: 'Completed',
        value: completed,
        color: 'var(--green-500)',
      },
      {
        icon: 'pi pi-chart-line',
        label: 'Avg Score',
        value: `${Math.round(avgScore)}%`,
        color: 'var(--blue-500)',
      },
    ];
  });

  ngOnInit(): void {
    this.loadExams();
  }

  setActiveTab(tab: 'all' | 'available' | 'in_progress' | 'completed'): void {
    this.activeTab.set(tab);
  }

  // @REVIEW: Load exams from enrolled subjects with submission status
  private loadExams(): void {
    const studentId = this.authStore.studentId();
    if (!studentId) {
      this.loading.set(false);
      return;
    }

    forkJoin({
      exams: this.db.exams.getUpcomingForStudent(studentId),
      submissions: this.db.submissions.getByStudent(studentId, {
        page: 1,
        pageSize: 100,
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ exams, submissions }) => {
          // Build submission map by exam ID
          const submissionMap = new Map<string, ExamSubmission>();
          submissions.items.forEach((s) => {
            const existing = submissionMap.get(s.examId);
            // Keep latest submission (highest attempt number)
            if (!existing || s.attemptNumber > existing.attemptNumber) {
              submissionMap.set(s.examId, s);
            }
          });

          // Map exams to cards
          const cards = exams.map((exam) =>
            this.buildExamCard(exam, submissionMap.get(exam.id) ?? null)
          );
          this.exams.set(cards);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load exams:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load exams',
          });
          this.loading.set(false);
        },
      });
  }

  // @REVIEW: Build exam card with status logic
  private buildExamCard(
    exam: ExamWithSubject,
    submission: ExamSubmission | null
  ): ExamCard {
    const now = new Date();
    const isScheduled = exam.scheduledStart && exam.scheduledEnd;
    const isWithinSchedule =
      !isScheduled ||
      (now >= exam.scheduledStart! && now <= exam.scheduledEnd!);

    const isInProgress = submission?.status === 'in_progress';
    const isCompleted =
      submission?.status === 'submitted' ||
      submission?.status === 'auto_submitted' ||
      submission?.status === 'evaluated';
    // @REVIEW: Student can only retake if teacher explicitly allowed it (status = retake_allowed)
    const canRetake = submission?.status === 'retake_allowed';

    const attemptsUsed = submission?.attemptNumber ?? 0;
    // @NOT-NEED: Old logic based on maxRetakes is removed - retakes are now teacher-controlled only
    // const maxAttempts = exam.allowRetake ? exam.maxRetakes + 1 : 1;
    // const attemptsRemaining = Math.max(0, maxAttempts - attemptsUsed);

    // @REVIEW: Determine if student can take exam
    // Can take if: no submission yet, OR teacher allowed retake (status = retake_allowed)
    const canTake =
      isWithinSchedule &&
      exam.status === 'active' &&
      (!submission || canRetake);

    const canResume = isInProgress && isWithinSchedule;

    return {
      exam,
      submission,
      canTake,
      canResume,
      isCompleted,
      attemptsUsed,
      attemptsRemaining: canRetake ? 1 : 0, // Only 1 retake available when teacher allows it
    };
  }

  getStatusLabel(card: ExamCard): string {
    if (card.canResume) return 'In Progress';
    if (card.isCompleted) return 'Completed';
    if (card.canTake) return 'Available';
    return 'Locked';
  }

  getStatusSeverity(
    card: ExamCard
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    if (card.canResume) return 'warn';
    if (card.isCompleted) return 'success';
    if (card.canTake) return 'info';
    return 'secondary';
  }

  onStartExam(card: ExamCard): void {
    this.selectedExam.set(card);
    this.showInstructionsDialog = true;
  }

  onResumeExam(card: ExamCard): void {
    // Navigate directly to exam player for in-progress exams
    this.router.navigate(['/student/exams', card.exam.id, 'take']);
  }

  confirmStartExam(): void {
    const card = this.selectedExam();
    if (!card) return;

    this.starting.set(true);
    const studentId = this.authStore.studentId();

    if (!studentId) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Student ID not found',
      });
      this.starting.set(false);
      return;
    }

    this.db.submissions
      .startExam(card.exam.id, studentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showInstructionsDialog = false;
          this.starting.set(false);
          this.router.navigate(['/student/exams', card.exam.id, 'take']);
        },
        error: (err) => {
          console.error('Failed to start exam:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to start exam. Please try again.',
          });
          this.starting.set(false);
        },
      });
  }
}
