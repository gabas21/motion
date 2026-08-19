package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/logger"
	"github.com/motion/backend/pkg/utils"
	"github.com/motion/backend/services"
)

type UpgradeRequest struct {
	Plan string `json:"plan" validate:"required,oneof=free pro"`
}

// GetSubscriptionStatus returns current subscription status and active/pending transactions
// GET /api/v1/subscription/status
func GetSubscriptionStatus(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "Pengguna tidak ditemukan")
	}

	isExpired := user.SubscriptionExpiresAt != nil && user.SubscriptionExpiresAt.Before(time.Now())

	quota := map[string]interface{}{
		"max_tasks":                5,
		"max_ai_requests_per_day":  10,
		"max_calendar_connections": 1,
	}

	if user.Plan == "pro" && !isExpired {
		quota = map[string]interface{}{
			"max_tasks":                -1,
			"max_ai_requests_per_day":  -1,
			"max_calendar_connections": 5,
		}
	}

	// Cari apakah ada pembayaran yang sedang pending (menunggu scan QRIS)
	var pendingSub models.Subscription
	hasPending := false
	if err := config.DB.Where("user_id = ? AND status = 'pending'", userID).Order("created_at DESC").First(&pendingSub).Error; err == nil {
		hasPending = true
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"plan":                    user.Plan,
		"subscription_expires_at": user.SubscriptionExpiresAt,
		"is_expired":              isExpired,
		"quota":                   quota,
		"has_pending_payment":     hasPending,
		"pending_payment":         pendingSub,
	})
}

// UpgradeSubscription upgrades user plan by creating a Midtrans Snap & QRIS transaction
// POST /api/v1/subscription/upgrade
func UpgradeSubscription(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	req := new(UpgradeRequest)
	if err := c.Bind(req); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Permintaan tidak valid")
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "Pengguna tidak ditemukan")
	}

	// Tentukan nominal paket Pro (Rp 30.000)
	var amount int64 = 30000

	if req.Plan != "pro" {
		return utils.JSONError(c, http.StatusBadRequest, "Tujuan plan tidak didukung untuk upgrade manual")
	}

	// Idempotency Guard: Cek apakah user sudah memiliki pembayaran yang sedang pending
	var existingPending models.Subscription
	if err := config.DB.Where("user_id = ? AND status = 'pending'", userID).Order("created_at DESC").First(&existingPending).Error; err == nil {
		return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
			"message":      "Anda sudah memiliki pembayaran yang sedang diproses. Silakan selesaikan pembayaran terlebih dahulu.",
			"plan":         existingPending.Plan,
			"order_id":     existingPending.OrderID,
			"checkout_url": existingPending.CheckoutURL,
			"qr_string":    existingPending.QrString,
			"qr_url":       existingPending.QrURL,
			"amount":       existingPending.Amount,
			"existing":     true,
		})
	}

	// Buat Order ID unik untuk invoice Midtrans
	orderID := fmt.Sprintf("INV-%s-%d", userID.String()[:8], time.Now().Unix())

	// Panggil Midtrans API untuk generate Snap Token & QRIS
	snapData, err := services.InstanceMidtransService.CreateSnapTransaction(orderID, amount, user.Name, user.Email)
	if err != nil {
		logger.Error("UpgradeSubscription: Gagal memproses ke Midtrans", err, "userId", userID)
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal menghubungi Midtrans: "+err.Error())
	}

	qrisData, _ := services.InstanceMidtransService.CreateQRISCoreTransaction(orderID, amount, user.Name, user.Email)

	qrString := ""
	qrURL := ""
	if qrisData != nil {
		qrString = qrisData.QrString
		qrURL = qrisData.QrURL
	}

	// Buat record subscription status 'pending'
	subHistory := models.Subscription{
		UserID:         userID,
		Plan:           req.Plan,
		Status:         "pending",
		Amount:         float64(amount),
		PaymentGateway: "midtrans",
		OrderID:        orderID,
		TransactionID:  "", // dikosongkan — diisi setelah webhook settlement diterima
		CheckoutURL:    snapData.RedirectURL,
		QrString:       qrString,
		QrURL:          qrURL,
	}

	if err := config.DB.Create(&subHistory).Error; err != nil {
		logger.Error("UpgradeSubscription: Gagal menyimpan data transaksi", err, "userId", userID)
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mencatat transaksi pembayaran")
	}

	// Audit Log
	utils.LogAuditEvent(userID.String(), "CREATE_PAYMENT", "subscription", map[string]interface{}{
		"plan":       req.Plan,
		"order_id":   orderID,
		"snap_token": snapData.Token,
		"amount":     amount,
	})

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"message":         "Silakan lakukan pembayaran melalui Midtrans Snap atau QRIS yang disediakan",
		"plan":            req.Plan,
		"order_id":        orderID,
		"snap_token":      snapData.Token,
		"snap_url":        snapData.RedirectURL,
		"checkout_url":    snapData.RedirectURL,
		"qr_string":       qrString,
		"qr_url":          qrURL,
		"client_key":      config.AppConfig.MidtransClientKey,
		"amount":          amount,
	})
}
