// @REVIEW: Core model interfaces for Tutor Desk
// These interfaces map to the database schema and provide type safety

// =============================================
// ENUMS
// =============================================

export type UserRole = 'super_admin' | 'teacher' | 'student';

export type UserStatus = 'pending' | 'active' | 'disabled' | 'suspended';

export type ExamStatus = 'draft' | 'scheduled' | 'active' | 'completed' | 'cancelled';

export type SubmissionStatus = 'in_progress' | 'submitted' | 'auto_submitted' | 'evaluated' | 'retake_allowed';

export type AssetType = 'document' | 'image' | 'video' | 'link' | 'other';

export type AuthProvider = 'email' | 'google';

// @REVIEW: Result visibility options for exam - controls when students can view results
export type ResultVisibility = 'immediate' | 'after_due_date' | 'manual_release' | 'never';

// @REVIEW: Exam style/mode - controls the exam-taking experience
// standard: Per-question timer, skip & return allowed, feedback after exam
// free_navigation: Total time limit, free navigation, feedback after exam
// practice: No timer (optional), free navigation, immediate feedback
// quiz: Per-question timer, sequential only, immediate feedback
// section_based: Per-section timer, free within section, feedback after exam
export type ExamStyle = 'standard' | 'free_navigation' | 'practice' | 'quiz' | 'section_based';

// =============================================
// BASE INTERFACES
// =============================================

export interface BaseEntity {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// =============================================
// USER MODELS
// =============================================

export interface User extends BaseEntity {
  readonly email: string;
  readonly fullName: string;
  readonly avatarUrl: string | null;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly phone: string | null;
  readonly authProvider: AuthProvider;
  readonly authProviderId: string | null;
  readonly lastLoginAt: Date | null;
  readonly createdBy: string | null;
}

export interface CreateUserDto {
  readonly email: string;
  readonly password?: string;
  readonly fullName: string;
  readonly role: UserRole;
  readonly phone?: string;
  readonly authProvider?: AuthProvider;
  readonly authProviderId?: string;
}

export interface UpdateUserDto {
  readonly fullName?: string;
  readonly avatarUrl?: string;
  readonly phone?: string;
  readonly status?: UserStatus;
}

// =============================================
// TEACHER MODELS
// =============================================

export interface Teacher extends BaseEntity {
  readonly userId: string;
  readonly qualification: string | null;
  readonly specialization: string | null;
  readonly bio: string | null;
  readonly allowStudentComments: boolean;
  readonly showExamResultsImmediately: boolean;
  readonly totalStudents: number;
  readonly totalSubjects: number;
  readonly totalExams: number;
  readonly approvedAt: Date | null;
  readonly approvedBy: string | null;
}

export interface TeacherWithUser extends Teacher {
  readonly user: User;
}

export interface CreateTeacherDto {
  readonly userId: string;
  readonly qualification?: string;
  readonly specialization?: string;
  readonly bio?: string;
}

export interface UpdateTeacherDto {
  readonly qualification?: string;
  readonly specialization?: string;
  readonly bio?: string;
  readonly allowStudentComments?: boolean;
  readonly showExamResultsImmediately?: boolean;
}

// =============================================
// STUDENT MODELS
// =============================================

export interface Student extends BaseEntity {
  readonly userId: string;
  readonly teacherId: string;
  readonly rollNumber: string | null;
  readonly className: string | null;
  readonly section: string | null;
  readonly guardianName: string | null;
  readonly guardianPhone: string | null;
  readonly address: string | null;
  readonly dateOfBirth: Date | null;
  readonly totalExamsTaken: number;
  readonly averageScore: number;
}

export interface StudentWithUser extends Student {
  readonly user: User;
}

export interface CreateStudentDto {
  readonly email: string;
  readonly password: string;
  readonly fullName: string;
  readonly teacherId: string;
  readonly rollNumber?: string;
  readonly className?: string;
  readonly section?: string;
  readonly guardianName?: string;
  readonly guardianPhone?: string;
  readonly address?: string;
  readonly dateOfBirth?: Date;
}

export interface UpdateStudentDto {
  readonly rollNumber?: string;
  readonly className?: string;
  readonly section?: string;
  readonly guardianName?: string;
  readonly guardianPhone?: string;
  readonly address?: string;
  readonly dateOfBirth?: Date;
}

// =============================================
// SUBJECT MODELS
// =============================================

export interface Subject extends BaseEntity {
  readonly teacherId: string;
  readonly name: string;
  readonly description: string | null;
  readonly code: string | null;
  readonly color: string;
  readonly icon: string;
  readonly isActive: boolean;
  readonly totalStudents: number;
  readonly totalExams: number;
  readonly totalAssets: number;
}

export interface CreateSubjectDto {
  readonly teacherId: string;
  readonly name: string;
  readonly description?: string;
  readonly code?: string;
  readonly color?: string;
  readonly icon?: string;
}

export interface UpdateSubjectDto {
  readonly name?: string;
  readonly description?: string;
  readonly code?: string;
  readonly color?: string;
  readonly icon?: string;
  readonly isActive?: boolean;
}

// =============================================
// SUBJECT ENROLLMENT
// =============================================

export interface SubjectEnrollment extends BaseEntity {
  readonly studentId: string;
  readonly subjectId: string;
  readonly enrolledAt: Date;
  readonly enrolledBy: string | null;
}

// =============================================
// EXAM MODELS
// =============================================

// @REVIEW: Made subjectId optional for independent exam creation
export interface Exam extends BaseEntity {
  readonly subjectId: string | null;
  readonly teacherId: string;
  readonly title: string;
  readonly description: string | null;
  readonly instructions: string | null;
  readonly status: ExamStatus;
  readonly totalQuestions: number;
  readonly totalMarks: number;
  readonly passingMarks: number;
  
