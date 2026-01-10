// @REVIEW: Supabase Database Adapter Implementation
// Concrete implementation of IDatabaseAdapter using Supabase

import { Injectable, inject } from '@angular/core';
import { from, map, Observable, of, switchMap, throwError, catchError } from 'rxjs';
// @REVIEW: Import AuthService for student creation (uses Edge Function for password hashing)
import { AuthService } from '../services/auth.service';
import { SupabaseClientService } from '../services/supabase-client.service';
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
  // @REVIEW: New models for exam assignments
  ExamAssignment,
  ExamAssignmentWithDetails,
  CreateExamAssignmentDto,
  UpdateExamAssignmentDto,
  ExamSubjectAssignment,
  ExamSubjectAssignmentWithDetails,
  CreateExamSubjectAssignmentDto,
  UpdateExamSubjectAssignmentDto,
  ExamAssignmentStatus,
  // @REVIEW: Result visibility type
  ResultVisibility,
} from '../models';

// =============================================
// HELPER: Map DB row to Model
// =============================================

const mapDbUserToModel = (row: Record<string, unknown>): User => ({
  id: row['id'] as string,
  email: row['email'] as string,
  fullName: row['full_name'] as string,
  avatarUrl: row['avatar_url'] as string | null,
  role: row['role'] as User['role'],
  status: row['status'] as User['status'],
  phone: row['phone'] as string | null,
  authProvider: row['auth_provider'] as User['authProvider'],
  authProviderId: row['auth_provider_id'] as string | null,
  lastLoginAt: row['last_login_at'] ? new Date(row['last_login_at'] as string) : null,
  createdBy: row['created_by'] as string | null,
  createdAt: new Date(row['created_at'] as string),
  updatedAt: new Date(row['updated_at'] as string),
});

const mapDbTeacherToModel = (row: Record<string, unknown>): Teacher => ({
  id: row['id'] as string,
  userId: row['user_id'] as string,
  qualification: row['qualification'] as string | null,
  specialization: row['specialization'] as string | null,
  bio: row['bio'] as string | null,
  allowStudentComments: row['allow_student_comments'] as boolean ?? true,
  showExamResultsImmediately: row['show_exam_results_immediately'] as boolean ?? false,
  totalStudents: row['total_students'] as number ?? 0,
  totalSubjects: row['total_subjects'] as number ?? 0,
  totalExams: row['total_exams'] as number ?? 0,
  approvedAt: row['approved_at'] ? new Date(row['approved_at'] as string) : null,
  approvedBy: row['approved_by'] as string | null,
  createdAt: new Date(row['created_at'] as string),
  updatedAt: new Date(row['updated_at'] as string),
});

const mapDbTeacherWithUserToModel = (row: Record<string, unknown>): TeacherWithUser => {
  const userRow = row['users'] as Record<string, unknown>;
  return {
    ...mapDbTeacherToModel(row),
    user: mapDbUserToModel(userRow),
  };
};

// @REVIEW: Subject mapper
const mapDbSubjectToModel = (row: Record<string, unknown>): Subject => ({
  id: row['id'] as string,
  teacherId: row['teacher_id'] as string,
  name: row['name'] as string,
  description: row['description'] as string | null,
  code: row['code'] as string | null,
  color: row['color'] as string ?? '#4CAF50',
  icon: row['icon'] as string ?? 'pi-book',
  isActive: row['is_active'] as boolean ?? true,
  totalStudents: row['total_students'] as number ?? 0,
  totalExams: row['total_exams'] as number ?? 0,
  totalAssets: row['total_assets'] as number ?? 0,
  createdAt: new Date(row['created_at'] as string),
  updatedAt: new Date(row['updated_at'] as string),
});

// @REVIEW: Exam mapper - subjectId is now nullable
const mapDbExamToModel = (row: Record<string, unknown>): Exam => ({
  id: row['id'] as string,
  subjectId: row['subject_id'] as string | null,
  teacherId: row['teacher_id'] as string,
  title: row['title'] as string,
  description: row['description'] as string | null,
  instructions: row['instructions'] as string | null,
  status: row['status'] as Exam['status'],
  totalQuestions: row['total_questions'] as number ?? 0,
  totalMarks: row['total_marks'] as number ?? 0,
  passingMarks: row['passing_marks'] as number ?? 0,
  timePerQuestionSeconds: row['time_per_question_seconds'] as number ?? 60,
  allowSkipReturn: row['allow_skip_return'] as boolean ?? true,
  fullscreenRequired: row['fullscreen_required'] as boolean ?? true,
  autoSubmitOnBlur: row['auto_submit_on_blur'] as boolean ?? true,
  allowRetake: row['allow_retake'] as boolean ?? false,
  maxRetakes: row['max_retakes'] as number ?? 0,
  scheduledStart: row['scheduled_start'] ? new Date(row['scheduled_start'] as string) : null,
  scheduledEnd: row['scheduled_end'] ? new Date(row['scheduled_end'] as string) : null,
  durationMinutes: row['duration_minutes'] as number | null,
  // @REVIEW: Result visibility settings
  resultVisibility: (row['result_visibility'] as ResultVisibility) ?? 'immediate',
  resultReleaseDate: row['result_release_date'] ? new Date(row['result_release_date'] as string) : null,
  isResultReleased: row['is_result_released'] as boolean ?? false,
  showScore: row['show_score'] as boolean ?? true,
  showPercentage: row['show_percentage'] as boolean ?? true,
  showPassFail: row['show_pass_fail'] as boolean ?? true,
  showCorrectAnswers: row['show_correct_answers'] as boolean ?? true,
  showStudentAnswers: row['show_student_answers'] as boolean ?? true,
  showExplanations: row['show_explanations'] as boolean ?? true,
  showQuestionReview: row['show_question_review'] as boolean ?? true,
  showTimeSpent: row['show_time_spent'] as boolean ?? true,
  showTeacherRemarks: row['show_teacher_remarks'] as boolean ?? true,
  showRank: row['show_rank'] as boolean ?? false,
  // @REVIEW: Exam style settings
  examStyle: (row['exam_style'] as Exam['examStyle']) ?? 'standard',
  totalTimeLimitMinutes: row['total_time_limit_minutes'] as number | null,
  showImmediateFeedback: row['show_immediate_feedback'] as boolean ?? false,
  shuffleQuestions: row['shuffle_questions'] as boolean ?? false,
  shuffleOptions: row['shuffle_options'] as boolean ?? false,
  // Statistics
  totalSubmissions: row['total_submissions'] as number ?? 0,
  averageScore: row['average_score'] as number ?? 0,
  publishedAt: row['published_at'] ? new Date(row['published_at'] as string) : null,
  createdAt: new Date(row['created_at'] as string),
  updatedAt: new Date(row['updated_at'] as string),
});

// @REVIEW: ExamWithSubject mapper - subject can be null
const mapDbExamWithSubjectToModel = (row: Record<string, unknown>): ExamWithSubject => {
  const subjectRow = row['subjects'] as Record<string, unknown> | null;
  return {
    ...mapDbExamToModel(row),
    subject: subjectRow ? mapDbSubjectToModel(subjectRow) : null,
  };
};

// @REVIEW: ExamAssignment mapper
const mapDbExamAssignmentToModel = (row: Record<string, unknown>): ExamAssignment => ({
  id: row['id'] as string,
  examId: row['exam_id'] as string,
  studentId: row['student_id'] as string,
  assignedBy: row['assigned_by'] as string,
  assignedAt: new Date(row['assigned_at'] as string),
  availableFrom: row['available_from'] ? new Date(row['available_from'] as string) : null,
  dueDate: row['due_date'] ? new Date(row['due_date'] as string) : null,
  status: row['status'] as ExamAssignmentStatus,
  startedAt: row['started_at'] ? new Date(row['started_at'] as string) : null,
  completedAt: row['completed_at'] ? new Date(row['completed_at'] as string) : null,
  maxAttempts: row['max_attempts'] as number ?? 1,
  timeLimitMinutes: row['time_limit_minutes'] as number | null,
  notes: row['notes'] as string | null,
  createdAt: new Date(row['created_at'] as string),
  updatedAt: new Date(row['updated_at'] as string),
});

// @REVIEW: ExamSubjectAssignment mapper
const mapDbExamSubjectAssignmentToModel = (row: Record<string, unknown>): ExamSubjectAssignment => ({
  id: row['id'] as string,
  examId: row['exam_id'] as string,
  subjectId: row['subject_id'] as string,
  assignedBy: row['assigned_by'] as string,
  assignedAt: new Date(row['assigned_at'] as string),
  availableFrom: row['available_from'] ? new Date(row['available_from'] as string) : null,
  dueDate: row['due_date'] ? new Date(row['due_date'] as string) : null,
  autoAssignStudents: row['auto_assign_students'] as boolean ?? true,
  createdAt: new Date(row['created_at'] as string),
  updatedAt: new Date(row['updated_at'] as string),
});

