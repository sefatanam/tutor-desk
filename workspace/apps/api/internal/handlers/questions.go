package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tutor-desk/api/internal/middleware"
	"github.com/tutor-desk/api/internal/models"
)

// QuestionsHandler handles question CRUD for exams.
type QuestionsHandler struct {
	db *pgxpool.Pool
}

func NewQuestionsHandler(db *pgxpool.Pool) *QuestionsHandler {
	return &QuestionsHandler{db: db}
}

// GetByExam returns all questions for an exam ordered by sequence.
//
//	@Summary		List questions for exam
//	@Tags			Questions
//	@Produce		json
//	@Security		BearerAuth
//	@Param			examId	path		string	true	"Exam UUID"
//	@Success		200		{array}		models.Question
//	@Failure		500		{object}	map[string]string
//	@Router			/exams/{examId}/questions [get]
func (h *QuestionsHandler) GetByExam(w http.ResponseWriter, r *http.Request) {
	examID := r.PathValue("examId")
	ctx := r.Context()

	rows, err := h.db.Query(ctx,
		`SELECT id, exam_id, question_text, question_image_url, options, correct_option_id,
		        marks, negative_marks, time_limit_seconds, sequence_number, explanation, created_at, updated_at
		 FROM questions WHERE exam_id = $1 ORDER BY sequence_number ASC`, examID)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch questions")
		return
	}
	defer rows.Close()

	middleware.WriteJSON(w, http.StatusOK, scanQuestions(rows))
}

// GetByID returns a single question by ID.
//
//	@Summary		Get question by ID
//	@Tags			Questions
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Question UUID"
//	@Success		200	{object}	models.Question
//	@Failure		404	{object}	map[string]string
//	@Router			/questions/{id} [get]
func (h *QuestionsHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	q, err := h.fetchQuestion(r, id)
	if err != nil {
		middleware.WriteError(w, http.StatusNotFound, "question not found")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, q)
}

// Create adds a question to an exam.
//
//	@Summary		Create question
//	@Tags			Questions
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			examId	path		string							true	"Exam UUID"
//	@Param			body	body		models.CreateQuestionRequest	true	"Question details"
//	@Success		201		{object}	models.Question
//	@Failure		400		{object}	map[string]string
//	@Router			/exams/{examId}/questions [post]
func (h *QuestionsHandler) Create(w http.ResponseWriter, r *http.Request) {
	examID := r.PathValue("examId")
	var req models.CreateQuestionRequest
	if err := middleware.DecodeBody(r, &req); err != nil || req.QuestionText == "" {
		middleware.WriteError(w, http.StatusBadRequest, "question_text is required")
		return
	}

	q, err := h.insertQuestion(r, examID, req)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to create question")
		return
	}
	h.updateExamQuestionStats(r, examID)
	middleware.WriteJSON(w, http.StatusCreated, q)
}

// CreateBulk adds multiple questions to an exam in one request.
//
//	@Summary		Bulk create questions
//	@Tags			Questions
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			examId	path		string								true	"Exam UUID"
//	@Param			body	body		[]models.CreateQuestionRequest		true	"Array of questions"
//	@Success		201		{array}		models.Question
//	@Failure		400		{object}	map[string]string
//	@Router			/exams/{examId}/questions/bulk [post]
func (h *QuestionsHandler) CreateBulk(w http.ResponseWriter, r *http.Request) {
	examID := r.PathValue("examId")
	var reqs []models.CreateQuestionRequest
	if err := middleware.DecodeBody(r, &reqs); err != nil || len(reqs) == 0 {
		middleware.WriteError(w, http.StatusBadRequest, "array of questions required")
		return
	}

	questions := make([]models.Question, 0, len(reqs))
	for _, req := range reqs {
		q, err := h.insertQuestion(r, examID, req)
		if err != nil {
			middleware.WriteError(w, http.StatusInternalServerError, "failed to create one or more questions")
			return
		}
		questions = append(questions, *q)
	}
	h.updateExamQuestionStats(r, examID)
	middleware.WriteJSON(w, http.StatusCreated, questions)
}

// Update updates a question's fields.
//
//	@Summary		Update question
//	@Tags			Questions
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string							true	"Question UUID"
//	@Param			body	body		models.UpdateQuestionRequest	true	"Fields to update"
//	@Success		200		{object}	models.Question
//	@Failure		400		{object}	map[string]string
//	@Router			/questions/{id} [patch]
func (h *QuestionsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req models.UpdateQuestionRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()

	var optionsJSON *[]byte
	if req.Options != nil {
		b, _ := json.Marshal(req.Options)
		optionsJSON = &b
	}

	_, err := h.db.Exec(ctx,
		`UPDATE questions SET
		   question_text      = COALESCE($2, question_text),
		   question_image_url = COALESCE($3, question_image_url),
		   options            = COALESCE($4::jsonb, options),
		   correct_option_id  = COALESCE($5, correct_option_id),
		   marks              = COALESCE($6, marks),
		   negative_marks     = COALESCE($7, negative_marks),
		   time_limit_seconds = COALESCE($8, time_limit_seconds),
		   sequence_number    = COALESCE($9, sequence_number),
		   explanation        = COALESCE($10, explanation),
		   updated_at         = NOW()
		 WHERE id = $1`,
		id, req.QuestionText, req.QuestionImageURL, optionsJSON,
		req.CorrectOptionID, req.Marks, req.NegativeMarks,
		req.TimeLimitSeconds, req.SequenceNumber, req.Explanation)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to update question")
		return
	}

	q, err := h.fetchQuestion(r, id)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "updated but failed to fetch")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, q)
}