  // Time configuration (CRITICAL)
  readonly timePerQuestionSeconds: number;
  readonly allowSkipReturn: boolean;
  
  // Anti-cheat settings
  readonly fullscreenRequired: boolean;
  readonly autoSubmitOnBlur: boolean;
  readonly allowRetake: boolean;
  readonly maxRetakes: number;
  
  // Scheduling
  readonly scheduledStart: Date | null;
  readonly scheduledEnd: Date | null;
  readonly durationMinutes: number | null;
  
  // @REVIEW: Result Visibility Settings - controls what students can see after completing exam
  readonly resultVisibility: ResultVisibility;
  readonly resultReleaseDate: Date | null;
  readonly isResultReleased: boolean;
  readonly showScore: boolean;
  readonly showPercentage: boolean;
  readonly showPassFail: boolean;
  readonly showCorrectAnswers: boolean;
  readonly showStudentAnswers: boolean;
  readonly showExplanations: boolean;
  readonly showQuestionReview: boolean;
  readonly showTimeSpent: boolean;
  readonly showTeacherRemarks: boolean;
  readonly showRank: boolean;
  
  // @REVIEW: Exam Style Settings - controls the exam-taking experience
  readonly examStyle: ExamStyle;
  readonly totalTimeLimitMinutes: number | null;
  readonly showImmediateFeedback: boolean;
  readonly shuffleQuestions: boolean;
  readonly shuffleOptions: boolean;
  
