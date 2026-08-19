package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
	"github.com/motion/backend/services"
	"gorm.io/gorm"
)

type AIChatRequest struct {
	Message     string              `json:"message"`
	History     []map[string]string `json:"history"`
	Personality string              `json:"personality"`   // "bestie" | "academic" | "productive"
	ImageBase64 string              `json:"image_base64"`  // Opsional: gambar soal di-encode base64
	InstantMode bool                `json:"instant_mode"`  // true jika user aktif di Mode Jawaban Instan
}

type MLRouteResponse struct {
	Intent     string          `json:"intent"`
	Confidence float64         `json:"confidence"`
	Entities   MLRouteEntities `json:"entities"`
}

type MLRouteEntities struct {
	Date     string `json:"date"`
	TaskName string `json:"task_name"`
}

func routeIntentLocal(message string) (*MLRouteResponse, error) {
	client := &http.Client{Timeout: 2 * time.Second}
	
	payload := map[string]string{"text": message}
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	targetURL := fmt.Sprintf("%s/agent/route", config.AppConfig.MLServiceURL)
	resp, err := client.Post(targetURL, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ML service returned status %d", resp.StatusCode)
	}

	var routeResp MLRouteResponse
	if err := json.NewDecoder(resp.Body).Decode(&routeResp); err != nil {
		return nil, err
	}

	return &routeResp, nil
}

