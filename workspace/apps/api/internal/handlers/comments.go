package handlers

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tutor-desk/api/internal/middleware"
	"github.com/tutor-desk/api/internal/models"
)

// CommentsHandler handles asset comment CRUD endpoints.
type CommentsHandler struct {
	db *pgxpool.Pool
}

func NewCommentsHandler(db *pgxpool.Pool) *CommentsHandler {
	return &CommentsHandler{db: db}
}

const commentWithUserSQL = `
	SELECT c.id, c.asset_id, c.user_id, c.parent_id, c.content, c.is_visible, c.created_at, c.updated_at,
	       u.id, u.full_name, u.avatar_url, u.user_role
	FROM asset_comments c
	JOIN users u ON u.id = c.user_id`

func scanCommentWithUser(row interface {
	Scan(dest ...any) error
}) (models.AssetCommentWithUser, error) {
	var c models.AssetCommentWithUser
	err := row.Scan(
		&c.ID, &c.AssetID, &c.UserID, &c.ParentID, &c.Content, &c.IsVisible, &c.CreatedAt, &c.UpdatedAt,
		&c.User.ID, &c.User.FullName, &c.User.AvatarURL, &c.User.Role,
	)
	return c, err
}

// GetByAsset returns all comments for an asset (students only see visible ones).
//
//	@Summary		List comments for asset
//	@Tags			Comments
//	@Produce		json
//	@Security		BearerAuth
//	@Param			assetId	path		string	true	"Asset UUID"
//	@Success		200		{array}		models.AssetCommentWithUser
//	@Failure		500		{object}	map[string]string
//	@Router			/assets/{assetId}/comments [get]
func (h *CommentsHandler) GetByAsset(w http.ResponseWriter, r *http.Request) {
	assetID := r.PathValue("assetId")
	ctx := r.Context()

	role := middleware.GetUserRole(r)
	visibilityFilter := ""
	if role == "student" {
		visibilityFilter = " AND c.is_visible = true"
	}

	rows, err := h.db.Query(ctx,
		commentWithUserSQL+
			` WHERE c.asset_id = $1`+visibilityFilter+
			` ORDER BY c.created_at ASC`, assetID)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch comments")
		return
	}
	defer rows.Close()

	var items []models.AssetCommentWithUser
	for rows.Next() {
		c, err := scanCommentWithUser(rows)
		if err == nil {
			items = append(items, c)
		}
	}
	if items == nil {
		items = []models.AssetCommentWithUser{}
	}
	middleware.WriteJSON(w, http.StatusOK, items)
}

// Create posts a new comment on an asset.
//
//	@Summary		Create comment
//	@Tags			Comments
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			assetId	path		string						true	"Asset UUID"
//	@Param			body	body		models.CreateCommentRequest	true	"Comment content"
//	@Success		201		{object}	models.AssetCommentWithUser
//	@Failure		400		{object}	map[string]string
//	@Router			/assets/{assetId}/comments [post]
func (h *CommentsHandler) Create(w http.ResponseWriter, r *http.Request) {
	assetID := r.PathValue("assetId")
	var req models.CreateCommentRequest
	if err := middleware.DecodeBody(r, &req); err != nil || req.Content == "" {
		middleware.WriteError(w, http.StatusBadRequest, "content required")
		return
	}

	userID := middleware.GetUserID(r)
	ctx := r.Context()

	var newID string
	err := h.db.QueryRow(ctx,
		`INSERT INTO asset_comments (asset_id, user_id, parent_id, content)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		assetID, userID, req.ParentID, req.Content).Scan(&newID)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to create comment")
		return
	}

	c, err := scanCommentWithUser(h.db.QueryRow(ctx,
		commentWithUserSQL+` WHERE c.id = $1`, newID))
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch created comment")
		return
	}
	middleware.WriteJSON(w, http.StatusCreated, c)
}

// Update edits the content of a comment.
//
//	@Summary		Update comment
//	@Tags			Comments
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string						true	"Comment UUID"
//	@Param			body	body		models.UpdateCommentRequest	true	"New content"
//	@Success		200		{object}	models.AssetCommentWithUser
//	@Failure		400		{object}	map[string]string
//	@Router			/comments/{id} [patch]
func (h *CommentsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req models.UpdateCommentRequest
	if err := middleware.DecodeBody(r, &req); err != nil || req.Content == "" {
		middleware.WriteError(w, http.StatusBadRequest, "content required")
		return
	}

	ctx := r.Context()
	_, err := h.db.Exec(ctx,
		`UPDATE asset_comments SET content = $2, updated_at = NOW() WHERE id = $1`, id, req.Content)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to update comment")
		return
	}

	c, _ := scanCommentWithUser(h.db.QueryRow(ctx, commentWithUserSQL+` WHERE c.id = $1`, id))
	middleware.WriteJSON(w, http.StatusOK, c)
}

// ToggleVisibility shows or hides a comment (teacher only).
//
//	@Summary		Toggle comment visibility
//	@Tags			Comments
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string							true	"Comment UUID"
//	@Param			body	body		models.ToggleVisibilityRequest	true	"Visibility flag"
//	@Success		200		{object}	models.AssetCommentWithUser
//	@Failure		400		{object}	map[string]string
//	@Router			/comments/{id}/visibility [patch]
func (h *CommentsHandler) ToggleVisibility(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req models.ToggleVisibilityRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	_, err := h.db.Exec(ctx,
		`UPDATE asset_comments SET is_visible = $2, updated_at = NOW() WHERE id = $1`, id, req.IsVisible)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to update visibility")
		return
	}

	c, _ := scanCommentWithUser(h.db.QueryRow(ctx, commentWithUserSQL+` WHERE c.id = $1`, id))
	middleware.WriteJSON(w, http.StatusOK, c)
}

// Delete deletes a comment.
//
//	@Summary		Delete comment
//	@Tags			Comments
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Comment UUID"
//	@Success		200	{object}	map[string]string
//	@Failure		500	{object}	map[string]string
//	@Router			/comments/{id} [delete]
func (h *CommentsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	_, err := h.db.Exec(r.Context(), `DELETE FROM asset_comments WHERE id = $1`, id)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to delete comment")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": "comment deleted"})
}
