package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tutor-desk/api/internal/middleware"
	"github.com/tutor-desk/api/internal/models"
)

// ExamsHandler handles exam CRUD and assignment endpoints.
type ExamsHandler struct {
	db *pgxpool.Pool
}

func NewExamsHandler(db *pgxpool.Pool) *ExamsHandler {
	return &ExamsHandler{db: db}
}

const examSelectCols = `
	e.id, e.subject_id, e.teacher_id, e.title, e.description, e.instructions,
	e.status, e.total_questions, e.total_marks, e.passing_marks,
	e.time_per_question_seconds, e.allow_skip_return, e.fullscreen_required,
	e.auto_submit_on_blur, e.allow_retake, e.max_retakes,
	e.scheduled_start, e.scheduled_end, e.duration_minutes,
	e.result_visibility, e.result_release_date, e.is_result_released,
	e.show_score, e.show_percentage, e.show_pass_fail, e.show_correct_answers,
	e.show_student_answers, e.show_explanations, e.show_question_review,
	e.show_time_spent, e.show_teacher_remarks, e.show_rank,
	e.exam_style, e.total_time_limit_minutes, e.show_immediate_feedback,
	e.shuffle_questions, e.shuffle_options,
	e.total_submissions, e.average_score, e.published_at, e.created_at, e.updated_at`

