package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/services"
	"github.com/motion/backend/pkg/logger"
	"github.com/motion/backend/pkg/utils"
)

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	User  models.User `json:"user"`
	Token string      `json:"token"`
}

type RequestPasswordResetRequest struct {
	Email string `json:"email" validate:"required,email"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token" validate:"required"`
	NewPassword string `json:"new_password" validate:"required"`
}

// normalizeEmail memastikan email konsisten: lowercase dan tanpa spasi berlebih
func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// Register handles user registration
func Register(c echo.Context) error {
	req := new(RegisterRequest)
	if err := c.Bind(req); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Invalid request body")
	}

	// Normalisasi input sebelum diproses
	req.Email = normalizeEmail(req.Email)
	req.Name = strings.TrimSpace(req.Name)

	// Validasi — cek setelah normalisasi agar tidak ada spasi palsu
	if req.Email == "" || strings.TrimSpace(req.Password) == "" || req.Name == "" {
		return utils.JSONError(c, http.StatusBadRequest, "Email, password, and name are required")
	}

	// Validate password complexity
	if err := utils.DefaultPasswordValidator.Validate(req.Password); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, err.Error())
	}

	// Cek apakah email sudah terdaftar
	var existingUser models.User
	if err := config.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		return utils.JSONError(c, http.StatusConflict, "Email already registered")
	}

	// Buat user baru
	user := models.User{
		Email:         req.Email,
		Name:          req.Name,
		EmailVerified: false,
	}

	if err := user.HashPassword(req.Password); err != nil {
		logger.Error("Register: Gagal hash password untuk email", err, "email", req.Email)
		return utils.JSONError(c, http.StatusInternalServerError, "Failed to process password")
	}

	if err := config.DB.Create(&user).Error; err != nil {
		logger.Error("Register: Gagal simpan user ke DB", err, "email", req.Email)
		return utils.JSONError(c, http.StatusInternalServerError, "Failed to create user")
	}

	logger.Info("Register: User baru berhasil dibuat", "email", user.Email, "userId", user.ID)

	// Generate verification token
	token := generateRandomToken()
	hashedToken := hashToken(token)
	expiresAt := time.Now().Add(24 * time.Hour)
	config.DB.Model(&user).Updates(map[string]interface{}{
		"email_verify_token":   hashedToken,
		"email_verify_expires": expiresAt,
	})

	// Send verification email
	go func() {
		if err := services.SendVerificationEmail(user.Email, user.Name, token); err != nil {
			config.DB.Model(&user).Update("email_send_failed", true)
			logger.Error("Register: Gagal mengirim email verifikasi", err, "email", user.Email)
		}
	}()

	return utils.JSONSuccess(c, http.StatusCreated, map[string]interface{}{
		"message": "Akun berhasil dibuat. Silakan periksa email kamu untuk melakukan verifikasi sebelum masuk.",
		"user":    user,
	})
}