// @REVIEW: Question mapper
const mapDbQuestionToModel = (row: Record<string, unknown>): Question => ({
  id: row['id'] as string,
  examId: row['exam_id'] as string,
  questionText: row['question_text'] as string,
  questionImageUrl: row['question_image_url'] as string | null,
  options: row['options'] as Question['options'],
  correctOptionId: row['correct_option_id'] as string,
  marks: row['marks'] as number ?? 1,
  negativeMarks: parseFloat(row['negative_marks'] as string) ?? 0,
  timeLimitSeconds: row['time_limit_seconds'] as number | null,
  sequenceNumber: row['sequence_number'] as number,
  explanation: row['explanation'] as string | null,
  createdAt: new Date(row['created_at'] as string),
  updatedAt: new Date(row['updated_at'] as string),
});

// @REVIEW: Submission mapper
const mapDbSubmissionToModel = (row: Record<string, unknown>): ExamSubmission => ({
  id: row['id'] as string,
  examId: row['exam_id'] as string,
  studentId: row['student_id'] as string,
  status: row['status'] as ExamSubmission['status'],
  startedAt: new Date(row['started_at'] as string),
  submittedAt: row['submitted_at'] ? new Date(row['submitted_at'] as string) : null,
  autoSubmitReason: row['auto_submit_reason'] as string | null,
  totalAnswered: row['total_answered'] as number ?? 0,
  totalCorrect: row['total_correct'] as number ?? 0,
  totalWrong: row['total_wrong'] as number ?? 0,
  totalSkipped: row['total_skipped'] as number ?? 0,
  score: row['score'] as number ?? 0,
  percentage: row['percentage'] as number ?? 0,
  attemptNumber: row['attempt_number'] as number ?? 1,
  evaluatedAt: row['evaluated_at'] ? new Date(row['evaluated_at'] as string) : null,
  evaluatedBy: row['evaluated_by'] as string | null,
  remarks: row['remarks'] as string | null,
  createdAt: new Date(row['created_at'] as string),
  updatedAt: new Date(row['updated_at'] as string),
});

// @REVIEW: SubmissionWithDetails mapper
const mapDbSubmissionWithDetailsToModel = (row: Record<string, unknown>): ExamSubmissionWithDetails => {
  const examRow = row['exams'] as Record<string, unknown>;
  const answersRows = (row['submission_answers'] ?? []) as Record<string, unknown>[];
  return {
    ...mapDbSubmissionToModel(row),
    exam: mapDbExamToModel(examRow),
    answers: answersRows.map(mapDbAnswerToModel),
  };
};

// @REVIEW: SubmissionAnswer mapper
const mapDbAnswerToModel = (row: Record<string, unknown>): SubmissionAnswer => ({
  id: row['id'] as string,
  submissionId: row['submission_id'] as string,
  questionId: row['question_id'] as string,
  selectedOptionId: row['selected_option_id'] as string | null,
  isCorrect: row['is_correct'] as boolean | null,
  marksObtained: row['marks_obtained'] as number ?? 0,
  timeSpentSeconds: row['time_spent_seconds'] as number ?? 0,
  timeRemainingSeconds: row['time_remaining_seconds'] as number | null,
  wasSkipped: row['was_skipped'] as boolean ?? false,
  returnedTo: row['returned_to'] as boolean ?? false,
  answeredAt: row['answered_at'] ? new Date(row['answered_at'] as string) : null,
  sequenceAnswered: row['sequence_answered'] as number | null,
  createdAt: new Date(row['created_at'] as string),
  updatedAt: new Date(row['updated_at'] as string),
});

// @REVIEW: Student mapper
const mapDbStudentToModel = (row: Record<string, unknown>): Student => ({
  id: row['id'] as string,
  userId: row['user_id'] as string,
  teacherId: row['teacher_id'] as string,
  rollNumber: row['roll_number'] as string | null,
  className: row['class_name'] as string | null,
  section: row['section'] as string | null,
  guardianName: row['guardian_name'] as string | null,
  guardianPhone: row['guardian_phone'] as string | null,
  address: row['address'] as string | null,
  dateOfBirth: row['date_of_birth'] ? new Date(row['date_of_birth'] as string) : null,
  totalExamsTaken: row['total_exams_taken'] as number ?? 0,
  averageScore: row['average_score'] as number ?? 0,
  createdAt: new Date(row['created_at'] as string),
  updatedAt: new Date(row['updated_at'] as string),
});

// @REVIEW: StudentWithUser mapper
const mapDbStudentWithUserToModel = (row: Record<string, unknown>): StudentWithUser => {
  const userRow = row['users'] as Record<string, unknown>;
  return {
    ...mapDbStudentToModel(row),
    user: mapDbUserToModel(userRow),
  };
};

// =============================================
// AUTH ADAPTER (Stub - Auth is handled via Edge Function)
// =============================================

@Injectable()
class SupabaseAuthAdapter implements IAuthAdapter {
  signInWithEmail(_credentials: LoginCredentials): Observable<AuthSession> {
    // @NOT-NEED: Auth is handled via Edge Function in AuthService
    return throwError(() => new Error('Use AuthService for authentication'));
  }

  signUpWithEmail(_credentials: LoginCredentials & { fullName: string }): Observable<AuthSession> {
    return throwError(() => new Error('Use AuthService for authentication'));
  }

  signInWithGoogle(): Observable<AuthSession> {
    return throwError(() => new Error('Use AuthService for Google authentication'));
  }

  getCurrentSession(): Observable<AuthSession | null> {
    return throwError(() => new Error('Use AuthStore for session management'));
  }

  refreshSession(): Observable<AuthSession> {
    return throwError(() => new Error('Use AuthService for token refresh'));
  }

  signOut(): Observable<void> {
    return throwError(() => new Error('Use AuthService for sign out'));
  }

  resetPassword(_email: string): Observable<void> {
    return throwError(() => new Error('Password reset not implemented'));
  }

  updatePassword(_newPassword: string): Observable<void> {
    return throwError(() => new Error('Password update not implemented'));
  }
}

// =============================================
// USER ADAPTER
// =============================================

@Injectable()
class SupabaseUserAdapter implements IUserAdapter {
  private readonly supabase = inject(SupabaseClientService);

  getById(id: string): Observable<User | null> {
    return from(
      this.supabase.from('users').select('*').eq('id', id).single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return null;
        return mapDbUserToModel(data);
      })
    );
  }

  getByEmail(email: string): Observable<User | null> {
    return from(
      this.supabase.from('users').select('*').eq('email', email).single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return null;
        return mapDbUserToModel(data);
      })
    );
  }

  create(dto: CreateUserDto): Observable<User> {
    return from(
      this.supabase.from('users').insert({
        email: dto.email,
        full_name: dto.fullName,
        role: dto.role,
        phone: dto.phone,
        auth_provider: dto.authProvider ?? 'email',
        auth_provider_id: dto.authProviderId,
      }).select().single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbUserToModel(data!);
      })
    );
  }

  update(id: string, dto: UpdateUserDto): Observable<User> {
    const updateData: Record<string, unknown> = {};
    if (dto.fullName !== undefined) updateData['full_name'] = dto.fullName;
    if (dto.avatarUrl !== undefined) updateData['avatar_url'] = dto.avatarUrl;
    if (dto.phone !== undefined) updateData['phone'] = dto.phone;
    if (dto.status !== undefined) updateData['status'] = dto.status;

    return from(
      this.supabase.from('users').update(updateData).eq('id', id).select().single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbUserToModel(data!);
      })
    );
  }

  updateStatus(id: string, status: UserStatus): Observable<User> {
    return this.update(id, { status });
  }

  delete(id: string): Observable<void> {
    return from(
      this.supabase.from('users').delete().eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (error) throw new Error(error.message);
      })
    );
  }
}

// =============================================
// TEACHER ADAPTER
// =============================================

@Injectable()
class SupabaseTeacherAdapter implements ITeacherAdapter {
  private readonly supabase = inject(SupabaseClientService);

