package router

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	httpSwagger "github.com/swaggo/http-swagger"

	"github.com/tutor-desk/api/internal/config"
	"github.com/tutor-desk/api/internal/handlers"
	"github.com/tutor-desk/api/internal/middleware"
)

// New builds and returns the HTTP mux with all routes registered.
func New(db *pgxpool.Pool, cfg *config.Config) http.Handler {
	mux := http.NewServeMux()

	// Instantiate handlers
	auth := handlers.NewAuthHandler(db, cfg.JWTSecret)
	users := handlers.NewUsersHandler(db)
	teachers := handlers.NewTeachersHandler(db)
	students := handlers.NewStudentsHandler(db)
	subjects := handlers.NewSubjectsHandler(db)
	exams := handlers.NewExamsHandler(db)
	questions := handlers.NewQuestionsHandler(db)
	submissions := handlers.NewSubmissionsHandler(db)
	assets := handlers.NewAssetsHandler(db, cfg.UploadDir)
	comments := handlers.NewCommentsHandler(db)
	admin := handlers.NewAdminHandler(db)
	settings := handlers.NewSettingsHandler(db)

	// ─── Middleware helpers ───────────────────────────────────────────────────
	jwtSecret := cfg.JWTSecret
	authMW := middleware.Auth(jwtSecret)
	superAdmin := middleware.RequireRole(jwtSecret, "super_admin")
	teacherOrAdmin := middleware.RequireRole(jwtSecret, "teacher", "super_admin")
	anyRole := middleware.RequireRole(jwtSecret, "teacher", "student", "super_admin")

	// ─── Static file serving ─────────────────────────────────────────────────
	mux.HandleFunc("GET /uploads/{filename}", assets.ServeFile)

	// ─── Auth (public) ───────────────────────────────────────────────────────
	mux.HandleFunc("POST /api/v1/auth/login", auth.Login)
	mux.HandleFunc("POST /api/v1/auth/signup", auth.Signup)
	mux.HandleFunc("POST /api/v1/auth/refresh", auth.Refresh)
	mux.HandleFunc("POST /api/v1/auth/logout", auth.Logout)
	mux.HandleFunc("POST /api/v1/auth/reset-password", auth.ResetPassword)

	// POST /api/v1/auth/create-student — teacher creates a student account
	mux.Handle("POST /api/v1/auth/create-student",
		authMW(teacherOrAdmin(http.HandlerFunc(auth.CreateStudent))))

	// ─── Users ───────────────────────────────────────────────────────────────
	mux.Handle("GET /api/v1/users/{id}", authMW(anyRole(http.HandlerFunc(users.GetByID))))
	mux.Handle("PATCH /api/v1/users/{id}", authMW(anyRole(http.HandlerFunc(users.Update))))
	mux.Handle("PATCH /api/v1/users/{id}/status",
		authMW(superAdmin(http.HandlerFunc(users.UpdateStatus))))

	// ─── Teachers ────────────────────────────────────────────────────────────
	mux.Handle("GET /api/v1/teachers",
		authMW(superAdmin(http.HandlerFunc(teachers.GetAll))))
	mux.Handle("GET /api/v1/teachers/pending",
		authMW(superAdmin(http.HandlerFunc(teachers.GetPending))))
	mux.Handle("GET /api/v1/teachers/{id}",
		authMW(teacherOrAdmin(http.HandlerFunc(teachers.GetByID))))
	mux.Handle("GET /api/v1/teachers/{id}/stats",
		authMW(teacherOrAdmin(http.HandlerFunc(teachers.GetStats))))
	mux.Handle("PATCH /api/v1/teachers/{id}",
		authMW(teacherOrAdmin(http.HandlerFunc(teachers.Update))))
	mux.Handle("POST /api/v1/teachers/{id}/approve",
		authMW(superAdmin(http.HandlerFunc(teachers.Approve))))
	mux.Handle("POST /api/v1/teachers/{id}/disable",
		authMW(superAdmin(http.HandlerFunc(teachers.Disable))))
	mux.Handle("POST /api/v1/teachers/{id}/enable",
		authMW(superAdmin(http.HandlerFunc(teachers.Enable))))
	mux.Handle("DELETE /api/v1/teachers/{id}",
		authMW(superAdmin(http.HandlerFunc(teachers.Delete))))

	// ─── Students ────────────────────────────────────────────────────────────
	mux.Handle("GET /api/v1/students",
		authMW(teacherOrAdmin(http.HandlerFunc(students.GetAll))))
	mux.Handle("GET /api/v1/students/{id}",
		authMW(anyRole(http.HandlerFunc(students.GetByID))))
	mux.Handle("GET /api/v1/students/{id}/stats",
		authMW(anyRole(http.HandlerFunc(students.GetStats))))
	mux.Handle("PATCH /api/v1/students/{id}",
		authMW(anyRole(http.HandlerFunc(students.Update))))
	mux.Handle("POST /api/v1/students/{id}/disable",
		authMW(teacherOrAdmin(http.HandlerFunc(students.Disable))))
	mux.Handle("POST /api/v1/students/{id}/enable",
		authMW(teacherOrAdmin(http.HandlerFunc(students.Enable))))
	mux.Handle("DELETE /api/v1/students/{id}",
		authMW(teacherOrAdmin(http.HandlerFunc(students.Delete))))
	mux.Handle("GET /api/v1/students/{studentId}/submissions",
		authMW(anyRole(http.HandlerFunc(submissions.GetByStudent))))

	// ─── Subjects ────────────────────────────────────────────────────────────
	mux.Handle("GET /api/v1/subjects",
		authMW(anyRole(http.HandlerFunc(subjects.GetAll))))
	mux.Handle("GET /api/v1/subjects/{id}",
		authMW(anyRole(http.HandlerFunc(subjects.GetByID))))
	mux.Handle("POST /api/v1/subjects",
		authMW(teacherOrAdmin(http.HandlerFunc(subjects.Create))))
	mux.Handle("PATCH /api/v1/subjects/{id}",
		authMW(teacherOrAdmin(http.HandlerFunc(subjects.Update))))
	mux.Handle("DELETE /api/v1/subjects/{id}",
		authMW(teacherOrAdmin(http.HandlerFunc(subjects.Delete))))
	mux.Handle("GET /api/v1/subjects/{id}/students",
		authMW(teacherOrAdmin(http.HandlerFunc(subjects.GetStudents))))
	mux.Handle("POST /api/v1/subjects/{id}/enroll",
		authMW(teacherOrAdmin(http.HandlerFunc(subjects.Enroll))))
	mux.Handle("DELETE /api/v1/subjects/{id}/enroll/{studentId}",
		authMW(teacherOrAdmin(http.HandlerFunc(subjects.Unenroll))))

	// ─── Exams ───────────────────────────────────────────────────────────────
	mux.Handle("GET /api/v1/exams",
		authMW(anyRole(http.HandlerFunc(exams.GetAll))))
	mux.Handle("GET /api/v1/exams/upcoming",
		authMW(anyRole(http.HandlerFunc(exams.GetUpcoming))))
	mux.Handle("GET /api/v1/exams/{id}",
		authMW(anyRole(http.HandlerFunc(exams.GetByID))))
	mux.Handle("POST /api/v1/exams",
		authMW(teacherOrAdmin(http.HandlerFunc(exams.Create))))
	mux.Handle("PATCH /api/v1/exams/{id}",
		authMW(teacherOrAdmin(http.HandlerFunc(exams.Update))))
	mux.Handle("POST /api/v1/exams/{id}/publish",
		authMW(teacherOrAdmin(http.HandlerFunc(exams.Publish))))
	mux.Handle("POST /api/v1/exams/{id}/cancel",
		authMW(teacherOrAdmin(http.HandlerFunc(exams.Cancel))))
	mux.Handle("DELETE /api/v1/exams/{id}",
		authMW(teacherOrAdmin(http.HandlerFunc(exams.Delete))))

	// Exam assignments
	mux.Handle("GET /api/v1/exams/{id}/assignments",
		authMW(teacherOrAdmin(http.HandlerFunc(exams.GetAssignments))))
	mux.Handle("POST /api/v1/exams/{id}/assign-student",
		authMW(teacherOrAdmin(http.HandlerFunc(exams.AssignStudent))))
	mux.Handle("POST /api/v1/exams/{id}/assign-subject",
		authMW(teacherOrAdmin(http.HandlerFunc(exams.AssignSubject))))
	mux.Handle("DELETE /api/v1/exams/{id}/assignments/{assignmentId}",
		authMW(teacherOrAdmin(http.HandlerFunc(exams.DeleteAssignment))))

	// Exam submissions list
	mux.Handle("GET /api/v1/exams/{examId}/submissions",
		authMW(teacherOrAdmin(http.HandlerFunc(submissions.GetByExam))))

	// ─── Questions ───────────────────────────────────────────────────────────
	mux.Handle("GET /api/v1/exams/{examId}/questions",
		authMW(anyRole(http.HandlerFunc(questions.GetByExam))))
	mux.Handle("POST /api/v1/exams/{examId}/questions",
		authMW(teacherOrAdmin(http.HandlerFunc(questions.Create))))
	mux.Handle("POST /api/v1/exams/{examId}/questions/bulk",
		authMW(teacherOrAdmin(http.HandlerFunc(questions.CreateBulk))))
	mux.Handle("POST /api/v1/exams/{examId}/questions/reorder",
		authMW(teacherOrAdmin(http.HandlerFunc(questions.Reorder))))
	mux.Handle("GET /api/v1/questions/{id}",
		authMW(anyRole(http.HandlerFunc(questions.GetByID))))
	mux.Handle("PATCH /api/v1/questions/{id}",
		authMW(teacherOrAdmin(http.HandlerFunc(questions.Update))))
	mux.Handle("DELETE /api/v1/questions/{id}",
		authMW(teacherOrAdmin(http.HandlerFunc(questions.Delete))))

	// ─── Submissions ─────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/submissions/start",
		authMW(anyRole(http.HandlerFunc(submissions.Start))))
	mux.Handle("GET /api/v1/submissions/{id}",
		authMW(anyRole(http.HandlerFunc(submissions.GetByID))))
	mux.Handle("POST /api/v1/submissions/{id}/answer",
		authMW(anyRole(http.HandlerFunc(submissions.SubmitAnswer))))
	mux.Handle("PATCH /api/v1/submissions/{id}/answer/{answerId}",
		authMW(anyRole(http.HandlerFunc(submissions.UpdateAnswer))))
	mux.Handle("POST /api/v1/submissions/{id}/submit",
		authMW(anyRole(http.HandlerFunc(submissions.Submit))))
	mux.Handle("POST /api/v1/submissions/{id}/auto-submit",
		authMW(anyRole(http.HandlerFunc(submissions.AutoSubmit))))
	mux.Handle("POST /api/v1/submissions/{id}/evaluate",
		authMW(teacherOrAdmin(http.HandlerFunc(submissions.Evaluate))))
	mux.Handle("POST /api/v1/submissions/{id}/allow-retake",
		authMW(teacherOrAdmin(http.HandlerFunc(submissions.AllowRetake))))
	mux.Handle("POST /api/v1/submissions/{id}/cancel-retake",
		authMW(teacherOrAdmin(http.HandlerFunc(submissions.CancelRetake))))

	// ─── Assets ──────────────────────────────────────────────────────────────
	mux.Handle("GET /api/v1/assets",
		authMW(anyRole(http.HandlerFunc(assets.GetAll))))
	mux.Handle("GET /api/v1/assets/{id}",
		authMW(anyRole(http.HandlerFunc(assets.GetByID))))
	mux.Handle("POST /api/v1/assets",
		authMW(teacherOrAdmin(http.HandlerFunc(assets.Create))))
	mux.Handle("PATCH /api/v1/assets/{id}",
		authMW(teacherOrAdmin(http.HandlerFunc(assets.Update))))
	mux.Handle("PATCH /api/v1/assets/{id}/publish",
		authMW(teacherOrAdmin(http.HandlerFunc(assets.TogglePublish))))
	mux.Handle("DELETE /api/v1/assets/{id}",
		authMW(teacherOrAdmin(http.HandlerFunc(assets.Delete))))

	// ─── Comments ────────────────────────────────────────────────────────────
	mux.Handle("GET /api/v1/assets/{assetId}/comments",
		authMW(anyRole(http.HandlerFunc(comments.GetByAsset))))
	mux.Handle("POST /api/v1/assets/{assetId}/comments",
		authMW(anyRole(http.HandlerFunc(comments.Create))))
	mux.Handle("PATCH /api/v1/comments/{id}",
		authMW(anyRole(http.HandlerFunc(comments.Update))))
	mux.Handle("PATCH /api/v1/comments/{id}/visibility",
		authMW(teacherOrAdmin(http.HandlerFunc(comments.ToggleVisibility))))
	mux.Handle("DELETE /api/v1/comments/{id}",
		authMW(anyRole(http.HandlerFunc(comments.Delete))))

	// ─── Admin ───────────────────────────────────────────────────────────────
	mux.Handle("GET /api/v1/admin/stats",
		authMW(superAdmin(http.HandlerFunc(admin.GetStats))))

	// ─── Settings ────────────────────────────────────────────────────────────
	mux.Handle("GET /api/v1/settings/categories",
		authMW(anyRole(http.HandlerFunc(settings.GetCategories))))
	mux.Handle("GET /api/v1/settings/categories/{id}",
		authMW(anyRole(http.HandlerFunc(settings.GetCategoryByID))))
	mux.Handle("POST /api/v1/settings/categories",
		authMW(superAdmin(http.HandlerFunc(settings.CreateCategory))))
	mux.Handle("PATCH /api/v1/settings/categories/{id}",
		authMW(superAdmin(http.HandlerFunc(settings.UpdateCategory))))
	mux.Handle("DELETE /api/v1/settings/categories/{id}",
		authMW(superAdmin(http.HandlerFunc(settings.DeleteCategory))))

	mux.Handle("GET /api/v1/settings",
		authMW(anyRole(http.HandlerFunc(settings.GetSettings))))
	mux.Handle("GET /api/v1/settings/{key}",
		authMW(anyRole(http.HandlerFunc(settings.GetSettingByKey))))
	mux.Handle("POST /api/v1/settings",
		authMW(superAdmin(http.HandlerFunc(settings.CreateSetting))))
	mux.Handle("PATCH /api/v1/settings/{key}",
		authMW(superAdmin(http.HandlerFunc(settings.UpdateSetting))))
	mux.Handle("PUT /api/v1/settings/{key}",
		authMW(superAdmin(http.HandlerFunc(settings.UpdateSettingValue))))
	mux.Handle("DELETE /api/v1/settings/{key}",
		authMW(superAdmin(http.HandlerFunc(settings.DeleteSetting))))
	mux.Handle("POST /api/v1/settings/bulk-update",
		authMW(superAdmin(http.HandlerFunc(settings.BulkUpdateValues))))

	// ─── Health ──────────────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		middleware.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// ─── Swagger UI ──────────────────────────────────────────────────────────
	// No auth required — accessible at http://localhost:8080/swagger/
	mux.Handle("/swagger/", httpSwagger.WrapHandler)

	return middleware.CORS(cfg.CORSOrigins)(middleware.Logging(mux))
}
