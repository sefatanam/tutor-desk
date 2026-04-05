package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tutor-desk/api/internal/middleware"
	"github.com/tutor-desk/api/internal/models"
)

// AssetsHandler handles asset CRUD and file upload endpoints.
type AssetsHandler struct {
	db          *pgxpool.Pool
	uploadDir   string
	maxUploadMB int64
}

func NewAssetsHandler(db *pgxpool.Pool, uploadDir string, maxUploadMB int64) *AssetsHandler {
	return &AssetsHandler{db: db, uploadDir: uploadDir, maxUploadMB: maxUploadMB}
}

const assetCols = `
	id, subject_id, teacher_id, title, description, asset_type,
	file_url, file_name, file_size_bytes, mime_type, external_url,
	thumbnail_url, sequence_number, is_published, created_at, updated_at`

func scanAsset(row interface {
	Scan(dest ...any) error
}) (models.Asset, error) {
	var a models.Asset
	err := row.Scan(&a.ID, &a.SubjectID, &a.TeacherID, &a.Title, &a.Description, &a.AssetType,
		&a.FileURL, &a.FileName, &a.FileSizeBytes, &a.MimeType, &a.ExternalURL,
		&a.ThumbnailURL, &a.SequenceNumber, &a.IsPublished, &a.CreatedAt, &a.UpdatedAt)
	return a, err
}

