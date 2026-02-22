package handlers

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tutor-desk/api/internal/middleware"
	"github.com/tutor-desk/api/internal/models"
)

// AdminHandler handles super-admin dashboard endpoints.
type AdminHandler struct {
	db *pgxpool.Pool
}

func NewAdminHandler(db *pgxpool.Pool) *AdminHandler {
	return &AdminHandler{db: db}
}

// GetStats returns platform-wide statistics for the super_admin dashboard.
//
//	@Summary		Get admin stats
//	@Tags			Admin
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	models.SuperAdminDashboardStats
//	@Router			/admin/stats [get]
func (h *AdminHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var stats models.SuperAdminDashboardStats

	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM teachers`).Scan(&stats.TotalTeachers)
	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM teachers t JOIN users u ON u.id = t.user_id WHERE u.status = 'pending'`).Scan(&stats.PendingTeachers)
	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM teachers t JOIN users u ON u.id = t.user_id WHERE u.status = 'active'`).Scan(&stats.ActiveTeachers)
	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM teachers t JOIN users u ON u.id = t.user_id WHERE u.status = 'disabled'`).Scan(&stats.DisabledTeachers)
	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM students`).Scan(&stats.TotalStudents)
	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM exams`).Scan(&stats.TotalExams)

	middleware.WriteJSON(w, http.StatusOK, stats)
}
