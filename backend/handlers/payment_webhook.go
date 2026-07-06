package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/logger"
	"github.com/motion/backend/pkg/utils"
	"github.com/motion/backend/services"
)

type TripayCallbackPayload struct {
	Reference      string `json:"reference"`
	MerchantRef    string `json:"merchant_ref"`
	PaymentMethod  string `json:"payment_method"`
	PaymentName    string `json:"payment_name"`
	Amount         int    `json:"amount"`
	TotalFee       int    `json:"total_fee"`
	Status         string `json:"status"` // "PAID" | "UNPAID" | "EXPIRED" | "FAILED"
	PaidAt         int64  `json:"paid_at"`
	Signature      string `json:"signature"`
}

// HandleTripayWebhook menangani notifikasi pembayaran real-time dari Tripay
// POST /api/v1/payment/webhook
func HandleTripayWebhook(c echo.Context) error {
	// Baca raw body untuk verifikasi signature HMAC
	rawBody, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Gagal membaca data request"})
	}

	// Signature di header dari Tripay
	callbackSignature := c.Request().Header.Get("X-Callback-Signature")
	if callbackSignature == "" {
		return c.JSON(http.StatusUnauthorized, map[string]interface{}{"success": false, "message": "Signature tidak ditemukan"})
	}

	// Verifikasi signature
	if !services.InstanceTripayService.VerifyWebhookSignature(rawBody, callbackSignature) {
		logger.Error("Tripay Webhook Signature Mismatch", nil, "received", callbackSignature)
		return c.JSON(http.StatusUnauthorized, map[string]interface{}{"success": false, "message": "Signature tidak valid"})
	}

	// Unmarshal payload
	var payload TripayCallbackPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Format JSON tidak valid"})
	}

	logger.Info("Menerima notifikasi pembayaran Tripay", "orderId", payload.MerchantRef, "status", payload.Status)

	// Mulai transaksi DB untuk konsistensi data
	tx := config.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Cari record Subscription berdasarkan Order ID (MerchantRef)
	var sub models.Subscription
	if err := tx.Where("order_id = ?", payload.MerchantRef).First(&sub).Error; err != nil {
		tx.Rollback()
		logger.Error("Tripay Webhook: Subscription tidak ditemukan", err, "orderId", payload.MerchantRef)
		// Return 200 agar Tripay tidak mengirim ulang webhook untuk order yang salah
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Transaksi tidak ditemukan"})
	}

	// Jika status bukan pending, abaikan (mencegah double-processing)
	if sub.Status != "pending" {
		tx.Rollback()
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Transaksi sudah diproses sebelumnya"})
	}

	// Proses status pembayaran
	if payload.Status == "PAID" {
		// Update status transaksi
		expiresAt := time.Now().AddDate(0, 1, 0) // Pro lasts 1 month
		
		subUpdates := map[string]interface{}{
			"status":     "active",
			"expires_at": expiresAt,
		}
		if err := tx.Model(&sub).Updates(subUpdates).Error; err != nil {
			tx.Rollback()
			logger.Error("Tripay Webhook: Gagal update status subscription", err, "orderId", payload.MerchantRef)
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false})
		}

		// Update User plan & expiry date
		var user models.User
		if err := tx.First(&user, "id = ?", sub.UserID).Error; err == nil {
			userUpdates := map[string]interface{}{
				"plan":                     "pro",
				"subscription_expires_at": expiresAt,
			}
			if err := tx.Model(&user).Updates(userUpdates).Error; err != nil {
				tx.Rollback()
				logger.Error("Tripay Webhook: Gagal update user plan", err, "userId", sub.UserID)
				return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false})
			}
		}

		// Commit perubahan
		if err := tx.Commit().Error; err != nil {
			logger.Error("Tripay Webhook: Gagal commit transaksi", err, "orderId", payload.MerchantRef)
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false})
		}

		// Audit Log
		utils.LogAuditEvent(sub.UserID.String(), "PAYMENT_SETTLED", "subscription", map[string]interface{}{
			"order_id":  payload.MerchantRef,
			"reference": payload.Reference,
			"amount":    payload.Amount,
			"plan":      sub.Plan,
		})

		// Kirim update real-time ke user via WebSocket
		services.WSHub.Broadcast(sub.UserID.String(), []byte(`{"type":"PLAN_UPGRADED","plan":"pro"}`))

	} else if payload.Status == "EXPIRED" || payload.Status == "FAILED" {
		// Update status menjadi expired/failed
		if err := tx.Model(&sub).Update("status", "expired").Error; err != nil {
			tx.Rollback()
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false})
		}
		tx.Commit()

		utils.LogAuditEvent(sub.UserID.String(), "PAYMENT_FAILED", "subscription", map[string]interface{}{
			"order_id":  payload.MerchantRef,
			"reference": payload.Reference,
			"status":    payload.Status,
		})
	} else {
		// Status UNPAID / pending, abaikan
		tx.Rollback()
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Webhook diproses dengan sukses",
	})
}
