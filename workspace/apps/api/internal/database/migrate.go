package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// RunMigrations applies all pending SQL migrations from the migrations directory.
// It is safe to call on every startup — already-applied migrations are skipped.
// Bootstrap logic: if the users table already exists (created via docker init scripts)
// but migration 001 is not yet recorded, it marks 001 as applied without re-running it.
func RunMigrations(ctx context.Context, db *pgxpool.Pool, migrationsDir string) error {
	// Create migration tracking table if it doesn't exist
	_, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	// Bootstrap: detect existing deployments where schema was created
	// by docker init scripts (schema.sql) rather than via migrations.
	var usersExists bool
	if err := db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'users'
		)
	`).Scan(&usersExists); err != nil {
		return fmt.Errorf("failed to check existing schema: %w", err)
	}

	if usersExists {
		// Mark the initial schema migration as applied without running it again
		if _, err := db.Exec(ctx, `
			INSERT INTO schema_migrations (version) VALUES ('001_initial_schema')
			ON CONFLICT DO NOTHING
		`); err != nil {
			return fmt.Errorf("failed to bootstrap initial migration record: %w", err)
		}
	}

	// Load the set of already-applied migrations
	rows, err := db.Query(ctx, `SELECT version FROM schema_migrations ORDER BY version`)
	if err != nil {
		return fmt.Errorf("failed to query applied migrations: %w", err)
	}
	applied := make(map[string]bool)
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			rows.Close()
			return fmt.Errorf("failed to scan migration version: %w", err)
		}
		applied[v] = true
	}
	rows.Close()

	// Read migration files from disk
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		if os.IsNotExist(err) {
			log.Println("migrations: directory not found, skipping")
			return nil
		}
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	// Apply pending migrations inside individual transactions
	for _, filename := range files {
		version := strings.TrimSuffix(filename, ".sql")
		if applied[version] {
			continue
		}

		log.Printf("migrations: applying %s", filename)

		content, err := os.ReadFile(filepath.Join(migrationsDir, filename))
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", filename, err)
		}

		tx, err := db.Begin(ctx)
		if err != nil {
			return fmt.Errorf("failed to begin transaction for %s: %w", filename, err)
		}

		if _, err := tx.Exec(ctx, string(content)); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("failed to apply migration %s: %w", filename, err)
		}

		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("failed to record migration %s: %w", filename, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", filename, err)
		}

		log.Printf("migrations: applied %s successfully", filename)
	}

	log.Println("migrations: all up to date")
	return nil
}
