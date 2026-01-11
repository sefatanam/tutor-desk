// @REVIEW: Subject Form Page - Create/Edit subject as dedicated page (replaces dialog)
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ColorPickerModule } from 'primeng/colorpicker';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';

@Component({
  selector: 'app-subject-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    FloatLabelModule,
    ColorPickerModule,
    TextareaModule,
    ToastModule,
    SkeletonModule,
  ],
  providers: [MessageService],
  template: `
    <div class="subject-form-page">
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
            <h1 class="page-header__title">{{ isEditMode() ? 'Edit Subject' : 'Add New Subject' }}</h1>
            <p class="page-header__subtitle">
              {{ isEditMode() ? 'Update the subject details below' : 'Fill in the details to create a new subject' }}
            </p>
          </div>
        </div>
      </header>

      @if (loading()) {
        <p-card styleClass="form-card">
          <div class="form-skeleton">
            @for (i of [1, 2, 3, 4]; track i) {
              <p-skeleton width="100%" height="56px" />
            }
          </div>
        </p-card>
      } @else {
        <p-card styleClass="form-card">
          <form [formGroup]="subjectForm" (ngSubmit)="saveSubject()">
            <div class="form-grid">
              <!-- Subject Name -->
              <div class="form-field">
                <p-floatlabel variant="on">
                  <input
                    pInputText
                    id="name"
                    formControlName="name"
                    class="w-full"
                  />
                  <label for="name">Subject Name *</label>
                </p-floatlabel>
                @if (subjectForm.get('name')?.invalid && subjectForm.get('name')?.touched) {
                  <small class="form-error">Subject name is required</small>
                }
              </div>

              <!-- Subject Code -->
              <div class="form-field">
                <p-floatlabel variant="on">
                  <input
                    pInputText
                    id="code"
                    formControlName="code"
                    class="w-full"
                  />
                  <label for="code">Subject Code</label>
                </p-floatlabel>
                <small class="form-hint">Optional. e.g., MATH101, ENG201</small>
              </div>

              <!-- Description -->
              <div class="form-field">
                <p-floatlabel variant="on">
                  <textarea
                    pTextarea
                    id="description"
                    formControlName="description"
                    rows="4"
                    class="w-full"
                  ></textarea>
                  <label for="description">Description</label>
                </p-floatlabel>
              </div>

              <!-- Color and Icon Row -->
              <div class="form-row">
                <div class="form-field form-field--small">
                  <label class="field-label">Color</label>
                  <p-colorpicker formControlName="color" />
                </div>
                <div class="form-field form-field--grow">
                  <p-floatlabel variant="on">
                    <input
                      pInputText
                      id="icon"
                      formControlName="icon"
                      class="w-full"
                    />
                    <label for="icon">Icon (pi-*)</label>
                  </p-floatlabel>
                  <small class="form-hint">PrimeIcons class name, e.g., pi-book, pi-calculator</small>
                </div>
              </div>

              <!-- Icon Preview -->
              <div class="icon-preview-section">
                <span class="icon-preview__label">Preview:</span>
                <div class="icon-preview__box" [style.background]="subjectForm.get('color')?.value">
                  <i [class]="'pi ' + subjectForm.get('icon')?.value"></i>
                </div>
                <span class="icon-preview__text">{{ subjectForm.get('name')?.value || 'Subject Name' }}</span>
              </div>
            </div>

            <!-- Form Actions -->
            <div class="form-actions">
              <p-button
                label="Cancel"
                severity="secondary"
                [outlined]="true"
                (click)="goBack()"
              />
              <p-button
                [label]="isEditMode() ? 'Update Subject' : 'Create Subject'"
                icon="pi pi-check"
                type="submit"
                [loading]="saving()"
                [disabled]="!subjectForm.valid"
              />
            </div>
          </form>
        </p-card>
      }
    </div>

    <p-toast />
  `,
  styles: `
    .subject-form-page {
      padding: 1.5rem;
      max-width: 800px;
      margin: 0 auto;
    }

    .page-header {
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

    :host ::ng-deep .form-card .p-card-body {
      padding: 2rem;
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

    .form-field--small {
      width: auto;
    }

    .form-field--grow {
      flex: 1;
    }

    .form-row {
      display: flex;
      gap: 1.5rem;
      align-items: flex-start;
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

    .form-hint {
      display: block;
      color: var(--text-color-secondary);
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }

    .w-full {
      width: 100%;
    }

    .icon-preview-section {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: var(--surface-50);
      border-radius: 8px;
    }

    .icon-preview__label {
      font-size: 0.875rem;
      color: var(--text-color-secondary);
    }

    .icon-preview__box {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 8px;
      color: white;
      font-size: 1.5rem;
    }

    .icon-preview__text {
      font-weight: 500;
      font-size: 1.125rem;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid var(--surface-border);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubjectFormComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly messageService = inject(MessageService);
  // @REVIEW: DestroyRef for subscription cleanup
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly subjectId = signal<string | null>(null);

  readonly isEditMode = computed(() => !!this.subjectId());
  readonly teacherId = computed(() => this.authStore.teacherId());

  readonly subjectForm = this.fb.group({
    name: ['', Validators.required],
    code: [''],
    description: [''],
    color: ['#4CAF50'],
    icon: ['pi-book'],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.subjectId.set(id);
      this.loadSubject(id);
    }
  }

  private loadSubject(id: string): void {
    this.loading.set(true);

    this.db.subjects.getById(id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (subject) => {
        // @REVIEW: Handle null case - subject not found
        if (!subject) {
          this.loading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Subject not found.',
          });
          this.goBack();
          return;
        }

        this.subjectForm.patchValue({
          name: subject.name,
          code: subject.code ?? '',
          description: subject.description ?? '',
          color: subject.color,
          icon: subject.icon,
        });
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load subject:', err);
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load subject details.',
        });
        this.goBack();
      },
    });
  }

  saveSubject(): void {
    if (!this.subjectForm.valid) return;

    const teacherId = this.teacherId();
    if (!teacherId) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Teacher ID not found. Please log in again.',
      });
      return;
    }

    this.saving.set(true);
    const formValue = this.subjectForm.value;

    if (this.isEditMode()) {
      this.db.subjects.update(this.subjectId()!, {
        name: formValue.name || undefined,
        code: formValue.code || undefined,
        description: formValue.description || undefined,
        color: formValue.color || undefined,
        icon: formValue.icon || undefined,
      }).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: () => {
          this.saving.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Subject updated successfully.',
          });
          this.goBack();
        },
        error: (err) => {
          console.error('Failed to update subject:', err);
          this.saving.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to update subject.',
          });
        },
      });
    } else {
      this.db.subjects.create({
        teacherId,
        name: formValue.name!,
        code: formValue.code || undefined,
        description: formValue.description || undefined,
        color: formValue.color || undefined,
        icon: formValue.icon || undefined,
      }).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: () => {
          this.saving.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Subject created successfully.',
          });
          this.goBack();
        },
        error: (err) => {
          console.error('Failed to create subject:', err);
          this.saving.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.message || 'Failed to create subject.',
          });
        },
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/teacher/subjects']);
  }
}
