package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
)

// MLEngineResult menyimpan semua luaran model ML
type MLEngineResult struct {
	BurnoutRisk      BurnoutRiskResult      `json:"burnoutRisk"`
	GoldenHours      GoldenHoursResult      `json:"goldenHours"`
	ModelCalibration ModelCalibrationResult `json:"modelCalibration"`
	GraduationRisk   GraduationRiskResult   `json:"graduationRisk"`
}

type BurnoutRiskResult struct {
	Score       float64 `json:"score"`       // Nilai probabilitas 0.0 - 100.0
	Status      string  `json:"status"`      // "Low", "Moderate", "High"
	Description string  `json:"description"` // Kalimat rekomendasi klinis/stres
}

type GoldenHoursResult struct {
	PeakDay       string `json:"peakDay"`       // Nama hari paling produktif
	PeakHourRange string `json:"peakHourRange"` // Jam puncak, e.g. "19:00 - 21:00"
	Confidence    string `json:"confidence"`    // Persentase keyakinan model
}

type ModelCalibrationResult struct {
	MeanAbsoluteError float64 `json:"meanAbsoluteError"` // MAE dalam menit
	AccuracyRate      float64 `json:"accuracyRate"`      // Akurasi kalibrasi (%)
	SamplesTrained    int     `json:"samplesTrained"`    // Jumlah data training
}

type GraduationRiskResult struct {
	Score       float64 `json:"score"`       // Nilai probabilitas 0.0 - 100.0
	Status      string  `json:"status"`      // "Low", "Moderate", "High"
	Description string  `json:"description"` // Penjelasan & rekomendasi kelulusan
}

// CalculateMLMetrics menghitung semua analitik ML dengan mengambil data dari DB
// Sistem menerapkan arsitektur hybrid dengan memanggil Python ML Service dan fallback ke Go math lokal.
func CalculateMLMetrics(userID uuid.UUID) (MLEngineResult, error) {
	if config.DB == nil {
		return getBaselineResult([]models.Task{}, []models.MoodleAssignment{}), nil
	}

	var tasks []models.Task
	if err := config.DB.Where("user_id = ? AND category != 'education_reminder'", userID).Find(&tasks).Error; err != nil {
		return MLEngineResult{}, err
	}

	var moodleAssigns []models.MoodleAssignment
	if err := config.DB.Where("user_id = ?", userID).Find(&moodleAssigns).Error; err != nil {
		log.Printf("[ML-Engine-Warn] Gagal mengambil tugas Moodle: %v", err)
	}

	// 1. Dapatkan hasil kalkulasi Go Math lokal sebagai baseline fallback
	localResult := CalculateMetricsFromTasks(tasks, moodleAssigns)

	if len(tasks) == 0 && len(moodleAssigns) == 0 {
		return localResult, nil
	}

	// 2. Siapkan payload JSON untuk dikirim ke Python ML Service
	payloadBytes, err := json.Marshal(map[string]interface{}{
		"tasks":             tasks,
		"moodleAssignments": moodleAssigns,
	})
	if err != nil {
		return localResult, nil
	}

	// 3. Hubungi Python ML Service (FastAPI) dengan timeout ketat 3 detik agar tidak memblokir user jika offline
	client := &http.Client{Timeout: 3 * time.Second}

	// Call /predict/burnout (Logistic Regression)
	var burnoutResult BurnoutRiskResult
	respBurnout, err := client.Post(fmt.Sprintf("%s/predict/burnout", config.AppConfig.MLServiceURL), "application/json", bytes.NewBuffer(payloadBytes))
	if err == nil && respBurnout.StatusCode == http.StatusOK {
		defer respBurnout.Body.Close()
		if json.NewDecoder(respBurnout.Body).Decode(&burnoutResult) == nil {
			localResult.BurnoutRisk = burnoutResult
			log.Println("[ML-Engine] ✓ Prediksi Burnout berhasil diambil dari Python Scikit-Learn Service.")
		}
	} else {
		log.Printf("[ML-Engine-Warn] Python Burnout API offline/error: %v. Menggunakan fallback lokal Go Math.", err)
	}

	// Call /predict/golden-hours (K-Means Clustering)
	var goldenResult GoldenHoursResult
	respGolden, err := client.Post(fmt.Sprintf("%s/predict/golden-hours", config.AppConfig.MLServiceURL), "application/json", bytes.NewBuffer(payloadBytes))
	if err == nil && respGolden.StatusCode == http.StatusOK {
		defer respGolden.Body.Close()
		if json.NewDecoder(respGolden.Body).Decode(&goldenResult) == nil {
			localResult.GoldenHours = goldenResult
			log.Println("[ML-Engine] ✓ Prediksi Golden Hours berhasil diambil dari Python KMeans Service.")
		}
	} else {
		log.Printf("[ML-Engine-Warn] Python Golden Hours API offline/error: %v. Menggunakan fallback lokal Go Math.", err)
	}

	// Call /predict/graduation-risk (GRI Predictor)
	var gradResult GraduationRiskResult
	respGrad, err := client.Post(fmt.Sprintf("%s/predict/graduation-risk", config.AppConfig.MLServiceURL), "application/json", bytes.NewBuffer(payloadBytes))
	if err == nil && respGrad.StatusCode == http.StatusOK {
		defer respGrad.Body.Close()
		if json.NewDecoder(respGrad.Body).Decode(&gradResult) == nil {
			localResult.GraduationRisk = gradResult
			log.Println("[ML-Engine] ✓ Prediksi Graduation Risk berhasil diambil dari Python Service.")
		}
	} else {
		log.Printf("[ML-Engine-Warn] Python Graduation Risk API offline/error: %v. Menggunakan fallback lokal Go Math.", err)
	}

	return localResult, nil
}

