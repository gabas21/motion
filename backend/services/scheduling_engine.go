package services

import (
	"context"
	"errors"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"gorm.io/gorm"
)

type SchedulingEngine struct{}

var InstanceSchedulingEngine = &SchedulingEngine{}

// GetOrCreatePreferences mengambil atau membuat preferensi default jika belum ada
func (s *SchedulingEngine) GetOrCreatePreferences(userID uuid.UUID) (*models.SchedulingPreference, error) {
	var pref models.SchedulingPreference
	err := config.DB.Where("user_id = ?", userID.String()).First(&pref).Error
	
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Buat preferensi default jika tidak ditemukan
		pref = models.SchedulingPreference{
			UserID:                 userID,
			WorkHoursStart:         9,     // 09:00 pagi
			WorkHoursEnd:           18,    // 18:00 sore (6 PM)
			BreakDurationMinutes:   15,    // Jeda 15 menit
			AllowWeekendScheduling: false, // Libur akhir pekan
			PreferredTaskTime:      "morning",
		}
		if err := config.DB.Create(&pref).Error; err != nil {
			return nil, err
		}
		log.Printf("Membuat preferensi penjadwalan default untuk user: %s", userID.String())
		return &pref, nil
	} else if err != nil {
		return nil, err
	}
	
	return &pref, nil
}

