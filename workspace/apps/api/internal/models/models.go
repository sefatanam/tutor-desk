package models

import (
	"encoding/json"
	"time"
)

// =============================================
// USER
// =============================================

type User struct {
	ID             string     `json:"id"`
	Email          string     `json:"email"`
	PasswordHash   *string    `json:"-"`
	FullName       string     `json:"full_name"`
	AvatarURL      *string    `json:"avatar_url"`
	Role           string     `json:"role"`
	Status         string     `json:"status"`
	Phone          *string    `json:"phone"`
	AuthProvider   string     `json:"auth_provider"`
	AuthProviderID *string    `json:"auth_provider_id"`
	LastLoginAt    *time.Time `json:"last_login_at"`
	CreatedBy      *string    `json:"created_by"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type CreateUserRequest struct {
	Email    string  `json:"email"`
	FullName string  `json:"full_name"`
	Role     string  `json:"role"`
	Phone    *string `json:"phone"`
}

type UpdateUserRequest struct {
	FullName  *string `json:"full_name"`
	AvatarURL *string `json:"avatar_url"`
	Phone     *string `json:"phone"`
}

type UpdateUserStatusRequest struct {
	Status string `json:"status"`
}

// =============================================
// TEACHER
// =============================================

type Teacher struct {
	ID                         string     `json:"id"`
	UserID                     string     `json:"user_id"`
	Qualification              *string    `json:"qualification"`
	Specialization             *string    `json:"specialization"`
	Bio                        *string    `json:"bio"`
	AllowStudentComments       bool       `json:"allow_student_comments"`
	ShowExamResultsImmediately bool       `json:"show_exam_results_immediately"`
	TotalStudents              int        `json:"total_students"`
	TotalSubjects              int        `json:"total_subjects"`
	TotalExams                 int        `json:"total_exams"`
	ApprovedAt                 *time.Time `json:"approved_at"`
	ApprovedBy                 *string    `json:"approved_by"`
	CreatedAt                  time.Time  `json:"created_at"`
	UpdatedAt                  time.Time  `json:"updated_at"`
}

type TeacherWithUser struct {
	Teacher
	User User `json:"user"`
}

type UpdateTeacherRequest struct {
	Qualification              *string `json:"qualification"`
	Specialization             *string `json:"specialization"`
	Bio                        *string `json:"bio"`
	AllowStudentComments       *bool   `json:"allow_student_comments"`
	ShowExamResultsImmediately *bool   `json:"show_exam_results_immediately"`
}

type TeacherDashboardStats struct {
	TotalStudents       int     `json:"total_students"`
	TotalSubjects       int     `json:"total_subjects"`
	TotalExams          int     `json:"total_exams"`
	ActiveExams         int     `json:"active_exams"`
	TotalSubmissions    int     `json:"total_submissions"`
	AverageStudentScore float64 `json:"average_student_score"`
}

// =============================================
// STUDENT
// =============================================

type Student struct {
	ID              string     `json:"id"`
	UserID          string     `json:"user_id"`
	TeacherID       string     `json:"teacher_id"`
	RollNumber      *string    `json:"roll_number"`
	ClassName       *string    `json:"class_name"`
	Section         *string    `json:"section"`
	GuardianName    *string    `json:"guardian_name"`
	GuardianPhone   *string    `json:"guardian_phone"`
	Address         *string    `json:"address"`
	DateOfBirth     *time.Time `json:"date_of_birth"`
	TotalExamsTaken int        `json:"total_exams_taken"`
	AverageScore    float64    `json:"average_score"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type StudentWithUser struct {
	Student
	User User `json:"user"`
}

type UpdateStudentRequest struct {
	RollNumber    *string    `json:"roll_number"`
	ClassName     *string    `json:"class_name"`
	Section       *string    `json:"section"`
	GuardianName  *string    `json:"guardian_name"`
	GuardianPhone *string    `json:"guardian_phone"`
	Address       *string    `json:"address"`
	DateOfBirth   *time.Time `json:"date_of_birth"`
}

type StudentDashboardStats struct {
	EnrolledSubjects int     `json:"enrolled_subjects"`
	TotalExamsTaken  int     `json:"total_exams_taken"`
	AverageScore     float64 `json:"average_score"`
	PendingExams     int     `json:"pending_exams"`
}

// =============================================
// SUBJECT
// =============================================

type Subject struct {
	ID            string    `json:"id"`
	TeacherID     string    `json:"teacher_id"`
	Name          string    `json:"name"`
	Description   *string   `json:"description"`
	Code          *string   `json:"code"`
	Color         string    `json:"color"`
	Icon          string    `json:"icon"`
	IsActive      bool      `json:"is_active"`
	TotalStudents int       `json:"total_students"`
	TotalExams    int       `json:"total_exams"`
	TotalAssets   int       `json:"total_assets"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type CreateSubjectRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Code        *string `json:"code"`
	Color       *string `json:"color"`
	Icon        *string `json:"icon"`
}

type UpdateSubjectRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Code        *string `json:"code"`
	Color       *string `json:"color"`
	Icon        *string `json:"icon"`
	IsActive    *bool   `json:"is_active"`
}

type SubjectEnrollment struct {
	ID         string    `json:"id"`
	StudentID  string    `json:"student_id"`
	SubjectID  string    `json:"subject_id"`
	EnrolledAt time.Time `json:"enrolled_at"`
	EnrolledBy *string   `json:"enrolled_by"`
}

type EnrollStudentRequest struct {
	StudentID string `json:"student_id"`
}

// =============================================
// EXAM
// =============================================

type Exam struct {
	ID                     string     `json:"id"`
	SubjectID              *string    `json:"subject_id"`
	TeacherID              string     `json:"teacher_id"`
	Title                  string     `json:"title"`
	Description            *string    `json:"description"`
	Instructions           *string    `json:"instructions"`
	Status                 string     `json:"status"`
	TotalQuestions         int        `json:"total_questions"`
	TotalMarks             int        `json:"total_marks"`
	PassingMarks           int        `json:"passing_marks"`
	TimePerQuestionSeconds int        `json:"time_per_question_seconds"`
	AllowSkipReturn        bool       `json:"allow_skip_return"`
	FullscreenRequired     bool       `json:"fullscreen_required"`
	AutoSubmitOnBlur       bool       `json:"auto_submit_on_blur"`
	AllowRetake            bool       `json:"allow_retake"`
	MaxRetakes             int        `json:"max_retakes"`
	ScheduledStart         *time.Time `json:"scheduled_start"`
	ScheduledEnd           *time.Time `json:"scheduled_end"`
	DurationMinutes        *int       `json:"duration_minutes"`
	// Result visibility
	ResultVisibility   string     `json:"result_visibility"`
	ResultReleaseDate  *time.Time `json:"result_release_date"`
	IsResultReleased   bool       `json:"is_result_released"`
	ShowScore          bool       `json:"show_score"`
	ShowPercentage     bool       `json:"show_percentage"`
	ShowPassFail       bool       `json:"show_pass_fail"`
	ShowCorrectAnswers bool       `json:"show_correct_answers"`
	ShowStudentAnswers bool       `json:"show_student_answers"`
	ShowExplanations   bool       `json:"show_explanations"`
	ShowQuestionReview bool       `json:"show_question_review"`
	ShowTimeSpent      bool       `json:"show_time_spent"`
	ShowTeacherRemarks bool       `json:"show_teacher_remarks"`
	ShowRank           bool       `json:"show_rank"`
	// Exam style
	ExamStyle             string `json:"exam_style"`
	TotalTimeLimitMinutes *int   `json:"total_time_limit_minutes"`
	ShowImmediateFeedback bool   `json:"show_immediate_feedback"`
	ShuffleQuestions      bool   `json:"shuffle_questions"`
	ShuffleOptions        bool   `json:"shuffle_options"`
	// Stats
	TotalSubmissions int        `json:"total_submissions"`
	AverageScore     float64    `json:"average_score"`
	PublishedAt      *time.Time `json:"published_at"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type ExamWithSubject struct {
	Exam
	Subject *Subject `json:"subject"`
}

type CreateExamRequest struct {
	SubjectID              *string    `json:"subject_id"`
	Title                  string     `json:"title"`
	Description            *string    `json:"description"`
	Instructions           *string    `json:"instructions"`
	PassingMarks           *int       `json:"passing_marks"`
	TimePerQuestionSeconds *int       `json:"time_per_question_seconds"`
	AllowSkipReturn        *bool      `json:"allow_skip_return"`
	FullscreenRequired     *bool      `json:"fullscreen_required"`
	AutoSubmitOnBlur       *bool      `json:"auto_submit_on_blur"`
	AllowRetake            *bool      `json:"allow_retake"`
	MaxRetakes             *int       `json:"max_retakes"`
	ScheduledStart         *time.Time `json:"scheduled_start"`
	ScheduledEnd           *time.Time `json:"scheduled_end"`
	DurationMinutes        *int       `json:"duration_minutes"`
	ResultVisibility       *string    `json:"result_visibility"`
	ResultReleaseDate      *time.Time `json:"result_release_date"`
	ShowScore              *bool      `json:"show_score"`
	ShowPercentage         *bool      `json:"show_percentage"`
	ShowPassFail           *bool      `json:"show_pass_fail"`
	ShowCorrectAnswers     *bool      `json:"show_correct_answers"`
	ShowStudentAnswers     *bool      `json:"show_student_answers"`
	ShowExplanations       *bool      `json:"show_explanations"`
	ShowQuestionReview     *bool      `json:"show_question_review"`
	ShowTimeSpent          *bool      `json:"show_time_spent"`
	ShowTeacherRemarks     *bool      `json:"show_teacher_remarks"`
	ShowRank               *bool      `json:"show_rank"`
	ExamStyle              *string    `json:"exam_style"`
	TotalTimeLimitMinutes  *int       `json:"total_time_limit_minutes"`
	ShowImmediateFeedback  *bool      `json:"show_immediate_feedback"`
	ShuffleQuestions       *bool      `json:"shuffle_questions"`
	ShuffleOptions         *bool      `json:"shuffle_options"`
}

type UpdateExamRequest struct {
	SubjectID              *string    `json:"subject_id"`
	Title                  *string    `json:"title"`
	Description            *string    `json:"description"`
	Instructions           *string    `json:"instructions"`
	Status                 *string    `json:"status"`
	PassingMarks           *int       `json:"passing_marks"`
	TimePerQuestionSeconds *int       `json:"time_per_question_seconds"`
	AllowSkipReturn        *bool      `json:"allow_skip_return"`
	FullscreenRequired     *bool      `json:"fullscreen_required"`
	AutoSubmitOnBlur       *bool      `json:"auto_submit_on_blur"`
	AllowRetake            *bool      `json:"allow_retake"`
	MaxRetakes             *int       `json:"max_retakes"`
	ScheduledStart         *time.Time `json:"scheduled_start"`
	ScheduledEnd           *time.Time `json:"scheduled_end"`
	DurationMinutes        *int       `json:"duration_minutes"`
	ResultVisibility       *string    `json:"result_visibility"`
	ResultReleaseDate      *time.Time `json:"result_release_date"`
	IsResultReleased       *bool      `json:"is_result_released"`
	ShowScore              *bool      `json:"show_score"`
	ShowPercentage         *bool      `json:"show_percentage"`
	ShowPassFail           *bool      `json:"show_pass_fail"`
	ShowCorrectAnswers     *bool      `json:"show_correct_answers"`
	ShowStudentAnswers     *bool      `json:"show_student_answers"`
	ShowExplanations       *bool      `json:"show_explanations"`
	ShowQuestionReview     *bool      `json:"show_question_review"`
	ShowTimeSpent          *bool      `json:"show_time_spent"`
	ShowTeacherRemarks     *bool      `json:"show_teacher_remarks"`
	ShowRank               *bool      `json:"show_rank"`
	ExamStyle              *string    `json:"exam_style"`
	TotalTimeLimitMinutes  *int       `json:"total_time_limit_minutes"`
	ShowImmediateFeedback  *bool      `json:"show_immediate_feedback"`
	ShuffleQuestions       *bool      `json:"shuffle_questions"`
	ShuffleOptions         *bool      `json:"shuffle_options"`
}

// =============================================
// EXAM ASSIGNMENTS
// =============================================

type ExamAssignment struct {
	ID               string     `json:"id"`
	ExamID           string     `json:"exam_id"`
	StudentID        string     `json:"student_id"`
	AssignedBy       string     `json:"assigned_by"`
	AssignedAt       time.Time  `json:"assigned_at"`
	AvailableFrom    *time.Time `json:"available_from"`
	DueDate          *time.Time `json:"due_date"`
	Status           string     `json:"status"`
	StartedAt        *time.Time `json:"started_at"`
	CompletedAt      *time.Time `json:"completed_at"`
	MaxAttempts      int        `json:"max_attempts"`
	TimeLimitMinutes *int       `json:"time_limit_minutes"`
	Notes            *string    `json:"notes"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type CreateExamAssignmentRequest struct {
	StudentID        string     `json:"student_id"`
	AvailableFrom    *time.Time `json:"available_from"`
	DueDate          *time.Time `json:"due_date"`
	MaxAttempts      *int       `json:"max_attempts"`
	TimeLimitMinutes *int       `json:"time_limit_minutes"`
	Notes            *string    `json:"notes"`
}

type ExamSubjectAssignment struct {
	ID                 string     `json:"id"`
	ExamID             string     `json:"exam_id"`
	SubjectID          string     `json:"subject_id"`
	AssignedBy         string     `json:"assigned_by"`
	AssignedAt         time.Time  `json:"assigned_at"`
	AvailableFrom      *time.Time `json:"available_from"`
	DueDate            *time.Time `json:"due_date"`
	AutoAssignStudents bool       `json:"auto_assign_students"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type CreateExamSubjectAssignmentRequest struct {
	SubjectID          string     `json:"subject_id"`
	AvailableFrom      *time.Time `json:"available_from"`
	DueDate            *time.Time `json:"due_date"`
	AutoAssignStudents *bool      `json:"auto_assign_students"`
}

// =============================================
// QUESTION
// =============================================

// QuestionOption represents a single MCQ answer option
type QuestionOption struct {
	ID       string  `json:"id"`
	Text     string  `json:"text"`
	ImageURL *string `json:"image_url,omitempty"`
}

type Question struct {
	ID               string           `json:"id"`
	ExamID           string           `json:"exam_id"`
	QuestionText     string           `json:"question_text"`
	QuestionImageURL *string          `json:"question_image_url"`
	Options          []QuestionOption `json:"options"`
	CorrectOptionID  string           `json:"correct_option_id"`
	Marks            int              `json:"marks"`
	NegativeMarks    float64          `json:"negative_marks"`
	TimeLimitSeconds *int             `json:"time_limit_seconds"`
	SequenceNumber   int              `json:"sequence_number"`
	Explanation      *string          `json:"explanation"`
	CreatedAt        time.Time        `json:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at"`
}

// OptionsJSON is a helper for scanning JSONB options from DB
type OptionsJSON []QuestionOption

func (o *OptionsJSON) Scan(val interface{}) error {
	var b []byte
	switch v := val.(type) {
	case []byte:
		b = v
	case string:
		b = []byte(v)
	default:
		return nil
	}
	return json.Unmarshal(b, o)
}

type CreateQuestionRequest struct {
	QuestionText     string           `json:"question_text"`
	QuestionImageURL *string          `json:"question_image_url"`
	Options          []QuestionOption `json:"options"`
	CorrectOptionID  string           `json:"correct_option_id"`
	Marks            *int             `json:"marks"`
	NegativeMarks    *float64         `json:"negative_marks"`
	TimeLimitSeconds *int             `json:"time_limit_seconds"`
	SequenceNumber   int              `json:"sequence_number"`
	Explanation      *string          `json:"explanation"`
}

type UpdateQuestionRequest struct {
	QuestionText     *string          `json:"question_text"`
	QuestionImageURL *string          `json:"question_image_url"`
	Options          []QuestionOption `json:"options"`
	CorrectOptionID  *string          `json:"correct_option_id"`
	Marks            *int             `json:"marks"`
	NegativeMarks    *float64         `json:"negative_marks"`
	TimeLimitSeconds *int             `json:"time_limit_seconds"`
	SequenceNumber   *int             `json:"sequence_number"`
	Explanation      *string          `json:"explanation"`
}

type ReorderQuestionsRequest struct {
	QuestionIDs []string `json:"question_ids"`
}

// =============================================
// SUBMISSION
// =============================================

type ExamSubmission struct {
	ID               string     `json:"id"`
	ExamID           string     `json:"exam_id"`
	StudentID        string     `json:"student_id"`
	Status           string     `json:"status"`
	StartedAt        time.Time  `json:"started_at"`
	SubmittedAt      *time.Time `json:"submitted_at"`
	AutoSubmitReason *string    `json:"auto_submit_reason"`
	TotalAnswered    int        `json:"total_answered"`
	TotalCorrect     int        `json:"total_correct"`
	TotalWrong       int        `json:"total_wrong"`
	TotalSkipped     int        `json:"total_skipped"`
	Score            float64    `json:"score"`
	Percentage       float64    `json:"percentage"`
	AttemptNumber    int        `json:"attempt_number"`
	EvaluatedAt      *time.Time `json:"evaluated_at"`
	EvaluatedBy      *string    `json:"evaluated_by"`
	Remarks          *string    `json:"remarks"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type ExamSubmissionWithDetails struct {
	ExamSubmission
	Exam    Exam               `json:"exam"`
	Answers []SubmissionAnswer `json:"answers"`
}

type StartExamRequest struct {
	ExamID    string `json:"exam_id"`
	StudentID string `json:"student_id"`
}

type SubmitAnswerRequest struct {
	QuestionID           string  `json:"question_id"`
	SelectedOptionID     *string `json:"selected_option_id"`
	TimeSpentSeconds     int     `json:"time_spent_seconds"`
	TimeRemainingSeconds *int    `json:"time_remaining_seconds"`
	WasSkipped           bool    `json:"was_skipped"`
	SequenceAnswered     *int    `json:"sequence_answered"`
}

type UpdateAnswerRequest struct {
	SelectedOptionID     *string `json:"selected_option_id"`
	TimeSpentSeconds     *int    `json:"time_spent_seconds"`
	TimeRemainingSeconds *int    `json:"time_remaining_seconds"`
	WasSkipped           *bool   `json:"was_skipped"`
	ReturnedTo           *bool   `json:"returned_to"`
}

type AutoSubmitRequest struct {
	Reason string `json:"reason"`
}

type EvaluateSubmissionRequest struct {
	Remarks *string `json:"remarks"`
}

type SubmissionAnswer struct {
	ID                   string     `json:"id"`
	SubmissionID         string     `json:"submission_id"`
	QuestionID           string     `json:"question_id"`
	SelectedOptionID     *string    `json:"selected_option_id"`
	IsCorrect            *bool      `json:"is_correct"`
	MarksObtained        float64    `json:"marks_obtained"`
	TimeSpentSeconds     int        `json:"time_spent_seconds"`
	TimeRemainingSeconds *int       `json:"time_remaining_seconds"`
	WasSkipped           bool       `json:"was_skipped"`
	ReturnedTo           bool       `json:"returned_to"`
	AnsweredAt           *time.Time `json:"answered_at"`
	SequenceAnswered     *int       `json:"sequence_answered"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

// =============================================
// ASSET
// =============================================

type Asset struct {
	ID             string    `json:"id"`
	SubjectID      string    `json:"subject_id"`
	TeacherID      string    `json:"teacher_id"`
	Title          string    `json:"title"`
	Description    *string   `json:"description"`
	AssetType      string    `json:"asset_type"`
	FileURL        *string   `json:"file_url"`
	FileName       *string   `json:"file_name"`
	FileSizeBytes  *int64    `json:"file_size_bytes"`
	MimeType       *string   `json:"mime_type"`
	ExternalURL    *string   `json:"external_url"`
	ThumbnailURL   *string   `json:"thumbnail_url"`
	SequenceNumber int       `json:"sequence_number"`
	IsPublished    bool      `json:"is_published"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type CreateAssetRequest struct {
	Title          string  `json:"title"`
	Description    *string `json:"description"`
	AssetType      string  `json:"asset_type"`
	ExternalURL    *string `json:"external_url"`
	SequenceNumber *int    `json:"sequence_number"`
	IsPublished    *bool   `json:"is_published"`
}

type UpdateAssetRequest struct {
	Title          *string `json:"title"`
	Description    *string `json:"description"`
	ExternalURL    *string `json:"external_url"`
	SequenceNumber *int    `json:"sequence_number"`
	IsPublished    *bool   `json:"is_published"`
}

// =============================================
// ASSET COMMENT
// =============================================

type AssetComment struct {
	ID        string    `json:"id"`
	AssetID   string    `json:"asset_id"`
	UserID    string    `json:"user_id"`
	ParentID  *string   `json:"parent_id"`
	Content   string    `json:"content"`
	IsVisible bool      `json:"is_visible"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type AssetCommentWithUser struct {
	AssetComment
	User CommentUser `json:"user"`
}

type CommentUser struct {
	ID        string  `json:"id"`
	FullName  string  `json:"full_name"`
	AvatarURL *string `json:"avatar_url"`
	Role      string  `json:"role"`
}

type CreateCommentRequest struct {
	Content  string  `json:"content"`
	ParentID *string `json:"parent_id"`
}

type UpdateCommentRequest struct {
	Content string `json:"content"`
}

type ToggleVisibilityRequest struct {
	IsVisible bool `json:"is_visible"`
}

// =============================================
// REFRESH TOKEN
// =============================================

type RefreshToken struct {
	ID                string     `json:"id"`
	UserID            string     `json:"user_id"`
	TokenHash         string     `json:"-"`
	DeviceFingerprint *string    `json:"device_fingerprint"`
	UserAgent         *string    `json:"user_agent"`
	IPAddress         *string    `json:"ip_address"`
	ExpiresAt         time.Time  `json:"expires_at"`
	IsRevoked         bool       `json:"is_revoked"`
	RevokedAt         *time.Time `json:"revoked_at"`
	RevokedReason     *string    `json:"revoked_reason"`
	CreatedAt         time.Time  `json:"created_at"`
	LastUsedAt        *time.Time `json:"last_used_at"`
}

// =============================================
// SETTINGS
// =============================================

type SettingsCategory struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Label       string    `json:"label"`
	Icon        string    `json:"icon"`
	Description *string   `json:"description"`
	SortOrder   int       `json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateSettingsCategoryRequest struct {
	Name        string  `json:"name"`
	Label       string  `json:"label"`
	Icon        *string `json:"icon"`
	Description *string `json:"description"`
	SortOrder   *int    `json:"sort_order"`
}

type UpdateSettingsCategoryRequest struct {
	Name        *string `json:"name"`
	Label       *string `json:"label"`
	Icon        *string `json:"icon"`
	Description *string `json:"description"`
	SortOrder   *int    `json:"sort_order"`
}

type SystemSetting struct {
	ID           string          `json:"id"`
	CategoryID   string          `json:"category_id"`
	Key          string          `json:"key"`
	Label        string          `json:"label"`
	Value        *string         `json:"value"`
	ValueType    string          `json:"value_type"`
	Options      json.RawMessage `json:"options"`
	DefaultValue *string         `json:"default_value"`
	Description  *string         `json:"description"`
	IsRequired   bool            `json:"is_required"`
	SortOrder    int             `json:"sort_order"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

type CreateSystemSettingRequest struct {
	CategoryID   string          `json:"category_id"`
	Key          string          `json:"key"`
	Label        string          `json:"label"`
	Value        *string         `json:"value"`
	ValueType    *string         `json:"value_type"`
	Options      json.RawMessage `json:"options"`
	DefaultValue *string         `json:"default_value"`
	Description  *string         `json:"description"`
	IsRequired   *bool           `json:"is_required"`
	SortOrder    *int            `json:"sort_order"`
}

type UpdateSystemSettingRequest struct {
	Label        *string         `json:"label"`
	Value        *string         `json:"value"`
	ValueType    *string         `json:"value_type"`
	Options      json.RawMessage `json:"options"`
	DefaultValue *string         `json:"default_value"`
	Description  *string         `json:"description"`
	IsRequired   *bool           `json:"is_required"`
	SortOrder    *int            `json:"sort_order"`
}

type UpdateSettingValueRequest struct {
	Value *string `json:"value"`
}

// =============================================
// ADMIN / SUPER ADMIN STATS
// =============================================

type SuperAdminDashboardStats struct {
	TotalTeachers    int `json:"total_teachers"`
	PendingTeachers  int `json:"pending_teachers"`
	ActiveTeachers   int `json:"active_teachers"`
	DisabledTeachers int `json:"disabled_teachers"`
	TotalStudents    int `json:"total_students"`
	TotalExams       int `json:"total_exams"`
}

// =============================================
// PAGINATION
// =============================================

type PaginatedResponse[T any] struct {
	Items      []T `json:"items"`
	Total      int `json:"total"`
	Page       int `json:"page"`
	PageSize   int `json:"page_size"`
	TotalPages int `json:"total_pages"`
}

type PaginationParams struct {
	Page     int
	PageSize int
	SortBy   string
	SortDesc bool
}

func NewPaginationParams(page, pageSize int) PaginationParams {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return PaginationParams{Page: page, PageSize: pageSize}
}

func (p PaginationParams) Offset() int {
	return (p.Page - 1) * p.PageSize
}
