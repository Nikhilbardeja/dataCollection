package utils

import (
	"context"
	"crypto/rand"
	"dataCollection/internal/config"
	"errors"
	"math/big"

	"github.com/jackc/pgx/v5"
)

func GenerateRandomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		num, _ := rand.Int(rand.Reader, big.NewInt(int64(len(letters))))
		b[i] = letters[num.Int64()]
	}
	return string(b)
}

func GenerateId(ctx context.Context, idLength int, table, columnName string) (string, error) {
	query := "SELECT 1 FROM " + table + " WHERE " + columnName + " =$1 LIMIT 1"

	for {
		newId := GenerateRandomString(idLength)

		var exists int
		err := config.DB.QueryRow(ctx, query, newId).Scan(&exists)
		if errors.Is(err, pgx.ErrNoRows) {
			return newId, nil
		}
		if err != nil {
			return "", err
		}
		// duplicate, generate again
	}
}
