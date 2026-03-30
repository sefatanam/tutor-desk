/**
 * Go API Database Adapter
 * Implements IDatabaseAdapter against the Go REST backend at /api/v1.
 *
 * Response shapes mirror the Go models package (snake_case JSON).
 * All camelCase ↔ snake_case mapping is done locally here.
 */

import { Injectable, inject, InjectionToken } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, from, map } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import {
  IDatabaseAdapter,
  IAuthAdapter,
  IUserAdapter,
  ITeacherAdapter,
  IStudentAdapter,
  ISubjectAdapter,
  IExamAdapter,
  IQuestionAdapter,
  ISubmissionAdapter,
  IAssetAdapter,
  ICommentAdapter,
  IAdminAdapter,
  ISettingsAdapter,
} from './database.adapter';
import {
  User,
  CreateUserDto,
  UpdateUserDto,
  Teacher,
  TeacherWithUser,
  CreateTeacherDto,
  UpdateTeacherDto,
  Student,
  StudentWithUser,
  CreateStudentDto,
  UpdateStudentDto,
  Subject,
  CreateSubjectDto,
  UpdateSubjectDto,
  SubjectEnrollment,
  Exam,
  ExamWithSubject,
  CreateExamDto,
  UpdateExamDto,
  Question,
  CreateQuestionDto,
  UpdateQuestionDto,
  ExamSubmission,
  ExamSubmissionWithDetails,
  SubmissionAnswer,
  CreateSubmissionAnswerDto,
  UpdateSubmissionAnswerDto,
  Asset,
  CreateAssetDto,
  UpdateAssetDto,
  AssetComment,
  AssetCommentWithUser,
  CreateAssetCommentDto,
  PaginatedResponse,
  PaginationParams,
  AuthSession,
  LoginCredentials,
  TeacherDashboardStats,
  StudentDashboardStats,
  SuperAdminDashboardStats,
  UserStatus,
  SettingsCategory,
  SystemSetting,
  CreateSettingsCategoryDto,
  UpdateSettingsCategoryDto,
  CreateSystemSettingDto,
  UpdateSystemSettingDto,
} from '../models';

// =============================================
// INJECTION TOKEN
// =============================================

export const GO_API_DATABASE_ADAPTER = new InjectionToken<IDatabaseAdapter>('GO_API_DATABASE_ADAPTER');

// =============================================
// MAPPERS  (snake_case API → camelCase models)
// =============================================

function mapUser(r: Record<string, unknown>): User {
  return {
    id: r['id'] as string,
    email: r['email'] as string,
    fullName: r['full_name'] as string,
    avatarUrl: (r['avatar_url'] as string | null) ?? null,
    role: r['role'] as User['role'],
    status: r['status'] as User['status'],
    phone: (r['phone'] as string | null) ?? null,
    authProvider: (r['auth_provider'] as User['authProvider']) ?? 'email',
    authProviderId: (r['auth_provider_id'] as string | null) ?? null,
    lastLoginAt: r['last_login_at'] ? new Date(r['last_login_at'] as string) : null,
    createdBy: (r['created_by'] as string | null) ?? null,
    createdAt: new Date(r['created_at'] as string),
    updatedAt: new Date(r['updated_at'] as string),
  };
}

function mapTeacher(r: Record<string, unknown>): Teacher {
  return {
    id: r['id'] as string,
    userId: r['user_id'] as string,
    qualification: (r['qualification'] as string | null) ?? null,
    specialization: (r['specialization'] as string | null) ?? null,
    bio: (r['bio'] as string | null) ?? null,
    allowStudentComments: r['allow_student_comments'] as boolean,
    showExamResultsImmediately: r['show_exam_results_immediately'] as boolean,
    totalStudents: (r['total_students'] as number) ?? 0,
    totalSubjects: (r['total_subjects'] as number) ?? 0,
    totalExams: (r['total_exams'] as number) ?? 0,
    approvedAt: r['approved_at'] ? new Date(r['approved_at'] as string) : null,
    approvedBy: (r['approved_by'] as string | null) ?? null,
    createdAt: new Date(r['created_at'] as string),
    updatedAt: new Date(r['updated_at'] as string),
  };
}

function mapTeacherWithUser(r: Record<string, unknown>): TeacherWithUser {
  return {
    ...mapTeacher(r),
    user: mapUser(r['user'] as Record<string, unknown>),
  };
}

function mapStudent(r: Record<string, unknown>): Student {
  return {
    id: r['id'] as string,
    userId: r['user_id'] as string,
    teacherId: r['teacher_id'] as string,
    rollNumber: (r['roll_number'] as string | null) ?? null,
    className: (r['class_name'] as string | null) ?? null,
    section: (r['section'] as string | null) ?? null,
    guardianName: (r['guardian_name'] as string | null) ?? null,
    guardianPhone: (r['guardian_phone'] as string | null) ?? null,
    address: (r['address'] as string | null) ?? null,
    dateOfBirth: r['date_of_birth'] ? new Date(r['date_of_birth'] as string) : null,
    totalExamsTaken: (r['total_exams_taken'] as number) ?? 0,
    averageScore: (r['average_score'] as number) ?? 0,
    createdAt: new Date(r['created_at'] as string),
    updatedAt: new Date(r['updated_at'] as string),
  };
}

function mapStudentWithUser(r: Record<string, unknown>): StudentWithUser {
  return {
    ...mapStudent(r),
    user: mapUser(r['user'] as Record<string, unknown>),
  };
}

function mapSubject(r: Record<string, unknown>): Subject {
  return {
    id: r['id'] as string,
    teacherId: r['teacher_id'] as string,
    name: r['name'] as string,
    description: (r['description'] as string | null) ?? null,
    code: (r['code'] as string | null) ?? null,
    color: (r['color'] as string) ?? '#4CAF50',
    icon: (r['icon'] as string) ?? 'pi-book',
    isActive: (r['is_active'] as boolean) ?? true,
    totalStudents: (r['total_students'] as number) ?? 0,
    totalExams: (r['total_exams'] as number) ?? 0,
    totalAssets: (r['total_assets'] as number) ?? 0,
    createdAt: new Date(r['created_at'] as string),
    updatedAt: new Date(r['updated_at'] as string),
  };
}

