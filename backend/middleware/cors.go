package middleware

import (
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/motion/backend/config"
)

// ConfigureCORS sets up CORS with support for local development frontends & mobile LAN devices
func ConfigureCORS() echo.MiddlewareFunc {
	return middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOriginFunc: func(origin string) (bool, error) {
			// Izinkan localhost
			if origin == "http://localhost:3000" || origin == "http://127.0.0.1:3000" {
				return true, nil
			}
			// Izinkan IP jaringan lokal (misal: 192.168.x.x, 172.x.x.x, 10.x.x.x port 3000)
			if strings.HasPrefix(origin, "http://192.168.") || strings.HasPrefix(origin, "http://172.") || strings.HasPrefix(origin, "http://10.") {
				if strings.HasSuffix(origin, ":3000") {
					return true, nil
				}
			}
			// Add production origins from config
			if config.AppConfig != nil && config.AppConfig.FrontendURL != "" {
				frontendURL := strings.TrimRight(config.AppConfig.FrontendURL, "/")
				if strings.EqualFold(origin, frontendURL) {
					return true, nil
				}
			}
			return false, nil
		},

		AllowHeaders: []string{
			echo.HeaderOrigin,
			echo.HeaderContentType,
			echo.HeaderAccept,
			echo.HeaderAuthorization,
		},

		AllowMethods: []string{
			echo.GET,
			echo.POST,
			echo.PUT,
			echo.PATCH,
			echo.DELETE,
		},

		AllowCredentials: true,

		ExposeHeaders: []string{
			"Content-Disposition", // For file downloads
			"X-Total-Count",       // For pagination
		},

		MaxAge: 3600, // Cache preflight for 1 hour
	})
}