  getById(id: string): Observable<TeacherWithUser | null> {
    // @REVIEW: Use explicit FK name to disambiguate (teachers has user_id and approved_by both referencing users)
    return from(
      this.supabase
        .from('teachers')
        .select('*, users!teachers_user_id_fkey(*)')
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return null;
        return mapDbTeacherWithUserToModel(data);
      })
    );
  }

  getByUserId(userId: string): Observable<TeacherWithUser | null> {
    // @REVIEW: Use explicit FK name to disambiguate
    return from(
      this.supabase
        .from('teachers')
        .select('*, users!teachers_user_id_fkey(*)')
        .eq('user_id', userId)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return null;
        return mapDbTeacherWithUserToModel(data);
      })
    );
  }

  getAll(params?: PaginationParams): Observable<PaginatedResponse<TeacherWithUser>> {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    // @REVIEW: Use explicit FK name to disambiguate (teachers has user_id and approved_by both referencing users)
    return from(
      this.supabase
        .from('teachers')
        .select('*, users!teachers_user_id_fkey(*)', { count: 'exact' })
        .range(start, end)
        .order(params?.sortBy ?? 'created_at', { ascending: params?.sortOrder === 'asc' })
    ).pipe(
      map(({ data, error, count }) => {
        if (error) throw new Error(error.message);
        const items = (data ?? []).map(mapDbTeacherWithUserToModel);
        const total = count ?? 0;
        return {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      })
    );
  }

  getPendingApprovals(): Observable<TeacherWithUser[]> {
    // @REVIEW: Use explicit FK name to disambiguate
    return from(
      this.supabase
        .from('teachers')
        .select('*, users!teachers_user_id_fkey!inner(*)')
        .is('approved_at', null)
        .eq('users.status', 'pending')
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data ?? []).map(mapDbTeacherWithUserToModel);
      })
    );
  }

  create(dto: CreateTeacherDto): Observable<Teacher> {
    return from(
      this.supabase.from('teachers').insert({
        user_id: dto.userId,
        qualification: dto.qualification,
        specialization: dto.specialization,
        bio: dto.bio,
      }).select().single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbTeacherToModel(data!);
      })
    );
  }

  update(id: string, dto: UpdateTeacherDto): Observable<Teacher> {
    const updateData: Record<string, unknown> = {};
    if (dto.qualification !== undefined) updateData['qualification'] = dto.qualification;
    if (dto.specialization !== undefined) updateData['specialization'] = dto.specialization;
    if (dto.bio !== undefined) updateData['bio'] = dto.bio;
    if (dto.allowStudentComments !== undefined) updateData['allow_student_comments'] = dto.allowStudentComments;
    if (dto.showExamResultsImmediately !== undefined) updateData['show_exam_results_immediately'] = dto.showExamResultsImmediately;

    return from(
      this.supabase.from('teachers').update(updateData).eq('id', id).select().single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbTeacherToModel(data!);
      })
    );
  }

  approve(id: string, approvedBy: string): Observable<Teacher> {
    // @REVIEW: Use explicit FK name to disambiguate
    // First update teacher approval
    return from(
      this.supabase
        .from('teachers')
        .update({
          approved_at: new Date().toISOString(),
          approved_by: approvedBy,
        })
        .eq('id', id)
        .select('*, users!teachers_user_id_fkey(*)')
        .single()
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw new Error(error.message);
        const teacher = data!;
        // Then update user status to active
        return from(
          this.supabase
            .from('users')
            .update({ status: 'active' })
            .eq('id', teacher['user_id'])
        ).pipe(
          map(() => mapDbTeacherToModel(teacher))
        );
      })
    );
  }

  disable(id: string): Observable<Teacher> {
    return from(
      this.supabase
        .from('teachers')
        .select('user_id')
        .eq('id', id)
        .single()
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw new Error(error.message);
        return from(
          this.supabase
            .from('users')
            .update({ status: 'disabled' })
            .eq('id', data!['user_id'])
        );
      }),
      switchMap(() =>
        from(this.supabase.from('teachers').select().eq('id', id).single())
      ),
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbTeacherToModel(data!);
      })
    );
  }

  enable(id: string): Observable<Teacher> {
    return from(
      this.supabase
        .from('teachers')
        .select('user_id')
        .eq('id', id)
        .single()
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw new Error(error.message);
        return from(
          this.supabase
            .from('users')
            .update({ status: 'active' })
            .eq('id', data!['user_id'])
        );
      }),
      switchMap(() =>
        from(this.supabase.from('teachers').select().eq('id', id).single())
      ),
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbTeacherToModel(data!);
      })
    );
  }

  delete(id: string): Observable<void> {
    return from(
      this.supabase.from('teachers').delete().eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (error) throw new Error(error.message);
      })
    );
  }

  getDashboardStats(teacherId: string): Observable<TeacherDashboardStats> {
    return from(
      this.supabase
        .from('teacher_dashboard_stats')
        .select('*')
        .eq('teacher_id', teacherId)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) {
          return {
            totalStudents: 0,
            totalSubjects: 0,
            totalExams: 0,
            activeExams: 0,
            totalSubmissions: 0,
            averageStudentScore: 0,
          };
        }
        return {
          totalStudents: data['total_students'] ?? 0,
          totalSubjects: data['total_subjects'] ?? 0,
          totalExams: data['total_exams'] ?? 0,
          activeExams: data['active_exams'] ?? 0,
          totalSubmissions: data['total_submissions'] ?? 0,
          averageStudentScore: data['average_student_score'] ?? 0,
        };
      })
    );
  }
}

// =============================================
// ADMIN ADAPTER
// =============================================

@Injectable()
class SupabaseAdminAdapter implements IAdminAdapter {
  private readonly supabase = inject(SupabaseClientService);
  private readonly teacherAdapter = inject(SupabaseTeacherAdapter);

  getDashboardStats(): Observable<SuperAdminDashboardStats> {
    // Fetch counts using multiple queries in parallel
    const teachersQuery = this.supabase
      .from('users')
      .select('status', { count: 'exact', head: true })
      .eq('role', 'teacher');

    const studentsQuery = this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student');

    const examsQuery = this.supabase
      .from('exams')
      .select('*', { count: 'exact', head: true });

    const pendingTeachersQuery = this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'teacher')
      .eq('status', 'pending');

    const activeTeachersQuery = this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'teacher')
      .eq('status', 'active');

    const disabledTeachersQuery = this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'teacher')
      .eq('status', 'disabled');

    return from(
      Promise.all([
        teachersQuery,
        studentsQuery,
        examsQuery,
        pendingTeachersQuery,
        activeTeachersQuery,
        disabledTeachersQuery,
      ])
    ).pipe(
      map(([teachers, students, exams, pending, active, disabled]) => ({
        totalTeachers: teachers.count ?? 0,
        pendingTeachers: pending.count ?? 0,
        activeTeachers: active.count ?? 0,
        disabledTeachers: disabled.count ?? 0,
        totalStudents: students.count ?? 0,
        totalExams: exams.count ?? 0,
      }))
    );
  }

  getAllTeachers(params?: PaginationParams): Observable<PaginatedResponse<TeacherWithUser>> {
    return this.teacherAdapter.getAll(params);
  }

  getSystemLogs(_params?: PaginationParams): Observable<PaginatedResponse<unknown>> {
    // @TODO: Implement system logs when audit logging is added
    return of({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    });
  }
}

// =============================================
// STUB ADAPTERS (To be implemented)
// =============================================

// @REVIEW: SupabaseStudentAdapter - Full implementation
@Injectable()
class SupabaseStudentAdapter implements IStudentAdapter {
  private readonly supabase = inject(SupabaseClientService);
  // @REVIEW: Use AuthService for student creation (handles password hashing via Edge Function)
  private readonly authService = inject(AuthService);