function mapExam(r: Record<string, unknown>): Exam {
  return {
    id: r['id'] as string,
    subjectId: (r['subject_id'] as string | null) ?? null,
    teacherId: r['teacher_id'] as string,
    title: r['title'] as string,
    description: (r['description'] as string | null) ?? null,
    instructions: (r['instructions'] as string | null) ?? null,
    status: r['status'] as Exam['status'],
    totalQuestions: (r['total_questions'] as number) ?? 0,
    totalMarks: (r['total_marks'] as number) ?? 0,
    passingMarks: (r['passing_marks'] as number) ?? 0,
    timePerQuestionSeconds: (r['time_per_question_seconds'] as number) ?? 60,
    allowSkipReturn: (r['allow_skip_return'] as boolean) ?? true,
    fullscreenRequired: (r['fullscreen_required'] as boolean) ?? true,
    autoSubmitOnBlur: (r['auto_submit_on_blur'] as boolean) ?? true,
    allowRetake: (r['allow_retake'] as boolean) ?? false,
    maxRetakes: (r['max_retakes'] as number) ?? 0,
    scheduledStart: r['scheduled_start'] ? new Date(r['scheduled_start'] as string) : null,
    scheduledEnd: r['scheduled_end'] ? new Date(r['scheduled_end'] as string) : null,
    durationMinutes: (r['duration_minutes'] as number | null) ?? null,
    resultVisibility: (r['result_visibility'] as Exam['resultVisibility']) ?? 'immediate',
    resultReleaseDate: r['result_release_date'] ? new Date(r['result_release_date'] as string) : null,
    isResultReleased: (r['is_result_released'] as boolean) ?? false,
    showScore: (r['show_score'] as boolean) ?? true,
    showPercentage: (r['show_percentage'] as boolean) ?? true,
    showPassFail: (r['show_pass_fail'] as boolean) ?? true,
    showCorrectAnswers: (r['show_correct_answers'] as boolean) ?? true,
    showStudentAnswers: (r['show_student_answers'] as boolean) ?? true,
    showExplanations: (r['show_explanations'] as boolean) ?? true,
    showQuestionReview: (r['show_question_review'] as boolean) ?? true,
    showTimeSpent: (r['show_time_spent'] as boolean) ?? true,
    showTeacherRemarks: (r['show_teacher_remarks'] as boolean) ?? true,
    showRank: (r['show_rank'] as boolean) ?? false,
    examStyle: (r['exam_style'] as Exam['examStyle']) ?? 'standard',
    totalTimeLimitMinutes: (r['total_time_limit_minutes'] as number | null) ?? null,
    showImmediateFeedback: (r['show_immediate_feedback'] as boolean) ?? false,
    shuffleQuestions: (r['shuffle_questions'] as boolean) ?? false,
    shuffleOptions: (r['shuffle_options'] as boolean) ?? false,
    totalSubmissions: (r['total_submissions'] as number) ?? 0,
    averageScore: (r['average_score'] as number) ?? 0,
    publishedAt: r['published_at'] ? new Date(r['published_at'] as string) : null,
    createdAt: new Date(r['created_at'] as string),
    updatedAt: new Date(r['updated_at'] as string),
  };
}

function mapExamWithSubject(r: Record<string, unknown>): ExamWithSubject {
  return {
    ...mapExam(r),
    subject: r['subject'] ? mapSubject(r['subject'] as Record<string, unknown>) : null,
  };
}

function mapQuestion(r: Record<string, unknown>): Question {
  return {
    id: r['id'] as string,
    examId: r['exam_id'] as string,
    questionText: r['question_text'] as string,
    questionImageUrl: (r['question_image_url'] as string | null) ?? null,
    options: r['options'] as Question['options'],
    correctOptionId: r['correct_option_id'] as string,
    marks: (r['marks'] as number) ?? 1,
    negativeMarks: (r['negative_marks'] as number) ?? 0,
    timeLimitSeconds: (r['time_limit_seconds'] as number | null) ?? null,
    sequenceNumber: r['sequence_number'] as number,
    explanation: (r['explanation'] as string | null) ?? null,
    createdAt: new Date(r['created_at'] as string),
    updatedAt: new Date(r['updated_at'] as string),
  };
}

function mapSubmission(r: Record<string, unknown>): ExamSubmission {
  return {
    id: r['id'] as string,
    examId: r['exam_id'] as string,
    studentId: r['student_id'] as string,
    status: r['status'] as ExamSubmission['status'],
    startedAt: new Date(r['started_at'] as string),
    submittedAt: r['submitted_at'] ? new Date(r['submitted_at'] as string) : null,
    autoSubmitReason: (r['auto_submit_reason'] as string | null) ?? null,
    totalAnswered: (r['total_answered'] as number) ?? 0,
    totalCorrect: (r['total_correct'] as number) ?? 0,
    totalWrong: (r['total_wrong'] as number) ?? 0,
    totalSkipped: (r['total_skipped'] as number) ?? 0,
    score: (r['score'] as number) ?? 0,
    percentage: (r['percentage'] as number) ?? 0,
    attemptNumber: (r['attempt_number'] as number) ?? 1,
    evaluatedAt: r['evaluated_at'] ? new Date(r['evaluated_at'] as string) : null,
    evaluatedBy: (r['evaluated_by'] as string | null) ?? null,
    remarks: (r['remarks'] as string | null) ?? null,
    createdAt: new Date(r['created_at'] as string),
    updatedAt: new Date(r['updated_at'] as string),
  };
}

function mapSubmissionAnswer(r: Record<string, unknown>): SubmissionAnswer {
  return {
    id: r['id'] as string,
    submissionId: r['submission_id'] as string,
    questionId: r['question_id'] as string,
    selectedOptionId: (r['selected_option_id'] as string | null) ?? null,
    isCorrect: (r['is_correct'] as boolean | null) ?? null,
    marksObtained: (r['marks_obtained'] as number) ?? 0,
    timeSpentSeconds: (r['time_spent_seconds'] as number) ?? 0,
    timeRemainingSeconds: (r['time_remaining_seconds'] as number | null) ?? null,
    wasSkipped: (r['was_skipped'] as boolean) ?? false,
    returnedTo: (r['returned_to'] as boolean) ?? false,
    answeredAt: r['answered_at'] ? new Date(r['answered_at'] as string) : null,
    sequenceAnswered: (r['sequence_answered'] as number | null) ?? null,
    createdAt: new Date(r['created_at'] as string),
    updatedAt: new Date(r['updated_at'] as string),
  };
}

