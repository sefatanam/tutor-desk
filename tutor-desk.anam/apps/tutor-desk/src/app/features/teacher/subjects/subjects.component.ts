// @REVIEW: Teacher Subjects - Refactored to use navigation instead of dialogs
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed, viewChild } from '@angular/core';
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
import { Subject } from '../../../core/models';

@Component({
  selector: 'app-subjects',
  // @NOT-NEED: Removed dialog, form-related imports (DialogModule, FloatLabelModule, ColorPickerModule, TextareaModule, ReactiveFormsModule)
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
    <div class="subjects-page">
      <!-- Page Header -->
      <header class="page-header">
        <div class="page-header__content">
          <h1 class="page-header__title">My Subjects</h1>
          <p class="page-header__subtitle">Manage the subjects you teach and their details</p>
        </div>
        <div class="page-header__actions">
          <p-button label="Add Subject" icon="pi pi-plus" (click)="navigateToCreate()" />
        </div>
      </header>

      <!-- Stats Cards -->
      <section class="stats-row">
        @if (loadingStats()) {
          @for (i of [1, 2, 3]; track i) {
            <p-card styleClass="stat-card">
              <div class="stat-card__content">
                <p-skeleton shape="circle" size="48px" />
                <div class="stat-card__text">
                  <p-skeleton width="40px" height="24px" />
                  <p-skeleton width="80px" height="14px" />
                </div>
              </div>
            </p-card>
          }
        } @else {
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
        }
      </section>

      <!-- Subjects Table -->
      <p-card styleClass="subjects-table-card">
        <ng-template #header>
          <div class="table-header">
            <h2 class="table-header__title">All Subjects</h2>
            <div class="table-header__filters">
              <p-iconfield>
                <p-inputicon styleClass="pi pi-search" />
                <input
                  type="text"
                  pInputText
                  placeholder="Search subjects..."
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
                <p-skeleton width="24px" height="24px" borderRadius="4px" />
                <p-skeleton width="150px" height="16px" />
                <p-skeleton width="80px" height="16px" />
                <p-skeleton width="60px" height="16px" />
                <p-skeleton width="60px" height="16px" />
                <p-skeleton width="60px" height="24px" borderRadius="16px" />
                <p-skeleton width="80px" height="32px" />
              </div>
            }
          </div>
        } @else if (subjects().length === 0) {
          <div class="empty-state">
            <i class="pi pi-book empty-state__icon"></i>
            <h3 class="empty-state__title">No subjects yet</h3>
            <p class="empty-state__text">Start by adding your first subject</p>
            <p-button label="Add Subject" icon="pi pi-plus" (click)="navigateToCreate()" />
          </div>
        } @else {
          <p-table
            #dt
            [value]="subjects()"
            [paginator]="true"
            [rows]="10"
            [rowsPerPageOptions]="[10, 25, 50]"
            [globalFilterFields]="['name', 'code', 'description']"
            [rowHover]="true"
            dataKey="id"
            styleClass="p-datatable-sm"
            [showCurrentPageReport]="true"
            currentPageReportTemplate="Showing {first} to {last} of {totalRecords} subjects"
          >
            <ng-template #header>
              <tr>
                <th style="width: 50px"></th>
                <th pSortableColumn="name" style="min-width: 200px">
                  Subject <p-sortIcon field="name" />
                </th>
                <th style="min-width: 100px">Code</th>
                <th style="min-width: 100px" class="text-center">Students</th>
                <th style="min-width: 100px" class="text-center">Exams</th>
                <th pSortableColumn="isActive" style="min-width: 100px">
                  Status <p-sortIcon field="isActive" />
                </th>
                <th style="width: 140px" class="text-center">Actions</th>
              </tr>
            </ng-template>

            <ng-template #body let-subject>
              <tr>
                <td>
                  <div class="subject-color" [style.background]="subject.color">
                    <i [class]="'pi ' + subject.icon"></i>
                  </div>
                </td>
                <td>
                  <div class="subject-cell">
                    <span class="subject-cell__name">{{ subject.name }}</span>
                    @if (subject.description) {
                      <span class="subject-cell__desc">{{ subject.description | slice:0:50 }}{{ subject.description.length > 50 ? '...' : '' }}</span>
                    }
                  </div>
                </td>
                <td>{{ subject.code ?? '-' }}</td>
                <td class="text-center">{{ subject.totalStudents }}</td>
                <td class="text-center">{{ subject.totalExams }}</td>
                <td>
                  <p-tag
                    [value]="subject.isActive ? 'Active' : 'Inactive'"
                    [severity]="subject.isActive ? 'success' : 'secondary'"
                    [rounded]="true"
                  />
                </td>
                <td>
                  <div class="action-buttons">
                    <p-button
                      icon="pi pi-eye"
                      severity="info"
                      [text]="true"
                      size="small"
                      [rounded]="true"
                      pTooltip="View Details"
                      tooltipPosition="top"
                      (click)="navigateToDetail(subject)"
                    />
                    <p-button
                      icon="pi pi-pencil"
                      severity="secondary"
                      [text]="true"
                      size="small"
                      [rounded]="true"
                      pTooltip="Edit"
                      tooltipPosition="top"
                      (click)="navigateToEdit(subject)"
                    />
                    @if (subject.isActive) {
                      <p-button
                        icon="pi pi-eye-slash"
                        severity="warn"
                        [text]="true"
                        size="small"
                        [rounded]="true"
                        pTooltip="Deactivate"
                        tooltipPosition="top"
                        (click)="confirmDeactivate(subject)"
                      />
                    } @else {
                      <p-button
                        icon="pi pi-eye"
                        severity="success"
                        [text]="true"
                        size="small"
                        [rounded]="true"
                        pTooltip="Activate"
                        tooltipPosition="top"
                        (click)="confirmActivate(subject)"
                      />
                    }
                    <p-button
                      icon="pi pi-trash"
                      severity="danger"
                      [text]="true"
                      size="small"
                      [rounded]="true"
                      pTooltip="Delete"
                      tooltipPosition="top"
                      (click)="confirmDelete(subject)"
                    />
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-card>
    </div>

    <!-- @NOT-NEED: Dialog removed - now using dedicated pages for create/edit -->

    <p-confirmDialog />
    <p-toast />
  `,
  styles: `
    .subjects-page { padding: 1.5rem; }
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
    .subject-color { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; color: white; font-size: 0.875rem; }
    .subject-cell { display: flex; flex-direction: column; }
    .subject-cell__name { font-weight: 500; }
    .subject-cell__desc { font-size: 0.875rem; color: var(--text-color-secondary); }
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
export class SubjectsComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  // @REVIEW: Table reference for global filtering
  readonly dt = viewChild<Table>('dt');

  // State
  readonly loading = signal(true);
  readonly loadingStats = signal(true);
  readonly subjects = signal<Subject[]>([]);

  globalFilter = '';

  readonly teacherId = computed(() => this.authStore.teacherId());

  readonly statsCards = computed(() => {
    const allSubjects = this.subjects();
    const activeCount = allSubjects.filter(s => s.isActive).length;
    const totalStudents = allSubjects.reduce((sum, s) => sum + s.totalStudents, 0);

    return [
      { icon: 'pi pi-book', label: 'Total Subjects', value: allSubjects.length.toString(), color: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' },
      { icon: 'pi pi-check-circle', label: 'Active', value: activeCount.toString(), color: 'linear-gradient(135deg, #10b981, #059669)' },
      { icon: 'pi pi-users', label: 'Total Enrollments', value: totalStudents.toString(), color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
    ];
  });

  ngOnInit(): void {
    this.loadSubjects();
  }

  loadSubjects(): void {
    const teacherId = this.teacherId();
    if (!teacherId) return;

    this.loading.set(true);
    this.loadingStats.set(true);

    this.db.subjects.getByTeacher(teacherId, { page: 1, pageSize: 100 }).subscribe({
      next: (response) => {
        this.subjects.set(response.items);
        this.loading.set(false);
        this.loadingStats.set(false);
      },
      error: (err) => {
        console.error('Failed to load subjects:', err);
        this.loading.set(false);
        this.loadingStats.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load subjects.' });
      },
    });
  }

  // @REVIEW: Navigation methods (replaces dialog methods)
  navigateToCreate(): void {
    this.router.navigate(['/teacher/subjects/create']);
  }

  navigateToDetail(subject: Subject): void {
    this.router.navigate(['/teacher/subjects', subject.id]);
  }

  navigateToEdit(subject: Subject): void {
    this.router.navigate(['/teacher/subjects', subject.id, 'edit']);
  }

  confirmDeactivate(subject: Subject): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to deactivate "${subject.name}"? Students will no longer see this subject.`,
      header: 'Confirm Deactivate',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-warning',
      accept: () => {
        this.db.subjects.update(subject.id, { isActive: false }).subscribe({
          next: () => {
            this.loadSubjects();
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Subject deactivated.' });
          },
          error: (err) => {
            console.error('Failed to deactivate subject:', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to deactivate subject.' });
          },
        });
      },
    });
  }

  confirmActivate(subject: Subject): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to activate "${subject.name}"?`,
      header: 'Confirm Activate',
      icon: 'pi pi-check-circle',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => {
        this.db.subjects.update(subject.id, { isActive: true }).subscribe({
          next: () => {
            this.loadSubjects();
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Subject activated.' });
          },
          error: (err) => {
            console.error('Failed to activate subject:', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to activate subject.' });
          },
        });
      },
    });
  }

  confirmDelete(subject: Subject): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${subject.name}"? This will also delete all associated exams and enrollments. This action cannot be undone.`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.db.subjects.delete(subject.id).subscribe({
          next: () => {
            this.loadSubjects();
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Subject deleted.' });
          },
          error: (err) => {
            console.error('Failed to delete subject:', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete subject.' });
          },
        });
      },
    });
  }
}
