package services

import (
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
)

// StartSiakExamNotifier meluncurkan cron background untuk memeriksa jadwal ujian UTS/UAS
// setiap hari pada pukul 07:00 WIB dan mengontrol notifikasi H-7 serta H-1.
func StartSiakExamNotifier() {
	go func() {
		log.Println("[SIAK-NOTIFIER] Starting SIAK Exam Notifier background worker...")
		// Jalankan pemeriksaan awal saat server menyala
		checkUpcomingExams()

		// Cron berjalan setiap 6 jam
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()

		for range ticker.C {
			checkUpcomingExams()
		}
	}()
}

func checkUpcomingExams() {
	var exams []models.SiakExam
	now := time.Now()
	sevenDaysLater := now.AddDate(0, 0, 7)

	// Cari jadwal ujian dalam rentang 7 hari ke depan
	if err := config.DB.Where("tanggal_ujian IS NOT NULL AND tanggal_ujian >= ? AND tanggal_ujian <= ?", now, sevenDaysLater).Find(&exams).Error; err != nil {
		log.Printf("[SIAK-NOTIFIER] Error querying upcoming exams: %v", err)
		return
	}

	if len(exams) == 0 {
		return
	}

	for _, exam := range exams {
		if exam.TanggalUjian == nil {
			continue
		}

		daysLeft := int(exam.TanggalUjian.Sub(now).Hours() / 24)
		if daysLeft == 7 || daysLeft == 1 || daysLeft == 0 {
			daysTag := strconv.Itoa(daysLeft)
			if strings.Contains(exam.NotifiedDaysLeft, daysTag) {
				continue // Notification already sent for this milestone
			}

			var user models.User
			if err := config.DB.Where("id = ?", exam.UserID).First(&user).Error; err != nil {
				continue
			}

			if user.TelegramChatID != "" {
				timeStr := "Hari Ini"
				if daysLeft == 1 {
					timeStr = "Besok"
				} else if daysLeft > 1 {
					timeStr = fmt.Sprintf("%d hari lagi", daysLeft)
				}

				msg := fmt.Sprintf(
					"⚠️ *PENGINGAT UJIAN SIAK (%s)* ⚠️\n\n"+
						"📌 *Mata Kuliah*: %s (%s)\n"+
						"📅 *Tanggal*: %s (%s)\n"+
						"⏰ *Jam*: %s - %s\n"+
						"🏢 *Ruangan*: %s\n\n"+
						"Persiapkan diri Anda dengan baik! 🚀",
					exam.JenisUjian,
					exam.NamaMatkul, exam.KodeMatkul,
					exam.TanggalUjian.Format("02 Jan 2006"), timeStr,
					exam.JamMulai, exam.JamSelesai,
					exam.Ruangan,
				)

				if err := SendTelegramNotification(user.TelegramChatID, msg); err != nil {
					log.Printf("[SIAK-NOTIFIER] Failed to send Telegram alert to user %s: %v", user.ID, err)
				} else {
					// Update NotifiedDaysLeft record to avoid resending
					newNotified := exam.NotifiedDaysLeft
					if newNotified != "" {
						newNotified += ","
					}
					newNotified += daysTag
					config.DB.Model(&models.SiakExam{}).Where("id = ?", exam.ID).Update("notified_days_left", newNotified)
				}
			}
		}
	}
}