// GetAll returns a paginated list of assets (students see only published ones).
//
//	@Summary		List assets
//	@Tags			Assets
//	@Produce		json
//	@Security		BearerAuth
//	@Param			subject_id	query		string	false	"Filter by subject UUID"
//	@Param			asset_type	query		string	false	"Filter by asset type"
//	@Param			page		query		int		false	"Page number"
//	@Param			page_size	query		int		false	"Page size"
//	@Success		200		{object}	models.PaginatedResponse[models.Asset]
//	@Failure		500		{object}	map[string]string
//	@Router			/assets [get]
func (h *AssetsHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	subjectID := r.URL.Query().Get("subject_id")
	assetType := r.URL.Query().Get("asset_type")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	p := models.NewPaginationParams(page, pageSize)
	ctx := r.Context()

	where := "WHERE 1=1"
	args := []any{}
	argN := 1

	if subjectID != "" {
		where += fmt.Sprintf(" AND subject_id = $%d", argN)
		args = append(args, subjectID)
		argN++
	}
	if assetType != "" {
		where += fmt.Sprintf(" AND asset_type = $%d", argN)
		args = append(args, assetType)
		argN++
	}
	// Students only see published assets
	role := middleware.GetUserRole(r)
	if role == "student" {
		where += " AND is_published = true"
	}

	var total int
	countArgs := make([]any, len(args))
	copy(countArgs, args)
	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM assets `+where, countArgs...).Scan(&total)

	limitArgs := append(args, p.PageSize, p.Offset())
	rows, err := h.db.Query(ctx,
		`SELECT `+assetCols+` FROM assets `+where+
			fmt.Sprintf(` ORDER BY sequence_number ASC, created_at DESC LIMIT $%d OFFSET $%d`, argN, argN+1),
		limitArgs...)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch assets")
		return
	}
	defer rows.Close()

	var items []models.Asset
	for rows.Next() {
		a, err := scanAsset(rows)
		if err == nil {
			items = append(items, a)
		}
	}
	if items == nil {
		items = []models.Asset{}
	}
	totalPages := (total + p.PageSize - 1) / p.PageSize
	middleware.WriteJSON(w, http.StatusOK, models.PaginatedResponse[models.Asset]{
		Items: items, Total: total, Page: p.Page, PageSize: p.PageSize, TotalPages: totalPages,
	})
}

// GetByID returns an asset by ID.
//
//	@Summary		Get asset by ID
//	@Tags			Assets
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Asset UUID"
//	@Success		200	{object}	models.Asset
//	@Failure		404	{object}	map[string]string
//	@Router			/assets/{id} [get]
func (h *AssetsHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	a, err := scanAsset(h.db.QueryRow(r.Context(),
		`SELECT `+assetCols+` FROM assets WHERE id = $1`, id))
	if err != nil {
		middleware.WriteError(w, http.StatusNotFound, "asset not found")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, a)
}

// Create uploads a new asset (multipart/form-data).
//
//	@Summary		Create asset
//	@Tags			Assets
//	@Accept			mpfd
//	@Produce		json
//	@Security		BearerAuth
//	@Param			title		formData	string	true	"Asset title"
//	@Param			subject_id	formData	string	true	"Subject UUID"
//	@Param			asset_type	formData	string	true	"Asset type"
//	@Param			description	formData	string	false	"Description"
//	@Param			external_url formData	string	false	"External URL"
//	@Param			file		formData	file	false	"File to upload"
//	@Success		201		{object}	models.Asset
//	@Failure		400		{object}	map[string]string
//	@Router			/assets [post]
func (h *AssetsHandler) Create(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(h.maxUploadMB << 20); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "failed to parse form")
		return
	}

	title := r.FormValue("title")
	description := r.FormValue("description")
	subjectID := r.FormValue("subject_id")
	assetType := r.FormValue("asset_type")
	externalURL := r.FormValue("external_url")
	teacherID := middleware.GetUserID(r)

	if title == "" || subjectID == "" || assetType == "" {
		middleware.WriteError(w, http.StatusBadRequest, "title, subject_id and asset_type required")
		return
	}

	var fileURL, fileName *string
	var fileSizeBytes *int64
	var mimeType *string

	file, header, fileErr := r.FormFile("file")
	if fileErr == nil {
		defer file.Close()

		ext := filepath.Ext(header.Filename)
		uniqueName := uuid.New().String() + ext
		destPath := filepath.Join(h.uploadDir, uniqueName)

		if err := os.MkdirAll(h.uploadDir, 0755); err != nil {
			middleware.WriteError(w, http.StatusInternalServerError, "failed to create upload directory")
			return
		}

		dest, err := os.Create(destPath)
		if err != nil {
			middleware.WriteError(w, http.StatusInternalServerError, "failed to save file")
			return
		}
		defer dest.Close()

		written, err := io.Copy(dest, file)
		if err != nil {
			middleware.WriteError(w, http.StatusInternalServerError, "failed to write file")
			return
		}

		url := "/uploads/" + uniqueName
		mime := header.Header.Get("Content-Type")
		if mime == "" {
			mime = "application/octet-stream"
		}
		name := header.Filename

		fileURL = &url
		fileName = &name
		fileSizeBytes = &written
		mimeType = &mime
	}

	var extURLPtr *string
	if externalURL != "" {
		extURLPtr = &externalURL
	}
	var descPtr *string
	if description != "" {
		descPtr = &description
	}

	ctx := r.Context()
	a, err := scanAsset(h.db.QueryRow(ctx,
		`INSERT INTO assets (subject_id, teacher_id, title, description, asset_type,
		                     file_url, file_name, file_size_bytes, mime_type, external_url)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 RETURNING `+assetCols,
		subjectID, teacherID, title, descPtr, assetType,
		fileURL, fileName, fileSizeBytes, mimeType, extURLPtr))
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to create asset record")
		return
	}
	middleware.WriteJSON(w, http.StatusCreated, a)
}

// Update updates an asset's metadata.
//
//	@Summary		Update asset
//	@Tags			Assets
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string						true	"Asset UUID"
//	@Param			body	body		models.UpdateAssetRequest	true	"Fields to update"
//	@Success		200		{object}	models.Asset
//	@Failure		400		{object}	map[string]string
//	@Router			/assets/{id} [patch]
func (h *AssetsHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req models.UpdateAssetRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	_, err := h.db.Exec(ctx,
		`UPDATE assets SET
		   title           = COALESCE($2, title),
		   description     = COALESCE($3, description),
		   external_url    = COALESCE($4, external_url),
		   sequence_number = COALESCE($5, sequence_number),
		   is_published    = COALESCE($6, is_published),
		   updated_at      = NOW()
		 WHERE id = $1`,
		id, req.Title, req.Description, req.ExternalURL, req.SequenceNumber, req.IsPublished)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to update asset")
		return
	}

	a, _ := scanAsset(h.db.QueryRow(ctx, `SELECT `+assetCols+` FROM assets WHERE id = $1`, id))
	middleware.WriteJSON(w, http.StatusOK, a)
}

// TogglePublish publishes or unpublishes an asset.
//
//	@Summary		Toggle asset publish
//	@Tags			Assets
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string	true	"Asset UUID"
//	@Param			body	body		object	true	"{'is_published': true}"
//	@Success		200		{object}	models.Asset
//	@Failure		400		{object}	map[string]string
//	@Router			/assets/{id}/publish [patch]
func (h *AssetsHandler) TogglePublish(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		IsPublished bool `json:"is_published"`
	}
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	_, err := h.db.Exec(ctx,
		`UPDATE assets SET is_published = $2, updated_at = NOW() WHERE id = $1`, id, req.IsPublished)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to update asset")
		return
	}

	a, _ := scanAsset(h.db.QueryRow(ctx, `SELECT `+assetCols+` FROM assets WHERE id = $1`, id))
	middleware.WriteJSON(w, http.StatusOK, a)
}

// Delete deletes an asset record and its uploaded file.
//
//	@Summary		Delete asset
//	@Tags			Assets
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Asset UUID"
//	@Success		200	{object}	map[string]string
//	@Failure		500	{object}	map[string]string
//	@Router			/assets/{id} [delete]
func (h *AssetsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ctx := r.Context()

	// Fetch file URL before deleting record
	var fileURL *string
	_ = h.db.QueryRow(ctx, `SELECT file_url FROM assets WHERE id = $1`, id).Scan(&fileURL)

	_, err := h.db.Exec(ctx, `DELETE FROM assets WHERE id = $1`, id)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to delete asset")
		return
	}

	// Remove the physical file (best effort)
	if fileURL != nil && strings.HasPrefix(*fileURL, "/uploads/") {
		filename := strings.TrimPrefix(*fileURL, "/uploads/")
		_ = os.Remove(filepath.Join(h.uploadDir, filename))
	}

	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": "asset deleted"})
}

// ServeFile serves an uploaded file by filename.
//
//	@Summary		Serve uploaded file
//	@Tags			Assets
//	@Produce		application/octet-stream
//	@Param			filename	path		string	true	"Filename"
//	@Success		200
//	@Failure		400	{object}	map[string]string
//	@Failure		404	{object}	map[string]string
//	@Router			/uploads/{filename} [get]
func (h *AssetsHandler) ServeFile(w http.ResponseWriter, r *http.Request) {
	filename := r.PathValue("filename")
	// Prevent path traversal
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") {
		middleware.WriteError(w, http.StatusBadRequest, "invalid filename")
		return
	}
	filePath := filepath.Join(h.uploadDir, filename)

	f, err := os.Open(filePath)
	if err != nil {
		middleware.WriteError(w, http.StatusNotFound, "file not found")
		return
	}
	defer f.Close()

	http.ServeContent(w, r, filename, time.Time{}, f)
}
