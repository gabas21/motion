package services

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"gorm.io/gorm"
)

// Map nama hari bahasa Indonesia ke time.Weekday
var dayToWeekday = map[string]time.Weekday{
	"senin":  time.Monday,
	"selasa": time.Tuesday,
	"rabu":   time.Wednesday,
	"kamis":  time.Thursday,
	"jumat":  time.Friday,
	"sabtu":  time.Saturday,
	"minggu": time.Sunday,
}

// SyncSiakScheduleToCalendar menginjeksi jadwal kuliah SIAK ke dalam tabel calendar_events
// ber-source "siak" agar AI Task Auto-Scheduler tidak bentrok jam kuliah.
func SyncSiakScheduleToCalendar(userIDStr string, schedules []models.SiakSchedule) error {
	userUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		return err
	}

	return config.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Hapus event calendar SIAK lama milik user ini
		if err := tx.Where("user_id = ? AND calendar_source = ?", userUUID.String(), "siak").Delete(&models.CalendarEvent{}).Error; err != nil {
			return err
		}

		if len(schedules) == 0 {
			return nil
		}

		// 2. Tentukan rentang 16 minggu ke depan (1 semester)
		now := time.Now()
		var newEvents []models.CalendarEvent

		for _, s := range schedules {
			weekday, exists := dayToWeekday[strings.ToLower(strings.TrimSpace(s.Hari))]
			if !exists {
				continue
			}

			// Parse jamMulai & jamSelesai (format HH:MM)
			var startHour, startMin, endHour, endMin int
			fmt.Sscanf(s.JamMulai, "%d:%d", &startHour, &startMin)
			fmt.Sscanf(s.JamSelesai, "%d:%d", &endHour, &endMin)

			// Buat event mingguan selama 16 minggu ke depan
			for week := 0; week < 16; week++ {
				// Cari tanggal hari terdekat sesuai weekday
				daysAhead := int(weekday - now.Weekday())
				if daysAhead < 0 {
					daysAhead += 7
				}
				eventDate := now.AddDate(0, 0, daysAhead+(week*7))

				startTime := time.Date(eventDate.Year(), eventDate.Month(), eventDate.Day(), startHour, startMin, 0, 0, time.Local)
				endTime := time.Date(eventDate.Year(), eventDate.Month(), eventDate.Day(), endHour, endMin, 0, 0, time.Local)

				desc := fmt.Sprintf("Kuliah: %s\nKode: %s\nRuangan: %s\nDosen: %s\nSKS: %d",
					s.NamaMatkul, s.KodeMatkul, s.Ruangan, s.Dosen, s.SKS)

				event := models.CalendarEvent{
					ID:              uuid.New(),
					UserID:          userUUID,
					ExternalEventID: fmt.Sprintf("siak-%s-week%d", s.ID, week),
					Title:           fmt.Sprintf("[KULIAH SIAK] %s", s.NamaMatkul),
					Description:     desc,
					StartTime:       startTime,
					EndTime:         endTime,
					CalendarSource:  "siak",
					IsBusy:          true,
				}
				newEvents = append(newEvents, event)
			}
		}

		if len(newEvents) > 0 {
			if err := tx.Create(&newEvents).Error; err != nil {
				log.Printf("[SIAK-CALENDAR] Gagal membuat calendar events: %v", err)
				return err
			}
			log.Printf("[SIAK-CALENDAR] Berhasil menyinkronkan %d event jadwal kuliah SIAK ke Calendar untuk user %s", len(newEvents), userIDStr)
		}

		return nil
	})
}
