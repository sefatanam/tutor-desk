package handlers

import (
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tutor-desk/api/internal/middleware"
	"github.com/tutor-desk/api/internal/models"
)

// SubjectsHandler handles subject and enrollment endpoints.
type SubjectsHandler struct {
	db *pgxpool.Pool
}

func NewSubjectsHandler(db *pgxpool.Pool) *SubjectsHandler {
	return &SubjectsHandler{db: db}
}

// GetAll returns a paginated list of the calling teacher's subjects.
//
//	@Summary		List subjects
//	@Tags			Subjects
//	@Produce		json
//	@Security		BearerAuth
//	@Param			page		query		int	false	"Page number"
//	@Param			page_size	query		int	false	"Page size"
//	@Success		200		{object}	models.PaginatedResponse[models.Subject]
//	@Failure		404		{object}	map[string]string
//	@Router			/subjects [get]
func (h *SubjectsHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	callerUserID := middleware.GetUserID(r)
	callerRole := middleware.GetUserRole(r)
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	p := models.NewPaginationParams(page, pageSize)
	ctx := r.Context()

	// super_admin can optionally filter by teacher_id query param; if omitted, returns all subjects.
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
			_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM subjects WHERE teacher_id = $1`, filterTeacherID).Scan(&total)
			rows, err = h.db.Query(ctx,
				`SELECT id, teacher_id, name, description, code, color, icon, is_active,
				        total_students, total_exams, total_assets, created_at, updated_at
				 FROM subjects WHERE teacher_id = $1
				 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, filterTeacherID, p.PageSize, p.Offset())
		} else {
			_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM subjects`).Scan(&total)
			rows, err = h.db.Query(ctx,
				`SELECT id, teacher_id, name, description, code, color, icon, is_active,
				        total_students, total_exams, total_assets, created_at, updated_at
				 FROM subjects
				 ORDER BY created_at DESC LIMIT $1 OFFSET $2`, p.PageSize, p.Offset())
		}
		if err != nil {
			middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch subjects")
			return
		}
		defer rows.Close()
		items := scanSubjects(rows)
		totalPages := (total + p.PageSize - 1) / p.PageSize
		middleware.WriteJSON(w, http.StatusOK, models.PaginatedResponse[models.Subject]{
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
	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM subjects WHERE teacher_id = $1`, teacherID).Scan(&total)

	rows, err := h.db.Query(ctx,
		`SELECT id, teacher_id, name, description, code, color, icon, is_active,
		        total_students, total_exams, total_assets, created_at, updated_at
		 FROM subjects WHERE teacher_id = $1
		 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, teacherID, p.PageSize, p.Offset())
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch subjects")
		return
	}
	defer rows.Close()

	items := scanSubjects(rows)
	totalPages := (total + p.PageSize - 1) / p.PageSize
	middleware.WriteJSON(w, http.StatusOK, models.PaginatedResponse[models.Subject]{
		Items: items, Total: total, Page: p.Page, PageSize: p.PageSize, TotalPages: totalPages,
	})
}

// GetByID returns a subject by ID.
//
//	@Summary		Get subject by ID
//	@Tags			Subjects
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Subject UUID"
//	@Success		200	{object}	models.Subject
//	@Failure		404	{object}	map[string]string
//	@Router			/subjects/{id} [get]
func (h *SubjectsHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s, err := h.getSubject(r, id)
	if err != nil {
		middleware.WriteError(w, http.StatusNotFound, "subject not found")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, s)
}

// Create creates a new subject for the calling teacher.
//
//	@Summary		Create subject
//	@Tags			Subjects
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			body	body		models.CreateSubjectRequest	true	"Subject details"
//	@Success		201		{object}	models.Subject
//	@Failure		400		{object}	map[string]string
//	@Router			/subjects [post]
func (h *SubjectsHandler) Create(w http.ResponseWriter, r *http.Request) {
	callerUserID := middleware.GetUserID(r)
	callerRole := middleware.GetUserRole(r)
	var req models.CreateSubjectRequest
	if err := middleware.DecodeBody(r, &req); err != nil || req.Name == "" {
		middleware.WriteError(w, http.StatusBadRequest, "name is required")
		return
	}

	ctx := r.Context()
	var teacherID string

	if callerRole == "super_admin" {
		// super_admin must supply teacher_id in the request body to assign the subject to a teacher.
		if req.TeacherID == nil || *req.TeacherID == "" {
			middleware.WriteError(w, http.StatusBadRequest, "teacher_id is required for super_admin")
			return
		}
		teacherID = *req.TeacherID
	} else {
		if err := h.db.QueryRow(ctx, `SELECT id FROM teachers WHERE user_id = $1`, callerUserID).Scan(&teacherID); err != nil {
			middleware.WriteError(w, http.StatusNotFound, "teacher profile not found")
			return
		}
	}

	color := "#4CAF50"
	if req.Color != nil {
		color = *req.Color
	}
	icon := "pi-book"
	if req.Icon != nil {
		icon = *req.Icon
	}

	var s models.Subject
	err := h.db.QueryRow(ctx,
		`INSERT INTO subjects (teacher_id, name, description, code, color, icon)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, teacher_id, name, description, code, color, icon, is_active,
		           total_students, total_exams, total_assets, created_at, updated_at`,
		teacherID, req.Name, req.Description, req.Code, color, icon).
		Scan(&s.ID, &s.TeacherID, &s.Name, &s.Description, &s.Code, &s.Color, &s.Icon,
			&s.IsActive, &s.TotalStudents, &s.TotalExams, &s.TotalAssets, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to create subject")
		return
	}
	middleware.WriteJSON(w, http.StatusCreated, s)
}

// Update updates a subject's fields.
//
//	@Summary		Update subject
//	@Tags			Subjects
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string						true	"Subject UUID"
//	@Param			body	body		models.UpdateSubjectRequest	true	"Fields to update"
//	@Success		200		{object}	models.Subject
//	@Failure		400		{object}	map[string]string
//	@Router			/subjects/{id} [patch]
func (h *SubjectsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req models.UpdateSubjectRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	_, err := h.db.Exec(ctx,
		`UPDATE subjects SET
		   name        = COALESCE($2, name),
		   description = COALESCE($3, description),
		   code        = COALESCE($4, code),
		   color       = COALESCE($5, color),
		   icon        = COALESCE($6, icon),
		   is_active   = COALESCE($7, is_active),
		   updated_at  = NOW()
		 WHERE id = $1`,
		id, req.Name, req.Description, req.Code, req.Color, req.Icon, req.IsActive)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to update subject")
		return
	}
	h.GetByID(w, r)
}

// Delete deletes a subject.
//
//	@Summary		Delete subject
//	@Tags			Subjects
//	@Security		BearerAuth
//	@Param			id	path	string	true	"Subject UUID"
//	@Success		204
//	@Failure		500	{object}	map[string]string
//	@Router			/subjects/{id} [delete]
func (h *SubjectsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	_, err := h.db.Exec(r.Context(), `DELETE FROM subjects WHERE id = $1`, id)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to delete subject")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GetStudents returns all students enrolled in a subject.
//
//	@Summary		Get enrolled students
//	@Tags			Subjects
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Subject UUID"
//	@Success		200	{array}		models.StudentWithUser
//	@Failure		500	{object}	map[string]string
//	@Router			/subjects/{id}/students [get]
func (h *SubjectsHandler) GetStudents(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ctx := r.Context()

	rows, err := h.db.Query(ctx,
		`SELECT s.id, s.user_id, s.teacher_id, s.roll_number, s.class_name, s.section,
		        s.guardian_name, s.guardian_phone, s.address, s.date_of_birth,
		        s.total_exams_taken, s.average_score, s.created_at, s.updated_at,
		        u.id, u.email, u.full_name, u.avatar_url, u.user_role, u.status, u.phone,
		        u.auth_provider, u.auth_provider_id, u.last_login_at, u.created_by, u.created_at, u.updated_at
		 FROM students s
		 JOIN users u ON u.id = s.user_id
		 JOIN subject_enrollments se ON se.student_id = s.id
		 WHERE se.subject_id = $1
		 ORDER BY s.created_at DESC`, id)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch students")
		return
	}
	defer rows.Close()
	middleware.WriteJSON(w, http.StatusOK, scanStudentsWithUser(rows))
}

// Enroll enrolls a student in a subject.
//
//	@Summary		Enroll student in subject
//	@Tags			Subjects
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string							true	"Subject UUID"
//	@Param			body	body		models.EnrollStudentRequest		true	"Student to enroll"
//	@Success		201		{object}	models.SubjectEnrollment
//	@Failure		400		{object}	map[string]string
//	@Router			/subjects/{id}/enroll [post]
func (h *SubjectsHandler) Enroll(w http.ResponseWriter, r *http.Request) {
	subjectID := r.PathValue("id")
	callerID := middleware.GetUserID(r)

	var req models.EnrollStudentRequest
	if err := middleware.DecodeBody(r, &req); err != nil || req.StudentID == "" {
		middleware.WriteError(w, http.StatusBadRequest, "student_id required")
		return
	}

	ctx := r.Context()
	var enrollment models.SubjectEnrollment
	err := h.db.QueryRow(ctx,
		`INSERT INTO subject_enrollments (student_id, subject_id, enrolled_by)
		 VALUES ($1, $2, $3)
		 ON CONFLICT ON CONSTRAINT unique_enrollment DO NOTHING
		 RETURNING id, student_id, subject_id, enrolled_at, enrolled_by`,
		req.StudentID, subjectID, callerID).
		Scan(&enrollment.ID, &enrollment.StudentID, &enrollment.SubjectID,
			&enrollment.EnrolledAt, &enrollment.EnrolledBy)
	if err != nil {
		// If nothing was inserted (conflict), just return 200
		middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": "already enrolled"})
		return
	}

	// Update subject student count
	_, _ = h.db.Exec(ctx,
		`UPDATE subjects SET total_students = (SELECT COUNT(*) FROM subject_enrollments WHERE subject_id = $1) WHERE id = $1`,
		subjectID)

	middleware.WriteJSON(w, http.StatusCreated, enrollment)
}

// Unenroll removes a student from a subject.
//
//	@Summary		Unenroll student from subject
//	@Tags			Subjects
//	@Security		BearerAuth
//	@Param			id			path	string	true	"Subject UUID"
//	@Param			studentId	path	string	true	"Student UUID"
//	@Success		204
//	@Router			/subjects/{id}/students/{studentId} [delete]
func (h *SubjectsHandler) Unenroll(w http.ResponseWriter, r *http.Request) {
	subjectID := r.PathValue("id")
	studentID := r.PathValue("studentId")
	ctx := r.Context()

	_, _ = h.db.Exec(ctx,
		`DELETE FROM subject_enrollments WHERE student_id = $1 AND subject_id = $2`,
		studentID, subjectID)

	// Update count
	_, _ = h.db.Exec(ctx,
		`UPDATE subjects SET total_students = (SELECT COUNT(*) FROM subject_enrollments WHERE subject_id = $1) WHERE id = $1`,
		subjectID)

	w.WriteHeader(http.StatusNoContent)
}

// =============================================
// HELPERS
// =============================================

func (h *SubjectsHandler) getSubject(r *http.Request, id string) (*models.Subject, error) {
	var s models.Subject
	err := h.db.QueryRow(r.Context(),
		`SELECT id, teacher_id, name, description, code, color, icon, is_active,
		        total_students, total_exams, total_assets, created_at, updated_at
		 FROM subjects WHERE id = $1`, id).
		Scan(&s.ID, &s.TeacherID, &s.Name, &s.Description, &s.Code, &s.Color, &s.Icon,
			&s.IsActive, &s.TotalStudents, &s.TotalExams, &s.TotalAssets, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func scanSubjects(rows interface {
	Next() bool
	Scan(dest ...any) error
	Close()
}) []models.Subject {
	items := make([]models.Subject, 0)
	for rows.Next() {
		var s models.Subject
		if err := rows.Scan(&s.ID, &s.TeacherID, &s.Name, &s.Description, &s.Code, &s.Color, &s.Icon,
			&s.IsActive, &s.TotalStudents, &s.TotalExams, &s.TotalAssets, &s.CreatedAt, &s.UpdatedAt); err == nil {
			items = append(items, s)
		}
	}
	return items
}
