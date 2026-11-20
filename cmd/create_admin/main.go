package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// Load .env from project root.
	// If running from inside cmd/create_admin, try two levels up.
	if err := godotenv.Load(".env"); err != nil {
		if err2 := godotenv.Load("../../.env"); err2 != nil {
			fmt.Println(".env load failed:", err)
			fmt.Println("Current dir:", func() string { d, _ := os.Getwd(); return d }())
			return
		}
	}

	if os.Getenv("DB_USER") == "" || os.Getenv("DB_NAME") == "" {
		fmt.Println("Could not load DB config from .env")
		return
	}

	reader := bufio.NewReader(os.Stdin)

	fmt.Print("Name: ")
	name, _ := reader.ReadString('\n')
	name = strings.TrimSpace(name)

	fmt.Print("Email: ")
	email, _ := reader.ReadString('\n')
	email = strings.TrimSpace(email)

	fmt.Print("Password: ")
	password, _ := reader.ReadString('\n')
	password = strings.TrimSpace(password)

	fmt.Print("Role (admin / super_admin) [admin]: ")
	role, _ := reader.ReadString('\n')
	role = strings.TrimSpace(role)
	if role == "" {
		role = "admin"
	}
	if role != "admin" && role != "super_admin" {
		fmt.Println("Role must be admin or super_admin")
		return
	}

	if name == "" || email == "" || password == "" {
		fmt.Println("Name, Email and Password are all required")
		return
	}

	// Hash the password before storing it.
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Println("Hash failed:", err)
		return
	}

	// Build DB URL from environment variables. No hardcoded credentials.
	dbURL := fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		fmt.Println("DB connect failed:", err)
		return
	}
	defer db.Close()

	// Save the admin in the database.
	_, err = db.Exec(ctx,
		`INSERT INTO admins (name, email, password, role) VALUES ($1, $2, $3, $4)`,
		name, email, string(hashed), role,
	)
	if err != nil {
		fmt.Println("Insert failed:", err)
		return
	}

	fmt.Printf("Done! Admin created - %s (%s)\n", name, role)
}
