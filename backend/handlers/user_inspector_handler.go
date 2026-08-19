package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
	"github.com/motion/backend/services"
)

type AdminReasonRequest struct {
	Reason string `json:"reason"`
}

type UserOverrideRequest struct {
	Reason                string `json:"reason"`
	Name                  string `json:"name,omitempty"`
	Plan                  string `json:"plan,omitempty"`
	Role                  string `json:"role,omitempty"`
	RequirePasswordChange *bool  `json:"requirePasswordChange,omitempty"`
	IsSuspended           *bool  `json:"isSuspended,omitempty"`
}

// GET /api/v1/admin/users/:id/inspect — Live 360° User Inspector
func InspectUser360(c echo.Context) error {
	idStr := c.Param("id")
	targetUUID, err := uuid.Parse(idStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "ID user tidak valid")
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", targetUUID).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "User tidak ditemukan")
	}

	// 1. Fetch active and past user sessions
	var sessions []models.UserSession
	config.DB.Where("user_id = ?", targetUUID).Order("last_active_at desc").Limit(20).Find(&sessions)

	// 2. Inspect API keys
	keyStatus, _ := services.InspectUserAPIKeys(idStr)

	// 3. Task Stats
	var totalTasks, completedTasks, pendingTasks int64
	config.DB.Model(&models.Task{}).Where("user_id = ?", targetUUID).Count(&totalTasks)
	config.DB.Model(&models.Task{}).Where("user_id = ? AND status = 'completed'", targetUUID).Count(&completedTasks)
	config.DB.Model(&models.Task{}).Where("user_id = ? AND status = 'pending'", targetUUID).Count(&pendingTasks)

	// 4. Integrations Status
	var siakCount, moodleCount, calendarCount int64
	config.DB.Model(&models.SiakAccount{}).Where("user_id = ?", targetUUID).Count(&siakCount)
	config.DB.Model(&models.MoodleConnection{}).Where("user_id = ?", targetUUID).Count(&moodleCount)
	config.DB.Model(&models.CalendarConnection{}).Where("user_id = ?", targetUUID).Count(&calendarCount)

	// 5. User usage details
	var userUsage models.UserUsage
	_ = config.DB.Where("user_id = ?", targetUUID).First(&userUsage)

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"user": user,
		"sessions": sessions,
		"apiKeys": keyStatus,
		"stats": map[string]interface{}{
			"totalTasks":     totalTasks,
			"completedTasks": completedTasks,
			"pendingTasks":   pendingTasks,
		},
		"integrations": map[string]bool{
			"siakConnected":     siakCount > 0,
			"moodleConnected":   moodleCount > 0,
			"calendarConnected": calendarCount > 0,
		},
		"usage": userUsage,
	})
}

type TimelineItem struct {
	Timestamp time.Time `json:"timestamp"`
	Category  string    `json:"category"`
	Action    string    `json:"action"`
	Actor     string    `json:"actor"`
	Details   string    `json:"details"`
	IPAddress string    `json:"ipAddress,omitempty"`
}

// GET /api/v1/admin/users/:id/timeline — Paginated activity timeline
func GetUserTimeline(c echo.Context) error {
	idStr := c.Param("id")
	targetUUID, err := uuid.Parse(idStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "ID user tidak valid")
	}

	var timeline []TimelineItem

	// 1. Audit Logs for user
	var auditLogs []models.AuditLog
	config.DB.Where("user_id = ?", idStr).Order("created_at desc").Limit(50).Find(&auditLogs)
	for _, l := range auditLogs {
		timeline = append(timeline, TimelineItem{
			Timestamp: l.CreatedAt,
			Category:  l.Category,
			Action:    l.Action,
			Actor:     "Pengguna",
			Details:   l.Details,
			IPAddress: l.IPAddress,
		})
	}

	// 2. Admin audit logs targeting user
	var adminLogs []models.AdminAuditLog
	config.DB.Preload("Admin").Where("target_user_id = ?", targetUUID).Order("created_at desc").Limit(50).Find(&adminLogs)
	for _, al := range adminLogs {
		adminName := "Admin"
		if al.Admin != nil && al.Admin.Name != "" {
			adminName = "Admin (" + al.Admin.Name + ")"
		}
		timeline = append(timeline, TimelineItem{
			Timestamp: al.CreatedAt,
			Category:  "admin_action",
			Action:    al.Action,
			Actor:     adminName,
			Details:   "Alasan: " + al.Reason,
			IPAddress: al.IPAddress,
		})
	}

	// Sort timeline descending
	sort.Slice(timeline, func(i, j int) bool {
		return timeline[i].Timestamp.After(timeline[j].Timestamp)
	})

	limit := 50
	if len(timeline) < limit {
		limit = len(timeline)
	}

	return utils.JSONSuccess(c, http.StatusOK, timeline[:limit])
}

