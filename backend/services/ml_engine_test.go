package services

import (
	"testing"
	"time"

	"github.com/motion/backend/models"
)

// TestEmptyWorkload memverifikasi baseline metric saat tidak ada data
func TestEmptyWorkload(t *testing.T) {
	tasks := []models.Task{}
	result := CalculateMetricsFromTasks(tasks, []models.MoodleAssignment{})

	if result.BurnoutRisk.Status != "Low" {
		t.Errorf("Expected default Low burnout status, got %s", result.BurnoutRisk.Status)
	}

	if result.ModelCalibration.SamplesTrained != 0 {
		t.Errorf("Expected 0 samples trained for empty tasks, got %d", result.ModelCalibration.SamplesTrained)
	}
}

// TestHighBurnoutRisk memverifikasi klasifikasi stres tinggi pada beban kerja berlebih dan overdue
func TestHighBurnoutRisk(t *testing.T) {
	now := time.Now()
	pastDue := now.Add(-24 * time.Hour)

	// Skenario: 3 Tugas Overdue dengan durasi pengerjaan panjang, ditambah late-night completions
	tasks := []models.Task{
		{
			Title:               "Laporan Praktikum ML Overdue",
			Status:              "pending",
			TimeEstimateMinutes: 300, // 5 Jam
			DueDate:             &pastDue,
		},
		{
			Title:               "Belajar Kuis Aljabar Overdue",
			Status:              "pending",
			TimeEstimateMinutes: 240, // 4 Jam
			DueDate:             &pastDue,
		},
		{
			Title:               "Tugas Mandiri Rekayasa Web Overdue",
			Status:              "pending",
			TimeEstimateMinutes: 180, // 3 Jam
			DueDate:             &pastDue,
		},
	}

	// Tambahkan 3 tugas yang diselesaikan larut malam (begadang jam 1 pagi)
	lateNightTime := time.Date(2026, 5, 31, 1, 30, 0, 0, time.Local)
	for i := 0; i < 3; i++ {
		tasks = append(tasks, models.Task{
			Title:               "Tugas Begadang Selesai",
			Status:              "completed",
			CompletedAt:         &lateNightTime,
			TimeEstimateMinutes: 60,
		})
	}

	result := CalculateMetricsFromTasks(tasks, []models.MoodleAssignment{})

	if result.BurnoutRisk.Status != "High" {
		t.Errorf("Expected High burnout status for extreme overload, got %s (Score: %.2f%%)", 
			result.BurnoutRisk.Status, result.BurnoutRisk.Score)
	}
}

// TestMAECalculation memverifikasi perhitungan deviasi linear MAE dan akurasi kalibrasi
func TestMAECalculation(t *testing.T) {
	start1 := time.Now().Add(-60 * time.Minute)
	end1 := time.Now() // Durasi Aktual = 60 Menit

	start2 := time.Now().Add(-120 * time.Minute)
	end2 := time.Now() // Durasi Aktual = 120 Menit

	tasks := []models.Task{
		{
			Title:               "Tugas 1",
			Status:              "completed",
			ScheduledStart:      &start1,
			CompletedAt:         &end1,
			TimeEstimateMinutes: 45, // Prediksi 45 menit, Selisih Absolut = |60 - 45| = 15
		},
		{
			Title:               "Tugas 2",
			Status:              "completed",
			ScheduledStart:      &start2,
			CompletedAt:         &end2,
			TimeEstimateMinutes: 150, // Prediksi 150 menit, Selisih Absolut = |120 - 150| = 30
		},
	}

	// MAE Ekspektasi = (15 + 30) / 2 = 22.5
	result := CalculateMetricsFromTasks(tasks, []models.MoodleAssignment{})

	if result.ModelCalibration.SamplesTrained != 2 {
		t.Errorf("Expected 2 samples trained, got %d", result.ModelCalibration.SamplesTrained)
	}

	if result.ModelCalibration.MeanAbsoluteError != 22.5 {
		t.Errorf("Expected MAE of 22.5, got %.2f", result.ModelCalibration.MeanAbsoluteError)
	}

	// Rata-rata durasi aktual = (60 + 120) / 2 = 90
	// Akurasi Ekspektasi = (1.0 - (22.5 / 90.0)) * 100 = 75.0%
	if result.ModelCalibration.AccuracyRate != 75.0 {
		t.Errorf("Expected accuracy rate of 75.0%%, got %.2f%%", result.ModelCalibration.AccuracyRate)
	}
}