  getById(id: string): Observable<StudentWithUser | null> {
    return from(
      this.supabase
        .from('students')
        .select('*, users!students_user_id_fkey(*)')
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return null;
        return mapDbStudentWithUserToModel(data as Record<string, unknown>);
      })
    );
  }

  getByUserId(userId: string): Observable<StudentWithUser | null> {
    return from(
      this.supabase
        .from('students')
        .select('*, users!students_user_id_fkey(*)')
        .eq('user_id', userId)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return null;
        return mapDbStudentWithUserToModel(data as Record<string, unknown>);
      })
    );
  }

  getByTeacher(teacherId: string, params?: PaginationParams): Observable<PaginatedResponse<StudentWithUser>> {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 10;
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    return from(
      this.supabase
        .from('students')
        .select('*, users!students_user_id_fkey(*)', { count: 'exact' })
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })
        .range(fromIndex, toIndex)
    ).pipe(
      map(({ data, error, count }) => {
        if (error || !data) {
          return { items: [], total: 0, page, pageSize, totalPages: 0 };
        }
        const items = (data as Record<string, unknown>[]).map(mapDbStudentWithUserToModel);
        const total = count ?? 0;
        return {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      })
    );
  }

  getBySubject(subjectId: string, params?: PaginationParams): Observable<PaginatedResponse<StudentWithUser>> {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 10;
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    return from(
      this.supabase
        .from('students')
        .select(`
          *,
          users!students_user_id_fkey(*),
          subject_enrollments!inner(subject_id)
        `, { count: 'exact' })
        .eq('subject_enrollments.subject_id', subjectId)
        .order('created_at', { ascending: false })
        .range(fromIndex, toIndex)
    ).pipe(
      map(({ data, error, count }) => {
        if (error || !data) {
          return { items: [], total: 0, page, pageSize, totalPages: 0 };
        }
        const items = (data as Record<string, unknown>[]).map(mapDbStudentWithUserToModel);
        const total = count ?? 0;
        return {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      })
    );
  }

  create(dto: CreateStudentDto): Observable<Student> {
    // @REVIEW: Use Edge Function to create student (handles password hashing)
    // The Edge Function creates both user and student profile in one call
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
        // Edge Function only returns basic user info, fetch full student data
        if (response.user?.id) {
          return this.getByUserId(response.user.id).pipe(
            map((student) => {
              if (!student) throw new Error('Student created but not found');
              return student;
            })
          );
        }
        return throwError(() => new Error('No user ID in response'));
      }),
      catchError((error) => {
        console.error('[StudentAdapter] Create failed:', error);
        return throwError(() => error);
      })
    );
  }

  update(id: string, dto: UpdateStudentDto): Observable<Student> {
    const updateData: Record<string, unknown> = {};
    if (dto.rollNumber !== undefined) updateData['roll_number'] = dto.rollNumber;
    if (dto.className !== undefined) updateData['class_name'] = dto.className;
    if (dto.section !== undefined) updateData['section'] = dto.section;
    if (dto.guardianName !== undefined) updateData['guardian_name'] = dto.guardianName;
    if (dto.guardianPhone !== undefined) updateData['guardian_phone'] = dto.guardianPhone;
    if (dto.address !== undefined) updateData['address'] = dto.address;
    if (dto.dateOfBirth !== undefined) updateData['date_of_birth'] = dto.dateOfBirth?.toISOString().split('T')[0] ?? null;

    return from(
      this.supabase
        .from('students')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbStudentToModel(data as Record<string, unknown>);
      })
    );
  }

  disable(id: string): Observable<Student> {
    // Disable student by updating the associated user's status
    return this.getById(id).pipe(
      switchMap((student) => {
        if (!student) throw new Error('Student not found');
        return from(
          this.supabase
            .from('users')
            .update({ status: 'disabled' })
            .eq('id', student.userId)
        ).pipe(
          switchMap(() => this.getById(id)),
          map((updated) => {
            if (!updated) throw new Error('Student not found after update');
            return updated;
          })
        );
      })
    );
  }

  enable(id: string): Observable<Student> {
    // Enable student by updating the associated user's status
    return this.getById(id).pipe(
      switchMap((student) => {
        if (!student) throw new Error('Student not found');
        return from(
          this.supabase
            .from('users')
            .update({ status: 'active' })
            .eq('id', student.userId)
        ).pipe(
          switchMap(() => this.getById(id)),
          map((updated) => {
            if (!updated) throw new Error('Student not found after update');
            return updated;
          })
        );
      })
    );
  }

  delete(id: string): Observable<void> {
    // Delete student and associated user
    return this.getById(id).pipe(
      switchMap((student) => {
        if (!student) throw new Error('Student not found');
        return from(
          this.supabase
            .from('students')
            .delete()
            .eq('id', id)
        ).pipe(
          switchMap(() =>
            from(
              this.supabase
                .from('users')
                .delete()
                .eq('id', student.userId)
            )
          ),
          map(({ error }) => {
            if (error) throw new Error(error.message);
          })
        );
      })
    );
  }

  getDashboardStats(studentId: string): Observable<StudentDashboardStats> {
    return from(
      this.supabase
        .from('student_dashboard_stats')
        .select('*')
        .eq('student_id', studentId)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) {
          return { enrolledSubjects: 0, totalExamsTaken: 0, averageScore: 0, pendingExams: 0 };
        }
        return {
          enrolledSubjects: data['enrolled_subjects'] as number ?? 0,
          totalExamsTaken: data['total_exams_taken'] as number ?? 0,
          averageScore: data['average_score'] as number ?? 0,
          pendingExams: data['pending_exams'] as number ?? 0,
        };
      })
    );
  }
}

// @REVIEW: SupabaseSubjectAdapter - Full implementation
@Injectable()
class SupabaseSubjectAdapter implements ISubjectAdapter {
  private readonly supabase = inject(SupabaseClientService);

  getById(id: string): Observable<Subject | null> {
    return from(
      this.supabase
        .from('subjects')
        .select('*')
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return null;
        return mapDbSubjectToModel(data as Record<string, unknown>);
      })
    );
  }

  getByTeacher(teacherId: string, params?: PaginationParams): Observable<PaginatedResponse<Subject>> {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 10;
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    return from(
      this.supabase
        .from('subjects')
        .select('*', { count: 'exact' })
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })
        .range(fromIndex, toIndex)
    ).pipe(
      map(({ data, error, count }) => {
        if (error || !data) {
          return { items: [], total: 0, page, pageSize, totalPages: 0 };
        }
        const items = (data as Record<string, unknown>[]).map(mapDbSubjectToModel);
        const total = count ?? 0;
        return {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      })
    );
  }

  getByStudent(studentId: string): Observable<Subject[]> {
    return from(
      this.supabase
        .from('subjects')
        .select(`
          *,
          subject_enrollments!inner(student_id)
        `)
        .eq('subject_enrollments.student_id', studentId)
        .eq('is_active', true)
        .order('name', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return [];
        return (data as Record<string, unknown>[]).map(mapDbSubjectToModel);
      })
    );
  }

  create(dto: CreateSubjectDto): Observable<Subject> {
    return from(
      this.supabase
        .from('subjects')
        .insert({
          teacher_id: dto.teacherId,
          name: dto.name,
          description: dto.description ?? null,
          code: dto.code ?? null,
          color: dto.color ?? '#4CAF50',
          icon: dto.icon ?? 'pi-book',
        })
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbSubjectToModel(data as Record<string, unknown>);
      })
    );
  }

  update(id: string, dto: UpdateSubjectDto): Observable<Subject> {
    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData['name'] = dto.name;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.code !== undefined) updateData['code'] = dto.code;
    if (dto.color !== undefined) updateData['color'] = dto.color;
    if (dto.icon !== undefined) updateData['icon'] = dto.icon;
    if (dto.isActive !== undefined) updateData['is_active'] = dto.isActive;
    updateData['updated_at'] = new Date().toISOString();

    return from(
      this.supabase
        .from('subjects')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbSubjectToModel(data as Record<string, unknown>);
      })
    );
  }

  delete(id: string): Observable<void> {
    return from(
      this.supabase
        .from('subjects')
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (error) throw new Error(error.message);
      })
    );
  }

  enrollStudent(studentId: string, subjectId: string, enrolledBy: string): Observable<SubjectEnrollment> {
    return from(
      this.supabase
        .from('subject_enrollments')
        .insert({
          student_id: studentId,
          subject_id: subjectId,
          enrolled_by: enrolledBy,
        })
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        const row = data as Record<string, unknown>;
        return {
          id: row['id'] as string,
          studentId: row['student_id'] as string,
          subjectId: row['subject_id'] as string,
          enrolledAt: new Date(row['enrolled_at'] as string),
          enrolledBy: row['enrolled_by'] as string | null,
          createdAt: new Date(row['enrolled_at'] as string),
          updatedAt: new Date(row['enrolled_at'] as string),
        };
      })
    );
  }

  unenrollStudent(studentId: string, subjectId: string): Observable<void> {
    return from(
      this.supabase
        .from('subject_enrollments')
        .delete()
        .eq('student_id', studentId)
        .eq('subject_id', subjectId)
    ).pipe(
      map(({ error }) => {
        if (error) throw new Error(error.message);
      })
    );
  }

  getEnrolledStudents(subjectId: string): Observable<StudentWithUser[]> {
    return from(
      this.supabase
        .from('students')
        .select(`
          *,
          users!students_user_id_fkey(*),
          subject_enrollments!inner(subject_id)
        `)
        .eq('subject_enrollments.subject_id', subjectId)
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return [];
        return (data as Record<string, unknown>[]).map(mapDbStudentWithUserToModel);
      })
    );
  }
}

// @REVIEW: SupabaseExamAdapter - Full implementation
@Injectable()
class SupabaseExamAdapter implements IExamAdapter {
  private readonly supabase = inject(SupabaseClientService);

