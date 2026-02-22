// @REVIEW: Exam Editor - Full implementation for create/edit exam with questions
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
import { Router, ActivatedRoute } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormArray,
  FormControl,
  Validators,
} from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { AccordionModule } from 'primeng/accordion';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
// @REVIEW: New imports for result settings
import { PanelModule } from 'primeng/panel';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService, ConfirmationService } from 'primeng/api';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import {
  Subject,
  Question,
  QuestionOption,
  ExamStatus,
  ResultVisibility,
  ExamStyle,
} from '../../../core/models';

@Component({
  selector: 'app-exam-editor',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    FloatLabelModule,
    TextareaModule,
    SelectModule,
    InputNumberModule,
    ToggleSwitchModule,
    ToastModule,
    SkeletonModule,
    DividerModule,
    AccordionModule,
    RadioButtonModule,
    ConfirmDialogModule,
    // @REVIEW: New modules for result settings
    PanelModule,
    CheckboxModule,
    DatePickerModule,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <div class="exam-editor-page">
      <!-- Page Header -->
      <header class="page-header">
        <div class="page-header__nav">
          <p-button
            icon="pi pi-arrow-left"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            (click)="goBack()"
          />
          <div class="page-header__content">
            <h1 class="page-header__title">
              {{ isEditMode() ? 'Edit Exam' : 'Create New Exam' }}
            </h1>
            <p class="page-header__subtitle">
              {{
                isEditMode()
                  ? 'Update exam details and questions'
                  : 'Set up your exam with questions'
              }}
            </p>
          </div>
        </div>
        <div class="page-header__actions">
          @if (isEditMode() && examStatus() === 'draft') {
          <p-button
            label="Publish Exam"
            icon="pi pi-play"
            severity="success"
            [outlined]="true"
            (click)="confirmPublish()"
            [disabled]="questions().length === 0"
          />
          }
        </div>
      </header>

      @if (loading()) {
      <p-card styleClass="form-card">
        <div class="form-skeleton">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
          <p-skeleton width="100%" height="56px" />
          }
        </div>
      </p-card>
      } @else {
      <!-- Exam Details Card -->
      <p-card styleClass="form-card">
        <ng-template #header>
          <div class="card-header">
            <i class="pi pi-file-edit card-header__icon"></i>
            <div>
              <h2 class="card-header__title">Exam Details</h2>
              <p class="card-header__subtitle">
                Basic information about the exam
              </p>
            </div>
          </div>
        </ng-template>

        <form [formGroup]="examForm">
          <div class="form-grid">
            <!-- @REVIEW: Subject is now optional - exam can be created independently -->
            <div class="form-field">
              <label class="field-label">Subject (Optional)</label>
              <p-select
                formControlName="subjectId"
                [options]="subjectOptions()"
                optionLabel="name"
                optionValue="id"
                placeholder="None (Independent Exam)"
                styleClass="w-full"
                [showClear]="true"
              />
              <small class="field-hint"
                >Leave empty to create an independent exam that can be assigned
                later</small
              >
            </div>

            <!-- Title -->
            <div class="form-field">
              <p-floatlabel variant="on">
                <input
                  pInputText
                  id="title"
                  formControlName="title"
                  class="w-full"
                />
                <label for="title">Exam Title *</label>
              </p-floatlabel>
              @if (examForm.get('title')?.invalid &&
              examForm.get('title')?.touched) {
              <small class="form-error">Title is required</small>
              }
            </div>

            <!-- Description -->
            <div class="form-field">
              <p-floatlabel variant="on">
                <textarea
                  pTextarea
                  id="description"
                  formControlName="description"
                  rows="3"
                  class="w-full"
                ></textarea>
                <label for="description">Description</label>
              </p-floatlabel>
            </div>

            <!-- Instructions -->
            <div class="form-field">
              <p-floatlabel variant="on">
                <textarea
                  pTextarea
                  id="instructions"
                  formControlName="instructions"
                  rows="4"
                  class="w-full"
                ></textarea>
                <label for="instructions">Instructions for Students</label>
              </p-floatlabel>
            </div>

            <!-- Time Settings Row -->
            <div class="form-row">
              <div class="form-field">
                <label class="field-label">Time per Question (seconds) *</label>
                <p-inputnumber
                  formControlName="timePerQuestionSeconds"
                  [min]="10"
                  [max]="600"
                  [showButtons]="true"
                  styleClass="w-full"
                />
              </div>
              <div class="form-field">
                <label class="field-label">Passing Marks</label>
                <p-inputnumber
                  formControlName="passingMarks"
                  [min]="0"
                  [showButtons]="true"
                  styleClass="w-full"
                />
              </div>
            </div>

            <!-- @REVIEW: Status selector - only show in edit mode -->
            @if (isEditMode()) {
            <div class="form-field">
              <label class="field-label">Status</label>
              <p-select
                formControlName="status"
                [options]="examStatusOptions"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full"
              />
            </div>
            }

            <!-- Settings Row -->
            <div class="settings-row">
              <div class="setting-item">
                <p-toggleswitch formControlName="allowSkipReturn" />
                <label>Allow Skip & Return</label>
              </div>
              <div class="setting-item">
                <p-toggleswitch formControlName="fullscreenRequired" />
                <label>Fullscreen Required</label>
              </div>
              <div class="setting-item">
                <p-toggleswitch formControlName="autoSubmitOnBlur" />
                <label>Auto-submit on Tab Change</label>
              </div>
            </div>

            <!-- @REVIEW: Result Settings Section -->
            <p-panel
              header="Result Settings"
              [toggleable]="true"
              [collapsed]="true"
              styleClass="result-settings-panel"
            >
              <div class="form-grid">
                <!-- When can students see results -->
                <div class="form-field">
                  <label class="field-label"
                    >When can students view results?</label
                  >
                  <div class="visibility-options">
                    @for (option of resultVisibilityOptions; track option.value)
                    {
                    <div
                      class="visibility-option"
                      [class.selected]="
                        examForm.get('resultVisibility')?.value === option.value
                      "
                    >
                      <p-radiobutton
                        name="resultVisibility"
                        [value]="option.value"
                        formControlName="resultVisibility"
                        [inputId]="'visibility-' + option.value"
                      />
                      <label
                        [for]="'visibility-' + option.value"
                        class="visibility-label"
                      >
                        <i class="pi {{ option.icon }}"></i>
                        <span>{{ option.label }}</span>
                      </label>
                    </div>
                    }
                  </div>
                </div>

                <!-- Manual release date picker -->
                @if (showReleaseDatePicker()) {
                <div class="form-field">
                  <label class="field-label"
                    >Scheduled Release Date (Optional)</label
                  >
                  <p-datepicker
                    formControlName="resultReleaseDate"
                    [showTime]="true"
                    [showIcon]="true"
                    dateFormat="dd/mm/yy"
                    placeholder="Select date to auto-release"
                    styleClass="w-full"
                  />
                  <small class="field-hint"
                    >Leave empty to release manually using the button
                    below</small
                  >
                </div>
                }

                <!-- Release button for manual mode in edit mode -->
                @if (showReleaseButton()) {
                <div class="form-field">
                  <p-button
                    label="Release Results Now"
                    icon="pi pi-send"
                    severity="success"
                    (click)="releaseResults()"
                    [loading]="releasingResults()"
                  />
                </div>
                }

                <!-- Already released indicator -->
                @if (isResultReleased()) {
                <div class="release-status success">
                  <i class="pi pi-check-circle"></i>
                  <span>Results have been released to students</span>
                </div>
                }

                <p-divider />

                <!-- What can students see -->
                <div class="form-field">
                  <label class="field-label"
                    >What can students see in their results?</label
                  >
                  <div class="checkbox-grid">
                    <div class="checkbox-item">
                      <p-checkbox
                        formControlName="showScore"
                        [binary]="true"
                        inputId="showScore"
                      />
                      <label for="showScore">Score (marks obtained)</label>
                    </div>
                    <div class="checkbox-item">
                      <p-checkbox
                        formControlName="showPercentage"
                        [binary]="true"
                        inputId="showPercentage"
                      />
                      <label for="showPercentage">Percentage</label>
                    </div>
                    <div class="checkbox-item">
                      <p-checkbox
                        formControlName="showPassFail"
                        [binary]="true"
                        inputId="showPassFail"
                      />
                      <label for="showPassFail">Pass/Fail status</label>
                    </div>
                    <div class="checkbox-item">
                      <p-checkbox
                        formControlName="showQuestionReview"
                        [binary]="true"
                        inputId="showQuestionReview"
                      />
                      <label for="showQuestionReview"
                        >Question-by-question review</label
                      >
                    </div>
                    <div class="checkbox-item">
                      <p-checkbox
                        formControlName="showCorrectAnswers"
                        [binary]="true"
                        inputId="showCorrectAnswers"
                      />
                      <label for="showCorrectAnswers">Correct answers</label>
                    </div>
                    <div class="checkbox-item">
                      <p-checkbox
                        formControlName="showStudentAnswers"
                        [binary]="true"
                        inputId="showStudentAnswers"
                      />
                      <label for="showStudentAnswers"
                        >Student's selected answers</label
                      >
                    </div>
                    <div class="checkbox-item">
                      <p-checkbox
                        formControlName="showExplanations"
                        [binary]="true"
                        inputId="showExplanations"
                      />
                      <label for="showExplanations">Explanations</label>
                    </div>
                    <div class="checkbox-item">
                      <p-checkbox
                        formControlName="showTimeSpent"
                        [binary]="true"
                        inputId="showTimeSpent"
                      />
                      <label for="showTimeSpent">Time spent per question</label>
                    </div>
                    <div class="checkbox-item">
                      <p-checkbox
                        formControlName="showTeacherRemarks"
                        [binary]="true"
                        inputId="showTeacherRemarks"
                      />
                      <label for="showTeacherRemarks">Teacher remarks</label>
                    </div>
                    <div class="checkbox-item">
                      <p-checkbox
                        formControlName="showRank"
                        [binary]="true"
                        inputId="showRank"
                      />
                      <label for="showRank">Rank among students</label>
                    </div>
                  </div>
                </div>
              </div>
            </p-panel>

            <!-- @REVIEW: Exam Style Settings Section -->
            <p-panel
              header="Exam Style Settings"
              [toggleable]="true"
              [collapsed]="true"
              styleClass="exam-style-panel"
            >
              <div class="form-grid">
                <!-- Exam style selector -->
                <div class="form-field">
                  <label class="field-label">Select Exam Style</label>
                  <div class="style-options">
                    @for (option of examStyleOptions; track option.value) {
                    <div
                      class="style-option"
                      [class.selected]="
                        examForm.get('examStyle')?.value === option.value
                      "
                      (click)="selectExamStyle(option.value)"
                    >
                      <p-radiobutton
                        name="examStyle"
                        [value]="option.value"
                        formControlName="examStyle"
                        [inputId]="'style-' + option.value"
                      />
                      <label
                        [for]="'style-' + option.value"
                        class="style-label"
                      >
                        <div class="style-header">
                          <i class="pi {{ option.icon }}"></i>
                          <span class="style-name">{{ option.label }}</span>
                        </div>
                        <span class="style-description">{{
                          option.description
                        }}</span>
                      </label>
                    </div>
                    }
                  </div>
                </div>

                <!-- Total time limit (for free_navigation and practice modes) -->
                @if (showTotalTimeLimit()) {
                <div class="form-field">
                  <label class="field-label">Total Time Limit (minutes)</label>
                  <p-inputnumber
                    formControlName="totalTimeLimitMinutes"
                    [min]="1"
                    [max]="480"
                    [showButtons]="true"
                    placeholder="Leave empty for unlimited"
                    styleClass="w-full"
                  />
                  <small class="field-hint"
                    >Total time for the entire exam. Leave empty for no time
                    limit.</small
                  >
                </div>
                }

                <p-divider />

                <!-- Shuffle and feedback options -->
                <div class="form-field">
                  <label class="field-label">Additional Options</label>
                  <div class="checkbox-grid">
                    <div class="checkbox-item">
                      <p-checkbox
                        formControlName="shuffleQuestions"
                        [binary]="true"
                        inputId="shuffleQuestions"
                      />
                      <label for="shuffleQuestions"
                        >Shuffle questions order</label
                      >
                    </div>
                    <div class="checkbox-item">
                      <p-checkbox
                        formControlName="shuffleOptions"
                        [binary]="true"
                        inputId="shuffleOptions"
                      />
                      <label for="shuffleOptions">Shuffle answer options</label>
                    </div>
                    @if (showImmediateFeedbackOption()) {
                    <div class="checkbox-item">
                      <p-checkbox
                        formControlName="showImmediateFeedback"
                        [binary]="true"
                        inputId="showImmediateFeedback"
                      />
                      <label for="showImmediateFeedback"
                        >Show immediate feedback after each question</label
                      >
                    </div>
                    }
                  </div>
                </div>

                <!-- Style-specific info box -->
                <div
                  class="style-info-box"
                  [class]="'style-' + examForm.get('examStyle')?.value"
                >
                  <i class="pi pi-info-circle"></i>
                  <span>{{ getExamStyleInfo() }}</span>
                </div>
              </div>
            </p-panel>
          </div>

          <!-- Save Exam Button -->
          <div class="form-actions">
            <p-button
              [label]="isEditMode() ? 'Update Exam Details' : 'Create Exam'"
              icon="pi pi-check"
              (click)="saveExam()"
              [loading]="savingExam()"
              [disabled]="!examForm.valid"
            />
          </div>
        </form>
      </p-card>

      <!-- Questions Section (only show after exam is created) -->
      @if (examId()) {
      <p-card styleClass="form-card questions-card">
        <ng-template #header>
          <div class="card-header">
            <i class="pi pi-list card-header__icon"></i>
            <div>
              <h2 class="card-header__title">
                Questions ({{ questions().length }})
              </h2>
              <p class="card-header__subtitle">Add and manage exam questions</p>
            </div>
            <div class="card-header__actions">
              <p-button
                label="Add Question"
                icon="pi pi-plus"
                size="small"
                (click)="addQuestion()"
              />
            </div>
          </div>
        </ng-template>

        @if (loadingQuestions()) {
        <div class="form-skeleton">
          @for (i of [1, 2, 3]; track i) {
          <p-skeleton width="100%" height="100px" />
          }
        </div>
        } @else if (questions().length === 0) {
        <div class="empty-questions">
          <i class="pi pi-list"></i>
          <p>
            No questions yet. Click "Add Question" to create your first
            question.
          </p>
        </div>
        } @else {
        <p-accordion [multiple]="true" [value]="activeQuestionIndex()">
          @for (question of questions(); track question.id; let i = $index) {
          <p-accordion-panel [value]="i">
            <p-accordion-header>
              <div class="question-header">
                <span class="question-number">Q{{ i + 1 }}</span>
                <span class="question-preview"
                  >{{ question.questionText | slice : 0 : 60
                  }}{{ question.questionText.length > 60 ? '...' : '' }}</span
                >
                <span class="question-marks"
                  >{{ question.marks }} mark{{
                    question.marks !== 1 ? 's' : ''
                  }}</span
                >
              </div>
            </p-accordion-header>
            <p-accordion-content>
              <div class="question-content">
                <div class="question-text">{{ question.questionText }}</div>

                <div class="options-list">
                  @for (option of question.options; track option.id; let j =
                  $index) {
                  <div
                    class="option-item"
                    [class.correct]="option.id === question.correctOptionId"
                  >
                    <span class="option-letter">{{ getOptionLetter(j) }}</span>
                    <span class="option-text">{{ option.text }}</span>
                    @if (option.id === question.correctOptionId) {
                    <i class="pi pi-check correct-icon"></i>
                    }
                  </div>
                  }
                </div>

                @if (question.explanation) {
                <div class="explanation">
                  <strong>Explanation:</strong> {{ question.explanation }}
                </div>
                }

                <div class="question-actions">
                  <p-button
                    icon="pi pi-pencil"
                    label="Edit"
                    severity="secondary"
                    size="small"
                    [outlined]="true"
                    (click)="editQuestion(question)"
                  />
                  <p-button
                    icon="pi pi-trash"
                    label="Delete"
                    severity="danger"
                    size="small"
                    [outlined]="true"
                    (click)="confirmDeleteQuestion(question)"
                  />
                </div>
              </div>
            </p-accordion-content>
          </p-accordion-panel>
          }
        </p-accordion>
        }
      </p-card>
      }

      <!-- Question Form Dialog (inline) -->
      @if (showQuestionForm()) {
      <p-card styleClass="form-card question-form-card">
        <ng-template #header>
          <div class="card-header">
            <i class="pi pi-pencil card-header__icon"></i>
            <div>
              <h2 class="card-header__title">
                {{ editingQuestion() ? 'Edit Question' : 'Add New Question' }}
              </h2>
              <p class="card-header__subtitle">Fill in the question details</p>
            </div>
          </div>
        </ng-template>

        <form [formGroup]="questionForm">
          <div class="form-grid">
            <!-- Question Text -->
            <div class="form-field">
              <p-floatlabel variant="on">
                <textarea
                  pTextarea
                  id="questionText"
                  formControlName="questionText"
                  rows="3"
                  class="w-full"
                ></textarea>
                <label for="questionText">Question Text *</label>
              </p-floatlabel>
              @if (questionForm.get('questionText')?.invalid &&
              questionForm.get('questionText')?.touched) {
              <small class="form-error">Question text is required</small>
              }
            </div>

            <!-- Options -->
            <div class="form-field">
              <label class="field-label">Options *</label>
              <div class="options-form" formArrayName="options">
                @for (option of optionsArray.controls; track option; let i =
                $index) {
                <div class="option-form-row" [formGroupName]="i">
                  <p-radiobutton
                    name="correctOption"
                    [value]="option.get('id')?.value"
                    [formControl]="correctOptionIdControl"
                    [inputId]="'option-' + i"
                  />
                  <span class="option-letter">{{ getOptionLetter(i) }}</span>
                  <input
                    pInputText
                    formControlName="text"
                    placeholder="Option {{ getOptionLetter(i) }}"
                    class="option-input"
                  />
                  @if (optionsArray.length > 2) {
                  <p-button
                    icon="pi pi-times"
                    severity="danger"
                    [text]="true"
                    [rounded]="true"
                    size="small"
                    (click)="removeOption(i)"
                  />
                  }
                </div>
                }
              </div>
              @if (optionsArray.length < 6) {
              <p-button
                label="Add Option"
                icon="pi pi-plus"
                size="small"
                [text]="true"
                (click)="addOption()"
              />
              }
            </div>

            <!-- Marks Row -->
            <div class="form-row">
              <div class="form-field">
                <label class="field-label">Marks *</label>
                <p-inputnumber
                  formControlName="marks"
                  [min]="1"
                  [max]="100"
                  [showButtons]="true"
                  styleClass="w-full"
                />
              </div>
              <div class="form-field">
                <label class="field-label">Negative Marks</label>
                <p-inputnumber
                  formControlName="negativeMarks"
                  [min]="0"
                  [max]="100"
                  [showButtons]="true"
                  styleClass="w-full"
                />
              </div>
            </div>

            <!-- Explanation -->
            <div class="form-field">
              <p-floatlabel variant="on">
                <textarea
                  pTextarea
                  id="explanation"
                  formControlName="explanation"
                  rows="2"
                  class="w-full"
                ></textarea>
                <label for="explanation">Explanation (shown after exam)</label>
              </p-floatlabel>
            </div>
          </div>

          <div class="form-actions">
            <p-button
              label="Cancel"
              severity="secondary"
              [outlined]="true"
              (click)="cancelQuestionForm()"
            />
            <p-button
              [label]="editingQuestion() ? 'Update Question' : 'Add Question'"
              icon="pi pi-check"
              (click)="saveQuestion()"
              [loading]="savingQuestion()"
              [disabled]="!isQuestionFormValid()"
            />
          </div>
        </form>
      </p-card>
      } }
    </div>

    <p-confirmDialog />
    <p-toast />
  `,
  styles: `
    .exam-editor-page {
      padding: 1.5rem;
      max-width: 900px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
    }

    .page-header__nav {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }

    .page-header__content {
      flex: 1;
    }

    .page-header__title {
      margin: 0 0 0.25rem;
      font-size: 1.75rem;
      font-weight: 600;
    }

    .page-header__subtitle {
      margin: 0;
      color: var(--text-color-secondary);
    }

    :host ::ng-deep .form-card {
      margin-bottom: 1.5rem;
    }

    :host ::ng-deep .form-card .p-card-header {
      padding: 1.5rem 1.5rem 0;
    }

    :host ::ng-deep .form-card .p-card-body {
      padding: 1.5rem;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .card-header__icon {
      font-size: 1.5rem;
      color: var(--primary-color);
    }

    .card-header__title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
    }

    .card-header__subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.875rem;
      color: var(--text-color-secondary);
    }

    .card-header__actions {
      margin-left: auto;
    }

    .form-skeleton {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .form-grid {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .form-field {
      width: 100%;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .field-label {
      display: block;
      font-size: 0.875rem;
      color: var(--text-color-secondary);
      margin-bottom: 0.5rem;
    }

    .form-error {
      display: block;
      color: var(--red-500);
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }

    .w-full {
      width: 100%;
    }

    .settings-row {
      display: flex;
      flex-wrap: wrap;
      gap: 2rem;
      padding: 1rem;
      background: var(--surface-50);
      border-radius: 8px;
    }

    .setting-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .setting-item label {
      font-size: 0.875rem;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--surface-border);
    }

    /* Questions Section */
    .empty-questions {
      text-align: center;
      padding: 3rem;
      color: var(--text-color-secondary);
    }

    .empty-questions i {
      font-size: 3rem;
      opacity: 0.5;
      margin-bottom: 1rem;
      display: block;
    }

    .question-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      width: 100%;
    }

    .question-number {
      font-weight: 600;
      color: var(--primary-color);
      min-width: 32px;
    }

    .question-preview {
      flex: 1;
      color: var(--text-color);
    }

    .question-marks {
      font-size: 0.875rem;
      color: var(--text-color-secondary);
      background: var(--surface-100);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    .question-content {
      padding: 1rem 0;
    }

    .question-text {
      font-size: 1rem;
      margin-bottom: 1rem;
      line-height: 1.5;
    }

    .options-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .option-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--surface-50);
      border-radius: 8px;
      border: 1px solid var(--surface-border);
    }

    .option-item.correct {
      background: var(--green-50);
      border-color: var(--green-200);
    }

    .option-letter {
      font-weight: 600;
      color: var(--text-color-secondary);
      min-width: 24px;
    }

    .option-text {
      flex: 1;
    }

    .correct-icon {
      color: var(--green-500);
    }

    .explanation {
      padding: 1rem;
      background: var(--blue-50);
      border-radius: 8px;
      margin-bottom: 1rem;
      font-size: 0.875rem;
    }

    .question-actions {
      display: flex;
      gap: 0.5rem;
    }

    /* Question Form */
    .options-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .option-form-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .option-input {
      flex: 1;
    }

    :host ::ng-deep .questions-card .p-accordion-panel {
      margin-bottom: 0.5rem;
    }

    /* @REVIEW: Result Settings Panel Styles */
    :host ::ng-deep .result-settings-panel {
      margin-top: 1.5rem;
    }

    :host ::ng-deep .result-settings-panel .p-panel-header {
      background: var(--surface-50);
    }

    .visibility-options {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .visibility-option {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--surface-50);
      border-radius: 8px;
      border: 2px solid transparent;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .visibility-option:hover {
      background: var(--surface-100);
    }

    .visibility-option.selected {
      border-color: var(--primary-color);
      background: var(--primary-50, rgba(var(--primary-500-rgb), 0.1));
    }

    .visibility-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .visibility-label i {
      color: var(--primary-color);
      font-size: 1rem;
    }

    .checkbox-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 0.75rem;
      padding: 1rem;
      background: var(--surface-50);
      border-radius: 8px;
    }

    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .checkbox-item label {
      font-size: 0.875rem;
      cursor: pointer;
    }

    .field-hint {
      display: block;
      color: var(--text-color-secondary);
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }

    .release-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
    }

    .release-status.success {
      background: var(--green-50);
      color: var(--green-700);
    }

    .release-status i {
      font-size: 1rem;
    }

    /* @REVIEW: Exam Style Panel Styles */
    :host ::ng-deep .exam-style-panel {
      margin-top: 1.5rem;
    }

    :host ::ng-deep .exam-style-panel .p-panel-header {
      background: var(--surface-50);
    }

    .style-options {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .style-option {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--surface-50);
      border-radius: 8px;
      border: 2px solid transparent;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .style-option:hover {
      background: var(--surface-100);
    }

    .style-option.selected {
      border-color: var(--primary-color);
      background: var(--primary-50, rgba(var(--primary-500-rgb), 0.1));
    }

    .style-label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      cursor: pointer;
      flex: 1;
    }

    .style-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .style-header i {
      color: var(--primary-color);
      font-size: 1rem;
    }

    .style-name {
      font-weight: 600;
      color: var(--text-color);
    }

    .style-description {
      font-size: 0.8rem;
      color: var(--text-color-secondary);
      line-height: 1.4;
    }

    .style-info-box {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      line-height: 1.5;
      background: var(--blue-50);
      color: var(--blue-700);
    }

    .style-info-box i {
      font-size: 1.25rem;
      flex-shrink: 0;
      margin-top: 0.1rem;
    }

    .style-info-box.style-standard {
      background: var(--blue-50);
      color: var(--blue-700);
    }

    .style-info-box.style-free_navigation {
      background: var(--cyan-50);
      color: var(--cyan-700);
    }

    .style-info-box.style-practice {
      background: var(--green-50);
      color: var(--green-700);
    }

    .style-info-box.style-quiz {
      background: var(--orange-50);
      color: var(--orange-700);
    }

    .style-info-box.style-section_based {
      background: var(--purple-50);
      color: var(--purple-700);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamEditorComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly loading = signal(false);
  readonly savingExam = signal(false);
  readonly loadingQuestions = signal(false);
  readonly savingQuestion = signal(false);
  readonly examId = signal<string | null>(null);
  readonly examStatus = signal<string>('draft');
  readonly subjects = signal<Subject[]>([]);
  readonly questions = signal<Question[]>([]);
  readonly showQuestionForm = signal(false);
  readonly editingQuestion = signal<Question | null>(null);
  readonly activeQuestionIndex = signal<number[]>([]);

  readonly isEditMode = computed(() => !!this.examId());
  readonly teacherId = computed(() => this.authStore.teacherId());

  // @REVIEW: Status options for dropdown
  readonly examStatusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Active', value: 'active' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  // @REVIEW: Result visibility options for radio buttons
  readonly resultVisibilityOptions = [
    {
      label: 'Immediately after submission',
      value: 'immediate',
      icon: 'pi-check-circle',
    },
    {
      label: 'After exam due date',
      value: 'after_due_date',
      icon: 'pi-calendar',
    },
    {
      label: 'Manual release by teacher',
      value: 'manual_release',
      icon: 'pi-lock',
    },
    { label: 'Never (no access)', value: 'never', icon: 'pi-ban' },
  ];

  // @REVIEW: Exam style options for radio buttons
  readonly examStyleOptions = [
    {
      value: 'standard',
      label: 'Standard',
      icon: 'pi-clock',
      description: 'Per-question timer, skip & return allowed',
    },
    {
      value: 'free_navigation',
      label: 'Free Navigation',
      icon: 'pi-arrows-alt',
      description: 'Total time limit, free navigation between questions',
    },
    {
      value: 'practice',
      label: 'Practice Mode',
      icon: 'pi-book',
      description: 'No timer, immediate feedback after each question',
    },
    {
      value: 'quiz',
      label: 'Quiz Mode',
      icon: 'pi-bolt',
      description: 'Per-question timer, sequential only, immediate feedback',
    },
    {
      value: 'section_based',
      label: 'Section Based',
      icon: 'pi-th-large',
      description: 'Per-section timer, free navigation within sections',
    },
  ];

  // @REVIEW: Computed for subject options with "None" option
  readonly subjectOptions = computed(() => this.subjects());

  // @REVIEW: Computed for result settings conditional UI
  readonly showReleaseDatePicker = computed(
    () => this.examForm.get('resultVisibility')?.value === 'manual_release'
  );

  readonly showReleaseButton = computed(
    () =>
      this.examForm.get('resultVisibility')?.value === 'manual_release' &&
      this.isEditMode() &&
      !this.examForm.get('isResultReleased')?.value
  );

  readonly isResultReleased = computed(
    () =>
      this.examForm.get('resultVisibility')?.value === 'manual_release' &&
      this.examForm.get('isResultReleased')?.value === true
  );

  // @REVIEW: Signal for release results loading state
  readonly releasingResults = signal(false);

  // @REVIEW: Computed for exam style conditional UI
  readonly showTotalTimeLimit = computed(() => {
    const style = this.examForm.get('examStyle')?.value;
    return style === 'free_navigation' || style === 'practice';
  });

  readonly showImmediateFeedbackOption = computed(() => {
    const style = this.examForm.get('examStyle')?.value;
    return style === 'practice' || style === 'quiz';
  });

  // @REVIEW: Exam Form - subjectId is now optional (no Validators.required)
  readonly examForm = this.fb.group({
    subjectId: [''],
    title: ['', Validators.required],
    description: [''],
    instructions: [''],
    status: ['draft'],
    timePerQuestionSeconds: [60, [Validators.required, Validators.min(10)]],
    passingMarks: [0],
    allowSkipReturn: [true],
    fullscreenRequired: [true],
    autoSubmitOnBlur: [true],
    // @REVIEW: Result visibility settings
    resultVisibility: ['immediate' as ResultVisibility],
    resultReleaseDate: [null as Date | null],
    isResultReleased: [false],
    showScore: [true],
    showPercentage: [true],
    showPassFail: [true],
    showCorrectAnswers: [true],
    showStudentAnswers: [true],
    showExplanations: [true],
    showQuestionReview: [true],
    showTimeSpent: [true],
    showTeacherRemarks: [true],
    showRank: [false],
    // @REVIEW: Exam style settings
    examStyle: ['standard' as ExamStyle],
    totalTimeLimitMinutes: [null as number | null],
    showImmediateFeedback: [false],
    shuffleQuestions: [false],
    shuffleOptions: [false],
  });

  // Question Form
  readonly questionForm = this.fb.group({
    questionText: ['', Validators.required],
    options: this.fb.array([]),
    correctOptionId: ['', Validators.required],
    marks: [1, [Validators.required, Validators.min(1)]],
    negativeMarks: [0],
    explanation: [''],
  });

  get optionsArray(): FormArray {
    return this.questionForm.get('options') as FormArray;
  }

  // @REVIEW: Getter for correctOptionId FormControl - needed for radiobutton binding outside formGroup context
  get correctOptionIdControl(): FormControl<string> {
    return this.questionForm.get('correctOptionId') as FormControl<string>;
  }

  ngOnInit(): void {
    this.loadSubjects();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.examId.set(id);
      this.loadExam(id);
      this.loadQuestions(id);
    }
  }

  private loadSubjects(): void {
    const teacherId = this.teacherId();
    if (!teacherId) return;

    this.db.subjects
      .getByTeacher(teacherId, { page: 1, pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) =>
          this.subjects.set(response.items.filter((s) => s.isActive)),
        error: (err) => console.error('Failed to load subjects:', err),
      });
  }

  private loadExam(id: string): void {
    this.loading.set(true);

    this.db.exams
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (exam) => {
          if (!exam) {
            this.loading.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Exam not found.',
            });
            this.goBack();
            return;
          }

          this.examStatus.set(exam.status);
          this.examForm.patchValue({
            subjectId: exam.subjectId,
            title: exam.title,
            description: exam.description ?? '',
            instructions: exam.instructions ?? '',
            status: exam.status,
            timePerQuestionSeconds: exam.timePerQuestionSeconds,
            passingMarks: exam.passingMarks,
            allowSkipReturn: exam.allowSkipReturn,
            fullscreenRequired: exam.fullscreenRequired,
            autoSubmitOnBlur: exam.autoSubmitOnBlur,
            // @REVIEW: Result visibility settings
            resultVisibility: exam.resultVisibility,
            resultReleaseDate: exam.resultReleaseDate,
            isResultReleased: exam.isResultReleased,
            showScore: exam.showScore,
            showPercentage: exam.showPercentage,
            showPassFail: exam.showPassFail,
            showCorrectAnswers: exam.showCorrectAnswers,
            showStudentAnswers: exam.showStudentAnswers,
            showExplanations: exam.showExplanations,
            showQuestionReview: exam.showQuestionReview,
            showTimeSpent: exam.showTimeSpent,
            showTeacherRemarks: exam.showTeacherRemarks,
            showRank: exam.showRank,
            // @REVIEW: Exam style settings
            examStyle: exam.examStyle,
            totalTimeLimitMinutes: exam.totalTimeLimitMinutes,
            showImmediateFeedback: exam.showImmediateFeedback,
            shuffleQuestions: exam.shuffleQuestions,
            shuffleOptions: exam.shuffleOptions,
          });
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load exam:', err);
          this.loading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load exam details.',
          });
          this.goBack();
        },
      });
  }

  private loadQuestions(examId: string): void {
    this.loadingQuestions.set(true);

    this.db.questions
      .getByExam(examId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (questions) => {
          this.questions.set(questions);
          this.loadingQuestions.set(false);
        },
        error: (err) => {
          console.error('Failed to load questions:', err);
          this.loadingQuestions.set(false);
        },
      });
  }

  saveExam(): void {
    if (!this.examForm.valid) return;

    const teacherId = this.teacherId();
    if (!teacherId) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Teacher ID not found. Please log in again.',
      });
      return;
    }

    this.savingExam.set(true);
    const formValue = this.examForm.value;

    if (this.isEditMode()) {
      // @REVIEW: Added status and result visibility settings to update payload
      this.db.exams
        .update(this.examId()!, {
          title: formValue.title || undefined,
          description: formValue.description || undefined,
          instructions: formValue.instructions || undefined,
          status: (formValue.status as ExamStatus) || undefined,
          timePerQuestionSeconds: formValue.timePerQuestionSeconds ?? undefined,
          passingMarks: formValue.passingMarks ?? undefined,
          allowSkipReturn: formValue.allowSkipReturn ?? undefined,
          fullscreenRequired: formValue.fullscreenRequired ?? undefined,
          autoSubmitOnBlur: formValue.autoSubmitOnBlur ?? undefined,
          // @REVIEW: Result visibility settings
          resultVisibility:
            (formValue.resultVisibility as ResultVisibility) ?? undefined,
          resultReleaseDate: formValue.resultReleaseDate ?? undefined,
          showScore: formValue.showScore ?? undefined,
          showPercentage: formValue.showPercentage ?? undefined,
          showPassFail: formValue.showPassFail ?? undefined,
          showCorrectAnswers: formValue.showCorrectAnswers ?? undefined,
          showStudentAnswers: formValue.showStudentAnswers ?? undefined,
          showExplanations: formValue.showExplanations ?? undefined,
          showQuestionReview: formValue.showQuestionReview ?? undefined,
          showTimeSpent: formValue.showTimeSpent ?? undefined,
          showTeacherRemarks: formValue.showTeacherRemarks ?? undefined,
          showRank: formValue.showRank ?? undefined,
          // @REVIEW: Exam style settings
          examStyle: (formValue.examStyle as ExamStyle) ?? undefined,
          totalTimeLimitMinutes: formValue.totalTimeLimitMinutes ?? undefined,
          showImmediateFeedback: formValue.showImmediateFeedback ?? undefined,
          shuffleQuestions: formValue.shuffleQuestions ?? undefined,
          shuffleOptions: formValue.shuffleOptions ?? undefined,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.savingExam.set(false);
            // @REVIEW: Update status signal after save
            if (formValue.status) {
              this.examStatus.set(formValue.status);
            }
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Exam updated successfully.',
            });
          },
          error: (err) => {
            console.error('Failed to update exam:', err);
            this.savingExam.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to update exam.',
            });
          },
        });
    } else {
      this.db.exams
        .create({
          teacherId,
          subjectId: formValue.subjectId!,
          title: formValue.title!,
          description: formValue.description || undefined,
          instructions: formValue.instructions || undefined,
          timePerQuestionSeconds: formValue.timePerQuestionSeconds ?? 60,
          passingMarks: formValue.passingMarks ?? 0,
          allowSkipReturn: formValue.allowSkipReturn ?? true,
          fullscreenRequired: formValue.fullscreenRequired ?? true,
          autoSubmitOnBlur: formValue.autoSubmitOnBlur ?? true,
          // @REVIEW: Result visibility settings
          resultVisibility:
            (formValue.resultVisibility as ResultVisibility) ?? 'immediate',
          resultReleaseDate: formValue.resultReleaseDate ?? undefined,
          showScore: formValue.showScore ?? true,
          showPercentage: formValue.showPercentage ?? true,
          showPassFail: formValue.showPassFail ?? true,
          showCorrectAnswers: formValue.showCorrectAnswers ?? true,
          showStudentAnswers: formValue.showStudentAnswers ?? true,
          showExplanations: formValue.showExplanations ?? true,
          showQuestionReview: formValue.showQuestionReview ?? true,
          showTimeSpent: formValue.showTimeSpent ?? true,
          showTeacherRemarks: formValue.showTeacherRemarks ?? true,
          showRank: formValue.showRank ?? false,
          // @REVIEW: Exam style settings
          examStyle: (formValue.examStyle as ExamStyle) ?? 'standard',
          totalTimeLimitMinutes: formValue.totalTimeLimitMinutes ?? undefined,
          showImmediateFeedback: formValue.showImmediateFeedback ?? false,
          shuffleQuestions: formValue.shuffleQuestions ?? false,
          shuffleOptions: formValue.shuffleOptions ?? false,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (exam) => {
            this.savingExam.set(false);
            this.examId.set(exam.id);
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Exam created. Now add questions!',
            });
            // Update URL without navigation
            this.router.navigate(['/teacher/exams', exam.id, 'edit'], {
              replaceUrl: true,
            });
          },
          error: (err) => {
            console.error('Failed to create exam:', err);
            this.savingExam.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.message || 'Failed to create exam.',
            });
          },
        });
    }
  }

  // Question Management
  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index); // A, B, C, D...
  }

  addQuestion(): void {
    this.editingQuestion.set(null);
    this.resetQuestionForm();
    this.showQuestionForm.set(true);
  }

  editQuestion(question: Question): void {
    this.editingQuestion.set(question);

    // Clear and rebuild options array with regenerated IDs
    while (this.optionsArray.length) {
      this.optionsArray.removeAt(0);
    }

    // Find the index of the correct option to map to new ID
    const correctOptionIndex = question.options.findIndex(
      (opt) => opt.id === question.correctOptionId
    );

    question.options.forEach((opt, index) => {
      const newId = `opt-${index + 1}`;
      this.optionsArray.push(
        this.fb.group({
          id: [newId],
          text: [opt.text, Validators.required],
        })
      );
    });

    // Map correctOptionId to the new regenerated ID
    const newCorrectOptionId =
      correctOptionIndex >= 0 ? `opt-${correctOptionIndex + 1}` : '';

    this.questionForm.patchValue({
      questionText: question.questionText,
      correctOptionId: newCorrectOptionId,
      marks: question.marks,
      negativeMarks: question.negativeMarks,
      explanation: question.explanation ?? '',
    });

    this.showQuestionForm.set(true);
  }

  private resetQuestionForm(): void {
    this.questionForm.reset({
      questionText: '',
      correctOptionId: '',
      marks: 1,
      negativeMarks: 0,
      explanation: '',
    });

    // Clear and add 4 default options
    while (this.optionsArray.length) {
      this.optionsArray.removeAt(0);
    }

    for (let i = 0; i < 4; i++) {
      this.addOption();
    }
  }

  addOption(): void {
    const id = `opt-${this.optionsArray.length + 1}`;
    this.optionsArray.push(
      this.fb.group({
        id: [id],
        text: ['', Validators.required],
      })
    );
  }

  removeOption(index: number): void {
    const optionId = this.optionsArray.at(index).get('id')?.value;
    if (this.questionForm.get('correctOptionId')?.value === optionId) {
      this.questionForm.patchValue({ correctOptionId: '' });
    }
    this.optionsArray.removeAt(index);
  }

  cancelQuestionForm(): void {
    this.showQuestionForm.set(false);
    this.editingQuestion.set(null);
  }

  isQuestionFormValid(): boolean {
    if (!this.questionForm.get('questionText')?.value) return false;
    if (!this.questionForm.get('correctOptionId')?.value) return false;

    // Check all options have text
    const options = this.optionsArray.value as { id: string; text: string }[];
    if (options.some((o) => !o.text?.trim())) return false;

    return true;
  }

  saveQuestion(): void {
    if (!this.isQuestionFormValid()) return;

    const examId = this.examId();
    if (!examId) return;

    this.savingQuestion.set(true);
    const formValue = this.questionForm.value;
    const options: QuestionOption[] = (
      formValue.options as { id: string; text: string }[]
    ).map((o) => ({
      id: o.id,
      text: o.text,
    }));

    const editing = this.editingQuestion();

    if (editing) {
      // Update existing question
      this.db.questions
        .update(editing.id, {
          questionText: formValue.questionText || undefined,
          options,
          correctOptionId: formValue.correctOptionId || undefined,
          marks: formValue.marks ?? undefined,
          negativeMarks: formValue.negativeMarks ?? undefined,
          explanation: formValue.explanation || undefined,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.savingQuestion.set(false);
            this.showQuestionForm.set(false);
            this.editingQuestion.set(null);
            this.loadQuestions(examId);
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Question updated.',
            });
          },
          error: (err) => {
            console.error('Failed to update question:', err);
            this.savingQuestion.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to update question.',
            });
          },
        });
    } else {
      // Create new question
      const sequenceNumber = this.questions().length + 1;

      this.db.questions
        .create({
          examId,
          questionText: formValue.questionText!,
          options,
          correctOptionId: formValue.correctOptionId!,
          marks: formValue.marks ?? 1,
          negativeMarks: formValue.negativeMarks ?? 0,
          explanation: formValue.explanation || undefined,
          sequenceNumber,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.savingQuestion.set(false);
            this.showQuestionForm.set(false);
            this.loadQuestions(examId);
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Question added.',
            });
          },
          error: (err) => {
            console.error('Failed to create question:', err);
            this.savingQuestion.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to add question.',
            });
          },
        });
    }
  }

  confirmDeleteQuestion(question: Question): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete this question?',
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.db.questions
          .delete(question.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.loadQuestions(this.examId()!);
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Question deleted.',
              });
            },
            error: (err) => {
              console.error('Failed to delete question:', err);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to delete question.',
              });
            },
          });
      },
    });
  }

  confirmPublish(): void {
    this.confirmationService.confirm({
      message:
        'Are you sure you want to publish this exam? Students will be able to take it once published.',
      header: 'Confirm Publish',
      icon: 'pi pi-play',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => {
        this.db.exams
          .publish(this.examId()!)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.examStatus.set('active');
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Exam published successfully!',
              });
            },
            error: (err) => {
              console.error('Failed to publish exam:', err);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to publish exam.',
              });
            },
          });
      },
    });
  }

  // @REVIEW: Release results for manual_release mode
  releaseResults(): void {
    if (!this.examId()) return;

    this.releasingResults.set(true);
    this.db.exams
      .update(this.examId()!, { isResultReleased: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.releasingResults.set(false);
          this.examForm.patchValue({ isResultReleased: true });
          this.messageService.add({
            severity: 'success',
            summary: 'Results Released',
            detail: 'Students can now view their results.',
          });
        },
        error: (err) => {
          console.error('Failed to release results:', err);
          this.releasingResults.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to release results.',
          });
        },
      });
  }

  // @REVIEW: Helper method to select exam style
  selectExamStyle(style: string): void {
    this.examForm.patchValue({ examStyle: style as ExamStyle });

    // Reset dependent fields based on style
    if (style === 'standard' || style === 'quiz' || style === 'section_based') {
      this.examForm.patchValue({ totalTimeLimitMinutes: null });
    }
    if (
      style === 'standard' ||
      style === 'free_navigation' ||
      style === 'section_based'
    ) {
      this.examForm.patchValue({ showImmediateFeedback: false });
    }
    if (style === 'practice' || style === 'quiz') {
      this.examForm.patchValue({ showImmediateFeedback: true });
    }
  }

  // @REVIEW: Get info text for the selected exam style
  getExamStyleInfo(): string {
    const style = this.examForm.get('examStyle')?.value;
    const styleInfoMap: Record<string, string> = {
      standard:
        'Standard mode uses per-question timing. Students can skip questions and return to them later. Results are shown only after submission.',
      free_navigation:
        'Free Navigation mode allows students to jump between any questions freely. A total time limit applies to the entire exam rather than individual questions.',
      practice:
        'Practice mode is designed for learning. No time pressure, and students see whether their answer was correct immediately after answering each question.',
      quiz: 'Quiz mode is fast-paced with per-question timing. Students must answer questions in order (no going back). Immediate feedback is shown after each question.',
      section_based:
        'Section Based mode organizes questions into sections. Each section has its own time limit, and students can navigate freely within a section but cannot go back to previous sections.',
    };
    return (
      styleInfoMap[style as string] ||
      'Select an exam style to see more information.'
    );
  }

  goBack(): void {
    this.router.navigate(['/teacher/exams']);
  }
}
