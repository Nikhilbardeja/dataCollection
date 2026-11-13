package admin

import (
	"github.com/gin-gonic/gin"
)

const StaticPath = "./internal/user/static"
const StaticURL = "/user/static"

func RegisterRoutesV1(rg *gin.RouterGroup) {

	userGroup := rg.Group("/admin")

	userGroup.Static("/static", StaticPath)

	public := userGroup.Group("/")

	{
		public.GET("/get-data", getDataByDate)
	}
}
