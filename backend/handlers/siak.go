package handlers

import (
	"context"
	"encoding/json"
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

	// 3. Simpan atau update akun SIAK di database (Gunakan Unscoped untuk mendeteksi soft-deleted records)
	now := time.Now()
	var account models.SiakAccount
	err = config.DB.Unscoped().Where("user_id = ?", userID.String()).First(&account).Error

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
		account.DeletedAt = gorm.DeletedAt{} // Clear soft-deleted timestamp (Restore record)
		if err := config.DB.Unscoped().Save(&account).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal memperbarui akun SIAK"})
		}
	} else {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Database error"})
	}

	// 4. Update data nilai cache di database
	if err := services.SaveGradesCache(userID.String(), grades); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal menyimpan data nilai"})
	}

	// 5. Scraping jadwal & ujian secara otomatis setelah terhubung
	go func(s *services.SiakSession, uID string) {
		schedules, err := s.FetchSchedule()
		if err == nil && len(schedules) > 0 {
			services.SaveScheduleCache(uID, schedules)
		}
		exams, err := s.FetchExams()
		if err == nil && len(exams) > 0 {
			services.SaveExamsCache(uID, exams)
		}
	}(session, userID.String())

	// Invalidate Redis cache
	if config.IsRedisAvailable() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		config.RedisClient.Del(ctx, "cache:siak:grades:"+userID.String())
		cancel()
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

type siakGradesCachePayload struct {
	IsConnected bool                 `json:"isConnected"`
	Summary     *models.SiakSummary  `json:"summary"`
	Grades      []models.SiakGrade   `json:"grades"`
}

// GetSiakGrades mengambil cache nilai terdaftar dari database
func GetSiakGrades(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]any{"success": false, "message": "Unauthorized"})
	}

	cacheKey := "cache:siak:grades:" + userID.String()

	// 1. Coba ambil dari Redis cache
	if config.IsRedisAvailable() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		cachedData, err := config.RedisClient.Get(ctx, cacheKey).Result()
		cancel()
		if err == nil && cachedData != "" {
			var cachedPayload siakGradesCachePayload
			if err := json.Unmarshal([]byte(cachedData), &cachedPayload); err == nil {
				return c.JSON(http.StatusOK, map[string]any{
					"success": true,
					"data":    cachedPayload,
				})
			}
		}
	}

	// 2. Cek apakah akun terhubung
	var account models.SiakAccount
	err := config.DB.Where("user_id = ?", userID.String()).First(&account).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		payload := siakGradesCachePayload{
			IsConnected: false,
			Summary:     nil,
			Grades:      []models.SiakGrade{},
		}
		// Simpan payload kosong ke cache agar terhindar dari cache stampede / DB spam
		if config.IsRedisAvailable() {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			jsonData, err := json.Marshal(payload)
			if err == nil {
				config.RedisClient.Set(ctx, cacheKey, jsonData, 10*time.Minute)
			}
			cancel()
		}
		return c.JSON(http.StatusOK, map[string]any{
			"success": true,
			"data":    payload,
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

	summary := &models.SiakSummary{
		NIM:        account.NIM,
		IPK:        ipk,
		TotalSKS:   totalSKS,
		TotalMutu:  totalMutu,
		LastSyncAt: account.LastSyncAt,
	}

	payload := siakGradesCachePayload{
		IsConnected: true,
		Summary:     summary,
		Grades:      grades,
	}

	// Simpan ke Redis cache untuk 10 menit
	if config.IsRedisAvailable() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		jsonData, err := json.Marshal(payload)
		if err == nil {
			config.RedisClient.Set(ctx, cacheKey, jsonData, 10*time.Minute)
		}
		cancel()
	}

	return c.JSON(http.StatusOK, map[string]any{
		"success": true,
		"data":    payload,
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
	if err := services.SaveGradesCache(userID.String(), grades); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal memperbarui data nilai"})
	}

	// Sinkronkan jadwal & ujian secara otomatis
	go func(s *services.SiakSession, uID string) {
		schedules, err := s.FetchSchedule()
		if err == nil && len(schedules) > 0 {
			services.SaveScheduleCache(uID, schedules)
		}
		exams, err := s.FetchExams()
		if err == nil && len(exams) > 0 {
			services.SaveExamsCache(uID, exams)
		}
	}(session, userID.String())

	// Invalidate Redis cache
	if config.IsRedisAvailable() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		config.RedisClient.Del(ctx, "cache:siak:grades:"+userID.String())
		cancel()
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

	// Hapus nilai, jadwal, dan ujian cache
	if err := config.DB.Where("user_id = ?", userID.String()).Delete(&models.SiakGrade{}).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal menghapus cache nilai"})
	}
	config.DB.Where("user_id = ?", userID.String()).Delete(&models.SiakSchedule{})
	config.DB.Where("user_id = ?", userID.String()).Delete(&models.SiakExam{})

	// Invalidate Redis cache
	if config.IsRedisAvailable() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		config.RedisClient.Del(ctx, "cache:siak:grades:"+userID.String())
		cancel()
	}

	utils.LogAuditEvent(userID.String(), "DISCONNECT_SIAK", "siak_account", nil)

	return c.JSON(http.StatusOK, map[string]any{
		"success": true,
		"message": "Berhasil memutuskan koneksi SIAK dan menghapus semua data cache.",
	})
}