// POST /api/v1/admin/users/:id/sessions/:sessionId/evict — Evict single device session
func EvictUserSession(c echo.Context) error {
	idStr := c.Param("id")
	sessionIDStr := c.Param("sessionId")

	targetUUID, err := uuid.Parse(idStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "ID user tidak valid")
	}

	sessionUUID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "ID sesi tidak valid")
	}

	req := new(AdminReasonRequest)
	if err := c.Bind(req); err != nil || len(req.Reason) < 10 {
		return utils.JSONError(c, http.StatusBadRequest, "Alasan pemutusan sesi wajib diisi minimal 10 karakter")
	}

	var session models.UserSession
	if err := config.DB.Where("id = ? AND user_id = ?", sessionUUID, targetUUID).First(&session).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "Sesi tidak ditemukan")
	}

	now := time.Now()
	session.RevokedAt = &now
	if err := config.DB.Save(&session).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mencabut sesi perangkat")
	}

	// Record admin audit log
	adminIDVal := c.Get("userId")
	adminUUID, _ := uuid.Parse(fmt.Sprint(adminIDVal))

	auditLog := models.AdminAuditLog{
		AdminID:      adminUUID,
		TargetUserID: targetUUID,
		Action:       "EVICT_DEVICE_SESSION",
		Reason:       req.Reason,
		BeforeState:  fmt.Sprintf("ACTIVE_SESSION_ID_%s_DEVICE_%s", session.ID, session.DeviceInfo),
		AfterState:   fmt.Sprintf("REVOKED_AT_%s", now.Format(time.RFC3339)),
		IPAddress:    c.RealIP(),
	}
	_ = config.DB.Create(&auditLog)

	return utils.JSONSuccess(c, http.StatusOK, map[string]string{
		"message": "Sesi perangkat berhasil dicabut dan tidak dapat mengakses kembali.",
	})
}

// POST /api/v1/admin/users/:id/evict-all-sessions — Bulk evict all sessions for user
func EvictAllUserSessions(c echo.Context) error {
	idStr := c.Param("id")
	targetUUID, err := uuid.Parse(idStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "ID user tidak valid")
	}

	req := new(AdminReasonRequest)
	if err := c.Bind(req); err != nil || len(req.Reason) < 10 {
		return utils.JSONError(c, http.StatusBadRequest, "Alasan pemutusan massal wajib diisi minimal 10 karakter")
	}

	now := time.Now()
	if err := config.DB.Model(&models.UserSession{}).
		Where("user_id = ? AND revoked_at IS NULL", targetUUID).
		Update("revoked_at", now).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal memutus seluruh sesi user")
	}

	adminIDVal := c.Get("userId")
	adminUUID, _ := uuid.Parse(fmt.Sprint(adminIDVal))

	auditLog := models.AdminAuditLog{
		AdminID:      adminUUID,
		TargetUserID: targetUUID,
		Action:       "EVICT_ALL_USER_SESSIONS",
		Reason:       req.Reason,
		BeforeState:  "ALL_ACTIVE_SESSIONS",
		AfterState:   fmt.Sprintf("MASS_REVOKED_AT_%s", now.Format(time.RFC3339)),
		IPAddress:    c.RealIP(),
	}
	_ = config.DB.Create(&auditLog)

	return utils.JSONSuccess(c, http.StatusOK, map[string]string{
		"message": "Seluruh sesi perangkat pengguna berhasil dicabut secara massal.",
	})
}