  // Statistics
  readonly totalSubmissions: number;
  readonly averageScore: number;
  readonly publishedAt: Date | null;
}

export interface ExamWithSubject extends Exam {
  readonly subject: Subject | null;
}

// @REVIEW: Made subjectId optional
export interface CreateExamDto {
  readonly subjectId?: string | null;
  readonly teacherId: string;
  readonly title: string;
  readonly description?: string;
  readonly instructions?: string;
  readonly timePerQuestionSeconds?: number;
  readonly allowSkipReturn?: boolean;
  readonly fullscreenRequired?: boolean;
  readonly autoSubmitOnBlur?: boolean;
  readonly allowRetake?: boolean;
  readonly maxRetakes?: number;
  readonly scheduledStart?: Date;
  readonly scheduledEnd?: Date;
  readonly durationMinutes?: number;
  readonly passingMarks?: number;
  // @REVIEW: Result visibility settings
  readonly resultVisibility?: ResultVisibility;
  readonly resultReleaseDate?: Date;
  readonly showScore?: boolean;
  readonly showPercentage?: boolean;
  readonly showPassFail?: boolean;
  readonly showCorrectAnswers?: boolean;
  readonly showStudentAnswers?: boolean;
  readonly showExplanations?: boolean;
  readonly showQuestionReview?: boolean;
  readonly showTimeSpent?: boolean;
  readonly showTeacherRemarks?: boolean;
  readonly showRank?: boolean;
  // @REVIEW: Exam style settings
  readonly examStyle?: ExamStyle;
  readonly totalTimeLimitMinutes?: number;
  readonly showImmediateFeedback?: boolean;
  readonly shuffleQuestions?: boolean;
  readonly shuffleOptions?: boolean;
}

// @REVIEW: Added subjectId to allow assigning exam to subject later
export interface UpdateExamDto {
  readonly title?: string;
  readonly description?: string;
  readonly instructions?: string;
  readonly status?: ExamStatus;
  readonly subjectId?: string | null;
  readonly timePerQuestionSeconds?: number;
  readonly allowSkipReturn?: boolean;
  readonly fullscreenRequired?: boolean;
  readonly autoSubmitOnBlur?: boolean;
  readonly allowRetake?: boolean;
  readonly maxRetakes?: number;
  readonly scheduledStart?: Date;
  readonly scheduledEnd?: Date;
  readonly durationMinutes?: number;
  readonly passingMarks?: number;
  // @REVIEW: Result visibility settings
  readonly resultVisibility?: ResultVisibility;
  readonly resultReleaseDate?: Date | null;
  readonly isResultReleased?: boolean;
  readonly showScore?: boolean;
  readonly showPercentage?: boolean;
  readonly showPassFail?: boolean;
  readonly showCorrectAnswers?: boolean;
  readonly showStudentAnswers?: boolean;
  readonly showExplanations?: boolean;
  readonly showQuestionReview?: boolean;
  readonly showTimeSpent?: boolean;
  readonly showTeacherRemarks?: boolean;
  readonly showRank?: boolean;
  // @REVIEW: Exam style settings
  readonly examStyle?: ExamStyle;
  readonly totalTimeLimitMinutes?: number | null;
  readonly showImmediateFeedback?: boolean;
  readonly shuffleQuestions?: boolean;
  readonly shuffleOptions?: boolean;
}

// =============================================
// EXAM ASSIGNMENT MODELS
// =============================================

export type ExamAssignmentStatus = 'assigned' | 'started' | 'completed' | 'expired' | 'cancelled';

// @REVIEW: Direct student assignment
export interface ExamAssignment extends BaseEntity {
  readonly examId: string;
  readonly studentId: string;
  readonly assignedBy: string;
  readonly assignedAt: Date;
  readonly availableFrom: Date | null;
  readonly dueDate: Date | null;
  readonly status: ExamAssignmentStatus;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly maxAttempts: number;
  readonly timeLimitMinutes: number | null;
  readonly notes: string | null;
}

export interface ExamAssignmentWithDetails extends ExamAssignment {
  readonly exam: Exam;
  readonly student: Student;
}

export interface CreateExamAssignmentDto {
  readonly examId: string;
  readonly studentId: string;
  readonly assignedBy: string;
  readonly availableFrom?: Date;
  readonly dueDate?: Date;
  readonly maxAttempts?: number;
  readonly timeLimitMinutes?: number;
  readonly notes?: string;
}

export interface UpdateExamAssignmentDto {
  readonly availableFrom?: Date | null;
  readonly dueDate?: Date | null;
  readonly status?: ExamAssignmentStatus;
  readonly maxAttempts?: number;
  readonly timeLimitMinutes?: number | null;
  readonly notes?: string | null;
}

// @REVIEW: Subject-level assignment (auto-assigns to enrolled students)
export interface ExamSubjectAssignment extends BaseEntity {
  readonly examId: string;
  readonly subjectId: string;
  readonly assignedBy: string;
  readonly assignedAt: Date;
  readonly availableFrom: Date | null;
  readonly dueDate: Date | null;
  readonly autoAssignStudents: boolean;
}

export interface ExamSubjectAssignmentWithDetails extends ExamSubjectAssignment {
  readonly exam: Exam;
  readonly subject: Subject;
}

export interface CreateExamSubjectAssignmentDto {
  readonly examId: string;
  readonly subjectId: string;
  readonly assignedBy: string;
  readonly availableFrom?: Date;
  readonly dueDate?: Date;
  readonly autoAssignStudents?: boolean;
}

export interface UpdateExamSubjectAssignmentDto {
  readonly availableFrom?: Date | null;
  readonly dueDate?: Date | null;
  readonly autoAssignStudents?: boolean;
}

// =============================================
// QUESTION MODELS (MCQ)
// =============================================

export interface QuestionOption {
  readonly id: string;
  readonly text: string;
  readonly imageUrl?: string;
}

export interface Question extends BaseEntity {
  readonly examId: string;
  readonly questionText: string;
  readonly questionImageUrl: string | null;
  readonly options: QuestionOption[];
  readonly correctOptionId: string;
  readonly marks: number;
  readonly negativeMarks: number;
  readonly timeLimitSeconds: number | null; // Per-question override
  readonly sequenceNumber: number;
  readonly explanation: string | null;
}

export interface CreateQuestionDto {
  readonly examId: string;
  readonly questionText: string;
  readonly questionImageUrl?: string;
  readonly options: QuestionOption[];
  readonly correctOptionId: string;
  readonly marks?: number;
  readonly negativeMarks?: number;
  readonly timeLimitSeconds?: number;
  readonly sequenceNumber: number;
  readonly explanation?: string;
}

export interface UpdateQuestionDto {
  readonly questionText?: string;
  readonly questionImageUrl?: string;
  readonly options?: QuestionOption[];
  readonly correctOptionId?: string;
  readonly marks?: number;
  readonly negativeMarks?: number;
  readonly timeLimitSeconds?: number;
  readonly sequenceNumber?: number;
  readonly explanation?: string;
}

// =============================================
// EXAM SUBMISSION MODELS
// =============================================

export interface ExamSubmission extends BaseEntity {
  readonly examId: string;
  readonly studentId: string;
  readonly status: SubmissionStatus;
  readonly startedAt: Date;
  readonly submittedAt: Date | null;
  readonly autoSubmitReason: string | null;
  readonly totalAnswered: number;
  readonly totalCorrect: number;
  readonly totalWrong: number;
  readonly totalSkipped: number;
  readonly score: number;
  readonly percentage: number;
  readonly attemptNumber: number;
  readonly evaluatedAt: Date | null;
  readonly evaluatedBy: string | null;
  readonly remarks: string | null;
}

export interface ExamSubmissionWithDetails extends ExamSubmission {
  readonly exam: Exam;
  readonly answers: SubmissionAnswer[];
}

// =============================================
// SUBMISSION ANSWER MODELS
// =============================================

export interface SubmissionAnswer extends BaseEntity {
  readonly submissionId: string;
  readonly questionId: string;
  readonly selectedOptionId: string | null;
  readonly isCorrect: boolean | null;
  readonly marksObtained: number;
  
