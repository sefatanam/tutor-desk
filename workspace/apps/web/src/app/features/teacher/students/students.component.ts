// @REVIEW: Teacher Students Management - Refactored to use navigation instead of dialogs
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
import { Table } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SelectModule } from 'primeng/select';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { StudentWithUser } from '../../../core/models';

@Component({
  selector: 'app-students',
  // @NOT-NEED: Removed dialog, form-related imports (DialogModule, FloatLabelModule, DatePickerModule, ReactiveFormsModule, Validators, FormBuilder)
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    ButtonModule,
    TagModule,
    AvatarModule,
    TooltipModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    SelectModule,
    ConfirmDialogModule,
    ToastModule,
    SkeletonModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './students.component.html',
  styles: `
    .students-page { padding: 1.5rem; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
    .page-header__title { margin: 0 0 0.5rem; font-size: 1.75rem; font-weight: 600; }
    .page-header__subtitle { margin: 0; color: var(--text-color-secondary); }
    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    :host ::ng-deep .stat-card .p-card-body { padding: 1rem; }
    .stat-card__content { display: flex; align-items: center; gap: 1rem; }
    .stat-card__icon { display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; color: white; font-size: 1.25rem; }
    .stat-card__text { display: flex; flex-direction: column; }
    .stat-card__value { font-size: 1.5rem; font-weight: 700; }
    .stat-card__label { font-size: 0.875rem; color: var(--text-color-secondary); }
    .table-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid var(--surface-border); }
    .table-header__title { margin: 0; font-size: 1.125rem; font-weight: 600; }
    .table-header__filters { display: flex; gap: 1rem; }
    :host ::ng-deep .status-filter { min-width: 180px; }
    .student-cell { display: flex; align-items: center; gap: 0.75rem; }
    .student-cell__info { display: flex; flex-direction: column; }
    .student-cell__name { font-weight: 500; }
    .student-cell__email { font-size: 0.875rem; color: var(--text-color-secondary); }
    .score-badge { font-weight: 600; }
    .score-badge--good { color: var(--green-600); }
    .score-badge--avg { color: var(--yellow-600); }
    .score-badge--low { color: var(--red-600); }
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
export class StudentsComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  // @REVIEW: DestroyRef for subscription cleanup
  private readonly destroyRef = inject(DestroyRef);

  // @REVIEW: Table reference for global filtering
  readonly dt = viewChild<Table>('dt');

  // State
  readonly loading = signal(true);
  readonly loadingStats = signal(true);
  readonly students = signal<StudentWithUser[]>([]);

  globalFilter = '';
  selectedStatus: string | null = null;

  readonly statusOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Disabled', value: 'disabled' },
    { label: 'Pending', value: 'pending' },
  ];

  readonly teacherId = computed(() => this.authStore.teacherId());

  readonly statsCards = computed(() => {
    const allStudents = this.students();
    const activeCount = allStudents.filter(
      (s) => s.user.status === 'active'
    ).length;
    const disabledCount = allStudents.filter(
      (s) => s.user.status === 'disabled'
    ).length;
    const avgScore =
      allStudents.length > 0
        ? allStudents.reduce((sum, s) => sum + s.averageScore, 0) /
          allStudents.length
        : 0;

    return [
      {
        icon: 'pi pi-users',
        label: 'Total Students',
        value: allStudents.length.toString(),
        color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      },
      {
        icon: 'pi pi-check-circle',
        label: 'Active',
        value: activeCount.toString(),
        color: 'linear-gradient(135deg, #10b981, #059669)',
      },
      {
        icon: 'pi pi-ban',
        label: 'Disabled',
        value: disabledCount.toString(),
        color: 'linear-gradient(135deg, #f59e0b, #d97706)',
      },
      {
        icon: 'pi pi-chart-line',
        label: 'Avg Score',
        value: `${Math.round(avgScore)}%`,
        color: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      },
    ];
  });

  ngOnInit(): void {
    this.loadStudents();
  }

  loadStudents(): void {
    const teacherId = this.teacherId();
    if (!teacherId) {
      this.loading.set(false);
      this.loadingStats.set(false);
      return;
    }

    this.loading.set(true);
    this.db.students
      .getByTeacher(teacherId, { page: 1, pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          let filtered = response.items;
          if (this.selectedStatus) {
            filtered = filtered.filter(
              (s) => s.user.status === this.selectedStatus
            );
          }
          this.students.set(filtered);
          this.loading.set(false);
          this.loadingStats.set(false);
        },
        error: (err) => {
          console.error('Failed to load students:', err);
          this.loading.set(false);
          this.loadingStats.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load students.',
          });
        },
      });
  }

  // @REVIEW: Navigation methods (replaces dialog methods)
  navigateToCreate(): void {
    this.router.navigate(['/teacher/students/create']);
  }

  navigateToDetail(student: StudentWithUser): void {
    this.router.navigate(['/teacher/students', student.id]);
  }

  navigateToEdit(student: StudentWithUser): void {
    this.router.navigate(['/teacher/students', student.id, 'edit']);
  }

  confirmDisable(student: StudentWithUser): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to disable ${student.user.fullName}? They will not be able to log in.`,
      header: 'Confirm Disable',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-warning',
      accept: () => {
        this.db.students
          .disable(student.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.loadStudents();
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Student disabled successfully.',
              });
            },
            error: (err) => {
              console.error('Failed to disable student:', err);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to disable student.',
              });
            },
          });
      },
    });
  }

  confirmEnable(student: StudentWithUser): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to enable ${student.user.fullName}?`,
      header: 'Confirm Enable',
      icon: 'pi pi-question-circle',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => {
        this.db.students
          .enable(student.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.loadStudents();
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Student enabled successfully.',
              });
            },
            error: (err) => {
              console.error('Failed to enable student:', err);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to enable student.',
              });
            },
          });
      },
    });
  }

  confirmDelete(student: StudentWithUser): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to permanently delete ${student.user.fullName}? This action cannot be undone.`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.db.students
          .delete(student.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.loadStudents();
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Student deleted successfully.',
              });
            },
            error: (err) => {
              console.error('Failed to delete student:', err);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to delete student.',
              });
            },
          });
      },
    });
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getAvatarColor(id: string): string {
    const colors = [
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#8b5cf6',
      '#ec4899',
      '#06b6d4',
      '#84cc16',
      '#f97316',
    ];
    const hash = id
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  getStatusSeverity(
    status: string
  ): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    const severityMap: Record<
      string,
      'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast'
    > = {
      active: 'success',
      pending: 'warn',
      disabled: 'danger',
    };
    return severityMap[status] ?? 'secondary';
  }
}