function mapAsset(r: Record<string, unknown>): Asset {
  return {
    id: r['id'] as string,
    subjectId: r['subject_id'] as string,
    teacherId: r['teacher_id'] as string,
    title: r['title'] as string,
    description: (r['description'] as string | null) ?? null,
    assetType: r['asset_type'] as Asset['assetType'],
    fileUrl: (r['file_url'] as string | null) ?? null,
    fileName: (r['file_name'] as string | null) ?? null,
    fileSizeBytes: (r['file_size_bytes'] as number | null) ?? null,
    mimeType: (r['mime_type'] as string | null) ?? null,
    externalUrl: (r['external_url'] as string | null) ?? null,
    thumbnailUrl: (r['thumbnail_url'] as string | null) ?? null,
    sequenceNumber: (r['sequence_number'] as number) ?? 0,
    isPublished: (r['is_published'] as boolean) ?? true,
    createdAt: new Date(r['created_at'] as string),
    updatedAt: new Date(r['updated_at'] as string),
  };
}

function mapComment(r: Record<string, unknown>): AssetComment {
  return {
    id: r['id'] as string,
    assetId: r['asset_id'] as string,
    userId: r['user_id'] as string,
    parentId: (r['parent_id'] as string | null) ?? null,
    content: r['content'] as string,
    isVisible: (r['is_visible'] as boolean) ?? true,
    createdAt: new Date(r['created_at'] as string),
    updatedAt: new Date(r['updated_at'] as string),
  };
}

function mapCommentWithUser(r: Record<string, unknown>): AssetCommentWithUser {
  const u = r['user'] as Record<string, unknown>;
  return {
    ...mapComment(r),
    user: {
      id: u['id'] as string,
      fullName: u['full_name'] as string,
      avatarUrl: (u['avatar_url'] as string | null) ?? null,
      role: u['role'] as AssetCommentWithUser['user']['role'],
    },
  };
}

function mapSettingsCategory(r: Record<string, unknown>): SettingsCategory {
  return {
    id: r['id'] as string,
    name: r['name'] as string,
    label: r['label'] as string,
    icon: (r['icon'] as string) ?? 'pi-cog',
    description: (r['description'] as string | null) ?? null,
    sortOrder: (r['sort_order'] as number) ?? 0,
    createdAt: new Date(r['created_at'] as string),
    updatedAt: new Date(r['updated_at'] as string),
  };
}

function mapSystemSetting(r: Record<string, unknown>): SystemSetting {
  // Go API returns options as a JSON array or null
  let options: string[] | null = null;
  const rawOptions = r['options'];
  if (Array.isArray(rawOptions)) {
    options = rawOptions as string[];
  } else if (typeof rawOptions === 'string') {
    try { options = JSON.parse(rawOptions); } catch { options = null; }
  }

  return {
    id: r['id'] as string,
    categoryId: r['category_id'] as string,
    key: r['key'] as string,
    label: r['label'] as string,
    value: (r['value'] as string | null) ?? null,
    valueType: (r['value_type'] as SystemSetting['valueType']) ?? 'text',
    options,
    defaultValue: (r['default_value'] as string | null) ?? null,
    description: (r['description'] as string | null) ?? null,
    isRequired: (r['is_required'] as boolean) ?? false,
    sortOrder: (r['sort_order'] as number) ?? 0,
    createdAt: new Date(r['created_at'] as string),
    updatedAt: new Date(r['updated_at'] as string),
  };
}

function mapPaginated<T>(r: Record<string, unknown>, mapper: (item: Record<string, unknown>) => T): PaginatedResponse<T> {
  const items = (r['items'] as Record<string, unknown>[]) ?? [];
  return {
    items: items.map(mapper),
    total: (r['total'] as number) ?? 0,
    page: (r['page'] as number) ?? 1,
    pageSize: (r['page_size'] as number) ?? 20,
    totalPages: (r['total_pages'] as number) ?? 1,
  };
}

function paginationToParams(params?: PaginationParams): HttpParams {
  let p = new HttpParams();
  if (!params) return p;
  if (params.page)      p = p.set('page', params.page.toString());
  if (params.pageSize)  p = p.set('page_size', params.pageSize.toString());
  if (params.sortBy)    p = p.set('sort_by', params.sortBy);
  if (params.sortOrder) p = p.set('sort_order', params.sortOrder);
  return p;
}

// =============================================
// AUTH ADAPTER  (stub — handled by AuthService)
// =============================================

@Injectable()
class GoApiAuthAdapter implements IAuthAdapter {
  signInWithEmail(_c: LoginCredentials): Observable<AuthSession> { return throwError(() => new Error('Use AuthService.login()')); }
  signUpWithEmail(_c: LoginCredentials & { fullName: string }): Observable<AuthSession> { return throwError(() => new Error('Use AuthService.signup()')); }
  signInWithGoogle(): Observable<AuthSession> { return throwError(() => new Error('Google auth not supported')); }
  getCurrentSession(): Observable<AuthSession | null> { return throwError(() => new Error('Not implemented')); }
  refreshSession(): Observable<AuthSession> { return throwError(() => new Error('Use AuthService.refreshToken()')); }
  signOut(): Observable<void> { return throwError(() => new Error('Use AuthService.logout()')); }
  resetPassword(_email: string): Observable<void> { return throwError(() => new Error('Not implemented')); }
  updatePassword(_newPassword: string): Observable<void> { return throwError(() => new Error('Not implemented')); }
}

// =============================================
// USER ADAPTER
// =============================================

@Injectable()
class GoApiUserAdapter implements IUserAdapter {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getById(id: string): Observable<User | null> {
    return this.http.get<Record<string, unknown>>(`${this.base}/users/${id}`).pipe(
      map((r) => mapUser(r)),
      catchError(() => [null])
    );
  }

  getByEmail(_email: string): Observable<User | null> {
    return throwError(() => new Error('Not supported by Go API'));
  }

  create(_dto: CreateUserDto): Observable<User> {
    return throwError(() => new Error('Use AuthService to create users'));
  }

