package admin

import (
	"dataCollection/internal/cache"
	"dataCollection/internal/config"
	"log"

	"github.com/gin-gonic/gin"
)

type fieldBody struct {
	DocumentId string  `json:"documentId"`
	Key        string  `json:"key"`
	Label      string  `json:"label"`
	Type       string  `json:"type"`
	Required   bool    `json:"required"`
	Pattern    *string `json:"pattern"`
	NotFuture  bool    `json:"not_future"`
	Active     bool    `json:"active"`
}

func addFiled(c *gin.Context) {
	var field fieldBody
	if err := c.ShouldBindJSON(&field); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request format. Check the submmited document."})
		return
	}

	tag, err := config.DB.Exec(c.Request.Context(),
		"INSERT INTO document_fields(documentId, field_key, label, field_type, required, pattern, not_future, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
		field.DocumentId, field.Key, field.Label, field.Type, field.Required, field.Pattern, field.NotFuture, field.Active)

	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(500, gin.H{"error": "Unable to save field."})
		return
	}

	// must refresh the cache to reflect the changes on server
	if err := cache.GetIMCache().Refresh(); err != nil {
		log.Printf("Cache refresh failed after saving document: %v", err)

		c.JSON(200, gin.H{
			"message":         "Document saved, but the updated settings may not appear immediately.",
			"cache_refreshed": false,
		})
		return
	}

	c.JSON(201, gin.H{
		"message":         "Field saved",
		"cache_refreshed": true,
	})
}

func editField(c *gin.Context) {
	var field fieldBody
	if err := c.ShouldBindJSON(&field); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request format. Check the submmited document."})
		return
	}

	tag, err := config.DB.Exec(c.Request.Context(),
		"UPDATE document_fields SET label = $1, field_type = $2, required = $3, pattern = $4, not_future = $5, active = $6 WHERE documentId = $7 AND field_key = $8",
		field.Label, field.Type, field.Required, field.Pattern, field.NotFuture, field.Active, field.DocumentId, field.Key)

	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(500, gin.H{"error": "Unable to edit the field."})
		return
	}

	// must refresh the cache to reflect the changes on server
	if err := cache.GetIMCache().Refresh(); err != nil {
		log.Printf("Cache refresh failed after saving document: %v", err)

		c.JSON(200, gin.H{
			"message":         "Document saved, but the updated settings may not appear immediately.",
			"cache_refreshed": false,
		})
		return
	}

	c.JSON(201, gin.H{
		"message":         "Field edited",
		"cache_refreshed": true,
	})
}
