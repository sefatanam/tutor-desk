package handlers

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tutor-desk/api/internal/middleware"
	"github.com/tutor-desk/api/internal/models"
)

// SettingsHandler handles settings categories and system settings endpoints.
type SettingsHandler struct {
	db *pgxpool.Pool
}

func NewSettingsHandler(db *pgxpool.Pool) *SettingsHandler {
	return &SettingsHandler{db: db}
}

// =============================================
// SETTINGS CATEGORIES
// =============================================

const categoryCol = `id, name, label, icon, description, sort_order, created_at, updated_at`

func scanCategory(row interface{ Scan(dest ...any) error }) (models.SettingsCategory, error) {
	var c models.SettingsCategory
	err := row.Scan(&c.ID, &c.Name, &c.Label, &c.Icon, &c.Description, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt)
	return c, err
}

// GetCategories returns all settings categories.
//
//	@Summary		List settings categories
//	@Tags			Settings
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{array}		models.SettingsCategory
//	@Failure		500	{object}	map[string]string
//	@Router			/settings/categories [get]
func (h *SettingsHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(r.Context(),
		`SELECT `+categoryCol+` FROM settings_categories ORDER BY sort_order ASC`)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch categories")
		return
	}
	defer rows.Close()

	var items []models.SettingsCategory
	for rows.Next() {
		c, err := scanCategory(rows)
		if err == nil {
			items = append(items, c)
		}
	}
	if items == nil {
		items = []models.SettingsCategory{}
	}
	middleware.WriteJSON(w, http.StatusOK, items)
}

// GetCategoryByID returns a settings category by ID.
//
//	@Summary		Get settings category by ID
//	@Tags			Settings
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Category UUID"
//	@Success		200	{object}	models.SettingsCategory
//	@Failure		404	{object}	map[string]string
//	@Router			/settings/categories/{id} [get]
func (h *SettingsHandler) GetCategoryByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	c, err := scanCategory(h.db.QueryRow(r.Context(),
		`SELECT `+categoryCol+` FROM settings_categories WHERE id = $1`, id))
	if err != nil {
		middleware.WriteError(w, http.StatusNotFound, "category not found")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, c)
}

// CreateCategory creates a new settings category.
//
//	@Summary		Create settings category
//	@Tags			Settings
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			body	body		models.CreateSettingsCategoryRequest	true	"Category details"
//	@Success		201		{object}	models.SettingsCategory
//	@Failure		400		{object}	map[string]string
//	@Router			/settings/categories [post]
func (h *SettingsHandler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	var req models.CreateSettingsCategoryRequest
	if err := middleware.DecodeBody(r, &req); err != nil || req.Name == "" || req.Label == "" {
		middleware.WriteError(w, http.StatusBadRequest, "name and label required")
		return
	}

	ctx := r.Context()
	c, err := scanCategory(h.db.QueryRow(ctx,
		`INSERT INTO settings_categories (name, label, icon, description, sort_order)
		 VALUES ($1, $2, $3, $4, COALESCE($5, 0))
		 RETURNING `+categoryCol,
		req.Name, req.Label, req.Icon, req.Description, req.SortOrder))
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to create category")
		return
	}
	middleware.WriteJSON(w, http.StatusCreated, c)
}

// UpdateCategory updates a settings category.
//
//	@Summary		Update settings category
//	@Tags			Settings
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id		path		string									true	"Category UUID"
//	@Param			body	body		models.UpdateSettingsCategoryRequest	true	"Fields to update"
//	@Success		200		{object}	models.SettingsCategory
//	@Failure		400		{object}	map[string]string
//	@Router			/settings/categories/{id} [patch]
func (h *SettingsHandler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req models.UpdateSettingsCategoryRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	_, err := h.db.Exec(ctx,
		`UPDATE settings_categories SET
		   name        = COALESCE($2, name),
		   label       = COALESCE($3, label),
		   icon        = COALESCE($4, icon),
		   description = COALESCE($5, description),
		   sort_order  = COALESCE($6, sort_order),
		   updated_at  = NOW()
		 WHERE id = $1`,
		id, req.Name, req.Label, req.Icon, req.Description, req.SortOrder)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to update category")
		return
	}

	c, _ := scanCategory(h.db.QueryRow(ctx,
		`SELECT `+categoryCol+` FROM settings_categories WHERE id = $1`, id))
	middleware.WriteJSON(w, http.StatusOK, c)
}

