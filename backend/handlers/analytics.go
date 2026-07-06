package handlers

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
	"github.com/motion/backend/services"
)

type AnalyticsDashboardResponse struct {
	Summary       AnalyticsSummary        `json:"summary"`
	DailyStats    []DailyStatItem         `json:"dailyStats"`
	TimeBreakdown TimeBreakdownItem       `json:"timeBreakdown"`
	MLMetrics     services.MLEngineResult `json:"mlMetrics"`
	Comparison    PeriodComparison        `json:"comparison"`
}

type AnalyticsSummary struct {
	TotalTasks        int     `json:"totalTasks"`
	CompletedTasks    int     `json:"completedTasks"`
	OnTimePercentage  float64 `json:"onTimePercentage"`
	ProductivityScore float64 `json:"productivityScore"`
}

type DailyStatItem struct {
	Date       string  `json:"date"`
	Completed  int     `json:"completed"`
	OnTime     int     `json:"onTime"`
	FocusHours float64 `json:"focusHours"`
}

type TimeBreakdownItem struct {
	FocusTime   float64 `json:"focusTime"`
	MeetingTime float64 `json:"meetingTime"`
	BreakTime   float64 `json:"breakTime"`
	OtherTime   float64 `json:"otherTime"`
}

type InsightItem struct {
	Type           string `json:"type"`
	Title          string `json:"title"`
	Message        string `json:"message"`
	Recommendation string `json:"recommendation"`
}

type PeriodComparison struct {
	CompletionRateChange    float64 `json:"completionRateChange"`
	FocusHoursChange        float64 `json:"focusHoursChange"`
	TasksCompletedChange    float64 `json:"tasksCompletedChange"`
	ProductivityScoreChange float64 `json:"productivityScoreChange"`
}

