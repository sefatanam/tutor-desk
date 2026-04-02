package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tutor-desk/api/internal/config"
)

// NewPool creates and validates a pgx connection pool using settings from cfg.
func NewPool(ctx context.Context, cfg *config.Config) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database DSN: %w", err)
	}

	poolCfg.MaxConns = cfg.DBMaxConns
	poolCfg.MinConns = cfg.DBMinConns
	poolCfg.MaxConnLifetime = time.Duration(cfg.DBMaxConnLifetimeM) * time.Minute
	poolCfg.MaxConnIdleTime = time.Duration(cfg.DBMaxConnIdleTimeM) * time.Minute
	poolCfg.HealthCheckPeriod = time.Duration(cfg.DBHealthCheckPeriodM) * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	return pool, nil
}
