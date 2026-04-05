package middleware

import (
	"context"
	"net/http"
)

// PlatformSuperAdmin is a top-level middleware that grants full super_admin access
// when the X-Super-Admin-Key request header matches the configured platform key.
// This is the operator's (your) master key — never shared with customers.
// It bypasses JWT authentication entirely and must be applied BEFORE Auth middleware.
//
// Usage in router:
//
//	handler = middleware.PlatformSuperAdmin(cfg.SuperAdminKey)(handler)
func PlatformSuperAdmin(superAdminKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if superAdminKey != "" && r.Header.Get("X-Super-Admin-Key") == superAdminKey {
				ctx := context.WithValue(r.Context(), ContextKeyUserID, "00000000-0000-0000-0000-000000000001")
				ctx = context.WithValue(ctx, ContextKeyUserRole, "super_admin")
				ctx = context.WithValue(ctx, ContextKeyEmail, "platform@tutordesk.app")
				ctx = context.WithValue(ctx, ContextKeyStatus, "active")
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
