package handlers

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tutor-desk/api/internal/middleware"
	"github.com/tutor-desk/api/internal/models"
)

// UsersHandler handles user profile operations.
type UsersHandler struct {
	db *pgxpool.Pool
}

func NewUsersHandler(db *pgxpool.Pool) *UsersHandler {
	return &UsersHandler{db: db}
}

// GET /api/v1/users/{id}
func (h *UsersHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ctx := r.Context()

	var u models.User
	var ph *string
	err := h.db.QueryRow(ctx,
		`SELECT id, email, password_hash, full_name, avatar_url, role, status, phone,
		        auth_provider, auth_provider_id, last_login_at, created_by, created_at, updated_at
		 FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.Email, &ph, &u.FullName, &u.AvatarURL, &u.Role, &u.Status, &u.Phone,
			&u.AuthProvider, &u.AuthProviderID, &u.LastLoginAt, &u.CreatedBy, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		middleware.WriteError(w, http.StatusNotFound, "user not found")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, u)
}

// PATCH /api/v1/users/{id}
func (h *UsersHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	callerID := middleware.GetUserID(r)
	callerRole := middleware.GetUserRole(r)

	// Users can only update themselves, unless super_admin
	if callerID != id && callerRole != "super_admin" {
		middleware.WriteError(w, http.StatusForbidden, "cannot update another user's profile")
		return
	}

	var req models.UpdateUserRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	_, err := h.db.Exec(ctx,
		`UPDATE users SET
		   full_name  = COALESCE($2, full_name),
		   avatar_url = COALESCE($3, avatar_url),
		   phone      = COALESCE($4, phone),
		   updated_at = NOW()
		 WHERE id = $1`,
		id, req.FullName, req.AvatarURL, req.Phone)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to update user")
		return
	}

	h.GetByID(w, r)
}

// PATCH /api/v1/users/{id}/status  [super_admin only]
func (h *UsersHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req models.UpdateUserStatusRequest
	if err := middleware.DecodeBody(r, &req); err != nil || req.Status == "" {
		middleware.WriteError(w, http.StatusBadRequest, "status required")
		return
	}

	ctx := r.Context()
	res, err := h.db.Exec(ctx,
		`UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1`, id, req.Status)
	if err != nil || res.RowsAffected() == 0 {
		middleware.WriteError(w, http.StatusNotFound, "user not found")
		return
	}
	h.GetByID(w, r)
}