  getById(id: string): Observable<ExamWithSubject | null> {
    return from(
      this.supabase
        .from('exams')
        .select('*, subjects(*)')
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return null;
        return mapDbExamWithSubjectToModel(data as Record<string, unknown>);
      })
    );
  }

  getBySubject(subjectId: string, params?: PaginationParams): Observable<PaginatedResponse<Exam>> {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 10;
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    return from(
      this.supabase
        .from('exams')
        .select('*', { count: 'exact' })
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: false })
        .range(fromIndex, toIndex)
    ).pipe(
      map(({ data, error, count }) => {
        if (error || !data) {
          return { items: [], total: 0, page, pageSize, totalPages: 0 };
        }
        const items = (data as Record<string, unknown>[]).map(mapDbExamToModel);
        const total = count ?? 0;
        return {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      })
    );
  }

  getByTeacher(teacherId: string, params?: PaginationParams): Observable<PaginatedResponse<ExamWithSubject>> {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 10;
    const fromIndex = (page - 1) * pageSize;
    const toIndex = fromIndex + pageSize - 1;

    return from(
      this.supabase
        .from('exams')
        .select('*, subjects(*)', { count: 'exact' })
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })
        .range(fromIndex, toIndex)
    ).pipe(
      map(({ data, error, count }) => {
        if (error || !data) {
          return { items: [], total: 0, page, pageSize, totalPages: 0 };
        }
        const items = (data as Record<string, unknown>[]).map(mapDbExamWithSubjectToModel);
        const total = count ?? 0;
        return {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      })
    );
  }

  // @REVIEW: Fixed to handle exams with null scheduled_end and increased limit
  getUpcomingForStudent(studentId: string): Observable<ExamWithSubject[]> {
    // Get exams from subjects the student is enrolled in, that are active
    // Note: scheduled_end can be null for always-available exams
    return from(
      this.supabase
        .from('exams')
        .select(`
          *,
          subjects!inner(*, subject_enrollments!inner(student_id))
        `)
        .eq('subjects.subject_enrollments.student_id', studentId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(100)
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return [];
        const now = new Date();
        // Filter: either no scheduled_end OR scheduled_end is in the future
        return (data as Record<string, unknown>[])
          .filter(row => {
            const scheduledEnd = row['scheduled_end'] as string | null;
            return !scheduledEnd || new Date(scheduledEnd) >= now;
          })
          .map(mapDbExamWithSubjectToModel);
      })
    );
  }

  // @REVIEW: subjectId is now optional - exams can be created independently
  create(dto: CreateExamDto): Observable<Exam> {
    return from(
      this.supabase
        .from('exams')
        .insert({
          subject_id: dto.subjectId ?? null,
          teacher_id: dto.teacherId,
          title: dto.title,
          description: dto.description ?? null,
          instructions: dto.instructions ?? null,
          time_per_question_seconds: dto.timePerQuestionSeconds ?? 60,
          allow_skip_return: dto.allowSkipReturn ?? true,
          fullscreen_required: dto.fullscreenRequired ?? true,
          auto_submit_on_blur: dto.autoSubmitOnBlur ?? true,
          allow_retake: dto.allowRetake ?? false,
          max_retakes: dto.maxRetakes ?? 0,
          scheduled_start: dto.scheduledStart?.toISOString() ?? null,
          scheduled_end: dto.scheduledEnd?.toISOString() ?? null,
          duration_minutes: dto.durationMinutes ?? null,
          passing_marks: dto.passingMarks ?? 0,
          // @REVIEW: Result visibility settings
          result_visibility: dto.resultVisibility ?? 'immediate',
          result_release_date: dto.resultReleaseDate?.toISOString() ?? null,
          show_score: dto.showScore ?? true,
          show_percentage: dto.showPercentage ?? true,
          show_pass_fail: dto.showPassFail ?? true,
          show_correct_answers: dto.showCorrectAnswers ?? true,
          show_student_answers: dto.showStudentAnswers ?? true,
          show_explanations: dto.showExplanations ?? true,
          show_question_review: dto.showQuestionReview ?? true,
          show_time_spent: dto.showTimeSpent ?? true,
          show_teacher_remarks: dto.showTeacherRemarks ?? true,
          show_rank: dto.showRank ?? false,
          // @REVIEW: Exam style settings
          exam_style: dto.examStyle ?? 'standard',
          total_time_limit_minutes: dto.totalTimeLimitMinutes ?? null,
          show_immediate_feedback: dto.showImmediateFeedback ?? false,
          shuffle_questions: dto.shuffleQuestions ?? false,
          shuffle_options: dto.shuffleOptions ?? false,
        })
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbExamToModel(data as Record<string, unknown>);
      })
    );
  }

  // @REVIEW: Added status and subjectId field support to update method
  update(id: string, dto: UpdateExamDto): Observable<Exam> {
    const updateData: Record<string, unknown> = {};
    if (dto.title !== undefined) updateData['title'] = dto.title;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.instructions !== undefined) updateData['instructions'] = dto.instructions;
    if (dto.status !== undefined) updateData['status'] = dto.status;
    if (dto.subjectId !== undefined) updateData['subject_id'] = dto.subjectId;
    if (dto.timePerQuestionSeconds !== undefined) updateData['time_per_question_seconds'] = dto.timePerQuestionSeconds;
    if (dto.allowSkipReturn !== undefined) updateData['allow_skip_return'] = dto.allowSkipReturn;
    if (dto.fullscreenRequired !== undefined) updateData['fullscreen_required'] = dto.fullscreenRequired;
    if (dto.autoSubmitOnBlur !== undefined) updateData['auto_submit_on_blur'] = dto.autoSubmitOnBlur;
    if (dto.allowRetake !== undefined) updateData['allow_retake'] = dto.allowRetake;
    if (dto.maxRetakes !== undefined) updateData['max_retakes'] = dto.maxRetakes;
    if (dto.scheduledStart !== undefined) updateData['scheduled_start'] = dto.scheduledStart?.toISOString() ?? null;
    if (dto.scheduledEnd !== undefined) updateData['scheduled_end'] = dto.scheduledEnd?.toISOString() ?? null;
    if (dto.durationMinutes !== undefined) updateData['duration_minutes'] = dto.durationMinutes;
    if (dto.passingMarks !== undefined) updateData['passing_marks'] = dto.passingMarks;
    // @REVIEW: Result visibility settings
    if (dto.resultVisibility !== undefined) updateData['result_visibility'] = dto.resultVisibility;
    if (dto.resultReleaseDate !== undefined) updateData['result_release_date'] = dto.resultReleaseDate?.toISOString() ?? null;
    if (dto.isResultReleased !== undefined) updateData['is_result_released'] = dto.isResultReleased;
    if (dto.showScore !== undefined) updateData['show_score'] = dto.showScore;
    if (dto.showPercentage !== undefined) updateData['show_percentage'] = dto.showPercentage;
    if (dto.showPassFail !== undefined) updateData['show_pass_fail'] = dto.showPassFail;
    if (dto.showCorrectAnswers !== undefined) updateData['show_correct_answers'] = dto.showCorrectAnswers;
    if (dto.showStudentAnswers !== undefined) updateData['show_student_answers'] = dto.showStudentAnswers;
    if (dto.showExplanations !== undefined) updateData['show_explanations'] = dto.showExplanations;
    if (dto.showQuestionReview !== undefined) updateData['show_question_review'] = dto.showQuestionReview;
    if (dto.showTimeSpent !== undefined) updateData['show_time_spent'] = dto.showTimeSpent;
    if (dto.showTeacherRemarks !== undefined) updateData['show_teacher_remarks'] = dto.showTeacherRemarks;
    if (dto.showRank !== undefined) updateData['show_rank'] = dto.showRank;
    // @REVIEW: Exam style settings
    if (dto.examStyle !== undefined) updateData['exam_style'] = dto.examStyle;
    if (dto.totalTimeLimitMinutes !== undefined) updateData['total_time_limit_minutes'] = dto.totalTimeLimitMinutes;
    if (dto.showImmediateFeedback !== undefined) updateData['show_immediate_feedback'] = dto.showImmediateFeedback;
    if (dto.shuffleQuestions !== undefined) updateData['shuffle_questions'] = dto.shuffleQuestions;
    if (dto.shuffleOptions !== undefined) updateData['shuffle_options'] = dto.shuffleOptions;

    return from(
      this.supabase
        .from('exams')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbExamToModel(data as Record<string, unknown>);
      })
    );
  }

  publish(id: string): Observable<Exam> {
    return from(
      this.supabase
        .from('exams')
        .update({ status: 'active', published_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbExamToModel(data as Record<string, unknown>);
      })
    );
  }

  cancel(id: string): Observable<Exam> {
    return from(
      this.supabase
        .from('exams')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbExamToModel(data as Record<string, unknown>);
      })
    );
  }

  delete(id: string): Observable<void> {
    return from(
      this.supabase
        .from('exams')
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (error) throw new Error(error.message);
      })
    );
  }
}

// @REVIEW: Question Adapter - Full CRUD implementation
@Injectable()
class SupabaseQuestionAdapter implements IQuestionAdapter {
  private readonly supabase = inject(SupabaseClientService).supabase;

