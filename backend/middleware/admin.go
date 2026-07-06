package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/motion/backend/pkg/utils"
)

// AdminOnly checks if the authenticated user has an 'admin' role
func AdminOnly(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		roleVal := c.Get("role")
		role, ok := roleVal.(string)
		if !ok || role != "admin" {
			return utils.JSONError(c, http.StatusForbidden, "Akses admin diperlukan")
		}
		return next(c)
	}
}
