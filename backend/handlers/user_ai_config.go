package handlers

import (
	"net/http"
	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
)

type SaveAIConfigRequest struct {
	GeminiKey     *string `json:"gemini_key"`
	GroqKey       *string `json:"groq_key"`
	OpenRouterKey *string `json:"openrouter_key"`
}

// GET /api/v1/ai/config — menampilkan status konfigurasi (tanpa menyingkap key plaintext)
func HandleGetAIConfig(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	var cfg models.UserAIConfig
	config.DB.Where("user_id = ?", userID).First(&cfg)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"gemini_configured":      cfg.EncryptedGeminiKey != "",
		"groq_configured":        cfg.EncryptedGroqKey != "",
		"openrouter_configured":  cfg.EncryptedORKey != "",
	})
}

// PUT /api/v1/ai/config — menyimpan/memperbarui API Key (dienkripsi sebelum disimpan)
func HandleSaveAIConfig(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	var req SaveAIConfigRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	var cfg models.UserAIConfig
	config.DB.Where("user_id = ?", userID).FirstOrInit(&cfg, models.UserAIConfig{UserID: userID})

	if req.GeminiKey != nil {
		val := *req.GeminiKey
		if val == "" {
			cfg.EncryptedGeminiKey = ""
		} else {
			encrypted, err := utils.EncryptWithSalt(val, userID.String())
			if err == nil {
				cfg.EncryptedGeminiKey = encrypted
			}
		}
	}
	if req.GroqKey != nil {
		val := *req.GroqKey
		if val == "" {
			cfg.EncryptedGroqKey = ""
		} else {
			encrypted, err := utils.EncryptWithSalt(val, userID.String())
			if err == nil {
				cfg.EncryptedGroqKey = encrypted
			}
		}
	}
	if req.OpenRouterKey != nil {
		val := *req.OpenRouterKey
		if val == "" {
			cfg.EncryptedORKey = ""
		} else {
			encrypted, err := utils.EncryptWithSalt(val, userID.String())
			if err == nil {
				cfg.EncryptedORKey = encrypted
			}
		}
	}

	config.DB.Save(&cfg)
	return c.JSON(http.StatusOK, map[string]string{"message": "Konfigurasi API Key berhasil disimpan"})
}