// GET /api/v1/exams  [teacher]
func (h *ExamsHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	teacherUserID := middleware.GetUserID(r)
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	p := models.NewPaginationParams(page, pageSize)
	ctx := r.Context()

	var teacherID string
	if err := h.db.QueryRow(ctx, `SELECT id FROM teachers WHERE user_id = $1`, teacherUserID).Scan(&teacherID); err != nil {
		middleware.WriteError(w, http.StatusNotFound, "teacher profile not found")
		return
	}

	var total int
	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM exams e WHERE e.teacher_id = $1`, teacherID).Scan(&total)

	rows, err := h.db.Query(ctx,
		`SELECT `+examSelectCols+`,
		        s.id, s.teacher_id, s.name, s.description, s.code, s.color, s.icon, s.is_active,
		        s.total_students, s.total_exams, s.total_assets, s.created_at, s.updated_at
		 FROM exams e LEFT JOIN subjects s ON s.id = e.subject_id
		 WHERE e.teacher_id = $1 ORDER BY e.created_at DESC LIMIT $2 OFFSET $3`,
		teacherID, p.PageSize, p.Offset())
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch exams")
		return
	}
	defer rows.Close()

	items := scanExamsWithSubject(rows)
	totalPages := (total + p.PageSize - 1) / p.PageSize
	middleware.WriteJSON(w, http.StatusOK, models.PaginatedResponse[models.ExamWithSubject]{
		Items: items, Total: total, Page: p.Page, PageSize: p.PageSize, TotalPages: totalPages,
	})
}

// GET /api/v1/exams/upcoming  [student]
func (h *ExamsHandler) GetUpcoming(w http.ResponseWriter, r *http.Request) {
	studentUserID := middleware.GetUserID(r)
	ctx := r.Context()

	var studentID string
	if err := h.db.QueryRow(ctx, `SELECT id FROM students WHERE user_id = $1`, studentUserID).Scan(&studentID); err != nil {
		middleware.WriteError(w, http.StatusNotFound, "student profile not found")
		return
	}

	rows, err := h.db.Query(ctx,
		`SELECT `+examSelectCols+`,
		        s.id, s.teacher_id, s.name, s.description, s.code, s.color, s.icon, s.is_active,
		        s.total_students, s.total_exams, s.total_assets, s.created_at, s.updated_at
		 FROM exams e
		 LEFT JOIN subjects s ON s.id = e.subject_id
		 WHERE e.status = 'active'
		   AND (e.scheduled_end IS NULL OR e.scheduled_end >= NOW())
		   AND e.subject_id IN (
		       SELECT subject_id FROM subject_enrollments WHERE student_id = $1
		   )
		 ORDER BY e.created_at DESC LIMIT 100`, studentID)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch exams")
		return
	}
	defer rows.Close()
	middleware.WriteJSON(w, http.StatusOK, scanExamsWithSubject(rows))
}

// GET /api/v1/exams/{id}
func (h *ExamsHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ctx := r.Context()
	row := h.db.QueryRow(ctx,
		`SELECT `+examSelectCols+`,
		        s.id, s.teacher_id, s.name, s.description, s.code, s.color, s.icon, s.is_active,
		        s.total_students, s.total_exams, s.total_assets, s.created_at, s.updated_at
		 FROM exams e LEFT JOIN subjects s ON s.id = e.subject_id
		 WHERE e.id = $1`, id)

	e, err := scanExamWithSubjectRow(row)
	if err != nil {
		middleware.WriteError(w, http.StatusNotFound, "exam not found")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, e)
}

// POST /api/v1/exams  [teacher]
func (h *ExamsHandler) Create(w http.ResponseWriter, r *http.Request) {
	teacherUserID := middleware.GetUserID(r)
	var req models.CreateExamRequest
	if err := middleware.DecodeBody(r, &req); err != nil || req.Title == "" {
		middleware.WriteError(w, http.StatusBadRequest, "title is required")
		return
	}

	ctx := r.Context()
	var teacherID string
	if err := h.db.QueryRow(ctx, `SELECT id FROM teachers WHERE user_id = $1`, teacherUserID).Scan(&teacherID); err != nil {
		middleware.WriteError(w, http.StatusNotFound, "teacher profile not found")
		return
	}

	defaults := func(v *bool, d bool) bool {
		if v == nil {
			return d
		}
		return *v
	}
	defaultInt := func(v *int, d int) int {
		if v == nil {
			return d
		}
		return *v
	}
	defaultStr := func(v *string, d string) string {
		if v == nil {
			return d
		}
		return *v
	}

	var examID string
	err := h.db.QueryRow(ctx,
		`INSERT INTO exams (
		   subject_id, teacher_id, title, description, instructions,
		   passing_marks, time_per_question_seconds, allow_skip_return,
		   fullscreen_required, auto_submit_on_blur, allow_retake, max_retakes,
		   scheduled_start, scheduled_end, duration_minutes,
		   result_visibility, result_release_date, show_score, show_percentage,
		   show_pass_fail, show_correct_answers, show_student_answers,
		   show_explanations, show_question_review, show_time_spent,
		   show_teacher_remarks, show_rank,
		   exam_style, total_time_limit_minutes, show_immediate_feedback,
		   shuffle_questions, shuffle_options
		 ) VALUES (
		   $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
		   $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
		 ) RETURNING id`,
		req.SubjectID, teacherID, req.Title, req.Description, req.Instructions,
		defaultInt(req.PassingMarks, 0), defaultInt(req.TimePerQuestionSeconds, 60),
		defaults(req.AllowSkipReturn, true), defaults(req.FullscreenRequired, true),
		defaults(req.AutoSubmitOnBlur, true), defaults(req.AllowRetake, false),
		defaultInt(req.MaxRetakes, 0),
		req.ScheduledStart, req.ScheduledEnd, req.DurationMinutes,
		defaultStr(req.ResultVisibility, "immediate"), req.ResultReleaseDate,
		defaults(req.ShowScore, true), defaults(req.ShowPercentage, true),
		defaults(req.ShowPassFail, true), defaults(req.ShowCorrectAnswers, true),
		defaults(req.ShowStudentAnswers, true), defaults(req.ShowExplanations, true),
		defaults(req.ShowQuestionReview, true), defaults(req.ShowTimeSpent, true),
		defaults(req.ShowTeacherRemarks, true), defaults(req.ShowRank, false),
		defaultStr(req.ExamStyle, "standard"), req.TotalTimeLimitMinutes,
		defaults(req.ShowImmediateFeedback, false), defaults(req.ShuffleQuestions, false),
		defaults(req.ShuffleOptions, false),
	).Scan(&examID)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to create exam")
		return
	}

	// Use GetByID to return full response
	r2 := r.Clone(r.Context())
	// Inject examID via PathValue workaround — we call db directly
	ctx2 := r.Context()
	row := h.db.QueryRow(ctx2,
		`SELECT `+examSelectCols+`,
		        s.id, s.teacher_id, s.name, s.description, s.code, s.color, s.icon, s.is_active,
		        s.total_students, s.total_exams, s.total_assets, s.created_at, s.updated_at
		 FROM exams e LEFT JOIN subjects s ON s.id = e.subject_id
		 WHERE e.id = $1`, examID)
	e, err := scanExamWithSubjectRow(row)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "created but failed to fetch")
		return
	}
	_ = r2
	middleware.WriteJSON(w, http.StatusCreated, e)
}

// PATCH /api/v1/exams/{id}  [teacher]
func (h *ExamsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req models.UpdateExamRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	_, err := h.db.Exec(ctx,
		`UPDATE exams SET
		   subject_id              = COALESCE($2,  subject_id),
		   title                   = COALESCE($3,  title),
		   description             = COALESCE($4,  description),
		   instructions            = COALESCE($5,  instructions),
		   status                  = COALESCE($6,  status),
		   passing_marks           = COALESCE($7,  passing_marks),
		   time_per_question_seconds = COALESCE($8, time_per_question_seconds),
		   allow_skip_return       = COALESCE($9,  allow_skip_return),
		   fullscreen_required     = COALESCE($10, fullscreen_required),
		   auto_submit_on_blur     = COALESCE($11, auto_submit_on_blur),
		   allow_retake            = COALESCE($12, allow_retake),
		   max_retakes             = COALESCE($13, max_retakes),
		   scheduled_start         = COALESCE($14, scheduled_start),
		   scheduled_end           = COALESCE($15, scheduled_end),
		   duration_minutes        = COALESCE($16, duration_minutes),
		   result_visibility       = COALESCE($17, result_visibility),
		   result_release_date     = COALESCE($18, result_release_date),
		   is_result_released      = COALESCE($19, is_result_released),
		   show_score              = COALESCE($20, show_score),
		   show_percentage         = COALESCE($21, show_percentage),
		   show_pass_fail          = COALESCE($22, show_pass_fail),
		   show_correct_answers    = COALESCE($23, show_correct_answers),
		   show_student_answers    = COALESCE($24, show_student_answers),
		   show_explanations       = COALESCE($25, show_explanations),
		   show_question_review    = COALESCE($26, show_question_review),
		   show_time_spent         = COALESCE($27, show_time_spent),
		   show_teacher_remarks    = COALESCE($28, show_teacher_remarks),
		   show_rank               = COALESCE($29, show_rank),
		   exam_style              = COALESCE($30, exam_style),
		   total_time_limit_minutes= COALESCE($31, total_time_limit_minutes),
		   show_immediate_feedback = COALESCE($32, show_immediate_feedback),
		   shuffle_questions       = COALESCE($33, shuffle_questions),
		   shuffle_options         = COALESCE($34, shuffle_options),
		   updated_at              = NOW()
		 WHERE id = $1`,
		id, req.SubjectID, req.Title, req.Description, req.Instructions,
		req.Status, req.PassingMarks, req.TimePerQuestionSeconds,
		req.AllowSkipReturn, req.FullscreenRequired, req.AutoSubmitOnBlur,
		req.AllowRetake, req.MaxRetakes, req.ScheduledStart, req.ScheduledEnd,
		req.DurationMinutes, req.ResultVisibility, req.ResultReleaseDate,
		req.IsResultReleased, req.ShowScore, req.ShowPercentage, req.ShowPassFail,
		req.ShowCorrectAnswers, req.ShowStudentAnswers, req.ShowExplanations,
		req.ShowQuestionReview, req.ShowTimeSpent, req.ShowTeacherRemarks,
		req.ShowRank, req.ExamStyle, req.TotalTimeLimitMinutes,
		req.ShowImmediateFeedback, req.ShuffleQuestions, req.ShuffleOptions)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to update exam")
		return
	}
	h.GetByID(w, r)
}

// POST /api/v1/exams/{id}/publish  [teacher]
func (h *ExamsHandler) Publish(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	publishedAt := time.Now()
	_, err := h.db.Exec(r.Context(),
		`UPDATE exams SET status = 'active', published_at = $2, updated_at = NOW() WHERE id = $1`,
		id, publishedAt)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to publish exam")
		return
	}
	h.GetByID(w, r)
}

// POST /api/v1/exams/{id}/cancel  [teacher]
func (h *ExamsHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	_, err := h.db.Exec(r.Context(),
		`UPDATE exams SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to cancel exam")
		return
	}
	h.GetByID(w, r)
}