// Login handles user login
func Login(c echo.Context) error {
	req := new(LoginRequest)
	if err := c.Bind(req); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Invalid request body")
	}

	// Normalisasi email — PENTING: email harus case-insensitive
	req.Email = normalizeEmail(req.Email)

	if req.Email == "" || req.Password == "" {
		return utils.JSONError(c, http.StatusBadRequest, "Email and password are required")
	}

	// Cari user — gunakan Select eksplisit agar kolom password_hash SELALU diambil dari DB, termasuk security fields baru
	var user models.User
	if err := config.DB.
		Select("id, email, password_hash, name, timezone, plan, role, failed_login_attempts, locked_until, last_login_at, require_password_change, email_verified, created_at, updated_at, deleted_at").
		Where("email = ?", req.Email).
		First(&user).Error; err != nil {
		logger.Warn("Login: User tidak ditemukan di DB", "email", req.Email, "error", err)
		utils.LogAuditEvent("", "LOGIN_FAILED", "auth", map[string]interface{}{
			"email":  req.Email,
			"reason": "user_not_found",
		})
		return utils.JSONError(c, http.StatusUnauthorized, "Email atau kata sandi tidak valid")
	}

	// Check if account is locked
	if user.IsLocked() {
		utils.LogAuditEvent(user.ID.String(), "LOGIN_FAILED", "auth", map[string]interface{}{
			"reason": "account_locked",
		})
		if user.IsSuspended() {
			return utils.JSONError(c, http.StatusForbidden, "Akun Anda telah dinonaktifkan oleh administrator.")
		}
		return utils.JSONError(c, http.StatusForbidden, 
			fmt.Sprintf("Akun terkunci. Coba lagi pada %s", user.LockedUntil.Format("15:04")))
	}

	// Check if email is verified
	if !user.EmailVerified {
		return c.JSON(http.StatusForbidden, map[string]interface{}{
			"error":   "email_unverified",
			"message": "Silakan verifikasi email Anda terlebih dahulu.",
		})
	}

	// Cek password_hash tidak kosong (deteksi bug penyimpanan data)
	if user.PasswordHash == "" {
		logger.Error("Login: KRITIS — password_hash kosong", fmt.Errorf("empty password hash"), "email", req.Email, "userId", user.ID)
		return utils.JSONError(c, http.StatusInternalServerError, "Data akun bermasalah, silakan daftar ulang")
	}

	// Verifikasi password dengan bcrypt
	if !user.CheckPassword(req.Password) {
		user.IncrementFailedLogin()
		config.DB.Save(&user)

		logger.Warn("Login: Password tidak cocok", "email", req.Email, "userId", user.ID)
		utils.LogAuditEvent(user.ID.String(), "LOGIN_FAILED", "auth", map[string]interface{}{
			"reason":   "invalid_password",
			"attempts": user.FailedLoginAttempts,
		})
		return utils.JSONError(c, http.StatusUnauthorized, "Email atau kata sandi tidak valid")
	}

	// Success: reset failed attempts and update last login
	user.ResetFailedLogin()
	now := time.Now()
	user.LastLoginAt = &now
	config.DB.Save(&user)

	logger.Info("Login: Berhasil", "email", user.Email, "userId", user.ID)

	// Generate Token Pair
	tokenPair, err := utils.GenerateTokenPair(user.ID, user.Email, user.Role, config.AppConfig.JWTSecret)
	if err != nil {
		logger.Error("Login: Token generation failed", err)
		return utils.JSONError(c, http.StatusInternalServerError, "Authentication failed")
	}

	// Set HTTP-only Cookies
	setAuthCookies(c, tokenPair)

	utils.LogAuditEvent(user.ID.String(), "LOGIN_SUCCESS", "auth", map[string]interface{}{
		"ip": c.RealIP(),
	})

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"user":         user,
		"access_token": tokenPair.AccessToken,
		"expires_in":   tokenPair.ExpiresIn,
		"token_type":   tokenPair.TokenType,
	})
}

// GetMe retrieves current user profile from context
func GetMe(c echo.Context) error {
	userIdVal := c.Get("userId")
	if userIdVal == nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userIdVal).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "User not found")
	}

	return utils.JSONSuccess(c, http.StatusOK, user)
}

// Logout handles user logout and clears the session cookies
func Logout(c echo.Context) error {
	accessCookie := new(http.Cookie)
	accessCookie.Name = "motion_token"
	accessCookie.Value = ""
	accessCookie.Path = "/"
	accessCookie.HttpOnly = true
	accessCookie.MaxAge = -1
	accessCookie.Expires = time.Now().Add(-1 * time.Hour)
	c.SetCookie(accessCookie)

	refreshCookie := new(http.Cookie)
	refreshCookie.Name = "refresh_token"
	refreshCookie.Value = ""
	refreshCookie.Path = "/"
	refreshCookie.HttpOnly = true
	refreshCookie.MaxAge = -1
	refreshCookie.Expires = time.Now().Add(-1 * time.Hour)
	c.SetCookie(refreshCookie)

	return utils.JSONSuccess(c, http.StatusOK, map[string]string{
		"message": "Sesi login berhasil dihapus",
	})
}

