package cache

import (
	"encoding/json"
	"sync"
	"time"
)

type AdminSession struct {
	AdminID   int64     `json:"adminId"`
	Role      string    `json:"role"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type inMemoryCache struct {
	DocumentsFormat json.RawMessage
	ActiveDocuments json.RawMessage
	adminSessions   map[string]AdminSession
	mu              sync.RWMutex
}

var (
	instance *inMemoryCache
	once     sync.Once
)

func GetIMCache() *inMemoryCache {
	once.Do(func() {
		instance = &inMemoryCache{
			adminSessions: make(map[string]AdminSession),
		}
	})
	return instance
}
