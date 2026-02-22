// @REVIEW: Student Detail Page - View student info and manage subject enrollments
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
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { ConfirmationService, MessageService } from 'primeng/api';
import { forkJoin, of, switchMap } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { StudentWithUser, Subject, ExamSubmission } from '../../../core/models';

// @REVIEW: Exam history item with exam details
interface ExamHistoryItem {
  readonly submission: ExamSubmission;
  readonly examTitle: string;
  readonly subjectName: string;
  readonly subjectColor: string;
  readonly totalMarks: number;
  readonly passingMarks: number;
  readonly passed: boolean;
}

@Component({
  selector: 'app-student-detail',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    ConfirmDialogModule,
    ToastModule,
    SkeletonModule,
    DividerModule,
    TableModule,
    DialogModule,
    ProgressBarModule,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="student-detail-page">
      <!-- Breadcrumb & Back -->
      <div class="page-nav">
        <p-button
          icon="pi pi-arrow-left"
          label="Back to Students"
          [text]="true"
          routerLink="/teacher/students"
        />
      </div>

      @if (loading()) {
      <div class="loading-container">
        <p-skeleton width="300px" height="32px" styleClass="mb-3" />
        <p-skeleton width="200px" height="20px" />
      </div>
      } @else if (!student()) {
      <div class="not-found">
        <i class="pi pi-exclamation-circle"></i>
        <h2>Student Not Found</h2>
        <p>The student you're looking for doesn't exist or has been deleted.</p>
        <p-button label="Go to Students" routerLink="/teacher/students" />
      </div>
      } @else {
      <!-- Student Header -->
      <header class="student-header">
        <div class="student-header__info">
          <div
            class="student-avatar"
            [style.background]="getAvatarColor(student()!.user.fullName)"
          >
            {{ getInitials(student()!.user.fullName) }}
          </div>
          <div class="student-details">
            <h1 class="student-name">{{ student()!.user.fullName }}</h1>
            <span class="student-email">{{ student()!.user.email }}</span>
            <div class="student-meta">
              @if (student()!.rollNumber) {
              <span class="meta-item"
                ><i class="pi pi-id-card"></i> {{ student()!.rollNumber }}</span
              >
              } @if (student()!.className) {
              <span class="meta-item"
                ><i class="pi pi-bookmark"></i> Class
                {{ student()!.className }}</span
              >
              } @if (student()!.section) {
              <span class="meta-item"
                ><i class="pi pi-th-large"></i> Section
                {{ student()!.section }}</span
              >
              }
            </div>
          </div>
        </div>
        <div class="student-header__actions">
          <p-button
            icon="pi pi-pencil"
            label="Edit Student"
            severity="secondary"
            [routerLink]="['/teacher/students', student()!.id, 'edit']"
          />
          <p-tag
            [value]="student()!.user.status"
            [severity]="getStatusSeverity(student()!.user.status)"
          />
        </div>
      </header>

      <!-- Stats -->
      <section class="stats-row">
        <p-card styleClass="stat-card">
          <div class="stat-card__content">
            <div
              class="stat-card__icon"
              style="background: linear-gradient(135deg, #3b82f6, #1d4ed8)"
            >
              <i class="pi pi-book"></i>
            </div>
            <div class="stat-card__text">
              <span class="stat-card__value">{{
                enrolledSubjects().length
              }}</span>
              <span class="stat-card__label">Enrolled Subjects</span>
            </div>
          </div>
        </p-card>
        <p-card styleClass="stat-card">
          <div class="stat-card__content">
            <div
              class="stat-card__icon"
              style="background: linear-gradient(135deg, #8b5cf6, #6d28d9)"
            >
              <i class="pi pi-file-edit"></i>
            </div>
            <div class="stat-card__text">
              <span class="stat-card__value">{{
                student()!.totalExamsTaken
              }}</span>
              <span class="stat-card__label">Exams Taken</span>
            </div>
          </div>
        </p-card>
        <p-card styleClass="stat-card">
          <div class="stat-card__content">
            <div
              class="stat-card__icon"
              style="background: linear-gradient(135deg, #10b981, #059669)"
            >
              <i class="pi pi-chart-line"></i>
            </div>
            <div class="stat-card__text">
              <span class="stat-card__value"
                >{{ student()!.averageScore | number : '1.1-1' }}%</span
              >
              <span class="stat-card__label">Average Score</span>
            </div>
          </div>
        </p-card>
      </section>

      <!-- Guardian Info -->
      @if (student()!.guardianName || student()!.guardianPhone ||
      student()!.address) {
      <p-card styleClass="guardian-card">
        <ng-template #header>
          <div class="card-header">
            <h2 class="card-header__title">
              <i class="pi pi-users"></i>
              Guardian Information
            </h2>
          </div>
        </ng-template>
        <div class="guardian-info">
          @if (student()!.guardianName) {
          <div class="info-item">
            <span class="info-label">Guardian Name</span>
            <span class="info-value">{{ student()!.guardianName }}</span>
          </div>
          } @if (student()!.guardianPhone) {
          <div class="info-item">
            <span class="info-label">Guardian Phone</span>
            <span class="info-value">{{ student()!.guardianPhone }}</span>
          </div>
          } @if (student()!.address) {
          <div class="info-item">
            <span class="info-label">Address</span>
            <span class="info-value">{{ student()!.address }}</span>
          </div>
          } @if (student()!.dateOfBirth) {
          <div class="info-item">
            <span class="info-label">Date of Birth</span>
            <span class="info-value">{{
              student()!.dateOfBirth | date : 'mediumDate'
            }}</span>
          </div>
          }
        </div>
      </p-card>
      }

      <!-- Two Column Layout for Subjects -->
      <div class="content-grid">
        <!-- Enrolled Subjects Section -->
        <p-card styleClass="enrolled-card">
          <ng-template #header>
            <div class="card-header">
              <h2 class="card-header__title">
                <i class="pi pi-book"></i>
                Enrolled Subjects
              </h2>
            </div>
          </ng-template>

          @if (loadingSubjects()) {
          <div class="skeleton-list">
            @for (i of [1, 2, 3]; track i) {
            <p-skeleton width="100%" height="50px" styleClass="mb-2" />
            }
          </div>
          } @else if (enrolledSubjects().length === 0) {
          <div class="empty-state-small">
            <i class="pi pi-book"></i>
            <p>Not enrolled in any subjects yet</p>
          </div>
          } @else {
          <div class="subjects-list">
            @for (subject of enrolledSubjects(); track subject.id) {
            <div class="subject-item">
              <div
                class="subject-item__icon"
                [style.background]="subject.color"
              >
                <i [class]="'pi ' + subject.icon"></i>
              </div>
              <div class="subject-item__info">
                <span class="subject-item__name">{{ subject.name }}</span>
                @if (subject.code) {
                <span class="subject-item__code">{{ subject.code }}</span>
                }
              </div>
              <p-button
                icon="pi pi-times"
                severity="danger"
                [text]="true"
                [rounded]="true"
                size="small"
                pTooltip="Remove from subject"
                (click)="confirmUnenroll(subject)"
              />
            </div>
            }
          </div>
          }
        </p-card>

        <!-- Available Subjects Section -->
        <p-card styleClass="available-card">
          <ng-template #header>
            <div class="card-header">
              <h2 class="card-header__title">
                <i class="pi pi-plus-circle"></i>
                Available Subjects
              </h2>
              <p-iconfield>
                <p-inputicon styleClass="pi pi-search" />
                <input
                  type="text"
                  pInputText
                  placeholder="Search subjects..."
                  [(ngModel)]="subjectSearchFilter"
                />
              </p-iconfield>
            </div>
          </ng-template>

          @if (loadingSubjects()) {
          <div class="skeleton-list">
            @for (i of [1, 2, 3]; track i) {
            <p-skeleton width="100%" height="50px" styleClass="mb-2" />
            }
          </div>
          } @else if (filteredAvailableSubjects().length === 0) {
          <div class="empty-state-small">
            <i class="pi pi-check-circle"></i>
            <p>
              {{
                allSubjects().length === 0
                  ? 'No subjects created yet'
                  : 'Enrolled in all subjects'
              }}
            </p>
          </div>
          } @else {
          <div class="subjects-list">
            @for (subject of filteredAvailableSubjects(); track subject.id) {
            <div class="subject-item">
              <div
                class="subject-item__icon"
                [style.background]="subject.color"
              >
                <i [class]="'pi ' + subject.icon"></i>
              </div>
              <div class="subject-item__info">
                <span class="subject-item__name">{{ subject.name }}</span>
                @if (subject.code) {
                <span class="subject-item__code">{{ subject.code }}</span>
                }
              </div>
              <p-button
                icon="pi pi-plus"
                severity="success"
                [text]="true"
                [rounded]="true"
                size="small"
                pTooltip="Enroll in subject"
                (click)="enrollInSubject(subject)"
                [loading]="enrollingSubjectId() === subject.id"
              />
            </div>
            }
          </div>
          }
        </p-card>
      </div>

      <!-- @REVIEW: Exam History Section -->
      <p-card styleClass="exam-history-card">
        <ng-template #header>
          <div class="card-header">
            <h2 class="card-header__title">
              <i class="pi pi-history"></i>
              Exam History
            </h2>
            @if (examHistory().length > 0) {
            <span class="history-count"
              >{{ examHistory().length }} exam(s)</span
            >
            }
          </div>
        </ng-template>

        @if (loadingExamHistory()) {
        <div class="skeleton-table">
          @for (i of [1, 2, 3]; track i) {
          <div class="skeleton-row">
            <p-skeleton width="200px" height="16px" />
            <p-skeleton width="100px" height="16px" />
            <p-skeleton width="60px" height="16px" />
            <p-skeleton width="80px" height="24px" borderRadius="16px" />
          </div>
          }
        </div>
        } @else if (examHistory().length === 0) {
        <div class="empty-state-small">
          <i class="pi pi-chart-bar"></i>
          <p>No exam history yet</p>
        </div>
        } @else {
        <p-table
          [value]="examHistory()"
          [paginator]="examHistory().length > 5"
          [rows]="5"
          [rowsPerPageOptions]="[5, 10, 25]"
          styleClass="p-datatable-sm"
        >
          <ng-template #header>
            <tr>
              <th pSortableColumn="examTitle">
                Exam <p-sortIcon field="examTitle" />
              </th>
              <th pSortableColumn="subjectName">
                Subject <p-sortIcon field="subjectName" />
              </th>
              <th pSortableColumn="submission.score">
                Score <p-sortIcon field="submission.score" />
              </th>
              <th pSortableColumn="submission.percentage">
                % <p-sortIcon field="submission.percentage" />
              </th>
              <th>Result</th>
              <th pSortableColumn="submission.submittedAt">
                Date <p-sortIcon field="submission.submittedAt" />
              </th>
              <th>Actions</th>
            </tr>
          </ng-template>
          <ng-template #body let-item>
            <tr>
              <td>
                <div class="exam-cell">
                  <span class="exam-title">{{ item.examTitle }}</span>
                  @if (item.submission.attemptNumber > 1) {
                  <span class="attempt-badge"
                    >Attempt {{ item.submission.attemptNumber }}</span
                  >
                  }
                </div>
              </td>
              <td>
                <span
                  class="subject-badge"
                  [style.background]="item.subjectColor"
                >
                  {{ item.subjectName }}
                </span>
              </td>
              <td>
                <div class="score-cell">
                  <span
                    class="score-value"
                    [class.score-value--pass]="item.passed"
                  >
                    {{ item.submission.score }}
                  </span>
                  <span class="score-total">/ {{ item.totalMarks }}</span>
                </div>
              </td>
              <td>
                <div class="percentage-cell">
                  <p-progressBar
                    [value]="item.submission.percentage"
                    [showValue]="false"
                    styleClass="percentage-bar"
                    [style]="{ height: '6px', width: '50px' }"
                  />
                  <span>{{ item.submission.percentage }}%</span>
                </div>
              </td>
              <td>
                <p-tag
                  [value]="item.passed ? 'Passed' : 'Failed'"
                  [severity]="item.passed ? 'success' : 'danger'"
                />
              </td>
              <td>
                {{ item.submission.submittedAt | date : 'shortDate' }}
              </td>
              <td>
                <p-button
                  icon="pi pi-eye"
                  [rounded]="true"
                  [text]="true"
                  pTooltip="View Details"
                  (click)="viewExamDetails(item)"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
        }
      </p-card>
      }
    </div>

    <!-- @REVIEW: Exam Details Dialog -->
    <p-dialog
      [(visible)]="showExamDetailsDialog"
      [modal]="true"
      [closable]="true"
      [style]="{ width: '600px' }"
      header="Exam Result Details"
    >
      @if (selectedExamHistory()) {
      <div class="details-dialog">
        <div class="details-header">
          <h3>{{ selectedExamHistory()!.examTitle }}</h3>
          <span
            class="subject-badge"
            [style.background]="selectedExamHistory()!.subjectColor"
          >
            {{ selectedExamHistory()!.subjectName }}
          </span>
        </div>

        <div class="details-score">
          <div class="score-display">
            <span
              class="score-main"
              [class.score-main--pass]="selectedExamHistory()!.passed"
            >
              {{ selectedExamHistory()!.submission.score }}
            </span>
            <span class="score-divider"
              >/ {{ selectedExamHistory()!.totalMarks }}</span
            >
          </div>
          <span class="percentage-display"
            >{{ selectedExamHistory()!.submission.percentage }}%</span
          >
          <p-tag
            [value]="selectedExamHistory()!.passed ? 'PASSED' : 'FAILED'"
            [severity]="selectedExamHistory()!.passed ? 'success' : 'danger'"
            styleClass="result-tag"
          />
        </div>

        <div class="details-stats">
          <div class="detail-stat">
            <span class="detail-value correct">{{
              selectedExamHistory()!.submission.totalCorrect
            }}</span>
            <span class="detail-label">Correct</span>
          </div>
          <div class="detail-stat">
            <span class="detail-value wrong">{{
              selectedExamHistory()!.submission.totalWrong
            }}</span>
            <span class="detail-label">Wrong</span>
          </div>
          <div class="detail-stat">
            <span class="detail-value skipped">{{
              selectedExamHistory()!.submission.totalSkipped
            }}</span>
            <span class="detail-label">Skipped</span>
          </div>
          <div class="detail-stat">
            <span class="detail-value">{{
              selectedExamHistory()!.submission.totalAnswered
            }}</span>
            <span class="detail-label">Answered</span>
          </div>
        </div>

        <div class="details-info">
          <div class="info-row">
            <span class="info-label">Attempt</span>
            <span class="info-value"
              >#{{ selectedExamHistory()!.submission.attemptNumber }}</span
            >
          </div>
          <div class="info-row">
            <span class="info-label">Started</span>
            <span class="info-value">{{
              selectedExamHistory()!.submission.startedAt | date : 'medium'
            }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Submitted</span>
            <span class="info-value">{{
              selectedExamHistory()!.submission.submittedAt | date : 'medium'
            }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Status</span>
            <span class="info-value">
              @switch (selectedExamHistory()!.submission.status) { @case
              ('submitted') { Submitted } @case ('auto_submitted') {
              Auto-Submitted } @case ('evaluated') { Evaluated } @default {
              {{ selectedExamHistory()!.submission.status }} } }
            </span>
          </div>
          @if (selectedExamHistory()!.submission.autoSubmitReason) {
          <div class="info-row">
            <span class="info-label">Auto-Submit Reason</span>
            <span class="info-value auto-reason">{{
              selectedExamHistory()!.submission.autoSubmitReason
            }}</span>
          </div>
          } @if (selectedExamHistory()!.submission.remarks) {
          <div class="info-row">
            <span class="info-label">Teacher Remarks</span>
            <span class="info-value">{{
              selectedExamHistory()!.submission.remarks
            }}</span>
          </div>
          } @if (selectedExamHistory()!.passingMarks > 0) {
          <div class="info-row">
            <span class="info-label">Passing Marks</span>
            <span class="info-value">{{
              selectedExamHistory()!.passingMarks
            }}</span>
          </div>
          }
        </div>
      </div>
      }

      <ng-template pTemplate="footer">
        <p-button
          label="Close"
          severity="secondary"
          (click)="showExamDetailsDialog = false"
        />
      </ng-template>
    </p-dialog>

    <p-confirmDialog />
    <p-toast />
  `,
  styles: `
    .student-detail-page { padding: 1.5rem; max-width: 1400px; margin: 0 auto; }
    
    .page-nav { margin-bottom: 1rem; }
    
    .loading-container { padding: 2rem; }
    
    .not-found { 
      display: flex; flex-direction: column; align-items: center; justify-content: center; 
      padding: 4rem 2rem; text-align: center;
    }
    .not-found i { font-size: 4rem; color: var(--text-color-secondary); margin-bottom: 1rem; }
    .not-found h2 { margin: 0 0 0.5rem; }
    .not-found p { color: var(--text-color-secondary); margin-bottom: 1.5rem; }
    
    .student-header { 
      display: flex; justify-content: space-between; align-items: flex-start; 
      margin-bottom: 2rem; gap: 1rem; flex-wrap: wrap;
    }
    .student-header__info { display: flex; gap: 1rem; align-items: flex-start; }
    .student-avatar { 
      width: 72px; height: 72px; border-radius: 50%; 
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 1.5rem; font-weight: 600; flex-shrink: 0;
    }
    .student-details { display: flex; flex-direction: column; gap: 0.25rem; }
    .student-name { margin: 0; font-size: 1.75rem; font-weight: 600; }
    .student-email { font-size: 0.875rem; color: var(--text-color-secondary); }
    .student-meta { display: flex; gap: 1rem; margin-top: 0.5rem; flex-wrap: wrap; }
    .meta-item { 
      display: flex; align-items: center; gap: 0.25rem; 
      font-size: 0.875rem; color: var(--text-color-secondary);
    }
    .student-header__actions { display: flex; align-items: center; gap: 1rem; }
    
    .stats-row { 
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 1rem; margin-bottom: 2rem; 
    }
    :host ::ng-deep .stat-card .p-card-body { padding: 1rem; }
    .stat-card__content { display: flex; align-items: center; gap: 1rem; }
    .stat-card__icon { 
      display: flex; align-items: center; justify-content: center; 
      width: 48px; height: 48px; border-radius: 12px; color: white; font-size: 1.25rem; 
    }
    .stat-card__text { display: flex; flex-direction: column; }
    .stat-card__value { font-size: 1.5rem; font-weight: 700; }
    .stat-card__label { font-size: 0.875rem; color: var(--text-color-secondary); }
    
    .guardian-card { margin-bottom: 1.5rem; }
    .guardian-info { 
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 1.5rem; padding: 0.5rem;
    }
    .info-item { display: flex; flex-direction: column; gap: 0.25rem; }
    .info-label { font-size: 0.75rem; color: var(--text-color-secondary); text-transform: uppercase; }
    .info-value { font-weight: 500; }
    
    .content-grid { 
      display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; 
    }
    @media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }
    
    .card-header { 
      display: flex; justify-content: space-between; align-items: center; 
      padding: 1rem 1.5rem; border-bottom: 1px solid var(--surface-border);
    }
    .card-header__title { 
      margin: 0; font-size: 1.125rem; font-weight: 600; 
      display: flex; align-items: center; gap: 0.5rem;
    }
    .card-header__title i { color: var(--primary-color); }
    
    .empty-state-small { 
      display: flex; flex-direction: column; align-items: center; 
      padding: 2rem; text-align: center; color: var(--text-color-secondary);
    }
    .empty-state-small i { font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5; }
    .empty-state-small p { margin: 0; }
    
    .skeleton-list { padding: 1rem; }
    
    .subjects-list { 
      display: flex; flex-direction: column; max-height: 400px; overflow-y: auto; 
    }
    .subject-item { 
      display: flex; align-items: center; gap: 0.75rem; 
      padding: 0.75rem 1rem; border-bottom: 1px solid var(--surface-border);
    }
    .subject-item:last-child { border-bottom: none; }
    .subject-item__icon { 
      width: 40px; height: 40px; border-radius: 10px; 
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 1rem; flex-shrink: 0;
    }
    .subject-item__info { 
      flex: 1; display: flex; flex-direction: column; min-width: 0; 
    }
    .subject-item__name { 
      font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
    }
    .subject-item__code { 
      font-size: 0.75rem; color: var(--text-color-secondary); 
    }

    /* @REVIEW: Exam History Styles */
    .exam-history-card { margin-top: 1.5rem; }
    :host ::ng-deep .exam-history-card .p-card-body { padding: 0; }
    :host ::ng-deep .exam-history-card .p-card-content { padding: 0; }
    .history-count { 
      font-size: 0.875rem; color: var(--text-color-secondary); 
      background: var(--surface-100); padding: 0.25rem 0.75rem; border-radius: 16px;
    }
    
    .skeleton-table { padding: 1rem; }
    .skeleton-row {
      display: flex; gap: 1.5rem; padding: 0.75rem 0;
      border-bottom: 1px solid var(--surface-100);
    }
    
    .exam-cell { display: flex; flex-direction: column; gap: 0.125rem; }
    .exam-title { font-weight: 500; }
    .attempt-badge {
      font-size: 0.6875rem; color: var(--text-color-secondary);
      background: var(--surface-100); padding: 0.125rem 0.375rem;
      border-radius: 4px; width: fit-content;
    }
    .subject-badge {
      display: inline-block; padding: 0.25rem 0.625rem;
      border-radius: 16px; color: white;
      font-size: 0.75rem; font-weight: 500;
    }
    .score-cell { display: flex; align-items: baseline; gap: 0.25rem; }
    .score-value { font-weight: 600; color: var(--red-500); }
    .score-value--pass { color: var(--green-500); }
    .score-total { font-size: 0.8125rem; color: var(--text-color-secondary); }
    .percentage-cell { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
    :host ::ng-deep .percentage-bar .p-progressbar-value { background: var(--primary-color); }

    /* @REVIEW: Details Dialog Styles */
    .details-dialog { display: flex; flex-direction: column; gap: 1.5rem; }
    .details-header { display: flex; justify-content: space-between; align-items: center; }
    .details-header h3 { margin: 0; font-size: 1.25rem; }

    .details-score {
      display: flex; align-items: center; justify-content: center;
      gap: 1rem; padding: 1.5rem;
      background: var(--surface-100); border-radius: 12px;
    }
    .score-display { display: flex; align-items: baseline; }
    .score-main { font-size: 3rem; font-weight: 700; color: var(--red-500); }
    .score-main--pass { color: var(--green-500); }
    .score-divider { font-size: 1.5rem; color: var(--text-color-secondary); }
    .percentage-display { font-size: 1.5rem; font-weight: 600; color: var(--text-color-secondary); }
    :host ::ng-deep .result-tag { font-size: 1rem; padding: 0.5rem 1rem; }

    .details-stats {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 1rem; text-align: center;
    }
    .detail-stat { padding: 0.75rem; background: var(--surface-50); border-radius: 8px; }
    .detail-value { display: block; font-size: 1.5rem; font-weight: 600; }
    .detail-value.correct { color: var(--green-500); }
    .detail-value.wrong { color: var(--red-500); }
    .detail-value.skipped { color: var(--orange-500); }
    .detail-label { font-size: 0.8125rem; color: var(--text-color-secondary); }

    .details-info {
      display: flex; flex-direction: column; gap: 0.5rem;
      padding: 1rem; background: var(--surface-50); border-radius: 8px;
    }
    .info-row { display: flex; justify-content: space-between; }
    .info-label { color: var(--text-color-secondary); }
    .info-value { font-weight: 500; }
    .info-value.auto-reason { color: var(--orange-600); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  // @REVIEW: DestroyRef for subscription cleanup
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly loading = signal(true);
  readonly loadingSubjects = signal(true);
  readonly student = signal<StudentWithUser | null>(null);
  readonly allSubjects = signal<Subject[]>([]);
  readonly enrolledSubjects = signal<Subject[]>([]);
  readonly enrollingSubjectId = signal<string | null>(null);

  // @REVIEW: Exam history state
  readonly loadingExamHistory = signal(true);
  readonly examHistory = signal<ExamHistoryItem[]>([]);
  readonly selectedExamHistory = signal<ExamHistoryItem | null>(null);
  showExamDetailsDialog = false;

  subjectSearchFilter = '';

  readonly teacherId = computed(() => this.authStore.teacherId());
  // @REVIEW: User ID for enrolled_by field (references users table, not teachers table)
  readonly userId = computed(() => this.authStore.user()?.id ?? null);

  // @REVIEW: Compute available (not enrolled) subjects
  readonly availableSubjects = computed(() => {
    const enrolled = new Set(this.enrolledSubjects().map((s) => s.id));
    return this.allSubjects().filter((s) => !enrolled.has(s.id) && s.isActive);
  });

  // @REVIEW: Filter available subjects by search
  readonly filteredAvailableSubjects = computed(() => {
    const filter = this.subjectSearchFilter.toLowerCase().trim();
    if (!filter) return this.availableSubjects();
    return this.availableSubjects().filter(
      (s) =>
        s.name.toLowerCase().includes(filter) ||
        (s.code?.toLowerCase().includes(filter) ?? false)
    );
  });

  ngOnInit(): void {
    const studentId = this.route.snapshot.paramMap.get('id');
    if (!studentId) {
      this.loading.set(false);
      return;
    }
    this.loadStudent(studentId);
    this.loadSubjects(studentId);
    this.loadExamHistory(studentId);
  }

  private loadStudent(id: string): void {
    this.db.students
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (student) => {
          this.student.set(student);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load student:', err);
          this.loading.set(false);
        },
      });
  }

  private loadSubjects(studentId: string): void {
    const teacherId = this.teacherId();
    if (!teacherId) return;

    this.loadingSubjects.set(true);

    // Load all teacher's subjects and student's enrolled subjects in parallel
    forkJoin({
      all: this.db.subjects.getByTeacher(teacherId, { page: 1, pageSize: 500 }),
      enrolled: this.db.subjects.getByStudent(studentId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ all, enrolled }) => {
          this.allSubjects.set(all.items);
          this.enrolledSubjects.set(enrolled);
          this.loadingSubjects.set(false);
        },
        error: (err) => {
          console.error('Failed to load subjects:', err);
          this.loadingSubjects.set(false);
        },
      });
  }

  enrollInSubject(subject: Subject): void {
    const student = this.student();
    const userId = this.userId();
    if (!student || !userId) return;

    this.enrollingSubjectId.set(subject.id);

    // @REVIEW: Use userId (not teacherId) for enrolled_by - references users table
    this.db.subjects
      .enrollStudent(student.id, subject.id, userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Move subject from available to enrolled
          this.enrolledSubjects.update((list) => [...list, subject]);
          this.enrollingSubjectId.set(null);
          this.messageService.add({
            severity: 'success',
            summary: 'Enrolled',
            detail: `${student.user.fullName} has been enrolled in ${subject.name}`,
          });
        },
        error: (err) => {
          console.error('Failed to enroll student:', err);
          this.enrollingSubjectId.set(null);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to enroll in subject',
          });
        },
      });
  }

  confirmUnenroll(subject: Subject): void {
    const student = this.student();
    if (!student) return;

    this.confirmationService.confirm({
      message: `Remove ${student.user.fullName} from ${subject.name}? They will lose access to exams in this subject.`,
      header: 'Confirm Removal',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.unenrollFromSubject(subject),
    });
  }

  private unenrollFromSubject(subject: Subject): void {
    const student = this.student();
    if (!student) return;

    this.db.subjects
      .unenrollStudent(student.id, subject.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Remove subject from enrolled list
          this.enrolledSubjects.update((list) =>
            list.filter((s) => s.id !== subject.id)
          );
          this.messageService.add({
            severity: 'success',
            summary: 'Removed',
            detail: `${student.user.fullName} has been removed from ${subject.name}`,
          });
        },
        error: (err) => {
          console.error('Failed to unenroll student:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to remove from subject',
          });
        },
      });
  }

  // @REVIEW: Load student's exam history with exam details
  private loadExamHistory(studentId: string): void {
    this.loadingExamHistory.set(true);

    this.db.submissions
      .getByStudent(studentId, { page: 1, pageSize: 100 })
      .pipe(
        switchMap((response) => {
          // Filter to completed submissions only
          const completedSubmissions = response.items.filter(
            (s) =>
              s.status === 'submitted' ||
              s.status === 'auto_submitted' ||
              s.status === 'evaluated'
          );

          if (completedSubmissions.length === 0) {
            return of([]);
          }

          // Get exam details for each submission
          const examRequests = completedSubmissions.map((sub) =>
            this.db.exams.getById(sub.examId).pipe(
              switchMap((exam) => {
                if (!exam) return of(null);
                return of({
                  submission: sub,
                  examTitle: exam.title,
                  subjectName: exam.subject?.name ?? 'Independent Exam',
                  subjectColor: exam.subject?.color ?? '#6b7280',
                  totalMarks: exam.totalMarks,
                  passingMarks: exam.passingMarks,
                  passed: sub.score >= exam.passingMarks,
                } as ExamHistoryItem);
              })
            )
          );

          return forkJoin(examRequests);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          const validItems = (items ?? []).filter(
            (item): item is ExamHistoryItem => item !== null
          );
          // Sort by submitted date descending
          validItems.sort(
            (a, b) =>
              (b.submission.submittedAt?.getTime() ?? 0) -
              (a.submission.submittedAt?.getTime() ?? 0)
          );
          this.examHistory.set(validItems);
          this.loadingExamHistory.set(false);
        },
        error: (err) => {
          console.error('Failed to load exam history:', err);
          this.loadingExamHistory.set(false);
        },
      });
  }

  // @REVIEW: View exam details in dialog
  viewExamDetails(item: ExamHistoryItem): void {
    this.selectedExamHistory.set(item);
    this.showExamDetailsDialog = true;
  }

  getAvatarColor(name: string): string {
    const colors = [
      '#f87171',
      '#fb923c',
      '#fbbf24',
      '#a3e635',
      '#4ade80',
      '#2dd4bf',
      '#38bdf8',
      '#818cf8',
      '#c084fc',
      '#f472b6',
    ];
    const index = name
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getStatusSeverity(
    status: string
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<
      string,
      'success' | 'info' | 'warn' | 'danger' | 'secondary'
    > = {
      active: 'success',
      pending: 'warn',
      disabled: 'danger',
      suspended: 'danger',
    };
    return map[status] ?? 'secondary';
  }
}