// setAuthCookies menulis access token dan refresh token ke HTTP-only cookie browser secara aman
func setAuthCookies(c echo.Context, tokenPair *utils.TokenPair) {
	// Access Token Cookie
	accessCookie := new(http.Cookie)
	accessCookie.Name = "motion_token"
	accessCookie.Value = tokenPair.AccessToken
	accessCookie.Path = "/"
	accessCookie.HttpOnly = true
	accessCookie.SameSite = http.SameSiteLaxMode
	if config.AppConfig != nil && config.AppConfig.ServerEnv == "production" {
		accessCookie.Secure = true
	}
	accessCookie.Expires = time.Now().Add(time.Duration(tokenPair.ExpiresIn) * time.Second)
	c.SetCookie(accessCookie)

	// Refresh Token Cookie
	refreshCookie := new(http.Cookie)
	refreshCookie.Name = "refresh_token"
	refreshCookie.Value = tokenPair.RefreshToken
	refreshCookie.Path = "/"
	refreshCookie.HttpOnly = true
	refreshCookie.SameSite = http.SameSiteLaxMode
	if config.AppConfig != nil && config.AppConfig.ServerEnv == "production" {
		refreshCookie.Secure = true
	}
	refreshCookie.Expires = time.Now().Add(7 * 24 * time.Hour)
	c.SetCookie(refreshCookie)
}

// RefreshToken handles access token rotation using refresh_token cookie
func RefreshToken(c echo.Context) error {
	cookie, err := c.Cookie("refresh_token")
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Refresh token tidak ditemukan")
	}

	tokenPair, err := utils.RefreshAccessToken(cookie.Value, config.AppConfig.JWTSecret)
	if err != nil {
		logger.Error("RefreshToken: Token refresh failed", err)
		return utils.JSONError(c, http.StatusUnauthorized, "Sesi tidak valid, silakan login kembali")
	}

	setAuthCookies(c, tokenPair)

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"access_token": tokenPair.AccessToken,
		"expires_in":   tokenPair.ExpiresIn,
		"token_type":   tokenPair.TokenType,
	})
}

// GenerateTelegramOTP membuat kode OTP 6-Digit baru untuk sinkronisasi Telegram
func GenerateTelegramOTP(c echo.Context) error {
	userIdVal := c.Get("userId")
	userId, ok := userIdVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	// Buat 6-digit secure random OTP
	b := make([]byte, 3)
	_, err := rand.Read(b)
	var otpCode string
	if err != nil {
		// Fallback jika crypto/rand gagal
		otpCode = fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
	} else {
		val := (int(b[0]) << 16) | (int(b[1]) << 8) | int(b[2])
		otpCode = fmt.Sprintf("%06d", val%1000000)
	}

	// Simpan ke DB dengan waktu kedaluwarsa 10 menit
	var user models.User
	if err := config.DB.First(&user, "id = ?", userId).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "User tidak ditemukan")
	}

	otpExp := time.Now().Add(10 * time.Minute)
	user.TelegramOTP = otpCode
	user.TelegramOTPExp = &otpExp

	if err := config.DB.Save(&user).Error; err != nil {
		logger.Error("GenerateTelegramOTP: Gagal menyimpan OTP ke DB", err, "userId", userId)
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal membuat kode OTP")
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"otp":       otpCode,
		"expiresAt": otpExp,
	})
}

// GetTelegramStatus mengembalikan status sinkronisasi Telegram pengguna saat ini
func GetTelegramStatus(c echo.Context) error {
	userIdVal := c.Get("userId")
	userId, ok := userIdVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userId).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "User tidak ditemukan")
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"isTelegramLinked": user.TelegramChatID != "",
		"telegramChatId":   user.TelegramChatID,
	})
}

// UnlinkTelegram menghapus sinkronisasi Telegram Chat ID milik pengguna
func UnlinkTelegram(c echo.Context) error {
	userIdVal := c.Get("userId")
	userId, ok := userIdVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userId).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "User tidak ditemukan")
	}

	// Kosongkan detail telegram
	user.TelegramChatID = ""
	user.TelegramOTP = ""
	user.TelegramOTPExp = nil

	if err := config.DB.Save(&user).Error; err != nil {
		logger.Error("UnlinkTelegram: Gagal menghapus relasi Telegram di DB", err, "userId", userId)
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal memutuskan hubungan Telegram")
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]string{
		"message": "Akun Telegram berhasil diputuskan",
	})
}

