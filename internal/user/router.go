package user

import (
	"github.com/gin-gonic/gin"
)

const StaticPath = "./internal/user/static"
const StaticURL = "/user/static"

func RegisterRoutesV1(rg *gin.RouterGroup) {

	userGroup := rg.Group("/user")

	userGroup.Static("/static", StaticPath)

	public := userGroup.Group("/")

	{
		public.GET("/", indexPage)
		public.GET("/document-types", GetDocumentTypes)
		public.POST("/submissions", SubmitDocuments)
	}
}
