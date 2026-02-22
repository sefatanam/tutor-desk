package handlers

import (
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tutor-desk/api/internal/middleware"
	"github.com/tutor-desk/api/internal/models"
)

// StudentsHandler handles student-related endpoints.
type StudentsHandler struct {
	db *pgxpool.Pool
}

func NewStudentsHandler(db *pgxpool.Pool) *StudentsHandler {
	return &StudentsHandler{db: db}
}

// GetAll returns a paginated list of the calling teacher's students.
//
//	@Summary		List students
//	@Tags			Students
//	@Produce		json
//	@Security		BearerAuth
//	@Param			page		query		int	false	"Page number"
//	@Param			page_size	query		int	false	"Page size"
//	@Success		200		{object}	models.PaginatedResponse[models.StudentWithUser]
//	@Failure		404		{object}	map[string]string
//	@Router			/students [get]
func (h *StudentsHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	callerUserID := middleware.GetUserID(r)
	callerRole := middleware.GetUserRole(r)
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	p := models.NewPaginationParams(page, pageSize)
	ctx := r.Context()

	// super_admin can optionally filter by teacher_id query param; if omitted, returns all students.
	// teachers must be filtered to their own students only.
	filterTeacherID := r.URL.Query().Get("teacher_id")

	if callerRole == "super_admin" {
		var total int
		var rows interface {
			Next() bool
			Scan(dest ...any) error
			Close()
		}
		var err error

		if filterTeacherID != "" {
			_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM students WHERE teacher_id = $1`, filterTeacherID).Scan(&total)
			rows, err = h.db.Query(ctx,
				`SELECT s.id, s.user_id, s.teacher_id, s.roll_number, s.class_name, s.section,
				        s.guardian_name, s.guardian_phone, s.address, s.date_of_birth,
				        s.total_exams_taken, s.average_score, s.created_at, s.updated_at,
				        u.id, u.email, u.full_name, u.avatar_url, u.user_role, u.status, u.phone,
				        u.auth_provider, u.auth_provider_id, u.last_login_at, u.created_by, u.created_at, u.updated_at
				 FROM students s JOIN users u ON u.id = s.user_id
				 WHERE s.teacher_id = $1
				 ORDER BY s.created_at DESC LIMIT $2 OFFSET $3`, filterTeacherID, p.PageSize, p.Offset())
		} else {
			_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM students`).Scan(&total)
			rows, err = h.db.Query(ctx,
				`SELECT s.id, s.user_id, s.teacher_id, s.roll_number, s.class_name, s.section,
				        s.guardian_name, s.guardian_phone, s.address, s.date_of_birth,
				        s.total_exams_taken, s.average_score, s.created_at, s.updated_at,
				        u.id, u.email, u.full_name, u.avatar_url, u.user_role, u.status, u.phone,
				        u.auth_provider, u.auth_provider_id, u.last_login_at, u.created_by, u.created_at, u.updated_at
				 FROM students s JOIN users u ON u.id = s.user_id
				 ORDER BY s.created_at DESC LIMIT $1 OFFSET $2`, p.PageSize, p.Offset())
		}
		if err != nil {
			middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch students")
			return
		}
		defer rows.Close()
		items := scanStudentsWithUser(rows)
		totalPages := (total + p.PageSize - 1) / p.PageSize
		middleware.WriteJSON(w, http.StatusOK, models.PaginatedResponse[models.StudentWithUser]{
			Items: items, Total: total, Page: p.Page, PageSize: p.PageSize, TotalPages: totalPages,
		})
		return
	}

	// For teacher role: resolve teacher profile from caller user ID.
	var teacherID string
	if err := h.db.QueryRow(ctx, `SELECT id FROM teachers WHERE user_id = $1`, callerUserID).Scan(&teacherID); err != nil {
		middleware.WriteError(w, http.StatusNotFound, "teacher profile not found")
		return
	}

	var total int
	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM students WHERE teacher_id = $1`, teacherID).Scan(&total)

	rows, err := h.db.Query(ctx,
		`SELECT s.id, s.user_id, s.teacher_id, s.roll_number, s.class_name, s.section,
		        s.guardian_name, s.guardian_phone, s.address, s.date_of_birth,
		        s.total_exams_taken, s.average_score, s.created_at, s.updated_at,
		        u.id, u.email, u.full_name, u.avatar_url, u.user_role, u.status, u.phone,
		        u.auth_provider, u.auth_provider_id, u.last_login_at, u.created_by, u.created_at, u.updated_at
		 FROM students s JOIN users u ON u.id = s.user_id
		 WHERE s.teacher_id = $1
		 ORDER BY s.created_at DESC
		 LIMIT $2 OFFSET $3`, teacherID, p.PageSize, p.Offset())
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch students")
		return
	}
	defer rows.Close()

	items := scanStudentsWithUser(rows)
	totalPages := (total + p.PageSize - 1) / p.PageSize
	middleware.WriteJSON(w, http.StatusOK, models.PaginatedResponse[models.StudentWithUser]{
		Items: items, Total: total, Page: p.Page, PageSize: p.PageSize, TotalPages: totalPages,
	})
}

// GetByID returns a student by ID.
//
//	@Summary		Get student by ID
//	@Tags			Students
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Student UUID"
//	@Success		200	{object}	models.StudentWithUser
//	@Failure		404	{object}	map[string]string
//	@Router			/students/{id} [get]
func (h *StudentsHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	sw, err := scanStudentWithUser(h.db, r, "s.id = $1", id)
	if err != nil {
		middleware.WriteError(w, http.StatusNotFound, "student not found")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, sw)
}

// GetStats returns dashboard statistics for a student.
//
//	@Summary		Get student stats
//	@Tags			Students
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Student UUID"
//	@Success		200	{object}	models.StudentDashboardStats
//	@Router			/students/{id}/stats [get]
func (h *StudentsHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ctx := r.Context()
	var stats models.StudentDashboardStats
	err := h.db.QueryRow(ctx,
		`SELECT enrolled_subjects, total_exams_taken, average_score, pending_exams
		 FROM student_dashboard_stats WHERE student_id = $1`, id).
		Scan(&stats.EnrolledSubjects, &stats.TotalExamsTaken, &stats.AverageScore, &stats.PendingExams)
	if err != nil {
		middleware.WriteJSON(w, http.StatusOK, stats)
		return
	}
	middleware.WriteJSON(w, http.StatusOK, stats)
}

// Update updates a student's profile fields.
//
//	@Summary		Update student
//	@Tags			Students
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string							true	"Student UUID"
//	@Param			body	body		models.UpdateStudentRequest		true	"Fields to update"
//	@Success		200		{object}	models.StudentWithUser
//	@Failure		400		{object}	map[string]string
//	@Router			/students/{id} [patch]
func (h *StudentsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req models.UpdateStudentRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	_, err := h.db.Exec(ctx,
		`UPDATE students SET
		   roll_number    = COALESCE($2, roll_number),
		   class_name     = COALESCE($3, class_name),
		   section        = COALESCE($4, section),
		   guardian_name  = COALESCE($5, guardian_name),
		   guardian_phone = COALESCE($6, guardian_phone),
		   address        = COALESCE($7, address),
		   date_of_birth  = COALESCE($8, date_of_birth),
		   updated_at     = NOW()
		 WHERE id = $1`,
		id, req.RollNumber, req.ClassName, req.Section,
		req.GuardianName, req.GuardianPhone, req.Address, req.DateOfBirth)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to update student")
		return
	}
	h.GetByID(w, r)
}

// Disable disables a student account.
//
//	@Summary		Disable student
//	@Tags			Students
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Student UUID"
//	@Success		200	{object}	models.StudentWithUser
//	@Failure		404	{object}	map[string]string
//	@Router			/students/{id}/disable [post]
func (h *StudentsHandler) Disable(w http.ResponseWriter, r *http.Request) {
	h.setStatus(w, r, "disabled")
}

// Enable re-enables a disabled student account.
//
//	@Summary		Enable student
//	@Tags			Students
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Student UUID"
//	@Success		200	{object}	models.StudentWithUser
//	@Failure		404	{object}	map[string]string
//	@Router			/students/{id}/enable [post]
func (h *StudentsHandler) Enable(w http.ResponseWriter, r *http.Request) {
	h.setStatus(w, r, "active")
}

func (h *StudentsHandler) setStatus(w http.ResponseWriter, r *http.Request, status string) {
	id := r.PathValue("id")
	ctx := r.Context()
	var userID string
	if err := h.db.QueryRow(ctx, `SELECT user_id FROM students WHERE id = $1`, id).Scan(&userID); err != nil {
		middleware.WriteError(w, http.StatusNotFound, "student not found")
		return
	}
	_, _ = h.db.Exec(ctx, `UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1`, userID, status)
	h.GetByID(w, r)
}

// Delete deletes a student and their user account.
//
//	@Summary		Delete student
//	@Tags			Students
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Student UUID"
//	@Success		204
//	@Failure		404	{object}	map[string]string
//	@Router			/students/{id} [delete]
func (h *StudentsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ctx := r.Context()
	var userID string
	if err := h.db.QueryRow(ctx, `SELECT user_id FROM students WHERE id = $1`, id).Scan(&userID); err != nil {
		middleware.WriteError(w, http.StatusNotFound, "student not found")
		return
	}
	_, _ = h.db.Exec(ctx, `DELETE FROM students WHERE id = $1`, id)
	_, _ = h.db.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
	w.WriteHeader(http.StatusNoContent)
}

// =============================================
// HELPERS
// =============================================

func scanStudentWithUser(db *pgxpool.Pool, r *http.Request, condition, arg string) (*models.StudentWithUser, error) {
	ctx := r.Context()
	var sw models.StudentWithUser
	err := db.QueryRow(ctx,
		`SELECT s.id, s.user_id, s.teacher_id, s.roll_number, s.class_name, s.section,
		        s.guardian_name, s.guardian_phone, s.address, s.date_of_birth,
		        s.total_exams_taken, s.average_score, s.created_at, s.updated_at,
		        u.id, u.email, u.full_name, u.avatar_url, u.user_role, u.status, u.phone,
		        u.auth_provider, u.auth_provider_id, u.last_login_at, u.created_by, u.created_at, u.updated_at
		 FROM students s JOIN users u ON u.id = s.user_id
		 WHERE `+condition, arg).Scan(
		&sw.ID, &sw.UserID, &sw.TeacherID, &sw.RollNumber, &sw.ClassName, &sw.Section,
		&sw.GuardianName, &sw.GuardianPhone, &sw.Address, &sw.DateOfBirth,
		&sw.TotalExamsTaken, &sw.AverageScore, &sw.CreatedAt, &sw.UpdatedAt,
		&sw.User.ID, &sw.User.Email, &sw.User.FullName, &sw.User.AvatarURL,
		&sw.User.Role, &sw.User.Status, &sw.User.Phone,
		&sw.User.AuthProvider, &sw.User.AuthProviderID, &sw.User.LastLoginAt,
		&sw.User.CreatedBy, &sw.User.CreatedAt, &sw.User.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &sw, nil
}

func scanStudentsWithUser(rows interface {
	Next() bool
	Scan(dest ...any) error
	Close()
}) []models.StudentWithUser {
	items := make([]models.StudentWithUser, 0)
	for rows.Next() {
		var sw models.StudentWithUser
		if err := rows.Scan(
			&sw.ID, &sw.UserID, &sw.TeacherID, &sw.RollNumber, &sw.ClassName, &sw.Section,
			&sw.GuardianName, &sw.GuardianPhone, &sw.Address, &sw.DateOfBirth,
			&sw.TotalExamsTaken, &sw.AverageScore, &sw.CreatedAt, &sw.UpdatedAt,
			&sw.User.ID, &sw.User.Email, &sw.User.FullName, &sw.User.AvatarURL,
			&sw.User.Role, &sw.User.Status, &sw.User.Phone,
			&sw.User.AuthProvider, &sw.User.AuthProviderID, &sw.User.LastLoginAt,
			&sw.User.CreatedBy, &sw.User.CreatedAt, &sw.User.UpdatedAt,
		); err == nil {
			items = append(items, sw)
		}
	}
	return items
}
