package handlers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/tutor-desk/api/internal/middleware"
)

const (
	accessTokenExpiry  = 15 * 60          // 15 minutes in seconds
	refreshTokenExpiry = 7 * 24 * 60 * 60 // 7 days in seconds
	bcryptCost         = 12
)

// AuthHandler handles all authentication operations.
type AuthHandler struct {
	db        *pgxpool.Pool
	jwtSecret string
}

func NewAuthHandler(db *pgxpool.Pool, jwtSecret string) *AuthHandler {
	return &AuthHandler{db: db, jwtSecret: jwtSecret}
}

// =============================================
// REQUEST / RESPONSE TYPES
// =============================================

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type signupRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type resetPasswordRequest struct {
	UserID      string `json:"user_id"`
	NewPassword string `json:"new_password"`
}

type createStudentRequest struct {
	FullName      string  `json:"full_name"`
	Email         string  `json:"email"`
	Password      string  `json:"password"`
	RollNumber    *string `json:"roll_number"`
	ClassName     *string `json:"class_name"`
	Section       *string `json:"section"`
	GuardianName  *string `json:"guardian_name"`
	GuardianPhone *string `json:"guardian_phone"`
	Address       *string `json:"address"`
	DateOfBirth   *string `json:"date_of_birth"` // YYYY-MM-DD
}

type authUserResponse struct {
	ID        string  `json:"id"`
	Email     string  `json:"email"`
	FullName  string  `json:"full_name"`
	Role      string  `json:"role"`
	Status    string  `json:"status"`
	AvatarURL *string `json:"avatar_url"`
	Phone     *string `json:"phone"`
	TeacherID *string `json:"teacher_id,omitempty"`
	StudentID *string `json:"student_id,omitempty"`
}

type authSuccessResponse struct {
	AccessToken  string           `json:"access_token"`
	RefreshToken string           `json:"refresh_token"`
	ExpiresIn    int              `json:"expires_in"`
	User         authUserResponse `json:"user"`
}

// =============================================
// POST /api/v1/auth/login
// =============================================

// Login authenticates a user and returns JWT tokens.
//
//	@Summary		Login
//	@Tags			Auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		loginRequest		true	"Login credentials"
//	@Success		200		{object}	authSuccessResponse
//	@Failure		400		{object}	map[string]string
//	@Failure		401		{object}	map[string]string
//	@Failure		429		{object}	map[string]interface{}
//	@Router			/auth/login [post]
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		middleware.WriteError(w, http.StatusBadRequest, "email and password required")
		return
	}

	ctx := r.Context()
	clientIP := extractIP(r)
	userAgent := r.Header.Get("User-Agent")
	deviceFP := r.Header.Get("X-Device-Fingerprint")

	// Rate limit check
	allowed, waitSecs := h.checkRateLimit(ctx, "login", req.Email, clientIP)
	if !allowed {
		middleware.WriteJSON(w, http.StatusTooManyRequests, map[string]any{
			"error":        "too many login attempts",
			"wait_seconds": waitSecs,
		})
		return
	}

	// Fetch user
	var user struct {
		ID           string
		Email        string
		PasswordHash *string
		FullName     string
		Role         string
		Status       string
		AvatarURL    *string
		Phone        *string
	}
	err := h.db.QueryRow(ctx,
		`SELECT id, email, password_hash, full_name, user_role, status, avatar_url, phone
		 FROM users WHERE email = $1`, req.Email).
		Scan(&user.ID, &user.Email, &user.PasswordHash, &user.FullName,
			&user.Role, &user.Status, &user.AvatarURL, &user.Phone)
	if err != nil {
		_ = h.recordLoginAttempt(ctx, req.Email, clientIP, userAgent, deviceFP, false, "user_not_found")
		middleware.WriteError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	// Verify password
	if user.PasswordHash == nil || bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password)) != nil {
		_ = h.recordLoginAttempt(ctx, req.Email, clientIP, userAgent, deviceFP, false, "invalid_password")
		middleware.WriteError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	// Account status checks
	if user.Status == "disabled" || user.Status == "suspended" {
		_ = h.recordLoginAttempt(ctx, req.Email, clientIP, userAgent, deviceFP, false, "account_locked")
		middleware.WriteError(w, http.StatusForbidden, "account is disabled. please contact support")
		return
	}
	if user.Role == "teacher" && user.Status == "pending" {
		_ = h.recordLoginAttempt(ctx, req.Email, clientIP, userAgent, deviceFP, true, "")
		middleware.WriteJSON(w, http.StatusForbidden, map[string]any{
			"error":   "account pending approval",
			"status":  "pending",
			"message": "your account is pending admin approval. please wait for activation.",
		})
		return
	}

	// Fetch role-specific IDs
	teacherID, studentID := h.fetchRoleIDs(ctx, user.ID, user.Role)

	// Generate tokens
	accessToken, err := h.createAccessToken(user.ID, user.Email, user.Role, user.Status)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}
	refreshToken, refreshHash := generateRefreshToken()

	// Store refresh token
	expiresAt := time.Now().Add(time.Duration(refreshTokenExpiry) * time.Second)
	_, err = h.db.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, device_fingerprint, ip_address, user_agent, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		user.ID, refreshHash, deviceFP, clientIP, userAgent, expiresAt)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	// Update last login
	_, _ = h.db.Exec(ctx, `UPDATE users SET last_login_at = NOW() WHERE id = $1`, user.ID)
	_ = h.recordLoginAttempt(ctx, req.Email, clientIP, userAgent, deviceFP, true, "")

	middleware.WriteJSON(w, http.StatusOK, authSuccessResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    accessTokenExpiry,
		User: authUserResponse{
			ID:        user.ID,
			Email:     user.Email,
			FullName:  user.FullName,
			Role:      user.Role,
			Status:    user.Status,
			AvatarURL: user.AvatarURL,
			Phone:     user.Phone,
			TeacherID: teacherID,
			StudentID: studentID,
		},
	})
}

