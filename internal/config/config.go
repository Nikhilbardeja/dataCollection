package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type AppConfig struct {
	DBUser     string
	DBPassword string
	DBHost     string
	DBPort     string
	DBName     string

	DBMaxOpenConnections int
	DBMaxIdleConnections int
	DBConnectionLifetime time.Duration

	AccessTokenSecret  string
	RefreshTokenSecret string
	AccessTokenExpire  int
	RefreshTokenExpire int

	CookieDomain   string
	CookieSecure   bool
	CookieSameSite string
	CookieHttpOnly bool
}

var Settings AppConfig

func Load() error {
	if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("load .env file: %w", err)
	}
	Settings.DBHost = os.Getenv("DB_HOST")
	Settings.DBPassword = os.Getenv("DB_PASSWORD")
	Settings.DBUser = os.Getenv("DB_USER")
	Settings.DBPort = os.Getenv("DB_PORT")
	Settings.DBName = os.Getenv("DB_NAME")
	Settings.DBMaxOpenConnections = getEnvAsInt("DB_MAX_OPEN_CONNECTIONS", 10)
	Settings.DBMaxIdleConnections = getEnvAsInt("DB_MAX_IDLE_CONNECTIONS", 2)
	Settings.DBConnectionLifetime = getEnvAsDuration("DB_CONNECTION_LIFETIME", time.Hour)
	Settings.AccessTokenSecret = os.Getenv("ACCESS_TOKEN_SECRET")
	Settings.RefreshTokenSecret = os.Getenv("REFERSH_TOKEN_SECRET")
	Settings.AccessTokenExpire = getEnvAsInt("ACCESS_TOKEN_EXPIRE", 30)
	Settings.RefreshTokenExpire = getEnvAsInt("REFRESH_TOKEN_EXPIRE", 60)
	Settings.CookieDomain = os.Getenv("COOKIE_DOMAIN")
	Settings.CookieSecure = os.Getenv("COOKIE_SECURE") == "true"
	Settings.CookieSameSite = os.Getenv("COOKIE_SAME_SITE")
	Settings.CookieHttpOnly = os.Getenv("COOKIE_HTTP_ONLY") == "true"
	return nil

}

func getEnvAsInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if n, err := strconv.Atoi(val); err == nil {
			return n
		}
	}
	return defaultVal
}

func getEnvAsDuration(key string, defaultVal time.Duration) time.Duration {
	if val := os.Getenv(key); val != "" {
		if d, err := time.ParseDuration(val); err == nil {
			return d
		}
	}
	return defaultVal
}
