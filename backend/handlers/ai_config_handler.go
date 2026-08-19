package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/motion/backend/pkg/utils"
	"github.com/motion/backend/services"
)

type SaveAIKeyRequest struct {
	Provider string `json:"provider"` // "gemini" | "groq" | "openrouter"
	APIKey   string `json:"apiKey"`
}

type LegacySaveAIConfigRequest struct {
	GeminiKey     *string `json:"gemini_key"`
	GroqKey       *string `json:"groq_key"`
	OpenRouterKey *string `json:"openrouter_key"`
}

// HandleGetAIConfig Summary safe status of user's BYOK keys
func HandleGetAIConfig(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	summary, err := services.GetUserAIConfigSummary(userID.String())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, summary)
}

// HandleSaveAIKey Validates test-call & saves encrypted API Key (single provider format)
func HandleSaveAIKey(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	var req SaveAIKeyRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "payload request tidak valid"})
	}

	if req.Provider == "" || req.APIKey == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "provider dan apiKey wajib diisi"})
	}

	cfg, err := services.SaveUserAIKey(c.Request().Context(), userID.String(), req.Provider, req.APIKey)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Validasi API Key gagal: " + err.Error(),
		})
	}

	summary, _ := services.GetUserAIConfigSummary(userID.String())
	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "API Key " + req.Provider + " berhasil diverifikasi dan disimpan secara aman!",
		"config":  cfg,
		"summary": summary,
	})
}

// HandleSaveAIConfig Legacy multi-key save endpoint with real-time test-call validation
func HandleSaveAIConfig(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	var req LegacySaveAIConfigRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}

	ctx := c.Request().Context()

	if req.GeminiKey != nil {
		val := *req.GeminiKey
		if val == "" {
			_ = services.DeleteUserAIKey(userID.String(), "gemini")
		} else {
			if _, err := services.SaveUserAIKey(ctx, userID.String(), "gemini", val); err != nil {
				return c.JSON(http.StatusBadRequest, map[string]string{"error": "Gemini Key: " + err.Error()})
			}
		}
	}

	if req.GroqKey != nil {
		val := *req.GroqKey
		if val == "" {
			_ = services.DeleteUserAIKey(userID.String(), "groq")
		} else {
			if _, err := services.SaveUserAIKey(ctx, userID.String(), "groq", val); err != nil {
				return c.JSON(http.StatusBadRequest, map[string]string{"error": "Groq Key: " + err.Error()})
			}
		}
	}

	if req.OpenRouterKey != nil {
		val := *req.OpenRouterKey
		if val == "" {
			_ = services.DeleteUserAIKey(userID.String(), "openrouter")
		} else {
			if _, err := services.SaveUserAIKey(ctx, userID.String(), "openrouter", val); err != nil {
				return c.JSON(http.StatusBadRequest, map[string]string{"error": "OpenRouter Key: " + err.Error()})
			}
		}
	}

	summary, _ := services.GetUserAIConfigSummary(userID.String())
	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "Konfigurasi API Key berhasil diverifikasi dan disimpan",
		"summary": summary,
	})
}

// HandleDeleteAIKey Deletes configured API key for a specific provider
func HandleDeleteAIKey(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	provider := c.Param("provider")
	if provider == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "parameter provider wajib diisi"})
	}

	if err := services.DeleteUserAIKey(userID.String(), provider); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	summary, _ := services.GetUserAIConfigSummary(userID.String())
	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "API Key " + provider + " berhasil dihapus.",
		"summary": summary,
	})
}
