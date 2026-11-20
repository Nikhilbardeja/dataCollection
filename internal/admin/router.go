package admin

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/csrf"
)

const StaticPath = "./internal/admin/static"
const StaticURL = "/admin/static"

func RegisterRoutesV1(rg *gin.RouterGroup) {

	userGroup := rg.Group("/admin")

	userGroup.Static("/static", StaticPath)

	public := userGroup.Group("/")
	private := userGroup.Group("/")

	private.Use(loginRequired())

	{
		public.GET("/login", login)
		public.POST("/login", loginApi)
		public.GET("/csrf", func(c *gin.Context) {
			c.Header("Cache-Control", "no-store")
			c.JSON(http.StatusOK, gin.H{
				"csrfToken": csrf.Token(c.Request),
			})
		})

	}
	{
		private.GET("/get-data", getDataByDate)
		private.GET("/", adminHome)
		private.GET("/document-types", GetDocumentTypes)
		private.POST("/add-document", addDocument)
		private.PUT("/edit-document", editDocument)

		private.POST("/add-field", addFiled)
		private.PUT("/edit-field", editField)

		private.POST("/logout", logout)
	}
}