// TestGoldenHoursClustering memverifikasi bahwa model K-Means/PDF sederhana berhasil mendeteksi jam puncak produktif
func TestGoldenHoursClustering(t *testing.T) {
	// Buat 4 tugas yang diselesaikan pada hari Selasa (Weekday = 2) pukul 19:30
	// (Selasa jam 19.00 - 21.00 WIB)
	tuesdayNight := time.Date(2026, 6, 2, 19, 30, 0, 0, time.Local) // 2 Juni 2026 adalah hari Selasa

	tasks := []models.Task{
		{
			Title:       "Tugas selesai Selasa malam 1",
			Status:      "completed",
			CompletedAt: &tuesdayNight,
		},
		{
			Title:       "Tugas selesai Selasa malam 2",
			Status:      "completed",
			CompletedAt: &tuesdayNight,
		},
		{
			Title:       "Tugas selesai Selasa malam 3",
			Status:      "completed",
			CompletedAt: &tuesdayNight,
		},
		{
			Title:       "Tugas selesai Selasa malam 4",
			Status:      "completed",
			CompletedAt: &tuesdayNight,
		},
	}

	result := CalculateMetricsFromTasks(tasks, []models.MoodleAssignment{})

	if result.GoldenHours.PeakDay != "Selasa" {
		t.Errorf("Expected peak day to be Tuesday (Selasa), got %s", result.GoldenHours.PeakDay)
	}

	expectedRange := "18:00 - 20:00 WIB" // 19 - 1 s.d 19 + 1
	if result.GoldenHours.PeakHourRange != expectedRange {
		t.Errorf("Expected peak hour range %s, got %s", expectedRange, result.GoldenHours.PeakHourRange)
	}
}

// TestGraduationRiskCalculation memverifikasi formula heuristik Graduation Risk Index (GRI)
func TestGraduationRiskCalculation(t *testing.T) {
	now := time.Now()
	pastDue := now.Add(-48 * time.Hour)

	// Skenario: 3 tugas WeLearn: 1 quiz overdue, 1 assign overdue, 1 submitted
	assigns := []models.MoodleAssignment{
		{
			Name:             "Quiz Aljabar Linier",
			SubmissionStatus: "new",
			DueDate:          &pastDue,
		},
		{
			Name:             "Tugas Web Programming",
			SubmissionStatus: "new",
			DueDate:          &pastDue,
		},
		{
			Name:             "Laporan Algoritma Selesai",
			SubmissionStatus: "submitted",
			DueDate:          &pastDue,
		},
	}

	// 2 completed tasks: 1 procrastinated (selesai 1 jam sebelum deadline), 1 on-time
	due1 := now.Add(2 * time.Hour)
	comp1 := now.Add(1 * time.Hour)
	due2 := now.Add(24 * time.Hour)
	comp2 := now.Add(2 * time.Hour)

	tasks := []models.Task{
		{
			Status:      "completed",
			CompletedAt: &comp1,
			DueDate:     &due1, // Selisih 1 jam -> Prokrastinasi
		},
		{
			Status:      "completed",
			CompletedAt: &comp2,
			DueDate:     &due2, // Selisih 22 jam -> Aman
		},
	}

	result := CalculateMetricsFromTasks(tasks, assigns)

	// Verifikasi skor dan status risiko kelulusan (GRI)
	// overdue ratio: 2/3 = 0.6667
	// quiz miss ratio: 1/1 = 1.0 (karena "Quiz Aljabar Linier" isQuiz=true dan submissionStatus="new" overdue)
	// Academic Score = 1.0 - (0.6667 * 0.6 + 1.0 * 0.4) = 1.0 - (0.4 + 0.4) = 0.20
	// Consistency Score: procrastination ratio = 1/2 = 0.5; Consistency = 1.0 - 0.5 = 0.50
	// GRI = (1.0 - (0.2 * 0.7 + 0.5 * 0.3)) * 100 = (1.0 - (0.14 + 0.15)) * 100 = 71% -> High
	if result.GraduationRisk.Score < 60.0 {
		t.Errorf("Expected GRI score to be high, got %.2f%%", result.GraduationRisk.Score)
	}

	if result.GraduationRisk.Status != "High" {
		t.Errorf("Expected GRI status to be High, got %s", result.GraduationRisk.Status)
	}
}

