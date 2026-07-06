package handlers

import (
	"fmt"
	"net"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
)

type SystemHealth struct {
	GoAPI      string `json:"go_api"`
	PostgreSQL string `json:"postgresql"`
	MLService  string `json:"ml_service"`
	Redis      string `json:"redis"`
	Mailpit    string `json:"mailpit"`
}

type UserGrowthItem struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

type AdminStatsResponse struct {
	TotalUsers     int64            `json:"totalUsers"`
	TotalTasks     int64            `json:"totalTasks"`
	CompletedTasks int64            `json:"completedTasks"`
	PendingTasks   int64            `json:"pendingTasks"`
	ActiveUsers24h int64            `json:"activeUsers24h"`
	SystemHealth   SystemHealth     `json:"systemHealth"`
	UserGrowth     []UserGrowthItem `json:"userGrowth"`
	RecentUsers    []models.User    `json:"recentUsers"`
}

type ActivityItem struct {
	Timestamp time.Time `json:"timestamp"`
	User      string    `json:"user"`
	Action    string    `json:"action"`
	Category  string    `json:"category"` // 'user', 'task', 'moodle', 'calendar', 'excuse'
	Details   string    `json:"details"`
}

// pingTCP checks if a port is open on a host
func pingTCP(host string, port string) bool {
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, port), 1*time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// GetAdminStats returns general statistics for the admin dashboard
func GetAdminStats(c echo.Context) error {
	var totalUsers int64
	var totalTasks int64
	var completedTasks int64
	var pendingTasks int64
	var activeUsers24h int64

	// Counts
	config.DB.Model(&models.User{}).Count(&totalUsers)
	config.DB.Model(&models.Task{}).Count(&totalTasks)
	config.DB.Model(&models.Task{}).Where("status = 'completed'").Count(&completedTasks)
	config.DB.Model(&models.Task{}).Where("status = 'pending'").Count(&pendingTasks)

	// Active users in last 24 hours (updated_at inside last 24h)
	config.DB.Model(&models.User{}).Where("updated_at > ?", time.Now().Add(-24*time.Hour)).Count(&activeUsers24h)

	// Health Checks
	postgresqlHealth := "healthy"
	sqlDB, err := config.DB.DB()
	if err != nil || sqlDB.Ping() != nil {
		postgresqlHealth = "unhealthy"
	}

	mlHealth := "unhealthy"
	// Parse host and port from MLServiceURL
	// e.g. "http://localhost:8000" or "http://ml-service-python:8000"
	mlHost := "localhost"
	mlPort := "8000"
	if config.AppConfig.ServerEnv == "production" {
		mlHost = "ml-service-python"
	}
	if pingTCP(mlHost, mlPort) {
		mlHealth = "healthy"
	}

	redisHealth := "unhealthy"
	redisHost := "localhost"
	if config.AppConfig.ServerEnv == "production" {
		redisHost = "redis-queue"
	}
	if pingTCP(redisHost, "6379") {
		redisHealth = "healthy"
	}

	mailpitHealth := "unhealthy"
	mailpitHost := "localhost"
	if config.AppConfig.ServerEnv == "production" {
		mailpitHost = "mailpit"
	}
	if pingTCP(mailpitHost, "1025") {
		mailpitHealth = "healthy"
	}

	sysHealth := SystemHealth{
		GoAPI:      "healthy",
		PostgreSQL: postgresqlHealth,
		MLService:  mlHealth,
		Redis:      redisHealth,
		Mailpit:    mailpitHealth,
	}

	// User Growth (Registrations in last 7 days) - Dioptimalkan dengan single GROUP BY query
	var growthData []UserGrowthItem
	sevenDaysAgo := time.Now().AddDate(0, 0, -6)
	startOfPeriod := time.Date(sevenDaysAgo.Year(), sevenDaysAgo.Month(), sevenDaysAgo.Day(), 0, 0, 0, 0, time.Local)

	var results []struct {
		Date  time.Time `gorm:"column:date"`
		Count int64     `gorm:"column:count"`
	}

	config.DB.Model(&models.User{}).
		Select("DATE(created_at) as date, COUNT(*) as count").
		Where("created_at >= ?", startOfPeriod).
		Group("DATE(created_at)").
		Scan(&results)

	countsMap := make(map[string]int64)
	for _, r := range results {
		// Ubah format date ke timezone lokal untuk pemetaan yang akurat
		dateStr := r.Date.Format("02 Jan")
		countsMap[dateStr] = r.Count
	}

	for i := 6; i >= 0; i-- {
		d := time.Now().AddDate(0, 0, -i)
		dateStr := d.Format("02 Jan")
		growthData = append(growthData, UserGrowthItem{
			Date:  dateStr,
			Count: countsMap[dateStr],
		})
	}

	// Recent users (Last 5 registered)
	var recentUsers []models.User
	config.DB.Order("created_at desc").Limit(5).Find(&recentUsers)

	return utils.JSONSuccess(c, http.StatusOK, AdminStatsResponse{
		TotalUsers:     totalUsers,
		TotalTasks:     totalTasks,
		CompletedTasks: completedTasks,
		PendingTasks:   pendingTasks,
		ActiveUsers24h: activeUsers24h,
		SystemHealth:   sysHealth,
		UserGrowth:     growthData,
		RecentUsers:    recentUsers,
	})
}