// =============================================
// POST /api/v1/auth/signup (teachers only)
// =============================================

// Signup registers a new teacher (pending admin approval).
//
//	@Summary		Teacher signup
//	@Tags			Auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		signupRequest		true	"Signup details"
//	@Success		201		{object}	map[string]interface{}
//	@Failure		400		{object}	map[string]string
//	@Failure		409		{object}	map[string]string
//	@Router			/auth/signup [post]
func (h *AuthHandler) Signup(w http.ResponseWriter, r *http.Request) {
	var req signupRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" || req.FullName == "" {
		middleware.WriteError(w, http.StatusBadRequest, "email, password, and full name required")
		return
	}

	ctx := r.Context()
	clientIP := extractIP(r)

	// Rate limit
	allowed, waitSecs := h.checkRateLimit(ctx, "signup", req.Email, clientIP)
	if !allowed {
		middleware.WriteJSON(w, http.StatusTooManyRequests, map[string]any{
			"error":        "too many signup attempts",
			"wait_seconds": waitSecs,
		})
		return
	}

	// Check email uniqueness
	var exists bool
	_ = h.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, req.Email).Scan(&exists)
	if exists {
		middleware.WriteError(w, http.StatusConflict, "email already registered")
		return
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to process password")
		return
	}

	// Create user (teacher with pending status)
	var newUser struct {
		ID       string
		Email    string
		FullName string
		Role     string
		Status   string
	}
	err = h.db.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, full_name, user_role, status, auth_provider)
		 VALUES ($1, $2, $3, 'teacher', 'pending', 'email')
		 RETURNING id, email, full_name, user_role, status`,
		req.Email, string(hash), req.FullName).
		Scan(&newUser.ID, &newUser.Email, &newUser.FullName, &newUser.Role, &newUser.Status)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to create account")
		return
	}

	// Create teacher profile
	_, _ = h.db.Exec(ctx, `INSERT INTO teachers (user_id) VALUES ($1)`, newUser.ID)

	middleware.WriteJSON(w, http.StatusCreated, map[string]any{
		"message": "account created successfully. please wait for admin approval.",
		"user":    newUser,
	})
}

// =============================================
// POST /api/v1/auth/refresh
// =============================================

// Refresh rotates a refresh token and returns a new access token.
//
//	@Summary		Refresh token
//	@Tags			Auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		refreshRequest		true	"Refresh token"
//	@Success		200		{object}	authSuccessResponse
//	@Failure		400		{object}	map[string]string
//	@Failure		401		{object}	map[string]string
//	@Router			/auth/refresh [post]
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := middleware.DecodeBody(r, &req); err != nil || req.RefreshToken == "" {
		middleware.WriteError(w, http.StatusBadRequest, "refresh_token required")
		return
	}

	ctx := r.Context()
	deviceFP := r.Header.Get("X-Device-Fingerprint")
	clientIP := extractIP(r)
	userAgent := r.Header.Get("User-Agent")

	tokenHash := hashToken(req.RefreshToken)

	var rt struct {
		ID                string
		UserID            string
		ExpiresAt         time.Time
		DeviceFingerprint *string
	}
	err := h.db.QueryRow(ctx,
		`SELECT id, user_id, expires_at, device_fingerprint
		 FROM refresh_tokens WHERE token_hash = $1 AND is_revoked = false`, tokenHash).
		Scan(&rt.ID, &rt.UserID, &rt.ExpiresAt, &rt.DeviceFingerprint)
	if err != nil {
		middleware.WriteError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	if time.Now().After(rt.ExpiresAt) {
		_, _ = h.db.Exec(ctx, `UPDATE refresh_tokens SET is_revoked = true, revoked_reason = 'expired' WHERE id = $1`, rt.ID)
		middleware.WriteError(w, http.StatusUnauthorized, "refresh token expired")
		return
	}

	// Device fingerprint check
	if rt.DeviceFingerprint != nil && deviceFP != "" && *rt.DeviceFingerprint != deviceFP {
		_, _ = h.db.Exec(ctx, `UPDATE refresh_tokens SET is_revoked = true, revoked_reason = 'suspicious_activity' WHERE user_id = $1`, rt.UserID)
		middleware.WriteError(w, http.StatusUnauthorized, "session invalidated due to suspicious activity")
		return
	}

	// Fetch user
	var user struct {
		ID        string
		Email     string
		FullName  string
		Role      string
		Status    string
		AvatarURL *string
		Phone     *string
	}
	err = h.db.QueryRow(ctx,
		`SELECT id, email, full_name, user_role, status, avatar_url, phone FROM users WHERE id = $1`, rt.UserID).
		Scan(&user.ID, &user.Email, &user.FullName, &user.Role, &user.Status, &user.AvatarURL, &user.Phone)
	if err != nil || user.Status == "disabled" || user.Status == "suspended" {
		_, _ = h.db.Exec(ctx, `UPDATE refresh_tokens SET is_revoked = true, revoked_reason = 'user_invalid' WHERE id = $1`, rt.ID)
		middleware.WriteError(w, http.StatusUnauthorized, "user account not available")
		return
	}

	// Rotate refresh token
	newRefreshToken, newRefreshHash := generateRefreshToken()
	newExpiresAt := time.Now().Add(time.Duration(refreshTokenExpiry) * time.Second)

	_, _ = h.db.Exec(ctx, `UPDATE refresh_tokens SET is_revoked = true, revoked_reason = 'rotated' WHERE id = $1`, rt.ID)
	_, err = h.db.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, device_fingerprint, ip_address, user_agent, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		user.ID, newRefreshHash, deviceFP, clientIP, userAgent, newExpiresAt)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to rotate session")
		return
	}

	accessToken, err := h.createAccessToken(user.ID, user.Email, user.Role, user.Status)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	teacherID, studentID := h.fetchRoleIDs(ctx, user.ID, user.Role)

	middleware.WriteJSON(w, http.StatusOK, authSuccessResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    accessTokenExpiry,
		User: authUserResponse{
			ID:        user.ID,
			Email:     user.Email,
			FullName:  user.FullName,
			Role:      user.Role,
			Status:    user.Status,
			AvatarURL: user.AvatarURL,
			Phone:     user.Phone,
			TeacherID: teacherID,
			StudentID: studentID,
		},
	})
}

// =============================================
// POST /api/v1/auth/logout
// =============================================

// Logout revokes the refresh token.
//
//	@Summary		Logout
//	@Tags			Auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		logoutRequest		false	"Refresh token (optional)"
//	@Success		200		{object}	map[string]string
//	@Router			/auth/logout [post]
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var req logoutRequest
	_ = middleware.DecodeBody(r, &req)

	if req.RefreshToken != "" {
		tokenHash := hashToken(req.RefreshToken)
		_, _ = h.db.Exec(r.Context(),
			`UPDATE refresh_tokens SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'logout'
			 WHERE token_hash = $1`, tokenHash)
	}

	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": "logged out successfully"})
}

// =============================================
// POST /api/v1/auth/reset-password  [super_admin only]
// =============================================

// ResetPassword resets a user password (super_admin only).
//
//	@Summary		Reset password
//	@Tags			Auth
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			body	body		resetPasswordRequest	true	"User ID and new password"
//	@Success		200		{object}	map[string]string
//	@Failure		400		{object}	map[string]string
//	@Failure		404		{object}	map[string]string
//	@Router			/auth/reset-password [post]
func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req resetPasswordRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.UserID == "" || req.NewPassword == "" {
		middleware.WriteError(w, http.StatusBadRequest, "user_id and new_password required")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcryptCost)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to process password")
		return
	}

	ctx := r.Context()
	res, err := h.db.Exec(ctx,
		`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
		string(hash), req.UserID)
	if err != nil || res.RowsAffected() == 0 {
		middleware.WriteError(w, http.StatusNotFound, "user not found")
		return
	}

	// Revoke all existing tokens
	_, _ = h.db.Exec(ctx,
		`UPDATE refresh_tokens SET is_revoked = true, revoked_reason = 'password_change' WHERE user_id = $1`,
		req.UserID)

	middleware.WriteJSON(w, http.StatusOK, map[string]string{"message": "password reset successfully"})
}

