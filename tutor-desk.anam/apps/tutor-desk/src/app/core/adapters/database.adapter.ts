// @REVIEW: Abstract Database Adapter Interface
// Strategy pattern to allow swapping between Supabase, Firebase, etc.

import { Observable } from 'rxjs';
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
  GoogleAuthPayload,
  TeacherDashboardStats,
  StudentDashboardStats,
  SuperAdminDashboardStats,
  UserStatus,
  // @REVIEW: Settings models for dynamic configuration
  SettingsCategory,
  SystemSetting,
  CreateSettingsCategoryDto,
  UpdateSettingsCategoryDto,
  CreateSystemSettingDto,
  UpdateSystemSettingDto,
} from '../models';

// =============================================
// AUTH ADAPTER INTERFACE
// =============================================

export interface IAuthAdapter {
  // Email/Password Authentication
  signInWithEmail(credentials: LoginCredentials): Observable<AuthSession>;
  signUpWithEmail(credentials: LoginCredentials & { fullName: string }): Observable<AuthSession>;
  
  // Google OAuth (for Teachers)
  signInWithGoogle(): Observable<AuthSession>;
  
  // Session Management
  getCurrentSession(): Observable<AuthSession | null>;
  refreshSession(): Observable<AuthSession>;
  signOut(): Observable<void>;
  
  // Password Management
  resetPassword(email: string): Observable<void>;
  updatePassword(newPassword: string): Observable<void>;
}

// =============================================
// USER ADAPTER INTERFACE
// =============================================

export interface IUserAdapter {
  getById(id: string): Observable<User | null>;
  getByEmail(email: string): Observable<User | null>;
  create(dto: CreateUserDto): Observable<User>;
  update(id: string, dto: UpdateUserDto): Observable<User>;
  updateStatus(id: string, status: UserStatus): Observable<User>;
  delete(id: string): Observable<void>;
}

// =============================================
// TEACHER ADAPTER INTERFACE
// =============================================

export interface ITeacherAdapter {
  getById(id: string): Observable<TeacherWithUser | null>;
  getByUserId(userId: string): Observable<TeacherWithUser | null>;
  getAll(params?: PaginationParams): Observable<PaginatedResponse<TeacherWithUser>>;
  getPendingApprovals(): Observable<TeacherWithUser[]>;
  create(dto: CreateTeacherDto): Observable<Teacher>;
  update(id: string, dto: UpdateTeacherDto): Observable<Teacher>;
  approve(id: string, approvedBy: string): Observable<Teacher>;
  disable(id: string): Observable<Teacher>;
  enable(id: string): Observable<Teacher>;
  delete(id: string): Observable<void>;
  getDashboardStats(teacherId: string): Observable<TeacherDashboardStats>;
}

// =============================================
// STUDENT ADAPTER INTERFACE
// =============================================

export interface IStudentAdapter {
  getById(id: string): Observable<StudentWithUser | null>;
  getByUserId(userId: string): Observable<StudentWithUser | null>;
  getByTeacher(teacherId: string, params?: PaginationParams): Observable<PaginatedResponse<StudentWithUser>>;
  getBySubject(subjectId: string, params?: PaginationParams): Observable<PaginatedResponse<StudentWithUser>>;
  create(dto: CreateStudentDto): Observable<Student>;
  update(id: string, dto: UpdateStudentDto): Observable<Student>;
  disable(id: string): Observable<Student>;
  enable(id: string): Observable<Student>;
  delete(id: string): Observable<void>;
  getDashboardStats(studentId: string): Observable<StudentDashboardStats>;
}

// =============================================
// SUBJECT ADAPTER INTERFACE
// =============================================

export interface ISubjectAdapter {
  getById(id: string): Observable<Subject | null>;
  getByTeacher(teacherId: string, params?: PaginationParams): Observable<PaginatedResponse<Subject>>;
  getByStudent(studentId: string): Observable<Subject[]>;
  create(dto: CreateSubjectDto): Observable<Subject>;
  update(id: string, dto: UpdateSubjectDto): Observable<Subject>;
  delete(id: string): Observable<void>;
  
  // Enrollments
  enrollStudent(studentId: string, subjectId: string, enrolledBy: string): Observable<SubjectEnrollment>;
  unenrollStudent(studentId: string, subjectId: string): Observable<void>;
  getEnrolledStudents(subjectId: string): Observable<StudentWithUser[]>;
}

// =============================================
// EXAM ADAPTER INTERFACE
// =============================================

export interface IExamAdapter {
  getById(id: string): Observable<ExamWithSubject | null>;
  getBySubject(subjectId: string, params?: PaginationParams): Observable<PaginatedResponse<Exam>>;
  getByTeacher(teacherId: string, params?: PaginationParams): Observable<PaginatedResponse<ExamWithSubject>>;
  getUpcomingForStudent(studentId: string): Observable<ExamWithSubject[]>;
  create(dto: CreateExamDto): Observable<Exam>;
  update(id: string, dto: UpdateExamDto): Observable<Exam>;
  publish(id: string): Observable<Exam>;
  cancel(id: string): Observable<Exam>;
  delete(id: string): Observable<void>;
}

// =============================================
// QUESTION ADAPTER INTERFACE
// =============================================

