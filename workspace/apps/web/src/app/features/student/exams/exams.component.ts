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
import { getThemeToneClass, getThemeTextToneClass } from '../../../core/utils/theme-tone.util';


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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamsComponent implements OnInit {
  readonly getThemeToneClass = getThemeToneClass;
  readonly getThemeTextToneClass = getThemeTextToneClass;
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
