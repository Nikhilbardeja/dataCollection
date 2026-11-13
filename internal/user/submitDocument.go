package user

import (
	"context"
	"dataCollection/internal/config"
	"dataCollection/internal/utils"
	"encoding/json"

	"regexp"
	"time"

	"github.com/gin-gonic/gin"
)

// Cache wala format - DB se aata hai
type DocFields struct {
	Key       string `json:"key"`
	Label     string `json:"label"`
	Type      string `json:"type"`
	Required  bool   `json:"required"`
	Pattern   string `json:"pattern"`
	NotFuture bool   `json:"not_future"`
}

type Docs struct {
	DocumentTypeID string      `json:"document_type_id"`
	Name           string      `json:"name"`
	Required       bool        `json:"required"`
	Fields         []DocFields `json:"fields"`
}

type DocsFormat struct {
	DocumentTypes []Docs `json:"documents"`
}

// Frontend se aane wala data
type SubmitDoc struct {
	DocumentTypeID string            `json:"document_type_id"`
	Fields         map[string]string `json:"fields"`
}

type SubmitRequest struct {
	Phone     string      `json:"phone" binding:"required,len=10"`
	Documents []SubmitDoc `json:"documents" binding:"required,min=1"`
}

func SubmitDocuments(c *gin.Context) {
	var req SubmitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "galat format: " + err.Error()})
		return
	}

	// 1. Cache se required format nikalo
	requiredFormat := utils.GetIMCache().GetDocumentsFormat()
	if len(requiredFormat) == 0 {
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	var format DocsFormat
	if err := json.Unmarshal(requiredFormat, &format); err != nil {
		c.JSON(500, gin.H{"error": "cache corrupt"})
		return
	}

	// 2. Validation - Cache wale Docs ko Frontend wale SubmitDoc se match karana
	seen := make(map[string]bool)

	for _, reqDoc := range req.Documents {
		// 2a. Ye document cache me hai kya?
		var cachedDoc *Docs
		for i := range format.DocumentTypes {
			if format.DocumentTypes[i].DocumentTypeID == reqDoc.DocumentTypeID {
				cachedDoc = &format.DocumentTypes[i]
				break
			}
		}
		if cachedDoc == nil {
			c.JSON(400, gin.H{"error": "unknown document: " + reqDoc.DocumentTypeID})
			return
		}

		// 2b. Duplicate to nahi hai?
		if seen[reqDoc.DocumentTypeID] {
			c.JSON(400, gin.H{"error": "duplicate document: " + reqDoc.DocumentTypeID})
			return
		}
		seen[reqDoc.DocumentTypeID] = true

		// 2c. Frontend ne extra field to nahi bheja?
		for k := range reqDoc.Fields {
			found := false
			for _, f := range cachedDoc.Fields {
				if f.Key == k {
					found = true
					break
				}
			}
			if !found {
				c.JSON(400, gin.H{"error": cachedDoc.DocumentTypeID + " me unknown field: " + k})
				return
			}
		}

		// 2d. Cache wala required field frontend ne bheja ya nahi?
		// 2d. Cache wala required field frontend ne bheja ya nahi?
		for _, f := range cachedDoc.Fields {
			val, exists := reqDoc.Fields[f.Key]
			if f.Required && (!exists || val == "") {
				c.JSON(400, gin.H{"error": cachedDoc.DocumentTypeID + " me required field missing: " + f.Key})
				return
			}
			if !exists || val == "" {
				continue
			}

			// required pattern check
			if f.Pattern != "" {
				if matched, _ := regexp.MatchString(f.Pattern, val); !matched {
					c.JSON(400, gin.H{"error": cachedDoc.DocumentTypeID + " me " + f.Key + " ka format galat hai"})
					return
				}
			}

			// Date check + NotFuture check
			if f.Type == "date" {
				parsed, err := time.Parse("2006-01-02", val)
				if err != nil {
					c.JSON(400, gin.H{"error": cachedDoc.DocumentTypeID + " me " + f.Key + " date format galat hai, YYYY-MM-DD me bhejo"})
					return
				}
				if f.NotFuture && parsed.After(time.Now()) {
					c.JSON(400, gin.H{"error": cachedDoc.DocumentTypeID + " me " + f.Key + " future ki date nahi ho sakti"})
					return
				}
			}
		}
	}

	// 2e. Jo document required tha wo aaya bhi hai?
	for _, d := range format.DocumentTypes {
		if d.Required && !seen[d.DocumentTypeID] {
			c.JSON(400, gin.H{"error": "required document missing: " + d.DocumentTypeID})
			return
		}
	}

	// 3. Sab valid hai, ab save karo
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		c.JSON(500, gin.H{"error": "db error"})
		return
	}
	defer tx.Rollback(ctx)

	// 3a. Ek hi submission banegi pure request ke liye
	var submissionId int64
	err = tx.QueryRow(ctx,
		"INSERT INTO submissions (phone) VALUES ($1) RETURNING submissionId",
		req.Phone,
	).Scan(&submissionId)
	if err != nil {
		c.JSON(500, gin.H{"error": "save nahi hua"})
		return
	}

	// 3b. Har document ke har field ko submission_values me daal do
	for _, doc := range req.Documents {
		for k, v := range doc.Fields {
			_, err = tx.Exec(ctx,
				"INSERT INTO submission_values (submissionId, document_type_id, field_key, field_value) VALUES ($1, $2, $3, $4)",
				submissionId, doc.DocumentTypeID, k, v,
			)
			if err != nil {
				c.JSON(500, gin.H{"error": "save nahi hua: " + err.Error()})
				return
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(500, gin.H{"error": "save nahi hua"})
		return
	}

	c.JSON(200, gin.H{"status": "saved", "submissionId": submissionId})
}