// =============================================
// POST /api/v1/auth/create-student  [teacher only]
// =============================================

// CreateStudent creates a student account (teacher only).
//
//	@Summary		Create student account
//	@Tags			Auth
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			body	body		createStudentRequest	true	"Student details"
//	@Success		201		{object}	map[string]interface{}
//	@Failure		400		{object}	map[string]string
//	@Failure		409		{object}	map[string]string
//	@Router			/auth/create-student [post]
func (h *AuthHandler) CreateStudent(w http.ResponseWriter, r *http.Request) {
	var req createStudentRequest
	if err := middleware.DecodeBody(r, &req); err != nil {
		middleware.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" || req.FullName == "" {
		middleware.WriteError(w, http.StatusBadRequest, "full_name, email, and password required")
		return
	}

	ctx := r.Context()
	teacherUserID := middleware.GetUserID(r)

	// Get teacher record
	var teacherID string
	err := h.db.QueryRow(ctx, `SELECT id FROM teachers WHERE user_id = $1`, teacherUserID).Scan(&teacherID)
	if err != nil {
		middleware.WriteError(w, http.StatusNotFound, "teacher profile not found")
		return
	}

	// Check email uniqueness
	var exists bool
	_ = h.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, req.Email).Scan(&exists)
	if exists {
		middleware.WriteError(w, http.StatusConflict, "email already registered")
		return
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to process password")
		return
	}

	// Create user
	var newUserID, newEmail, newFullName, newRole, newStatus string
	err = h.db.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, full_name, user_role, status, auth_provider, created_by)
		 VALUES ($1, $2, $3, 'student', 'active', 'email', $4)
		 RETURNING id, email, full_name, user_role, status`,
		req.Email, string(hash), req.FullName, teacherUserID).
		Scan(&newUserID, &newEmail, &newFullName, &newRole, &newStatus)
	if err != nil {
		middleware.WriteError(w, http.StatusInternalServerError, "failed to create student account")
		return
	}

	// Parse date of birth
	var dob *time.Time
	if req.DateOfBirth != nil && *req.DateOfBirth != "" {
		parsed, err := time.Parse("2006-01-02", *req.DateOfBirth)
		if err == nil {
			dob = &parsed
		}
	}

	// Create student profile
	var newStudentID string
	err = h.db.QueryRow(ctx,
		`INSERT INTO students (user_id, teacher_id, roll_number, class_name, section, guardian_name, guardian_phone, address, date_of_birth)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id`,
		newUserID, teacherID, req.RollNumber, req.ClassName, req.Section,
		req.GuardianName, req.GuardianPhone, req.Address, dob).Scan(&newStudentID)
	if err != nil {
		// Rollback user creation
		_, _ = h.db.Exec(ctx, `DELETE FROM users WHERE id = $1`, newUserID)
		middleware.WriteError(w, http.StatusInternalServerError, fmt.Sprintf("failed to create student profile: %v", err))
		return
	}

	// Update teacher stats
	_, _ = h.db.Exec(ctx,
		`UPDATE teachers SET total_students = (SELECT COUNT(*) FROM students WHERE teacher_id = $1) WHERE id = $1`,
		teacherID)

	middleware.WriteJSON(w, http.StatusCreated, map[string]any{
		"message": "student created successfully",
		"user": map[string]any{
			"id":         newUserID,
			"email":      newEmail,
			"full_name":  newFullName,
			"role":       newRole,
			"status":     newStatus,
			"student_id": newStudentID,
		},
	})
}

// =============================================
// HELPERS
// =============================================

func (h *AuthHandler) createAccessToken(userID, email, role, status string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":       userID,
		"email":     email,
		"user_role": role, // intentionally "user_role" not "role" — matches Edge Function convention
		"status":    status,
		"iat":       now.Unix(),
		"exp":       now.Add(time.Duration(accessTokenExpiry) * time.Second).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.jwtSecret))
}

func (h *AuthHandler) fetchRoleIDs(ctx context.Context, userID, role string) (teacherID *string, studentID *string) {
	switch role {
	case "teacher":
		var id string
		if err := h.db.QueryRow(ctx, `SELECT id FROM teachers WHERE user_id = $1`, userID).Scan(&id); err == nil {
			teacherID = &id
		}
	case "student":
		var id string
		if err := h.db.QueryRow(ctx, `SELECT id FROM students WHERE user_id = $1`, userID).Scan(&id); err == nil {
			studentID = &id
		}
	}
	return
}

func (h *AuthHandler) checkRateLimit(ctx context.Context, action, email, ip string) (allowed bool, waitSeconds int) {
	// Simple check: count failed attempts in the last 15 minutes
	var count int
	_ = h.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM login_attempts
		 WHERE email = $1 AND ip_address::text = $2
		   AND attempted_at > NOW() - INTERVAL '15 minutes'
		   AND success = false`,
		email, ip).Scan(&count)
	if count >= 5 {
		return false, 900
	}
	return true, 0
}

func (h *AuthHandler) recordLoginAttempt(ctx context.Context, email, ip, ua, fp string, success bool, reason string) error {
	var r *string
	if reason != "" {
		r = &reason
	}
	_, err := h.db.Exec(ctx,
		`INSERT INTO login_attempts (email, ip_address, success, failure_reason, user_agent, device_fingerprint)
		 VALUES ($1, $2::inet, $3, $4, $5, $6)`,
		email, ip, success, r, ua, fp)
	return err
}

func generateRefreshToken() (token, hash string) {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	token = hex.EncodeToString(b)
	hash = hashToken(token)
	return
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func extractIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		// Take the first IP in the list
		for i, c := range fwd {
			if c == ',' {
				return strings.TrimSpace(fwd[:i])
			}
		}
		return strings.TrimSpace(fwd)
	}
	if cf := r.Header.Get("CF-Connecting-IP"); cf != "" {
		return cf
	}
	// Use net package to properly parse host:port or [::1]:port
	addr := r.RemoteAddr
	if host, _, err := net.SplitHostPort(addr); err == nil {
		return host
	}
	return addr
}
