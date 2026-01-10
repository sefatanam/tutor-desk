// @REVIEW: Teacher Exams - Full CRUD implementation
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
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
import { DialogModule } from 'primeng/dialog';
import { FloatLabelModule } from 'primeng/floatlabel';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { ExamWithSubject, Subject, ExamStatus } from '../../../core/models';

@Component({
  selector: 'app-exams',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
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
    DialogModule,
    FloatLabelModule,
    TextareaModule,
    SelectModule,
    InputNumberModule,
    CheckboxModule,
    DatePickerModule,
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
          <p-button label="Create Exam" icon="pi pi-plus" (click)="showAddDialog()" [disabled]="subjects().length === 0" />
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
            <p class="empty-state__text">You need to create a subject before creating exams</p>
            <p-button label="Go to Subjects" icon="pi pi-arrow-right" routerLink="/teacher/subjects" />
          </div>
        } @else if (exams().length === 0) {
          <div class="empty-state">
            <i class="pi pi-file-edit empty-state__icon"></i>
            <h3 class="empty-state__title">No exams yet</h3>
            <p class="empty-state__text">Start by creating your first exam</p>
            <p-button label="Create Exam" icon="pi pi-plus" (click)="showAddDialog()" />
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
                      <span class="exam-cell__desc">{{ exam.description | slice:0:50 }}{{ exam.description.length > 50 ? '...' : '' }}</span>
                    }
                  </div>
                </td>
                <td>
                  <div class="subject-badge" [style.background]="exam.subject.color">
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
                      (click)="showEditDialog(exam)"
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
                    }
                    @if (exam.status === 'active' || exam.status === 'scheduled') {
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
                      (click)="openQuestions(exam)"
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

    <!-- Add/Edit Exam Dialog -->
    <p-dialog
      [header]="editingExam() ? 'Edit Exam' : 'Create New Exam'"
      [(visible)]="dialogVisible"
      [modal]="true"
      [style]="{ width: '650px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form [formGroup]="examForm" (ngSubmit)="saveExam()">
        <div class="form-grid">
          <!-- Basic Info -->
          <div class="form-section">
            <h3 class="form-section__title">Basic Information</h3>
            <div class="form-field">
              <p-floatlabel>
                <input pInputText id="title" formControlName="title" class="w-full" />
                <label for="title">Exam Title *</label>
              </p-floatlabel>
            </div>
            <div class="form-field">
              <p-floatlabel>
                <p-select
                  id="subjectId"
                  formControlName="subjectId"
                  [options]="subjectOptions()"
                  optionLabel="label"
                  optionValue="value"
                  styleClass="w-full"
                />
                <label for="subjectId">Subject *</label>
              </p-floatlabel>
            </div>
            <div class="form-field">
              <p-floatlabel>
                <textarea pTextarea id="description" formControlName="description" rows="2" class="w-full"></textarea>
                <label for="description">Description</label>
              </p-floatlabel>
            </div>
            <div class="form-field">
              <p-floatlabel>
                <textarea pTextarea id="instructions" formControlName="instructions" rows="3" class="w-full"></textarea>
                <label for="instructions">Instructions for Students</label>
              </p-floatlabel>
            </div>
          </div>

          <!-- Time & Scoring -->
          <div class="form-section">
            <h3 class="form-section__title">Time & Scoring</h3>
            <div class="form-row-2">
              <div class="form-field">
                <p-floatlabel>
                  <p-inputnumber id="timePerQuestion" formControlName="timePerQuestionSeconds" [min]="10" [max]="600" suffix=" sec" styleClass="w-full" />
                  <label for="timePerQuestion">Time per Question *</label>
                </p-floatlabel>
              </div>
              <div class="form-field">
                <p-floatlabel>
                  <p-inputnumber id="passingMarks" formControlName="passingMarks" [min]="0" styleClass="w-full" />
                  <label for="passingMarks">Passing Marks</label>
                </p-floatlabel>
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-field">
                <p-floatlabel>
                  <p-inputnumber id="durationMinutes" formControlName="durationMinutes" [min]="1" suffix=" min" styleClass="w-full" />
                  <label for="durationMinutes">Total Duration (optional)</label>
                </p-floatlabel>
              </div>
              <div class="form-field">
                <p-floatlabel>
                  <p-inputnumber id="maxRetakes" formControlName="maxRetakes" [min]="0" [max]="10" styleClass="w-full" />
                  <label for="maxRetakes">Max Retakes</label>
                </p-floatlabel>
              </div>
            </div>
          </div>

          <!-- Exam Settings -->
          <div class="form-section">
            <h3 class="form-section__title">Exam Settings</h3>
            <div class="checkbox-group">
              <div class="checkbox-item">
                <p-checkbox formControlName="allowSkipReturn" [binary]="true" inputId="allowSkipReturn" />
                <label for="allowSkipReturn">Allow Skip & Return</label>
              </div>
              <div class="checkbox-item">
                <p-checkbox formControlName="fullscreenRequired" [binary]="true" inputId="fullscreenRequired" />
                <label for="fullscreenRequired">Fullscreen Required</label>
              </div>
              <div class="checkbox-item">
                <p-checkbox formControlName="autoSubmitOnBlur" [binary]="true" inputId="autoSubmitOnBlur" />
                <label for="autoSubmitOnBlur">Auto-submit on Tab Change</label>
              </div>
              <div class="checkbox-item">
                <p-checkbox formControlName="allowRetake" [binary]="true" inputId="allowRetake" />
                <label for="allowRetake">Allow Retakes</label>
              </div>
            </div>
          </div>

          <!-- Scheduling -->
          <div class="form-section">
            <h3 class="form-section__title">Scheduling (Optional)</h3>
            <div class="form-row-2">
              <div class="form-field">
                <p-floatlabel>
                  <p-datepicker id="scheduledStart" formControlName="scheduledStart" [showTime]="true" styleClass="w-full" />
                  <label for="scheduledStart">Start Date & Time</label>
                </p-floatlabel>
              </div>
              <div class="form-field">
                <p-floatlabel>
                  <p-datepicker id="scheduledEnd" formControlName="scheduledEnd" [showTime]="true" styleClass="w-full" />
                  <label for="scheduledEnd">End Date & Time</label>
                </p-floatlabel>
              </div>
            </div>
          </div>
        </div>
      </form>

      <ng-template #footer>
        <p-button label="Cancel" severity="secondary" [text]="true" (click)="dialogVisible = false" />
        <p-button
          [label]="editingExam() ? 'Update' : 'Create'"
          icon="pi pi-check"
          (click)="saveExam()"
          [loading]="saving()"
          [disabled]="!examForm.valid"
        />
      </ng-template>
    </p-dialog>

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
    .form-grid { display: flex; flex-direction: column; gap: 1.5rem; padding: 0.5rem 0; }
    .form-section { border: 1px solid var(--surface-border); border-radius: 8px; padding: 1rem; }
    .form-section__title { margin: 0 0 1rem; font-size: 0.95rem; font-weight: 600; color: var(--primary-color); }
    .form-field { margin-bottom: 1.25rem; }
    .form-field:last-child { margin-bottom: 0; }
    .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .checkbox-group { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .checkbox-item { display: flex; align-items: center; gap: 0.5rem; }
    .checkbox-item label { font-size: 0.875rem; cursor: pointer; }
    .w-full { width: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamsComponent implements OnInit {
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
  readonly exams = signal<ExamWithSubject[]>([]);
  readonly subjects = signal<Subject[]>([]);
  readonly editingExam = signal<ExamWithSubject | null>(null);

  globalFilter = '';
  dialogVisible = false;

  readonly examForm = this.fb.group({
    title: ['', Validators.required],
    subjectId: ['', Validators.required],
    description: [''],
    instructions: [''],
    timePerQuestionSeconds: [60, [Validators.required, Validators.min(10)]],
    passingMarks: [0],
    durationMinutes: [null as number | null],
    maxRetakes: [0],
    allowSkipReturn: [true],
    fullscreenRequired: [true],
    autoSubmitOnBlur: [true],
    allowRetake: [false],
    scheduledStart: [null as Date | null],
    scheduledEnd: [null as Date | null],
  });

  readonly teacherId = computed(() => this.authStore.teacherId());

  readonly subjectOptions = computed(() =>
    this.subjects().map(s => ({ label: s.name, value: s.id }))
  );

  readonly statsCards = computed(() => {
    const allExams = this.exams();
    const draftCount = allExams.filter(e => e.status === 'draft').length;
    const activeCount = allExams.filter(e => e.status === 'active' || e.status === 'scheduled').length;
    const totalSubmissions = allExams.reduce((sum, e) => sum + e.totalSubmissions, 0);

    return [
      { icon: 'pi pi-file-edit', label: 'Total Exams', value: allExams.length.toString(), color: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' },
      { icon: 'pi pi-pencil', label: 'Drafts', value: draftCount.toString(), color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
      { icon: 'pi pi-play', label: 'Active', value: activeCount.toString(), color: 'linear-gradient(135deg, #10b981, #059669)' },
      { icon: 'pi pi-users', label: 'Submissions', value: totalSubmissions.toString(), color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
    ];
  });

  ngOnInit(): void {
    this.loadSubjects();
    this.loadExams();
  }

  loadSubjects(): void {
    const teacherId = this.teacherId();
    if (!teacherId) return;

    this.db.subjects.getByTeacher(teacherId, { page: 1, pageSize: 100 }).subscribe({
      next: (response) => this.subjects.set(response.items.filter(s => s.isActive)),
      error: (err) => console.error('Failed to load subjects:', err),
    });
  }

  loadExams(): void {
    const teacherId = this.teacherId();
    if (!teacherId) return;

    this.loading.set(true);
    this.loadingStats.set(true);

    this.db.exams.getByTeacher(teacherId, { page: 1, pageSize: 100 }).subscribe({
      next: (response) => {
        this.exams.set(response.items);
        this.loading.set(false);
        this.loadingStats.set(false);
      },
      error: (err) => {
        console.error('Failed to load exams:', err);
        this.loading.set(false);
        this.loadingStats.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load exams.' });
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

  getStatusSeverity(status: ExamStatus): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const severities: Record<ExamStatus, 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'> = {
      draft: 'secondary',
      scheduled: 'info',
      active: 'success',
      completed: 'contrast',
      cancelled: 'danger',
    };
    return severities[status] ?? 'secondary';
  }

  showAddDialog(): void {
    this.editingExam.set(null);
    this.examForm.reset({
      title: '',
      subjectId: '',
      description: '',
      instructions: '',
      timePerQuestionSeconds: 60,
      passingMarks: 0,
      durationMinutes: null,
      maxRetakes: 0,
      allowSkipReturn: true,
      fullscreenRequired: true,
      autoSubmitOnBlur: true,
      allowRetake: false,
      scheduledStart: null,
      scheduledEnd: null,
    });
    this.dialogVisible = true;
  }

  showEditDialog(exam: ExamWithSubject): void {
    this.editingExam.set(exam);
    this.examForm.patchValue({
      title: exam.title,
      subjectId: exam.subjectId,
      description: exam.description ?? '',
      instructions: exam.instructions ?? '',
      timePerQuestionSeconds: exam.timePerQuestionSeconds,
      passingMarks: exam.passingMarks,
      durationMinutes: exam.durationMinutes,
      maxRetakes: exam.maxRetakes,
      allowSkipReturn: exam.allowSkipReturn,
      fullscreenRequired: exam.fullscreenRequired,
      autoSubmitOnBlur: exam.autoSubmitOnBlur,
      allowRetake: exam.allowRetake,
      scheduledStart: exam.scheduledStart ? new Date(exam.scheduledStart) : null,
      scheduledEnd: exam.scheduledEnd ? new Date(exam.scheduledEnd) : null,
    });
    this.dialogVisible = true;
  }

  saveExam(): void {
    if (!this.examForm.valid) return;

    const teacherId = this.teacherId();
    if (!teacherId) return;

    this.saving.set(true);
    const formValue = this.examForm.value;

    if (this.editingExam()) {
      const examId = this.editingExam()!.id;
      this.db.exams.update(examId, {
        title: formValue.title || undefined,
        description: formValue.description || undefined,
        instructions: formValue.instructions || undefined,
        timePerQuestionSeconds: formValue.timePerQuestionSeconds ?? undefined,
        passingMarks: formValue.passingMarks ?? undefined,
        durationMinutes: formValue.durationMinutes ?? undefined,
        maxRetakes: formValue.maxRetakes ?? undefined,
        allowSkipReturn: formValue.allowSkipReturn ?? undefined,
        fullscreenRequired: formValue.fullscreenRequired ?? undefined,
        autoSubmitOnBlur: formValue.autoSubmitOnBlur ?? undefined,
        allowRetake: formValue.allowRetake ?? undefined,
        scheduledStart: formValue.scheduledStart ?? undefined,
        scheduledEnd: formValue.scheduledEnd ?? undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogVisible = false;
          this.loadExams();
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Exam updated successfully.' });
        },
        error: (err) => {
          console.error('Failed to update exam:', err);
          this.saving.set(false);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update exam.' });
        },
      });
    } else {
      this.db.exams.create({
        teacherId,
        subjectId: formValue.subjectId!,
        title: formValue.title!,
        description: formValue.description || undefined,
        instructions: formValue.instructions || undefined,
        timePerQuestionSeconds: formValue.timePerQuestionSeconds ?? 60,
        passingMarks: formValue.passingMarks ?? 0,
        durationMinutes: formValue.durationMinutes ?? undefined,
        maxRetakes: formValue.maxRetakes ?? 0,
        allowSkipReturn: formValue.allowSkipReturn ?? true,
        fullscreenRequired: formValue.fullscreenRequired ?? true,
        autoSubmitOnBlur: formValue.autoSubmitOnBlur ?? true,
        allowRetake: formValue.allowRetake ?? false,
        scheduledStart: formValue.scheduledStart ?? undefined,
        scheduledEnd: formValue.scheduledEnd ?? undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogVisible = false;
          this.loadExams();
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Exam created successfully.' });
        },
        error: (err) => {
          console.error('Failed to create exam:', err);
          this.saving.set(false);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to create exam.' });
        },
      });
    }
  }

  confirmPublish(exam: ExamWithSubject): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to publish "${exam.title}"? Students will be able to take this exam once published.`,
      header: 'Confirm Publish',
      icon: 'pi pi-play',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => {
        this.db.exams.publish(exam.id).subscribe({
          next: () => {
            this.loadExams();
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Exam published successfully.' });
          },
          error: (err) => {
            console.error('Failed to publish exam:', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to publish exam.' });
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
        this.db.exams.cancel(exam.id).subscribe({
          next: () => {
            this.loadExams();
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Exam cancelled.' });
          },
          error: (err) => {
            console.error('Failed to cancel exam:', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to cancel exam.' });
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
        this.db.exams.delete(exam.id).subscribe({
          next: () => {
            this.loadExams();
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Exam deleted.' });
          },
          error: (err) => {
            console.error('Failed to delete exam:', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete exam.' });
          },
        });
      },
    });
  }

  openQuestions(exam: ExamWithSubject): void {
    // @TODO: Navigate to questions page or open questions dialog
    this.messageService.add({
      severity: 'info',
      summary: 'Coming Soon',
      detail: 'Question management will be available in the next release.',
    });
  }
}
