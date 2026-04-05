// @REVIEW: Teacher Exams - Refactored to use navigation instead of dialogs
import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
  viewChild,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Table } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { ExamWithSubject, Subject, ExamStatus } from '../../../core/models';
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';


@Component({
  selector: 'app-exams',
  // @NOT-NEED: Removed dialog, form-related imports - now using dedicated pages
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    ConfirmDialogModule,
    ToastModule,
    SkeletonModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './exams.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamsComponent implements OnInit {
  readonly getThemeToneClass = getThemeToneClass;
  private readonly authStore = inject(AuthStore);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // @REVIEW: Table reference for global filtering
  readonly dt = viewChild<Table>('dt');

  // State
  readonly loading = signal(true);
  readonly loadingStats = signal(true);
  readonly exams = signal<ExamWithSubject[]>([]);
  readonly subjects = signal<Subject[]>([]);

  globalFilter = '';

  readonly teacherId = computed(() => this.authStore.teacherId());

  readonly statsCards = computed(() => {
    const allExams = this.exams();
    const draftCount = allExams.filter((e) => e.status === 'draft').length;
    const activeCount = allExams.filter(
      (e) => e.status === 'active' || e.status === 'scheduled'
    ).length;
    const totalSubmissions = allExams.reduce(
      (sum, e) => sum + e.totalSubmissions,
      0
    );

    return [
      {
        icon: 'pi pi-file-edit',
        label: 'Total Exams',
        value: allExams.length.toString(),
        color: 'td-gradient-accent',
      },
      {
        icon: 'pi pi-pencil',
        label: 'Drafts',
        value: draftCount.toString(),
        color: 'td-gradient-warning',
      },
      {
        icon: 'pi pi-play',
        label: 'Active',
        value: activeCount.toString(),
        color: 'td-gradient-success',
      },
      {
        icon: 'pi pi-users',
        label: 'Submissions',
        value: totalSubmissions.toString(),
        color: 'td-gradient-info',
      },
    ];
  });

  ngOnInit(): void {
    this.loadSubjects();
    this.loadExams();
  }

  loadSubjects(): void {
    const teacherId = this.teacherId();
    if (!teacherId) return;

    this.db.subjects
      .getByTeacher(teacherId, { page: 1, pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) =>
          this.subjects.set(response.items.filter((s) => s.isActive)),
        error: (err) => console.error('Failed to load subjects:', err),
      });
  }

  loadExams(): void {
    const teacherId = this.teacherId();
    if (!teacherId) return;

    this.loading.set(true);
    this.loadingStats.set(true);

    this.db.exams
      .getByTeacher(teacherId, { page: 1, pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.exams.set(response.items);
          this.loading.set(false);
          this.loadingStats.set(false);
        },
        error: (err) => {
          console.error('Failed to load exams:', err);
          this.loading.set(false);
          this.loadingStats.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load exams.',
          });
        },
      });
  }

  getStatusLabel(status: ExamStatus): string {
    const labels: Record<ExamStatus, string> = {
      draft: 'Draft',
      scheduled: 'Scheduled',
      active: 'Active',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return labels[status] ?? status;
  }

  getStatusSeverity(
    status: ExamStatus
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const severities: Record<
      ExamStatus,
      'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'
    > = {
      draft: 'secondary',
      scheduled: 'info',
      active: 'success',
      completed: 'contrast',
      cancelled: 'danger',
    };
    return severities[status] ?? 'secondary';
  }

  // @REVIEW: Navigation methods (replaces dialog methods)
  navigateToCreate(): void {
    this.router.navigate(['/teacher/exams/create']);
  }

  navigateToEdit(exam: ExamWithSubject): void {
    this.router.navigate(['/teacher/exams', exam.id, 'edit']);
  }

  navigateToQuestions(exam: ExamWithSubject): void {
    // Navigate to exam editor - questions are managed there
    this.router.navigate(['/teacher/exams', exam.id, 'edit']);
  }

  confirmPublish(exam: ExamWithSubject): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to publish "${exam.title}"? Students will be able to take this exam once published.`,
      header: 'Confirm Publish',
      icon: 'pi pi-play',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => {
        this.db.exams
          .publish(exam.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.loadExams();
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Exam published successfully.',
              });
            },
            error: (err) => {
              console.error('Failed to publish exam:', err);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to publish exam.',
              });
            },
          });
      },
    });
  }

  confirmCancel(exam: ExamWithSubject): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to cancel "${exam.title}"? Students will no longer be able to take this exam.`,
      header: 'Confirm Cancel',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-warning',
      accept: () => {
        this.db.exams
          .cancel(exam.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.loadExams();
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Exam cancelled.',
              });
            },
            error: (err) => {
              console.error('Failed to cancel exam:', err);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to cancel exam.',
              });
            },
          });
      },
    });
  }

  confirmDelete(exam: ExamWithSubject): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${exam.title}"? This will also delete all questions. This action cannot be undone.`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.db.exams
          .delete(exam.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.loadExams();
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Exam deleted.',
              });
            },
            error: (err) => {
              console.error('Failed to delete exam:', err);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to delete exam.',
              });
            },
          });
      },
    });
  }

  // @NOT-NEED: Question management moved to exam-editor component
}
