// @REVIEW: Supabase Database Adapter Implementation
// Concrete implementation of IDatabaseAdapter using Supabase

import { Injectable, inject } from '@angular/core';
import { from, map, Observable, of, switchMap, throwError } from 'rxjs';
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

@Injectable()
class SupabaseStudentAdapter implements IStudentAdapter {
  getById(_id: string): Observable<StudentWithUser | null> { return of(null); }
  getByUserId(_userId: string): Observable<StudentWithUser | null> { return of(null); }
  getByTeacher(_teacherId: string, _params?: PaginationParams): Observable<PaginatedResponse<StudentWithUser>> {
    return of({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
  }
  getBySubject(_subjectId: string, _params?: PaginationParams): Observable<PaginatedResponse<StudentWithUser>> {
    return of({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
  }
  create(_dto: CreateStudentDto): Observable<Student> { return throwError(() => new Error('Not implemented')); }
  update(_id: string, _dto: UpdateStudentDto): Observable<Student> { return throwError(() => new Error('Not implemented')); }
  disable(_id: string): Observable<Student> { return throwError(() => new Error('Not implemented')); }
  enable(_id: string): Observable<Student> { return throwError(() => new Error('Not implemented')); }
  delete(_id: string): Observable<void> { return throwError(() => new Error('Not implemented')); }
  getDashboardStats(_studentId: string): Observable<StudentDashboardStats> {
    return of({ enrolledSubjects: 0, totalExamsTaken: 0, averageScore: 0, pendingExams: 0 });
  }
}

@Injectable()
class SupabaseSubjectAdapter implements ISubjectAdapter {
  getById(_id: string): Observable<Subject | null> { return of(null); }
  getByTeacher(_teacherId: string, _params?: PaginationParams): Observable<PaginatedResponse<Subject>> {
    return of({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
  }
  getByStudent(_studentId: string): Observable<Subject[]> { return of([]); }
  create(_dto: CreateSubjectDto): Observable<Subject> { return throwError(() => new Error('Not implemented')); }
  update(_id: string, _dto: UpdateSubjectDto): Observable<Subject> { return throwError(() => new Error('Not implemented')); }
  delete(_id: string): Observable<void> { return throwError(() => new Error('Not implemented')); }
  enrollStudent(_studentId: string, _subjectId: string, _enrolledBy: string): Observable<SubjectEnrollment> {
    return throwError(() => new Error('Not implemented'));
  }
  unenrollStudent(_studentId: string, _subjectId: string): Observable<void> { return throwError(() => new Error('Not implemented')); }
  getEnrolledStudents(_subjectId: string): Observable<StudentWithUser[]> { return of([]); }
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

@Injectable()
class SupabaseQuestionAdapter implements IQuestionAdapter {
  getById(_id: string): Observable<Question | null> { return of(null); }
  getByExam(_examId: string): Observable<Question[]> { return of([]); }
  create(_dto: CreateQuestionDto): Observable<Question> { return throwError(() => new Error('Not implemented')); }
  createBulk(_dtos: CreateQuestionDto[]): Observable<Question[]> { return throwError(() => new Error('Not implemented')); }
  update(_id: string, _dto: UpdateQuestionDto): Observable<Question> { return throwError(() => new Error('Not implemented')); }
  updateSequence(_examId: string, _questionIds: string[]): Observable<void> { return throwError(() => new Error('Not implemented')); }
  delete(_id: string): Observable<void> { return throwError(() => new Error('Not implemented')); }
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