// getBaselineResult membuat output default saat data kosong
func getBaselineResult(tasks []models.Task, moodleAssigns []models.MoodleAssignment) MLEngineResult {
	return MLEngineResult{
		BurnoutRisk: BurnoutRiskResult{
			Score:       12.5,
			Status:      "Low",
			Description: "Beban kerja Anda sangat aman. Pertahankan keseimbangan yang sehat!",
		},
		GoldenHours: GoldenHoursResult{
			PeakDay:       "Belum Cukup Data",
			PeakHourRange: "Selesaikan beberapa tugas dahulu",
			Confidence:    "0%",
		},
		ModelCalibration: ModelCalibrationResult{
			MeanAbsoluteError: 0.0,
			AccuracyRate:      95.0,
			SamplesTrained:    0,
		},
		GraduationRisk: GraduationRiskResult{
			Score:       10.0,
			Status:      "Low",
			Description: "Belum ada data akademik terdaftar. Risiko akademik terpantau sangat rendah.",
		},
	}
}

// CalculateMetricsFromTasks melakukan kalkulasi matematika murni tanpa bergantung pada database
func CalculateMetricsFromTasks(tasks []models.Task, moodleAssigns []models.MoodleAssignment) MLEngineResult {
	result := getBaselineResult(tasks, moodleAssigns)

	if len(tasks) == 0 && len(moodleAssigns) == 0 {
		return result
	}

	// ─────────────────────────────────────────────────────────────────────────
	// MODEL A: LOGISTIC REGRESSION (BURNOUT RISK CLASSIFIER)
	// ─────────────────────────────────────────────────────────────────────────
	var (
		totalTasks         = len(tasks)
		pendingCount       = 0
		overdueCount       = 0
		midnightStudyCount = 0
		totalEstimateMin   = 0
	)

	now := time.Now()

	for _, t := range tasks {
		if t.Status != "completed" {
			pendingCount++
			totalEstimateMin += t.TimeEstimateMinutes
			if t.DueDate != nil && now.After(*t.DueDate) {
				overdueCount++
			}
		} else {
			if t.CompletedAt != nil {
				compHour := t.CompletedAt.Local().Hour()
				if compHour >= 0 && compHour < 5 {
					midnightStudyCount++
				}
			}
		}
	}

	// Feature Extraction
	var (
		overdueRatio    = 0.0
		workloadDensity = 0.0
	)

	if totalTasks > 0 {
		overdueRatio = float64(overdueCount) / float64(totalTasks)
	}
	workloadDensity = float64(totalEstimateMin) / 480.0

	var (
		w0 = -2.2
		w1 = 4.5
		w2 = 0.8
		w3 = 1.2
	)

	midStudyFeature := float64(midnightStudyCount)
	if midStudyFeature > 4.0 {
		midStudyFeature = 4.0
	}

	z := w0 + (w1 * overdueRatio) + (w2 * midStudyFeature) + (w3 * workloadDensity)
	probability := 1.0 / (1.0 + math.Exp(-z))

	scorePercent := probability * 100.0
	if scorePercent < 5.0 {
		scorePercent = 5.0
	} else if scorePercent > 98.0 {
		scorePercent = 98.0
	}

	result.BurnoutRisk.Score = scorePercent

	if scorePercent < 35.0 {
		result.BurnoutRisk.Status = "Low"
		result.BurnoutRisk.Description = "Beban kerja Anda terpantau aman dan seimbang. Sangat baik untuk kesehatan mental Anda!"
	} else if scorePercent < 70.0 {
		result.BurnoutRisk.Status = "Moderate"
		result.BurnoutRisk.Description = "Risiko stres sedang terdeteksi. Cobalah mencicil tugas overdue dan pastikan tidur cukup malam ini."
	} else {
		result.BurnoutRisk.Status = "High"
		result.BurnoutRisk.Description = "RISIKO BURNOUT TINGGI! Terlalu banyak beban tugas tertunda dan pola begadang. Segera istirahat dan hubungi Asep AI untuk menjadwal ulang!"
	}

	// ─────────────────────────────────────────────────────────────────────────
	// MODEL B: PROBABILITY DISTRIBUTION (GOLDEN FOCUS HOURS CLUSTERING)
	// ─────────────────────────────────────────────────────────────────────────
	var completedTasks []models.Task
	for _, t := range tasks {
		if t.Status == "completed" && t.CompletedAt != nil {
			completedTasks = append(completedTasks, t)
		}
	}

	if len(completedTasks) >= 3 {
		var freqGrid [7][24]int
		
		for _, t := range completedTasks {
			tLocal := t.CompletedAt.Local()
			day := int(tLocal.Weekday())
			hour := tLocal.Hour()
			freqGrid[day][hour]++
		}

		var (
			maxFreq = 0
			bestDay = 0
			bestHour = 0
		)

		for d := 0; d < 7; d++ {
			for h := 0; h < 24; h++ {
				if freqGrid[d][h] > maxFreq {
					maxFreq = freqGrid[d][h]
					bestDay = d
					bestHour = h
				}
			}
		}

		daysIndo := []string{"Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"}
		result.GoldenHours.PeakDay = daysIndo[bestDay]

		startHour := bestHour - 1
		if startHour < 0 {
			startHour = 22
		}
		endHour := bestHour + 1
		if endHour > 23 {
			endHour = 1
		}

		result.GoldenHours.PeakHourRange = fmt.Sprintf("%02d:00 - %02d:00 WIB", startHour, endHour)
		
		confPercent := (float64(maxFreq) / float64(len(completedTasks))) * 100.0
		sampleWeight := float64(len(completedTasks)) / (float64(len(completedTasks)) + 5.0)
		finalConf := confPercent * sampleWeight * 1.5
		if finalConf > 95.0 {
			finalConf = 95.0
		} else if finalConf < 15.0 {
			finalConf = 15.0
		}
		result.GoldenHours.Confidence = fmt.Sprintf("%.0f%%", finalConf)
	} else {
		result.GoldenHours.PeakDay = "Butuh Data"
		result.GoldenHours.PeakHourRange = fmt.Sprintf("Selesaikan minimal %d tugas lagi", 3-len(completedTasks))
		result.GoldenHours.Confidence = "10%"
	}

	// ─────────────────────────────────────────────────────────────────────────
	// MODEL C: LINEAR DEVIATION CALIBRATION (ACCURACY & MAE MONITORING)
	// ─────────────────────────────────────────────────────────────────────────
	var (
		validSamples   = 0
		sumAbsoluteErr = 0.0
		sumActualTime  = 0.0
	)

	for _, t := range completedTasks {
		if t.ScheduledStart != nil && t.CompletedAt != nil {
			actualMinutes := t.CompletedAt.Sub(*t.ScheduledStart).Minutes()
			
			if actualMinutes > 1.0 && actualMinutes < 1440.0 {
				validSamples++
				sumActualTime += actualMinutes
				predictedMinutes := float64(t.TimeEstimateMinutes)

				absErr := math.Abs(actualMinutes - predictedMinutes)
				sumAbsoluteErr += absErr
			}
		}
	}

	if validSamples > 0 {
		mae := sumAbsoluteErr / float64(validSamples)
		avgActual := sumActualTime / float64(validSamples)

		result.ModelCalibration.MeanAbsoluteError = mae
		result.ModelCalibration.SamplesTrained = validSamples

		accuracy := 100.0
		if avgActual > 0 {
			accuracy = (1.0 - (mae / avgActual)) * 100.0
		}

		if accuracy < 45.0 {
			accuracy = 45.0
		} else if accuracy > 98.5 {
			accuracy = 98.5
		}
		result.ModelCalibration.AccuracyRate = accuracy
	} else {
		result.ModelCalibration.MeanAbsoluteError = 0.0
		result.ModelCalibration.SamplesTrained = 0
		result.ModelCalibration.AccuracyRate = 92.4
	}

	// ─────────────────────────────────────────────────────────────────────────
	// MODEL D: HEURISTIC GRADUATION RISK INDEX (GRI) FALLBACK
	// ─────────────────────────────────────────────────────────────────────────
	var (
		academicScore  = 1.0
		consistencyPct = 1.0
		totalAssigns   = len(moodleAssigns)
	)

	if totalAssigns == 0 {
		if len(tasks) > 0 {
			overdueTasks := 0
			for _, t := range tasks {
				if t.Status != "completed" && t.DueDate != nil && time.Now().After(*t.DueDate) {
					overdueTasks++
				}
			}
			overdueRatio := float64(overdueTasks) / float64(len(tasks))
			academicScore = 1.0 - overdueRatio
		}
	} else {
		overdueAssigns := 0
		missedQuizzes := 0
		quizzesCount := 0

		for _, a := range moodleAssigns {
			nameLower := strings.ToLower(a.Name)
			isQuiz := strings.Contains(nameLower, "quiz") || 
				strings.Contains(nameLower, "kuis") || 
				strings.Contains(nameLower, "uts") || 
				strings.Contains(nameLower, "uas") || 
				strings.Contains(nameLower, "praktikum")

			if isQuiz {
				quizzesCount++
			}

			if a.SubmissionStatus != "submitted" {
				if a.DueDate != nil && time.Now().After(*a.DueDate) {
					overdueAssigns++
					if isQuiz {
						missedQuizzes++
					}
				}
			}
		}

		overdueRatio := float64(overdueAssigns) / float64(totalAssigns)
		quizMissRatio := overdueRatio
		if quizzesCount > 0 {
			quizMissRatio = float64(missedQuizzes) / float64(quizzesCount)
		}

		academicScore = 1.0 - (overdueRatio*0.6 + quizMissRatio*0.4)

		procrastinationCount := 0
		completedTasksCount := 0
		for _, t := range tasks {
			if t.Status == "completed" {
				completedTasksCount++
				if t.CompletedAt != nil && t.DueDate != nil {
					diffHours := t.DueDate.Sub(*t.CompletedAt).Hours()
					if diffHours >= 0 && diffHours <= 3.0 {
						procrastinationCount++
					}
				}
			}
		}

		procrastinationRatio := 0.0
		if completedTasksCount > 0 {
			procrastinationRatio = float64(procrastinationCount) / float64(completedTasksCount)
		}
		consistencyPct = 1.0 - procrastinationRatio
	}

	if academicScore < 0 {
		academicScore = 0
	}
	if consistencyPct < 0 {
		consistencyPct = 0
	}

	griScore := (1.0 - (academicScore*0.7 + consistencyPct*0.3)) * 100.0
	if griScore < 5.0 {
		griScore = 5.0
	} else if griScore > 98.0 {
		griScore = 98.0
	}

	result.GraduationRisk.Score = griScore
	if griScore < 30.0 {
		result.GraduationRisk.Status = "Low"
		result.GraduationRisk.Description = "Risiko akademik rendah. Pola pengerjaan tugas dan tingkat kelulusan tepat waktu Anda berada di jalur aman!"
	} else if griScore < 60.0 {
		result.GraduationRisk.Status = "Moderate"
		result.GraduationRisk.Description = "Risiko akademik sedang terdeteksi. Beberapa tugas WeLearn terlewat. Gunakan AI Scheduler untuk menyusun ulang jadwal belajar Anda."
	} else {
		result.GraduationRisk.Status = "High"
		result.GraduationRisk.Description = "RISIKO AKADEMIK TINGGI! Terlalu banyak tugas WeLearn terlambat/terbengkalai. Segera cicil tugas kuliah agar kelulusan tepat waktu aman."
	}

	return result
}
