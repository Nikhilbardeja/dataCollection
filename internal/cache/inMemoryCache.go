package cache

import (
	"context"
	"dataCollection/internal/config"
	user "dataCollection/internal/models"
	"encoding/json"
	"sync"
	"time"
)

type inMemoryCache struct {
	DocumentsFormat json.RawMessage
	ActiveDocuments json.RawMessage
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
                    'documentId', dt.documentId,
                    'name', dt.name,
                    'required', dt.required,
					'active', dt.active,
					'sort_order', dt.sort_order,
                    'fields', COALESCE((
                        SELECT json_agg(
                            json_build_object(
                                'key', df.field_key,
                                'label', df.label,
                                'type', df.field_type,
                                'required', df.required,
								'pattern', df.pattern,
								'not_future', df.not_future,
								'active', df.active
                            ) ORDER BY df.id
                        )
                        FROM document_fields df
                        WHERE df.documentId = dt.documentId
                    ), '[]'::json)
                ) ORDER BY dt.sort_order
            ), '[]'::json)
        )
        FROM documents dt
    `).Scan(&result)

	if err != nil {
		return err
	}

	// Lock while updating the cache to protect concurrent readers.
	imc.mu.Lock()
	defer imc.mu.Unlock()
	imc.DocumentsFormat = result

	active, err := buildActiveDocuments(result)
	if err != nil {
		return err
	}
	imc.ActiveDocuments = active

	return nil
}

func buildActiveDocuments(raw json.RawMessage) (json.RawMessage, error) {
	var wrapper user.DocsFormat

	if err := json.Unmarshal(raw, &wrapper); err != nil {
		return nil, err
	}

	activeDocs := make([]user.Docs, 0, len(wrapper.Documents))

	for _, doc := range wrapper.Documents {
		if doc.Active {
			activeFields := make([]user.DocFields, 0, len(doc.Fields))

			for _, field := range doc.Fields {
				if field.Active {
					activeFields = append(activeFields, field)
				}
			}

			doc.Fields = activeFields

			activeDocs = append(activeDocs, doc)

		}
	}

	filtered := user.DocsFormat{Documents: activeDocs}

	out, err := json.Marshal(filtered)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (imc *inMemoryCache) GetDocuments() json.RawMessage {
	imc.mu.RLock()
	defer imc.mu.RUnlock()
	return imc.DocumentsFormat
}

func (imc *inMemoryCache) GetActiveDocumentsFormat() json.RawMessage {
	imc.mu.RLock()
	defer imc.mu.RUnlock()
	return imc.ActiveDocuments
}

func (imc *inMemoryCache) Refresh() error {
	return imc.LoadDocumentsFormat()
}
