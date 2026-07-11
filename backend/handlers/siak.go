package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
	"github.com/motion/backend/services"
	"gorm.io/gorm"
)

// ConnectSiak menghubungkan NIM + Password SIAK, melakukan scraping awal dan menyimpannya ke cache
func ConnectSiak(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]any{"success": false, "message": "Unauthorized"})
	}

	var req struct {
		NIM      string `json:"nim"`
		Password string `json:"password"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{"success": false, "message": "Format data tidak valid"})
	}

	if req.NIM == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, map[string]any{"success": false, "message": "NIM dan password wajib diisi"})
	}

	// 1. Uji autentikasi dan scraping data ke SIAK secara langsung
	session, err := services.SiakLogin(req.NIM, req.Password)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{"success": false, "message": err.Error()})
	}

	grades, summary, err := session.FetchGrades()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal memproses halaman nilai SIAK: " + err.Error()})
	}

	// 2. Enkripsi password menggunakan helper AES-256
	encryptedPassword, err := utils.EncryptPassword(req.Password)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal mengenkripsi kredensial"})
	}

	// 3. Simpan atau update akun SIAK di database
	now := time.Now()
	var account models.SiakAccount
	err = config.DB.Where("user_id = ?", userID.String()).First(&account).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		account = models.SiakAccount{
			UserID:            userID.String(),
			NIM:               req.NIM,
			PasswordEncrypted: encryptedPassword,
			LastSyncAt:        &now,
		}
		if err := config.DB.Create(&account).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal menyimpan akun SIAK"})
		}
	} else if err == nil {
		account.NIM = req.NIM
		account.PasswordEncrypted = encryptedPassword
		account.LastSyncAt = &now
		if err := config.DB.Save(&account).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal memperbarui akun SIAK"})
		}
	} else {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Database error"})
	}

	// 4. Update data nilai cache di database
	if err := saveGradesCache(userID.String(), grades); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal menyimpan data nilai"})
	}

	// Catat audit log event
	utils.LogAuditEvent(userID.String(), "CONNECT_SIAK", "siak_account", map[string]any{"nim": req.NIM})

	return c.JSON(http.StatusOK, map[string]any{
		"success": true,
		"message": "Berhasil terhubung ke SIAK!",
		"data": map[string]any{
			"summary": summary,
			"grades":  grades,
		},
	})
}

// GetSiakGrades mengambil cache nilai terdaftar dari database
func GetSiakGrades(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]any{"success": false, "message": "Unauthorized"})
	}

	// Cek apakah akun terhubung
	var account models.SiakAccount
	err := config.DB.Where("user_id = ?", userID.String()).First(&account).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return c.JSON(http.StatusOK, map[string]any{
			"success": true,
			"data": map[string]any{
				"isConnected": false,
				"summary":     nil,
				"grades":      []models.SiakGrade{},
			},
		})
	} else if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Database error"})
	}

	// Ambil cache nilai
	var grades []models.SiakGrade
	if err := config.DB.Where("user_id = ?", userID.String()).Order("semester DESC, kode_matkul ASC").Find(&grades).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal mengambil data nilai"})
	}

	// Hitung akumulasi summary
	totalSKS := 0
	totalMutu := 0.0
	for _, g := range grades {
		totalSKS += g.SKS
		totalMutu += g.Mutu
	}
	ipk := 0.0
	if totalSKS > 0 {
		ipk = totalMutu / float64(totalSKS)
	}

	summary := models.SiakSummary{
		NIM:        account.NIM,
		IPK:        ipk,
		TotalSKS:   totalSKS,
		TotalMutu:  totalMutu,
		LastSyncAt: account.LastSyncAt,
	}

	return c.JSON(http.StatusOK, map[string]any{
		"success": true,
		"data": map[string]any{
			"isConnected": true,
			"summary":     summary,
			"grades":      grades,
		},
	})
}

// SyncSiakGrades memaksa sinkronisasi ulang data dengan scraping dari SIAK
func SyncSiakGrades(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]any{"success": false, "message": "Unauthorized"})
	}

	// Cek apakah akun terhubung
	var account models.SiakAccount
	err := config.DB.Where("user_id = ?", userID.String()).First(&account).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return c.JSON(http.StatusBadRequest, map[string]any{"success": false, "message": "Akun SIAK belum dihubungkan"})
	} else if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Database error"})
	}

	// Dekripsi password
	password, err := utils.DecryptPassword(account.PasswordEncrypted)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal mendekripsi kredensial"})
	}

	// Scraping ulang ke SIAK
	session, err := services.SiakLogin(account.NIM, password)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{"success": false, "message": "Gagal masuk ke SIAK: " + err.Error()})
	}

	grades, summary, err := session.FetchGrades()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal memproses halaman nilai SIAK: " + err.Error()})
	}

	// Update LastSyncAt
	now := time.Now()
	account.LastSyncAt = &now
	config.DB.Save(&account)

	// Update data nilai cache
	if err := saveGradesCache(userID.String(), grades); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal memperbarui data nilai"})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"success": true,
		"message": "Sinkronisasi berhasil!",
		"data": map[string]any{
			"summary": summary,
			"grades":  grades,
		},
	})
}

// DisconnectSiak menghapus akun SIAK dan semua nilai dari database
func DisconnectSiak(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]any{"success": false, "message": "Unauthorized"})
	}

	// Hapus akun SIAK
	if err := config.DB.Where("user_id = ?", userID.String()).Delete(&models.SiakAccount{}).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal memutuskan hubungan akun SIAK"})
	}

	// Hapus nilai cache
	if err := config.DB.Where("user_id = ?", userID.String()).Delete(&models.SiakGrade{}).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal menghapus cache nilai"})
	}

	utils.LogAuditEvent(userID.String(), "DISCONNECT_SIAK", "siak_account", nil)

	return c.JSON(http.StatusOK, map[string]any{
		"success": true,
		"message": "Berhasil memutuskan koneksi SIAK dan menghapus semua data cache.",
	})
}

// Helper untuk membersihkan dan menyimpan ulang data nilai baru ke database
func saveGradesCache(userID string, grades []models.SiakGrade) error {
	// Jalankan transaksi DB agar aman
	return config.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Hapus nilai cache lama
		if err := tx.Where("user_id = ?", userID).Delete(&models.SiakGrade{}).Error; err != nil {
			return err
		}

		// 2. Insert nilai cache baru
		if len(grades) > 0 {
			for i := range grades {
				grades[i].UserID = userID
			}
			if err := tx.Create(&grades).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
