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
  template: `
    <div class="exams-page">
      <!-- Page Header -->
      <header class="page-header">
        <div class="page-header__content">
          <h1 class="page-header__title">My Exams</h1>
          <p class="page-header__subtitle">Create and manage your exams</p>
        </div>
        <div class="page-header__actions">
          <p-button
            label="Create Exam"
            icon="pi pi-plus"
            (click)="navigateToCreate()"
            [disabled]="subjects().length === 0"
          />
        </div>
      </header>

      <!-- Stats Cards -->
      <section class="stats-row">
        @if (loadingStats()) { @for (i of [1, 2, 3, 4]; track i) {
        <p-card styleClass="stat-card">
          <div class="stat-card__content">
            <p-skeleton shape="circle" size="48px" />
            <div class="stat-card__text">
              <p-skeleton width="40px" height="24px" />
              <p-skeleton width="80px" height="14px" />
            </div>
          </div>
        </p-card>
        } } @else { @for (stat of statsCards(); track stat.label) {
        <p-card styleClass="stat-card">
          <div class="stat-card__content">
            <div class="stat-card__icon" [style.background]="stat.color">
              <i [class]="stat.icon"></i>
            </div>
            <div class="stat-card__text">
              <span class="stat-card__value">{{ stat.value }}</span>
              <span class="stat-card__label">{{ stat.label }}</span>
            </div>
          </div>
        </p-card>
        } }
      </section>

      <!-- Exams Table -->
      <p-card styleClass="exams-table-card">
        <ng-template #header>
          <div class="table-header">
            <h2 class="table-header__title">All Exams</h2>
            <div class="table-header__filters">
              <p-iconfield>
                <p-inputicon styleClass="pi pi-search" />
                <input
                  type="text"
                  pInputText
                  placeholder="Search exams..."
                  [(ngModel)]="globalFilter"
                  (input)="dt()?.filterGlobal(globalFilter, 'contains')"
                />
              </p-iconfield>
            </div>
          </div>
        </ng-template>

        @if (loading()) {
        <div class="skeleton-table">
          @for (i of [1, 2, 3, 4, 5]; track i) {
          <div class="skeleton-row">
            <p-skeleton width="200px" height="16px" />
            <p-skeleton width="120px" height="16px" />
            <p-skeleton width="80px" height="16px" />
            <p-skeleton width="60px" height="16px" />
            <p-skeleton width="80px" height="24px" borderRadius="16px" />
            <p-skeleton width="100px" height="32px" />
          </div>
          }
        </div>
        } @else if (subjects().length === 0) {
        <div class="empty-state">
          <i class="pi pi-book empty-state__icon"></i>
          <h3 class="empty-state__title">No subjects yet</h3>
          <p class="empty-state__text">
            You need to create a subject before creating exams
          </p>
          <p-button
            label="Go to Subjects"
            icon="pi pi-arrow-right"
            routerLink="/teacher/subjects"
          />
        </div>
        } @else if (exams().length === 0) {
        <div class="empty-state">
          <i class="pi pi-file-edit empty-state__icon"></i>
          <h3 class="empty-state__title">No exams yet</h3>
          <p class="empty-state__text">Start by creating your first exam</p>
          <p-button
            label="Create Exam"
            icon="pi pi-plus"
            (click)="navigateToCreate()"
          />
        </div>
        } @else {
        <p-table
          #dt
          [value]="exams()"
          [paginator]="true"
          [rows]="10"
          [rowsPerPageOptions]="[10, 25, 50]"
          [globalFilterFields]="['title', 'subject.name', 'description']"
          [rowHover]="true"
          dataKey="id"
          styleClass="p-datatable-sm"
          [showCurrentPageReport]="true"
          currentPageReportTemplate="Showing {first} to {last} of {totalRecords} exams"
        >
          <ng-template #header>
            <tr>
              <th pSortableColumn="title" style="min-width: 200px">
                Exam Title <p-sortIcon field="title" />
              </th>
              <th style="min-width: 140px">Subject</th>
              <th style="min-width: 100px" class="text-center">Questions</th>
              <th style="min-width: 100px" class="text-center">Time/Q</th>
              <th style="min-width: 120px" class="text-center">Submissions</th>
              <th pSortableColumn="status" style="min-width: 100px">
                Status <p-sortIcon field="status" />
              </th>
              <th style="width: 160px" class="text-center">Actions</th>
            </tr>
          </ng-template>

          <ng-template #body let-exam>
            <tr>
              <td>
                <div class="exam-cell">
                  <span class="exam-cell__title">{{ exam.title }}</span>
                  @if (exam.description) {
                  <span class="exam-cell__desc"
                    >{{ exam.description | slice : 0 : 50
                    }}{{ exam.description.length > 50 ? '...' : '' }}</span
                  >
                  }
                </div>
              </td>
              <td>
                <div
                  class="subject-badge"
                  [style.background]="exam.subject.color"
                >
                  <i [class]="'pi ' + exam.subject.icon"></i>
                  <span>{{ exam.subject.name }}</span>
                </div>
              </td>
              <td class="text-center">{{ exam.totalQuestions }}</td>
              <td class="text-center">{{ exam.timePerQuestionSeconds }}s</td>
              <td class="text-center">{{ exam.totalSubmissions }}</td>
              <td>
                <p-tag
                  [value]="getStatusLabel(exam.status)"
                  [severity]="getStatusSeverity(exam.status)"
                  [rounded]="true"
                />
              </td>
              <td>
                <div class="action-buttons">
                  <p-button
                    icon="pi pi-pencil"
                    severity="secondary"
                    [text]="true"
                    size="small"
                    [rounded]="true"
                    pTooltip="Edit"
                    tooltipPosition="top"
                    (click)="navigateToEdit(exam)"
                    [disabled]="exam.status !== 'draft'"
                  />
                  @if (exam.status === 'draft') {
                  <p-button
                    icon="pi pi-play"
                    severity="success"
                    [text]="true"
                    size="small"
                    [rounded]="true"
                    pTooltip="Publish"
                    tooltipPosition="top"
                    (click)="confirmPublish(exam)"
                    [disabled]="exam.totalQuestions === 0"
                  />
                  } @if (exam.status === 'active' || exam.status ===
                  'scheduled') {
                  <p-button
                    icon="pi pi-times"
                    severity="warn"
                    [text]="true"
                    size="small"
                    [rounded]="true"
                    pTooltip="Cancel"
                    tooltipPosition="top"
                    (click)="confirmCancel(exam)"
                  />
                  }
                  <p-button
                    icon="pi pi-list"
                    severity="info"
                    [text]="true"
                    size="small"
                    [rounded]="true"
                    pTooltip="Questions"
                    tooltipPosition="top"
                    (click)="navigateToQuestions(exam)"
                  />
                  <p-button
                    icon="pi pi-trash"
                    severity="danger"
                    [text]="true"
                    size="small"
                    [rounded]="true"
                    pTooltip="Delete"
                    tooltipPosition="top"
                    (click)="confirmDelete(exam)"
                    [disabled]="exam.totalSubmissions > 0"
                  />
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>
        }
      </p-card>
    </div>

    <!-- @NOT-NEED: Dialogs removed - now using dedicated pages for create/edit/questions -->

    <p-confirmDialog />
    <p-toast />
  `,
  styles: `
    .exams-page { padding: 1.5rem; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
    .page-header__title { margin: 0 0 0.5rem; font-size: 1.75rem; font-weight: 600; }
    .page-header__subtitle { margin: 0; color: var(--text-color-secondary); }
    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    :host ::ng-deep .stat-card .p-card-body { padding: 1rem; }
    .stat-card__content { display: flex; align-items: center; gap: 1rem; }
    .stat-card__icon { display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; color: white; font-size: 1.25rem; }
    .stat-card__text { display: flex; flex-direction: column; }
    .stat-card__value { font-size: 1.5rem; font-weight: 700; }
    .stat-card__label { font-size: 0.875rem; color: var(--text-color-secondary); }
    .table-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid var(--surface-border); }
    .table-header__title { margin: 0; font-size: 1.125rem; font-weight: 600; }
    .table-header__filters { display: flex; gap: 1rem; }
    .exam-cell { display: flex; flex-direction: column; }
    .exam-cell__title { font-weight: 500; }
    .exam-cell__desc { font-size: 0.875rem; color: var(--text-color-secondary); }
    .subject-badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.75rem; border-radius: 16px; color: white; font-size: 0.875rem; }
    .subject-badge i { font-size: 0.75rem; }
    .action-buttons { display: flex; justify-content: center; gap: 0.25rem; }
    .text-center { text-align: center; }
    .skeleton-table { display: flex; flex-direction: column; gap: 1rem; padding: 1rem; }
    .skeleton-row { display: flex; align-items: center; gap: 2rem; padding: 0.75rem 0; border-bottom: 1px solid var(--surface-border); }
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; text-align: center; }
    .empty-state__icon { font-size: 4rem; color: var(--text-color-secondary); opacity: 0.5; margin-bottom: 1rem; }
    .empty-state__title { margin: 0 0 0.5rem; font-size: 1.25rem; }
    .empty-state__text { margin: 0 0 1.5rem; color: var(--text-color-secondary); }
    /* @NOT-NEED: Form/dialog styles removed - now using dedicated pages */
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamsComponent implements OnInit {
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
        color: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      },
      {
        icon: 'pi pi-pencil',
        label: 'Drafts',
        value: draftCount.toString(),
        color: 'linear-gradient(135deg, #f59e0b, #d97706)',
      },
      {
        icon: 'pi pi-play',
        label: 'Active',
        value: activeCount.toString(),
        color: 'linear-gradient(135deg, #10b981, #059669)',
      },
      {
        icon: 'pi pi-users',
        label: 'Submissions',
        value: totalSubmissions.toString(),
        color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
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
