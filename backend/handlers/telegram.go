package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/motion/backend/services"
)

// HandleTelegramWebhook menangani update dari Telegram Webhook (untuk production)
func HandleTelegramWebhook(c echo.Context) error {
	var update services.TelegramUpdate
	if err := c.Bind(&update); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid payload"})
	}

	// Proses update secara asinkron agar server Telegram segera mendapatkan status 200 OK
	go services.ProcessTelegramUpdate(update)

	return c.JSON(http.StatusOK, map[string]string{"status": "success"})
}
