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
        color: 'td-gradient-info',
      },
      {
        icon: 'pi pi-check-circle',
        label: 'Active',
        value: activeCount.toString(),
        color: 'td-gradient-success',
      },
      {
        icon: 'pi pi-ban',
        label: 'Disabled',
        value: disabledCount.toString(),
        color: 'td-gradient-warning',
      },
      {
        icon: 'pi pi-chart-line',
        label: 'Avg Score',
        value: `${Math.round(avgScore)}%`,
        color: 'td-gradient-accent',
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
      'td-tone-info',
      'td-tone-success',
      'td-tone-warning',
      'td-tone-accent',
      'td-tone-accent',
      'td-tone-info',
      'td-tone-success',
      'td-tone-warning',
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