  getById(id: string): Observable<Question | null> {
    return from(
      this.supabase
        .from('questions')
        .select('*')
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) return null;
        return mapDbQuestionToModel(data as Record<string, unknown>);
      })
    );
  }

  getByExam(examId: string): Observable<Question[]> {
    return from(
      this.supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('sequence_number', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data ?? []).map((row) => mapDbQuestionToModel(row as Record<string, unknown>));
      })
    );
  }

  create(dto: CreateQuestionDto): Observable<Question> {
    return from(
      this.supabase
        .from('questions')
        .insert({
          exam_id: dto.examId,
          question_text: dto.questionText,
          question_image_url: dto.questionImageUrl,
          options: dto.options,
          correct_option_id: dto.correctOptionId,
          marks: dto.marks ?? 1,
          negative_marks: dto.negativeMarks ?? 0,
          time_limit_seconds: dto.timeLimitSeconds,
          sequence_number: dto.sequenceNumber,
          explanation: dto.explanation,
        })
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbQuestionToModel(data as Record<string, unknown>);
      }),
      // @REVIEW: Update exam's totalQuestions and totalMarks after creating question
      switchMap((question) => this.updateExamStats(question.examId).pipe(map(() => question)))
    );
  }

  createBulk(dtos: CreateQuestionDto[]): Observable<Question[]> {
    if (dtos.length === 0) return of([]);

    const examId = dtos[0].examId;
    const insertData = dtos.map((dto) => ({
      exam_id: dto.examId,
      question_text: dto.questionText,
      question_image_url: dto.questionImageUrl,
      options: dto.options,
      correct_option_id: dto.correctOptionId,
      marks: dto.marks ?? 1,
      negative_marks: dto.negativeMarks ?? 0,
      time_limit_seconds: dto.timeLimitSeconds,
      sequence_number: dto.sequenceNumber,
      explanation: dto.explanation,
    }));

    return from(
      this.supabase
        .from('questions')
        .insert(insertData)
        .select()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data ?? []).map((row) => mapDbQuestionToModel(row as Record<string, unknown>));
      }),
      switchMap((questions) => this.updateExamStats(examId).pipe(map(() => questions)))
    );
  }

  update(id: string, dto: UpdateQuestionDto): Observable<Question> {
    const updateData: Record<string, unknown> = {};
    if (dto.questionText !== undefined) updateData['question_text'] = dto.questionText;
    if (dto.questionImageUrl !== undefined) updateData['question_image_url'] = dto.questionImageUrl;
    if (dto.options !== undefined) updateData['options'] = dto.options;
    if (dto.correctOptionId !== undefined) updateData['correct_option_id'] = dto.correctOptionId;
    if (dto.marks !== undefined) updateData['marks'] = dto.marks;
    if (dto.negativeMarks !== undefined) updateData['negative_marks'] = dto.negativeMarks;
    if (dto.timeLimitSeconds !== undefined) updateData['time_limit_seconds'] = dto.timeLimitSeconds;
    if (dto.sequenceNumber !== undefined) updateData['sequence_number'] = dto.sequenceNumber;
    if (dto.explanation !== undefined) updateData['explanation'] = dto.explanation;

    return from(
      this.supabase
        .from('questions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbQuestionToModel(data as Record<string, unknown>);
      }),
      // @REVIEW: Update exam stats if marks changed
      switchMap((question) => 
        dto.marks !== undefined 
          ? this.updateExamStats(question.examId).pipe(map(() => question))
          : of(question)
      )
    );
  }

  updateSequence(examId: string, questionIds: string[]): Observable<void> {
    // @REVIEW: Update sequence_number for each question based on array order
    const updates = questionIds.map((id, index) =>
      this.supabase
        .from('questions')
        .update({ sequence_number: index + 1 })
        .eq('id', id)
        .eq('exam_id', examId)
    );

    return from(Promise.all(updates)).pipe(
      map((results) => {
        const hasError = results.some((r) => r.error);
        if (hasError) throw new Error('Failed to update question sequence');
      })
    );
  }

  delete(id: string): Observable<void> {
    // @REVIEW: First get the question to know the examId for stats update
    return from(
      this.supabase
        .from('questions')
        .select('exam_id')
        .eq('id', id)
        .single()
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw new Error(error.message);
        const examId = (data as Record<string, unknown>)['exam_id'] as string;

        return from(
          this.supabase
            .from('questions')
            .delete()
            .eq('id', id)
        ).pipe(
          switchMap(({ error: deleteError }) => {
            if (deleteError) throw new Error(deleteError.message);
            return this.updateExamStats(examId);
          })
        );
      })
    );
  }

  // @REVIEW: Helper to update exam's totalQuestions and totalMarks
  private updateExamStats(examId: string): Observable<void> {
    return from(
      this.supabase
        .from('questions')
        .select('marks')
        .eq('exam_id', examId)
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw new Error(error.message);
        const questions = data ?? [];
        const totalQuestions = questions.length;
        const totalMarks = questions.reduce((sum, q) => sum + ((q as Record<string, unknown>)['marks'] as number ?? 0), 0);

        return from(
          this.supabase
            .from('exams')
            .update({ total_questions: totalQuestions, total_marks: totalMarks })
            .eq('id', examId)
        ).pipe(
          map(({ error: updateError }) => {
            if (updateError) throw new Error(updateError.message);
          })
        );
      })
    );
  }
}

// @REVIEW: Submission Adapter - Full CRUD implementation for exam taking flow
@Injectable()
class SupabaseSubmissionAdapter implements ISubmissionAdapter {
  private readonly supabase = inject(SupabaseClientService).supabase;

