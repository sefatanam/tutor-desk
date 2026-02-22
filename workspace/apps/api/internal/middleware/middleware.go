package middleware

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// =============================================
// CONTEXT KEYS
// =============================================

type contextKey string

const (
	ContextKeyUserID   contextKey = "user_id"
	ContextKeyUserRole contextKey = "user_role"
	ContextKeyEmail    contextKey = "email"
	ContextKeyStatus   contextKey = "status"
)

// =============================================
// CONTEXT HELPERS
// =============================================

func GetUserID(r *http.Request) string {
	if v, ok := r.Context().Value(ContextKeyUserID).(string); ok {
		return v
	}
	return ""
}

func GetUserRole(r *http.Request) string {
	if v, ok := r.Context().Value(ContextKeyUserRole).(string); ok {
		return v
	}
	return ""
}

func GetEmail(r *http.Request) string {
	if v, ok := r.Context().Value(ContextKeyEmail).(string); ok {
		return v
	}
	return ""
}

// =============================================
// CORS
// =============================================

func CORS(origins []string) func(http.Handler) http.Handler {
	originSet := make(map[string]struct{}, len(origins))
	for _, o := range origins {
		originSet[o] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if _, ok := originSet[origin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			} else if len(origins) > 0 {
				// Fallback: allow first origin or wildcard
				w.Header().Set("Access-Control-Allow-Origin", origins[0])
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Device-Fingerprint, Accept")
			w.Header().Set("Access-Control-Expose-Headers", "Content-Disposition")
			w.Header().Set("Access-Control-Max-Age", "3600")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// =============================================
// JWT AUTH
// =============================================

// Auth validates the JWT Bearer token in the Authorization header.
// On success it injects user_id, user_role, email, status into the request context.
func Auth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if !strings.HasPrefix(authHeader, "Bearer ") {
				writeError(w, http.StatusUnauthorized, "authorization token required")
				return
			}

			tokenStr := authHeader[7:]
			claims, err := parseJWT(tokenStr, secret)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}

			ctx := context.WithValue(r.Context(), ContextKeyUserID, claims.UserID)
			ctx = context.WithValue(ctx, ContextKeyUserRole, claims.UserRole)
			ctx = context.WithValue(ctx, ContextKeyEmail, claims.Email)
			ctx = context.WithValue(ctx, ContextKeyStatus, claims.Status)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole returns a middleware that allows only users with one of the specified roles.
// Must be used after Auth middleware.
func RequireRole(secret string, roles ...string) func(http.Handler) http.Handler {
	authMiddleware := Auth(secret)
	return func(next http.Handler) http.Handler {
		return authMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role := GetUserRole(r)
			for _, allowed := range roles {
				if role == allowed {
					next.ServeHTTP(w, r)
					return
				}
			}
			writeError(w, http.StatusForbidden, "insufficient permissions")
		}))
	}
}

// =============================================
// LOGGING
// =============================================

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rw, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, rw.status, time.Since(start))
	})
}

// =============================================
// JWT INTERNALS
// =============================================

type jwtClaims struct {
	UserID   string `json:"sub"`
	Email    string `json:"email"`
	UserRole string `json:"user_role"` // intentionally NOT "role" — matches Edge Function
	Status   string `json:"status"`
	jwt.RegisteredClaims
}

func parseJWT(tokenStr, secret string) (*jwtClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &jwtClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, err
	}
	claims, ok := token.Claims.(*jwtClaims)
	if !ok {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return claims, nil
}

// =============================================
// RESPONSE HELPERS (shared across handlers)
// =============================================

func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("WriteJSON encode error: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	WriteJSON(w, status, map[string]string{"error": msg})
}

func WriteError(w http.ResponseWriter, status int, msg string) {
	writeError(w, status, msg)
}

func DecodeBody(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}
