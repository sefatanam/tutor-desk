package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tutor-desk/api/internal/middleware"
	"github.com/tutor-desk/api/internal/models"
)

// SubmissionsHandler handles the full exam-taking lifecycle.
type SubmissionsHandler struct {
	db *pgxpool.Pool
}

func NewSubmissionsHandler(db *pgxpool.Pool) *SubmissionsHandler {
	return &SubmissionsHandler{db: db}
}

const submissionCols = `
	id, exam_id, student_id, status, started_at, submitted_at, auto_submit_reason,
	total_answered, total_correct, total_wrong, total_skipped,
	score, percentage, attempt_number, evaluated_at, evaluated_by, remarks, created_at, updated_at`

// Start starts a new exam submission (or resumes an in-progress one).
//
//	@Summary		Start exam
//	@Tags			Submissions
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			body	body		models.StartExamRequest		true	"Exam to start"
//	@Success		201		{object}	models.ExamSubmission
//	@Failure		400		{object}	map[string]string
//	@Router			/submissions/start [post]
func (h *SubmissionsHandler) Start(w http.ResponseWriter, r *http.Request) {
	var req models.StartExamRequest
	if err := middleware.DecodeBody(r, &req); err != nil || req.ExamID == "" {
		middleware.WriteError(w, http.StatusBadRequest, "exam_id required")
		return
	}

	ctx := r.Context()
	callerID := middleware.GetUserID(r)

	// Resolve student_id from caller if not provided
	studentID := req.StudentID
	if studentID == "" {
		if err := h.db.QueryRow(ctx, `SELECT id FROM students WHERE user_id = $1`, callerID).Scan(&studentID); err != nil {
			middleware.WriteError(w, http.StatusNotFound, "student profile not found")
			return
		}
	}

	// Check for an existing in-progress submission
	var existingID string
	_ = h.db.QueryRow(ctx,
		`SELECT id FROM exam_submissions WHERE exam_id = $1 AND student_id = $2 AND status = 'in_progress'`,
		req.ExamID, studentID).Scan(&existingID)
	if existingID != "" {
		sub, _ := h.fetchSubmission(ctx, existingID)
		middleware.WriteJSON(w, http.StatusOK, sub)
		return
	}

	// Determine attempt number
	var maxAttempt int
	_ = h.db.QueryRow(ctx,
		`SELECT COALESCE(MAX(attempt_number), 0) FROM exam_submissions WHERE exam_id = $1 AND student_id = $2`,
		req.ExamID, studentID).Scan(&maxAttempt)

	var sub models.ExamSubmission
	err := h.db.QueryRow(ctx,
		`INSERT INTO exam_submissions (exam_id, student_id, attempt_number)
		 VALUES ($1, $2, $3)
		 RETURNING `+submissionCols,
		req.ExamID, studentID, maxAttempt+1).
		Scan(&sub.ID, &sub.ExamID, &sub.StudentID, &sub.Status, &sub.StartedAt, &sub.SubmittedAt,
			&sub.AutoSubmitReason, &sub.TotalAnswered, &sub.TotalCorrect, &sub.TotalWrong,
			&sub.TotalSkipped, &sub.Score, &sub.Percentage, &sub.AttemptNumber,
			&sub.EvaluatedAt, &sub.EvaluatedBy, &sub.Remarks, &sub.CreatedAt, &sub.UpdatedAt)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to start exam")
		return
	}
	middleware.WriteJSON(w, http.StatusCreated, sub)
}

// GetByID returns a submission with its exam and answers.
//
//	@Summary		Get submission by ID
//	@Tags			Submissions
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Submission UUID"
//	@Success		200	{object}	models.ExamSubmissionWithDetails
//	@Failure		404	{object}	map[string]string
//	@Router			/submissions/{id} [get]
func (h *SubmissionsHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	sub, err := h.fetchSubmissionWithDetails(r.Context(), id)
	if err != nil {
		middleware.WriteError(w, http.StatusNotFound, "submission not found")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, sub)
}