  getById(id: string): Observable<ExamSubmissionWithDetails | null> {
    return from(
      this.supabase
        .from('exam_submissions')
        .select(`
          *,
          exams (*),
          submission_answers (*)
        `)
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) return null;
        return mapDbSubmissionWithDetailsToModel(data as Record<string, unknown>);
      })
    );
  }

  getByExam(examId: string, params?: PaginationParams): Observable<PaginatedResponse<ExamSubmission>> {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 10;
    const offset = (page - 1) * pageSize;

    return from(
      this.supabase
        .from('exam_submissions')
        .select('*', { count: 'exact' })
        .eq('exam_id', examId)
        .order('started_at', { ascending: false })
        .range(offset, offset + pageSize - 1)
    ).pipe(
      map(({ data, count, error }) => {
        if (error) throw new Error(error.message);
        return {
          items: (data ?? []).map((row) => mapDbSubmissionToModel(row as Record<string, unknown>)),
          total: count ?? 0,
          page,
          pageSize,
          totalPages: Math.ceil((count ?? 0) / pageSize),
        };
      })
    );
  }

  getByStudent(studentId: string, params?: PaginationParams): Observable<PaginatedResponse<ExamSubmission>> {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 10;
    const offset = (page - 1) * pageSize;

    return from(
      this.supabase
        .from('exam_submissions')
        .select('*', { count: 'exact' })
        .eq('student_id', studentId)
        .order('started_at', { ascending: false })
        .range(offset, offset + pageSize - 1)
    ).pipe(
      map(({ data, count, error }) => {
        if (error) throw new Error(error.message);
        return {
          items: (data ?? []).map((row) => mapDbSubmissionToModel(row as Record<string, unknown>)),
          total: count ?? 0,
          page,
          pageSize,
          totalPages: Math.ceil((count ?? 0) / pageSize),
        };
      })
    );
  }

  getByStudentAndExam(studentId: string, examId: string): Observable<ExamSubmission | null> {
    return from(
      this.supabase
        .from('exam_submissions')
        .select('*')
        .eq('student_id', studentId)
        .eq('exam_id', examId)
        .order('attempt_number', { ascending: false })
        .limit(1)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) return null;
        return mapDbSubmissionToModel(data as Record<string, unknown>);
      })
    );
  }

  // @REVIEW: Start exam - creates submission record with in_progress status
  // Also handles retake logic by checking previous submission status
  startExam(examId: string, studentId: string): Observable<ExamSubmission> {
    // First check existing submissions to get attempt number and validate retake eligibility
    return from(
      this.supabase
        .from('exam_submissions')
        .select('id, attempt_number, status')
        .eq('exam_id', examId)
        .eq('student_id', studentId)
        .order('attempt_number', { ascending: false })
        .limit(1)
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw new Error(error.message);
        
        const lastSubmission = data?.[0];
        const lastAttempt = lastSubmission?.attempt_number ?? 0;
        const lastStatus = lastSubmission?.status;
        const newAttemptNumber = lastAttempt + 1;

        // @REVIEW: If this is not the first attempt, check retake eligibility
        // Student can only start a new attempt if:
        // 1. No previous submission exists (first attempt)
        // 2. Previous submission has status 'retake_allowed'
        if (lastSubmission && lastStatus !== 'retake_allowed') {
          // Check if previous submission is in_progress (resuming)
          if (lastStatus === 'in_progress') {
            throw new Error('You already have an exam in progress. Please resume it.');
          }
          throw new Error('You have already completed this exam. Contact your teacher to request a retake.');
        }

        // @REVIEW: If there was a previous submission with retake_allowed, update it to mark retake as used
        const updatePreviousSubmission$ = lastSubmission && lastStatus === 'retake_allowed'
          ? from(
              this.supabase
                .from('exam_submissions')
                .update({ status: 'evaluated' }) // Revert to evaluated since retake is being used
                .eq('id', lastSubmission.id)
            ).pipe(map(() => void 0))
          : of(void 0);

        return updatePreviousSubmission$.pipe(
          switchMap(() => from(
            this.supabase
              .from('exam_submissions')
              .insert({
                exam_id: examId,
                student_id: studentId,
                status: 'in_progress',
                started_at: new Date().toISOString(),
                attempt_number: newAttemptNumber,
                total_answered: 0,
                total_correct: 0,
                total_wrong: 0,
                total_skipped: 0,
                score: 0,
                percentage: 0,
              })
              .select()
              .single()
          ))
        );
      }),
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbSubmissionToModel(data as Record<string, unknown>);
      })
    );
  }

  // @REVIEW: Submit answer - creates or returns existing answer for a question
  submitAnswer(dto: CreateSubmissionAnswerDto): Observable<SubmissionAnswer> {
    return from(
      this.supabase
        .from('submission_answers')
        .insert({
          submission_id: dto.submissionId,
          question_id: dto.questionId,
          selected_option_id: dto.selectedOptionId ?? null,
          time_spent_seconds: dto.timeSpentSeconds,
          time_remaining_seconds: dto.timeRemainingSeconds ?? null,
          was_skipped: dto.wasSkipped ?? false,
          returned_to: false,
          sequence_answered: dto.sequenceAnswered,
          answered_at: dto.selectedOptionId ? new Date().toISOString() : null,
        })
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbAnswerToModel(data as Record<string, unknown>);
      })
    );
  }

  // @REVIEW: Update answer - when student returns to a skipped question
  updateAnswer(id: string, dto: UpdateSubmissionAnswerDto): Observable<SubmissionAnswer> {
    const updateData: Record<string, unknown> = {};
    if (dto.selectedOptionId !== undefined) {
      updateData['selected_option_id'] = dto.selectedOptionId;
      updateData['answered_at'] = new Date().toISOString();
    }
    if (dto.timeSpentSeconds !== undefined) updateData['time_spent_seconds'] = dto.timeSpentSeconds;
    if (dto.returnedTo !== undefined) updateData['returned_to'] = dto.returnedTo;

    return from(
      this.supabase
        .from('submission_answers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbAnswerToModel(data as Record<string, unknown>);
      })
    );
  }

  // @REVIEW: Submit exam - evaluates answers and calculates score
  submitExam(submissionId: string): Observable<ExamSubmission> {
    return this.evaluateAndSubmit(submissionId, 'submitted', null);
  }

  // @REVIEW: Auto-submit exam - same as submit but with reason (blur, timeout, etc.)
  autoSubmitExam(submissionId: string, reason: string): Observable<ExamSubmission> {
    return this.evaluateAndSubmit(submissionId, 'auto_submitted', reason);
  }

  // @REVIEW: Private helper to evaluate and submit exam
  private evaluateAndSubmit(
    submissionId: string, 
    status: 'submitted' | 'auto_submitted',
    reason: string | null
  ): Observable<ExamSubmission> {
    // Step 1: Get submission with answers and exam questions
    return from(
      this.supabase
        .from('exam_submissions')
        .select(`
          *,
          submission_answers (*),
          exams (
            *,
            questions (*)
          )
        `)
        .eq('id', submissionId)
        .single()
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw new Error(error.message);
        
        const submission = data as Record<string, unknown>;
        const answers = (submission['submission_answers'] ?? []) as Record<string, unknown>[];
        const exam = submission['exams'] as Record<string, unknown>;
        const questions = (exam['questions'] ?? []) as Record<string, unknown>[];

        // Step 2: Build question lookup for evaluation
        const questionMap = new Map<string, Record<string, unknown>>();
        questions.forEach(q => questionMap.set(q['id'] as string, q));

        // Step 3: Evaluate each answer
        let totalCorrect = 0;
        let totalWrong = 0;
        let totalSkipped = 0;
        let score = 0;

        const answerUpdates = answers.map(answer => {
          const questionId = answer['question_id'] as string;
          const selectedOptionId = answer['selected_option_id'] as string | null;
          const wasSkipped = answer['was_skipped'] as boolean;
          const question = questionMap.get(questionId);

          if (!question) return null;

          const correctOptionId = question['correct_option_id'] as string;
          const marks = question['marks'] as number;
          const negativeMarks = parseFloat(question['negative_marks'] as string) || 0;

          let isCorrect: boolean | null = null;
          let marksObtained = 0;

          if (wasSkipped || !selectedOptionId) {
            totalSkipped++;
            isCorrect = null;
            marksObtained = 0;
          } else if (selectedOptionId === correctOptionId) {
            totalCorrect++;
            isCorrect = true;
            marksObtained = marks;
            score += marks;
          } else {
            totalWrong++;
            isCorrect = false;
            marksObtained = -negativeMarks;
            score -= negativeMarks;
          }

          return {
            id: answer['id'] as string,
            isCorrect,
            marksObtained,
          };
        }).filter(Boolean);

        // Step 4: Update all answers with evaluation results
        const updatePromises = answerUpdates.map(update => 
          this.supabase
            .from('submission_answers')
            .update({
              is_correct: update!.isCorrect,
              marks_obtained: update!.marksObtained,
            })
            .eq('id', update!.id)
        );

        return from(Promise.all(updatePromises)).pipe(
          switchMap(() => {
            // Step 5: Calculate final stats
            const totalMarks = exam['total_marks'] as number;
            const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100 * 100) / 100 : 0;
            const totalAnswered = totalCorrect + totalWrong;

            // Step 6: Update submission with final results
            return from(
              this.supabase
                .from('exam_submissions')
                .update({
                  status,
                  submitted_at: new Date().toISOString(),
                  auto_submit_reason: reason,
                  total_answered: totalAnswered,
                  total_correct: totalCorrect,
                  total_wrong: totalWrong,
                  total_skipped: totalSkipped,
                  score: Math.max(0, score), // Ensure non-negative score
                  percentage,
                })
                .eq('id', submissionId)
                .select()
                .single()
            );
          })
        );
      }),
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbSubmissionToModel(data as Record<string, unknown>);
      }),
      // Step 7: Update exam stats (total_submissions, average_score)
      switchMap(submission => this.updateExamStats(submission.examId).pipe(map(() => submission)))
    );
  }

  // @REVIEW: Evaluate submission (for teacher review/override)
  evaluate(submissionId: string, evaluatedBy: string, remarks?: string): Observable<ExamSubmission> {
    return from(
      this.supabase
        .from('exam_submissions')
        .update({
          status: 'evaluated',
          evaluated_at: new Date().toISOString(),
          evaluated_by: evaluatedBy,
          remarks: remarks ?? null,
        })
        .eq('id', submissionId)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbSubmissionToModel(data as Record<string, unknown>);
      })
    );
  }

  // @REVIEW: Allow retake - resets submission status
  allowRetake(submissionId: string): Observable<ExamSubmission> {
    return from(
      this.supabase
        .from('exam_submissions')
        .update({
          status: 'retake_allowed',
        })
        .eq('id', submissionId)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbSubmissionToModel(data as Record<string, unknown>);
      })
    );
  }

  // @REVIEW: Cancel retake - reverts status back to evaluated
  cancelRetake(submissionId: string): Observable<ExamSubmission> {
    return from(
      this.supabase
        .from('exam_submissions')
        .update({
          status: 'evaluated',
        })
        .eq('id', submissionId)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbSubmissionToModel(data as Record<string, unknown>);
      })
    );
  }

  // @REVIEW: Update exam's submission stats after submission
  private updateExamStats(examId: string): Observable<void> {
    return from(
      this.supabase
        .from('exam_submissions')
        .select('score')
        .eq('exam_id', examId)
        .in('status', ['submitted', 'auto_submitted', 'evaluated'])
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) throw new Error(error.message);
        const submissions = data ?? [];
        const totalSubmissions = submissions.length;
        const averageScore = totalSubmissions > 0
          ? Math.round(submissions.reduce((sum, s) => sum + (s.score ?? 0), 0) / totalSubmissions * 100) / 100
          : 0;

        return from(
          this.supabase
            .from('exams')
            .update({ total_submissions: totalSubmissions, average_score: averageScore })
            .eq('id', examId)
        ).pipe(
          map(({ error: updateError }) => {
            if (updateError) throw new Error(updateError.message);
          })
        );
      })
    );
  }
}

