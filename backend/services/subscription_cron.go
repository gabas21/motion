package services

import (
	"log"
	"time"

	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/logger"
)

// StartSubscriptionExpiryWorker menjalankan cron background worker yang:
// 1. Men-downgrade akun Pro yang subscription_expires_at-nya sudah lewat
// 2. Mengubah status invoice pending yang sudah > 24 jam menjadi 'expired'
func StartSubscriptionExpiryWorker() {
	go func() {
		ticker := time.NewTicker(1 * time.Hour) // Berjalan setiap 1 jam
		defer ticker.Stop()

		log.Println("[SubscriptionCron] Background worker expiry langganan diaktifkan.")

		// Jalankan pemindaian pertama saat startup
		runExpiryCheck()

		for range ticker.C {
			runExpiryCheck()
		}
	}()
}

func runExpiryCheck() {
	now := time.Now()

	// 1. Downgrade akun Pro yang sudah melewati tanggal kedaluwarsa
	resPro := config.DB.Model(&models.User{}).
		Where("plan = 'pro' AND subscription_expires_at IS NOT NULL AND subscription_expires_at < ?", now).
		Updates(map[string]interface{}{
			"plan": "free",
		})
	if resPro.Error != nil {
		logger.Error("[SubscriptionCron] Gagal melakukan auto-downgrade akun Pro", resPro.Error)
	} else if resPro.RowsAffected > 0 {
		log.Printf("[SubscriptionCron] %d pengguna Pro otomatis di-downgrade ke Free (langganan expired).", resPro.RowsAffected)
	}

	// 2. Expire invoice pending yang berusia lebih dari 24 jam
	cutoff24h := now.Add(-24 * time.Hour)
	resSub := config.DB.Model(&models.Subscription{}).
		Where("status = 'pending' AND created_at < ?", cutoff24h).
		Updates(map[string]interface{}{
			"status":        "expired",
			"failed_reason": "Invoice kadaluwarsa — tidak ada konfirmasi pembayaran dalam 24 jam",
			"cancelled_at":  now,
		})
	if resSub.Error != nil {
		logger.Error("[SubscriptionCron] Gagal meng-expire invoice pending tua", resSub.Error)
	} else if resSub.RowsAffected > 0 {
		log.Printf("[SubscriptionCron] %d invoice pending otomatis di-set ke expired (>24 jam).", resSub.RowsAffected)
	}
}
