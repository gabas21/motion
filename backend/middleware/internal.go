package middleware

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
)

// InternalAuthRequired adalah middleware untuk endpoint internal yang dipanggil
// oleh MCP Server (Hermes Agent) dari dalam Docker network.
// Menggunakan X-Internal-Secret header, BUKAN JWT user.
//
// Setelah auth berhasil, middleware ini menyimpan userId ke context
// dengan format yang SAMA dengan AuthRequired (uuid.UUID),
// sehingga semua handler yang ada bisa dipakai langsung tanpa modifikasi.
//
// Keamanan: endpoint internal HANYA boleh diakses dari dalam Docker network.
// Jangan expose port internal ke publik.
func InternalAuthRequired(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		// Jika secret tidak dikonfigurasi, fitur internal dinonaktifkan
		secret := config.AppConfig.HermesInternalSecret
		if secret == "" {
			return c.JSON(http.StatusServiceUnavailable, map[string]string{
				"error": "Internal API tidak aktif — HERMES_INTERNAL_SECRET belum dikonfigurasi di .env",
			})
		}

		// Periksa header X-Internal-Secret
		providedSecret := c.Request().Header.Get("X-Internal-Secret")
		if providedSecret == "" || providedSecret != secret {
			return c.JSON(http.StatusUnauthorized, map[string]string{
				"error": "Akses ditolak — secret internal tidak valid",
			})
		}

		// Ambil user_id dari header (MCP Server menyuplai ini)
		// Header X-User-ID berisi UUID string dari user yang bersangkutan
		userIDStr := c.Request().Header.Get("X-User-ID")
		if userIDStr == "" {
			userIDStr = c.QueryParam("user_id")
		}

		if userIDStr == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "Header X-User-ID diperlukan untuk internal API",
			})
		}

		// Parse ke uuid.UUID — format SAMA dengan AuthRequired middleware
		// agar semua handler yang ada bisa dipakai langsung tanpa modifikasi
		parsedUUID, err := uuid.Parse(userIDStr)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "X-User-ID bukan UUID yang valid",
			})
		}

		// Set dengan key "userId" (sama persis dengan JWT middleware)
		c.Set("userId", parsedUUID)

		return next(c)
	}
}
