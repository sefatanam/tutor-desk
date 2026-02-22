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
  template: `
    <div class="teachers-page">
      <!-- Page Header -->
      <header class="page-header">
        <div class="page-header__content">
          <h1 class="page-header__title">Teachers Management</h1>
          <p class="page-header__subtitle">
            View, approve and manage all teachers in the system
          </p>
        </div>
        <div class="page-header__actions">
          <p-button
            label="Refresh"
            icon="pi pi-refresh"
            severity="secondary"
            [outlined]="true"
            (click)="loadTeachers()"
            [loading]="loading()"
          />
        </div>
      </header>

      <!-- Stats Cards -->
      <section class="stats-row">
        @for (stat of statsCards(); track stat.label) {
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
        }
      </section>

      <!-- Teachers Table -->
      <p-card styleClass="teachers-table-card">
        <ng-template #header>
          <div class="table-header">
            <h2 class="table-header__title">All Teachers</h2>
            <div class="table-header__filters">
              <p-iconfield>
                <p-inputicon styleClass="pi pi-search" />
                <input
                  type="text"
                  pInputText
                  placeholder="Search teachers..."
                  [value]="globalFilter()"
                  (input)="onGlobalFilter($event)"
                />
              </p-iconfield>
              <p-select
                [options]="statusOptions"
                [(ngModel)]="selectedStatus"
                placeholder="Filter by status"
                [showClear]="true"
                (onChange)="loadTeachers()"
                styleClass="status-filter"
              />
            </div>
          </div>
        </ng-template>

        <p-table
          #dt
          [value]="teachers()"
          [paginator]="true"
          [rows]="10"
          [rowsPerPageOptions]="[10, 25, 50]"
          [loading]="loading()"
          [globalFilterFields]="[
            'user.fullName',
            'user.email',
            'qualification',
            'specialization'
          ]"
          [rowHover]="true"
          dataKey="id"
          styleClass="p-datatable-sm"
          [showCurrentPageReport]="true"
          currentPageReportTemplate="Showing {first} to {last} of {totalRecords} teachers"
        >
          <ng-template #header>
            <tr>
              <th pSortableColumn="user.fullName" style="min-width: 250px">
                Teacher
                <p-sortIcon field="user.fullName" />
              </th>
              <th style="min-width: 150px">Qualification</th>
              <th style="min-width: 100px" class="text-center">Students</th>
              <th pSortableColumn="user.status" style="min-width: 120px">
                Status
                <p-sortIcon field="user.status" />
              </th>
              <th pSortableColumn="createdAt" style="min-width: 120px">
                Joined
                <p-sortIcon field="createdAt" />
              </th>
              <th style="width: 140px" class="text-center">Actions</th>
            </tr>
          </ng-template>

          <ng-template #body let-teacher>
            <tr>
              <td>
                <div class="teacher-cell">
                  <p-avatar
                    [label]="getInitials(teacher.user.fullName)"
                    shape="circle"
                    [style]="{
                      background: getAvatarColor(teacher.id),
                      color: '#ffffff',
                      fontWeight: '600'
                    }"
                  />
                  <div class="teacher-cell__info">
                    <span class="teacher-cell__name">{{
                      teacher.user.fullName
                    }}</span>
                    <span class="teacher-cell__email">{{
                      teacher.user.email
                    }}</span>
                  </div>
                </div>
              </td>
              <td>
                <span class="qualification-text">{{
                  teacher.qualification ?? '-'
                }}</span>
              </td>
              <td class="text-center">
                <span class="student-count">{{ teacher.totalStudents }}</span>
              </td>
              <td>
                <p-tag
                  [value]="teacher.user.status | titlecase"
                  [severity]="getStatusSeverity(teacher.user.status)"
                  [rounded]="true"
                />
              </td>
              <td>
                <span class="date-text">{{
                  teacher.createdAt | date : 'MMM d, yyyy'
                }}</span>
              </td>
              <td>
                <div class="action-buttons">
                  @if (teacher.user.status === 'pending') {
                  <p-button
                    icon="pi pi-check"
                    severity="success"
                    size="small"
                    [rounded]="true"
                    pTooltip="Approve"
                    tooltipPosition="top"
                    (click)="confirmApprove(teacher)"
                  />
                  <p-button
                    icon="pi pi-times"
                    severity="danger"
                    [outlined]="true"
                    size="small"
                    [rounded]="true"
                    pTooltip="Reject"
                    tooltipPosition="top"
                    (click)="confirmReject(teacher)"
                  />
                  } @else if (teacher.user.status === 'active') {
                  <p-button
                    icon="pi pi-ban"
                    severity="warn"
                    [outlined]="true"
                    size="small"
                    [rounded]="true"
                    pTooltip="Disable"
                    tooltipPosition="top"
                    (click)="confirmDisable(teacher)"
                  />
                  } @else if (teacher.user.status === 'disabled') {
                  <p-button
                    icon="pi pi-check-circle"
                    severity="success"
                    [outlined]="true"
                    size="small"
                    [rounded]="true"
                    pTooltip="Enable"
                    tooltipPosition="top"
                    (click)="confirmEnable(teacher)"
                  />
                  }
                  <!-- @REVIEW: Navigate to teacher workspace -->
                  <p-button
                    icon="pi pi-eye"
                    severity="info"
                    [text]="true"
                    size="small"
                    [rounded]="true"
                    pTooltip="View Workspace"
                    tooltipPosition="top"
                    (click)="viewWorkspace(teacher)"
                  />
                </div>
              </td>
            </tr>
          </ng-template>

          <ng-template #emptymessage>
            <tr>
              <td colspan="6">
                <div class="empty-state">
                  <i class="pi pi-users"></i>
                  <h3>No teachers found</h3>
                  <p>There are no teachers matching your criteria.</p>
                </div>
              </td>
            </tr>
          </ng-template>

          <ng-template #loadingbody>
            @for (row of skeletonRows; track row) {
            <tr>
              <td><p-skeleton width="200px" height="40px" /></td>
              <td><p-skeleton width="120px" /></td>
              <td><p-skeleton width="40px" /></td>
              <td><p-skeleton width="80px" /></td>
              <td><p-skeleton width="100px" /></td>
              <td><p-skeleton width="100px" /></td>
            </tr>
            }
          </ng-template>
        </p-table>
      </p-card>

      <!-- Confirm Dialog -->
      <p-confirmDialog />
      <p-toast />
    </div>
  `,
  styles: `
    .teachers-page {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    /* Page Header */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .page-header__title {
      margin: 0;
      font-size: 1.75rem;
      font-weight: 600;
      color: var(--p-text-color);
    }

    .page-header__subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.9rem;
      color: var(--p-text-muted-color);
    }

    /* Stats Row */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    :host ::ng-deep .stat-card .p-card-body {
      padding: 1rem;
    }

    .stat-card__content {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .stat-card__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 10px;
      color: white;
      font-size: 1.25rem;
    }

    .stat-card__text {
      display: flex;
      flex-direction: column;
    }

    .stat-card__value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--p-text-color);
      line-height: 1.2;
    }

    .stat-card__label {
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
    }

    /* Table Card */
    :host ::ng-deep .teachers-table-card {
      .p-card-body {
        padding: 0;
      }
      .p-card-header {
        padding: 0;
      }
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--p-surface-200);
    }

    .table-header__title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--p-text-color);
    }

    .table-header__filters {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    :host ::ng-deep .status-filter {
      min-width: 160px;
    }

    /* Table Styles */
    :host ::ng-deep .p-datatable {
      .p-datatable-thead > tr > th {
        background: transparent;
        padding: 0.875rem 1rem;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--p-text-muted-color);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        border-color: var(--p-surface-200);
      }

      .p-datatable-tbody > tr > td {
        padding: 0.875rem 1rem;
        border-color: var(--p-surface-200);
      }

      .p-datatable-tbody > tr:last-child > td {
        border-bottom: none;
      }
    }

    .teacher-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .teacher-cell__info {
      display: flex;
      flex-direction: column;
    }

    .teacher-cell__name {
      font-weight: 500;
      color: var(--p-text-color);
    }

    .teacher-cell__email {
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
    }

    .qualification-text {
      font-size: 0.9rem;
      color: var(--p-text-color);
    }

    .student-count {
      font-weight: 600;
      color: var(--p-text-color);
    }

    .date-text {
      font-size: 0.85rem;
      color: var(--p-text-muted-color);
    }

    .action-buttons {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
      text-align: center;

      i {
        font-size: 3rem;
        color: var(--p-text-muted-color);
        opacity: 0.5;
        margin-bottom: 1rem;
      }

      h3 {
        margin: 0 0 0.5rem;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--p-text-color);
      }

      p {
        margin: 0;
        font-size: 0.9rem;
        color: var(--p-text-muted-color);
      }
    }

    .text-center {
      text-align: center;
    }
  `,
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
        color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      },
      {
        label: 'Pending Approval',
        value: pending,
        icon: 'pi pi-clock',
        color: 'linear-gradient(135deg, #f59e0b, #d97706)',
      },
      {
        label: 'Active',
        value: active,
        icon: 'pi pi-check-circle',
        color: 'linear-gradient(135deg, #10b981, #059669)',
      },
      {
        label: 'Disabled',
        value: disabled,
        icon: 'pi pi-ban',
        color: 'linear-gradient(135deg, #ef4444, #dc2626)',
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
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
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