  update(id: string, dto: UpdateUserDto): Observable<User> {
    return this.http.patch<Record<string, unknown>>(`${this.base}/users/${id}`, {
      full_name: dto.fullName,
      avatar_url: dto.avatarUrl,
      phone: dto.phone,
    }).pipe(map(mapUser));
  }

  updateStatus(id: string, status: UserStatus): Observable<User> {
    return this.http.patch<Record<string, unknown>>(`${this.base}/users/${id}/status`, { status }).pipe(map(mapUser));
  }

  delete(_id: string): Observable<void> {
    return throwError(() => new Error('Use role-specific delete endpoints'));
  }
}

// =============================================
// TEACHER ADAPTER
// =============================================

@Injectable()
class GoApiTeacherAdapter implements ITeacherAdapter {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getById(id: string): Observable<TeacherWithUser | null> {
    return this.http.get<Record<string, unknown>>(`${this.base}/teachers/${id}`).pipe(
      map(mapTeacherWithUser),
      catchError(() => [null])
    );
  }

  getByUserId(_userId: string): Observable<TeacherWithUser | null> {
    return throwError(() => new Error('Use getById with teacher id'));
  }

  getAll(params?: PaginationParams): Observable<PaginatedResponse<TeacherWithUser>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/teachers`, { params: paginationToParams(params) }).pipe(
      map((r) => mapPaginated(r, mapTeacherWithUser))
    );
  }

  getPendingApprovals(): Observable<TeacherWithUser[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.base}/teachers/pending`).pipe(
      map((items) => items.map(mapTeacherWithUser))
    );
  }

  create(_dto: CreateTeacherDto): Observable<Teacher> {
    return throwError(() => new Error('Teachers are created via signup'));
  }

  update(id: string, dto: UpdateTeacherDto): Observable<Teacher> {
    return this.http.patch<Record<string, unknown>>(`${this.base}/teachers/${id}`, {
      qualification: dto.qualification,
      specialization: dto.specialization,
      bio: dto.bio,
      allow_student_comments: dto.allowStudentComments,
      show_exam_results_immediately: dto.showExamResultsImmediately,
    }).pipe(map(mapTeacher));
  }

  approve(id: string, _approvedBy: string): Observable<Teacher> {
    return this.http.post<Record<string, unknown>>(`${this.base}/teachers/${id}/approve`, {}).pipe(map(mapTeacher));
  }

  disable(id: string): Observable<Teacher> {
    return this.http.post<Record<string, unknown>>(`${this.base}/teachers/${id}/disable`, {}).pipe(map(mapTeacher));
  }

  enable(id: string): Observable<Teacher> {
    return this.http.post<Record<string, unknown>>(`${this.base}/teachers/${id}/enable`, {}).pipe(map(mapTeacher));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/teachers/${id}`);
  }

  getDashboardStats(teacherId: string): Observable<TeacherDashboardStats> {
    return this.http.get<Record<string, unknown>>(`${this.base}/teachers/${teacherId}/stats`).pipe(
      map((r) => ({
        totalStudents: (r['total_students'] as number) ?? 0,
        totalSubjects: (r['total_subjects'] as number) ?? 0,
        totalExams: (r['total_exams'] as number) ?? 0,
        activeExams: (r['active_exams'] as number) ?? 0,
        totalSubmissions: (r['total_submissions'] as number) ?? 0,
        averageStudentScore: (r['average_student_score'] as number) ?? 0,
      }))
    );
  }
}

// =============================================
// STUDENT ADAPTER
// =============================================

@Injectable()
class GoApiStudentAdapter implements IStudentAdapter {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly base = environment.apiBaseUrl;

  getById(id: string): Observable<StudentWithUser | null> {
    return this.http.get<Record<string, unknown>>(`${this.base}/students/${id}`).pipe(
      map(mapStudentWithUser),
      catchError(() => [null])
    );
  }

  getByUserId(_userId: string): Observable<StudentWithUser | null> {
    return throwError(() => new Error('Not supported — use getById'));
  }

  getByTeacher(teacherId: string, params?: PaginationParams): Observable<PaginatedResponse<StudentWithUser>> {
    const p = paginationToParams(params).set('teacher_id', teacherId);
    return this.http.get<Record<string, unknown>>(`${this.base}/students`, { params: p }).pipe(
      map((r) => mapPaginated(r, mapStudentWithUser))
    );
  }

  getBySubject(subjectId: string, params?: PaginationParams): Observable<PaginatedResponse<StudentWithUser>> {
    const p = paginationToParams(params);
    return this.http.get<Record<string, unknown>>(`${this.base}/subjects/${subjectId}/students`, { params: p }).pipe(
      map((r) => mapPaginated(r, mapStudentWithUser))
    );
  }

  create(dto: CreateStudentDto): Observable<Student> {
    return this.authService.createStudent({
      full_name: dto.fullName,
      email: dto.email,
      password: dto.password,
      roll_number: dto.rollNumber,
      class_name: dto.className,
      section: dto.section,
      guardian_name: dto.guardianName,
      guardian_phone: dto.guardianPhone,
      address: dto.address,
      date_of_birth: dto.dateOfBirth?.toISOString().split('T')[0],
    }).pipe(
      switchMap((response) => {
        if (!response.success) {
          return throwError(() => new Error(response.error || 'Failed to create student'));
        }
        const studentId = response.user?.studentId;
        if (!studentId) {
          return throwError(() => new Error('No student ID in response'));
        }
        return this.getById(studentId).pipe(
          map((student) => {
            if (!student) throw new Error('Student created but not found');
            return student;
          })
        );
      })
    );
  }

  update(id: string, dto: UpdateStudentDto): Observable<Student> {
    return this.http.patch<Record<string, unknown>>(`${this.base}/students/${id}`, {
      full_name: dto.fullName,
      roll_number: dto.rollNumber,
      class_name: dto.className,
      section: dto.section,
      guardian_name: dto.guardianName,
      guardian_phone: dto.guardianPhone,
      address: dto.address,
      date_of_birth: dto.dateOfBirth ? dto.dateOfBirth.toISOString().split('T')[0] : undefined,
    }).pipe(map(mapStudent));
  }

  disable(id: string): Observable<Student> {
    return this.http.post<Record<string, unknown>>(`${this.base}/students/${id}/disable`, {}).pipe(map(mapStudent));
  }

  enable(id: string): Observable<Student> {
    return this.http.post<Record<string, unknown>>(`${this.base}/students/${id}/enable`, {}).pipe(map(mapStudent));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/students/${id}`);
  }

  getDashboardStats(studentId: string): Observable<StudentDashboardStats> {
    return this.http.get<Record<string, unknown>>(`${this.base}/students/${studentId}/stats`).pipe(
      map((r) => ({
        enrolledSubjects: (r['enrolled_subjects'] as number) ?? 0,
        totalExamsTaken: (r['total_exams_taken'] as number) ?? 0,
        averageScore: (r['average_score'] as number) ?? 0,
        pendingExams: (r['pending_exams'] as number) ?? 0,
      }))
    );
  }
}