// GetAnalyticsDashboard computes and returns productivity data for dashboard
func GetAnalyticsDashboard(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Otorisasi gagal")
	}

	// 1. Tentukan rentang waktu secara dinamis
	rangeStr := c.QueryParam("range")
	rangeDays := 7
	if rangeStr == "30" {
		rangeDays = 30
	} else if rangeStr == "90" {
		rangeDays = 90
	}

	// Check cache first (5 min TTL)
	cacheKey := fmt.Sprintf("dashboard:%s:%d", userID.String(), rangeDays)
	if cachedData, found := services.GetAnalyticsCache(cacheKey); found {
		if response, ok := cachedData.(AnalyticsDashboardResponse); ok {
			return utils.JSONSuccess(c, http.StatusOK, response)
		}
	}

	now := time.Now()
	startDate := now.AddDate(0, 0, -(rangeDays - 1))
	prevStartDate := startDate.AddDate(0, 0, -rangeDays)

	// 2. Count total tasks using index
	var totalRealTasks int64
	if err := config.DB.Model(&models.Task{}).Where("user_id = ? AND category != 'education_reminder'", userID).Count(&totalRealTasks).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil statistik tugas")
	}

	// 3. Ambil subset tugas riil user (yang relevan dengan periode analisis)
	var tasks []models.Task
	if err := config.DB.Where("user_id = ? AND category != 'education_reminder' AND (status != 'completed' OR completed_at >= ?)", userID, prevStartDate).Find(&tasks).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil data analitik tugas")
	}

	// 4. Ambil agenda kalender dalam periode analisis saja
	var events []models.CalendarEvent
	if err := config.DB.Where("user_id = ? AND (start_time >= ? OR end_time >= ?)", userID, prevStartDate, prevStartDate).Find(&events).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil data analitik kalender")
	}

	// 5. Agregasikan Statistik Harian & WoW
	dailyStatsMap := make(map[string]*DailyStatItem)
	
	// Inisialisasi hari terakhir agar grafiknya lengkap tidak kosong
	for i := 0; i < rangeDays; i++ {
		d := startDate.AddDate(0, 0, i)
		dateStr := d.Format("2006-01-02")
		
		dailyStatsMap[dateStr] = &DailyStatItem{
			Date:       dateStr,
			Completed:  0,
			OnTime:     0,
			FocusHours: 0.0,
		}
	}

	// Integrasikan tugas nyata dari database
	completedRealTasks := 0
	onTimeRealTasks := 0

	completedA := 0
	onTimeA := 0
	focusA := 0.0

	completedB := 0
	onTimeB := 0
	focusB := 0.0

	for _, task := range tasks {
		if task.Status == "completed" {
			completedRealTasks++
			
			// Anggap on-time jika CompletedAt <= DueDate atau DueDate kosong
			isOnTime := true
			if task.DueDate != nil && task.CompletedAt != nil {
				if task.CompletedAt.After(*task.DueDate) {
					isOnTime = false
				}
			}
			if isOnTime {
				onTimeRealTasks++
			}

			if task.CompletedAt != nil {
				// Cek jika masuk Periode A (Current)
				if !task.CompletedAt.Before(startDate) && !task.CompletedAt.After(now) {
					completedA++
					if isOnTime {
						onTimeA++
					}
					focusVal := float64(task.TimeEstimateMinutes) / 60.0
					focusA += focusVal

					dateStr := task.CompletedAt.Format("2006-01-02")
					if item, exists := dailyStatsMap[dateStr]; exists {
						item.Completed++
						if isOnTime {
							item.OnTime++
						}
						item.FocusHours += focusVal
					}
				}
				// Cek jika masuk Periode B (Previous)
				if !task.CompletedAt.Before(prevStartDate) && task.CompletedAt.Before(startDate) {
					completedB++
					if isOnTime {
						onTimeB++
					}
					focusB += float64(task.TimeEstimateMinutes) / 60.0
				}
			}
		}
	}

	// Integrasikan total jam rapat dari kalender nyata
	meetingA := 0.0
	meetingB := 0.0
	for _, ev := range events {
		if !ev.StartTime.Before(startDate) && !ev.EndTime.After(now.AddDate(0, 0, 1)) {
			duration := ev.EndTime.Sub(ev.StartTime).Hours()
			meetingA += duration
		}
		if !ev.StartTime.Before(prevStartDate) && ev.EndTime.Before(startDate) {
			duration := ev.EndTime.Sub(ev.StartTime).Hours()
			meetingB += duration
		}
	}

	// 5. Hitung Summary Ringkasan (Global)
	totalTasksCount := int(totalRealTasks)
	onTimePct := 0.0
	if completedRealTasks > 0 {
		onTimePct = (float64(onTimeRealTasks) / float64(completedRealTasks)) * 100.0
	}

	// Hitung Productivity Score (skala 1-10)
	prodScore := 0.0
	if totalTasksCount > 0 {
		completionRate := float64(completedRealTasks) / float64(totalTasksCount)
		prodScore = (completionRate*6.0 + (onTimePct/100.0)*4.0)
		if prodScore > 10.0 {
			prodScore = 10.0
		}
	}

	// 6. Hitung Perbandingan WoW
	completionRateA := 0.0
	if completedA > 0 {
		completionRateA = (float64(onTimeA) / float64(completedA)) * 100.0
	}
	completionRateB := 0.0
	if completedB > 0 {
		completionRateB = (float64(onTimeB) / float64(completedB)) * 100.0
	}
	completionRateChange := completionRateA - completionRateB

	focusHoursChange := 0.0
	if focusB > 0 {
		focusHoursChange = ((focusA - focusB) / focusB) * 100.0
	} else if focusA > 0 {
		focusHoursChange = 100.0
	}

	tasksCompletedChange := float64(completedA - completedB)

	prodScoreA := 0.0
	if completedA > 0 {
		prodScoreA = (1.0*6.0 + (completionRateA/100.0)*4.0)
	}
	prodScoreB := 0.0
	if completedB > 0 {
		prodScoreB = (1.0*6.0 + (completionRateB/100.0)*4.0)
	}
	productivityScoreChange := prodScoreA - prodScoreB

	// Susun slice harian terurut
	var dailyStats []DailyStatItem
	for i := 0; i < rangeDays; i++ {
		d := startDate.AddDate(0, 0, i)
		dateStr := d.Format("2006-01-02")
		dailyStats = append(dailyStats, *dailyStatsMap[dateStr])
	}

	// Hitung Time Breakdown (Persentase alokasi waktu)
	focusTotal := focusA
	meetingTotal := meetingA
	breakTotal := focusTotal * 0.20 // 20% Pomodoro break
	
	// Untuk otherTime, asumsikan target produktif terencana adalah 8 jam/hari (8 * rangeDays)
	targetWorkHours := 8.0 * float64(rangeDays)
	otherTotal := 0.0
	usedHours := focusTotal + meetingTotal + breakTotal
	if usedHours < targetWorkHours {
		otherTotal = targetWorkHours - usedHours
	} else {
		otherTotal = usedHours * 0.1 // minimal 10%
	}

	totalSum := focusTotal + meetingTotal + breakTotal + otherTotal
	
	breakdown := TimeBreakdownItem{
		FocusTime:   0,
		MeetingTime: 0,
		BreakTime:   0,
		OtherTime:   0,
	}

	if totalSum > 0 {
		breakdown.FocusTime = (focusTotal / totalSum) * 100
		breakdown.MeetingTime = (meetingTotal / totalSum) * 100
		breakdown.BreakTime = (breakTotal / totalSum) * 100
		breakdown.OtherTime = (otherTotal / totalSum) * 100
	}

	// 7. Hitung metrik Machine Learning secara real-time
	mlMetrics, err := services.CalculateMLMetrics(userID)
	if err != nil {
		log.Printf("[Analytics-ML-Warn] Gagal menghitung metrik ML: %v", err)
	}

	dashboardData := AnalyticsDashboardResponse{
		Summary: AnalyticsSummary{
			TotalTasks:        totalTasksCount,
			CompletedTasks:    completedRealTasks,
			OnTimePercentage:  onTimePct,
			ProductivityScore: prodScore,
		},
		DailyStats:    dailyStats,
		TimeBreakdown: breakdown,
		MLMetrics:     mlMetrics,
		Comparison: PeriodComparison{
			CompletionRateChange:    completionRateChange,
			FocusHoursChange:        focusHoursChange,
			TasksCompletedChange:    tasksCompletedChange,
			ProductivityScoreChange: productivityScoreChange,
		},
	}

	// Cache the result for 5 minutes
	services.SetAnalyticsCache(cacheKey, dashboardData, 5*time.Minute)

	return utils.JSONSuccess(c, http.StatusOK, dashboardData)
}