// GetAdminUsers returns a paginated list of all users
func GetAdminUsers(c echo.Context) error {
	search := c.QueryParam("search")
	role := c.QueryParam("role")
	plan := c.QueryParam("plan")
	status := c.QueryParam("status")
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var users []models.User
	var total int64

	query := config.DB.Model(&models.User{})
	if search != "" {
		query = query.Where("name ILIKE ? OR email ILIKE ?", "%"+search+"%", "%"+search+"%")
	}
	if role != "" {
		query = query.Where("role = ?", role)
	}
	if plan != "" {
		query = query.Where("plan = ?", plan)
	}
	if status == "suspended" {
		query = query.Where("locked_until > ?", time.Now().AddDate(0, 0, 30))
	} else if status == "active" {
		query = query.Where("locked_until IS NULL OR locked_until <= ?", time.Now().AddDate(0, 0, 30))
	}

	if err := query.Count(&total).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal menghitung data user")
	}

	if err := query.Order("created_at desc").Limit(limit).Offset(offset).Find(&users).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil data user")
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"users": users,
		"pagination": map[string]interface{}{
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

// GetAdminUser returns details and stats for a single user
func GetAdminUser(c echo.Context) error {
	idStr := c.Param("id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "ID user tidak valid")
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "User tidak ditemukan")
	}

	// Hitung stats pribadi
	var totalTasks int64
	var completedTasks int64
	config.DB.Model(&models.Task{}).Where("user_id = ?", userID).Count(&totalTasks)
	config.DB.Model(&models.Task{}).Where("user_id = ? AND status = 'completed'", userID).Count(&completedTasks)

	var moodleConnected bool
	var moodleConnCount int64
	config.DB.Model(&models.MoodleConnection{}).Where("user_id = ?", userID).Count(&moodleConnCount)
	moodleConnected = moodleConnCount > 0

	var calendarConnected bool
	var calendarConnCount int64
	config.DB.Model(&models.CalendarConnection{}).Where("user_id = ?", userID).Count(&calendarConnCount)
	calendarConnected = calendarConnCount > 0

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"user": user,
		"stats": map[string]interface{}{
			"totalTasks":        totalTasks,
			"completedTasks":    completedTasks,
			"moodleConnected":   moodleConnected,
			"calendarConnected": calendarConnected,
		},
	})
}

type UpdateRoleRequest struct {
	Role string `json:"role"`
}

// UpdateUserRole updates the role of a user
func UpdateUserRole(c echo.Context) error {
	idStr := c.Param("id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "ID user tidak valid")
	}

	req := new(UpdateRoleRequest)
	if err := c.Bind(req); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Request body tidak valid")
	}

	if req.Role != "user" && req.Role != "admin" {
		return utils.JSONError(c, http.StatusBadRequest, "Role hanya bisa 'user' atau 'admin'")
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "User tidak ditemukan")
	}

	// Cegah lockout diri sendiri
	myEmailVal := c.Get("email")
	if user.Email == myEmailVal && req.Role != "admin" {
		return utils.JSONError(c, http.StatusBadRequest, "Anda tidak dapat mengubah role Anda sendiri")
	}

	if err := config.DB.Model(&user).Update("role", req.Role).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengubah role user")
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"message": "Role user berhasil diperbarui",
		"user":    user,
	})
}

