package config

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var DB *pgxpool.Pool

func InitDB() {
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
		Settings.DBUser,
		Settings.DBPassword,
		Settings.DBHost,
		Settings.DBPort,
		Settings.DBName,
	)

	// Configure the connection pool.
	pgxConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		log.Fatalf("Failed to parse Postgres DSN: %v", err)
	}

	// Apply the configured connection limits.
	// These limits can be changed in the application settings.
	pgxConfig.MaxConns = int32(Settings.DBMaxOpenConnections) // Example: 10
	pgxConfig.MinConns = int32(Settings.DBMaxIdleConnections) // Example: 2
	pgxConfig.MaxConnLifetime = Settings.DBConnectionLifetime // Example: 1 * time.Hour
	pgxConfig.MaxConnIdleTime = 30 * time.Minute

	// Create the shared connection pool.
	DB, err = pgxpool.NewWithConfig(context.Background(), pgxConfig)
	if err != nil {
		log.Fatalf("Failed to create Postgres pool: %v", err)
	}

	// Verify the database connection.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := DB.Ping(ctx); err != nil {
		log.Fatalf("Failed to ping Postgres: %v", err)
	}

	log.Println("Postgres connection pool established successfully")
}