// GetAnalyticsInsights returns dynamically constructed AI productivity insights
func GetAnalyticsInsights(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Otorisasi gagal")
	}

	// 1. Tentukan rentang waktu
	rangeStr := c.QueryParam("range")
	rangeDays := 7
	if rangeStr == "30" {
		rangeDays = 30
	} else if rangeStr == "90" {
		rangeDays = 90
	}

	// Check cache first (5 min TTL)
	cacheKey := fmt.Sprintf("insights:%s:%d", userID.String(), rangeDays)
	if cachedData, found := services.GetAnalyticsCache(cacheKey); found {
		if response, ok := cachedData.([]InsightItem); ok {
			return utils.JSONSuccess(c, http.StatusOK, response)
		}
	}

	startDate := time.Now().AddDate(0, 0, -(rangeDays - 1))

	// 2. Count total tasks using index
	var totalTasksCount int64
	if err := config.DB.Model(&models.Task{}).Where("user_id = ? AND category != 'education_reminder'", userID).Count(&totalTasksCount).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil data analitik tugas")
	}

	// 3. Ambil subset tugas riil user (yang relevan dengan periode analisis)
	var tasks []models.Task
	if err := config.DB.Where("user_id = ? AND category != 'education_reminder' AND (status != 'completed' OR completed_at >= ? OR created_at >= ?)", userID, startDate, startDate).Find(&tasks).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil data analitik tugas")
	}

	// 4. Ambil agenda kalender dalam periode analisis saja
	var events []models.CalendarEvent
	if err := config.DB.Where("user_id = ? AND (start_time >= ? OR end_time >= ?)", userID, startDate, startDate).Find(&events).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil data analitik kalender")
	}

	totalTasks := int(totalTasksCount)
	completedTasks := 0
	onTimeTasks := 0
	totalFocusHours := 0.0

	// Statistik spesifik periode aktif
	completedTasksPeriod := 0
	focusHoursPeriod := 0.0
	totalTasksPeriod := 0

	for _, task := range tasks {
		if task.Status == "completed" {
			completedTasks++
			
			isOnTime := true
			if task.DueDate != nil && task.CompletedAt != nil {
				if task.CompletedAt.After(*task.DueDate) {
					isOnTime = false
				}
			}
			if isOnTime {
				onTimeTasks++
			}
			totalFocusHours += float64(task.TimeEstimateMinutes) / 60.0

			// Masuk periode
			if task.CompletedAt != nil && !task.CompletedAt.Before(startDate) {
				completedTasksPeriod++
				focusHoursPeriod += float64(task.TimeEstimateMinutes) / 60.0
			}
		}

		if task.CreatedAt.After(startDate) || (task.DueDate != nil && task.DueDate.After(startDate)) {
			totalTasksPeriod++
		}
	}

	if totalTasksPeriod == 0 {
		totalTasksPeriod = totalTasks // fallback
	}

	totalMeetingHours := 0.0
	meetingHoursPeriod := 0.0
	for _, ev := range events {
		duration := ev.EndTime.Sub(ev.StartTime).Hours()
		totalMeetingHours += duration

		if ev.StartTime.After(startDate) {
			meetingHoursPeriod += duration
		}
	}

	var insights []InsightItem

	// 4. Integrasikan Personal AI Insight
	mlMetrics, _ := services.CalculateMLMetrics(userID)
	personalMsg, personalRec, aiErr := services.GeneratePersonalizedInsight(
		userID.String(),
		totalTasksPeriod,
		completedTasksPeriod,
		focusHoursPeriod,
		meetingHoursPeriod,
		mlMetrics.GoldenHours.PeakDay,
		mlMetrics.GoldenHours.PeakHourRange,
		mlMetrics.BurnoutRisk.Status,
		mlMetrics.BurnoutRisk.Score,
	)
	if aiErr == nil {
		insights = append(insights, InsightItem{
			Type:           "personal",
			Title:          "Analisis Personal Asep ⚡",
			Message:        personalMsg,
			Recommendation: personalRec,
		})
	} else {
		log.Printf("[Analytics-AI-Warn] Gagal memuat AI insight personal: %v. Menggunakan fallback rule-based.", aiErr)
	}

	// 5. Rule-based Insights (Fallback/Tambahan)
	if totalTasks == 0 {
		insights = append(insights, InsightItem{
			Type:           "productivity",
			Title:          "Mulai Langkah Pertama Anda! 🚀",
			Message:        "Anda belum memiliki tugas yang terdaftar di sistem Motion.",
			Recommendation: "Buat tugas baru di Dashboard atau sinkronisasikan akun WeLearn Anda untuk memulai pencatatan otomatis.",
		})
	} else {
		completionRate := (float64(completedTasks) / float64(totalTasks)) * 100.0
		if completionRate >= 70.0 {
			insights = append(insights, InsightItem{
				Type:           "productivity",
				Title:          "Produktivitas Sangat Tinggi! 🔥",
				Message:        fmt.Sprintf("Luar biasa! Anda telah menyelesaikan %.0f%% dari total %d tugas terdaftar Anda.", completionRate, totalTasks),
				Recommendation: "Pertahankan ritme kerja ini. Gunakan fitur AI scheduling untuk mengoptimalkan hari kerja Anda selanjutnya.",
			})
		} else {
			pendingTasks := totalTasks - completedTasks
			insights = append(insights, InsightItem{
				Type:           "productivity",
				Title:          "Fokus pada Penyelesaian Tugas 📈",
				Message:        fmt.Sprintf("Anda telah menyelesaikan %d tugas, dengan %d tugas masih dalam daftar antrean.", completedTasks, pendingTasks),
				Recommendation: "Cobalah membagi tugas besar menjadi tugas-tugas kecil dengan durasi 30 menit dan selesaikan satu per satu.",
			})
		}
	}

	// On-Time Insight
	if completedTasks > 0 {
		onTimePct := (float64(onTimeTasks) / float64(completedTasks)) * 100.0
		if onTimePct >= 80.0 {
			insights = append(insights, InsightItem{
				Type:           "productivity",
				Title:          "Ketepatan Waktu Sangat Baik ⏰",
				Message:        fmt.Sprintf("Hebat! %.0f%% dari tugas yang diselesaikan berhasil diserahkan tepat waktu sebelum tenggat.", onTimePct),
				Recommendation: "Pertahankan ketepatan estimasi waktu pengerjaan Anda. Perencanaan waktu Anda saat ini sudah sangat akurat.",
			})
		} else {
			insights = append(insights, InsightItem{
				Type:           "productivity",
				Title:          "Tantangan Tenggat Waktu ⚠️",
				Message:        fmt.Sprintf("Sekitar %.0f%% tugas Anda diselesaikan setelah melewati tanggal tenggat (overdue).", 100.0-onTimePct),
				Recommendation: "Pertimbangkan untuk menambahkan buffer waktu ekstra atau menaikkan prioritas tugas yang mendekati tenggat.",
			})
		}
	}

	// Calendar & Focus Insight
	if totalMeetingHours > totalFocusHours && totalMeetingHours > 0 {
		insights = append(insights, InsightItem{
			Type:           "calendar",
			Title:          "Kolaborasi & Rapat Padat 📅",
			Message:        fmt.Sprintf("Waktu pertemuan/rapat Anda (%.1f jam) melebihi waktu pengerjaan tugas mandiri Anda (%.1f jam).", totalMeetingHours, totalFocusHours),
			Recommendation: "Batasi rapat non-esensial atau manfaatkan fitur AI schedule blocker untuk mengamankan jam fokus Anda.",
		})
	} else if totalFocusHours > 0 {
		insights = append(insights, InsightItem{
			Type:           "calendar",
			Title:          "Waktu Fokus Berkualitas ⚡",
			Message:        fmt.Sprintf("Bagus! Anda telah mendedikasikan %.1f jam untuk waktu fokus penyelesaian tugas mandiri.", totalFocusHours),
			Recommendation: "Jaga konsistensi ini. Padukan dengan teknik Pomodoro 25-5 untuk menjaga energi dan fokus mental tetap segar.",
		})
	} else {
		insights = append(insights, InsightItem{
			Type:           "calendar",
			Title:          "Alokasikan Waktu Fokus Anda ☕",
			Message:        "Belum ada akumulasi jam fokus dari pengerjaan tugas mandiri terdaftar.",
			Recommendation: "Mulai jadwalkan waktu khusus fokus di kalender agar Anda terhindar dari gangguan rapat beruntun.",
		})
	}

	// Cache the result for 5 minutes
	services.SetAnalyticsCache(cacheKey, insights, 5*time.Minute)

	return utils.JSONSuccess(c, http.StatusOK, insights)
}

