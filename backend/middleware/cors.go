package middleware

import (
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/motion/backend/config"
)

// ConfigureCORS sets up CORS with support for local development frontends
func ConfigureCORS() echo.MiddlewareFunc {
	// Whitelist only known origins
	allowedOrigins := []string{
		"http://localhost:3000",
		"http://127.0.0.1:3000",
	}

	// Add production origins from config
	if config.AppConfig != nil && config.AppConfig.FrontendURL != "" {
		frontendURL := config.AppConfig.FrontendURL
		if frontendURL[len(frontendURL)-1] == '/' {
			frontendURL = frontendURL[:len(frontendURL)-1]
		}
		// Avoid duplicate
		alreadyAdded := false
		for _, o := range allowedOrigins {
			if strings.EqualFold(o, frontendURL) {
				alreadyAdded = true
				break
			}
		}
		if !alreadyAdded {
			allowedOrigins = append(allowedOrigins, frontendURL)
		}
	}

	return middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: allowedOrigins, // ✅ Strict whitelist

		AllowHeaders: []string{
			echo.HeaderOrigin,
			echo.HeaderContentType,
			echo.HeaderAccept,
			echo.HeaderAuthorization,
		}, // ❌ Removed X-Requested-With, Cache-Control

		AllowMethods: []string{
			echo.GET,
			echo.POST,
			echo.PUT,
			echo.PATCH,
			echo.DELETE,
		}, // ❌ Removed OPTIONS (auto-handled)

		AllowCredentials: true,

		// ✅ Remove Set-Cookie from exposed headers
		ExposeHeaders: []string{
			"Content-Disposition", // For file downloads
			"X-Total-Count",       // For pagination
		},

		MaxAge: 3600, // ✅ Cache preflight for 1 hour
	})
}