// GetSiakSchedule mengambil daftar jadwal kuliah dari database
func GetSiakSchedule(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]any{"success": false, "message": "Unauthorized"})
	}

	var schedules []models.SiakSchedule
	if err := config.DB.Where("user_id = ?", userID.String()).Order("hari ASC, jam_mulai ASC").Find(&schedules).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal mengambil jadwal kuliah"})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"success": true,
		"data":    schedules,
	})
}

// GetSiakExams mengambil daftar jadwal ujian (UTS/UAS) dari database
func GetSiakExams(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]any{"success": false, "message": "Unauthorized"})
	}

	var exams []models.SiakExam
	if err := config.DB.Where("user_id = ?", userID.String()).Order("tanggal_ujian ASC").Find(&exams).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal mengambil jadwal ujian"})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"success": true,
		"data":    exams,
	})
}

// SyncSiakSchedule melakukan force refresh scraping jadwal kuliah dari SIAK
func SyncSiakSchedule(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]any{"success": false, "message": "Unauthorized"})
	}

	var account models.SiakAccount
	if err := config.DB.Where("user_id = ?", userID.String()).First(&account).Error; err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{"success": false, "message": "Akun SIAK belum terhubung"})
	}

	password, err := utils.DecryptPassword(account.PasswordEncrypted)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal dekripsi kredensial"})
	}

	session, err := services.SiakLogin(account.NIM, password)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{"success": false, "message": "Gagal login SIAK: " + err.Error()})
	}

	schedules, err := session.FetchSchedule()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal scraping jadwal: " + err.Error()})
	}

	if err := services.SaveScheduleCache(userID.String(), schedules); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal menyimpan jadwal"})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"success": true,
		"message": "Jadwal kuliah berhasil disinkronkan!",
		"data":    schedules,
	})
}

// SyncSiakExams melakukan force refresh scraping jadwal ujian dari SIAK
func SyncSiakExams(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]any{"success": false, "message": "Unauthorized"})
	}

	var account models.SiakAccount
	if err := config.DB.Where("user_id = ?", userID.String()).First(&account).Error; err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{"success": false, "message": "Akun SIAK belum terhubung"})
	}

	password, err := utils.DecryptPassword(account.PasswordEncrypted)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal dekripsi kredensial"})
	}

	session, err := services.SiakLogin(account.NIM, password)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{"success": false, "message": "Gagal login SIAK: " + err.Error()})
	}

	exams, err := session.FetchExams()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal scraping ujian: " + err.Error()})
	}

	if err := services.SaveExamsCache(userID.String(), exams); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal menyimpan jadwal ujian"})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"success": true,
		"message": "Jadwal ujian berhasil disinkronkan!",
		"data":    exams,
	})
}