export interface IQuestionAdapter {
  getById(id: string): Observable<Question | null>;
  getByExam(examId: string): Observable<Question[]>;
  create(dto: CreateQuestionDto): Observable<Question>;
  createBulk(dtos: CreateQuestionDto[]): Observable<Question[]>;
  update(id: string, dto: UpdateQuestionDto): Observable<Question>;
  updateSequence(examId: string, questionIds: string[]): Observable<void>;
  delete(id: string): Observable<void>;
}

// =============================================
// SUBMISSION ADAPTER INTERFACE
// =============================================

export interface ISubmissionAdapter {
  getById(id: string): Observable<ExamSubmissionWithDetails | null>;
  getByExam(examId: string, params?: PaginationParams): Observable<PaginatedResponse<ExamSubmission>>;
  getByStudent(studentId: string, params?: PaginationParams): Observable<PaginatedResponse<ExamSubmission>>;
  getByStudentAndExam(studentId: string, examId: string): Observable<ExamSubmission | null>;
  
  // Exam Taking Flow
  startExam(examId: string, studentId: string): Observable<ExamSubmission>;
  submitAnswer(dto: CreateSubmissionAnswerDto): Observable<SubmissionAnswer>;
  updateAnswer(id: string, dto: UpdateSubmissionAnswerDto): Observable<SubmissionAnswer>;
  submitExam(submissionId: string): Observable<ExamSubmission>;
  autoSubmitExam(submissionId: string, reason: string): Observable<ExamSubmission>;
  
  // Evaluation
  evaluate(submissionId: string, evaluatedBy: string, remarks?: string): Observable<ExamSubmission>;
  allowRetake(submissionId: string): Observable<ExamSubmission>;
  // @REVIEW: Cancel retake - reverts status back to submitted/evaluated
  cancelRetake(submissionId: string): Observable<ExamSubmission>;
}

// =============================================
// ASSET ADAPTER INTERFACE
// =============================================

export interface IAssetAdapter {
  getById(id: string): Observable<Asset | null>;
  getBySubject(subjectId: string, params?: PaginationParams): Observable<PaginatedResponse<Asset>>;
  create(dto: CreateAssetDto): Observable<Asset>;
  update(id: string, dto: UpdateAssetDto): Observable<Asset>;
  delete(id: string): Observable<void>;
  
  // File Upload
  uploadFile(file: File, path: string): Observable<{ url: string; fileName: string; size: number }>;
  deleteFile(path: string): Observable<void>;
}

// =============================================
// COMMENT ADAPTER INTERFACE
// =============================================

export interface ICommentAdapter {
  getByAsset(assetId: string): Observable<AssetCommentWithUser[]>;
  create(dto: CreateAssetCommentDto): Observable<AssetComment>;
  update(id: string, content: string): Observable<AssetComment>;
  delete(id: string): Observable<void>;
  toggleVisibility(id: string, isVisible: boolean): Observable<AssetComment>;
}

// =============================================
// ADMIN ADAPTER INTERFACE
// =============================================

export interface IAdminAdapter {
  getDashboardStats(): Observable<SuperAdminDashboardStats>;
  getAllTeachers(params?: PaginationParams): Observable<PaginatedResponse<TeacherWithUser>>;
  getSystemLogs(params?: PaginationParams): Observable<PaginatedResponse<unknown>>;
}

// =============================================
// SETTINGS ADAPTER INTERFACE
// =============================================

// @REVIEW: Dynamic settings system for unlimited customization
export interface ISettingsAdapter {
  // Categories
  getAllCategories(): Observable<SettingsCategory[]>;
  getCategoryById(id: string): Observable<SettingsCategory | null>;
  createCategory(dto: CreateSettingsCategoryDto): Observable<SettingsCategory>;
  updateCategory(id: string, dto: UpdateSettingsCategoryDto): Observable<SettingsCategory>;
  deleteCategory(id: string): Observable<void>;
  // Settings
  getAllSettings(): Observable<SystemSetting[]>;
  getSettingsByCategory(categoryId: string): Observable<SystemSetting[]>;
  getSettingByKey(key: string): Observable<SystemSetting | null>;
  createSetting(dto: CreateSystemSettingDto): Observable<SystemSetting>;
  updateSetting(id: string, dto: UpdateSystemSettingDto): Observable<SystemSetting>;
  updateSettingValue(id: string, value: string | null): Observable<SystemSetting>;
  deleteSetting(id: string): Observable<void>;
  // Bulk operations
  bulkCreateSettings(settings: CreateSystemSettingDto[]): Observable<SystemSetting[]>;
  deleteAllSettings(): Observable<void>;
  deleteAllCategories(): Observable<void>;
}

// =============================================
// COMBINED DATABASE ADAPTER
// =============================================

export interface IDatabaseAdapter {
  readonly auth: IAuthAdapter;
  readonly users: IUserAdapter;
  readonly teachers: ITeacherAdapter;
  readonly students: IStudentAdapter;
  readonly subjects: ISubjectAdapter;
  readonly exams: IExamAdapter;
  readonly questions: IQuestionAdapter;
  readonly submissions: ISubmissionAdapter;
  readonly assets: IAssetAdapter;
  readonly comments: ICommentAdapter;
  readonly admin: IAdminAdapter;
  // @REVIEW: Settings adapter for dynamic configuration
  readonly settings: ISettingsAdapter;
}
