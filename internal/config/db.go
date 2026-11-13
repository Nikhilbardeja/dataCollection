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

	// Pool ka config banaya
	pgxConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		log.Fatalf("Failed to parse Postgres DSN: %v", err)
	}

	// Yahi wahi Max / Min wali setting hai jo humne baat ki thi
	// Settings se aa rahi hai, to tu waha se hi badal payega
	pgxConfig.MaxConns = int32(Settings.DBMaxOpenConnections) // Jaise 10
	pgxConfig.MinConns = int32(Settings.DBMaxIdleConnections) // Jaise 2
	pgxConfig.MaxConnLifetime = Settings.DBConnectionLifetime // Jaise 1 * time.Hour
	pgxConfig.MaxConnIdleTime = 30 * time.Minute

	// Ek baar pool bana diya, poore project me yahi chalega
	DB, err = pgxpool.NewWithConfig(context.Background(), pgxConfig)
	if err != nil {
		log.Fatalf("Failed to create Postgres pool: %v", err)
	}

	// Check kar ki DB sach me connected hai ya nahi
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := DB.Ping(ctx); err != nil {
		log.Fatalf("Failed to ping Postgres: %v", err)
	}

	log.Println("Postgres connection pool established successfully")
}
