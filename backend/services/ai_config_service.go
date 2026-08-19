package services

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
)

// ValidateProviderKey performs a lightweight test call to verify if the provided API key is valid.
func ValidateProviderKey(ctx context.Context, provider, apiKey string) error {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return fmt.Errorf("API Key tidak boleh kosong")
	}

	client := &http.Client{Timeout: 8 * time.Second}

	switch strings.ToLower(provider) {
	case "gemini":
		url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models?key=%s", apiKey)
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return err
		}
		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("gagal terhubung ke Google Gemini: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("API Key Gemini tidak valid atau kuota habis (HTTP %d)", resp.StatusCode)
		}
		return nil

	case "groq":
		req, err := http.NewRequestWithContext(ctx, "GET", "https://api.groq.com/openai/v1/models", nil)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("gagal terhubung ke Groq API: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("API Key Groq tidak valid atau terblokir (HTTP %d)", resp.StatusCode)
		}
		return nil

	case "openrouter":
		req, err := http.NewRequestWithContext(ctx, "GET", "https://openrouter.ai/api/v1/models", nil)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("gagal terhubung ke OpenRouter API: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("API Key OpenRouter tidak valid (HTTP %d)", resp.StatusCode)
		}
		return nil

	default:
		return fmt.Errorf("provider '%s' tidak didukung (gunakan 'gemini', 'groq', atau 'openrouter')", provider)
	}
}

// GetKeyLast4 extracts the last 4 characters of an API key for safe UI display
func GetKeyLast4(apiKey string) string {
	cleaned := strings.TrimSpace(apiKey)
	if len(cleaned) <= 4 {
		return cleaned
	}
	return cleaned[len(cleaned)-4:]
}

// SaveUserAIKey validates, encrypts, and saves an API key for a user
func SaveUserAIKey(ctx context.Context, userIDStr, provider, apiKey string) (*models.UserAIConfig, error) {
	userUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID")
	}

	provider = strings.ToLower(strings.TrimSpace(provider))
	apiKey = strings.TrimSpace(apiKey)

	// 1. Validate key with test call
	if err := ValidateProviderKey(ctx, provider, apiKey); err != nil {
		return nil, err
	}

	// 2. Encrypt key using salt (AES-256-GCM)
	encryptedKey, err := utils.EncryptWithSalt(apiKey, userIDStr)
	if err != nil {
		return nil, fmt.Errorf("gagal mengenkripsi API Key: %v", err)
	}

	last4 := GetKeyLast4(apiKey)
	now := time.Now()

	var cfg models.UserAIConfig
	result := config.DB.Where("user_id = ?", userUUID).First(&cfg)
	if result.Error != nil {
		cfg = models.UserAIConfig{
			UserID: userUUID,
		}
	}

	switch provider {
	case "gemini":
		cfg.EncryptedGeminiKey = encryptedKey
		cfg.GeminiKeyLast4 = last4
		cfg.GeminiIsValid = true
		cfg.GeminiValidatedAt = &now
	case "groq":
		cfg.EncryptedGroqKey = encryptedKey
		cfg.GroqKeyLast4 = last4
		cfg.GroqIsValid = true
		cfg.GroqValidatedAt = &now
	case "openrouter":
		cfg.EncryptedORKey = encryptedKey
		cfg.ORKeyLast4 = last4
		cfg.ORIsValid = true
		cfg.ORValidatedAt = &now
	}

	if cfg.ID == uuid.Nil {
		if err := config.DB.Create(&cfg).Error; err != nil {
			return nil, err
		}
	} else {
		if err := config.DB.Save(&cfg).Error; err != nil {
			return nil, err
		}
	}

	return &cfg, nil
}

// DeleteUserAIKey removes a specific provider's API key for a user
func DeleteUserAIKey(userIDStr, provider string) error {
	userUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		return fmt.Errorf("invalid user ID")
	}

	provider = strings.ToLower(strings.TrimSpace(provider))

	var cfg models.UserAIConfig
	if err := config.DB.Where("user_id = ?", userUUID).First(&cfg).Error; err != nil {
		return nil // Nothing to delete
	}

	updates := map[string]interface{}{}
	switch provider {
	case "gemini":
		updates["encrypted_gemini_key"] = ""
		updates["gemini_key_last4"] = ""
		updates["gemini_is_valid"] = false
		updates["gemini_validated_at"] = nil
	case "groq":
		updates["encrypted_groq_key"] = ""
		updates["groq_key_last4"] = ""
		updates["groq_is_valid"] = false
		updates["groq_validated_at"] = nil
	case "openrouter":
		updates["encrypted_or_key"] = ""
		updates["or_key_last4"] = ""
		updates["or_is_valid"] = false
		updates["or_validated_at"] = nil
	default:
		return fmt.Errorf("provider tidak valid")
	}

	return config.DB.Model(&cfg).Updates(updates).Error
}

type UserAIConfigSummary struct {
	HasCustomKey bool                     `json:"hasCustomKey"`
	Providers    map[string]ProviderStatus `json:"providers"`
}

type ProviderStatus struct {
	Configured  bool       `json:"configured"`
	KeyLast4    string     `json:"keyLast4,omitempty"`
	IsValid     bool       `json:"isValid"`
	ValidatedAt *time.Time `json:"validatedAt,omitempty"`
}

// GetUserAIConfigSummary returns safe, non-sensitive summary of user's AI API keys
func GetUserAIConfigSummary(userIDStr string) (*UserAIConfigSummary, error) {
	userUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID")
	}

	summary := &UserAIConfigSummary{
		HasCustomKey: false,
		Providers: map[string]ProviderStatus{
			"gemini":     {Configured: false},
			"groq":       {Configured: false},
			"openrouter": {Configured: false},
		},
	}

	var cfg models.UserAIConfig
	if err := config.DB.Where("user_id = ?", userUUID).First(&cfg).Error; err != nil {
		return summary, nil
	}

	if cfg.EncryptedGeminiKey != "" {
		summary.Providers["gemini"] = ProviderStatus{
			Configured:  true,
			KeyLast4:    cfg.GeminiKeyLast4,
			IsValid:     cfg.GeminiIsValid,
			ValidatedAt: cfg.GeminiValidatedAt,
		}
		if cfg.GeminiIsValid {
			summary.HasCustomKey = true
		}
	}

	if cfg.EncryptedGroqKey != "" {
		summary.Providers["groq"] = ProviderStatus{
			Configured:  true,
			KeyLast4:    cfg.GroqKeyLast4,
			IsValid:     cfg.GroqIsValid,
			ValidatedAt: cfg.GroqValidatedAt,
		}
		if cfg.GroqIsValid {
			summary.HasCustomKey = true
		}
	}

	if cfg.EncryptedORKey != "" {
		summary.Providers["openrouter"] = ProviderStatus{
			Configured:  true,
			KeyLast4:    cfg.ORKeyLast4,
			IsValid:     cfg.ORIsValid,
			ValidatedAt: cfg.ORValidatedAt,
		}
		if cfg.ORIsValid {
			summary.HasCustomKey = true
		}
	}

	return summary, nil
}
