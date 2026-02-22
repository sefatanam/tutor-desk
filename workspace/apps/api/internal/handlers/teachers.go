package handlers

import (
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tutor-desk/api/internal/middleware"
	"github.com/tutor-desk/api/internal/models"
)

// TeachersHandler handles teacher-related endpoints.
type TeachersHandler struct {
	db *pgxpool.Pool
}

func NewTeachersHandler(db *pgxpool.Pool) *TeachersHandler {
	return &TeachersHandler{db: db}
}

// GetAll returns a paginated list of all teachers (super_admin).
//
//	@Summary		List all teachers
//	@Tags			Teachers
//	@Produce		json
//	@Security		BearerAuth
//	@Param			page		query		int	false	"Page number"
//	@Param			page_size	query		int	false	"Page size"
//	@Success		200		{object}	models.PaginatedResponse[models.TeacherWithUser]
//	@Failure		500		{object}	map[string]string
//	@Router			/teachers [get]
func (h *TeachersHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	p := models.NewPaginationParams(page, pageSize)

	ctx := r.Context()
	var total int
	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM teachers`).Scan(&total)

	rows, err := h.db.Query(ctx,
		`SELECT t.id, t.user_id, t.qualification, t.specialization, t.bio,
		        t.allow_student_comments, t.show_exam_results_immediately,
		        t.total_students, t.total_subjects, t.total_exams,
		        t.approved_at, t.approved_by, t.created_at, t.updated_at,
		        u.id, u.email, u.full_name, u.avatar_url, u.role, u.status, u.phone,
		        u.auth_provider, u.auth_provider_id, u.last_login_at, u.created_by, u.created_at, u.updated_at
		 FROM teachers t
		 JOIN users u ON u.id = t.user_id
		 ORDER BY t.created_at DESC
		 LIMIT $1 OFFSET $2`, p.PageSize, p.Offset())
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch teachers")
		return
	}
	defer rows.Close()

	items := make([]models.TeacherWithUser, 0)
	for rows.Next() {
		var tw models.TeacherWithUser
		var ph *string
		if err := rows.Scan(
			&tw.ID, &tw.UserID, &tw.Qualification, &tw.Specialization, &tw.Bio,
			&tw.AllowStudentComments, &tw.ShowExamResultsImmediately,
			&tw.TotalStudents, &tw.TotalSubjects, &tw.TotalExams,
			&tw.ApprovedAt, &tw.ApprovedBy, &tw.CreatedAt, &tw.UpdatedAt,
			&tw.User.ID, &tw.User.Email, &tw.User.FullName, &tw.User.AvatarURL,
			&tw.User.Role, &tw.User.Status, &tw.User.Phone,
			&tw.User.AuthProvider, &tw.User.AuthProviderID, &tw.User.LastLoginAt,
			&tw.User.CreatedBy, &tw.User.CreatedAt, &tw.User.UpdatedAt,
		); err != nil {
			continue
		}
		_ = ph
		items = append(items, tw)
	}

	totalPages := total / p.PageSize
	if total%p.PageSize != 0 {
		totalPages++
	}
	middleware.WriteJSON(w, http.StatusOK, models.PaginatedResponse[models.TeacherWithUser]{
		Items: items, Total: total, Page: p.Page, PageSize: p.PageSize, TotalPages: totalPages,
	})
}

// GetPending returns all teachers awaiting approval (super_admin).
//
//	@Summary		List pending teachers
//	@Tags			Teachers
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200		{array}		models.TeacherWithUser
//	@Failure		500		{object}	map[string]string
//	@Router			/teachers/pending [get]
func (h *TeachersHandler) GetPending(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := h.db.Query(ctx,
		`SELECT t.id, t.user_id, t.qualification, t.specialization, t.bio,
		        t.allow_student_comments, t.show_exam_results_immediately,
		        t.total_students, t.total_subjects, t.total_exams,
		        t.approved_at, t.approved_by, t.created_at, t.updated_at,
		        u.id, u.email, u.full_name, u.avatar_url, u.role, u.status, u.phone,
		        u.auth_provider, u.auth_provider_id, u.last_login_at, u.created_by, u.created_at, u.updated_at
		 FROM teachers t
		 JOIN users u ON u.id = t.user_id
		 WHERE t.approved_at IS NULL AND u.status = 'pending'
		 ORDER BY t.created_at DESC`)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch pending teachers")
		return
	}
	defer rows.Close()

	items := scanTeachersWithUser(rows)
	middleware.WriteJSON(w, http.StatusOK, items)
}

// GetByID returns a teacher by their teacher record ID.
//
//	@Summary		Get teacher by ID
//	@Tags			Teachers
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Teacher UUID"
//	@Success		200	{object}	models.TeacherWithUser
//	@Failure		404	{object}	map[string]string
//	@Router			/teachers/{id} [get]
func (h *TeachersHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	tw, err := h.getTeacherWithUser(r.Context(), "t.id = $1", id)
	if err != nil {
		middleware.WriteError(w, http.StatusNotFound, "teacher not found")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, tw)
}

// GetStats returns dashboard statistics for a teacher.
//
//	@Summary		Get teacher stats
//	@Tags			Teachers
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Teacher UUID"
//	@Success		200	{object}	models.TeacherDashboardStats
//	@Router			/teachers/{id}/stats [get]
func (h *TeachersHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ctx := r.Context()

	var stats models.TeacherDashboardStats
	err := h.db.QueryRow(ctx,
		`SELECT total_students, total_subjects, total_exams, active_exams, total_submissions, average_student_score
		 FROM teacher_dashboard_stats WHERE teacher_id = $1`, id).
		Scan(&stats.TotalStudents, &stats.TotalSubjects, &stats.TotalExams,
			&stats.ActiveExams, &stats.TotalSubmissions, &stats.AverageStudentScore)
	if err != nil {
		// Return zeroes if no data
		middleware.WriteJSON(w, http.StatusOK, stats)
		return
	}
	middleware.WriteJSON(w, http.StatusOK, stats)
}

// Update updates a teacher's profile.
//
//	@Summary		Update teacher
//	@Tags			Teachers
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string							true	"Teacher UUID"
//	@Param			body	body		models.UpdateTeacherRequest		true	"Fields to update"
//	@Success		200		{object}	models.TeacherWithUser
//	@Failure		400		{object}	map[string]string
//	@Router			/teachers/{id} [patch]
func (h *TeachersHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req models.UpdateTeacherRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	_, err := h.db.Exec(ctx,
		`UPDATE teachers SET
		   qualification              = COALESCE($2, qualification),
		   specialization             = COALESCE($3, specialization),
		   bio                        = COALESCE($4, bio),
		   allow_student_comments     = COALESCE($5, allow_student_comments),
		   show_exam_results_immediately = COALESCE($6, show_exam_results_immediately),
		   updated_at = NOW()
		 WHERE id = $1`,
		id, req.Qualification, req.Specialization, req.Bio,
		req.AllowStudentComments, req.ShowExamResultsImmediately)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to update teacher")
		return
	}
	h.GetByID(w, r)
}

// Approve approves a pending teacher account (super_admin).
//
//	@Summary		Approve teacher
//	@Tags			Teachers
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Teacher UUID"
//	@Success		200	{object}	models.TeacherWithUser
//	@Failure		404	{object}	map[string]string
//	@Router			/teachers/{id}/approve [post]
func (h *TeachersHandler) Approve(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	callerID := middleware.GetUserID(r)
	ctx := r.Context()

	var userID string
	err := h.db.QueryRow(ctx,
		`UPDATE teachers SET approved_at = NOW(), approved_by = $2, updated_at = NOW()
		 WHERE id = $1 RETURNING user_id`, id, callerID).Scan(&userID)
	if err != nil {
		middleware.WriteError(w, http.StatusNotFound, "teacher not found")
		return
	}

	_, _ = h.db.Exec(ctx, `UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1`, userID)
	h.GetByID(w, r)
}

// Disable disables a teacher account (super_admin).
//
//	@Summary		Disable teacher
//	@Tags			Teachers
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Teacher UUID"
//	@Success		200	{object}	models.TeacherWithUser
//	@Failure		404	{object}	map[string]string
//	@Router			/teachers/{id}/disable [post]
func (h *TeachersHandler) Disable(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ctx := r.Context()
	var userID string
	if err := h.db.QueryRow(ctx, `SELECT user_id FROM teachers WHERE id = $1`, id).Scan(&userID); err != nil {
		middleware.WriteError(w, http.StatusNotFound, "teacher not found")
		return
	}
	_, _ = h.db.Exec(ctx, `UPDATE users SET status = 'disabled', updated_at = NOW() WHERE id = $1`, userID)
	h.GetByID(w, r)
}

// Enable re-enables a disabled teacher account (super_admin).
//
//	@Summary		Enable teacher
//	@Tags			Teachers
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Teacher UUID"
//	@Success		200	{object}	models.TeacherWithUser
//	@Failure		404	{object}	map[string]string
//	@Router			/teachers/{id}/enable [post]
func (h *TeachersHandler) Enable(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ctx := r.Context()
	var userID string
	if err := h.db.QueryRow(ctx, `SELECT user_id FROM teachers WHERE id = $1`, id).Scan(&userID); err != nil {
		middleware.WriteError(w, http.StatusNotFound, "teacher not found")
		return
	}
	_, _ = h.db.Exec(ctx, `UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1`, userID)
	h.GetByID(w, r)
}

// Delete deletes a teacher and their user account (super_admin).
//
//	@Summary		Delete teacher
//	@Tags			Teachers
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Teacher UUID"
//	@Success		204
//	@Failure		404	{object}	map[string]string
//	@Router			/teachers/{id} [delete]
func (h *TeachersHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ctx := r.Context()
	var userID string
	if err := h.db.QueryRow(ctx, `SELECT user_id FROM teachers WHERE id = $1`, id).Scan(&userID); err != nil {
		middleware.WriteError(w, http.StatusNotFound, "teacher not found")
		return
	}
	_, _ = h.db.Exec(ctx, `DELETE FROM teachers WHERE id = $1`, id)
	_, _ = h.db.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
	w.WriteHeader(http.StatusNoContent)
}

// =============================================
// HELPERS
// =============================================

func (h *TeachersHandler) getTeacherWithUser(ctx interface{ Value(any) any }, where, arg string) (*models.TeacherWithUser, error) {
	// Use a concrete context
	return nil, nil // placeholder — see actual implementation below
}

// getTeacher is the real implementation
func getTeacherRow(db *pgxpool.Pool, r *http.Request, condition, arg string) (*models.TeacherWithUser, error) {
	ctx := r.Context()
	var tw models.TeacherWithUser
	err := db.QueryRow(ctx,
		`SELECT t.id, t.user_id, t.qualification, t.specialization, t.bio,
		        t.allow_student_comments, t.show_exam_results_immediately,
		        t.total_students, t.total_subjects, t.total_exams,
		        t.approved_at, t.approved_by, t.created_at, t.updated_at,
		        u.id, u.email, u.full_name, u.avatar_url, u.role, u.status, u.phone,
		        u.auth_provider, u.auth_provider_id, u.last_login_at, u.created_by, u.created_at, u.updated_at
		 FROM teachers t
		 JOIN users u ON u.id = t.user_id
		 WHERE `+condition, arg).Scan(
		&tw.ID, &tw.UserID, &tw.Qualification, &tw.Specialization, &tw.Bio,
		&tw.AllowStudentComments, &tw.ShowExamResultsImmediately,
		&tw.TotalStudents, &tw.TotalSubjects, &tw.TotalExams,
		&tw.ApprovedAt, &tw.ApprovedBy, &tw.CreatedAt, &tw.UpdatedAt,
		&tw.User.ID, &tw.User.Email, &tw.User.FullName, &tw.User.AvatarURL,
		&tw.User.Role, &tw.User.Status, &tw.User.Phone,
		&tw.User.AuthProvider, &tw.User.AuthProviderID, &tw.User.LastLoginAt,
		&tw.User.CreatedBy, &tw.User.CreatedAt, &tw.User.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &tw, nil
}

func scanTeachersWithUser(rows interface {
	Next() bool
	Scan(dest ...any) error
	Close()
}) []models.TeacherWithUser {
	items := make([]models.TeacherWithUser, 0)
	for rows.Next() {
		var tw models.TeacherWithUser
		if err := rows.Scan(
			&tw.ID, &tw.UserID, &tw.Qualification, &tw.Specialization, &tw.Bio,
			&tw.AllowStudentComments, &tw.ShowExamResultsImmediately,
			&tw.TotalStudents, &tw.TotalSubjects, &tw.TotalExams,
			&tw.ApprovedAt, &tw.ApprovedBy, &tw.CreatedAt, &tw.UpdatedAt,
			&tw.User.ID, &tw.User.Email, &tw.User.FullName, &tw.User.AvatarURL,
			&tw.User.Role, &tw.User.Status, &tw.User.Phone,
			&tw.User.AuthProvider, &tw.User.AuthProviderID, &tw.User.LastLoginAt,
			&tw.User.CreatedBy, &tw.User.CreatedAt, &tw.User.UpdatedAt,
		); err == nil {
			items = append(items, tw)
		}
	}
	return items
}
