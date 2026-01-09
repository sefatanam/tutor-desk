// @REVIEW: Super Admin Dashboard - Connected to Real Data
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthStore } from '../../../core/store/auth.store';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { TeacherWithUser, SuperAdminDashboardStats } from '../../../core/models';

interface StatCard {
  readonly title: string;
  readonly value: string;
  readonly icon: string;
  readonly trend?: string;
  readonly trendUp?: boolean;
  readonly color: string;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    AvatarModule,
    SkeletonModule,
    TooltipModule,
    RippleModule,
    ToastModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="dashboard">
      <!-- Page Header -->
      <header class="dashboard__header">
        <div class="dashboard__header-content">
          <h1 class="dashboard__title">Dashboard</h1>
          <p class="dashboard__subtitle">Welcome back, {{ userName() }}</p>
        </div>
        <div class="dashboard__header-actions">
          <p-button 
            label="Add Teacher" 
            icon="pi pi-plus" 
            routerLink="/admin/teachers"
            severity="primary"
          />
        </div>
      </header>

      <!-- Stats Grid -->
      <section class="dashboard__stats">
        @if (loadingStats()) {
          @for (i of [1, 2, 3, 4]; track i) {
            <p-card styleClass="dashboard__stat-card">
              <div class="stat-card">
                <p-skeleton shape="circle" size="52px" />
                <div class="stat-card__content">
                  <p-skeleton width="60px" height="28px" />
                  <p-skeleton width="100px" height="16px" />
                </div>
              </div>
            </p-card>
          }
        } @else {
          @for (stat of statsCards(); track stat.title) {
            <p-card styleClass="dashboard__stat-card">
              <div class="stat-card">
                <div class="stat-card__icon" [style.background]="stat.color">
                  <i [class]="'pi ' + stat.icon"></i>
                </div>
                <div class="stat-card__content">
                  <span class="stat-card__value">{{ stat.value }}</span>
                  <span class="stat-card__title">{{ stat.title }}</span>
                </div>
              </div>
            </p-card>
          }
        }
      </section>

      <!-- Main Content Grid -->
      <div class="dashboard__content">
        <!-- Teachers Table Card -->
        <p-card styleClass="dashboard__table-card">
          <ng-template #header>
            <div class="card-header">
              <h2 class="card-header__title">Recent Teachers</h2>
              <p-button 
                label="View All" 
                icon="pi pi-arrow-right" 
                iconPos="right"
                [text]="true"
                size="small"
                routerLink="/admin/teachers"
              />
            </div>
          </ng-template>