// HandleAIChat menangani permintaan percakapan dengan Asep AI dari web Next.js
func HandleAIChat(c echo.Context) error {
	// Ambil userID dari JWT context middleware
	userID, err := utils.GetUserID(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	var req AIChatRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid json payload"})
	}

	if req.Message == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "message is required"})
	}

	// Enforce daily chat quota limit (10 chats/day for free users)
	today := time.Now().Format("2006-01-02")
	var usage models.UserUsage
	result := config.DB.Where("user_id = ?", userID).First(&usage)
	if result.Error != nil {
		// Create new row
		usage = models.UserUsage{UserID: userID, DailyChatCount: 0, LastChatDate: today}
		config.DB.Create(&usage)
	}

	// Reset if it is a new day
	if usage.LastChatDate != today {
		config.DB.Model(&usage).Updates(map[string]interface{}{
			"daily_chat_count": 0,
			"last_chat_date":   today,
		})
		usage.DailyChatCount = 0
	}

	// Fetch user plan and role
	var user models.User
	config.DB.First(&user, "id = ?", userID)

	if (user.Plan == "" || user.Plan == "free") && usage.DailyChatCount >= 10 {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"reply":          "Kuota obrolan harian Anda sudah habis (10/10). Upgrade ke **Paket Pro** untuk obrolan AI tanpa batas! 🚀",
			"quota_exceeded": true,
		})
	}

	// Klasifikasikan intent menggunakan model ML lokal di Python terlebih dahulu jika tidak ada gambar
	if req.ImageBase64 == "" {
		routeResp, routeErr := routeIntentLocal(req.Message)
		if routeErr == nil && routeResp != nil {
			log.Printf("[Asep-Router] User %s, Intent: %s, Confidence: %.2f", userID.String(), routeResp.Intent, routeResp.Confidence)

			// Heuristic safety check to bypass false positive routing of academic / tutoring queries
			lowerMsg := strings.ToLower(req.Message)
			isAcademicQuery := len(req.Message) > 100 ||
				strings.Contains(lowerMsg, "bantu") ||
				strings.Contains(lowerMsg, "jelaskan") ||
				strings.Contains(lowerMsg, "jelasin") ||
				strings.Contains(lowerMsg, "bagaimana") ||
				strings.Contains(lowerMsg, "cara") ||
				strings.Contains(lowerMsg, "mengerjakan") ||
				strings.Contains(lowerMsg, "jawaban") ||
				strings.Contains(lowerMsg, "tutor") ||
				strings.Contains(lowerMsg, "solusi") ||
				strings.Contains(lowerMsg, "pahami") ||
				strings.Contains(lowerMsg, "memahami") ||
				strings.Contains(lowerMsg, "materi")

			if isAcademicQuery {
				routeResp.Intent = "general_chat"
			}

			switch routeResp.Intent {
			case "sync_welearn":
				var conn models.MoodleConnection
				err := config.DB.Where("user_id = ? AND is_connected = true", userID).First(&conn).Error
				if err != nil {
					reply := "Akun WeLearn Anda belum terhubung. Silakan hubungkan akun WeLearn Anda terlebih dahulu melalui menu pengaturan WeLearn di aplikasi sebelum melakukan sinkronisasi."
					return c.JSON(http.StatusOK, map[string]string{
						"reply": reply,
					})
				}

				// Jalankan sinkronisasi WeLearn di background
				go func() {
					if err := services.SyncViaREST(config.DB, &conn, nil); err != nil {
						log.Printf("[Asep-Router-Err] Gagal melakukan background sync WeLearn: %v", err)
					} else {
						log.Printf("[Asep-Router] Background sync WeLearn sukses untuk user %s", userID.String())
					}
				}()

				reply := "Baik! Saya telah memicu sinkronisasi tugas WeLearn Anda di latar belakang. Proses ini membutuhkan waktu beberapa saat untuk memperbarui semua tugas Anda secara real-time. Silakan periksa kembali daftar tugas Anda sebentar lagi. 🔄"
				return c.JSON(http.StatusOK, map[string]string{
					"reply": reply,
				})

			case "schedule_event":
				// Enforce task quota check for free plan
				if user.Plan == "" || user.Plan == "free" {
					now := time.Now()
					startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
					var taskCount int64
					config.DB.Model(&models.Task{}).
						Where("user_id = ? AND created_at >= ? AND category != 'education_reminder'", userID, startOfMonth).
						Count(&taskCount)
					if taskCount >= 5 {
						reply := "Maaf, saya tidak dapat menjadwalkan tugas ini secara otomatis karena **kuota tugas bulanan Anda sudah habis (5/5)**. Silakan upgrade ke **Paket Pro** untuk menjadwalkan tugas tanpa batas! 🚀"
						return c.JSON(http.StatusOK, map[string]string{
							"reply": reply,
						})
					}
				}

				taskName := routeResp.Entities.TaskName
				if taskName == "" {
					taskName = "Tugas Baru"
				}
				
				dateStr := routeResp.Entities.Date
				var dueDate *time.Time
				if dateStr != "" {
					if parsedTime, err := time.Parse("2006-01-02", dateStr); err == nil {
						dueDate = &parsedTime
					}
				}
				if dueDate == nil {
					tomorrow := time.Now().AddDate(0, 0, 1)
					dueDate = &tomorrow
				}

				task := models.Task{
					UserID:              userID,
					Title:               taskName,
					Description:         "Dijadwalkan otomatis melalui asisten virtual Asep AI",
					TimeEstimateMinutes: 60, // default 60 menit
					DueDate:             dueDate,
					Priority:            3, // Medium
					Category:            "general",
					Status:              "pending",
				}

				if err := config.DB.Create(&task).Error; err != nil {
					log.Printf("[Asep-Router-Err] Gagal membuat tugas otomatis: %v", err)
					break // fallback ke LLM
				}

				// Picu algoritma penjadwalan AI otomatis
				if err := services.InstanceSchedulingEngine.ScheduleTask(c.Request().Context(), &task); err != nil {
					log.Printf("[Asep-Router-Warn] Penjadwalan otomatis AI gagal untuk tugas %s: %v", task.ID.String(), err)
				}

				// Broadcast pembaruan tugas secara real-time via WebSocket
				if services.WSHub != nil {
					services.WSHub.Broadcast(userID.String(), []byte(`{"type":"TASK_UPDATED"}`))
				}

				formattedDate := dueDate.Format("02 January 2006")
				monthsEn := []string{"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"}
				monthsId := []string{"Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"}
				for i, m := range monthsEn {
					formattedDate = strings.Replace(formattedDate, m, monthsId[i], -1)
				}

				reply := fmt.Sprintf("Sukses! Saya telah menjadwalkan agenda **%s** pada tanggal **%s** ke dalam kalender Anda. 📅✨", task.Title, formattedDate)
				return c.JSON(http.StatusOK, map[string]string{
					"reply": reply,
				})

			case "check_deadline":
				var tasks []models.Task
				var moodleAssigns []models.MoodleAssignment
				
				if err := config.DB.Where("user_id = ? AND status != 'completed'", userID).
					Order("due_date asc").Limit(5).Find(&tasks).Error; err != nil {
					log.Printf("[Asep-Router-Warn] Gagal mengambil tugas untuk deadline: %v", err)
				}

				if err := config.DB.Where("user_id = ? AND submission_status != 'submitted'", userID).
					Order("due_date asc").Limit(5).Find(&moodleAssigns).Error; err != nil {
					log.Printf("[Asep-Router-Warn] Gagal mengambil moodle assignments untuk deadline: %v", err)
				}

				var responseBuilder strings.Builder
				responseBuilder.WriteString("Berikut adalah daftar tugas terdekat yang perlu Anda perhatikan:\n\n")

				hasDeadlines := false
				formatIndoDate := func(t *time.Time) string {
					if t == nil {
						return "Tidak ada deadline"
					}
					formatted := t.Format("02 January 2006 15:04 WIB")
					monthsEn := []string{"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"}
					monthsId := []string{"Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"}
					for i, m := range monthsEn {
						formatted = strings.Replace(formatted, m, monthsId[i], -1)
					}
					return formatted
				}

				if len(tasks) > 0 {
					responseBuilder.WriteString("📌 **Tugas Mandiri:**\n")
					for _, t := range tasks {
						responseBuilder.WriteString(fmt.Sprintf("- **%s** (Tenggat: %s)\n", t.Title, formatIndoDate(t.DueDate)))
						hasDeadlines = true
					}
					responseBuilder.WriteString("\n")
				}

				if len(moodleAssigns) > 0 {
					responseBuilder.WriteString("🎓 **Tugas WeLearn (Moodle):**\n")
					for _, a := range moodleAssigns {
						responseBuilder.WriteString(fmt.Sprintf("- **[%s] %s** (Tenggat: %s)\n", a.CourseName, a.Name, formatIndoDate(a.DueDate)))
						hasDeadlines = true
					}
				}

				if !hasDeadlines {
					responseBuilder.Reset()
					responseBuilder.WriteString("Luar biasa! Anda tidak memiliki tugas atau kuis yang tertunda saat ini. Semua kewajiban akademik Anda sudah bersih! Keep it up! 🌟")
				}

				return c.JSON(http.StatusOK, map[string]string{
					"reply": responseBuilder.String(),
				})
			}
		} else if routeErr != nil {
			log.Printf("[Asep-Router-Warn] Gagal memanggil ML Service Router: %v. Menggunakan fallback ke chat umum.", routeErr)
		}
	}

	// ── LLM Execution Path ───────────────────────────────────────────
	// Check BYOK requirement before calling AskAsep & before incrementing chat count
	enforceBYOK := config.AppConfig.EnforceBYOKForNonAdmin && !user.IsPrivileged()
	if enforceBYOK {
		summary, _ := services.GetUserAIConfigSummary(userID.String())
		if summary == nil || !summary.HasCustomKey {
			return c.JSON(http.StatusOK, map[string]interface{}{
				"reply":            "Untuk menggunakan Asisten AI ASEP, silakan daftarkan API Key Anda sendiri (Gemini / Groq / OpenRouter) di Pengaturan Profil. Penggunaan API Key default sistem hanya diperuntukkan bagi akun Admin.",
				"requires_api_key": true,
				"reason":           "no_key_registered",
			})
		}
	}

	// Increment daily chat count ONLY when proceeding to LLM execution
	config.DB.Model(&usage).UpdateColumn("daily_chat_count", gorm.Expr("daily_chat_count + 1"))

	// Panggil core AI service dengan context injection
	input := services.AIChatInput{
		UserID:      userID.String(),
		Message:     req.Message,
		History:     req.History,
		Personality: req.Personality,
		ImageBase64: req.ImageBase64,
		InstantMode: req.InstantMode,
	}

	reply, err := services.AskAsep(input)
	if err != nil {
		errMsg := err.Error()

		if strings.Contains(errMsg, "no_key_registered") {
			return c.JSON(http.StatusOK, map[string]interface{}{
				"reply":            "Untuk menggunakan Asisten AI ASEP, silakan daftarkan API Key Anda sendiri (Gemini / Groq / OpenRouter) di Pengaturan Profil. Penggunaan API Key default sistem hanya diperuntukkan bagi akun Admin.",
				"requires_api_key": true,
				"reason":           "no_key_registered",
			})
		}

		if strings.Contains(errMsg, "key_invalid_or_quota") || strings.Contains(strings.ToLower(errMsg), "401") || strings.Contains(strings.ToLower(errMsg), "invalid api key") {
			return c.JSON(http.StatusOK, map[string]interface{}{
				"reply":            "API Key Anda tidak dapat digunakan saat ini (kemungkinan kuota habis atau key kedaluwarsa). Silakan periksa kembali di Pengaturan Profil.",
				"requires_api_key": true,
				"reason":           "key_invalid_or_quota",
			})
		}

		// Jika error mengandung indikator rate limit atau gangguan model AI, kembalikan HTTP 503 Service Unavailable
		if strings.Contains(strings.ToLower(errMsg), "rate-limit") || 
			strings.Contains(strings.ToLower(errMsg), "terganggu") || 
			strings.Contains(strings.ToLower(errMsg), "sibuk") || 
			strings.Contains(strings.ToLower(errMsg), "busy") || 
			strings.Contains(strings.ToLower(errMsg), "429") {
			return c.JSON(http.StatusServiceUnavailable, map[string]interface{}{
				"error":            errMsg,
				"requires_api_key": false,
				"reason":           "provider_error",
			})
		}

		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"error":            "failed to communicate with AI server: " + errMsg,
			"requires_api_key": false,
			"reason":           "provider_error",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"reply": reply,
	})
}

