package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	// Core
	DatabaseURL string
	JWTSecret   string
	Port        string
	CORSOrigins []string
	UploadDir   string
	Env         string

	// Server timeouts (seconds)
	ServerReadTimeoutS     int
	ServerWriteTimeoutS    int
	ServerIdleTimeoutS     int
	ServerShutdownTimeoutS int

	// Auth
	JWTAccessExpiryS  int // access token lifetime in seconds
	JWTRefreshExpiryS int // refresh token lifetime in seconds
	BcryptCost        int

	// File uploads
	MaxUploadMB int64

	// Database pool
	DBMaxConns            int32
	DBMinConns            int32
	DBMaxConnLifetimeM    int // minutes
	DBMaxConnIdleTimeM    int // minutes
	DBHealthCheckPeriodM  int // minutes

	// bKash Payment Gateway
	BkashBaseURL        string
	BkashAppKey         string
	BkashAppSecret      string
	BkashUsername       string
	BkashPassword       string
	BkashCallbackURL    string
	BkashHTTPTimeoutS   int
}

// Load reads configuration from a .env file (if present) then environment variables.
// Shell environment variables take precedence over the .env file.
func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("config: no .env file found, using environment variables")
	}

	cfg := &Config{
		// Core
		DatabaseURL: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/tutordesk"),
		JWTSecret:   getEnv("JWT_SECRET", "tutor-desk-super-secret-key-change-in-production-2024"),
		Port:        getEnv("PORT", "8080"),
		UploadDir:   getEnv("UPLOAD_DIR", "../../uploads"),
		Env:         getEnv("ENV", "development"),

		// Server timeouts
		ServerReadTimeoutS:     getEnvInt("SERVER_READ_TIMEOUT_S", 30),
		ServerWriteTimeoutS:    getEnvInt("SERVER_WRITE_TIMEOUT_S", 60),
		ServerIdleTimeoutS:     getEnvInt("SERVER_IDLE_TIMEOUT_S", 120),
		ServerShutdownTimeoutS: getEnvInt("SERVER_SHUTDOWN_TIMEOUT_S", 10),

		// Auth
		JWTAccessExpiryS:  getEnvInt("JWT_ACCESS_EXPIRY_S", 900),        // 15 min
		JWTRefreshExpiryS: getEnvInt("JWT_REFRESH_EXPIRY_S", 604800),    // 7 days
		BcryptCost:        getEnvInt("BCRYPT_COST", 12),

		// Uploads
		MaxUploadMB: int64(getEnvInt("MAX_UPLOAD_MB", 50)),

		// DB pool
		DBMaxConns:           int32(getEnvInt("DB_MAX_CONNS", 20)),
		DBMinConns:           int32(getEnvInt("DB_MIN_CONNS", 2)),
		DBMaxConnLifetimeM:   getEnvInt("DB_MAX_CONN_LIFETIME_M", 30),
		DBMaxConnIdleTimeM:   getEnvInt("DB_MAX_CONN_IDLE_TIME_M", 5),
		DBHealthCheckPeriodM: getEnvInt("DB_HEALTH_CHECK_PERIOD_M", 1),

		// bKash
		BkashBaseURL:      getEnv("BKASH_BASE_URL", "https://tokenized.sandbox.bka.sh/v1.2.0-beta"),
		BkashAppKey:       getEnv("BKASH_APP_KEY", ""),
		BkashAppSecret:    getEnv("BKASH_APP_SECRET", ""),
		BkashUsername:     getEnv("BKASH_USERNAME", ""),
		BkashPassword:     getEnv("BKASH_PASSWORD", ""),
		BkashCallbackURL:  getEnv("BKASH_CALLBACK_URL", "http://localhost:4200/payment/callback"),
		BkashHTTPTimeoutS: getEnvInt("BKASH_HTTP_TIMEOUT_S", 30),
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

func getEnvInt(key string, defaultValue int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
		log.Printf("config: invalid integer for %s, using default %d", key, defaultValue)
	}
	return defaultValue
}