// UpdateMeRequest represents the payload to update user profile
type UpdateMeRequest struct {
	Name            string `json:"name"`
	Timezone        string `json:"timezone"`
	Plan            string `json:"plan"`
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// UpdateMe updates current user's profile
func UpdateMe(c echo.Context) error {
	userIdVal := c.Get("userId")
	userId, ok := userIdVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	req := new(UpdateMeRequest)
	if err := c.Bind(req); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Invalid request body")
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userId).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "User tidak ditemukan")
	}

	// Update fields if provided
	if strings.TrimSpace(req.Name) != "" {
		user.Name = strings.TrimSpace(req.Name)
	}
	if strings.TrimSpace(req.Timezone) != "" {
		user.Timezone = strings.TrimSpace(req.Timezone)
	}

	// If password change is requested
	if req.NewPassword != "" {
		if req.CurrentPassword == "" {
			return utils.JSONError(c, http.StatusBadRequest, "Kata sandi saat ini diperlukan untuk mengubah kata sandi")
		}
		// Load user again explicitly selecting password_hash (just like in Login)
		var userWithPass models.User
		if err := config.DB.Select("id, password_hash").First(&userWithPass, "id = ?", userId).Error; err != nil {
			return utils.JSONError(c, http.StatusInternalServerError, "Gagal memverifikasi pengguna")
		}
		if !userWithPass.CheckPassword(req.CurrentPassword) {
			return utils.JSONError(c, http.StatusUnauthorized, "Kata sandi saat ini salah")
		}
		// Validate password complexity
		if err := utils.DefaultPasswordValidator.Validate(req.NewPassword); err != nil {
			return utils.JSONError(c, http.StatusBadRequest, err.Error())
		}
		if err := user.HashPassword(req.NewPassword); err != nil {
			return utils.JSONError(c, http.StatusInternalServerError, "Gagal memproses kata sandi baru")
		}
	}

	if err := config.DB.Save(&user).Error; err != nil {
		logger.Error("UpdateMe: Gagal memperbarui user di DB", err, "userId", userId)
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal memperbarui profil pengguna")
	}

	return utils.JSONSuccess(c, http.StatusOK, user)
}

// GetUserQuota returns the current user's task and chat quotas
func GetUserQuota(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "User not found")
	}

	// Calculate tasks created this month (excluding education_reminder)
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	var taskCount int64
	config.DB.Model(&models.Task{}).
		Where("user_id = ? AND created_at >= ? AND category != 'education_reminder'", userID, startOfMonth).
		Count(&taskCount)

	// Get chat usage for today
	today := now.Format("2006-01-02")
	var usage models.UserUsage
	var dailyChatCount int
	if err := config.DB.Where("user_id = ?", userID).First(&usage).Error; err == nil {
		if usage.LastChatDate == today {
			dailyChatCount = usage.DailyChatCount
		}
	}

	// Quota limits
	taskLimit := 5
	chatLimit := 10
	if user.Plan == "pro" {
		taskLimit = -1
		chatLimit = -1
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"plan": user.Plan,
		"taskQuota": map[string]interface{}{
			"used":  taskCount,
			"limit": taskLimit,
		},
		"chatQuota": map[string]interface{}{
			"used":  dailyChatCount,
			"limit": chatLimit,
		},
	})
}

// RequestEmailVerificationRequest is the request body for resending verification email
type RequestEmailVerificationRequest struct {
	Email string `json:"email" validate:"required,email"`
}

// RequestEmailVerification sends/resends verification email
// POST /api/v1/auth/verify-email/request
func RequestEmailVerification(c echo.Context) error {
	req := new(RequestEmailVerificationRequest)
	if err := c.Bind(req); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Permintaan tidak valid")
	}

	req.Email = normalizeEmail(req.Email)

	var user models.User
	if err := config.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		// Don't reveal if user exists for security
		return utils.JSONSuccess(c, http.StatusOK, map[string]string{
			"message": "Jika email terdaftar, link verifikasi baru telah dikirim.",
		})
	}

	if user.EmailVerified {
		return utils.JSONError(c, http.StatusBadRequest, "Email sudah terverifikasi")
	}

	// Generate token (random 32 bytes hex = 64 chars)
	token := generateRandomToken()
	hashedToken := hashToken(token)
	expiresAt := time.Now().Add(24 * time.Hour)

	// Update user
	config.DB.Model(&user).Updates(map[string]interface{}{
		"email_verify_token":   hashedToken,
		"email_verify_expires": expiresAt,
		"email_send_failed":    false,
	})

	// Send email
	go func() {
		if err := services.SendVerificationEmail(user.Email, user.Name, token); err != nil {
			config.DB.Model(&user).Update("email_send_failed", true)
			logger.Error("RequestEmailVerification: Gagal mengirim email verifikasi", err, "email", user.Email)
		}
	}()

	return utils.JSONSuccess(c, http.StatusOK, map[string]string{
		"message": "Email verifikasi baru telah dikirim. Silakan periksa kotak masuk Anda.",
	})
}