func HandleAIHealth(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"groq_key_configured":        config.AppConfig.GroqAPIKey != "",
		"gemini_key_configured":      config.AppConfig.GeminiAPIKey != "",
		"openrouter_key_configured":  config.AppConfig.OpenRouterAPIKey != "",
		"circuit_breaker_status":     services.GetProviderStatus(),
		"groq_model":                 config.AppConfig.GroqModel,
		"gemini_model":               config.AppConfig.GeminiModel,
	})
}

func HandleResetProvider(c echo.Context) error {
	provider := c.Param("name")
	services.ResetProviderCircuitBreaker(provider)
	return c.JSON(http.StatusOK, map[string]string{
		"message": "Circuit breaker direset: " + provider,
	})
}

type GenerateDocxRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

// HandleGenerateDocxDirect proxies direct DOCX generation calls to the Python ML Service
func HandleGenerateDocxDirect(c echo.Context) error {
	var req GenerateDocxRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid json payload"})
	}

	if req.Title == "" || req.Content == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "title and content are required"})
	}

	payloadBytes, err := json.Marshal(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to marshal request"})
	}

	client := &http.Client{Timeout: 30 * time.Second}
	targetURL := fmt.Sprintf("%s/documents/generate-docx", config.AppConfig.MLServiceURL)
	resp, err := client.Post(targetURL, "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil {
		log.Printf("[HandleGenerateDocxDirect-Error] Python generator offline/error: %v", err)
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "ML service is offline or unreachable"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		log.Printf("[HandleGenerateDocxDirect-Error] Python returned error code %d: %s", resp.StatusCode, string(respBytes))
		return c.JSON(resp.StatusCode, map[string]string{"error": "ML service returned error: " + string(respBytes)})
	}

	c.Response().Header().Set(echo.HeaderContentType, resp.Header.Get(echo.HeaderContentType))
	c.Response().Header().Set(echo.HeaderContentDisposition, resp.Header.Get(echo.HeaderContentDisposition))
	c.Response().WriteHeader(http.StatusOK)

	_, err = io.Copy(c.Response().Writer, resp.Body)
	return err
}