// DELETE /api/v1/exams/{id}  [teacher]
func (h *ExamsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	_, err := h.db.Exec(r.Context(), `DELETE FROM exams WHERE id = $1`, id)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to delete exam")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/exams/{id}/assignments
func (h *ExamsHandler) GetAssignments(w http.ResponseWriter, r *http.Request) {
	examID := r.PathValue("id")
	ctx := r.Context()
	rows, err := h.db.Query(ctx,
		`SELECT id, exam_id, student_id, assigned_by, assigned_at, available_from,
		        due_date, status, started_at, completed_at, max_attempts,
		        time_limit_minutes, notes, created_at, updated_at
		 FROM exam_assignments WHERE exam_id = $1 ORDER BY assigned_at DESC`, examID)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch assignments")
		return
	}
	defer rows.Close()

	items := make([]models.ExamAssignment, 0)
	for rows.Next() {
		var a models.ExamAssignment
		if err := rows.Scan(&a.ID, &a.ExamID, &a.StudentID, &a.AssignedBy, &a.AssignedAt,
			&a.AvailableFrom, &a.DueDate, &a.Status, &a.StartedAt, &a.CompletedAt,
			&a.MaxAttempts, &a.TimeLimitMinutes, &a.Notes, &a.CreatedAt, &a.UpdatedAt); err == nil {
			items = append(items, a)
		}
	}
	middleware.WriteJSON(w, http.StatusOK, items)
}

