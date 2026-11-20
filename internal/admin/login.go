package admin

import (
	"context"
	"crypto/rand"
	"dataCollection/internal/cache"
	"dataCollection/internal/config"
	"encoding/hex"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

type Admin struct {
	AdminID  int64  `json:"adminId"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"-"`
	Role     string `json:"role"`
}

func loginApi(c *gin.Context) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please enter a valid Email and password."})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	var admin Admin

	err := config.DB.QueryRow(ctx,
		"SELECT adminId, name, email, password, role FROM admins WHERE email = $1 ",
		body.Email).Scan(
		&admin.AdminID,
		&admin.Name,
		&admin.Email,
		&admin.Password,
		&admin.Role)

	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Invalid email or password"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		}
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(body.Password)); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invalid email or password"})
		return
	}

	sessionId := generateSessionID()
	expiresAt := time.Now().Add(24 * time.Hour)

	_, errDb := config.DB.Exec(ctx,
		`INSERT INTO admin_sessions (sessionId, adminId, expires_at) VALUES ($1, $2, $3)`,
		sessionId, admin.AdminID, expiresAt,
	)

	if errDb != nil {

		log.Printf("session save failed: adminId=%d err=%v", admin.AdminID, errDb)
		c.JSON(500, gin.H{"error": "Internal Server error"})
		return
	}

	c.SetCookie("sessionId", sessionId, 3600*24, "/", "", config.Settings.CookieSecure, config.Settings.CookieHttpOnly)
	cache.GetIMCache().SetAdminSession(sessionId, admin.AdminID, admin.Role, expiresAt)
	c.JSON(200, gin.H{"message": "login success"})

}

func generateSessionID() string {
	b := make([]byte, 32) // 32 byte = 64 char string
	rand.Read(b)
	return hex.EncodeToString(b)
}

func loginRequired() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		sessionId, err := ctx.Cookie("sessionId")

		if err != nil {
			rejectUnauthenticated(ctx)
			return
		}

		adminSession, adminExists := cache.GetIMCache().GetAdminSessionById(sessionId)

		if !adminExists {
			rejectUnauthenticated(ctx)
			return
		}

		ctx.Set("adminId", adminSession.AdminID)
		ctx.Set("role", adminSession.Role)

		ctx.Next()

	}
}

func rejectUnauthenticated(c *gin.Context) {
	if c.Request.Method == http.MethodGet &&
		c.Request.URL.Path == "/admin/" {
		c.Redirect(http.StatusSeeOther, "/admin/login")
		c.Abort()
		return
	}

	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
		"error": "Login required",
	})
}

func logout(c *gin.Context) {
	sessionID, err := c.Cookie("sessionId")
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Login required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Minute)
	defer cancel()

	// First revoke the session in the database.
	_, err = config.DB.Exec(
		ctx,
		`DELETE FROM admin_sessions WHERE sessionId = $1`,
		sessionID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Unable to log out. Please try again.",
		})
		return
	}

	// Then remove it from this server's cache.
	cache.GetIMCache().DeleteAdminSession(sessionID)

	// Clear the cookie using the same path and domain as login.
	c.SetCookie("sessionId", "", -1, "/", "", config.Settings.CookieSecure, config.Settings.CookieHttpOnly)

	c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
}
