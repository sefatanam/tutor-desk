// @REVIEW: Teachers Management - Full Implementation
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
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
import { TeacherWithUser } from '../../../core/models';

@Component({
  selector: 'app-teachers',
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
  templateUrl: './teachers.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService, MessageService],
})
export class TeachersComponent implements OnInit {
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  // @REVIEW: DestroyRef for subscription cleanup
  private readonly destroyRef = inject(DestroyRef);

  // State signals
  protected readonly teachers = signal<TeacherWithUser[]>([]);
  protected readonly loading = signal(true);
  protected readonly globalFilter = signal('');
  protected selectedStatus: string | null = null;

  // Computed stats cards
  protected readonly statsCards = computed(() => {
    const all = this.teachers();
    const pending = all.filter((t) => t.user.status === 'pending').length;
    const active = all.filter((t) => t.user.status === 'active').length;
    const disabled = all.filter((t) => t.user.status === 'disabled').length;

    return [
      {
        label: 'Total Teachers',
        value: all.length,
        icon: 'pi pi-users',
        color: 'td-gradient-info',
      },
      {
        label: 'Pending Approval',
        value: pending,
        icon: 'pi pi-clock',
        color: 'td-gradient-warning',
      },
      {
        label: 'Active',
        value: active,
        icon: 'pi pi-check-circle',
        color: 'td-gradient-success',
      },
      {
        label: 'Disabled',
        value: disabled,
        icon: 'pi pi-ban',
        color: 'td-gradient-danger',
      },
    ];
  });

  // Status filter options
  protected readonly statusOptions = [
    { label: 'Pending', value: 'pending' },
    { label: 'Active', value: 'active' },
    { label: 'Disabled', value: 'disabled' },
  ];

  // Skeleton rows for loading state
  protected readonly skeletonRows = Array(5).fill(0);

  // Avatar colors
  private readonly avatarColors = [
    'td-tone-info',
    'td-tone-success',
    'td-tone-warning',
    'td-tone-accent',
    'td-tone-accent',
    'td-tone-info',
  ];

  ngOnInit(): void {
    this.loadTeachers();
  }

  protected loadTeachers(): void {
    this.loading.set(true);
    this.db.teachers
      .getAll({ pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          let filtered = response.items;
          if (this.selectedStatus) {
            filtered = filtered.filter(
              (t) => t.user.status === this.selectedStatus
            );
          }
          this.teachers.set(filtered);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load teachers:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load teachers',
          });
          this.loading.set(false);
        },
      });
  }

  protected onGlobalFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.globalFilter.set(value);
  }

  protected getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  protected getAvatarColor(id: string): string {
    const index = id.charCodeAt(0) % this.avatarColors.length;
    return this.avatarColors[index];
  }

  protected getStatusSeverity(
    status: string
  ): 'success' | 'warn' | 'danger' | 'info' | 'secondary' | 'contrast' {
    const map: Record<string, 'success' | 'warn' | 'danger'> = {
      active: 'success',
      pending: 'warn',
      disabled: 'danger',
    };
    return map[status] ?? 'secondary';
  }

  protected confirmApprove(teacher: TeacherWithUser): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to approve ${teacher.user.fullName}?`,
      header: 'Approve Teacher',
      icon: 'pi pi-check-circle',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => this.approveTeacher(teacher),
    });
  }

  protected confirmReject(teacher: TeacherWithUser): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to reject ${teacher.user.fullName}? This action cannot be undone.`,
      header: 'Reject Teacher',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.rejectTeacher(teacher),
    });
  }

  protected confirmDisable(teacher: TeacherWithUser): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to disable ${teacher.user.fullName}?`,
      header: 'Disable Teacher',
      icon: 'pi pi-ban',
      acceptButtonStyleClass: 'p-button-warning',
      accept: () => this.disableTeacher(teacher),
    });
  }

  protected confirmEnable(teacher: TeacherWithUser): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to enable ${teacher.user.fullName}?`,
      header: 'Enable Teacher',
      icon: 'pi pi-check-circle',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => this.enableTeacher(teacher),
    });
  }

  private approveTeacher(teacher: TeacherWithUser): void {
    const adminId = this.authStore.user()?.id;
    if (!adminId) return;

    this.db.teachers
      .approve(teacher.id, adminId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `${teacher.user.fullName} has been approved`,
          });
          this.loadTeachers();
        },
        error: (err) => {
          console.error('Failed to approve teacher:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to approve teacher',
          });
        },
      });
  }

  private rejectTeacher(teacher: TeacherWithUser): void {
    // For rejection, we disable the user
    this.db.users
      .updateStatus(teacher.user.id, 'disabled')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `${teacher.user.fullName} has been rejected`,
          });
          this.loadTeachers();
        },
        error: (err) => {
          console.error('Failed to reject teacher:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to reject teacher',
          });
        },
      });
  }

  private disableTeacher(teacher: TeacherWithUser): void {
    this.db.teachers
      .disable(teacher.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `${teacher.user.fullName} has been disabled`,
          });
          this.loadTeachers();
        },
        error: (err) => {
          console.error('Failed to disable teacher:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to disable teacher',
          });
        },
      });
  }

  private enableTeacher(teacher: TeacherWithUser): void {
    this.db.teachers
      .enable(teacher.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `${teacher.user.fullName} has been enabled`,
          });
          this.loadTeachers();
        },
        error: (err) => {
          console.error('Failed to enable teacher:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to enable teacher',
          });
        },
      });
  }

  // @REVIEW: Navigate to teacher workspace to view their subjects, students, exams
  protected viewWorkspace(teacher: TeacherWithUser): void {
    this.router.navigate(['/admin/teachers', teacher.id, 'workspace']);
  }
}
