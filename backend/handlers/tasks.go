package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/logger"
	"github.com/motion/backend/pkg/utils"
	"github.com/motion/backend/pkg/validator"
	"github.com/motion/backend/services"
	"gorm.io/gorm"
)

type TaskInput struct {
	Title               string     `json:"title" validate:"required,min=1,max=255"`
	Description         string     `json:"description" validate:"max=5000"`
	TimeEstimateMinutes int        `json:"timeEstimateMinutes" validate:"min=0,max=480"`
	DueDate             *time.Time `json:"dueDate"`
	Priority            int        `json:"priority" validate:"min=1,max=5"`
	Category            string     `json:"category" validate:"required,oneof=personal work education general education_reminder"`
}

// CreateTask handles creating a new task
// @Summary Create a new task
// @Description Create a new task for the authenticated user
// @Tags tasks
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param task body TaskInput true "Task Input Data"
// @Success 201 {object} models.Task
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /tasks [post]
func CreateTask(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	input := new(TaskInput)
	if err := c.Bind(input); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Invalid request body")
	}

	// Terapkan validasi input terstruktur
	if errs := validator.Validate(input); len(errs) > 0 {
		return c.JSON(http.StatusBadRequest, map[string]any{
			"error":   "Validasi gagal",
			"details": errs,
		})
	}

	// Enforce task quota for free plan (excluding education_reminder)
	if input.Category != "education_reminder" {
		var userPlan struct{ Plan string }
		// Optimasi GORM query: select field 'plan' saja
		if err := config.DB.Model(&models.User{}).Select("plan").Where("id = ?", userID).Scan(&userPlan).Error; err == nil {
			if userPlan.Plan == "" || userPlan.Plan == "free" {
				now := time.Now()
				startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
				var taskCount int64
				config.DB.Model(&models.Task{}).
					Where("user_id = ? AND created_at >= ? AND category != 'education_reminder'", userID, startOfMonth).
					Count(&taskCount)
				if taskCount >= 5 {
					return utils.JSONError(c, http.StatusForbidden, "Kuota tugas bulanan Anda sudah habis (5/5). Upgrade ke Pro untuk tugas tanpa batas!")
				}
			}
		}
	}

	if input.TimeEstimateMinutes <= 0 {
		input.TimeEstimateMinutes = 30 // fallback default
	}

	task := models.Task{
		UserID:              userID,
		Title:               input.Title,
		Description:         input.Description,
		TimeEstimateMinutes: input.TimeEstimateMinutes,
		DueDate:             input.DueDate,
		Priority:            input.Priority,
		Category:            input.Category,
		Status:              "pending",
	}

	if err := config.DB.Create(&task).Error; err != nil {
		logger.Error("Failed to create task in DB", err, "userId", userID)
		return utils.JSONError(c, http.StatusInternalServerError, "Failed to create task")
	}

	// Picu Algoritma Penjadwalan AI Otomatis
	if err := services.InstanceSchedulingEngine.ScheduleTask(c.Request().Context(), &task); err != nil {
		logger.Error("Peringatan: Penjadwalan otomatis AI gagal untuk tugas", err, "taskId", task.ID.String())
	}

	// Invalidate analytics cache
	services.InvalidateUserCache(userID)

	// Broadcast pembaruan tugas secara real-time via WebSocket
	services.WSHub.Broadcast(userID.String(), []byte(`{"type":"TASK_UPDATED"}`))

	return utils.JSONSuccess(c, http.StatusCreated, task)
}

