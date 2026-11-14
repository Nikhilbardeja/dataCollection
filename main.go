package main

import (
	"dataCollection/internal/admin"
	cache "dataCollection/internal/cache"
	"dataCollection/internal/config"
	"dataCollection/internal/user"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := config.Load(); err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	config.InitDB()

	if err := cache.GetIMCache().LoadDocumentsFormat(); err != nil {
		log.Fatalf("Failed to load cache: %v", err)
	}
	log.Println("Cache loaded")

	var router *gin.Engine = gin.Default()

	router.LoadHTMLGlob("templates/**/*.html")

	var v1 *gin.RouterGroup = router.Group("/")

	user.RegisterRoutesV1(v1)
	admin.RegisterRoutesV1(v1)

	router.Run(":5000")
}