// GetByExam returns paginated submissions for an exam.
//
//	@Summary		List submissions for exam
//	@Tags			Submissions
//	@Produce		json
//	@Security		BearerAuth
//	@Param			examId		path		string	true	"Exam UUID"
//	@Param			page		query		int		false	"Page number"
//	@Param			page_size	query		int		false	"Page size"
//	@Success		200		{object}	models.PaginatedResponse[models.ExamSubmission]
//	@Failure		500		{object}	map[string]string
//	@Router			/exams/{examId}/submissions [get]
func (h *SubmissionsHandler) GetByExam(w http.ResponseWriter, r *http.Request) {
	examID := r.PathValue("examId")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	p := models.NewPaginationParams(page, pageSize)
	ctx := r.Context()

	var total int
	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM exam_submissions WHERE exam_id = $1`, examID).Scan(&total)

	rows, err := h.db.Query(ctx,
		`SELECT `+submissionCols+` FROM exam_submissions WHERE exam_id = $1
		 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, examID, p.PageSize, p.Offset())
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch submissions")
		return
	}
	defer rows.Close()

	items := scanSubmissions(rows)
	totalPages := (total + p.PageSize - 1) / p.PageSize
	middleware.WriteJSON(w, http.StatusOK, models.PaginatedResponse[models.ExamSubmission]{
		Items: items, Total: total, Page: p.Page, PageSize: p.PageSize, TotalPages: totalPages,
	})
}

// GetByStudent returns paginated submissions for a student.
//
//	@Summary		List submissions for student
//	@Tags			Submissions
//	@Produce		json
//	@Security		BearerAuth
//	@Param			studentId	path		string	true	"Student UUID"
//	@Param			page		query		int		false	"Page number"
//	@Param			page_size	query		int		false	"Page size"
//	@Success		200		{object}	models.PaginatedResponse[models.ExamSubmission]
//	@Failure		500		{object}	map[string]string
//	@Router			/students/{studentId}/submissions [get]
func (h *SubmissionsHandler) GetByStudent(w http.ResponseWriter, r *http.Request) {
	studentID := r.PathValue("studentId")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	p := models.NewPaginationParams(page, pageSize)
	ctx := r.Context()

	var total int
	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM exam_submissions WHERE student_id = $1`, studentID).Scan(&total)

	rows, err := h.db.Query(ctx,
		`SELECT `+submissionCols+` FROM exam_submissions WHERE student_id = $1
		 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, studentID, p.PageSize, p.Offset())
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch submissions")
		return
	}
	defer rows.Close()

	items := scanSubmissions(rows)
	totalPages := (total + p.PageSize - 1) / p.PageSize
	middleware.WriteJSON(w, http.StatusOK, models.PaginatedResponse[models.ExamSubmission]{
		Items: items, Total: total, Page: p.Page, PageSize: p.PageSize, TotalPages: totalPages,
	})
}

// SubmitAnswer records or updates an answer for a question in a submission.
//
//	@Summary		Submit answer
//	@Tags			Submissions
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string						true	"Submission UUID"
//	@Param			body	body		models.SubmitAnswerRequest	true	"Answer details"
//	@Success		200		{object}	models.SubmissionAnswer
//	@Failure		400		{object}	map[string]string
//	@Router			/submissions/{id}/answer [post]
func (h *SubmissionsHandler) SubmitAnswer(w http.ResponseWriter, r *http.Request) {
	submissionID := r.PathValue("id")
	var req models.SubmitAnswerRequest
	if err := middleware.DecodeBody(r, &req); err != nil || req.QuestionID == "" {
		middleware.WriteError(w, http.StatusBadRequest, "question_id required")
		return
	}

	ctx := r.Context()

	// Fetch correct answer for auto-evaluation
	var correctOptionID string
	var marks float64
	var negativeMarks float64
	_ = h.db.QueryRow(ctx,
		`SELECT correct_option_id, marks, negative_marks FROM questions WHERE id = $1`,
		req.QuestionID).Scan(&correctOptionID, &marks, &negativeMarks)

	var isCorrect *bool
	var marksObtained float64
	if req.SelectedOptionID != nil && !req.WasSkipped {
		correct := *req.SelectedOptionID == correctOptionID
		isCorrect = &correct
		if correct {
			marksObtained = marks
		} else {
			marksObtained = -negativeMarks
			if marksObtained < 0 {
				marksObtained = 0
			}
		}
	}

	answeredAt := time.Now()
	var ans models.SubmissionAnswer
	err := h.db.QueryRow(ctx,
		`INSERT INTO submission_answers
		   (submission_id, question_id, selected_option_id, is_correct, marks_obtained,
		    time_spent_seconds, time_remaining_seconds, was_skipped, answered_at, sequence_answered)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 ON CONFLICT ON CONSTRAINT unique_answer DO UPDATE SET
		   selected_option_id    = EXCLUDED.selected_option_id,
		   is_correct            = EXCLUDED.is_correct,
		   marks_obtained        = EXCLUDED.marks_obtained,
		   time_spent_seconds    = EXCLUDED.time_spent_seconds,
		   time_remaining_seconds= EXCLUDED.time_remaining_seconds,
		   was_skipped           = EXCLUDED.was_skipped,
		   answered_at           = EXCLUDED.answered_at,
		   sequence_answered     = EXCLUDED.sequence_answered,
		   updated_at            = NOW()
		 RETURNING id, submission_id, question_id, selected_option_id, is_correct, marks_obtained,
		           time_spent_seconds, time_remaining_seconds, was_skipped, returned_to,
		           answered_at, sequence_answered, created_at, updated_at`,
		submissionID, req.QuestionID, req.SelectedOptionID, isCorrect, marksObtained,
		req.TimeSpentSeconds, req.TimeRemainingSeconds, req.WasSkipped, answeredAt, req.SequenceAnswered).
		Scan(&ans.ID, &ans.SubmissionID, &ans.QuestionID, &ans.SelectedOptionID,
			&ans.IsCorrect, &ans.MarksObtained, &ans.TimeSpentSeconds, &ans.TimeRemainingSeconds,
			&ans.WasSkipped, &ans.ReturnedTo, &ans.AnsweredAt, &ans.SequenceAnswered,
			&ans.CreatedAt, &ans.UpdatedAt)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to submit answer")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, ans)
}