// =============================================
// SUBJECT ADAPTER
// =============================================

@Injectable()
class GoApiSubjectAdapter implements ISubjectAdapter {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getById(id: string): Observable<Subject | null> {
    return this.http.get<Record<string, unknown>>(`${this.base}/subjects/${id}`).pipe(
      map(mapSubject),
      catchError(() => [null])
    );
  }

  getByTeacher(teacherId: string, params?: PaginationParams): Observable<PaginatedResponse<Subject>> {
    const p = paginationToParams(params).set('teacher_id', teacherId);
    return this.http.get<Record<string, unknown>>(`${this.base}/subjects`, { params: p }).pipe(
      map((r) => mapPaginated(r, mapSubject))
    );
  }

  getByStudent(studentId: string): Observable<Subject[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.base}/students/${studentId}/subjects`).pipe(
      map((items) => items.map(mapSubject)),
      catchError(() => [[]])
    );
  }

  create(dto: CreateSubjectDto): Observable<Subject> {
    return this.http.post<Record<string, unknown>>(`${this.base}/subjects`, {
      name: dto.name,
      description: dto.description,
      code: dto.code,
      color: dto.color,
      icon: dto.icon,
    }).pipe(map(mapSubject));
  }

  update(id: string, dto: UpdateSubjectDto): Observable<Subject> {
    return this.http.patch<Record<string, unknown>>(`${this.base}/subjects/${id}`, {
      name: dto.name,
      description: dto.description,
      code: dto.code,
      color: dto.color,
      icon: dto.icon,
      is_active: dto.isActive,
    }).pipe(map(mapSubject));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/subjects/${id}`);
  }

  enrollStudent(studentId: string, subjectId: string, _enrolledBy: string): Observable<SubjectEnrollment> {
    return this.http.post<Record<string, unknown>>(`${this.base}/subjects/${subjectId}/enroll`, { student_id: studentId }).pipe(
      map((r) => ({
        id: r['id'] as string,
        studentId: r['student_id'] as string,
        subjectId: r['subject_id'] as string,
        enrolledAt: new Date(r['enrolled_at'] as string),
        enrolledBy: (r['enrolled_by'] as string | null) ?? null,
        createdAt: new Date(r['enrolled_at'] as string),
        updatedAt: new Date(r['enrolled_at'] as string),
      }))
    );
  }

  unenrollStudent(studentId: string, subjectId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/subjects/${subjectId}/enroll/${studentId}`);
  }

  getEnrolledStudents(subjectId: string): Observable<StudentWithUser[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.base}/subjects/${subjectId}/students`).pipe(
      map((items) => items.map(mapStudentWithUser))
    );
  }
}

// =============================================
// EXAM ADAPTER
// =============================================

@Injectable()
class GoApiExamAdapter implements IExamAdapter {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getById(id: string): Observable<ExamWithSubject | null> {
    return this.http.get<Record<string, unknown>>(`${this.base}/exams/${id}`).pipe(
      map(mapExamWithSubject),
      catchError(() => [null])
    );
  }

  getBySubject(subjectId: string, params?: PaginationParams): Observable<PaginatedResponse<Exam>> {
    const p = paginationToParams(params).set('subject_id', subjectId);
    return this.http.get<Record<string, unknown>>(`${this.base}/exams`, { params: p }).pipe(
      map((r) => mapPaginated(r, mapExam))
    );
  }

  getByTeacher(teacherId: string, params?: PaginationParams): Observable<PaginatedResponse<ExamWithSubject>> {
    const p = paginationToParams(params).set('teacher_id', teacherId);
    return this.http.get<Record<string, unknown>>(`${this.base}/exams`, { params: p }).pipe(
      map((r) => mapPaginated(r, mapExamWithSubject))
    );
  }

  getUpcomingForStudent(studentId: string): Observable<ExamWithSubject[]> {
    const p = new HttpParams().set('student_id', studentId);
    return this.http.get<Record<string, unknown>[]>(`${this.base}/exams/upcoming`, { params: p }).pipe(
      map((items) => items.map(mapExamWithSubject))
    );
  }

  create(dto: CreateExamDto): Observable<Exam> {
    return this.http.post<Record<string, unknown>>(`${this.base}/exams`, {
      subject_id: dto.subjectId,
      title: dto.title,
      description: dto.description,
      instructions: dto.instructions,
      passing_marks: dto.passingMarks,
      time_per_question_seconds: dto.timePerQuestionSeconds,
      allow_skip_return: dto.allowSkipReturn,
      fullscreen_required: dto.fullscreenRequired,
      auto_submit_on_blur: dto.autoSubmitOnBlur,
      allow_retake: dto.allowRetake,
      max_retakes: dto.maxRetakes,
      scheduled_start: dto.scheduledStart,
      scheduled_end: dto.scheduledEnd,
      duration_minutes: dto.durationMinutes,
      result_visibility: dto.resultVisibility,
      result_release_date: dto.resultReleaseDate,
      show_score: dto.showScore,
      show_percentage: dto.showPercentage,
      show_pass_fail: dto.showPassFail,
      show_correct_answers: dto.showCorrectAnswers,
      show_student_answers: dto.showStudentAnswers,
      show_explanations: dto.showExplanations,
      show_question_review: dto.showQuestionReview,
      show_time_spent: dto.showTimeSpent,
      show_teacher_remarks: dto.showTeacherRemarks,
      show_rank: dto.showRank,
      exam_style: dto.examStyle,
      total_time_limit_minutes: dto.totalTimeLimitMinutes,
      show_immediate_feedback: dto.showImmediateFeedback,
      shuffle_questions: dto.shuffleQuestions,
      shuffle_options: dto.shuffleOptions,
    }).pipe(map(mapExam));
  }

