package handlers

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
	"github.com/motion/backend/services"
)

type AutoScheduleInput struct {
	TaskID string `json:"taskId"`
}

type UpdatePreferencesInput struct {
	WorkHoursStart         *int    `json:"workHoursStart"`
	WorkHoursEnd           *int    `json:"workHoursEnd"`
	BreakDurationMinutes   *int    `json:"breakDurationMinutes"`
	AllowWeekendScheduling *bool   `json:"allowWeekendScheduling"`
	PreferredTaskTime      string  `json:"preferredTaskTime"`
}

// AutoScheduleTask memicu ulang penjadwalan otomatis AI untuk tugas tertentu secara manual
func AutoScheduleTask(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Otorisasi gagal")
	}

	input := new(AutoScheduleInput)
	if err := c.Bind(input); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Bodi permintaan tidak valid")
	}

	taskID, err := uuid.Parse(input.TaskID)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Format ID tugas tidak valid")
	}

	// Cari tugas terkait
	var task models.Task
	if err := config.DB.Where("id = ? AND user_id = ?", taskID, userID).First(&task).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "Tugas tidak ditemukan")
	}

	// Jalankan penjadwalan AI
	if err := services.InstanceSchedulingEngine.ScheduleTask(c.Request().Context(), &task); err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal menjalankan penjadwalan otomatis AI: "+err.Error())
	}

	return utils.JSONSuccess(c, http.StatusOK, task)
}

// GetPreferences mengambil preferensi jam kerja pengguna saat ini
func GetPreferences(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Otorisasi gagal")
	}

	pref, err := services.InstanceSchedulingEngine.GetOrCreatePreferences(userID)
	if err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil preferensi: "+err.Error())
	}

	return utils.JSONSuccess(c, http.StatusOK, pref)
}

// UpdatePreferences memperbarui pengaturan jam kerja dan alokasi AI pengguna
func UpdatePreferences(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Otorisasi gagal")
	}

	input := new(UpdatePreferencesInput)
	if err := c.Bind(input); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Bodi permintaan tidak valid")
	}

	pref, err := services.InstanceSchedulingEngine.GetOrCreatePreferences(userID)
	if err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal memuat preferensi: "+err.Error())
	}

	// Perbarui nilai jika dikirimkan di dalam request
	if input.WorkHoursStart != nil {
		pref.WorkHoursStart = *input.WorkHoursStart
	}
	if input.WorkHoursEnd != nil {
		pref.WorkHoursEnd = *input.WorkHoursEnd
	}
	if input.BreakDurationMinutes != nil {
		pref.BreakDurationMinutes = *input.BreakDurationMinutes
	}
	if input.AllowWeekendScheduling != nil {
		pref.AllowWeekendScheduling = *input.AllowWeekendScheduling
	}
	if input.PreferredTaskTime != "" {
		pref.PreferredTaskTime = input.PreferredTaskTime
	}

	if err := config.DB.Save(pref).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal menyimpan preferensi: "+err.Error())
	}

	return utils.JSONSuccess(c, http.StatusOK, pref)
}

// TriggerAllSchedule memicu ulang AI scheduler untuk SEMUA tugas pending milik user.
// Digunakan oleh MCP Server (Hermes Agent) via endpoint internal /api/internal/scheduling/trigger-all.
// Berbeda dengan AutoScheduleTask yang bekerja per-task, handler ini batch semua tugas sekaligus.
func TriggerAllSchedule(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Otorisasi gagal")
	}

	// Ambil semua tugas pending milik user
	var tasks []models.Task
	if err := config.DB.Where("user_id = ? AND status = 'pending'", userID).Find(&tasks).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil daftar tugas")
	}

	if len(tasks) == 0 {
		return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
			"message":       "Tidak ada tugas pending yang perlu dijadwalkan",
			"scheduledCount": 0,
			"totalTasks":    0,
		})
	}

	// Jadwalkan semua task secara batch
	successCount := 0
	for i := range tasks {
		if err := services.InstanceSchedulingEngine.ScheduleTask(c.Request().Context(), &tasks[i]); err != nil {
			// Log tapi lanjutkan ke task berikutnya
			_ = err // error per-task sudah di-log di dalam ScheduleTask
		} else {
			successCount++
		}
	}

	// Broadcast WebSocket agar frontend update real-time
	services.WSHub.Broadcast(userID.String(), []byte(`{"type":"TASK_UPDATED"}`))

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"message":        "AI auto-schedule selesai",
		"scheduledCount": successCount,
		"totalTasks":     len(tasks),
	})
}

type ScheduleStudyBlockInput struct {
	TaskID    string `json:"taskId"`
	StartTime string `json:"startTime"` // ISO 8601
	EndTime   string `json:"endTime"`   // ISO 8601
}

func ScheduleStudyBlock(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Otorisasi gagal")
	}

	input := new(ScheduleStudyBlockInput)
	if err := c.Bind(input); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Bodi permintaan tidak valid")
	}

	taskID, err := uuid.Parse(input.TaskID)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Format ID tugas tidak valid")
	}

	start, err := time.Parse(time.RFC3339, input.StartTime)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Format waktu mulai tidak valid (harus ISO 8601)")
	}

	end, err := time.Parse(time.RFC3339, input.EndTime)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Format waktu akhir tidak valid (harus ISO 8601)")
	}

	var task models.Task
	if err := config.DB.Where("id = ? AND user_id = ?", taskID, userID).First(&task).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "Tugas tidak ditemukan")
	}

	task.ScheduledStart = &start
	task.ScheduledEnd = &end

	if err := config.DB.Save(&task).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal menjadwalkan tugas: "+err.Error())
	}

	// Broadcast update
	services.WSHub.Broadcast(userID.String(), []byte(`{"type":"TASK_UPDATED"}`))

	return utils.JSONSuccess(c, http.StatusOK, task)
}

type CompleteTaskViaAIInput struct {
	TaskID string `json:"taskId"`
}

func CompleteTaskViaAI(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Otorisasi gagal")
	}

	input := new(CompleteTaskViaAIInput)
	if err := c.Bind(input); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Bodi permintaan tidak valid")
	}

	taskID, err := uuid.Parse(input.TaskID)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Format ID tugas tidak valid")
	}

	var task models.Task
	if err := config.DB.Where("id = ? AND user_id = ?", taskID, userID).First(&task).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "Tugas tidak ditemukan")
	}

	now := time.Now()
	task.Status = "completed"
	task.CompletedAt = &now

	if err := config.DB.Save(&task).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal menandai tugas selesai: "+err.Error())
	}

	// Broadcast update
	services.WSHub.Broadcast(userID.String(), []byte(`{"type":"TASK_UPDATED"}`))

	return utils.JSONSuccess(c, http.StatusOK, task)
}