// DeleteCategory deletes a settings category.
//
//	@Summary		Delete settings category
//	@Tags			Settings
//	@Produce		json
//	@Security		BearerAuth
//	@Param			id	path		string	true	"Category UUID"
//	@Success		200	{object}	map[string]string
//	@Failure		500	{object}	map[string]string
//	@Router			/settings/categories/{id} [delete]
func (h *SettingsHandler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	_, err := h.db.Exec(r.Context(), `DELETE FROM settings_categories WHERE id = $1`, id)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to delete category")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": "category deleted"})
}

// =============================================
// SYSTEM SETTINGS
// =============================================

const settingCols = `
	id, category_id, key, label, value, value_type, options, default_value,
	description, is_required, sort_order, created_at, updated_at`

func scanSetting(row interface{ Scan(dest ...any) error }) (models.SystemSetting, error) {
	var s models.SystemSetting
	err := row.Scan(
		&s.ID, &s.CategoryID, &s.Key, &s.Label, &s.Value, &s.ValueType, &s.Options,
		&s.DefaultValue, &s.Description, &s.IsRequired, &s.SortOrder, &s.CreatedAt, &s.UpdatedAt,
	)
	return s, err
}

// GetSettings returns all system settings, optionally filtered by category.
//
//	@Summary		List settings
//	@Tags			Settings
//	@Produce		json
//	@Security		BearerAuth
//	@Param			category_id	query		string	false	"Filter by category UUID"
//	@Success		200		{array}		models.SystemSetting
//	@Failure		500		{object}	map[string]string
//	@Router			/settings [get]
func (h *SettingsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	categoryID := r.URL.Query().Get("category_id")
	ctx := r.Context()

	query := `SELECT ` + settingCols + ` FROM system_settings`
	args := []any{}
	if categoryID != "" {
		query += ` WHERE category_id = $1`
		args = append(args, categoryID)
	}
	query += ` ORDER BY sort_order ASC`

	rows, err := h.db.Query(ctx, query, args...)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to fetch settings")
		return
	}
	defer rows.Close()

	var items []models.SystemSetting
	for rows.Next() {
		s, err := scanSetting(rows)
		if err == nil {
			items = append(items, s)
		}
	}
	if items == nil {
		items = []models.SystemSetting{}
	}
	middleware.WriteJSON(w, http.StatusOK, items)
}

// GetSettingByKey returns a single system setting by its key.
//
//	@Summary		Get setting by key
//	@Tags			Settings
//	@Produce		json
//	@Security		BearerAuth
//	@Param			key	path		string	true	"Setting key"
//	@Success		200	{object}	models.SystemSetting
//	@Failure		404	{object}	map[string]string
//	@Router			/settings/{key} [get]
func (h *SettingsHandler) GetSettingByKey(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	s, err := scanSetting(h.db.QueryRow(r.Context(),
		`SELECT `+settingCols+` FROM system_settings WHERE key = $1`, key))
	if err != nil {
		middleware.WriteError(w, http.StatusNotFound, "setting not found")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, s)
}

// CreateSetting creates a new system setting.
//
//	@Summary		Create setting
//	@Tags			Settings
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			body	body		models.CreateSystemSettingRequest	true	"Setting details"
//	@Success		201		{object}	models.SystemSetting
//	@Failure		400		{object}	map[string]string
//	@Router			/settings [post]
func (h *SettingsHandler) CreateSetting(w http.ResponseWriter, r *http.Request) {
	var req models.CreateSystemSettingRequest
	if err := middleware.DecodeBody(r, &req); err != nil || req.CategoryID == "" || req.Key == "" || req.Label == "" {
		middleware.WriteError(w, http.StatusBadRequest, "category_id, key and label required")
		return
	}

	ctx := r.Context()
	s, err := scanSetting(h.db.QueryRow(ctx,
		`INSERT INTO system_settings
		   (category_id, key, label, value, value_type, options, default_value, description, is_required, sort_order)
		 VALUES ($1, $2, $3, $4, COALESCE($5, 'string'), $6, $7, $8, COALESCE($9, false), COALESCE($10, 0))
		 RETURNING `+settingCols,
		req.CategoryID, req.Key, req.Label, req.Value, req.ValueType, req.Options,
		req.DefaultValue, req.Description, req.IsRequired, req.SortOrder))
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to create setting")
		return
	}
	middleware.WriteJSON(w, http.StatusCreated, s)
}

