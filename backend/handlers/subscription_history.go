package handlers

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
)

// GetSubscriptionHistory mengembalikan riwayat transaksi langganan milik user
// GET /api/v1/subscription/history
func GetSubscriptionHistory(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	var history []models.Subscription
	if err := config.DB.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(20).
		Find(&history).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil riwayat transaksi")
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"history": history,
		"total":   len(history),
	})
}
