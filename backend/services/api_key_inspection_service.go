package services

import (
	"errors"
	"fmt"
	"regexp"

	"github.com/google/uuid"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
)

var (
	geminiRegex     = regexp.MustCompile(`^AIzaSy[A-Za-z0-9_-]{33}$`)
	groqRegex       = regexp.MustCompile(`^gsk_[A-Za-z0-9]{48,64}$`)
	openRouterRegex = regexp.MustCompile(`^sk-or-v1-[A-Za-z0-9]{64}$`)
)

type KeyInspectionResult struct {
	Provider       string `json:"provider"`
	HasKey         bool   `json:"hasKey"`
	Last4          string `json:"last4,omitempty"`
	IsValidFormat  bool   `json:"isValidFormat"`
	ConnectionStatus string `json:"connectionStatus"`
	KeyRevealed    string `json:"keyRevealed,omitempty"`
}

// ValidateKeyFormat checks if the raw API key matches expected provider regex format
func ValidateKeyFormat(provider string, key string) bool {
	if key == "" {
		return false
	}
	switch provider {
	case "gemini":
		return geminiRegex.MatchString(key) || len(key) >= 30
	case "groq":
		return groqRegex.MatchString(key) || (len(key) >= 30 && key[:4] == "gsk_")
	case "openrouter":
		return openRouterRegex.MatchString(key) || (len(key) >= 30 && key[:6] == "sk-or-")
	default:
		return false
	}
}

// InspectUserAPIKeys inspects provider status and format validity without revealing key value
func InspectUserAPIKeys(targetUserID string) (map[string]KeyInspectionResult, error) {
	uUUID, err := uuid.Parse(targetUserID)
	if err != nil {
		return nil, errors.New("ID user tidak valid")
	}

	var cfg models.UserAIConfig
	if err := config.DB.Where("user_id = ?", uUUID).First(&cfg).Error; err != nil {
		return map[string]KeyInspectionResult{
			"gemini":     {Provider: "gemini", HasKey: false, ConnectionStatus: "unconfigured"},
			"groq":       {Provider: "groq", HasKey: false, ConnectionStatus: "unconfigured"},
			"openrouter": {Provider: "openrouter", HasKey: false, ConnectionStatus: "unconfigured"},
		}, nil
	}

	results := make(map[string]KeyInspectionResult)

	// Gemini
	if cfg.EncryptedGeminiKey != "" {
		dec, err := utils.DecryptWithSalt(cfg.EncryptedGeminiKey, targetUserID)
		validFmt := err == nil && ValidateKeyFormat("gemini", dec)
		status := "invalid"
		if cfg.GeminiIsValid {
			status = "connected"
		}
		results["gemini"] = KeyInspectionResult{
			Provider:         "gemini",
			HasKey:           true,
			Last4:            cfg.GeminiKeyLast4,
			IsValidFormat:    validFmt,
			ConnectionStatus: status,
		}
	} else {
		results["gemini"] = KeyInspectionResult{Provider: "gemini", HasKey: false, ConnectionStatus: "unconfigured"}
	}

	// Groq
	if cfg.EncryptedGroqKey != "" {
		dec, err := utils.DecryptWithSalt(cfg.EncryptedGroqKey, targetUserID)
		validFmt := err == nil && ValidateKeyFormat("groq", dec)
		status := "invalid"
		if cfg.GroqIsValid {
			status = "connected"
		}
		results["groq"] = KeyInspectionResult{
			Provider:         "groq",
			HasKey:           true,
			Last4:            cfg.GroqKeyLast4,
			IsValidFormat:    validFmt,
			ConnectionStatus: status,
		}
	} else {
		results["groq"] = KeyInspectionResult{Provider: "groq", HasKey: false, ConnectionStatus: "unconfigured"}
	}

	// OpenRouter
	if cfg.EncryptedORKey != "" {
		dec, err := utils.DecryptWithSalt(cfg.EncryptedORKey, targetUserID)
		validFmt := err == nil && ValidateKeyFormat("openrouter", dec)
		status := "invalid"
		if cfg.ORIsValid {
			status = "connected"
		}
		results["openrouter"] = KeyInspectionResult{
			Provider:         "openrouter",
			HasKey:           true,
			Last4:            cfg.ORKeyLast4,
			IsValidFormat:    validFmt,
			ConnectionStatus: status,
		}
	} else {
		results["openrouter"] = KeyInspectionResult{Provider: "openrouter", HasKey: false, ConnectionStatus: "unconfigured"}
	}

	return results, nil
}

// RevealUserAPIKey decrypts and reveals raw API key to admin, logging audit trail
func RevealUserAPIKey(adminID string, targetUserID string, provider string, reason string, ipAddress string) (string, error) {
	if len(reason) < 10 {
		return "", errors.New("Alasan inspeksi wajib diisi minimal 10 karakter untuk akuntabilitas audit")
	}

	adminUUID, err := uuid.Parse(adminID)
	if err != nil {
		return "", errors.New("ID Admin tidak valid")
	}

	targetUUID, err := uuid.Parse(targetUserID)
	if err != nil {
		return "", errors.New("ID Target User tidak valid")
	}

	var cfg models.UserAIConfig
	if err := config.DB.Where("user_id = ?", targetUUID).First(&cfg).Error; err != nil {
		return "", errors.New("Konfigurasi AI pengguna tidak ditemukan")
	}

	var encryptedKey string
	switch provider {
	case "gemini":
		encryptedKey = cfg.EncryptedGeminiKey
	case "groq":
		encryptedKey = cfg.EncryptedGroqKey
	case "openrouter":
		encryptedKey = cfg.EncryptedORKey
	default:
		return "", errors.New("Provider API Key tidak valid")
	}

	if encryptedKey == "" {
		return "", errors.New("Pengguna tidak memiliki API Key terdaftar untuk provider ini")
	}

	decryptedKey, err := utils.DecryptWithSalt(encryptedKey, targetUserID)
	if err != nil || decryptedKey == "" {
		return "", errors.New("Gagal mendeskripsi API key pengguna")
	}

	// Write immutable audit log
	auditLog := models.AdminAuditLog{
		AdminID:      adminUUID,
		TargetUserID: targetUUID,
		Action:       fmt.Sprintf("REVEAL_API_KEY_%s", provider),
		Reason:       reason,
		BeforeState:  "ENCRYPTED_KEY_MASKED",
		AfterState:   fmt.Sprintf("KEY_REVEALED_LAST4_%s", decryptedKey[len(decryptedKey)-4:]),
		IPAddress:    ipAddress,
	}
	_ = config.DB.Create(&auditLog)

	return decryptedKey, nil
}
