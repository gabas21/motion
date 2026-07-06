package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/motion/backend/pkg/utils"
)

// AuthRequired is a middleware that checks for a valid JWT in the Authorization header or HTTP-only cookie
func AuthRequired(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		var tokenStr string

		// 1. Coba baca dari header Authorization
		authHeader := c.Request().Header.Get("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				tokenStr = parts[1]
			}
		}

		// 2. Coba baca dari HTTP-only Cookie jika dari header kosong
		if tokenStr == "" {
			cookie, err := c.Cookie("motion_token")
			if err == nil {
				tokenStr = cookie.Value
			}
		}

		// 3. Coba baca dari Query Parameter jika header & cookie kosong (khusus untuk WebSocket)
		if tokenStr == "" {
			tokenStr = c.QueryParam("token")
		}

		if tokenStr == "" {
			return utils.JSONError(c, http.StatusUnauthorized, "Sesi login tidak ditemukan atau telah kedaluwarsa")
		}

		claims, err := utils.ValidateJWT(tokenStr)
		if err != nil {
			return utils.JSONError(c, http.StatusUnauthorized, "Sesi login tidak valid atau telah kedaluwarsa")
		}

		// Store user details in the context
		c.Set("userId", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)

		return next(c)
	}
}