// ExportProductivityPDF memicu pembuatan berkas PDF laporan produktivitas
func ExportProductivityPDF(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Otorisasi gagal")
	}

	// 1. Dapatkan nama user dari database
	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil data user")
	}
	userName := user.Name
	if userName == "" {
		userName = user.Email
	}

	rangeStr := c.QueryParam("range")
	rangeDays := 7
	if rangeStr == "30" {
		rangeDays = 30
	} else if rangeStr == "90" {
		rangeDays = 90
	}

	// 2. Hitung statistik
	now := time.Now()
	startDate := now.AddDate(0, 0, -(rangeDays - 1))
	prevStartDate := startDate.AddDate(0, 0, -rangeDays)

	var tasks []models.Task
	if err := config.DB.Where("user_id = ? AND category != 'education_reminder'", userID).Find(&tasks).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil data analitik tugas")
	}

	var events []models.CalendarEvent
	if err := config.DB.Where("user_id = ?", userID).Find(&events).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil data analitik kalender")
	}

	completedRealTasks := 0
	onTimeRealTasks := 0
	completedA := 0
	onTimeA := 0
	focusA := 0.0
	completedB := 0
	onTimeB := 0
	focusB := 0.0

	for _, task := range tasks {
		if task.Status == "completed" {
			completedRealTasks++
			isOnTime := true
			if task.DueDate != nil && task.CompletedAt != nil {
				if task.CompletedAt.After(*task.DueDate) {
					isOnTime = false
				}
			}
			if isOnTime {
				onTimeRealTasks++
			}

			if task.CompletedAt != nil {
				if !task.CompletedAt.Before(startDate) && !task.CompletedAt.After(now) {
					completedA++
					if isOnTime {
						onTimeA++
					}
					focusA += float64(task.TimeEstimateMinutes) / 60.0
				}
				if !task.CompletedAt.Before(prevStartDate) && task.CompletedAt.Before(startDate) {
					completedB++
					if isOnTime {
						onTimeB++
					}
					focusB += float64(task.TimeEstimateMinutes) / 60.0
				}
			}
		}
	}

	meetingA := 0.0
	meetingB := 0.0
	for _, ev := range events {
		if !ev.StartTime.Before(startDate) && !ev.EndTime.After(now.AddDate(0, 0, 1)) {
			duration := ev.EndTime.Sub(ev.StartTime).Hours()
			meetingA += duration
		}
		if !ev.StartTime.Before(prevStartDate) && ev.EndTime.Before(startDate) {
			duration := ev.EndTime.Sub(ev.StartTime).Hours()
			meetingB += duration
		}
	}

	totalTasksCount := len(tasks)
	onTimePct := 0.0
	if completedRealTasks > 0 {
		onTimePct = (float64(onTimeRealTasks) / float64(completedRealTasks)) * 100.0
	}

	prodScore := 0.0
	if totalTasksCount > 0 {
		completionRate := float64(completedRealTasks) / float64(totalTasksCount)
		prodScore = (completionRate*6.0 + (onTimePct/100.0)*4.0)
		if prodScore > 10.0 {
			prodScore = 10.0
		}
	}

	// Hitung WoW comparisons
	completionRateA := 0.0
	if completedA > 0 {
		completionRateA = (float64(onTimeA) / float64(completedA)) * 100.0
	}
	completionRateB := 0.0
	if completedB > 0 {
		completionRateB = (float64(onTimeB) / float64(completedB)) * 100.0
	}
	completionRateChange := completionRateA - completionRateB

	focusHoursChange := 0.0
	if focusB > 0 {
		focusHoursChange = ((focusA - focusB) / focusB) * 100.0
	} else if focusA > 0 {
		focusHoursChange = 100.0
	}

	tasksCompletedChange := float64(completedA - completedB)

	prodScoreA := 0.0
	if completedA > 0 {
		prodScoreA = (1.0*6.0 + (completionRateA/100.0)*4.0)
	}
	prodScoreB := 0.0
	if completedB > 0 {
		prodScoreB = (1.0*6.0 + (completionRateB/100.0)*4.0)
	}
	productivityScoreChange := prodScoreA - prodScoreB

	// Breakdown waktu
	breakTotal := focusA * 0.20
	targetWorkHours := 8.0 * float64(rangeDays)
	otherTotal := 0.0
	usedHours := focusA + meetingA + breakTotal
	if usedHours < targetWorkHours {
		otherTotal = targetWorkHours - usedHours
	} else {
		otherTotal = usedHours * 0.1
	}

	totalSum := focusA + meetingA + breakTotal + otherTotal
	focusTimePct := 0.0
	meetingTimePct := 0.0
	breakTimePct := 0.0
	otherTimePct := 0.0
	if totalSum > 0 {
		focusTimePct = (focusA / totalSum) * 100
		meetingTimePct = (meetingA / totalSum) * 100
		breakTimePct = (breakTotal / totalSum) * 100
		otherTimePct = (otherTotal / totalSum) * 100
	}

	// 3. Ambil ML Metrics
	mlMetrics, _ := services.CalculateMLMetrics(userID)

	// 4. Generate AI Insight (Synchronous for PDF)
	personalMsg, personalRec, aiErr := services.GeneratePersonalizedInsight(
		userID.String(),
		completedA,
		completedA,
		focusA,
		meetingA,
		mlMetrics.GoldenHours.PeakDay,
		mlMetrics.GoldenHours.PeakHourRange,
		mlMetrics.BurnoutRisk.Status,
		mlMetrics.BurnoutRisk.Score,
	)
	if aiErr != nil {
		personalMsg = fmt.Sprintf("Berdasarkan rekaman aktivitas, hari paling produktif Anda adalah %s pada range %s.", mlMetrics.GoldenHours.PeakDay, mlMetrics.GoldenHours.PeakHourRange)
		personalRec = "Pertahankan ritme ini! Gunakan waktu produktif tersebut untuk menyelesaikan tugas berprioritas tinggi."
	}

	// 5. Bangun payload data PDF
	pdfData := services.ProductivityPDFData{
		UserName:                userName,
		RangeDays:               rangeDays,
		TotalTasks:              totalTasksCount,
		CompletedTasks:          completedRealTasks,
		OnTimePercentage:        onTimePct,
		ProductivityScore:       prodScore,
		CompletionRateChange:    completionRateChange,
		FocusHoursChange:        focusHoursChange,
		TasksCompletedChange:    tasksCompletedChange,
		ProductivityScoreChange: productivityScoreChange,
		FocusTimePct:            focusTimePct,
		MeetingTimePct:          meetingTimePct,
		BreakTimePct:            breakTimePct,
		OtherTimePct:            otherTimePct,
		BurnoutScore:            mlMetrics.BurnoutRisk.Score,
		BurnoutStatus:           mlMetrics.BurnoutRisk.Status,
		BurnoutDescription:      mlMetrics.BurnoutRisk.Description,
		PeakDay:                 mlMetrics.GoldenHours.PeakDay,
		PeakHourRange:           mlMetrics.GoldenHours.PeakHourRange,
		GoldenConfidence:        mlMetrics.GoldenHours.Confidence,
		PersonalInsightMessage:  personalMsg,
		PersonalInsightRec:      personalRec,
	}

	// 6. Buat PDF
	pdfUrl, err := services.GenerateProductivityPDF(userID.String(), pdfData)
	if err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal membuat berkas PDF")
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]string{
		"url": pdfUrl,
	})
}
