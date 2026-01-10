// @REVIEW: Teacher Exams - Full CRUD implementation with Questions Management
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormArray, Validators } from '@angular/forms';
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
import { OrderListModule } from 'primeng/orderlist';
import { RadioButtonModule } from 'primeng/radiobutton';
import { DividerModule } from 'primeng/divider';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { ExamWithSubject, Subject, ExamStatus, Question, QuestionOption } from '../../../core/models';

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
    OrderListModule,
    RadioButtonModule,
    DividerModule,
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

    <!-- @REVIEW: Questions Management Dialog -->
    <p-dialog
      [header]="'Questions - ' + (selectedExamForQuestions()?.title ?? '')"
      [(visible)]="questionsDialogVisible"
      [modal]="true"
      [style]="{ width: '900px', maxHeight: '90vh' }"
      [draggable]="false"
      [resizable]="false"
      styleClass="questions-dialog"
    >
      <div class="questions-container">
        <!-- Questions Header -->
        <div class="questions-header">
          <div class="questions-stats">
            <span class="stat-item">
              <i class="pi pi-list"></i>
              {{ questions().length }} Questions
            </span>
            <span class="stat-item">
              <i class="pi pi-star"></i>
              {{ totalMarks() }} Total Marks
            </span>
          </div>
          <p-button
            label="Add Question"
            icon="pi pi-plus"
            size="small"
            (click)="showAddQuestionForm()"
            [disabled]="selectedExamForQuestions()?.status !== 'draft'"
          />
        </div>

        @if (loadingQuestions()) {
          <div class="questions-loading">
            @for (i of [1, 2, 3]; track i) {
              <div class="question-skeleton">
                <p-skeleton width="100%" height="80px" />
              </div>
            }
          </div>
        } @else if (questions().length === 0 && !showQuestionForm()) {
          <div class="questions-empty">
            <i class="pi pi-file-edit"></i>
            <p>No questions yet. Add your first question to get started.</p>
            <p-button
              label="Add First Question"
              icon="pi pi-plus"
              (click)="showAddQuestionForm()"
              [disabled]="selectedExamForQuestions()?.status !== 'draft'"
            />
          </div>
        } @else {
          <!-- Questions List -->
          @if (!showQuestionForm()) {
            <div class="questions-list">
              @for (question of questions(); track question.id; let i = $index) {
                <div class="question-card">
                  <div class="question-card__header">
                    <span class="question-number">Q{{ i + 1 }}</span>
                    <div class="question-meta">
                      <span class="marks-badge">{{ question.marks }} marks</span>
                      @if (question.negativeMarks > 0) {
                        <span class="negative-badge">-{{ question.negativeMarks }}</span>
                      }
                      @if (question.timeLimitSeconds) {
                        <span class="time-badge">
                          <i class="pi pi-clock"></i>
                          {{ question.timeLimitSeconds }}s
                        </span>
                      }
                    </div>
                    <div class="question-actions">
                      <p-button
                        icon="pi pi-pencil"
                        [text]="true"
                        [rounded]="true"
                        size="small"
                        pTooltip="Edit"
                        (click)="editQuestion(question)"
                        [disabled]="selectedExamForQuestions()?.status !== 'draft'"
                      />
                      <p-button
                        icon="pi pi-trash"
                        [text]="true"
                        [rounded]="true"
                        size="small"
                        severity="danger"
                        pTooltip="Delete"
                        (click)="confirmDeleteQuestion(question)"
                        [disabled]="selectedExamForQuestions()?.status !== 'draft'"
                      />
                    </div>
                  </div>
                  <div class="question-card__body">
                    <p class="question-text">{{ question.questionText }}</p>
                    <div class="options-grid">
                      @for (option of question.options; track option.id) {
                        <div
                          class="option-item"
                          [class.correct]="option.id === question.correctOptionId"
                        >
                          <span class="option-letter">{{ getOptionLetter($index) }}</span>
                          <span class="option-text">{{ option.text }}</span>
                          @if (option.id === question.correctOptionId) {
                            <i class="pi pi-check correct-icon"></i>
                          }
                        </div>
                      }
                    </div>
                    @if (question.explanation) {
                      <div class="question-explanation">
                        <strong>Explanation:</strong> {{ question.explanation }}
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- Question Form (Add/Edit) -->
          @if (showQuestionForm()) {
            <form [formGroup]="questionForm" class="question-form">
              <div class="form-section">
                <h4 class="form-section__title">
                  {{ editingQuestion() ? 'Edit Question' : 'New Question' }}
                </h4>

                <div class="form-field">
                  <label for="questionText">Question Text *</label>
                  <textarea
                    pTextarea
                    id="questionText"
                    formControlName="questionText"
                    rows="3"
                    class="w-full"
                    placeholder="Enter your question here..."
                  ></textarea>
                </div>

                <p-divider />

                <div class="options-section">
                  <label>Answer Options *</label>
                  <p class="options-hint">Select the correct answer by clicking the radio button</p>

                  <div formArrayName="options" class="options-form-list">
                    @for (opt of optionsFormArray.controls; track opt; let i = $index) {
                      <div class="option-form-row" [formGroupName]="i">
                        <p-radioButton
                          [value]="getOptionId(i)"
                          formControlName="isCorrect"
                          (onClick)="setCorrectOption(i)"
                          [inputId]="'opt' + i"
                        />
                        <span class="option-letter-label">{{ getOptionLetter(i) }}.</span>
                        <input
                          pInputText
                          formControlName="text"
                          class="option-input"
                          [placeholder]="'Option ' + getOptionLetter(i)"
                        />
                      </div>
                    }
                  </div>
                </div>

                <p-divider />

                <div class="form-row-3">
                  <div class="form-field">
                    <label for="marks">Marks *</label>
                    <p-inputnumber
                      id="marks"
                      formControlName="marks"
                      [min]="1"
                      [max]="100"
                      styleClass="w-full"
                    />
                  </div>
                  <div class="form-field">
                    <label for="negativeMarks">Negative Marks</label>
                    <p-inputnumber
                      id="negativeMarks"
                      formControlName="negativeMarks"
                      [min]="0"
                      [max]="100"
                      [minFractionDigits]="0"
                      [maxFractionDigits]="2"
                      styleClass="w-full"
                    />
                  </div>
                  <div class="form-field">
                    <label for="timeLimitSeconds">Time Override (sec)</label>
                    <p-inputnumber
                      id="timeLimitSeconds"
                      formControlName="timeLimitSeconds"
                      [min]="10"
                      [max]="600"
                      styleClass="w-full"
                      placeholder="Use exam default"
                    />
                  </div>
                </div>

                <div class="form-field">
                  <label for="explanation">Explanation (shown after submission)</label>
                  <textarea
                    pTextarea
                    id="explanation"
                    formControlName="explanation"
                    rows="2"
                    class="w-full"
                    placeholder="Explain the correct answer..."
                  ></textarea>
                </div>
              </div>

              <div class="question-form-actions">
                <p-button
                  label="Cancel"
                  severity="secondary"
                  [text]="true"
                  (click)="cancelQuestionForm()"
                />
                <p-button
                  [label]="editingQuestion() ? 'Update Question' : 'Add Question'"
                  icon="pi pi-check"
                  (click)="saveQuestion()"
                  [loading]="savingQuestion()"
                  [disabled]="!questionForm.valid || !hasCorrectOption()"
                />
              </div>
            </form>
          }
        }
      </div>

      <ng-template #footer>
        <p-button label="Close" severity="secondary" (click)="questionsDialogVisible = false" />
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

    /* @REVIEW: Questions Dialog Styles */
    .questions-container { display: flex; flex-direction: column; gap: 1rem; }
    .questions-header { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--surface-border); }
    .questions-stats { display: flex; gap: 1.5rem; }
    .stat-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: var(--text-color-secondary); }
    .stat-item i { color: var(--primary-color); }
    .questions-loading, .questions-empty { padding: 2rem; text-align: center; }
    .questions-empty i { font-size: 3rem; color: var(--text-color-secondary); opacity: 0.5; margin-bottom: 1rem; display: block; }
    .questions-empty p { color: var(--text-color-secondary); margin-bottom: 1rem; }
    .question-skeleton { margin-bottom: 1rem; }
    .questions-list { display: flex; flex-direction: column; gap: 1rem; max-height: 500px; overflow-y: auto; padding-right: 0.5rem; }
    .question-card { border: 1px solid var(--surface-border); border-radius: 8px; overflow: hidden; }
    .question-card__header { display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem; background: var(--surface-ground); border-bottom: 1px solid var(--surface-border); }
    .question-number { font-weight: 700; color: var(--primary-color); font-size: 0.875rem; }
    .question-meta { display: flex; gap: 0.5rem; flex: 1; }
    .marks-badge { background: var(--green-100); color: var(--green-700); padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
    .negative-badge { background: var(--red-100); color: var(--red-700); padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
    .time-badge { display: flex; align-items: center; gap: 0.25rem; background: var(--blue-100); color: var(--blue-700); padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
    .question-actions { display: flex; gap: 0.25rem; }
    .question-card__body { padding: 1rem; }
    .question-text { margin: 0 0 1rem; line-height: 1.5; }
    .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
    .option-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; border: 1px solid var(--surface-border); border-radius: 6px; font-size: 0.875rem; }
    .option-item.correct { background: var(--green-50); border-color: var(--green-300); }
    .option-letter { font-weight: 600; color: var(--text-color-secondary); min-width: 1.25rem; }
    .option-text { flex: 1; }
    .correct-icon { color: var(--green-600); margin-left: auto; }
    .question-explanation { margin-top: 1rem; padding: 0.75rem; background: var(--surface-ground); border-radius: 6px; font-size: 0.875rem; color: var(--text-color-secondary); }

    /* Question Form Styles */
    .question-form { padding: 1rem; border: 1px solid var(--surface-border); border-radius: 8px; background: var(--surface-ground); }
    .question-form .form-section__title { margin: 0 0 1rem; font-size: 1rem; font-weight: 600; color: var(--primary-color); }
    .question-form .form-field { margin-bottom: 1rem; }
    .question-form .form-field label { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500; }
    .options-section { margin: 1rem 0; }
    .options-hint { font-size: 0.75rem; color: var(--text-color-secondary); margin: 0.25rem 0 0.75rem; }
    .options-form-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .option-form-row { display: flex; align-items: center; gap: 0.75rem; }
    .option-letter-label { font-weight: 600; min-width: 1.5rem; }
    .option-input { flex: 1; }
    .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
    .question-form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--surface-border); }
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

  // @REVIEW: Questions state
  readonly selectedExamForQuestions = signal<ExamWithSubject | null>(null);
  readonly questions = signal<Question[]>([]);
  readonly editingQuestion = signal<Question | null>(null);
  readonly loadingQuestions = signal(false);
  readonly savingQuestion = signal(false);
  readonly showQuestionForm = signal(false);

  globalFilter = '';
  dialogVisible = false;
  questionsDialogVisible = false;

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

  // @REVIEW: Question form with 4 MCQ options
  readonly questionForm = this.fb.group({
    questionText: ['', Validators.required],
    options: this.fb.array([
      this.createOptionGroup(0),
      this.createOptionGroup(1),
      this.createOptionGroup(2),
      this.createOptionGroup(3),
    ]),
    correctOptionId: [''],
    marks: [1, [Validators.required, Validators.min(1)]],
    negativeMarks: [0],
    timeLimitSeconds: [null as number | null],
    explanation: [''],
  });

  private createOptionGroup(index: number) {
    return this.fb.group({
      id: [`opt_${index}`],
      text: ['', Validators.required],
      isCorrect: [''],
    });
  }

  get optionsFormArray(): FormArray {
    return this.questionForm.get('options') as FormArray;
  }

  readonly teacherId = computed(() => this.authStore.teacherId());

  readonly subjectOptions = computed(() =>
    this.subjects().map(s => ({ label: s.name, value: s.id }))
  );

  // @REVIEW: Total marks computed from questions
  readonly totalMarks = computed(() =>
    this.questions().reduce((sum, q) => sum + q.marks, 0)
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
    this.selectedExamForQuestions.set(exam);
    this.questions.set([]);
    this.editingQuestion.set(null);
    this.showQuestionForm.set(false);
    this.questionsDialogVisible = true;
    this.loadQuestions(exam.id);
  }

  // @REVIEW: Load questions for an exam
  private loadQuestions(examId: string): void {
    this.loadingQuestions.set(true);
    this.db.questions.getByExam(examId).subscribe({
      next: (questions) => {
        this.questions.set(questions);
        this.loadingQuestions.set(false);
      },
      error: (err) => {
        console.error('Failed to load questions:', err);
        this.loadingQuestions.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load questions.' });
      },
    });
  }

  // @REVIEW: Helper to get option letter (A, B, C, D)
  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  // @REVIEW: Get option ID for form
  getOptionId(index: number): string {
    return `opt_${index}`;
  }

  // @REVIEW: Set correct option in form
  setCorrectOption(index: number): void {
    this.questionForm.patchValue({ correctOptionId: this.getOptionId(index) });
  }

  // @REVIEW: Check if a correct option is selected
  hasCorrectOption(): boolean {
    return !!this.questionForm.get('correctOptionId')?.value;
  }

  // @REVIEW: Show add question form
  showAddQuestionForm(): void {
    this.editingQuestion.set(null);
    this.resetQuestionForm();
    this.showQuestionForm.set(true);
  }

  // @REVIEW: Reset question form to defaults
  private resetQuestionForm(): void {
    this.questionForm.reset({
      questionText: '',
      correctOptionId: '',
      marks: 1,
      negativeMarks: 0,
      timeLimitSeconds: null,
      explanation: '',
    });

    // Reset options
    const optionsArray = this.optionsFormArray;
    for (let i = 0; i < 4; i++) {
      optionsArray.at(i).patchValue({
        id: `opt_${i}`,
        text: '',
        isCorrect: '',
      });
    }
  }

  // @REVIEW: Edit existing question
  editQuestion(question: Question): void {
    this.editingQuestion.set(question);

    this.questionForm.patchValue({
      questionText: question.questionText,
      correctOptionId: question.correctOptionId,
      marks: question.marks,
      negativeMarks: question.negativeMarks,
      timeLimitSeconds: question.timeLimitSeconds,
      explanation: question.explanation ?? '',
    });

    // Populate options
    const optionsArray = this.optionsFormArray;
    question.options.forEach((opt, i) => {
      if (i < 4) {
        optionsArray.at(i).patchValue({
          id: opt.id,
          text: opt.text,
          isCorrect: opt.id === question.correctOptionId ? opt.id : '',
        });
      }
    });

    this.showQuestionForm.set(true);
  }

  // @REVIEW: Cancel question form
  cancelQuestionForm(): void {
    this.showQuestionForm.set(false);
    this.editingQuestion.set(null);
    this.resetQuestionForm();
  }

  // @REVIEW: Save question (create or update)
  saveQuestion(): void {
    if (!this.questionForm.valid || !this.hasCorrectOption()) return;

    const examId = this.selectedExamForQuestions()?.id;
    if (!examId) return;

    this.savingQuestion.set(true);
    const formValue = this.questionForm.value;

    // Build options array
    // @REVIEW: Cast to proper type to handle nullable form values
    const rawOptions = (formValue.options ?? []) as Array<{ id?: string | null; text?: string | null; isCorrect?: string | null }>;
    const options: QuestionOption[] = rawOptions
      .filter((opt) => opt?.text?.trim())
      .map((opt, i) => ({
        id: opt?.id ?? `opt_${i}`,
        text: opt?.text ?? '',
      }));

    if (options.length < 2) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please provide at least 2 options.' });
      this.savingQuestion.set(false);
      return;
    }

    const editing = this.editingQuestion();
    if (editing) {
      // Update existing question
      this.db.questions.update(editing.id, {
        questionText: formValue.questionText || undefined,
        options,
        correctOptionId: formValue.correctOptionId || undefined,
        marks: formValue.marks ?? undefined,
        negativeMarks: formValue.negativeMarks ?? undefined,
        timeLimitSeconds: formValue.timeLimitSeconds ?? undefined,
        explanation: formValue.explanation || undefined,
      }).subscribe({
        next: () => {
          this.savingQuestion.set(false);
          this.showQuestionForm.set(false);
          this.editingQuestion.set(null);
          this.loadQuestions(examId);
          this.loadExams(); // Refresh exam stats
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Question updated.' });
        },
        error: (err) => {
          console.error('Failed to update question:', err);
          this.savingQuestion.set(false);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update question.' });
        },
      });
    } else {
      // Create new question
      const nextSequence = this.questions().length + 1;
      this.db.questions.create({
        examId,
        questionText: formValue.questionText!,
        options,
        correctOptionId: formValue.correctOptionId!,
        marks: formValue.marks ?? 1,
        negativeMarks: formValue.negativeMarks ?? 0,
        timeLimitSeconds: formValue.timeLimitSeconds ?? undefined,
        sequenceNumber: nextSequence,
        explanation: formValue.explanation || undefined,
      }).subscribe({
        next: () => {
          this.savingQuestion.set(false);
          this.showQuestionForm.set(false);
          this.resetQuestionForm();
          this.loadQuestions(examId);
          this.loadExams(); // Refresh exam stats
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Question added.' });
        },
        error: (err) => {
          console.error('Failed to create question:', err);
          this.savingQuestion.set(false);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to add question.' });
        },
      });
    }
  }

  // @REVIEW: Confirm delete question
  confirmDeleteQuestion(question: Question): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete this question?',
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const examId = this.selectedExamForQuestions()?.id;
        if (!examId) return;

        this.db.questions.delete(question.id).subscribe({
          next: () => {
            this.loadQuestions(examId);
            this.loadExams(); // Refresh exam stats
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Question deleted.' });
          },
          error: (err) => {
            console.error('Failed to delete question:', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete question.' });
          },
        });
      },
    });
  }
}