// ScheduleTask secara otomatis mencari slot waktu kosong terbaik untuk tugas tertentu
func (s *SchedulingEngine) ScheduleTask(ctx context.Context, task *models.Task) error {
	// 1. Ambil preferensi penjadwalan pengguna
	pref, err := s.GetOrCreatePreferences(task.UserID)
	if err != nil {
		return err
	}

	// Tentukan break duration awal
	breakDurationMin := pref.BreakDurationMinutes

	// ML-Engine Integration: Ambil metrik burnout risk & golden study hours
	mlMetrics, mlErr := CalculateMLMetrics(task.UserID)
	if mlErr == nil {
		// Jika burnout risk tinggi (>60%), otomatis perpanjang jeda istirahat menjadi minimal 30 menit (Focus Break Blocks)
		if mlMetrics.BurnoutRisk.Score > 60.0 {
			if breakDurationMin < 30 {
				breakDurationMin = 30
				log.Printf("[Scheduling-Engine-ML] 🧠 Burnout risk tinggi terdeteksi (%.1f%%). Memperpanjang jeda istirahat menjadi %d menit.", mlMetrics.BurnoutRisk.Score, breakDurationMin)
			}
		}
	}

	// 2. Tentukan rentang pencarian slot waktu
	now := time.Now()
	
	// Tentukan batas akhir pencarian: jika ada DueDate, gunakan itu. Jika tidak, batasi hingga 14 hari ke depan.
	maxSearchDate := now.AddDate(0, 0, 14)
	if task.DueDate != nil && task.DueDate.After(now) {
		maxSearchDate = *task.DueDate
	}

	// 3. Ambil semua waktu sibuk (CalendarEvent & Task Terjadwal lainnya) dalam rentang pencarian
	var meetings []models.CalendarEvent
	if err := config.DB.Where("user_id = ? AND end_time >= ? AND start_time <= ?", task.UserID.String(), now, maxSearchDate).Find(&meetings).Error; err != nil {
		return err
	}

	var otherTasks []models.Task
	if err := config.DB.Where("user_id = ? AND id != ? AND status != 'completed' AND scheduled_end >= ? AND scheduled_start <= ?", task.UserID.String(), task.ID.String(), now, maxSearchDate).Find(&otherTasks).Error; err != nil {
		return err
	}

	// Durasi tugas ditambah jeda istirahat
	taskDuration := time.Duration(task.TimeEstimateMinutes) * time.Minute
	breakDuration := time.Duration(breakDurationMin) * time.Minute
	totalNeeded := taskDuration + breakDuration

	// Helper untuk mengecek apakah slotStart berada di Golden Hours yang dihitung model KMeans
	isInGoldenHours := func(slotStart time.Time) bool {
		if mlErr != nil || mlMetrics.GoldenHours.PeakHourRange == "" || 
			strings.Contains(mlMetrics.GoldenHours.PeakHourRange, "Selesaikan") || 
			strings.Contains(mlMetrics.GoldenHours.PeakHourRange, "Butuh") {
			return false
		}
		// Format: "HH:00 - HH:00 WIB"
		parts := strings.Split(mlMetrics.GoldenHours.PeakHourRange, " - ")
		if len(parts) < 2 {
			return false
		}
		startStr := strings.Split(parts[0], ":")[0]
		endStr := strings.Split(parts[1], ":")[0]
		startHour, err1 := strconv.Atoi(startStr)
		endHour, err2 := strconv.Atoi(endStr)
		if err1 != nil || err2 != nil {
			return false
		}

		currentHour := slotStart.Hour()
		if startHour <= endHour {
			return currentHour >= startHour && currentHour < endHour
		} else {
			// Menyeberang tengah malam (e.g. 23:00 - 01:00)
			return currentHour >= startHour || currentHour < endHour
		}
	}

	// 4. Cari slot kosong harian yang memenuhi kriteria
	currentDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	endSearchDay := time.Date(maxSearchDate.Year(), maxSearchDate.Month(), maxSearchDate.Day(), 23, 59, 59, 0, time.Local)

	var scheduledStart, scheduledEnd time.Time
	found := false

	// Jika tugas memiliki prioritas sangat tinggi (>= 4), coba jadwalkan di Golden Hours terlebih dahulu!
	if task.Priority >= 4 && mlErr == nil && mlMetrics.GoldenHours.PeakDay != "Butuh Data" {
		log.Printf("[Scheduling-Engine-ML] ⭐ Tugas prioritas tinggi '%s' terdeteksi. Mencari slot kosong di jam produktif Golden Hours (%s)...", task.Title, mlMetrics.GoldenHours.PeakHourRange)
		
		for day := currentDay; day.Before(endSearchDay) || day.Equal(endSearchDay); day = day.AddDate(0, 0, 1) {
			weekday := day.Weekday()
			if (weekday == time.Saturday || weekday == time.Sunday) && !pref.AllowWeekendScheduling {
				continue
			}

			dayStart := time.Date(day.Year(), day.Month(), day.Day(), pref.WorkHoursStart, 0, 0, 0, time.Local)
			dayEnd := time.Date(day.Year(), day.Month(), day.Day(), pref.WorkHoursEnd, 0, 0, 0, time.Local)

			if day.Year() == now.Year() && day.Month() == now.Month() && day.Day() == now.Day() {
				if now.After(dayStart) {
					dayStart = now.Add(15 * time.Minute)
				}
			}

			for slotStart := dayStart; slotStart.Add(totalNeeded).Before(dayEnd) || slotStart.Add(totalNeeded).Equal(dayEnd); slotStart = slotStart.Add(15 * time.Minute) {
				// Pastikan slot ini berada di dalam Golden Hours
				if !isInGoldenHours(slotStart) {
					continue
				}

				slotEnd := slotStart.Add(taskDuration)
				hasCollision := false

				for _, meeting := range meetings {
					if slotStart.Before(meeting.EndTime) && slotEnd.After(meeting.StartTime) {
						hasCollision = true
						break
					}
				}
				if hasCollision {
					continue
				}

				for _, ot := range otherTasks {
					if ot.ScheduledStart != nil && ot.ScheduledEnd != nil {
						if slotStart.Before(*ot.ScheduledEnd) && slotEnd.After(*ot.ScheduledStart) {
							hasCollision = true
							break
						}
					}
				}

				if !hasCollision {
					scheduledStart = slotStart
					scheduledEnd = slotEnd
					found = true
					log.Printf("[Scheduling-Engine-ML] ✓ Slot Golden Hours ditemukan pada %s s/d %s!", scheduledStart.Format("2006-01-02 15:04"), scheduledEnd.Format("15:04"))
					break
				}
			}
			if found {
				break
			}
		}
	}

	// Jika bukan prioritas tinggi ATAU slot Golden Hours penuh, cari slot kerja normal
	if !found {
		for day := currentDay; day.Before(endSearchDay) || day.Equal(endSearchDay); day = day.AddDate(0, 0, 1) {
			weekday := day.Weekday()
			if (weekday == time.Saturday || weekday == time.Sunday) && !pref.AllowWeekendScheduling {
				continue
			}

			dayStart := time.Date(day.Year(), day.Month(), day.Day(), pref.WorkHoursStart, 0, 0, 0, time.Local)
			dayEnd := time.Date(day.Year(), day.Month(), day.Day(), pref.WorkHoursEnd, 0, 0, 0, time.Local)

			if day.Year() == now.Year() && day.Month() == now.Month() && day.Day() == now.Day() {
				if now.After(dayStart) {
					dayStart = now.Add(15 * time.Minute)
				}
			}

			for slotStart := dayStart; slotStart.Add(totalNeeded).Before(dayEnd) || slotStart.Add(totalNeeded).Equal(dayEnd); slotStart = slotStart.Add(15 * time.Minute) {
				slotEnd := slotStart.Add(taskDuration)
				hasCollision := false

				for _, meeting := range meetings {
					if slotStart.Before(meeting.EndTime) && slotEnd.After(meeting.StartTime) {
						hasCollision = true
						break
					}
				}
				if hasCollision {
					continue
				}

				for _, ot := range otherTasks {
					if ot.ScheduledStart != nil && ot.ScheduledEnd != nil {
						if slotStart.Before(*ot.ScheduledEnd) && slotEnd.After(*ot.ScheduledStart) {
							hasCollision = true
							break
						}
					}
				}

				if !hasCollision {
					scheduledStart = slotStart
					scheduledEnd = slotEnd
					found = true
					break
				}
			}
			if found {
				break
			}
		}
	}

	// 5. Simpan keputusan penjadwalan ke database
	if found {
		task.ScheduledStart = &scheduledStart
		task.ScheduledEnd = &scheduledEnd
		task.Status = "scheduled"
		
		log.Printf("AI menempatkan tugas '%s' pada slot: %s s/d %s", task.Title, scheduledStart.Format("2006-01-02 15:04"), scheduledEnd.Format("15:04"))
	} else {
		// Jika tidak ada slot tersisa dalam 14 hari, jadwalkan besok pagi di luar jam kerja/sebagai cadangan
		fallbackStart := time.Date(now.Year(), now.Month(), now.Day()+1, pref.WorkHoursStart, 0, 0, 0, time.Local)
		fallbackEnd := fallbackStart.Add(taskDuration)
		
		task.ScheduledStart = &fallbackStart
		task.ScheduledEnd = &fallbackEnd
		task.Status = "scheduled"
		
		log.Printf("Warning: Slot optimal penuh. Melakukan alokasi fallback tugas '%s' pada %s", task.Title, fallbackStart.Format("2006-01-02 15:04"))
	}

	return config.DB.Save(task).Error
}
