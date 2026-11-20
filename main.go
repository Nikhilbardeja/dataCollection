package main

import (
	"context"
	"dataCollection/internal/admin"
	cache "dataCollection/internal/cache"
	"dataCollection/internal/config"
	"dataCollection/internal/user"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/gorilla/csrf"
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

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go cache.StartRefreshScheduler(ctx, 60*time.Minute)

	var router *gin.Engine = gin.Default()

	router.LoadHTMLGlob("templates/**/*.html")

	var v1 *gin.RouterGroup = router.Group("/")

	user.RegisterRoutesV1(v1)
	admin.RegisterRoutesV1(v1)

	csrfKey := []byte(config.Settings.CSRFAuthKey)
	if len(csrfKey) != 32 {
		log.Fatal("CSRF_AUTH_KEY must be exactly 32 bytes")
	}

	csrfProtection := csrf.Protect(
		csrfKey,
		csrf.Secure(config.Settings.CookieSecure), //TODO: make it true in production
		csrf.HttpOnly(true),
		csrf.SameSite(csrf.SameSiteLaxMode),
		csrf.Path("/admin"),
	)

	mux := http.NewServeMux()
	var adminHandler http.Handler = csrfProtection(router)

	if config.Settings.Development == true {
		// Only for local HTTP development.
		protectedHandler := adminHandler

		adminHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			protectedHandler.ServeHTTP(w, csrf.PlaintextHTTPRequest(r))
		})
	}
	mux.Handle("/admin/", adminHandler)
	mux.Handle("/", router)

	if err := http.ListenAndServe(":5000", mux); err != nil {
		log.Printf("Server stopped: %v", err)
	}

}

// docker exec -it dataCollectionDB psql -U postgres -d dataCollectionDB

// TODO: Set cookie secure: true // in production only

// Add rate limiting
