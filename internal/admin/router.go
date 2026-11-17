package admin

import (
	"github.com/gin-gonic/gin"
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

	}
	{
		private.GET("/get-data", getDataByDate)
		private.GET("/", adminHome)
		private.GET("/document-types", GetDocumentTypes)
		private.POST("/add-document", addDocument)
		private.PUT("/edit-document", editDocument)

		private.POST("/add-field", addFiled)
		private.PUT("/edit-field", editField)
	}
}