  // Time tracking (CRITICAL for skip-return)
  readonly timeSpentSeconds: number;
  readonly timeRemainingSeconds: number | null;
  readonly wasSkipped: boolean;
  readonly returnedTo: boolean;
  
  readonly answeredAt: Date | null;
  readonly sequenceAnswered: number | null;
}

export interface CreateSubmissionAnswerDto {
  readonly submissionId: string;
  readonly questionId: string;
  readonly selectedOptionId?: string;
  readonly timeSpentSeconds: number;
  readonly timeRemainingSeconds?: number;
  readonly wasSkipped?: boolean;
  readonly sequenceAnswered: number;
}

export interface UpdateSubmissionAnswerDto {
  readonly selectedOptionId?: string;
  readonly timeSpentSeconds?: number;
  readonly returnedTo?: boolean;
}

// =============================================
// ASSET MODELS
// =============================================

export interface Asset extends BaseEntity {
  readonly subjectId: string;
  readonly teacherId: string;
  readonly title: string;
  readonly description: string | null;
  readonly assetType: AssetType;
  readonly fileUrl: string | null;
  readonly fileName: string | null;
  readonly fileSizeBytes: number | null;
  readonly mimeType: string | null;
  readonly externalUrl: string | null;
  readonly thumbnailUrl: string | null;
  readonly sequenceNumber: number;
  readonly isPublished: boolean;
}

export interface CreateAssetDto {
  readonly subjectId: string;
  readonly teacherId: string;
  readonly title: string;
  readonly description?: string;
  readonly assetType: AssetType;
  readonly fileUrl?: string;
  readonly fileName?: string;
  readonly fileSizeBytes?: number;
  readonly mimeType?: string;
  readonly externalUrl?: string;
  readonly thumbnailUrl?: string;
  readonly sequenceNumber?: number;
}

export interface UpdateAssetDto {
  readonly title?: string;
  readonly description?: string;
  readonly assetType?: AssetType;
  readonly externalUrl?: string;
  readonly thumbnailUrl?: string;
  readonly sequenceNumber?: number;
  readonly isPublished?: boolean;
}

// =============================================
// ASSET COMMENT MODELS
// =============================================

export interface AssetComment extends BaseEntity {
  readonly assetId: string;
  readonly userId: string;
  readonly parentId: string | null;
  readonly content: string;
  readonly isVisible: boolean;
}

export interface AssetCommentWithUser extends AssetComment {
  readonly user: Pick<User, 'id' | 'fullName' | 'avatarUrl' | 'role'>;
  readonly replies?: AssetCommentWithUser[];
}

export interface CreateAssetCommentDto {
  readonly assetId: string;
  readonly userId: string;
  readonly parentId?: string;
  readonly content: string;
}

// =============================================
// API RESPONSE TYPES
// =============================================

export interface ApiResponse<T> {
  readonly data: T;
  readonly success: boolean;
  readonly message?: string;
  readonly error?: string;
}

export interface PaginatedResponse<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface PaginationParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
}

// =============================================
// AUTH MODELS
// =============================================

export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
}

export interface AuthSession {
  readonly user: User;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
}

export interface GoogleAuthPayload {
  readonly idToken: string;
}

// =============================================
// DASHBOARD STATS
// =============================================

export interface TeacherDashboardStats {
  readonly totalStudents: number;
  readonly totalSubjects: number;
  readonly totalExams: number;
  readonly activeExams: number;
  readonly totalSubmissions: number;
  readonly averageStudentScore: number;
}

export interface StudentDashboardStats {
  readonly enrolledSubjects: number;
  readonly totalExamsTaken: number;
  readonly averageScore: number;
  readonly pendingExams: number;
}

export interface SuperAdminDashboardStats {
  readonly totalTeachers: number;
  readonly pendingTeachers: number;
  readonly activeTeachers: number;
  readonly disabledTeachers: number;
  readonly totalStudents: number;
  readonly totalExams: number;
}
