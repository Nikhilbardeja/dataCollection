package admin

import (
	"dataCollection/internal/config"

	"github.com/gin-gonic/gin"
)

type fieldBody struct {
	DocumentId string  `json:"document_id"`
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
		"INSERT INTO document_fields(document_id, field_key, label, field_type, required, pattern, not_future) VALUES ($1, $2, $3, $4, $5, $6)",
		field.Key, field.Label, field.Type, field.Required, field.Pattern, field.NotFuture)

	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(500, gin.H{"error": "Unable to save field."})
		return
	}

	c.JSON(201, gin.H{
		"message": "Field saved",
	})
}

func editField(c *gin.Context) {
	var field fieldBody
	if err := c.ShouldBindJSON(&field); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request format. Check the submmited document."})
		return
	}

	tag, err := config.DB.Exec(c.Request.Context(),
		"UPDATE documents SET label = $1, field_type = $2, required = $3, pattern = $4, not_future = $5, active = $6 WHERE id = $7",
		field.Label, field.Type, field.Required, field.Pattern, field.NotFuture, field.Active, field.DocumentId)

	if err != nil || tag.RowsAffected() == 0 {
		c.JSON(500, gin.H{"error": "Unable to edit the field."})
		return
	}

	c.JSON(201, gin.H{
		"message": "Field edited",
	})
}
