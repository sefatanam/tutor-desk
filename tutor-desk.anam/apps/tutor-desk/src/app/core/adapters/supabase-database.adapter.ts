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

// @REVIEW: Exam mapper
const mapDbExamToModel = (row: Record<string, unknown>): Exam => ({
  id: row['id'] as string,
  subjectId: row['subject_id'] as string,
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
  totalSubmissions: row['total_submissions'] as number ?? 0,
  averageScore: row['average_score'] as number ?? 0,
  publishedAt: row['published_at'] ? new Date(row['published_at'] as string) : null,
  createdAt: new Date(row['created_at'] as string),
  updatedAt: new Date(row['updated_at'] as string),
});

// @REVIEW: ExamWithSubject mapper
const mapDbExamWithSubjectToModel = (row: Record<string, unknown>): ExamWithSubject => {
  const subjectRow = row['subjects'] as Record<string, unknown>;
  return {
    ...mapDbExamToModel(row),
    subject: mapDbSubjectToModel(subjectRow),
  };
};

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

  getUpcomingForStudent(studentId: string): Observable<ExamWithSubject[]> {
    // Get exams from subjects the student is enrolled in, that are active and upcoming
    return from(
      this.supabase
        .from('exams')
        .select(`
          *,
          subjects!inner(*, subject_enrollments!inner(student_id))
        `)
        .eq('subjects.subject_enrollments.student_id', studentId)
        .eq('status', 'active')
        .gte('scheduled_end', new Date().toISOString())
        .order('scheduled_start', { ascending: true })
        .limit(10)
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return [];
        return (data as Record<string, unknown>[]).map(mapDbExamWithSubjectToModel);
      })
    );
  }

  create(dto: CreateExamDto): Observable<Exam> {
    return from(
      this.supabase
        .from('exams')
        .insert({
          subject_id: dto.subjectId,
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

  update(id: string, dto: UpdateExamDto): Observable<Exam> {
    const updateData: Record<string, unknown> = {};
    if (dto.title !== undefined) updateData['title'] = dto.title;
    if (dto.description !== undefined) updateData['description'] = dto.description;
    if (dto.instructions !== undefined) updateData['instructions'] = dto.instructions;
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
  private readonly supabase = inject(SupabaseClientService).client;

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

@Injectable()
class SupabaseSubmissionAdapter implements ISubmissionAdapter {
  getById(_id: string): Observable<ExamSubmissionWithDetails | null> { return of(null); }
  getByExam(_examId: string, _params?: PaginationParams): Observable<PaginatedResponse<ExamSubmission>> {
    return of({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
  }
  getByStudent(_studentId: string, _params?: PaginationParams): Observable<PaginatedResponse<ExamSubmission>> {
    return of({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
  }
  getByStudentAndExam(_studentId: string, _examId: string): Observable<ExamSubmission | null> { return of(null); }
  startExam(_examId: string, _studentId: string): Observable<ExamSubmission> { return throwError(() => new Error('Not implemented')); }
  submitAnswer(_dto: CreateSubmissionAnswerDto): Observable<SubmissionAnswer> { return throwError(() => new Error('Not implemented')); }
  updateAnswer(_id: string, _dto: UpdateSubmissionAnswerDto): Observable<SubmissionAnswer> { return throwError(() => new Error('Not implemented')); }
  submitExam(_submissionId: string): Observable<ExamSubmission> { return throwError(() => new Error('Not implemented')); }
  autoSubmitExam(_submissionId: string, _reason: string): Observable<ExamSubmission> { return throwError(() => new Error('Not implemented')); }
  evaluate(_submissionId: string, _evaluatedBy: string, _remarks?: string): Observable<ExamSubmission> { return throwError(() => new Error('Not implemented')); }
  allowRetake(_submissionId: string): Observable<ExamSubmission> { return throwError(() => new Error('Not implemented')); }
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
  SupabaseDatabaseAdapter,
];
