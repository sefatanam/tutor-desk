package config

import (
	"log"
	"os"
	"strings"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	DatabaseURL string
	JWTSecret   string
	Port        string
	CORSOrigins []string
	UploadDir   string
	Env         string

	// bKash Payment Gateway
	BkashBaseURL     string
	BkashAppKey      string
	BkashAppSecret   string
	BkashUsername    string
	BkashPassword    string
	BkashCallbackURL string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	cfg := &Config{
		DatabaseURL: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/tutordesk"),
		JWTSecret:   getEnv("JWT_SECRET", "tutor-desk-super-secret-key-change-in-production-2024"),
		Port:        getEnv("PORT", "8080"),
		UploadDir:   getEnv("UPLOAD_DIR", "../../uploads"),
		Env:         getEnv("ENV", "development"),

		BkashBaseURL:     getEnv("BKASH_BASE_URL", "https://tokenized.sandbox.bka.sh/v1.2.0-beta"),
		BkashAppKey:      getEnv("BKASH_APP_KEY", ""),
		BkashAppSecret:   getEnv("BKASH_APP_SECRET", ""),
		BkashUsername:    getEnv("BKASH_USERNAME", ""),
		BkashPassword:    getEnv("BKASH_PASSWORD", ""),
		BkashCallbackURL: getEnv("BKASH_CALLBACK_URL", "http://localhost:4200/payment/callback"),
	}

	originsRaw := getEnv("CORS_ORIGINS", "http://localhost:4200")
	for _, o := range strings.Split(originsRaw, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			cfg.CORSOrigins = append(cfg.CORSOrigins, o)
		}
	}

	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET is required")
	}

	return cfg
}

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}