// UpdateAnswer updates timing/skip fields on an existing answer.
//
//	@Summary		Update answer
//	@Tags			Submissions
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id			path		string						true	"Submission UUID"
//	@Param			answerId	path		string						true	"Answer UUID"
//	@Param			body		body		models.UpdateAnswerRequest	true	"Fields to update"
//	@Success		200		{object}	models.SubmissionAnswer
//	@Failure		400		{object}	map[string]string
//	@Router			/submissions/{id}/answer/{answerId} [patch]
func (h *SubmissionsHandler) UpdateAnswer(w http.ResponseWriter, r *http.Request) {
	answerID := r.PathValue("answerId")
	var req models.UpdateAnswerRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	_, err := h.db.Exec(ctx,
		`UPDATE submission_answers SET
		   selected_option_id     = COALESCE($2, selected_option_id),
		   time_spent_seconds     = COALESCE($3, time_spent_seconds),
		   time_remaining_seconds = COALESCE($4, time_remaining_seconds),
		   was_skipped            = COALESCE($5, was_skipped),
		   returned_to            = COALESCE($6, returned_to),
		   updated_at             = NOW()
		 WHERE id = $1`,
		answerID, req.SelectedOptionID, req.TimeSpentSeconds,
		req.TimeRemainingSeconds, req.WasSkipped, req.ReturnedTo)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to update answer")
		return
	}

	var ans models.SubmissionAnswer
	_ = h.db.QueryRow(ctx,
		`SELECT id, submission_id, question_id, selected_option_id, is_correct, marks_obtained,
		        time_spent_seconds, time_remaining_seconds, was_skipped, returned_to,
		        answered_at, sequence_answered, created_at, updated_at
		 FROM submission_answers WHERE id = $1`, answerID).
		Scan(&ans.ID, &ans.SubmissionID, &ans.QuestionID, &ans.SelectedOptionID,
			&ans.IsCorrect, &ans.MarksObtained, &ans.TimeSpentSeconds, &ans.TimeRemainingSeconds,
			&ans.WasSkipped, &ans.ReturnedTo, &ans.AnsweredAt, &ans.SequenceAnswered,
			&ans.CreatedAt, &ans.UpdatedAt)
	middleware.WriteJSON(w, http.StatusOK, ans)
}

// Submit finalises a submission as student-submitted.
//
//	@Summary		Submit exam
//	@Tags			Submissions
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Submission UUID"
//	@Success		200	{object}	models.ExamSubmission
//	@Failure		500	{object}	map[string]string
//	@Router			/submissions/{id}/submit [post]
func (h *SubmissionsHandler) Submit(w http.ResponseWriter, r *http.Request) {
	h.finalizeSubmission(w, r, "submitted", "")
}