          <p-table 
            [value]="recentTeachers()" 
            [rows]="5" 
            styleClass="p-datatable-sm"
            [rowHover]="true"
            [loading]="loadingTeachers()"
          >
            <ng-template #header>
              <tr>
                <th>Teacher</th>
                <th class="text-center">Students</th>
                <th>Status</th>
                <th>Joined</th>
                <th style="width: 60px"></th>
              </tr>
            </ng-template>
            <ng-template #body let-teacher>
              <tr>
                <td>
                  <div class="teacher-info">
                    <p-avatar 
                      [label]="getInitials(teacher.user.fullName)" 
                      shape="circle"
                      [style]="{ 
                        background: getAvatarColor(teacher.id), 
                        color: '#ffffff',
                        fontWeight: '600'
                      }"
                    />
                    <div class="teacher-info__text">
                      <span class="teacher-info__name">{{ teacher.user.fullName }}</span>
                      <span class="teacher-info__email">{{ teacher.user.email }}</span>
                    </div>
                  </div>
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
                  <span class="date-text">{{ teacher.createdAt | date:'MMM d' }}</span>
                </td>
                <td>
                  <p-button 
                    icon="pi pi-ellipsis-v" 
                    [text]="true" 
                    [rounded]="true"
                    size="small"
                    pTooltip="Actions"
                    tooltipPosition="left"
                    routerLink="/admin/teachers"
                  />
                </td>
              </tr>
            </ng-template>
            <ng-template #emptymessage>
              <tr>
                <td colspan="5" class="text-center p-4">
                  <div class="empty-message">
                    <i class="pi pi-users"></i>
                    <p>No teachers found</p>
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>

        <!-- Right Sidebar -->
        <div class="dashboard__sidebar">
          <!-- Pending Approvals Card -->
          <p-card styleClass="dashboard__sidebar-card">
            <ng-template #header>
              <div class="card-header">
                <h2 class="card-header__title">Pending Approvals</h2>
                <p-tag 
                  [value]="pendingTeachers().length.toString()" 
                  severity="warn"
                  [rounded]="true"
                />
              </div>
            </ng-template>

            @if (loadingPending()) {
              <div class="approval-loading">
                @for (i of [1, 2]; track i) {
                  <div class="approval-item">
                    <div class="approval-item__user">
                      <p-skeleton shape="circle" size="40px" />
                      <div class="approval-item__info">
                        <p-skeleton width="120px" height="16px" />
                        <p-skeleton width="150px" height="14px" />
                      </div>
                    </div>
                  </div>
                }
              </div>
            } @else if (pendingTeachers().length === 0) {
              <div class="empty-state">
                <div class="empty-state__icon empty-state__icon--success">
                  <i class="pi pi-check-circle"></i>
                </div>
                <p class="empty-state__title">All caught up!</p>
                <span class="empty-state__text">No pending approvals</span>
              </div>
            } @else {
              <ul class="approval-list">
                @for (teacher of pendingTeachers(); track teacher.id) {
                  <li class="approval-item" pRipple>
                    <div class="approval-item__user">
                      <p-avatar 
                        [label]="getInitials(teacher.user.fullName)" 
                        shape="circle"
                        size="normal"
                        [style]="{ background: 'var(--p-surface-200)', color: 'var(--p-surface-600)' }"
                      />
                      <div class="approval-item__info">
                        <span class="approval-item__name">{{ teacher.user.fullName }}</span>
                        <span class="approval-item__email">{{ teacher.user.email }}</span>
                      </div>
                    </div>
                    <div class="approval-item__actions">
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
                    </div>
                  </li>
                }
              </ul>
            }
          </p-card>

          <!-- Quick Actions Card -->
          <p-card styleClass="dashboard__sidebar-card">
            <ng-template #header>
              <div class="card-header">
                <h2 class="card-header__title">Quick Actions</h2>
              </div>
            </ng-template>

            <div class="quick-actions">
              <a class="quick-action" routerLink="/admin/teachers" pRipple>
                <i class="pi pi-users"></i>
                <span>Manage Teachers</span>
              </a>
              <a class="quick-action" routerLink="/admin/settings" pRipple>
                <i class="pi pi-cog"></i>
                <span>Settings</span>
              </a>
            </div>
          </p-card>
        </div>
      </div>

      <!-- Dialogs -->
      <p-confirmDialog />
      <p-toast />
    </div>
  `,
  styles: `
    .dashboard {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    /* Header */
    .dashboard__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .dashboard__title {
      margin: 0;
      font-size: 1.75rem;
      font-weight: 600;
      color: var(--p-text-color);
    }

    .dashboard__subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.9rem;
      color: var(--p-text-muted-color);
    }

    /* Stats Grid */
    .dashboard__stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }

    :host ::ng-deep .dashboard__stat-card {
      .p-card-body {
        padding: 1.25rem;
      }
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .stat-card__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 12px;
      color: white;
      font-size: 1.35rem;
      flex-shrink: 0;
    }

    .stat-card__content {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .stat-card__value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--p-text-color);
      line-height: 1.2;
    }

    .stat-card__title {
      font-size: 0.85rem;
      color: var(--p-text-muted-color);
      margin-top: 0.125rem;
    }

    .stat-card__trend {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
    }

    .stat-card__trend--up {
      background: var(--p-green-50);
      color: var(--p-green-600);
    }

    .stat-card__trend--down {
      background: var(--p-red-50);
      color: var(--p-red-600);
    }

    /* Main Content Grid */
    .dashboard__content {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 1.5rem;
    }

    @media (max-width: 1100px) {
      .dashboard__content {
        grid-template-columns: 1fr;
      }
    }

    /* Table Card */
    :host ::ng-deep .dashboard__table-card {
      .p-card-body {
        padding: 0;
      }

      .p-card-header {
        padding: 0;
      }
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--p-surface-200);
    }

    .card-header__title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--p-text-color);
    }

    /* Table Styling */
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

    .teacher-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .teacher-info__text {
      display: flex;
      flex-direction: column;
    }

    .teacher-info__name {
      font-weight: 500;
      color: var(--p-text-color);
    }

    .teacher-info__email {
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
    }

    .student-count {
      font-weight: 600;
      color: var(--p-text-color);
    }

    .date-text {
      font-size: 0.85rem;
      color: var(--p-text-muted-color);
    }

    .empty-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      color: var(--p-text-muted-color);

      i {
        font-size: 2rem;
        opacity: 0.5;
      }

      p {
        margin: 0;
      }
    }

    /* Sidebar */
    .dashboard__sidebar {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    :host ::ng-deep .dashboard__sidebar-card {
      .p-card-body {
        padding: 0;
      }

      .p-card-header {
        padding: 0;
      }

      .p-card-content {
        padding: 0;
      }
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      text-align: center;
    }

    .empty-state__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      margin-bottom: 0.75rem;

      i {
        font-size: 1.75rem;
      }
    }

    .empty-state__icon--success {
      background: var(--p-green-50);
      color: var(--p-green-500);
    }

    .empty-state__title {
      margin: 0;
      font-weight: 500;
      color: var(--p-text-color);
    }

    .empty-state__text {
      font-size: 0.85rem;
      color: var(--p-text-muted-color);
      margin-top: 0.25rem;
    }

    /* Approval List */
    .approval-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .approval-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.875rem 1.25rem;
      border-bottom: 1px solid var(--p-surface-200);
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .approval-item:last-child {
      border-bottom: none;
    }

    .approval-item:hover {
      background: var(--p-surface-50);
    }

    .approval-item__user {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .approval-item__info {
      display: flex;
      flex-direction: column;
    }

    .approval-item__name {
      font-weight: 500;
      color: var(--p-text-color);
    }

    .approval-item__email {
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
    }

    .approval-item__actions {
      display: flex;
      gap: 0.5rem;
    }

    /* Quick Actions */
    .quick-actions {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
      padding: 1rem 1.25rem;
    }

    .quick-action {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1.25rem 1rem;
      background: var(--p-surface-50);
      border: 1px solid var(--p-surface-200);
      border-radius: 10px;
      text-decoration: none;
      color: inherit;
      cursor: pointer;
      transition: all 0.2s;
    }

    .quick-action:hover {
      background: var(--p-surface-100);
      border-color: var(--p-primary-color);
    }

    .quick-action i {
      font-size: 1.35rem;
      color: var(--p-primary-color);
    }

    .quick-action span {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--p-text-color);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  // Loading states
  protected readonly loadingStats = signal(true);
  protected readonly loadingTeachers = signal(true);
  protected readonly loadingPending = signal(true);

  // Data signals
  protected readonly dashboardStats = signal<SuperAdminDashboardStats | null>(null);
  protected readonly recentTeachers = signal<TeacherWithUser[]>([]);
  protected readonly pendingTeachers = signal<TeacherWithUser[]>([]);

  // Computed signal for user name
  protected readonly userName = computed(() =>
    this.authStore.user()?.fullName ?? 'Super Admin'
  );

  // Computed stats cards from real data
  protected readonly statsCards = computed(() => {
    const stats = this.dashboardStats();
    if (!stats) return [];

    return [
      {
        title: 'Total Teachers',
        value: stats.totalTeachers.toString(),
        icon: 'pi-users',
        color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      },
      {
        title: 'Total Students',
        value: stats.totalStudents.toLocaleString(),
        icon: 'pi-graduation-cap',
        color: 'linear-gradient(135deg, #10b981, #059669)',
      },
      {
        title: 'Active Exams',
        value: stats.totalExams.toString(),
        icon: 'pi-file-edit',
        color: 'linear-gradient(135deg, #f59e0b, #d97706)',
      },
      {
        title: 'Pending Approvals',
        value: stats.pendingTeachers.toString(),
        icon: 'pi-clock',
        color: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      },
    ];
  });

  private readonly avatarColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    // Load stats
    this.loadingStats.set(true);
    this.db.admin.getDashboardStats().subscribe({
      next: (stats) => {
        this.dashboardStats.set(stats);
        this.loadingStats.set(false);
      },
      error: (err) => {
        console.error('Failed to load dashboard stats:', err);
        this.loadingStats.set(false);
      },
    });

    // Load recent teachers
    this.loadingTeachers.set(true);
    this.db.teachers.getAll({ pageSize: 5, sortBy: 'created_at', sortOrder: 'desc' }).subscribe({
      next: (response) => {
        this.recentTeachers.set(response.items);
        this.loadingTeachers.set(false);
      },
      error: (err) => {
        console.error('Failed to load recent teachers:', err);
        this.loadingTeachers.set(false);
      },
    });

    // Load pending teachers
    this.loadingPending.set(true);
    this.db.teachers.getPendingApprovals().subscribe({
      next: (teachers) => {
        this.pendingTeachers.set(teachers);
        this.loadingPending.set(false);
      },
      error: (err) => {
        console.error('Failed to load pending teachers:', err);
        this.loadingPending.set(false);
      },
    });
  }

  protected getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  protected getAvatarColor(id: string): string {
    const index = id.charCodeAt(0) % this.avatarColors.length;
    return this.avatarColors[index];
  }

  protected getStatusSeverity(status: string): 'success' | 'warn' | 'danger' | 'info' | 'secondary' | 'contrast' {
    const severityMap: Record<string, 'success' | 'warn' | 'danger'> = {
      active: 'success',
      pending: 'warn',
      disabled: 'danger',
    };
    return severityMap[status] ?? 'secondary';
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
      message: `Are you sure you want to reject ${teacher.user.fullName}?`,
      header: 'Reject Teacher',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.rejectTeacher(teacher),
    });
  }

  private approveTeacher(teacher: TeacherWithUser): void {
    const adminId = this.authStore.user()?.id;
    if (!adminId) return;

    this.db.teachers.approve(teacher.id, adminId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: `${teacher.user.fullName} has been approved`,
        });
        this.loadDashboardData();
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
    this.db.users.updateStatus(teacher.user.id, 'disabled').subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: `${teacher.user.fullName} has been rejected`,
        });
        this.loadDashboardData();
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
}