  update(id: string, dto: UpdateExamDto): Observable<Exam> {
    return this.http.patch<Record<string, unknown>>(`${this.base}/exams/${id}`, {
      subject_id: dto.subjectId,
      title: dto.title,
      description: dto.description,
      instructions: dto.instructions,
      passing_marks: dto.passingMarks,
      time_per_question_seconds: dto.timePerQuestionSeconds,
      allow_skip_return: dto.allowSkipReturn,
      fullscreen_required: dto.fullscreenRequired,
      auto_submit_on_blur: dto.autoSubmitOnBlur,
      allow_retake: dto.allowRetake,
      max_retakes: dto.maxRetakes,
      scheduled_start: dto.scheduledStart,
      scheduled_end: dto.scheduledEnd,
      duration_minutes: dto.durationMinutes,
      result_visibility: dto.resultVisibility,
      result_release_date: dto.resultReleaseDate,
      is_result_released: dto.isResultReleased,
      show_score: dto.showScore,
      show_percentage: dto.showPercentage,
      show_pass_fail: dto.showPassFail,
      show_correct_answers: dto.showCorrectAnswers,
      show_student_answers: dto.showStudentAnswers,
      show_explanations: dto.showExplanations,
      show_question_review: dto.showQuestionReview,
      show_time_spent: dto.showTimeSpent,
      show_teacher_remarks: dto.showTeacherRemarks,
      show_rank: dto.showRank,
      exam_style: dto.examStyle,
      total_time_limit_minutes: dto.totalTimeLimitMinutes,
      show_immediate_feedback: dto.showImmediateFeedback,
      shuffle_questions: dto.shuffleQuestions,
      shuffle_options: dto.shuffleOptions,
    }).pipe(map(mapExam));
  }

  publish(id: string): Observable<Exam> {
    return this.http.post<Record<string, unknown>>(`${this.base}/exams/${id}/publish`, {}).pipe(map(mapExam));
  }

