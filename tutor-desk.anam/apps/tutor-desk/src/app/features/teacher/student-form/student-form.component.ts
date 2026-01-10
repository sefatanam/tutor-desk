// @REVIEW: Student Form Page - Create/Edit student as dedicated page (replaces dialog)
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
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
  template: `
    <div class="student-form-page">
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
            <h1 class="page-header__title">{{ isEditMode() ? 'Edit Student' : 'Add New Student' }}</h1>
            <p class="page-header__subtitle">
              {{ isEditMode() ? 'Update the student information below' : 'Fill in the details to create a new student account' }}
            </p>
          </div>
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
        <form [formGroup]="studentForm" (ngSubmit)="saveStudent()">
          <!-- Account Information Card (only for create mode) -->
          @if (!isEditMode()) {
            <p-card styleClass="form-card">
              <ng-template #header>
                <div class="card-header">
                  <i class="pi pi-user card-header__icon"></i>
                  <div>
                    <h2 class="card-header__title">Account Information</h2>
                    <p class="card-header__subtitle">Login credentials for the student</p>
                  </div>
                </div>
              </ng-template>

              <div class="form-grid">
                <!-- Full Name -->
                <div class="form-field">
                  <p-floatlabel variant="on">
                    <input
                      pInputText
                      id="fullName"
                      formControlName="fullName"
                      class="w-full"
                    />
                    <label for="fullName">Full Name *</label>
                  </p-floatlabel>
                  @if (studentForm.get('fullName')?.invalid && studentForm.get('fullName')?.touched) {
                    <small class="form-error">Full name is required</small>
                  }
                </div>

                <!-- Email -->
                <div class="form-field">
                  <p-floatlabel variant="on">
                    <input
                      pInputText
                      id="email"
                      formControlName="email"
                      type="email"
                      class="w-full"
                    />
                    <label for="email">Email *</label>
                  </p-floatlabel>
                  @if (studentForm.get('email')?.hasError('required') && studentForm.get('email')?.touched) {
                    <small class="form-error">Email is required</small>
                  }
                  @if (studentForm.get('email')?.hasError('email') && studentForm.get('email')?.touched) {
                    <small class="form-error">Please enter a valid email address</small>
                  }
                </div>

                <!-- Password -->
                <div class="form-field">
                  <p-floatlabel variant="on">
                    <p-password
                      id="password"
                      formControlName="password"
                      [toggleMask]="true"
                      [feedback]="true"
                      styleClass="w-full"
                      inputStyleClass="w-full"
                    />
                    <label for="password">Password *</label>
                  </p-floatlabel>
                  @if (studentForm.get('password')?.invalid && studentForm.get('password')?.touched) {
                    <small class="form-error">Password is required (min 6 characters)</small>
                  }
                </div>
              </div>
            </p-card>
          }

          <!-- Student Details Card -->
          <p-card styleClass="form-card">
            <ng-template #header>
              <div class="card-header">
                <i class="pi pi-id-card card-header__icon"></i>
                <div>
                  <h2 class="card-header__title">Student Details</h2>
                  <p class="card-header__subtitle">Academic and identification information</p>
                </div>
              </div>
            </ng-template>

            <div class="form-grid">
              <!-- Roll Number -->
              <div class="form-field">
                <p-floatlabel variant="on">
                  <input
                    pInputText
                    id="rollNumber"
                    formControlName="rollNumber"
                    class="w-full"
                  />
                  <label for="rollNumber">Roll Number</label>
                </p-floatlabel>
              </div>

              <!-- Class and Section Row -->
              <div class="form-row">
                <div class="form-field">
                  <p-floatlabel variant="on">
                    <input
                      pInputText
                      id="className"
                      formControlName="className"
                      class="w-full"
                    />
                    <label for="className">Class</label>
                  </p-floatlabel>
                </div>
                <div class="form-field">
                  <p-floatlabel variant="on">
                    <input
                      pInputText
                      id="section"
                      formControlName="section"
                      class="w-full"
                    />
                    <label for="section">Section</label>
                  </p-floatlabel>
                </div>
              </div>

              <!-- Date of Birth -->
              <div class="form-field">
                <p-floatlabel variant="on">
                  <p-datepicker
                    id="dateOfBirth"
                    formControlName="dateOfBirth"
                    dateFormat="dd/mm/yy"
                    [showIcon]="true"
                    [maxDate]="maxDate"
                    styleClass="w-full"
                    inputStyleClass="w-full"
                  />
                  <label for="dateOfBirth">Date of Birth</label>
                </p-floatlabel>
              </div>
            </div>
          </p-card>

          <!-- Guardian Information Card -->
          <p-card styleClass="form-card">
            <ng-template #header>
              <div class="card-header">
                <i class="pi pi-users card-header__icon"></i>
                <div>
                  <h2 class="card-header__title">Guardian Information</h2>
                  <p class="card-header__subtitle">Parent or guardian contact details</p>
                </div>
              </div>
            </ng-template>

            <div class="form-grid">
              <!-- Guardian Name -->
              <div class="form-field">
                <p-floatlabel variant="on">
                  <input
                    pInputText
                    id="guardianName"
                    formControlName="guardianName"
                    class="w-full"
                  />
                  <label for="guardianName">Guardian Name</label>
                </p-floatlabel>
              </div>

              <!-- Guardian Phone -->
              <div class="form-field">
                <p-floatlabel variant="on">
                  <input
                    pInputText
                    id="guardianPhone"
                    formControlName="guardianPhone"
                    class="w-full"
                  />
                  <label for="guardianPhone">Guardian Phone</label>
                </p-floatlabel>
              </div>

              <!-- Address -->
              <div class="form-field">
                <p-floatlabel variant="on">
                  <textarea
                    pTextarea
                    id="address"
                    formControlName="address"
                    rows="3"
                    class="w-full"
                  ></textarea>
                  <label for="address">Address</label>
                </p-floatlabel>
              </div>
            </div>
          </p-card>

          <!-- Form Actions -->
          <div class="form-actions">
            <p-button
              label="Cancel"
              severity="secondary"
              [outlined]="true"
              (click)="goBack()"
            />
            <p-button
              [label]="isEditMode() ? 'Update Student' : 'Create Student'"
              icon="pi pi-check"
              type="submit"
              [loading]="saving()"
              [disabled]="!isFormValid()"
            />
          </div>
        </form>
      }
    </div>

    <p-toast />
  `,
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

  // State
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly studentId = signal<string | null>(null);

  readonly isEditMode = computed(() => !!this.studentId());
  readonly teacherId = computed(() => this.authStore.teacherId());

  // Max date for date of birth (must be at least 5 years old)
  readonly maxDate = new Date(new Date().setFullYear(new Date().getFullYear() - 5));

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

    this.db.students.getById(id).subscribe({
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
          dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth) : null,
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
      this.db.students.update(this.studentId()!, {
        rollNumber: formValue.rollNumber || undefined,
        className: formValue.className || undefined,
        section: formValue.section || undefined,
        dateOfBirth: formValue.dateOfBirth || undefined,
        guardianName: formValue.guardianName || undefined,
        guardianPhone: formValue.guardianPhone || undefined,
        address: formValue.address || undefined,
      }).subscribe({
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

      this.db.students.create({
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
      }).subscribe({
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
