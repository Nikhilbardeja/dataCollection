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

	{
		public.GET("/get-data", getDataByDate)
		public.GET("/", adminHome)
		public.GET("/document-types", GetDocumentTypes)
		public.POST("/add-document", addDocument)
		public.PUT("/edit-document", editDocument)

		public.POST("/add-field", addFiled)
		public.PUT("/edit-field", editField)
	}
}
