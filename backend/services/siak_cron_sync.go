package services

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
	"gorm.io/gorm"
)

// StartSiakCronSync meluncurkan background worker berkala (setiap 12 jam) untuk
// secara otomatis menyinkronkan data nilai, jadwal, dan ujian dari SIAK Wicida.
func StartSiakCronSync() {
	go func() {
		log.Println("[SIAK-CRON] Starting SIAK periodic background sync worker...")

		// Ticker berjalan setiap 12 jam
		ticker := time.NewTicker(12 * time.Hour)
		defer ticker.Stop()

		for range ticker.C {
			RunPeriodicSiakSync()
		}
	}()
}

// RunPeriodicSiakSync memproses seluruh akun SIAK aktif di database
func RunPeriodicSiakSync() {
	var accounts []models.SiakAccount
	if err := config.DB.Find(&accounts).Error; err != nil {
		log.Printf("[SIAK-CRON] Error fetching SIAK accounts: %v", err)
		return
	}

	if len(accounts) == 0 {
		return
	}

	log.Printf("[SIAK-CRON] Memulai sinkronisasi otomatis untuk %d akun SIAK...", len(accounts))

	for _, acc := range accounts {
		go processSingleSiakAccountSync(acc)
	}
}

func processSingleSiakAccountSync(acc models.SiakAccount) {
	password, err := utils.DecryptPassword(acc.PasswordEncrypted)
	if err != nil {
		log.Printf("[SIAK-CRON] Gagal dekripsi password untuk NIM %s: %v", acc.NIM, err)
		return
	}

	session, err := SiakLogin(acc.NIM, password)
	if err != nil {
		log.Printf("[SIAK-CRON] Gagal login SIAK untuk NIM %s: %v", acc.NIM, err)
		return
	}

	// 1. Scraping Nilai baru
	newGrades, summary, err := session.FetchGrades()
	if err == nil && len(newGrades) > 0 {
		// Deteksi apakah ada nilai baru yang terbit (dosen baru input nilai)
		var oldGrades []models.SiakGrade
		config.DB.Where("user_id = ?", acc.UserID).Find(&oldGrades)

		oldMap := make(map[string]string)
		for _, og := range oldGrades {
			oldMap[og.KodeMatkul] = og.NilaiHuruf
		}

		var newlyAddedGrades []models.SiakGrade
		for _, ng := range newGrades {
			oldVal, exists := oldMap[ng.KodeMatkul]
			if (!exists || oldVal == "" || oldVal == "-") && (ng.NilaiHuruf != "" && ng.NilaiHuruf != "-") {
				newlyAddedGrades = append(newlyAddedGrades, ng)
			}
		}

		// Update database cache
		SaveGradesCache(acc.UserID, newGrades)

		// Jika ada nilai baru yang terbit, kirim notifikasi ke Telegram & WebSocket
		if len(newlyAddedGrades) > 0 {
			notifyNewGrades(acc.UserID, acc.NIM, newlyAddedGrades, summary)
		}
	}

	// 2. Scraping Jadwal Kuliah & Sync ke Calendar
	schedules, err := session.FetchSchedule()
	if err == nil && len(schedules) > 0 {
		SaveScheduleCache(acc.UserID, schedules)
	}

	// 3. Scraping Jadwal Ujian UTS/UAS
	exams, err := session.FetchExams()
	if err == nil && len(exams) > 0 {
		SaveExamsCache(acc.UserID, exams)
	}

	// Update LastSyncAt
	now := time.Now()
	config.DB.Model(&acc).Update("last_sync_at", now)
}

// SaveGradesCache menyimpan data nilai SIAK ke database
func SaveGradesCache(userID string, grades []models.SiakGrade) error {
	return config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", userID).Delete(&models.SiakGrade{}).Error; err != nil {
			return err
		}
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

// SaveScheduleCache menyimpan data jadwal kuliah SIAK ke database dan menyinkronkan ke AI Calendar
func SaveScheduleCache(userID string, schedules []models.SiakSchedule) error {
	err := config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", userID).Delete(&models.SiakSchedule{}).Error; err != nil {
			return err
		}
		if len(schedules) > 0 {
			for i := range schedules {
				schedules[i].UserID = userID
			}
			if err := tx.Create(&schedules).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err == nil && len(schedules) > 0 {
		go SyncSiakScheduleToCalendar(userID, schedules)
	}

	return err
}

// SaveExamsCache menyimpan data jadwal ujian SIAK ke database
func SaveExamsCache(userID string, exams []models.SiakExam) error {
	return config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", userID).Delete(&models.SiakExam{}).Error; err != nil {
			return err
		}
		if len(exams) > 0 {
			for i := range exams {
				exams[i].UserID = userID
			}
			if err := tx.Create(&exams).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func notifyNewGrades(userID string, nim string, newGrades []models.SiakGrade, summary *models.SiakSummary) {
	var user models.User
	if err := config.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		return
	}

	// 1. Notifikasi Telegram
	if user.TelegramChatID != "" {
		msg := fmt.Sprintf("🎉 *NILAI BARU KELUAR DI SIAK!* 🎉\n\nNIM: `%s`\n\n", nim)
		for _, g := range newGrades {
			msg += fmt.Sprintf("📚 *%s* (%s)\n  ➜ Nilai: `%s` (Angka: %.2f | SKS: %d)\n\n", g.NamaMatkul, g.KodeMatkul, g.NilaiHuruf, g.NilaiAngka, g.SKS)
		}
		if summary != nil {
			msg += fmt.Sprintf("📊 *IPK Terbaru*: `%.2f` | Total SKS: `%d`\n", summary.IPK, summary.TotalSKS)
		}
		SendTelegramNotification(user.TelegramChatID, msg)
	}

	// 2. Broadcast WebSocket Real-time
	payload := map[string]interface{}{
		"type":      "SIAK_GRADE_UPDATED",
		"message":   "Nilai baru telah terbit di SIAK Wicida!",
		"newGrades": newGrades,
		"summary":   summary,
	}
	bytesPayload, err := json.Marshal(payload)
	if err == nil && WSHub != nil {
		WSHub.Broadcast(userID, bytesPayload)
	}
}