// VerifyEmail verifies user email with token
// GET /api/v1/auth/verify-email?token=xxx
func VerifyEmail(c echo.Context) error {
	token := c.QueryParam("token")

	if token == "" {
		return utils.JSONError(c, http.StatusBadRequest, "Token diperlukan")
	}

	var user models.User

	// Find user by token
	hashedToken := hashToken(token)
	if err := config.DB.Where("email_verify_token = ?", hashedToken).First(&user).Error; err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Token tidak valid atau kedaluwarsa")
	}

	// Check if expired
	if user.EmailVerifyExpires == nil || user.EmailVerifyExpires.Before(time.Now()) {
		return utils.JSONError(c, http.StatusBadRequest, "Token verifikasi telah kedaluwarsa")
	}

	// Mark as verified
	now := time.Now()
	config.DB.Model(&user).Updates(map[string]interface{}{
		"email_verified":        true,
		"email_verified_at":     &now,
		"email_verify_token":    "",
		"email_verify_expires":  nil,
		"email_send_failed":     false,
	})

	utils.LogAuditEvent(user.ID.String(), "EMAIL_VERIFIED", "auth", nil)

	return utils.JSONSuccess(c, http.StatusOK, map[string]string{
		"message": "Email berhasil diverifikasi!",
	})
}

// RequestPasswordReset sends password reset email
// POST /api/v1/auth/request-password-reset
func RequestPasswordReset(c echo.Context) error {
	req := new(RequestPasswordResetRequest)
	if err := c.Bind(req); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Permintaan tidak valid")
	}

	req.Email = normalizeEmail(req.Email)

	var user models.User
	if err := config.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		// Don't reveal if email exists (security best practice)
		return utils.JSONSuccess(c, http.StatusOK, map[string]string{
			"message": "Instruksi reset password telah dikirim ke email jika alamat tersebut terdaftar.",
		})
	}

	// Generate token (valid 1 hour)
	token := generateRandomToken()
	hashedToken := hashToken(token)
	expiresAt := time.Now().Add(1 * time.Hour)

	config.DB.Model(&user).Updates(map[string]interface{}{
		"reset_token":         hashedToken,
		"reset_token_expires": expiresAt,
	})

	// Send email
	go func() {
		if err := services.SendPasswordResetEmail(user.Email, user.Name, token); err != nil {
			logger.Error("RequestPasswordReset: Gagal mengirim email reset password", err, "email", user.Email)
		}
	}()

	utils.LogAuditEvent(user.ID.String(), "PASSWORD_RESET_REQUESTED", "auth", nil)

	return utils.JSONSuccess(c, http.StatusOK, map[string]string{
		"message": "Instruksi reset password telah dikirim ke email jika alamat tersebut terdaftar.",
	})
}

// ResetPassword resets password with token
// POST /api/v1/auth/reset-password
func ResetPassword(c echo.Context) error {
	req := new(ResetPasswordRequest)
	if err := c.Bind(req); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Permintaan tidak valid")
	}

	// Validate password
	if err := utils.DefaultPasswordValidator.Validate(req.NewPassword); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, err.Error())
	}

	var user models.User

	// Find user by token
	hashedToken := hashToken(req.Token)
	if err := config.DB.Where("reset_token = ?", hashedToken).First(&user).Error; err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Token tidak valid atau kedaluwarsa")
	}

	// Check if expired
	if user.ResetTokenExpires == nil || user.ResetTokenExpires.Before(time.Now()) {
		return utils.JSONError(c, http.StatusBadRequest, "Token reset password telah kedaluwarsa")
	}

	// Hash new password
	if err := user.HashPassword(req.NewPassword); err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mereset password")
	}

	// Clear reset token and update password hash
	config.DB.Model(&user).Updates(map[string]interface{}{
		"password_hash":       user.PasswordHash,
		"reset_token":         "",
		"reset_token_expires": nil,
	})

	utils.LogAuditEvent(user.ID.String(), "PASSWORD_RESET", "auth", nil)

	return utils.JSONSuccess(c, http.StatusOK, map[string]string{
		"message": "Password berhasil diubah. Silakan login kembali.",
	})
}

// Helper: Generate random token
func generateRandomToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// Helper: Hash token with SHA-256
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}


