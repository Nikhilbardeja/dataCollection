package models

// Document configuration loaded from the database cache.
type DocFields struct {
	Key       string `json:"key"`
	Label     string `json:"label"`
	Type      string `json:"type"`
	Required  bool   `json:"required"`
	Pattern   string `json:"pattern"`
	NotFuture bool   `json:"not_future"`
	Active    bool   `json:"active"`
}

type Docs struct {
	DocumentTypeID string      `json:"id"`
	Name           string      `json:"name"`
	Required       bool        `json:"required"`
	Fields         []DocFields `json:"fields"`
	Active         bool        `json:"active"`
}

type DocsFormat struct {
	Documents []Docs `json:"documents"`
}
