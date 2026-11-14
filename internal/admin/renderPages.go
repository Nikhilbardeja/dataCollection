package admin

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func renderHTML(c *gin.Context, code int, template string, data gin.H) {

	if data == nil {
		data = gin.H{}
	}

	data["staticURL"] = StaticURL

	c.HTML(code, template, data)
}

func adminHome(c *gin.Context) {
	renderHTML(c, http.StatusOK, "admin/admin.html", gin.H{})
}
