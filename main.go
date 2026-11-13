package main

import (
	"dataCollection/internal/admin"
	"dataCollection/internal/config"
	"dataCollection/internal/user"
	"dataCollection/internal/utils"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := config.Load(); err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	config.InitDB()

	if err := utils.GetIMCache().LoadDocumentsFormat(); err != nil {
		log.Fatalf("Cache load nahi hua: %v", err)
	}
	log.Println("Cache loaded")

	var router *gin.Engine = gin.Default()

	router.LoadHTMLGlob("templates/**/*.html")

	var v1 *gin.RouterGroup = router.Group("/")

	user.RegisterRoutesV1(v1)
	admin.RegisterRoutesV1(v1)

	router.Run(":5000")
}