// AdminDeleteUser deletes a user and all related data
func AdminDeleteUser(c echo.Context) error {
	idStr := c.Param("id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "ID user tidak valid")
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "User tidak ditemukan")
	}

	// Cegah menghapus diri sendiri
	myEmailVal := c.Get("email")
	if user.Email == myEmailVal {
		return utils.JSONError(c, http.StatusBadRequest, "Anda tidak dapat menghapus akun Anda sendiri")
	}

	// Delete related data first
	config.DB.Where("user_id = ?", userID).Delete(&models.Task{})
	config.DB.Where("user_id = ?", userID).Delete(&models.MoodleConnection{})
	config.DB.Where("user_id = ?", userID).Delete(&models.CalendarConnection{})
	config.DB.Where("user_id = ?", userID).Delete(&models.ChatHistory{})
	config.DB.Where("user_id = ?", userID).Delete(&models.MoodleExcuseLetter{})

	if err := config.DB.Delete(&user).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal menghapus user")
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]string{
		"message": "User berhasil dihapus secara aman beserta seluruh datanya",
	})
}

// GetSystemActivity generates a consolidated log of system activities from DB tables
func GetSystemActivity(c echo.Context) error {
	var activities []ActivityItem

	// 1. Fetch recent users registered
	var users []models.User
	config.DB.Order("created_at desc").Limit(15).Find(&users)
	for _, u := range users {
		activities = append(activities, ActivityItem{
			Timestamp: u.CreatedAt,
			User:      u.Name,
			Action:    "Registrasi Pengguna",
			Category:  "user",
			Details:   fmt.Sprintf("Pengguna %s (%s) terdaftar dengan sukses.", u.Name, u.Email),
		})
	}

	// 2. Fetch recent tasks created/completed WITH user preloaded
	var tasks []models.Task
	config.DB.Preload("User").Order("updated_at desc").Limit(20).Find(&tasks)
	for _, t := range tasks {
		ownerName := t.User.Name
		if ownerName == "" {
			ownerName = "Unknown User"
		}

		action := "Pembuatan Misi"
		details := fmt.Sprintf("Misi '%s' berhasil dibuat.", t.Title)
		if t.Status == "completed" {
			action = "Penyelesaian Misi"
			details = fmt.Sprintf("Misi '%s' telah ditandai selesai.", t.Title)
		}

		activities = append(activities, ActivityItem{
			Timestamp: t.UpdatedAt,
			User:      ownerName,
			Action:    action,
			Category:  "task",
			Details:   details,
		})
	}

	// 3. Fetch recent moodle excuse letters WITH user preloaded
	var letters []models.MoodleExcuseLetter
	config.DB.Preload("User").Order("created_at desc").Limit(10).Find(&letters)
	for _, l := range letters {
		ownerName := l.User.Name
		if ownerName == "" {
			ownerName = "Unknown User"
		}

		activities = append(activities, ActivityItem{
			Timestamp: l.CreatedAt,
			User:      ownerName,
			Action:    "Surat Izin Praktikum",
			Category:  "moodle",
			Details:   fmt.Sprintf("Surat izin berhasil dibuat untuk mata kuliah %s.", l.CourseName),
		})
	}

	// 4. Fetch recent calendar connections WITH user preloaded
	var calendarConns []models.CalendarConnection
	config.DB.Preload("User").Order("created_at desc").Limit(10).Find(&calendarConns)
	for _, cc := range calendarConns {
		ownerName := cc.User.Name
		if ownerName == "" {
			ownerName = "Unknown User"
		}

		activities = append(activities, ActivityItem{
			Timestamp: cc.CreatedAt,
			User:      ownerName,
			Action:    "Koneksi Kalender",
			Category:  "calendar",
			Details:   fmt.Sprintf("Menghubungkan kalender %s (%s).", cc.CalendarType, cc.CalendarName),
		})
	}

	// Sort consolidated activities by Timestamp Descending
	sort.Slice(activities, func(i, j int) bool {
		return activities[i].Timestamp.After(activities[j].Timestamp)
	})

	// Slice top 30 activities
	limit := 30
	if len(activities) < limit {
		limit = len(activities)
	}
	result := activities[:limit]

	return utils.JSONSuccess(c, http.StatusOK, result)
}

