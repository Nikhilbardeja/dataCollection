package admin

import (
	"dataCollection/internal/cache"
	"dataCollection/internal/config"
	"log"

	"github.com/gin-gonic/gin"
)

type documentBody struct {
	DocumentId string `json:"documentId" binding:"required"`
	Name       string `json:"name" binding:"required"`
	Required   *bool  `json:"required" binding:"required"`
	SortOrder  *int   `json:"sort_order" binding:"required"`
	Active     bool   `json:"active"`
}

func addDocument(c *gin.Context) {
	var doc documentBody
	if err := c.ShouldBindJSON(&doc); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request format. Check the submmited document."})
		return
	}

	tag, err := config.DB.Exec(c.Request.Context(),
		"INSERT INTO documents(documentId, name, required, sort_order, active) VALUES ($1, $2, $3, $4, $5)",
		doc.DocumentId, doc.Name, doc.Required, doc.SortOrder, doc.Active)

	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(500, gin.H{"error": "Unable to save document"})
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
		"message":         "Document saved",
		"cache_refreshed": true,
	})
}

func editDocument(c *gin.Context) {
	var doc documentBody
	if err := c.ShouldBindJSON(&doc); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request format. Check the submmited document."})
		return
	}

	tag, err := config.DB.Exec(c.Request.Context(),
		"UPDATE documents SET name = $1, required = $2, sort_order = $3, active = $4 WHERE documentId = $5",
		doc.Name, doc.Required, doc.SortOrder, doc.Active, doc.DocumentId)

	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(500, gin.H{"error": "Unable to edit the document."})
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
		"message":         "Document edited",
		"cache_refreshed": true,
	})
}