  cancel(id: string): Observable<Exam> {
    return this.http.post<Record<string, unknown>>(`${this.base}/exams/${id}/cancel`, {}).pipe(map(mapExam));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/exams/${id}`);
  }
}

// =============================================
// QUESTION ADAPTER
// =============================================

@Injectable()
class GoApiQuestionAdapter implements IQuestionAdapter {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getById(id: string): Observable<Question | null> {
    return this.http.get<Record<string, unknown>>(`${this.base}/questions/${id}`).pipe(
      map(mapQuestion),
      catchError(() => [null])
    );
  }

  getByExam(examId: string): Observable<Question[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.base}/exams/${examId}/questions`).pipe(
      map((items) => items.map(mapQuestion))
    );
  }

  create(dto: CreateQuestionDto): Observable<Question> {
    return this.http.post<Record<string, unknown>>(`${this.base}/exams/${dto.examId}/questions`, {
      question_text: dto.questionText,
      question_image_url: dto.questionImageUrl,
      options: dto.options,
      correct_option_id: dto.correctOptionId,
      marks: dto.marks,
      negative_marks: dto.negativeMarks,
      time_limit_seconds: dto.timeLimitSeconds,
      sequence_number: dto.sequenceNumber,
      explanation: dto.explanation,
    }).pipe(map(mapQuestion));
  }

  createBulk(dtos: CreateQuestionDto[]): Observable<Question[]> {
    if (!dtos.length) return throwError(() => new Error('No questions provided'));
    const examId = dtos[0].examId;
    const payload = dtos.map((dto) => ({
      question_text: dto.questionText,
      question_image_url: dto.questionImageUrl,
      options: dto.options,
      correct_option_id: dto.correctOptionId,
      marks: dto.marks,
      negative_marks: dto.negativeMarks,
      time_limit_seconds: dto.timeLimitSeconds,
      sequence_number: dto.sequenceNumber,
      explanation: dto.explanation,
    }));
    return this.http.post<Record<string, unknown>[]>(`${this.base}/exams/${examId}/questions/bulk`, payload).pipe(
      map((items) => items.map(mapQuestion))
    );
  }

  update(id: string, dto: UpdateQuestionDto): Observable<Question> {
    return this.http.patch<Record<string, unknown>>(`${this.base}/questions/${id}`, {
      question_text: dto.questionText,
      question_image_url: dto.questionImageUrl,
      options: dto.options,
      correct_option_id: dto.correctOptionId,
      marks: dto.marks,
      negative_marks: dto.negativeMarks,
      time_limit_seconds: dto.timeLimitSeconds,
      sequence_number: dto.sequenceNumber,
      explanation: dto.explanation,
    }).pipe(map(mapQuestion));
  }

  updateSequence(examId: string, questionIds: string[]): Observable<void> {
    return this.http.post<void>(`${this.base}/exams/${examId}/questions/reorder`, { question_ids: questionIds });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/questions/${id}`);
  }
}

// =============================================
// SUBMISSION ADAPTER
// =============================================

@Injectable()
class GoApiSubmissionAdapter implements ISubmissionAdapter {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getById(id: string): Observable<ExamSubmissionWithDetails | null> {
    return this.http.get<Record<string, unknown>>(`${this.base}/submissions/${id}`).pipe(
      map((r) => ({
        ...mapSubmission(r),
        exam: mapExam(r['exam'] as Record<string, unknown>),
        answers: ((r['answers'] as Record<string, unknown>[]) ?? []).map(mapSubmissionAnswer),
      })),
      catchError(() => [null])
    );
  }

  getByExam(examId: string, params?: PaginationParams): Observable<PaginatedResponse<ExamSubmission>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/exams/${examId}/submissions`, { params: paginationToParams(params) }).pipe(
      map((r) => mapPaginated(r, mapSubmission))
    );
  }

  getByStudent(studentId: string, params?: PaginationParams): Observable<PaginatedResponse<ExamSubmission>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/students/${studentId}/submissions`, { params: paginationToParams(params) }).pipe(
      map((r) => mapPaginated(r, mapSubmission))
    );
  }

  getByStudentAndExam(studentId: string, examId: string): Observable<ExamSubmission | null> {
    const p = new HttpParams().set('exam_id', examId).set('page_size', '1');
    return this.http.get<Record<string, unknown>>(`${this.base}/students/${studentId}/submissions`, { params: p }).pipe(
      map((r) => {
        const items = (r['items'] as Record<string, unknown>[]) ?? [];
        return items.length > 0 ? mapSubmission(items[0]) : null;
      }),
      catchError(() => [null])
    );
  }

  startExam(examId: string, studentId: string): Observable<ExamSubmission> {
    return this.http.post<Record<string, unknown>>(`${this.base}/submissions/start`, {
      exam_id: examId,
      student_id: studentId,
    }).pipe(map(mapSubmission));
  }

  submitAnswer(dto: CreateSubmissionAnswerDto): Observable<SubmissionAnswer> {
    return this.http.post<Record<string, unknown>>(`${this.base}/submissions/${dto.submissionId}/answer`, {
      question_id: dto.questionId,
      selected_option_id: dto.selectedOptionId,
      time_spent_seconds: dto.timeSpentSeconds,
      time_remaining_seconds: dto.timeRemainingSeconds,
      was_skipped: dto.wasSkipped,
      sequence_answered: dto.sequenceAnswered,
    }).pipe(map(mapSubmissionAnswer));
  }

  updateAnswer(id: string, dto: UpdateSubmissionAnswerDto): Observable<SubmissionAnswer> {
    // submissionId is not part of UpdateSubmissionAnswerDto — extract it from the answer id path
    return this.http.patch<Record<string, unknown>>(`${this.base}/submissions/answers/${id}`, {
      selected_option_id: dto.selectedOptionId,
      time_spent_seconds: dto.timeSpentSeconds,
      returned_to: dto.returnedTo,
    }).pipe(map(mapSubmissionAnswer));
  }

  submitExam(submissionId: string): Observable<ExamSubmission> {
    return this.http.post<Record<string, unknown>>(`${this.base}/submissions/${submissionId}/submit`, {}).pipe(map(mapSubmission));
  }

  autoSubmitExam(submissionId: string, reason: string): Observable<ExamSubmission> {
    return this.http.post<Record<string, unknown>>(`${this.base}/submissions/${submissionId}/auto-submit`, { reason }).pipe(map(mapSubmission));
  }

  evaluate(submissionId: string, _evaluatedBy: string, remarks?: string): Observable<ExamSubmission> {
    return this.http.post<Record<string, unknown>>(`${this.base}/submissions/${submissionId}/evaluate`, { remarks }).pipe(map(mapSubmission));
  }

  allowRetake(submissionId: string): Observable<ExamSubmission> {
    return this.http.post<Record<string, unknown>>(`${this.base}/submissions/${submissionId}/allow-retake`, {}).pipe(map(mapSubmission));
  }

  cancelRetake(submissionId: string): Observable<ExamSubmission> {
    return this.http.post<Record<string, unknown>>(`${this.base}/submissions/${submissionId}/cancel-retake`, {}).pipe(map(mapSubmission));
  }
}

// =============================================
// ASSET ADAPTER
// =============================================

@Injectable()
class GoApiAssetAdapter implements IAssetAdapter {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getById(id: string): Observable<Asset | null> {
    return this.http.get<Record<string, unknown>>(`${this.base}/assets/${id}`).pipe(
      map(mapAsset),
      catchError(() => [null])
    );
  }

  getBySubject(subjectId: string, params?: PaginationParams): Observable<PaginatedResponse<Asset>> {
    const p = paginationToParams(params).set('subject_id', subjectId);
    return this.http.get<Record<string, unknown>>(`${this.base}/assets`, { params: p }).pipe(
      map((r) => mapPaginated(r, mapAsset))
    );
  }

  create(dto: CreateAssetDto): Observable<Asset> {
    return this.http.post<Record<string, unknown>>(`${this.base}/assets`, {
      title: dto.title,
      description: dto.description,
      asset_type: dto.assetType,
      external_url: dto.externalUrl,
      sequence_number: dto.sequenceNumber,
    }).pipe(map(mapAsset));
  }

  update(id: string, dto: UpdateAssetDto): Observable<Asset> {
    return this.http.patch<Record<string, unknown>>(`${this.base}/assets/${id}`, {
      title: dto.title,
      description: dto.description,
      external_url: dto.externalUrl,
      sequence_number: dto.sequenceNumber,
      is_published: dto.isPublished,
    }).pipe(map(mapAsset));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/assets/${id}`);
  }

  uploadFile(file: File, path: string): Observable<{ url: string; fileName: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    return this.http.post<{ url: string; file_name: string; size: number }>(`${this.base}/assets/upload`, formData).pipe(
      map((r) => ({ url: r.url, fileName: r.file_name, size: r.size }))
    );
  }

  deleteFile(_path: string): Observable<void> {
    return throwError(() => new Error('File deletion not supported via this endpoint'));
  }
}

// =============================================
// COMMENT ADAPTER
// =============================================

@Injectable()
class GoApiCommentAdapter implements ICommentAdapter {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getByAsset(assetId: string): Observable<AssetCommentWithUser[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.base}/assets/${assetId}/comments`).pipe(
      map((items) => items.map(mapCommentWithUser))
    );
  }

  create(dto: CreateAssetCommentDto): Observable<AssetComment> {
    return this.http.post<Record<string, unknown>>(`${this.base}/assets/${dto.assetId}/comments`, {
      content: dto.content,
      parent_id: dto.parentId,
    }).pipe(map(mapComment));
  }

  update(id: string, content: string): Observable<AssetComment> {
    return this.http.patch<Record<string, unknown>>(`${this.base}/comments/${id}`, { content }).pipe(map(mapComment));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/comments/${id}`);
  }

  toggleVisibility(id: string, isVisible: boolean): Observable<AssetComment> {
    return this.http.patch<Record<string, unknown>>(`${this.base}/comments/${id}/visibility`, { is_visible: isVisible }).pipe(map(mapComment));
  }
}

// =============================================
// ADMIN ADAPTER
// =============================================

