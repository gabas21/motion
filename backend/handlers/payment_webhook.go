package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/logger"
	"github.com/motion/backend/pkg/utils"
	"github.com/motion/backend/services"
)

type MidtransNotificationPayload struct {
	OrderID           string `json:"order_id"`
	TransactionID     string `json:"transaction_id"`
	TransactionStatus string `json:"transaction_status"` // "settlement" | "capture" | "pending" | "deny" | "cancel" | "expire"
	FraudStatus       string `json:"fraud_status"`
	StatusCode        string `json:"status_code"`
	GrossAmount       string `json:"gross_amount"`
	SignatureKey      string `json:"signature_key"`
	PaymentType       string `json:"payment_type"`
}

type SimulatePaymentRequest struct {
	OrderID string `json:"order_id"`
}

// HandleMidtransWebhook menangani notifikasi pembayaran real-time dari Midtrans
// POST /api/v1/payment/webhook
func HandleMidtransWebhook(c echo.Context) error {
	// IP Allowlist Midtrans — hanya berlaku di production
	if config.AppConfig.ServerEnv == "production" {
		midtransIPs := []string{
			"103.208.23.", "103.179.46.",
		}
		clientIP := c.RealIP()
		allowed := false
		for _, prefix := range midtransIPs {
			if strings.HasPrefix(clientIP, prefix) {
				allowed = true
				break
			}
		}
		if !allowed {
			logger.Error("Webhook ditolak dari IP tidak dikenal", nil, "ip", clientIP)
			return c.JSON(http.StatusForbidden, map[string]interface{}{"success": false, "message": "Akses IP tidak diizinkan"})
		}
	}

	rawBody, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Gagal membaca data request"})
	}

	var payload MidtransNotificationPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Format JSON tidak valid"})
	}

	logger.Info("Menerima notifikasi pembayaran Midtrans", "orderId", payload.OrderID, "status", payload.TransactionStatus)

	// Verifikasi signature SHA-512 dari Midtrans (kecuali mode dev)
	if !services.InstanceMidtransService.VerifyWebhookSignature(payload.OrderID, payload.StatusCode, payload.GrossAmount, payload.SignatureKey) {
		logger.Error("Midtrans Webhook Signature Mismatch", nil, "orderId", payload.OrderID)
		return c.JSON(http.StatusUnauthorized, map[string]interface{}{"success": false, "message": "Signature tidak valid"})
	}

	return processPaymentSettlement(c, payload.OrderID, payload.TransactionStatus, payload.TransactionID)
}

// SimulateMidtransPayment memungkinkan developer memicu simulasi pembayaran 1-klik di lokal
// POST /api/v1/payment/simulate-midtrans-pay
func SimulateMidtransPayment(c echo.Context) error {
	// Guard: endpoint ini HANYA boleh berjalan di development/sandbox
	if config.AppConfig.ServerEnv == "production" {
		return utils.JSONError(c, http.StatusForbidden, "Endpoint simulasi pembayaran tidak tersedia di production")
	}

	req := new(SimulatePaymentRequest)
	if err := c.Bind(req); err != nil || req.OrderID == "" {
		return utils.JSONError(c, http.StatusBadRequest, "Order ID wajib diisi")
	}

	userIDVal := c.Get("userId")
	userID, _ := userIDVal.(uuid.UUID)

	logger.Info("[DEV MOCK] Memproses Simulasi Pembayaran QRIS/Midtrans", "orderId", req.OrderID, "userId", userID)
	return processPaymentSettlement(c, req.OrderID, "settlement", "DEV-SIMULATION-TRX")
}

// Helper internal untuk meng-upgrade status subscription & user plan
func processPaymentSettlement(c echo.Context, orderID string, transactionStatus string, transactionID string) error {
	tx := config.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var sub models.Subscription
	if err := tx.Where("order_id = ?", orderID).First(&sub).Error; err != nil {
		tx.Rollback()
		logger.Error("Midtrans Webhook: Subscription tidak ditemukan", err, "orderId", orderID)
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Transaksi tidak ditemukan"})
	}

	if sub.Status != "pending" {
		tx.Rollback()
		return c.JSON(http.StatusOK, map[string]interface{}{"success": true, "message": "Transaksi sudah diproses sebelumnya"})
	}

	// Midtrans dianggap LUNAS jika status == "settlement" atau ("capture" & fraudStatus == "accept")
	if transactionStatus == "settlement" || transactionStatus == "capture" {
		expiresAt := time.Now().AddDate(0, 1, 0) // Pro aktif 1 Bulan

		subUpdates := map[string]interface{}{
			"status":         "active",
			"transaction_id": transactionID,
			"expires_at":     expiresAt,
		}
		if err := tx.Model(&sub).Updates(subUpdates).Error; err != nil {
			tx.Rollback()
			logger.Error("Midtrans Webhook: Gagal update status subscription", err, "orderId", orderID)
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false})
		}

		var user models.User
		if err := tx.First(&user, "id = ?", sub.UserID).Error; err == nil {
			userUpdates := map[string]interface{}{
				"plan":                     "pro",
				"subscription_expires_at": expiresAt,
			}
			if err := tx.Model(&user).Updates(userUpdates).Error; err != nil {
				tx.Rollback()
				logger.Error("Midtrans Webhook: Gagal update user plan", err, "userId", sub.UserID)
				return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false})
			}
		}

		if err := tx.Commit().Error; err != nil {
			logger.Error("Midtrans Webhook: Gagal commit transaksi", err, "orderId", orderID)
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false})
		}

		utils.LogAuditEvent(sub.UserID.String(), "PAYMENT_SETTLED", "subscription", map[string]interface{}{
			"order_id":       orderID,
			"transaction_id": transactionID,
			"amount":         sub.Amount,
			"plan":           sub.Plan,
		})

		// Siarkan notifikasi real-time via WebSocket
		services.WSHub.Broadcast(sub.UserID.String(), []byte(`{"type":"PLAN_UPGRADED","plan":"pro"}`))

		return c.JSON(http.StatusOK, map[string]interface{}{
			"success": true,
			"message": "Pembayaran Midtrans berhasil diproses. Plan akun diupgrade ke Pro!",
			"plan":    "pro",
		})

	} else if transactionStatus == "deny" || transactionStatus == "cancel" || transactionStatus == "expire" {
		if err := tx.Model(&sub).Update("status", "expired").Error; err != nil {
			tx.Rollback()
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{"success": false})
		}
		tx.Commit()

		utils.LogAuditEvent(sub.UserID.String(), "PAYMENT_FAILED", "subscription", map[string]interface{}{
			"order_id": orderID,
			"status":   transactionStatus,
		})
	} else {
		tx.Rollback()
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Webhook diproses dengan sukses",
	})
}