// PUT /api/v1/admin/users/:id/override-data — Admin data override with audit log
func OverrideUserDataAdmin(c echo.Context) error {
	idStr := c.Param("id")
	targetUUID, err := uuid.Parse(idStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "ID user tidak valid")
	}

	req := new(UserOverrideRequest)
	if err := c.Bind(req); err != nil || len(req.Reason) < 10 {
		return utils.JSONError(c, http.StatusBadRequest, "Alasan override data wajib diisi minimal 10 karakter")
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", targetUUID).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "User tidak ditemukan")
	}

	beforeJSON, _ := json.Marshal(user)

	updates := make(map[string]interface{})
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Plan == "free" || req.Plan == "pro" {
		updates["plan"] = req.Plan
		if req.Plan == "pro" {
			exp := time.Now().AddDate(1, 0, 0)
			updates["subscription_expires_at"] = &exp
		} else {
			updates["subscription_expires_at"] = nil
		}
	}
	if req.Role == "user" || req.Role == "admin" {
		updates["role"] = req.Role
	}
	if req.RequirePasswordChange != nil {
		updates["require_password_change"] = *req.RequirePasswordChange
	}
	if req.IsSuspended != nil {
		if *req.IsSuspended {
			suspendTime := time.Now().AddDate(100, 0, 0)
			updates["locked_until"] = suspendTime
		} else {
			updates["locked_until"] = nil
			updates["failed_login_attempts"] = 0
		}
	}

	if len(updates) == 0 {
		return utils.JSONError(c, http.StatusBadRequest, "Tidak ada data yang diubah")
	}

	if err := config.DB.Model(&user).Updates(updates).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal memperbarui data user")
	}

	// Fetch updated user
	var updatedUser models.User
	config.DB.First(&updatedUser, "id = ?", targetUUID)
	afterJSON, _ := json.Marshal(updatedUser)

	adminIDVal := c.Get("userId")
	adminUUID, _ := uuid.Parse(fmt.Sprint(adminIDVal))

	auditLog := models.AdminAuditLog{
		AdminID:      adminUUID,
		TargetUserID: targetUUID,
		Action:       "ADMIN_USER_OVERRIDE_DATA",
		Reason:       req.Reason,
		BeforeState:  string(beforeJSON),
		AfterState:   string(afterJSON),
		IPAddress:    c.RealIP(),
	}
	_ = config.DB.Create(&auditLog)

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"message": "Data pengguna berhasil diperbarui oleh Admin.",
		"user":    updatedUser,
	})
}

// POST /api/v1/admin/users/:id/api-keys/:provider/reveal — Audited key reveal
func RevealUserAPIKeyAdmin(c echo.Context) error {
	idStr := c.Param("id")
	provider := c.Param("provider")

	req := new(AdminReasonRequest)
	if err := c.Bind(req); err != nil || len(req.Reason) < 10 {
		return utils.JSONError(c, http.StatusBadRequest, "Alasan pengungkapan API Key wajib diisi minimal 10 karakter")
	}

	adminIDVal := c.Get("userId")
	adminIDStr := fmt.Sprint(adminIDVal)

	revealedKey, err := services.RevealUserAPIKey(adminIDStr, idStr, provider, req.Reason, c.RealIP())
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, err.Error())
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"provider": provider,
		"key":      revealedKey,
		"message":  "API Key berhasil diungkapkan. Tindakan ini telah dicatat secara permanen di Admin Audit Log.",
	})
}

// GET /api/v1/admin/admin-audit-logs — Returns admin accountability audit logs
func GetAdminAuditLogs(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var total int64
	config.DB.Model(&models.AdminAuditLog{}).Count(&total)

	var logs []models.AdminAuditLog
	if err := config.DB.Preload("Admin").Preload("TargetUser").
		Order("created_at desc").
		Limit(limit).Offset(offset).
		Find(&logs).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil log audit admin")
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"logs":  logs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GET /api/v1/admin/command-center/overview — Real-time threat radar & master control overview
func GetMasterCommandCenterOverview(c echo.Context) error {
	var totalUsers, activeSessionsCount, suspendedUsersCount int64

	config.DB.Model(&models.User{}).Count(&totalUsers)
	config.DB.Model(&models.UserSession{}).Where("revoked_at IS NULL").Count(&activeSessionsCount)
	config.DB.Model(&models.User{}).Where("locked_until > ?", time.Now().AddDate(0, 0, 30)).Count(&suspendedUsersCount)

	// Fetch 10 recent admin audit logs
	var recentAdminLogs []models.AdminAuditLog
	config.DB.Preload("Admin").Preload("TargetUser").Order("created_at desc").Limit(10).Find(&recentAdminLogs)

	// Fetch 10 recent security audit logs
	var recentSecurityLogs []models.AuditLog
	config.DB.Where("category = 'security' OR action ILIKE '%FAILED%' OR action ILIKE '%EVICT%'").
		Order("created_at desc").Limit(10).Find(&recentSecurityLogs)

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"threatRadar": map[string]interface{}{
			"totalUsers":          totalUsers,
			"activeSessions":      activeSessionsCount,
			"suspendedUsers":      suspendedUsersCount,
			"securityThreats24h":  len(recentSecurityLogs),
		},
		"recentAdminAudit":  recentAdminLogs,
		"recentSecurityLogs": recentSecurityLogs,
	})
}