// Reorder updates the sequence_number of all questions in an exam.
//
//	@Summary		Reorder questions
//	@Tags			Questions
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			examId	path		string							true	"Exam UUID"
//	@Param			body	body		models.ReorderQuestionsRequest	true	"Ordered question IDs"
//	@Success		200		{array}		models.Question
//	@Failure		400		{object}	map[string]string
//	@Router			/exams/{examId}/questions/reorder [patch]
func (h *QuestionsHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	examID := r.PathValue("examId")
	var req models.ReorderQuestionsRequest
	if err := middleware.DecodeBody(r, &req); err != nil || len(req.QuestionIDs) == 0 {
		middleware.WriteError(w, http.StatusBadRequest, "question_ids required")
		return
	}

	ctx := r.Context()
	for i, qID := range req.QuestionIDs {
		_, _ = h.db.Exec(ctx,
			`UPDATE questions SET sequence_number = $2, updated_at = NOW() WHERE id = $1 AND exam_id = $3`,
			qID, i+1, examID)
	}

	// Return updated list
	rows, _ := h.db.Query(ctx,
		`SELECT id, exam_id, question_text, question_image_url, options, correct_option_id,
		        marks, negative_marks, time_limit_seconds, sequence_number, explanation, created_at, updated_at
		 FROM questions WHERE exam_id = $1 ORDER BY sequence_number ASC`, examID)
	if rows != nil {
		defer rows.Close()
		middleware.WriteJSON(w, http.StatusOK, scanQuestions(rows))
		return
	}
	middleware.WriteJSON(w, http.StatusOK, []models.Question{})
}

// Delete deletes a question and updates exam totals.
//
//	@Summary		Delete question
//	@Tags			Questions
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Question UUID"
//	@Success		204
//	@Router			/questions/{id} [delete]
func (h *QuestionsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ctx := r.Context()

	var examID string
	_ = h.db.QueryRow(ctx, `SELECT exam_id FROM questions WHERE id = $1`, id).Scan(&examID)

	_, _ = h.db.Exec(ctx, `DELETE FROM questions WHERE id = $1`, id)

	if examID != "" {
		h.updateExamQuestionStats(r, examID)
	}
	w.WriteHeader(http.StatusNoContent)
}

// =============================================
// HELPERS
// =============================================

func (h *QuestionsHandler) insertQuestion(r *http.Request, examID string, req models.CreateQuestionRequest) (*models.Question, error) {
	ctx := r.Context()

	optBytes, _ := json.Marshal(req.Options)

	marks := 1
	if req.Marks != nil {
		marks = *req.Marks
	}
	negMarks := 0.0
	if req.NegativeMarks != nil {
		negMarks = *req.NegativeMarks
	}

	var q models.Question
	var optRaw []byte
	err := h.db.QueryRow(ctx,
		`INSERT INTO questions (exam_id, question_text, question_image_url, options, correct_option_id,
		                        marks, negative_marks, time_limit_seconds, sequence_number, explanation)
		 VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10)
		 RETURNING id, exam_id, question_text, question_image_url, options, correct_option_id,
		           marks, negative_marks, time_limit_seconds, sequence_number, explanation, created_at, updated_at`,
		examID, req.QuestionText, req.QuestionImageURL, optBytes, req.CorrectOptionID,
		marks, negMarks, req.TimeLimitSeconds, req.SequenceNumber, req.Explanation).
		Scan(&q.ID, &q.ExamID, &q.QuestionText, &q.QuestionImageURL, &optRaw, &q.CorrectOptionID,
			&q.Marks, &q.NegativeMarks, &q.TimeLimitSeconds, &q.SequenceNumber, &q.Explanation,
			&q.CreatedAt, &q.UpdatedAt)
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(optRaw, &q.Options)
	return &q, nil
}

func (h *QuestionsHandler) fetchQuestion(r *http.Request, id string) (*models.Question, error) {
	ctx := r.Context()
	var q models.Question
	var optRaw []byte
	err := h.db.QueryRow(ctx,
		`SELECT id, exam_id, question_text, question_image_url, options, correct_option_id,
		        marks, negative_marks, time_limit_seconds, sequence_number, explanation, created_at, updated_at
		 FROM questions WHERE id = $1`, id).
		Scan(&q.ID, &q.ExamID, &q.QuestionText, &q.QuestionImageURL, &optRaw, &q.CorrectOptionID,
			&q.Marks, &q.NegativeMarks, &q.TimeLimitSeconds, &q.SequenceNumber, &q.Explanation,
			&q.CreatedAt, &q.UpdatedAt)
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(optRaw, &q.Options)
	return &q, nil
}

func (h *QuestionsHandler) updateExamQuestionStats(r *http.Request, examID string) {
	_, _ = h.db.Exec(r.Context(),
		`UPDATE exams SET
		   total_questions = (SELECT COUNT(*) FROM questions WHERE exam_id = $1),
		   total_marks     = (SELECT COALESCE(SUM(marks), 0) FROM questions WHERE exam_id = $1),
		   updated_at      = NOW()
		 WHERE id = $1`, examID)
}

func scanQuestions(rows interface {
	Next() bool
	Scan(dest ...any) error
	Close()
}) []models.Question {
	items := make([]models.Question, 0)
	for rows.Next() {
		var q models.Question
		var optRaw []byte
		if err := rows.Scan(&q.ID, &q.ExamID, &q.QuestionText, &q.QuestionImageURL, &optRaw,
			&q.CorrectOptionID, &q.Marks, &q.NegativeMarks, &q.TimeLimitSeconds,
			&q.SequenceNumber, &q.Explanation, &q.CreatedAt, &q.UpdatedAt); err == nil {
			_ = json.Unmarshal(optRaw, &q.Options)
			items = append(items, q)
		}
	}
	return items
}
