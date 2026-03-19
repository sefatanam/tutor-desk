// @REVIEW: Student Form Page - Create/Edit student as dedicated page (replaces dialog)
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
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';

@Component({
  selector: 'app-student-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    FloatLabelModule,
    DatePickerModule,
    TextareaModule,
    ToastModule,
    SkeletonModule,
    DividerModule,
    PasswordModule,
  ],
  providers: [MessageService],
  templateUrl: './student-form.component.html',
  styles: `
    .student-form-page {
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

    .form-error {
      display: block;
      color: var(--red-500);
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }

    .w-full {
      width: 100%;
    }

    :host ::ng-deep .w-full .p-inputtext,
    :host ::ng-deep .w-full .p-password-input {
      width: 100%;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      margin-top: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentFormComponent implements OnInit {
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
  readonly studentId = signal<string | null>(null);

  readonly isEditMode = computed(() => !!this.studentId());
  readonly teacherId = computed(() => this.authStore.teacherId());

  // Max date for date of birth (must be at least 5 years old)
  readonly maxDate = new Date(
    new Date().setFullYear(new Date().getFullYear() - 5)
  );

  readonly studentForm = this.fb.group({
    // Account fields (only for create)
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    // Student details
    rollNumber: [''],
    className: [''],
    section: [''],
    dateOfBirth: [null as Date | null],
    // Guardian info
    guardianName: [''],
    guardianPhone: [''],
    address: [''],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.studentId.set(id);
      this.loadStudent(id);
      // Clear validators for account fields in edit mode
      this.studentForm.get('fullName')?.clearValidators();
      this.studentForm.get('email')?.clearValidators();
      this.studentForm.get('password')?.clearValidators();
      this.studentForm.updateValueAndValidity();
    }
  }

  private loadStudent(id: string): void {
    this.loading.set(true);

    this.db.students
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (student) => {
          // @REVIEW: Handle null case - student not found
          if (!student) {
            this.loading.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Student not found.',
            });
            this.goBack();
            return;
          }

          this.studentForm.patchValue({
            fullName: student.user.fullName,
            email: student.user.email,
            rollNumber: student.rollNumber ?? '',
            className: student.className ?? '',
            section: student.section ?? '',
            dateOfBirth: student.dateOfBirth
              ? new Date(student.dateOfBirth)
              : null,
            guardianName: student.guardianName ?? '',
            guardianPhone: student.guardianPhone ?? '',
            address: student.address ?? '',
          });
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load student:', err);
          this.loading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load student details.',
          });
          this.goBack();
        },
      });
  }

  isFormValid(): boolean {
    if (this.isEditMode()) {
      // In edit mode, we don't need account fields
      return true;
    }
    return this.studentForm.valid;
  }

  saveStudent(): void {
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
    const formValue = this.studentForm.value;

    if (this.isEditMode()) {
      this.db.students
        .update(this.studentId()!, {
          rollNumber: formValue.rollNumber || undefined,
          className: formValue.className || undefined,
          section: formValue.section || undefined,
          dateOfBirth: formValue.dateOfBirth || undefined,
          guardianName: formValue.guardianName || undefined,
          guardianPhone: formValue.guardianPhone || undefined,
          address: formValue.address || undefined,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Student updated successfully.',
            });
            this.goBack();
          },
          error: (err) => {
            console.error('Failed to update student:', err);
            this.saving.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to update student.',
            });
          },
        });
    } else {
      if (!this.studentForm.valid) {
        this.messageService.add({
          severity: 'error',
          summary: 'Validation Error',
          detail: 'Please fill in all required fields.',
        });
        this.saving.set(false);
        return;
      }

      this.db.students
        .create({
          email: formValue.email!,
          password: formValue.password!,
          fullName: formValue.fullName!,
          teacherId,
          rollNumber: formValue.rollNumber || undefined,
          className: formValue.className || undefined,
          section: formValue.section || undefined,
          dateOfBirth: formValue.dateOfBirth || undefined,
          guardianName: formValue.guardianName || undefined,
          guardianPhone: formValue.guardianPhone || undefined,
          address: formValue.address || undefined,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Student created successfully.',
            });
            this.goBack();
          },
          error: (err) => {
            console.error('Failed to create student:', err);
            this.saving.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.message || 'Failed to create student.',
            });
          },
        });
    }
  }

  goBack(): void {
    this.router.navigate(['/teacher/students']);
  }
}
