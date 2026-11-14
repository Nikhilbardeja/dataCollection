package user

import (
	"context"
	utils "dataCollection/internal/cache"
	"dataCollection/internal/config"
	"dataCollection/internal/models"
	"encoding/json"

	"regexp"
	"time"

	"github.com/gin-gonic/gin"
)

// Submission payload received from the frontend.
type SubmitDoc struct {
	DocumentTypeID string            `json:"document_id"`
	Fields         map[string]string `json:"fields"`
}

type SubmitRequest struct {
	Phone     string      `json:"phone"`
	Documents []SubmitDoc `json:"documents" binding:"required,min=1"`
}

func SubmitDocuments(c *gin.Context) {
	var req SubmitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request format. Check the phone number and documents."})
		return
	}

	if !regexp.MustCompile(`^[0-9]{10}$`).MatchString(req.Phone) {
		c.JSON(400, gin.H{"error": "Enter a valid 10-digit phone number.", "field_key": "phone"})
		return
	}

	// Load the document configuration from the cache.
	requiredFormat := utils.GetIMCache().GetDocuments()
	if len(requiredFormat) == 0 {
		c.JSON(500, gin.H{"error": "Internal server error"})
		return
	}

	var format models.DocsFormat
	if err := json.Unmarshal(requiredFormat, &format); err != nil {
		c.JSON(500, gin.H{"error": "Invalid document configuration"})
		return
	}

	// Validate submitted documents against the cached configuration.
	seen := make(map[string]bool)

	for _, reqDoc := range req.Documents {
		// Check whether the document type is configured.
		var cachedDoc *models.Docs
		for i := range format.Documents {
			if format.Documents[i].DocumentTypeID == reqDoc.DocumentTypeID {
				cachedDoc = &format.Documents[i]
				break
			}
		}
		if cachedDoc == nil {
			c.JSON(400, gin.H{"error": "unknown document: " + reqDoc.DocumentTypeID})
			return
		}

		// Reject duplicate document types.
		if seen[reqDoc.DocumentTypeID] {
			c.JSON(400, gin.H{"error": "duplicate document: " + reqDoc.DocumentTypeID})
			return
		}
		seen[reqDoc.DocumentTypeID] = true

		// Reject unknown fields.
		for k := range reqDoc.Fields {
			found := false
			for _, f := range cachedDoc.Fields {
				if f.Key == k {
					found = true
					break
				}
			}
			if !found {
				c.JSON(400, gin.H{"error": "Unknown field: " + k, "document_id": cachedDoc.DocumentTypeID, "field_key": k})
				return
			}
		}

		// Validate required fields and values.
		for _, f := range cachedDoc.Fields {
			val, exists := reqDoc.Fields[f.Key]
			if f.Required && (!exists || val == "") {
				c.JSON(400, gin.H{"error": f.Label + " is required.", "document_id": cachedDoc.DocumentTypeID, "field_key": f.Key})
				return
			}
			if !exists || val == "" {
				continue
			}

			// required pattern check
			if f.Pattern != "" {
				if matched, _ := regexp.MatchString(f.Pattern, val); !matched {
					c.JSON(400, gin.H{"error": "Please enter a valid " + f.Label + ".", "document_id": cachedDoc.DocumentTypeID, "field_key": f.Key})
					return
				}
			}

			// Date check + NotFuture check
			if f.Type == "date" {
				parsed, err := time.Parse("2006-01-02", val)
				if err != nil {
					c.JSON(400, gin.H{"error": "Enter a valid date in YYYY-MM-DD format.", "document_id": cachedDoc.DocumentTypeID, "field_key": f.Key})
					return
				}
				if f.NotFuture && parsed.After(time.Now()) {
					c.JSON(400, gin.H{"error": f.Label + " cannot be in the future.", "document_id": cachedDoc.DocumentTypeID, "field_key": f.Key})
					return
				}
			}
		}
	}

	// Check that every required document is included.
	for _, d := range format.Documents {
		if d.Required && !seen[d.DocumentTypeID] {
			c.JSON(400, gin.H{"error": "required document missing: " + d.DocumentTypeID})
			return
		}
	}

	// Store the validated submission in a transaction.
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	tx, err := config.DB.Begin(ctx)
	if err != nil {
		c.JSON(500, gin.H{"error": "db error"})
		return
	}
	defer tx.Rollback(ctx)

	// Create one submission for the entire request.
	var submissionId int64
	err = tx.QueryRow(ctx,
		"INSERT INTO submissions (phone) VALUES ($1) RETURNING submissionId",
		req.Phone,
	).Scan(&submissionId)
	if err != nil {
		c.JSON(500, gin.H{"error": "Unable to save submission"})
		return
	}

	// Save each document field under the submission.
	for _, doc := range req.Documents {
		for k, v := range doc.Fields {
			_, err = tx.Exec(ctx,
				"INSERT INTO submission_values (submissionId, document_id, field_key, field_value) VALUES ($1, $2, $3, $4)",
				submissionId, doc.DocumentTypeID, k, v,
			)
			if err != nil {
				c.JSON(500, gin.H{"error": "Unable to save submission"})
				return
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(500, gin.H{"error": "Unable to save submission"})
		return
	}

	c.JSON(200, gin.H{"status": "saved", "submissionId": submissionId})
}