// UpdateSetting updates a system setting's metadata.
//
//	@Summary		Update setting
//	@Tags			Settings
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			key		path		string							true	"Setting key"
//	@Param			body	body		models.UpdateSystemSettingRequest	true	"Fields to update"
//	@Success		200		{object}	models.SystemSetting
//	@Failure		400		{object}	map[string]string
//	@Router			/settings/{key} [patch]
func (h *SettingsHandler) UpdateSetting(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	var req models.UpdateSystemSettingRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	_, err := h.db.Exec(ctx,
		`UPDATE system_settings SET
		   label         = COALESCE($2, label),
		   value         = COALESCE($3, value),
		   value_type    = COALESCE($4, value_type),
		   options       = COALESCE($5, options),
		   default_value = COALESCE($6, default_value),
		   description   = COALESCE($7, description),
		   is_required   = COALESCE($8, is_required),
		   sort_order    = COALESCE($9, sort_order),
		   updated_at    = NOW()
		 WHERE key = $1`,
		key, req.Label, req.Value, req.ValueType, req.Options,
		req.DefaultValue, req.Description, req.IsRequired, req.SortOrder)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to update setting")
		return
	}

	s, _ := scanSetting(h.db.QueryRow(ctx,
		`SELECT `+settingCols+` FROM system_settings WHERE key = $1`, key))
	middleware.WriteJSON(w, http.StatusOK, s)
}

// UpdateSettingValue updates only the value of a system setting.
//
//	@Summary		Set setting value
//	@Tags			Settings
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			key		path		string							true	"Setting key"
//	@Param			body	body		models.UpdateSettingValueRequest	true	"New value"
//	@Success		200		{object}	models.SystemSetting
//	@Failure		400		{object}	map[string]string
//	@Router			/settings/{key} [put]
func (h *SettingsHandler) UpdateSettingValue(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	var req models.UpdateSettingValueRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ctx := r.Context()
	_, err := h.db.Exec(ctx,
		`UPDATE system_settings SET value = $2, updated_at = NOW() WHERE key = $1`, key, req.Value)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to update setting value")
		return
	}

	s, _ := scanSetting(h.db.QueryRow(ctx,
		`SELECT `+settingCols+` FROM system_settings WHERE key = $1`, key))
	middleware.WriteJSON(w, http.StatusOK, s)
}

// DeleteSetting deletes a system setting by key.
//
//	@Summary		Delete setting
//	@Tags			Settings
//	@Produce		json
//	@Security		BearerAuth
//	@Param			key	path		string	true	"Setting key"
//	@Success		200	{object}	map[string]string
//	@Failure		500	{object}	map[string]string
//	@Router			/settings/{key} [delete]
func (h *SettingsHandler) DeleteSetting(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	_, err := h.db.Exec(r.Context(), `DELETE FROM system_settings WHERE key = $1`, key)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to delete setting")
		return
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": "setting deleted"})
}

// BulkUpdateValues updates multiple setting values in one request.
//
//	@Summary		Bulk update setting values
//	@Tags			Settings
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			body	body		[]object	true	"Array of {key, value}"
//	@Success		200		{object}	map[string]string
//	@Failure		400		{object}	map[string]string
//	@Router			/settings/bulk-update [post]
func (h *SettingsHandler) BulkUpdateValues(w http.ResponseWriter, r *http.Request) {
	var updates []struct {
		Key   string  `json:"key"`
		Value *string `json:"value"`
	}
	if err := middleware.DecodeBody(r, &updates); err != nil || len(updates) == 0 {
		middleware.WriteError(w, http.StatusBadRequest, "array of {key, value} required")
		return
	}

	ctx := r.Context()
	for _, u := range updates {
		_, _ = h.db.Exec(ctx,
			`UPDATE system_settings SET value = $2, updated_at = NOW() WHERE key = $1`, u.Key, u.Value)
	}
	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": "settings updated"})
}
