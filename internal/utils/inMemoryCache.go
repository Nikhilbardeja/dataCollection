package utils

import (
	"context"
	"dataCollection/internal/config"
	"encoding/json"
	"sync"
	"time"
)

type inMemoryCache struct {
	DocumentsFormat json.RawMessage
	mu              sync.RWMutex
}

var (
	instance *inMemoryCache
	once     sync.Once
)

func GetIMCache() *inMemoryCache {
	once.Do(func() {
		instance = &inMemoryCache{}
	})
	return instance
}

func (imc *inMemoryCache) LoadDocumentsFormat() error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var result json.RawMessage
	err := config.DB.QueryRow(ctx, `
        SELECT json_build_object(
            'documents',
            COALESCE(json_agg(
                json_build_object(
                    'document_type_id', dt.id,
                    'name', dt.name,
                    'required', dt.required,
                    'fields', COALESCE((
                        SELECT json_agg(
                            json_build_object(
                                'key', df.field_key,
                                'label', df.label,
                                'type', df.field_type,
                                'required', df.required,
								'pattern', df.pattern,
								'not_future', df.not_future
                            ) ORDER BY df.id
                        )
                        FROM document_fields df
                        WHERE df.document_type_id = dt.id
                    ), '[]'::json)
                ) ORDER BY dt.sort_order
            ), '[]'::json)
        )
        FROM document_types dt
    `).Scan(&result)

	if err != nil {
		return err
	}

	// Lock while updating the cache to protect concurrent readers.
	imc.mu.Lock()
	defer imc.mu.Unlock()
	imc.DocumentsFormat = result
	return nil
}

func (imc *inMemoryCache) GetDocumentsFormat() json.RawMessage {
	imc.mu.RLock()
	defer imc.mu.RUnlock()
	return imc.DocumentsFormat
}

func (imc *inMemoryCache) Refresh() error {
	return imc.LoadDocumentsFormat()
}