// AutoSubmit auto-submits a submission (e.g. on time-out or tab-switch).
//
//	@Summary		Auto-submit exam
//	@Tags			Submissions
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string						true	"Submission UUID"
//	@Param			body	body		models.AutoSubmitRequest	false	"Reason for auto-submit"
//	@Success		200		{object}	models.ExamSubmission
//	@Failure		500		{object}	map[string]string
//	@Router			/submissions/{id}/auto-submit [post]
func (h *SubmissionsHandler) AutoSubmit(w http.ResponseWriter, r *http.Request) {
	var req models.AutoSubmitRequest
	_ = middleware.DecodeBody(r, &req)
	h.finalizeSubmission(w, r, "auto_submitted", req.Reason)
}

func (h *SubmissionsHandler) finalizeSubmission(w http.ResponseWriter, r *http.Request, status, reason string) {
	id := r.PathValue("id")
	ctx := r.Context()
	now := time.Now()

	var reasonPtr *string
	if reason != "" {
		reasonPtr = &reason
	}

	_, err := h.db.Exec(ctx,
		`UPDATE exam_submissions SET
		   status = $2, submitted_at = $3, auto_submit_reason = $4, updated_at = NOW()
		 WHERE id = $1 AND status = 'in_progress'`, id, status, now, reasonPtr)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to submit")
		return
	}

	// Auto-evaluate via DB function
	h.evaluate(ctx, id, "", nil)

	sub, _ := h.fetchSubmission(ctx, id)
	middleware.WriteJSON(w, http.StatusOK, sub)
}

// Evaluate triggers evaluation of a submission and optionally adds teacher remarks.
//
//	@Summary		Evaluate submission
//	@Tags			Submissions
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string								true	"Submission UUID"
//	@Param			body	body		models.EvaluateSubmissionRequest	false	"Optional remarks"
//	@Success		200		{object}	models.ExamSubmission
//	@Failure		500		{object}	map[string]string
//	@Router			/submissions/{id}/evaluate [post]
func (h *SubmissionsHandler) Evaluate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req models.EvaluateSubmissionRequest
	_ = middleware.DecodeBody(r, &req)

	evaluatedBy := middleware.GetUserID(r)
	ctx := r.Context()
	h.evaluate(ctx, id, evaluatedBy, req.Remarks)

	sub, err := h.fetchSubmission(ctx, id)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "evaluation failed")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, sub)
}

// AllowRetake marks a submission as retake_allowed so the student can retry.
//
//	@Summary		Allow retake
//	@Tags			Submissions
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Submission UUID"
//	@Success		200	{object}	models.ExamSubmission
//	@Failure		500	{object}	map[string]string
//	@Router			/submissions/{id}/allow-retake [post]
func (h *SubmissionsHandler) AllowRetake(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	_, err := h.db.Exec(r.Context(),
		`UPDATE exam_submissions SET status = 'retake_allowed', updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to allow retake")
		return
	}
	sub, _ := h.fetchSubmission(r.Context(), id)
	middleware.WriteJSON(w, http.StatusOK, sub)
}

// CancelRetake revokes a previously granted retake permission.
//
//	@Summary		Cancel retake
//	@Tags			Submissions
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Submission UUID"
//	@Success		200	{object}	models.ExamSubmission
//	@Failure		500	{object}	map[string]string
//	@Router			/submissions/{id}/cancel-retake [post]
func (h *SubmissionsHandler) CancelRetake(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	_, err := h.db.Exec(r.Context(),
		`UPDATE exam_submissions SET status = 'evaluated', updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to cancel retake")
		return
	}
	sub, _ := h.fetchSubmission(r.Context(), id)
	middleware.WriteJSON(w, http.StatusOK, sub)
}

// =============================================
// HELPERS
// =============================================

// evaluate calls the PostgreSQL evaluate_submission function and applies optional teacher overrides.
func (h *SubmissionsHandler) evaluate(ctx context.Context, submissionID, evaluatedBy string, remarks *string) {
	_, _ = h.db.Exec(ctx, `SELECT evaluate_submission($1)`, submissionID)

	if evaluatedBy != "" || remarks != nil {
		_, _ = h.db.Exec(ctx,
			`UPDATE exam_submissions SET
			   evaluated_by = COALESCE($2, evaluated_by),
			   remarks      = COALESCE($3, remarks),
			   updated_at   = NOW()
			 WHERE id = $1`,
			submissionID, nullableString(evaluatedBy), remarks)
	}
}