@Injectable()
class SupabaseAssetAdapter implements IAssetAdapter {
  getById(_id: string): Observable<Asset | null> { return of(null); }
  getBySubject(_subjectId: string, _params?: PaginationParams): Observable<PaginatedResponse<Asset>> {
    return of({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
  }
  create(_dto: CreateAssetDto): Observable<Asset> { return throwError(() => new Error('Not implemented')); }
  update(_id: string, _dto: UpdateAssetDto): Observable<Asset> { return throwError(() => new Error('Not implemented')); }
  delete(_id: string): Observable<void> { return throwError(() => new Error('Not implemented')); }
  uploadFile(_file: File, _path: string): Observable<{ url: string; fileName: string; size: number }> {
    return throwError(() => new Error('Not implemented'));
  }
  deleteFile(_path: string): Observable<void> { return throwError(() => new Error('Not implemented')); }
}

@Injectable()
class SupabaseCommentAdapter implements ICommentAdapter {
  getByAsset(_assetId: string): Observable<AssetCommentWithUser[]> { return of([]); }
  create(_dto: CreateAssetCommentDto): Observable<AssetComment> { return throwError(() => new Error('Not implemented')); }
  update(_id: string, _content: string): Observable<AssetComment> { return throwError(() => new Error('Not implemented')); }
  delete(_id: string): Observable<void> { return throwError(() => new Error('Not implemented')); }
  toggleVisibility(_id: string, _isVisible: boolean): Observable<AssetComment> { return throwError(() => new Error('Not implemented')); }
}

// =============================================
// @REVIEW: EXAM ASSIGNMENT ADAPTER
// =============================================

@Injectable({ providedIn: 'root' })
export class SupabaseExamAssignmentAdapter {
  private readonly supabase = inject(SupabaseClientService);

  // Get all assignments for an exam
  getByExam(examId: string): Observable<ExamAssignment[]> {
    return from(
      this.supabase
        .from('exam_assignments')
        .select('*')
        .eq('exam_id', examId)
        .order('assigned_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data as Record<string, unknown>[]).map(mapDbExamAssignmentToModel);
      })
    );
  }

  // Get all assignments for a student
  getByStudent(studentId: string): Observable<ExamAssignment[]> {
    return from(
      this.supabase
        .from('exam_assignments')
        .select('*')
        .eq('student_id', studentId)
        .order('due_date', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data as Record<string, unknown>[]).map(mapDbExamAssignmentToModel);
      })
    );
  }

  // Get assignments with details (exam + student info)
  getByExamWithDetails(examId: string): Observable<ExamAssignmentWithDetails[]> {
    return from(
      this.supabase
        .from('exam_assignments')
        .select(`
          *,
          exams (*),
          students (*, users (*))
        `)
        .eq('exam_id', examId)
        .order('assigned_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data as Record<string, unknown>[]).map(row => ({
          ...mapDbExamAssignmentToModel(row),
          exam: mapDbExamToModel(row['exams'] as Record<string, unknown>),
          student: mapDbStudentWithUserToModel(row['students'] as Record<string, unknown>),
        }));
      })
    );
  }

  // Assign exam to a student
  create(dto: CreateExamAssignmentDto): Observable<ExamAssignment> {
    return from(
      this.supabase
        .from('exam_assignments')
        .insert({
          exam_id: dto.examId,
          student_id: dto.studentId,
          assigned_by: dto.assignedBy,
          available_from: dto.availableFrom?.toISOString() ?? null,
          due_date: dto.dueDate?.toISOString() ?? null,
          max_attempts: dto.maxAttempts ?? 1,
          time_limit_minutes: dto.timeLimitMinutes ?? null,
          notes: dto.notes ?? null,
        })
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbExamAssignmentToModel(data as Record<string, unknown>);
      })
    );
  }

  // Bulk assign exam to multiple students
  createBulk(examId: string, studentIds: string[], assignedBy: string, options?: {
    availableFrom?: Date;
    dueDate?: Date;
    maxAttempts?: number;
  }): Observable<ExamAssignment[]> {
    const records = studentIds.map(studentId => ({
      exam_id: examId,
      student_id: studentId,
      assigned_by: assignedBy,
      available_from: options?.availableFrom?.toISOString() ?? null,
      due_date: options?.dueDate?.toISOString() ?? null,
      max_attempts: options?.maxAttempts ?? 1,
    }));

    return from(
      this.supabase
        .from('exam_assignments')
        .insert(records)
        .select()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data as Record<string, unknown>[]).map(mapDbExamAssignmentToModel);
      })
    );
  }

  // Update assignment
  update(id: string, dto: UpdateExamAssignmentDto): Observable<ExamAssignment> {
    const updateData: Record<string, unknown> = {};
    if (dto.availableFrom !== undefined) updateData['available_from'] = dto.availableFrom?.toISOString() ?? null;
    if (dto.dueDate !== undefined) updateData['due_date'] = dto.dueDate?.toISOString() ?? null;
    if (dto.status !== undefined) updateData['status'] = dto.status;
    if (dto.maxAttempts !== undefined) updateData['max_attempts'] = dto.maxAttempts;
    if (dto.timeLimitMinutes !== undefined) updateData['time_limit_minutes'] = dto.timeLimitMinutes;
    if (dto.notes !== undefined) updateData['notes'] = dto.notes;

    return from(
      this.supabase
        .from('exam_assignments')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbExamAssignmentToModel(data as Record<string, unknown>);
      })
    );
  }

  // Delete assignment
  delete(id: string): Observable<void> {
    return from(
      this.supabase
        .from('exam_assignments')
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (error) throw new Error(error.message);
      })
    );
  }

  // Remove all assignments for an exam
  deleteByExam(examId: string): Observable<void> {
    return from(
      this.supabase
        .from('exam_assignments')
        .delete()
        .eq('exam_id', examId)
    ).pipe(
      map(({ error }) => {
        if (error) throw new Error(error.message);
      })
    );
  }
}

// =============================================
// @REVIEW: EXAM SUBJECT ASSIGNMENT ADAPTER
// =============================================

@Injectable({ providedIn: 'root' })
export class SupabaseExamSubjectAssignmentAdapter {
  private readonly supabase = inject(SupabaseClientService);

  // Get all subject assignments for an exam
  getByExam(examId: string): Observable<ExamSubjectAssignment[]> {
    return from(
      this.supabase
        .from('exam_subject_assignments')
        .select('*')
        .eq('exam_id', examId)
        .order('assigned_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data as Record<string, unknown>[]).map(mapDbExamSubjectAssignmentToModel);
      })
    );
  }

  // Get all exam assignments for a subject
  getBySubject(subjectId: string): Observable<ExamSubjectAssignment[]> {
    return from(
      this.supabase
        .from('exam_subject_assignments')
        .select('*')
        .eq('subject_id', subjectId)
        .order('assigned_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data as Record<string, unknown>[]).map(mapDbExamSubjectAssignmentToModel);
      })
    );
  }

  // Get with details
  getByExamWithDetails(examId: string): Observable<ExamSubjectAssignmentWithDetails[]> {
    return from(
      this.supabase
        .from('exam_subject_assignments')
        .select(`
          *,
          exams (*),
          subjects (*)
        `)
        .eq('exam_id', examId)
        .order('assigned_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data as Record<string, unknown>[]).map(row => ({
          ...mapDbExamSubjectAssignmentToModel(row),
          exam: mapDbExamToModel(row['exams'] as Record<string, unknown>),
          subject: mapDbSubjectToModel(row['subjects'] as Record<string, unknown>),
        }));
      })
    );
  }

  // Assign exam to a subject
  create(dto: CreateExamSubjectAssignmentDto): Observable<ExamSubjectAssignment> {
    return from(
      this.supabase
        .from('exam_subject_assignments')
        .insert({
          exam_id: dto.examId,
          subject_id: dto.subjectId,
          assigned_by: dto.assignedBy,
          available_from: dto.availableFrom?.toISOString() ?? null,
          due_date: dto.dueDate?.toISOString() ?? null,
          auto_assign_students: dto.autoAssignStudents ?? true,
        })
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbExamSubjectAssignmentToModel(data as Record<string, unknown>);
      })
    );
  }

  // Update assignment
  update(id: string, dto: UpdateExamSubjectAssignmentDto): Observable<ExamSubjectAssignment> {
    const updateData: Record<string, unknown> = {};
    if (dto.availableFrom !== undefined) updateData['available_from'] = dto.availableFrom?.toISOString() ?? null;
    if (dto.dueDate !== undefined) updateData['due_date'] = dto.dueDate?.toISOString() ?? null;
    if (dto.autoAssignStudents !== undefined) updateData['auto_assign_students'] = dto.autoAssignStudents;

    return from(
      this.supabase
        .from('exam_subject_assignments')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return mapDbExamSubjectAssignmentToModel(data as Record<string, unknown>);
      })
    );
  }

  // Delete assignment
  delete(id: string): Observable<void> {
    return from(
      this.supabase
        .from('exam_subject_assignments')
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (error) throw new Error(error.message);
      })
    );
  }

  // Remove all subject assignments for an exam
  deleteByExam(examId: string): Observable<void> {
    return from(
      this.supabase
        .from('exam_subject_assignments')
        .delete()
        .eq('exam_id', examId)
    ).pipe(
      map(({ error }) => {
        if (error) throw new Error(error.message);
      })
    );
  }
}

// =============================================
// MAIN DATABASE ADAPTER
// =============================================

@Injectable({
  providedIn: 'root',
})
export class SupabaseDatabaseAdapter implements IDatabaseAdapter {
  readonly auth = inject(SupabaseAuthAdapter);
  readonly users = inject(SupabaseUserAdapter);
  readonly teachers = inject(SupabaseTeacherAdapter);
  readonly students = inject(SupabaseStudentAdapter);
  readonly subjects = inject(SupabaseSubjectAdapter);
  readonly exams = inject(SupabaseExamAdapter);
  readonly questions = inject(SupabaseQuestionAdapter);
  readonly submissions = inject(SupabaseSubmissionAdapter);
  readonly assets = inject(SupabaseAssetAdapter);
  readonly comments = inject(SupabaseCommentAdapter);
  readonly admin = inject(SupabaseAdminAdapter);
  // @REVIEW: New adapters for flexible exam assignments
  readonly examAssignments = inject(SupabaseExamAssignmentAdapter);
  readonly examSubjectAssignments = inject(SupabaseExamSubjectAssignmentAdapter);
}

// =============================================
// PROVIDER FACTORY
// =============================================

export const provideSupabaseDatabaseAdapter = () => [
  SupabaseAuthAdapter,
  SupabaseUserAdapter,
  SupabaseTeacherAdapter,
  SupabaseStudentAdapter,
  SupabaseSubjectAdapter,
  SupabaseExamAdapter,
  SupabaseQuestionAdapter,
  SupabaseSubmissionAdapter,
  SupabaseAssetAdapter,
  SupabaseCommentAdapter,
  SupabaseAdminAdapter,
  // @REVIEW: New adapters for flexible exam assignments
  SupabaseExamAssignmentAdapter,
  SupabaseExamSubjectAssignmentAdapter,
  SupabaseDatabaseAdapter,
];