@Injectable()
class GoApiAdminAdapter implements IAdminAdapter {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getDashboardStats(): Observable<SuperAdminDashboardStats> {
    return this.http.get<Record<string, unknown>>(`${this.base}/admin/stats`).pipe(
      map((r) => ({
        totalTeachers: (r['total_teachers'] as number) ?? 0,
        pendingTeachers: (r['pending_teachers'] as number) ?? 0,
        activeTeachers: (r['active_teachers'] as number) ?? 0,
        disabledTeachers: (r['disabled_teachers'] as number) ?? 0,
        totalStudents: (r['total_students'] as number) ?? 0,
        totalExams: (r['total_exams'] as number) ?? 0,
      }))
    );
  }

  getAllTeachers(params?: PaginationParams): Observable<PaginatedResponse<TeacherWithUser>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/teachers`, { params: paginationToParams(params) }).pipe(
      map((r) => mapPaginated(r, mapTeacherWithUser))
    );
  }

  getSystemLogs(params?: PaginationParams): Observable<PaginatedResponse<unknown>> {
    return throwError(() => new Error('System logs not implemented in Go API'));
  }
}

// =============================================
// SETTINGS ADAPTER
// =============================================

@Injectable()
class GoApiSettingsAdapter implements ISettingsAdapter {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getAllCategories(): Observable<SettingsCategory[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.base}/settings/categories`).pipe(
      map((items) => items.map(mapSettingsCategory))
    );
  }

  getCategoryById(id: string): Observable<SettingsCategory | null> {
    return this.http.get<Record<string, unknown>>(`${this.base}/settings/categories/${id}`).pipe(
      map(mapSettingsCategory),
      catchError(() => [null])
    );
  }

  createCategory(dto: CreateSettingsCategoryDto): Observable<SettingsCategory> {
    return this.http.post<Record<string, unknown>>(`${this.base}/settings/categories`, {
      name: dto.name,
      label: dto.label,
      icon: dto.icon,
      description: dto.description,
      sort_order: dto.sortOrder,
    }).pipe(map(mapSettingsCategory));
  }

  updateCategory(id: string, dto: UpdateSettingsCategoryDto): Observable<SettingsCategory> {
    return this.http.patch<Record<string, unknown>>(`${this.base}/settings/categories/${id}`, {
      name: dto.name,
      label: dto.label,
      icon: dto.icon,
      description: dto.description,
      sort_order: dto.sortOrder,
    }).pipe(map(mapSettingsCategory));
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/settings/categories/${id}`);
  }

  getAllSettings(): Observable<SystemSetting[]> {
    return this.http.get<Record<string, unknown>[]>(`${this.base}/settings`).pipe(
      map((items) => items.map(mapSystemSetting))
    );
  }

  getSettingsByCategory(categoryId: string): Observable<SystemSetting[]> {
    const p = new HttpParams().set('category_id', categoryId);
    return this.http.get<Record<string, unknown>[]>(`${this.base}/settings`, { params: p }).pipe(
      map((items) => items.map(mapSystemSetting))
    );
  }

  getSettingByKey(key: string): Observable<SystemSetting | null> {
    return this.http.get<Record<string, unknown>>(`${this.base}/settings/${key}`).pipe(
      map(mapSystemSetting),
      catchError(() => [null])
    );
  }

  createSetting(dto: CreateSystemSettingDto): Observable<SystemSetting> {
    return this.http.post<Record<string, unknown>>(`${this.base}/settings`, {
      category_id: dto.categoryId,
      key: dto.key,
      label: dto.label,
      value: dto.value,
      value_type: dto.valueType,
      options: dto.options,
      default_value: dto.defaultValue,
      description: dto.description,
      is_required: dto.isRequired,
      sort_order: dto.sortOrder,
    }).pipe(map(mapSystemSetting));
  }

  updateSetting(id: string, dto: UpdateSystemSettingDto): Observable<SystemSetting> {
    return this.http.patch<Record<string, unknown>>(`${this.base}/settings/${id}`, {
      label: dto.label,
      value: dto.value,
      value_type: dto.valueType,
      options: dto.options,
      default_value: dto.defaultValue,
      description: dto.description,
      is_required: dto.isRequired,
      sort_order: dto.sortOrder,
    }).pipe(map(mapSystemSetting));
  }

  updateSettingValue(key: string, value: string | null): Observable<SystemSetting> {
    return this.http.put<Record<string, unknown>>(`${this.base}/settings/${key}`, { value }).pipe(map(mapSystemSetting));
  }

  deleteSetting(key: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/settings/${key}`);
  }

  bulkCreateSettings(_settings: CreateSystemSettingDto[]): Observable<SystemSetting[]> {
    return throwError(() => new Error('Not supported — create individually'));
  }

  deleteAllSettings(): Observable<void> {
    return throwError(() => new Error('Not supported'));
  }

  deleteAllCategories(): Observable<void> {
    return throwError(() => new Error('Not supported'));
  }
}

// =============================================
// COMBINED ADAPTER
// =============================================

@Injectable()
export class GoApiDatabaseAdapter implements IDatabaseAdapter {
  readonly auth     = inject(GoApiAuthAdapter);
  readonly users    = inject(GoApiUserAdapter);
  readonly teachers = inject(GoApiTeacherAdapter);
  readonly students = inject(GoApiStudentAdapter);
  readonly subjects = inject(GoApiSubjectAdapter);
  readonly exams    = inject(GoApiExamAdapter);
  readonly questions = inject(GoApiQuestionAdapter);
  readonly submissions = inject(GoApiSubmissionAdapter);
  readonly assets   = inject(GoApiAssetAdapter);
  readonly comments = inject(GoApiCommentAdapter);
  readonly admin    = inject(GoApiAdminAdapter);
  readonly settings = inject(GoApiSettingsAdapter);
}

// =============================================
// PROVIDER FACTORY
// =============================================

export function provideGoApiDatabaseAdapter() {
  return [
    GoApiAuthAdapter,
    GoApiUserAdapter,
    GoApiTeacherAdapter,
    GoApiStudentAdapter,
    GoApiSubjectAdapter,
    GoApiExamAdapter,
    GoApiQuestionAdapter,
    GoApiSubmissionAdapter,
    GoApiAssetAdapter,
    GoApiCommentAdapter,
    GoApiAdminAdapter,
    GoApiSettingsAdapter,
    GoApiDatabaseAdapter,
    {
      provide: GO_API_DATABASE_ADAPTER,
      useExisting: GoApiDatabaseAdapter,
    },
  ];
}