// GetTasks fetches tasks for the logged-in user with optional filtering and pagination
// @Summary Get tasks list
// @Description Get tasks for the authenticated user with optional filtering and pagination
// @Tags tasks
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param status query string false "Filter by status" Enums(pending, in_progress, completed, cancelled)
// @Param category query string false "Filter by category"
// @Param page query int false "Page number (default 1)"
// @Param limit query int false "Items per page (default 50, max 100)"
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /tasks [get]
func GetTasks(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	status := c.QueryParam("status")
	category := c.QueryParam("category")

	// Pagination — default: page=1, limit=50, max limit=100
	page := 1
	limit := 50
	if p := c.QueryParam("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if l := c.QueryParam("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			if v > 100 {
				v = 100
			}
			limit = v
		}
	}
	offset := (page - 1) * limit

	query := config.DB.Where("user_id = ?", userID)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if category != "" {
		query = query.Where("category = ?", category)
	} else {
		// Sembunyikan tugas pengingat WeLearn dari daftar utama agar tidak menumpuk
		query = query.Where("category != 'education_reminder'")
	}

	ctx, cancel := config.QueryCtx()
	defer cancel()

	// Hitung total data untuk info pagination di frontend
	var total int64
	query.Session(&gorm.Session{}).WithContext(ctx).Count(&total)

	// Ambil data dengan limit dan offset
	var tasks []models.Task
	if err := query.WithContext(ctx).Order("priority desc, due_date asc").
		Limit(limit).Offset(offset).
		Find(&tasks).Error; err != nil {
		logger.Error("Failed to fetch tasks from DB", err, "userId", userID)
		return utils.JSONError(c, http.StatusInternalServerError, "Failed to fetch tasks")
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"tasks": tasks,
		"pagination": map[string]interface{}{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"totalPages": (int(total) + limit - 1) / limit,
		},
	})
}

// GetTask fetches a single task by ID
func GetTask(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	taskIDStr := c.Param("id")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Invalid task ID format")
	}

	var task models.Task
	if err := config.DB.Where("id = ? AND user_id = ?", taskID, userID).First(&task).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "Task not found")
	}

	return utils.JSONSuccess(c, http.StatusOK, task)
}

// UpdateTask updates an existing task
func UpdateTask(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	taskIDStr := c.Param("id")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Invalid task ID format")
	}

	input := new(TaskInput)
	if err := c.Bind(input); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Invalid request body")
	}

	var task models.Task
	if err := config.DB.Where("id = ? AND user_id = ?", taskID, userID).First(&task).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "Task not found")
	}

	// Update fields if provided
	if input.Title != "" {
		task.Title = input.Title
	}
	task.Description = input.Description
	if input.TimeEstimateMinutes > 0 {
		task.TimeEstimateMinutes = input.TimeEstimateMinutes
	}
	if input.Priority >= 1 && input.Priority <= 5 {
		task.Priority = input.Priority
	}
	if input.Category != "" {
		task.Category = input.Category
	}
	if input.DueDate != nil {
		task.DueDate = input.DueDate
	}

	if err := config.DB.Save(&task).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Failed to update task")
	}

	// Invalidate analytics cache
	services.InvalidateUserCache(userID)

	// Broadcast pembaruan tugas secara real-time via WebSocket
	services.WSHub.Broadcast(userID.String(), []byte(`{"type":"TASK_UPDATED"}`))

	return utils.JSONSuccess(c, http.StatusOK, task)
}

// CompleteTask marks a task as completed
func CompleteTask(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	taskIDStr := c.Param("id")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Invalid task ID format")
	}

	var task models.Task
	if err := config.DB.Where("id = ? AND user_id = ?", taskID, userID).First(&task).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "Task not found")
	}

	now := time.Now()
	task.Status = "completed"
	task.CompletedAt = &now

	if err := config.DB.Save(&task).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Failed to complete task")
	}

	// Invalidate analytics cache
	services.InvalidateUserCache(userID)

	// Broadcast pembaruan tugas secara real-time via WebSocket
	services.WSHub.Broadcast(userID.String(), []byte(`{"type":"TASK_UPDATED"}`))

	return utils.JSONSuccess(c, http.StatusOK, task)
}

// DeleteTask soft-deletes a task
func DeleteTask(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	taskIDStr := c.Param("id")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Invalid task ID format")
	}

	if err := config.DB.Where("id = ? AND user_id = ?", taskID, userID).Delete(&models.Task{}).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Failed to delete task")
	}

	// Invalidate analytics cache
	services.InvalidateUserCache(userID)

	// Broadcast pembaruan tugas secara real-time via WebSocket
	services.WSHub.Broadcast(userID.String(), []byte(`{"type":"TASK_UPDATED"}`))

	return c.NoContent(http.StatusNoContent)
}