func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func scanSubmissions(rows pgx.Rows) []models.ExamSubmission {
	items := make([]models.ExamSubmission, 0)
	for rows.Next() {
		var s models.ExamSubmission
		if err := rows.Scan(&s.ID, &s.ExamID, &s.StudentID, &s.Status, &s.StartedAt, &s.SubmittedAt,
			&s.AutoSubmitReason, &s.TotalAnswered, &s.TotalCorrect, &s.TotalWrong, &s.TotalSkipped,
			&s.Score, &s.Percentage, &s.AttemptNumber, &s.EvaluatedAt, &s.EvaluatedBy,
			&s.Remarks, &s.CreatedAt, &s.UpdatedAt); err == nil {
			items = append(items, s)
		}
	}
	return items
}

func (h *SubmissionsHandler) fetchSubmission(ctx context.Context, id string) (*models.ExamSubmission, error) {
	var s models.ExamSubmission
	err := h.db.QueryRow(ctx, `SELECT `+submissionCols+` FROM exam_submissions WHERE id = $1`, id).
		Scan(&s.ID, &s.ExamID, &s.StudentID, &s.Status, &s.StartedAt, &s.SubmittedAt,
			&s.AutoSubmitReason, &s.TotalAnswered, &s.TotalCorrect, &s.TotalWrong, &s.TotalSkipped,
			&s.Score, &s.Percentage, &s.AttemptNumber, &s.EvaluatedAt, &s.EvaluatedBy,
			&s.Remarks, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (h *SubmissionsHandler) fetchSubmissionWithDetails(ctx context.Context, id string) (*models.ExamSubmissionWithDetails, error) {
	sub, err := h.fetchSubmission(ctx, id)
	if err != nil {
		return nil, err
	}

	// Fetch exam
	var exam models.Exam
	_ = h.db.QueryRow(ctx,
		`SELECT `+examSelectCols+` FROM exams e WHERE e.id = $1`, sub.ExamID).
		Scan(&exam.ID, &exam.SubjectID, &exam.TeacherID, &exam.Title, &exam.Description, &exam.Instructions,
			&exam.Status, &exam.TotalQuestions, &exam.TotalMarks, &exam.PassingMarks,
			&exam.TimePerQuestionSeconds, &exam.AllowSkipReturn, &exam.FullscreenRequired,
			&exam.AutoSubmitOnBlur, &exam.AllowRetake, &exam.MaxRetakes,
			&exam.ScheduledStart, &exam.ScheduledEnd, &exam.DurationMinutes,
			&exam.ResultVisibility, &exam.ResultReleaseDate, &exam.IsResultReleased,
			&exam.ShowScore, &exam.ShowPercentage, &exam.ShowPassFail, &exam.ShowCorrectAnswers,
			&exam.ShowStudentAnswers, &exam.ShowExplanations, &exam.ShowQuestionReview,
			&exam.ShowTimeSpent, &exam.ShowTeacherRemarks, &exam.ShowRank,
			&exam.ExamStyle, &exam.TotalTimeLimitMinutes, &exam.ShowImmediateFeedback,
			&exam.ShuffleQuestions, &exam.ShuffleOptions,
			&exam.TotalSubmissions, &exam.AverageScore, &exam.PublishedAt, &exam.CreatedAt, &exam.UpdatedAt)

	// Fetch answers
	rows, _ := h.db.Query(ctx,
		`SELECT id, submission_id, question_id, selected_option_id, is_correct, marks_obtained,
		        time_spent_seconds, time_remaining_seconds, was_skipped, returned_to,
		        answered_at, sequence_answered, created_at, updated_at
		 FROM submission_answers WHERE submission_id = $1 ORDER BY sequence_answered ASC NULLS LAST`, id)

	var answers []models.SubmissionAnswer
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var a models.SubmissionAnswer
			if err := rows.Scan(&a.ID, &a.SubmissionID, &a.QuestionID, &a.SelectedOptionID,
				&a.IsCorrect, &a.MarksObtained, &a.TimeSpentSeconds, &a.TimeRemainingSeconds,
				&a.WasSkipped, &a.ReturnedTo, &a.AnsweredAt, &a.SequenceAnswered,
				&a.CreatedAt, &a.UpdatedAt); err == nil {
				answers = append(answers, a)
			}
		}
	}

	return &models.ExamSubmissionWithDetails{
		ExamSubmission: *sub,
		Exam:           exam,
		Answers:        answers,
	}, nil
}
