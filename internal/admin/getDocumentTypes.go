package admin

import (
	cache "dataCollection/internal/cache"

	"github.com/gin-gonic/gin"
)

func GetDocumentTypes(c *gin.Context) {
	data := cache.GetIMCache().GetDocuments()
	if len(data) == 0 {
		c.JSON(500, gin.H{"error": "cache not loaded"})
		return
	}
	c.Data(200, "application/json", data)
}