// ToggleSuspendUser suspends or unsuspends a user
func ToggleSuspendUser(c echo.Context) error {
	idStr := c.Param("id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "ID user tidak valid")
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "User tidak ditemukan")
	}

	// Prevent self-suspension
	myEmailVal := c.Get("email")
	if user.Email == myEmailVal {
		return utils.JSONError(c, http.StatusBadRequest, "Anda tidak dapat menonaktifkan akun Anda sendiri")
	}

	var message string
	if user.IsSuspended() {
		// Unsuspend: clear LockedUntil and reset failed login attempts
		if err := config.DB.Model(&user).Updates(map[string]interface{}{
			"locked_until":           nil,
			"failed_login_attempts": 0,
		}).Error; err != nil {
			return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengaktifkan kembali user")
		}
		message = "Akun user berhasil diaktifkan kembali"
	} else {
		// Suspend: set LockedUntil to 100 years in the future
		suspendTime := time.Now().AddDate(100, 0, 0)
		if err := config.DB.Model(&user).Update("locked_until", suspendTime).Error; err != nil {
			return utils.JSONError(c, http.StatusInternalServerError, "Gagal menonaktifkan user")
		}
		message = "Akun user berhasil dinonaktifkan"
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"message": message,
		"user":    user,
	})
}

type UpdatePlanRequest struct {
	Plan string `json:"plan"`
}

// AdminUpdatePlan updates the subscription plan of a user
func AdminUpdatePlan(c echo.Context) error {
	idStr := c.Param("id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "ID user tidak valid")
	}

	req := new(UpdatePlanRequest)
	if err := c.Bind(req); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Request body tidak valid")
	}

	if req.Plan != "free" && req.Plan != "pro" {
		return utils.JSONError(c, http.StatusBadRequest, "Plan hanya bisa 'free' atau 'pro'")
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "User tidak ditemukan")
	}

	// Update plan and expires at
	var expiresAt *time.Time
	if req.Plan == "pro" {
		exp := time.Now().AddDate(1, 0, 0) // Pro lasts 1 year
		expiresAt = &exp
	} else {
		expiresAt = nil // Free doesn't expire
	}

	updates := map[string]interface{}{
		"plan":                     req.Plan,
		"subscription_expires_at": expiresAt,
	}

	if err := config.DB.Model(&user).Updates(updates).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal memperbarui plan user")
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"message": fmt.Sprintf("Plan user berhasil diperbarui menjadi %s", req.Plan),
		"user":    user,
	})
}

// AdminForcePasswordReset forces a user to reset their password on next login
func AdminForcePasswordReset(c echo.Context) error {
	idStr := c.Param("id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "ID user tidak valid")
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "User tidak ditemukan")
	}

	if err := config.DB.Model(&user).Update("require_password_change", true).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal memaksa setel ulang kata sandi")
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"message": "User berhasil dipaksa untuk mengatur ulang kata sandi pada login berikutnya",
		"user":    user,
	})
}

// GetAuditLogs returns paginated audit logs for admin view
// GET /api/v1/admin/audit-logs?page=1&limit=50&action=LOGIN&category=auth&userId=xxx
func GetAuditLogs(c echo.Context) error {
	// Pagination
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 || limit > 200 {
		limit = 50
	}
	offset := (page - 1) * limit

	// Filters
	action := c.QueryParam("action")
	category := c.QueryParam("category")
	filterUserID := c.QueryParam("userId")
	status := c.QueryParam("status")

	query := config.DB.Model(&models.AuditLog{})
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if filterUserID != "" {
		query = query.Where("user_id = ?", filterUserID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var logs []models.AuditLog
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil audit logs")
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"data": logs,
		"meta": map[string]interface{}{
			"total":  total,
			"page":   page,
			"limit":  limit,
			"pages":  (total + int64(limit) - 1) / int64(limit),
		},
	})
}

