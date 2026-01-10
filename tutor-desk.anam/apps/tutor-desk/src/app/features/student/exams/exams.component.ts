// @REVIEW: Student Available Exams - Full implementation
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { ExamWithSubject, ExamSubmission } from '../../../core/models';

// @REVIEW: Exam card data with submission status
interface ExamCard {
  readonly exam: ExamWithSubject;
  readonly submission: ExamSubmission | null;
  readonly canTake: boolean;
  readonly canResume: boolean;
  readonly isCompleted: boolean;
  readonly attemptsUsed: number;
  readonly attemptsRemaining: number;
}

@Component({
  selector: 'app-exams',
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
    SkeletonModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="exams-page">
      <!-- Page Header -->
      <header class="page-header">
        <div class="page-header__content">
          <h1 class="page-header__title">Available Exams</h1>
          <p class="page-header__subtitle">View and take exams from your enrolled subjects</p>
        </div>
      </header>

      <!-- Stats Cards -->
      <section class="stats-row">
        @if (loading()) {
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

      <!-- Filter -->
      <section class="filter-section">
        <p-iconfield>
          <p-inputicon styleClass="pi pi-search" />
          <input
            type="text"
            pInputText
            placeholder="Search exams..."
            [(ngModel)]="searchTerm"
            class="filter-input"
          />
        </p-iconfield>
        <div class="filter-tabs">
          <button 
            class="filter-tab" 
            [class.filter-tab--active]="activeTab() === 'all'"
            (click)="setActiveTab('all')"
          >
            All
          </button>
          <button 
            class="filter-tab" 
            [class.filter-tab--active]="activeTab() === 'available'"
            (click)="setActiveTab('available')"
          >
            Available
          </button>
          <button 
            class="filter-tab" 
            [class.filter-tab--active]="activeTab() === 'in_progress'"
            (click)="setActiveTab('in_progress')"
          >
            In Progress
          </button>
          <button 
            class="filter-tab" 
            [class.filter-tab--active]="activeTab() === 'completed'"
            (click)="setActiveTab('completed')"
          >
            Completed
          </button>
        </div>
      </section>

      <!-- Exams Grid -->
      <section class="exams-grid">
        @if (loading()) {
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <p-card styleClass="exam-card exam-card--skeleton">
              <div class="exam-card__header">
                <p-skeleton width="60%" height="20px" />
                <p-skeleton width="60px" height="24px" borderRadius="16px" />
              </div>
              <div class="exam-card__body">
                <p-skeleton width="80%" height="16px" />
                <p-skeleton width="100%" height="14px" />
                <p-skeleton width="100%" height="14px" />
              </div>
              <div class="exam-card__footer">
                <p-skeleton width="100px" height="36px" />
              </div>
            </p-card>
          }
        } @else if (filteredExams().length === 0) {
          <div class="empty-state">
            <i class="pi pi-file-edit empty-state__icon"></i>
            <h3 class="empty-state__title">
              @if (searchTerm || activeTab() !== 'all') {
                No matching exams
              } @else {
                No exams available
              }
            </h3>
            <p class="empty-state__text">
              @if (searchTerm || activeTab() !== 'all') {
                Try adjusting your search or filter
              } @else {
                No exams have been published for your enrolled subjects yet
              }
            </p>
          </div>
        } @else {
          @for (card of filteredExams(); track card.exam.id) {
            <p-card styleClass="exam-card">
              <div class="exam-card__header">
                <div class="exam-card__title-row">
                  <h3 class="exam-card__title">{{ card.exam.title }}</h3>
                  <p-tag [value]="getStatusLabel(card)" [severity]="getStatusSeverity(card)" />
                </div>
                <!-- @REVIEW: Handle nullable subject for independent exams -->
                @if (card.exam.subject) {
                  <span class="exam-card__subject" [style.color]="card.exam.subject.color">
                    <i [class]="'pi ' + card.exam.subject.icon"></i>
                    {{ card.exam.subject.name }}
                  </span>
                } @else {
                  <span class="exam-card__subject" style="color: #6b7280">
                    <i class="pi pi-file-edit"></i>
                    Independent Exam
                  </span>
                }
              </div>

              <div class="exam-card__body">
                @if (card.exam.description) {
                  <p class="exam-card__description">{{ card.exam.description }}</p>
                }

                <div class="exam-card__meta">
                  <div class="meta-item">
                    <i class="pi pi-question-circle"></i>
                    <span>{{ card.exam.totalQuestions }} Questions</span>
                  </div>
                  <div class="meta-item">
                    <i class="pi pi-star"></i>
                    <span>{{ card.exam.totalMarks }} Marks</span>
                  </div>
                  <div class="meta-item">
                    <i class="pi pi-clock"></i>
                    <span>{{ card.exam.timePerQuestionSeconds }}s / Question</span>
                  </div>
                  @if (card.exam.passingMarks > 0) {
                    <div class="meta-item">
                      <i class="pi pi-check-circle"></i>
                      <span>Pass: {{ card.exam.passingMarks }} marks</span>
                    </div>
                  }
                </div>

                <div class="exam-card__schedule">
                  @if (card.exam.scheduledStart) {
                    <div class="schedule-item">
                      <span class="schedule-label">Starts:</span>
                      <span>{{ card.exam.scheduledStart | date:'medium' }}</span>
                    </div>
                  }
                  @if (card.exam.scheduledEnd) {
                    <div class="schedule-item">
                      <span class="schedule-label">Ends:</span>
                      <span>{{ card.exam.scheduledEnd | date:'medium' }}</span>
                    </div>
                  }
                </div>

                @if (card.isCompleted && card.submission) {
                  <div class="exam-card__result">
                    <div class="result-score" [class.result-score--pass]="card.submission.score >= card.exam.passingMarks">
                      <span class="result-score__value">{{ card.submission.score }}</span>
                      <span class="result-score__label">/ {{ card.exam.totalMarks }}</span>
                    </div>
                    <span class="result-percentage">{{ card.submission.percentage }}%</span>
                  </div>
                }

                @if (card.exam.allowRetake && card.attemptsUsed > 0) {
                  <div class="exam-card__attempts">
                    <span>Attempts: {{ card.attemptsUsed }} / {{ card.exam.maxRetakes + 1 }}</span>
                    @if (card.attemptsRemaining > 0) {
                      <span class="attempts-remaining">({{ card.attemptsRemaining }} remaining)</span>
                    }
                  </div>
                }
              </div>

              <div class="exam-card__footer">
                @if (card.canResume) {
                  <p-button 
                    label="Resume Exam" 
                    icon="pi pi-play" 
                    severity="warn"
                    (click)="onResumeExam(card)" 
                  />
                } @else if (card.canTake) {
                  <p-button 
                    label="Start Exam" 
                    icon="pi pi-play" 
                    (click)="onStartExam(card)" 
                  />
                } @else if (card.isCompleted) {
                  <p-button 
                    label="View Results" 
                    icon="pi pi-eye" 
                    severity="secondary"
                    routerLink="/student/results"
                  />
                } @else {
                  <p-button 
                    label="Not Available" 
                    icon="pi pi-lock" 
                    severity="secondary"
                    [disabled]="true"
                  />
                }
              </div>
            </p-card>
          }
        }
      </section>

      <!-- Exam Instructions Dialog -->
      <p-dialog 
        [(visible)]="showInstructionsDialog" 
        [modal]="true" 
        [closable]="true"
        [style]="{ width: '600px' }"
        header="Exam Instructions"
      >
        @if (selectedExam()) {
          <div class="instructions-dialog">
            <div class="instructions-header">
              <h3>{{ selectedExam()!.exam.title }}</h3>
              <!-- @REVIEW: Handle nullable subject for independent exams -->
              @if (selectedExam()!.exam.subject) {
                <p-tag [value]="selectedExam()!.exam.subject!.name" [style]="{ background: selectedExam()!.exam.subject!.color }" />
              } @else {
                <p-tag value="Independent Exam" [style]="{ background: '#6b7280' }" />
              }
            </div>

            <div class="instructions-stats">
              <div class="stat">
                <i class="pi pi-question-circle"></i>
                <span>{{ selectedExam()!.exam.totalQuestions }} Questions</span>
              </div>
              <div class="stat">
                <i class="pi pi-star"></i>
                <span>{{ selectedExam()!.exam.totalMarks }} Total Marks</span>
              </div>
              <div class="stat">
                <i class="pi pi-clock"></i>
                <span>{{ selectedExam()!.exam.timePerQuestionSeconds }}s per question</span>
              </div>
              @if (selectedExam()!.exam.passingMarks > 0) {
                <div class="stat">
                  <i class="pi pi-check-circle"></i>
                  <span>Pass: {{ selectedExam()!.exam.passingMarks }} marks</span>
                </div>
              }
            </div>

            @if (selectedExam()!.exam.instructions) {
              <div class="instructions-content">
                <h4>Instructions</h4>
                <p>{{ selectedExam()!.exam.instructions }}</p>
              </div>
            }

            <div class="instructions-rules">
              <h4>Exam Rules</h4>
              <ul>
                @if (selectedExam()!.exam.fullscreenRequired) {
                  <li><i class="pi pi-expand"></i> Fullscreen mode is required</li>
                }
                @if (selectedExam()!.exam.autoSubmitOnBlur) {
                  <li><i class="pi pi-exclamation-triangle"></i> Exam will auto-submit if you switch tabs or minimize</li>
                }
                @if (selectedExam()!.exam.allowSkipReturn) {
                  <li><i class="pi pi-arrows-h"></i> You can skip and return to questions</li>
                } @else {
                  <li><i class="pi pi-arrow-right"></i> Questions must be answered in sequence</li>
                }
                <li><i class="pi pi-stopwatch"></i> Each question has a {{ selectedExam()!.exam.timePerQuestionSeconds }} second time limit</li>
              </ul>
            </div>

            <div class="instructions-actions">
              <p-button label="Cancel" severity="secondary" (click)="showInstructionsDialog = false" />
              <p-button label="Start Exam" icon="pi pi-play" (click)="confirmStartExam()" [loading]="starting()" />
            </div>
          </div>
        }
      </p-dialog>

      <p-toast />
      <p-confirmDialog />
    </div>
  `,
  styles: `
    .exams-page { padding: 1.5rem; }
    
    /* Page Header */
    .page-header { margin-bottom: 1.5rem; }
    .page-header__title { margin: 0 0 0.25rem; font-size: 1.75rem; font-weight: 600; }
    .page-header__subtitle { margin: 0; color: var(--text-color-secondary); }
    
    /* Stats Row */
    .stats-row { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 1rem; 
      margin-bottom: 1.5rem; 
    }
    :host ::ng-deep .stat-card { height: 100%; }
    :host ::ng-deep .stat-card .p-card-body { padding: 1rem; }
    .stat-card__content { display: flex; align-items: center; gap: 1rem; }
    .stat-card__icon { 
      width: 48px; height: 48px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 1.25rem;
    }
    .stat-card__text { display: flex; flex-direction: column; }
    .stat-card__value { font-size: 1.5rem; font-weight: 600; line-height: 1.2; }
    .stat-card__label { font-size: 0.875rem; color: var(--text-color-secondary); }
    
    /* Filter Section */
    .filter-section { 
      display: flex; 
      flex-wrap: wrap; 
      gap: 1rem; 
      align-items: center; 
      margin-bottom: 1.5rem; 
    }
    .filter-input { min-width: 280px; }
    .filter-tabs { display: flex; gap: 0.25rem; background: var(--surface-100); padding: 0.25rem; border-radius: 8px; }
    .filter-tab { 
      padding: 0.5rem 1rem; 
      border: none; 
      background: transparent; 
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      color: var(--text-color-secondary);
      transition: all 0.2s;
    }
    .filter-tab:hover { background: var(--surface-200); }
    .filter-tab--active { background: var(--primary-color); color: white; }
    
    /* Exams Grid */
    .exams-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); 
      gap: 1.5rem; 
    }
    :host ::ng-deep .exam-card { height: 100%; }
    :host ::ng-deep .exam-card .p-card-body { padding: 0; display: flex; flex-direction: column; height: 100%; }
    :host ::ng-deep .exam-card .p-card-content { flex: 1; display: flex; flex-direction: column; }
    
    .exam-card__header { padding: 1.25rem 1.25rem 0; }
    .exam-card__title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem; }
    .exam-card__title { margin: 0; font-size: 1.125rem; font-weight: 600; }
    .exam-card__subject { 
      display: inline-flex; 
      align-items: center; 
      gap: 0.375rem; 
      font-size: 0.875rem; 
      font-weight: 500;
    }
    
    .exam-card__body { padding: 1rem 1.25rem; flex: 1; display: flex; flex-direction: column; gap: 0.75rem; }
    .exam-card__description { 
      margin: 0; 
      font-size: 0.875rem; 
      color: var(--text-color-secondary);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    .exam-card__meta { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .meta-item { 
      display: flex; 
      align-items: center; 
      gap: 0.375rem; 
      font-size: 0.8125rem;
      color: var(--text-color-secondary);
    }
    .meta-item i { font-size: 0.875rem; }
    
    .exam-card__schedule { font-size: 0.8125rem; color: var(--text-color-secondary); }
    .schedule-item { display: flex; gap: 0.5rem; }
    .schedule-label { font-weight: 500; }
    
    .exam-card__result { 
      display: flex; 
      align-items: center; 
      gap: 1rem;
      padding: 0.75rem;
      background: var(--surface-100);
      border-radius: 8px;
    }
    .result-score { display: flex; align-items: baseline; gap: 0.25rem; }
    .result-score__value { font-size: 1.5rem; font-weight: 700; color: var(--red-500); }
    .result-score--pass .result-score__value { color: var(--green-500); }
    .result-score__label { font-size: 0.875rem; color: var(--text-color-secondary); }
    .result-percentage { font-size: 1.125rem; font-weight: 600; color: var(--text-color-secondary); }
    
    .exam-card__attempts { 
      font-size: 0.8125rem; 
      color: var(--text-color-secondary);
    }
    .attempts-remaining { color: var(--primary-color); }
    
    .exam-card__footer { 
      padding: 1rem 1.25rem; 
      border-top: 1px solid var(--surface-200);
      display: flex;
      justify-content: flex-end;
    }
    
    /* Empty State */
    .empty-state { 
      grid-column: 1 / -1;
      text-align: center; 
      padding: 4rem 2rem;
      background: var(--surface-card);
      border-radius: 12px;
    }
    .empty-state__icon { font-size: 4rem; color: var(--primary-color); opacity: 0.5; margin-bottom: 1rem; }
    .empty-state__title { margin: 0 0 0.5rem; font-size: 1.25rem; }
    .empty-state__text { margin: 0 0 1.5rem; color: var(--text-color-secondary); }
    
    /* Instructions Dialog */
    .instructions-dialog { display: flex; flex-direction: column; gap: 1.5rem; }
    .instructions-header { display: flex; justify-content: space-between; align-items: center; }
    .instructions-header h3 { margin: 0; font-size: 1.25rem; }
    
    .instructions-stats { 
      display: grid; 
      grid-template-columns: repeat(2, 1fr); 
      gap: 1rem;
      padding: 1rem;
      background: var(--surface-100);
      border-radius: 8px;
    }
    .instructions-stats .stat { display: flex; align-items: center; gap: 0.5rem; }
    .instructions-stats .stat i { color: var(--primary-color); }
    
    .instructions-content h4, .instructions-rules h4 { margin: 0 0 0.75rem; font-size: 1rem; }
    .instructions-content p { margin: 0; color: var(--text-color-secondary); }
    
    .instructions-rules ul { 
      margin: 0; 
      padding: 0; 
      list-style: none; 
      display: flex; 
      flex-direction: column; 
      gap: 0.5rem;
    }
    .instructions-rules li { 
      display: flex; 
      align-items: center; 
      gap: 0.75rem;
      color: var(--text-color-secondary);
    }
    .instructions-rules li i { color: var(--primary-color); width: 1rem; }
    
    .instructions-actions { 
      display: flex; 
      justify-content: flex-end; 
      gap: 0.75rem;
      padding-top: 1rem;
      border-top: 1px solid var(--surface-200);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamsComponent implements OnInit {
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly confirmService = inject(ConfirmationService);

  // State
  readonly loading = signal(true);
  readonly starting = signal(false);
  readonly exams = signal<ExamCard[]>([]);
  readonly activeTab = signal<'all' | 'available' | 'in_progress' | 'completed'>('all');
  searchTerm = '';
  showInstructionsDialog = false;
  readonly selectedExam = signal<ExamCard | null>(null);

  // Computed
  readonly filteredExams = computed(() => {
    let result = this.exams();
    
    // Filter by tab
    const tab = this.activeTab();
    if (tab === 'available') {
      result = result.filter(c => c.canTake && !c.canResume);
    } else if (tab === 'in_progress') {
      result = result.filter(c => c.canResume);
    } else if (tab === 'completed') {
      result = result.filter(c => c.isCompleted);
    }
    
    // Filter by search
    // @REVIEW: Handle nullable subject for independent exams
    const search = this.searchTerm.toLowerCase().trim();
    if (search) {
      result = result.filter(c => 
        c.exam.title.toLowerCase().includes(search) ||
        (c.exam.subject?.name?.toLowerCase().includes(search) ?? false)
      );
    }
    
    return result;
  });

  readonly statsCards = computed(() => {
    const cards = this.exams();
    const available = cards.filter(c => c.canTake && !c.canResume).length;
    const inProgress = cards.filter(c => c.canResume).length;
    const completed = cards.filter(c => c.isCompleted).length;
    const avgScore = cards.filter(c => c.submission?.percentage != null)
      .reduce((sum, c) => sum + (c.submission?.percentage ?? 0), 0) / (completed || 1);

    return [
      { icon: 'pi pi-file-edit', label: 'Available', value: available, color: 'var(--primary-color)' },
      { icon: 'pi pi-play', label: 'In Progress', value: inProgress, color: 'var(--orange-500)' },
      { icon: 'pi pi-check-circle', label: 'Completed', value: completed, color: 'var(--green-500)' },
      { icon: 'pi pi-chart-line', label: 'Avg Score', value: `${Math.round(avgScore)}%`, color: 'var(--blue-500)' },
    ];
  });

  ngOnInit(): void {
    this.loadExams();
  }

  setActiveTab(tab: 'all' | 'available' | 'in_progress' | 'completed'): void {
    this.activeTab.set(tab);
  }

  // @REVIEW: Load exams from enrolled subjects with submission status
  private loadExams(): void {
    const studentId = this.authStore.studentId();
    if (!studentId) {
      this.loading.set(false);
      return;
    }

    forkJoin({
      exams: this.db.exams.getUpcomingForStudent(studentId),
      submissions: this.db.submissions.getByStudent(studentId, { page: 1, pageSize: 100 }),
    }).subscribe({
      next: ({ exams, submissions }) => {
        // Build submission map by exam ID
        const submissionMap = new Map<string, ExamSubmission>();
        submissions.items.forEach(s => {
          const existing = submissionMap.get(s.examId);
          // Keep latest submission (highest attempt number)
          if (!existing || s.attemptNumber > existing.attemptNumber) {
            submissionMap.set(s.examId, s);
          }
        });

        // Map exams to cards
        const cards = exams.map(exam => this.buildExamCard(exam, submissionMap.get(exam.id) ?? null));
        this.exams.set(cards);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load exams:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load exams',
        });
        this.loading.set(false);
      },
    });
  }

  // @REVIEW: Build exam card with status logic
  private buildExamCard(exam: ExamWithSubject, submission: ExamSubmission | null): ExamCard {
    const now = new Date();
    const isScheduled = exam.scheduledStart && exam.scheduledEnd;
    const isWithinSchedule = !isScheduled || (now >= exam.scheduledStart! && now <= exam.scheduledEnd!);
    
    const isInProgress = submission?.status === 'in_progress';
    const isCompleted = submission?.status === 'submitted' || 
                        submission?.status === 'auto_submitted' || 
                        submission?.status === 'evaluated';
    // @REVIEW: Student can only retake if teacher explicitly allowed it (status = retake_allowed)
    const canRetake = submission?.status === 'retake_allowed';
    
    const attemptsUsed = submission?.attemptNumber ?? 0;
    // @NOT-NEED: Old logic based on maxRetakes is removed - retakes are now teacher-controlled only
    // const maxAttempts = exam.allowRetake ? exam.maxRetakes + 1 : 1;
    // const attemptsRemaining = Math.max(0, maxAttempts - attemptsUsed);
    
    // @REVIEW: Determine if student can take exam
    // Can take if: no submission yet, OR teacher allowed retake (status = retake_allowed)
    const canTake = isWithinSchedule && 
                    exam.status === 'active' &&
                    (!submission || canRetake);
    
    const canResume = isInProgress && isWithinSchedule;

    return {
      exam,
      submission,
      canTake,
      canResume,
      isCompleted,
      attemptsUsed,
      attemptsRemaining: canRetake ? 1 : 0, // Only 1 retake available when teacher allows it
    };
  }

  getStatusLabel(card: ExamCard): string {
    if (card.canResume) return 'In Progress';
    if (card.isCompleted) return 'Completed';
    if (card.canTake) return 'Available';
    return 'Locked';
  }

  getStatusSeverity(card: ExamCard): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    if (card.canResume) return 'warn';
    if (card.isCompleted) return 'success';
    if (card.canTake) return 'info';
    return 'secondary';
  }

  onStartExam(card: ExamCard): void {
    this.selectedExam.set(card);
    this.showInstructionsDialog = true;
  }

  onResumeExam(card: ExamCard): void {
    // Navigate directly to exam player for in-progress exams
    this.router.navigate(['/student/exams', card.exam.id, 'take']);
  }

  confirmStartExam(): void {
    const card = this.selectedExam();
    if (!card) return;

    this.starting.set(true);
    const studentId = this.authStore.studentId();
    
    if (!studentId) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Student ID not found',
      });
      this.starting.set(false);
      return;
    }

    this.db.submissions.startExam(card.exam.id, studentId).subscribe({
      next: () => {
        this.showInstructionsDialog = false;
        this.starting.set(false);
        this.router.navigate(['/student/exams', card.exam.id, 'take']);
      },
      error: (err) => {
        console.error('Failed to start exam:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to start exam. Please try again.',
        });
        this.starting.set(false);
      },
    });
  }
}
