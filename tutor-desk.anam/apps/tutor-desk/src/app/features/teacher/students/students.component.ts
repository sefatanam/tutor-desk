// @REVIEW: Teacher Students Management - Full implementation
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed, viewChild } from '@angular/core';
import { Table } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
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
import { DialogModule } from 'primeng/dialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { DatePickerModule } from 'primeng/datepicker';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { StudentWithUser } from '../../../core/models';

@Component({
  selector: 'app-students',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
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
    DialogModule,
    FloatLabelModule,
    DatePickerModule,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="students-page">
      <!-- Page Header -->
      <header class="page-header">
        <div class="page-header__content">
          <h1 class="page-header__title">My Students</h1>
          <p class="page-header__subtitle">Manage your students and their information</p>
        </div>
        <div class="page-header__actions">
          <p-button label="Add Student" icon="pi pi-plus" (click)="showAddDialog()" />
        </div>
      </header>

      <!-- Stats Cards -->
      <section class="stats-row">
        @if (loadingStats()) {
          @for (i of [1, 2, 3, 4]; track i) {
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

      <!-- Students Table -->
      <p-card styleClass="students-table-card">
        <ng-template #header>
          <div class="table-header">
            <h2 class="table-header__title">All Students</h2>
            <div class="table-header__filters">
              <p-iconfield>
                <p-inputicon styleClass="pi pi-search" />
                <input
                  type="text"
                  pInputText
                  placeholder="Search students..."
                  [(ngModel)]="globalFilter"
                  (input)="dt()?.filterGlobal(globalFilter, 'contains')"
                />
              </p-iconfield>
              <p-select
                [options]="statusOptions"
                [(ngModel)]="selectedStatus"
                placeholder="Filter by status"
                [showClear]="true"
                (onChange)="loadStudents()"
                styleClass="status-filter"
              />
            </div>
          </div>
        </ng-template>

        @if (loading()) {
          <div class="skeleton-table">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <div class="skeleton-row">
                <p-skeleton shape="circle" size="40px" />
                <p-skeleton width="150px" height="16px" />
                <p-skeleton width="100px" height="16px" />
                <p-skeleton width="80px" height="16px" />
                <p-skeleton width="60px" height="24px" borderRadius="16px" />
                <p-skeleton width="80px" height="32px" />
              </div>
            }
          </div>
        } @else if (students().length === 0) {
          <div class="empty-state">
            <i class="pi pi-users empty-state__icon"></i>
            <h3 class="empty-state__title">No students yet</h3>
            <p class="empty-state__text">Start by adding your first student</p>
            <p-button label="Add Student" icon="pi pi-plus" (click)="showAddDialog()" />
          </div>
        } @else {
          <p-table
            #dt
            [value]="students()"
            [paginator]="true"
            [rows]="10"
            [rowsPerPageOptions]="[10, 25, 50]"
            [globalFilterFields]="['user.fullName', 'user.email', 'rollNumber', 'className']"
            [rowHover]="true"
            dataKey="id"
            styleClass="p-datatable-sm"
            [showCurrentPageReport]="true"
            currentPageReportTemplate="Showing {first} to {last} of {totalRecords} students"
          >
            <ng-template #header>
              <tr>
                <th pSortableColumn="user.fullName" style="min-width: 220px">
                  Student <p-sortIcon field="user.fullName" />
                </th>
                <th style="min-width: 100px">Roll No.</th>
                <th style="min-width: 120px">Class</th>
                <th style="min-width: 100px" class="text-center">Exams</th>
                <th style="min-width: 100px" class="text-center">Avg Score</th>
                <th pSortableColumn="user.status" style="min-width: 100px">
                  Status <p-sortIcon field="user.status" />
                </th>
                <th style="width: 140px" class="text-center">Actions</th>
              </tr>
            </ng-template>

            <ng-template #body let-student>
              <tr>
                <td>
                  <div class="student-cell">
                    <p-avatar
                      [label]="getInitials(student.user.fullName)"
                      shape="circle"
                      [style]="{ background: getAvatarColor(student.id), color: '#ffffff', fontWeight: '600' }"
                    />
                    <div class="student-cell__info">
                      <span class="student-cell__name">{{ student.user.fullName }}</span>
                      <span class="student-cell__email">{{ student.user.email }}</span>
                    </div>
                  </div>
                </td>
                <td>{{ student.rollNumber ?? '-' }}</td>
                <td>
                  @if (student.className) {
                    {{ student.className }}{{ student.section ? ' - ' + student.section : '' }}
                  } @else {
                    -
                  }
                </td>
                <td class="text-center">{{ student.totalExamsTaken }}</td>
                <td class="text-center">
                  <span
                    class="score-badge"
                    [class.score-badge--good]="student.averageScore >= 70"
                    [class.score-badge--avg]="student.averageScore >= 40 && student.averageScore < 70"
                    [class.score-badge--low]="student.averageScore < 40 && student.totalExamsTaken > 0"
                  >
                    {{ student.totalExamsTaken > 0 ? (student.averageScore | number:'1.0-0') + '%' : '-' }}
                  </span>
                </td>
                <td>
                  <p-tag
                    [value]="student.user.status | titlecase"
                    [severity]="getStatusSeverity(student.user.status)"
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
                      (click)="showEditDialog(student)"
                    />
                    @if (student.user.status === 'active') {
                      <p-button
                        icon="pi pi-ban"
                        severity="warn"
                        [text]="true"
                        size="small"
                        [rounded]="true"
                        pTooltip="Disable"
                        tooltipPosition="top"
                        (click)="confirmDisable(student)"
                      />
                    } @else if (student.user.status === 'disabled') {
                      <p-button
                        icon="pi pi-check-circle"
                        severity="success"
                        [text]="true"
                        size="small"
                        [rounded]="true"
                        pTooltip="Enable"
                        tooltipPosition="top"
                        (click)="confirmEnable(student)"
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
                      (click)="confirmDelete(student)"
                    />
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-card>
    </div>

    <!-- Add/Edit Student Dialog -->
    <p-dialog
      [header]="editingStudent() ? 'Edit Student' : 'Add New Student'"
      [(visible)]="dialogVisible"
      [modal]="true"
      [style]="{ width: '500px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form [formGroup]="studentForm" (ngSubmit)="saveStudent()">
        <div class="form-grid">
          @if (!editingStudent()) {
            <div class="form-field">
              <p-floatlabel>
                <input pInputText id="fullName" formControlName="fullName" class="w-full" />
                <label for="fullName">Full Name *</label>
              </p-floatlabel>
            </div>
            <div class="form-field">
              <p-floatlabel>
                <input pInputText id="email" formControlName="email" class="w-full" />
                <label for="email">Email *</label>
              </p-floatlabel>
            </div>
            <div class="form-field">
              <p-floatlabel>
                <input pInputText id="password" type="password" formControlName="password" class="w-full" />
                <label for="password">Password *</label>
              </p-floatlabel>
            </div>
          }
          <div class="form-field">
            <p-floatlabel>
              <input pInputText id="rollNumber" formControlName="rollNumber" class="w-full" />
              <label for="rollNumber">Roll Number</label>
            </p-floatlabel>
          </div>
          <div class="form-row">
            <div class="form-field">
              <p-floatlabel>
                <input pInputText id="className" formControlName="className" class="w-full" />
                <label for="className">Class</label>
              </p-floatlabel>
            </div>
            <div class="form-field">
              <p-floatlabel>
                <input pInputText id="section" formControlName="section" class="w-full" />
                <label for="section">Section</label>
              </p-floatlabel>
            </div>
          </div>
          <div class="form-field">
            <p-floatlabel>
              <input pInputText id="guardianName" formControlName="guardianName" class="w-full" />
              <label for="guardianName">Guardian Name</label>
            </p-floatlabel>
          </div>
          <div class="form-field">
            <p-floatlabel>
              <input pInputText id="guardianPhone" formControlName="guardianPhone" class="w-full" />
              <label for="guardianPhone">Guardian Phone</label>
            </p-floatlabel>
          </div>
          <div class="form-field">
            <p-floatlabel>
              <p-datepicker
                id="dateOfBirth"
                formControlName="dateOfBirth"
                dateFormat="yy-mm-dd"
                [showIcon]="true"
                class="w-full"
              />
              <label for="dateOfBirth">Date of Birth</label>
            </p-floatlabel>
          </div>
        </div>
      </form>

      <ng-template #footer>
        <p-button label="Cancel" severity="secondary" [text]="true" (click)="dialogVisible = false" />
        <p-button
          [label]="editingStudent() ? 'Update' : 'Create'"
          icon="pi pi-check"
          (click)="saveStudent()"
          [loading]="saving()"
          [disabled]="!studentForm.valid"
        />
      </ng-template>
    </p-dialog>

    <p-confirmDialog />
    <p-toast />
  `,
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
    .form-grid { display: flex; flex-direction: column; gap: 1.5rem; padding: 1rem 0; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-field { width: 100%; }
    .w-full { width: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentsComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  // @REVIEW: Table reference for global filtering
  readonly dt = viewChild<Table>('dt');

  // State
  readonly loading = signal(true);
  readonly loadingStats = signal(true);
  readonly saving = signal(false);
  readonly students = signal<StudentWithUser[]>([]);
  readonly editingStudent = signal<StudentWithUser | null>(null);

  globalFilter = '';
  selectedStatus: string | null = null;
  dialogVisible = false;

  readonly statusOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Disabled', value: 'disabled' },
    { label: 'Pending', value: 'pending' },
  ];

  readonly studentForm = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    rollNumber: [''],
    className: [''],
    section: [''],
    guardianName: [''],
    guardianPhone: [''],
    dateOfBirth: [null as Date | null],
  });

  readonly teacherId = computed(() => this.authStore.teacherId());

  readonly statsCards = computed(() => {
    const allStudents = this.students();
    const activeCount = allStudents.filter(s => s.user.status === 'active').length;
    const disabledCount = allStudents.filter(s => s.user.status === 'disabled').length;
    const avgScore = allStudents.length > 0
      ? allStudents.reduce((sum, s) => sum + s.averageScore, 0) / allStudents.length
      : 0;

    return [
      { icon: 'pi pi-users', label: 'Total Students', value: allStudents.length.toString(), color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
      { icon: 'pi pi-check-circle', label: 'Active', value: activeCount.toString(), color: 'linear-gradient(135deg, #10b981, #059669)' },
      { icon: 'pi pi-ban', label: 'Disabled', value: disabledCount.toString(), color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
      { icon: 'pi pi-chart-line', label: 'Avg Score', value: `${Math.round(avgScore)}%`, color: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
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
    this.db.students.getByTeacher(teacherId, { page: 1, pageSize: 100 }).subscribe({
      next: (response) => {
        let filtered = response.items;
        if (this.selectedStatus) {
          filtered = filtered.filter(s => s.user.status === this.selectedStatus);
        }
        this.students.set(filtered);
        this.loading.set(false);
        this.loadingStats.set(false);
      },
      error: (err) => {
        console.error('Failed to load students:', err);
        this.loading.set(false);
        this.loadingStats.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load students.' });
      },
    });
  }

  showAddDialog(): void {
    this.editingStudent.set(null);
    this.studentForm.reset();
    this.studentForm.get('password')?.setValidators(Validators.required);
    this.studentForm.get('fullName')?.setValidators(Validators.required);
    this.studentForm.get('email')?.setValidators([Validators.required, Validators.email]);
    this.dialogVisible = true;
  }

  showEditDialog(student: StudentWithUser): void {
    this.editingStudent.set(student);
    this.studentForm.patchValue({
      fullName: student.user.fullName,
      email: student.user.email,
      password: '',
      rollNumber: student.rollNumber ?? '',
      className: student.className ?? '',
      section: student.section ?? '',
      guardianName: student.guardianName ?? '',
      guardianPhone: student.guardianPhone ?? '',
      dateOfBirth: student.dateOfBirth,
    });
    this.studentForm.get('password')?.clearValidators();
    this.studentForm.get('fullName')?.clearValidators();
    this.studentForm.get('email')?.clearValidators();
    this.studentForm.updateValueAndValidity();
    this.dialogVisible = true;
  }

  saveStudent(): void {
    if (!this.studentForm.valid && !this.editingStudent()) return;

    const teacherId = this.teacherId();
    if (!teacherId) return;

    this.saving.set(true);
    const formValue = this.studentForm.value;

    if (this.editingStudent()) {
      const studentId = this.editingStudent()!.id;
      this.db.students.update(studentId, {
        rollNumber: formValue.rollNumber || undefined,
        className: formValue.className || undefined,
        section: formValue.section || undefined,
        guardianName: formValue.guardianName || undefined,
        guardianPhone: formValue.guardianPhone || undefined,
        dateOfBirth: formValue.dateOfBirth || undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogVisible = false;
          this.loadStudents();
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Student updated successfully.' });
        },
        error: (err) => {
          console.error('Failed to update student:', err);
          this.saving.set(false);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update student.' });
        },
      });
    } else {
      this.db.students.create({
        email: formValue.email!,
        password: formValue.password!,
        fullName: formValue.fullName!,
        teacherId,
        rollNumber: formValue.rollNumber || undefined,
        className: formValue.className || undefined,
        section: formValue.section || undefined,
        guardianName: formValue.guardianName || undefined,
        guardianPhone: formValue.guardianPhone || undefined,
        dateOfBirth: formValue.dateOfBirth || undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogVisible = false;
          this.loadStudents();
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Student created successfully.' });
        },
        error: (err) => {
          console.error('Failed to create student:', err);
          this.saving.set(false);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to create student.' });
        },
      });
    }
  }

  confirmDisable(student: StudentWithUser): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to disable ${student.user.fullName}? They will not be able to log in.`,
      header: 'Confirm Disable',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-warning',
      accept: () => {
        this.db.students.disable(student.id).subscribe({
          next: () => {
            this.loadStudents();
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Student disabled successfully.' });
          },
          error: (err) => {
            console.error('Failed to disable student:', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to disable student.' });
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
        this.db.students.enable(student.id).subscribe({
          next: () => {
            this.loadStudents();
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Student enabled successfully.' });
          },
          error: (err) => {
            console.error('Failed to enable student:', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to enable student.' });
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
        this.db.students.delete(student.id).subscribe({
          next: () => {
            this.loadStudents();
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Student deleted successfully.' });
          },
          error: (err) => {
            console.error('Failed to delete student:', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete student.' });
          },
        });
      },
    });
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getAvatarColor(id: string): string {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  getStatusSeverity(status: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    const severityMap: Record<string, 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast'> = {
      active: 'success',
      pending: 'warn',
      disabled: 'danger',
    };
    return severityMap[status] ?? 'secondary';
  }
}