// POST /api/v1/exams/{id}/assign-student  [teacher]
func (h *ExamsHandler) AssignStudent(w http.ResponseWriter, r *http.Request) {
	examID := r.PathValue("id")
	callerID := middleware.GetUserID(r)

	var req models.CreateExamAssignmentRequest
	if err := middleware.DecodeBody(r, &req); err != nil || req.StudentID == "" {
		middleware.WriteError(w, http.StatusBadRequest, "student_id required")
		return
	}

	ctx := r.Context()
	var teacherID string
	if err := h.db.QueryRow(ctx, `SELECT id FROM teachers WHERE user_id = $1`, callerID).Scan(&teacherID); err != nil {
		middleware.WriteError(w, http.StatusNotFound, "teacher profile not found")
		return
	}

	maxAttempts := 1
	if req.MaxAttempts != nil {
		maxAttempts = *req.MaxAttempts
	}

	var a models.ExamAssignment
	err := h.db.QueryRow(ctx,
		`INSERT INTO exam_assignments (exam_id, student_id, assigned_by, available_from, due_date, max_attempts, time_limit_minutes, notes)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id, exam_id, student_id, assigned_by, assigned_at, available_from,
		           due_date, status, started_at, completed_at, max_attempts,
		           time_limit_minutes, notes, created_at, updated_at`,
		examID, req.StudentID, teacherID, req.AvailableFrom, req.DueDate,
		maxAttempts, req.TimeLimitMinutes, req.Notes).
		Scan(&a.ID, &a.ExamID, &a.StudentID, &a.AssignedBy, &a.AssignedAt,
			&a.AvailableFrom, &a.DueDate, &a.Status, &a.StartedAt, &a.CompletedAt,
			&a.MaxAttempts, &a.TimeLimitMinutes, &a.Notes, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to assign exam to student")
		return
	}
	middleware.WriteJSON(w, http.StatusCreated, a)
}

// POST /api/v1/exams/{id}/assign-subject  [teacher]
func (h *ExamsHandler) AssignSubject(w http.ResponseWriter, r *http.Request) {
	examID := r.PathValue("id")
	callerID := middleware.GetUserID(r)

	var req models.CreateExamSubjectAssignmentRequest
	if err := middleware.DecodeBody(r, &req); err != nil || req.SubjectID == "" {
		middleware.WriteError(w, http.StatusBadRequest, "subject_id required")
		return
	}

	ctx := r.Context()
	var teacherID string
	if err := h.db.QueryRow(ctx, `SELECT id FROM teachers WHERE user_id = $1`, callerID).Scan(&teacherID); err != nil {
		middleware.WriteError(w, http.StatusNotFound, "teacher profile not found")
		return
	}

	autoAssign := true
	if req.AutoAssignStudents != nil {
		autoAssign = *req.AutoAssignStudents
	}

	var a models.ExamSubjectAssignment
	err := h.db.QueryRow(ctx,
		`INSERT INTO exam_subject_assignments (exam_id, subject_id, assigned_by, available_from, due_date, auto_assign_students)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, exam_id, subject_id, assigned_by, assigned_at, available_from, due_date, auto_assign_students, created_at, updated_at`,
		examID, req.SubjectID, teacherID, req.AvailableFrom, req.DueDate, autoAssign).
		Scan(&a.ID, &a.ExamID, &a.SubjectID, &a.AssignedBy, &a.AssignedAt,
			&a.AvailableFrom, &a.DueDate, &a.AutoAssignStudents, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to assign exam to subject")
		return
	}
	middleware.WriteJSON(w, http.StatusCreated, a)
}

// DELETE /api/v1/assignments/{id}
func (h *ExamsHandler) DeleteAssignment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	_, _ = h.db.Exec(r.Context(), `DELETE FROM exam_assignments WHERE id = $1`, id)
	w.WriteHeader(http.StatusNoContent)
}

// =============================================
// SCAN HELPERS
// =============================================

type scannable interface {
	Scan(dest ...any) error
}

func scanExamCols(row scannable) (models.Exam, *models.Subject, error) {
	var e models.Exam
	var sub models.Subject
	var subID, subTeacherID, subName *string
	var subDesc, subCode, subColor, subIcon *string
	var subIsActive *bool
	var subTotalStudents, subTotalExams, subTotalAssets *int
	var subCreatedAt, subUpdatedAt *time.Time

	err := row.Scan(
		&e.ID, &e.SubjectID, &e.TeacherID, &e.Title, &e.Description, &e.Instructions,
		&e.Status, &e.TotalQuestions, &e.TotalMarks, &e.PassingMarks,
		&e.TimePerQuestionSeconds, &e.AllowSkipReturn, &e.FullscreenRequired,
		&e.AutoSubmitOnBlur, &e.AllowRetake, &e.MaxRetakes,
		&e.ScheduledStart, &e.ScheduledEnd, &e.DurationMinutes,
		&e.ResultVisibility, &e.ResultReleaseDate, &e.IsResultReleased,
		&e.ShowScore, &e.ShowPercentage, &e.ShowPassFail, &e.ShowCorrectAnswers,
		&e.ShowStudentAnswers, &e.ShowExplanations, &e.ShowQuestionReview,
		&e.ShowTimeSpent, &e.ShowTeacherRemarks, &e.ShowRank,
		&e.ExamStyle, &e.TotalTimeLimitMinutes, &e.ShowImmediateFeedback,
		&e.ShuffleQuestions, &e.ShuffleOptions,
		&e.TotalSubmissions, &e.AverageScore, &e.PublishedAt, &e.CreatedAt, &e.UpdatedAt,
		// Subject (nullable LEFT JOIN)
		&subID, &subTeacherID, &subName, &subDesc, &subCode, &subColor, &subIcon, &subIsActive,
		&subTotalStudents, &subTotalExams, &subTotalAssets, &subCreatedAt, &subUpdatedAt,
	)
	if err != nil {
		return e, nil, err
	}

	if subID != nil {
		sub.ID = *subID
		sub.TeacherID = strOrEmpty(subTeacherID)
		sub.Name = strOrEmpty(subName)
		sub.Description = subDesc
		sub.Code = subCode
		sub.Color = strOrEmpty(subColor)
		sub.Icon = strOrEmpty(subIcon)
		sub.IsActive = boolOrTrue(subIsActive)
		sub.TotalStudents = intOrZero(subTotalStudents)
		sub.TotalExams = intOrZero(subTotalExams)
		sub.TotalAssets = intOrZero(subTotalAssets)
		if subCreatedAt != nil {
			sub.CreatedAt = *subCreatedAt
		}
		if subUpdatedAt != nil {
			sub.UpdatedAt = *subUpdatedAt
		}
		return e, &sub, nil
	}
	return e, nil, nil
}

func scanExamWithSubjectRow(row scannable) (*models.ExamWithSubject, error) {
	e, sub, err := scanExamCols(row)
	if err != nil {
		return nil, err
	}
	return &models.ExamWithSubject{Exam: e, Subject: sub}, nil
}

func scanExamsWithSubject(rows interface {
	Next() bool
	Scan(dest ...any) error
	Close()
}) []models.ExamWithSubject {
	items := make([]models.ExamWithSubject, 0)
	for rows.Next() {
		e, sub, err := scanExamCols(rows)
		if err == nil {
			items = append(items, models.ExamWithSubject{Exam: e, Subject: sub})
		}
	}
	return items
}

func strOrEmpty(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
func boolOrTrue(b *bool) bool {
	if b == nil {
		return true
	}
	return *b
}
func intOrZero(i *int) int {
	if i == nil {
		return 0
	}
	return *i
}
