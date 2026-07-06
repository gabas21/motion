package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
	"github.com/motion/backend/services"
)

type ConnectCalendarInput struct {
	CalendarType string `json:"calendarType"`
	AuthCode     string `json:"authCode"`
}

// ConnectCalendar connects an external calendar (or sandbox mock)
func ConnectCalendar(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	input := new(ConnectCalendarInput)
	if err := c.Bind(input); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Invalid request body")
	}

	if input.CalendarType == "" {
		return utils.JSONError(c, http.StatusBadRequest, "Calendar type is required")
	}

	// Fetch user plan
	var user models.User
	if err := config.DB.Select("plan").First(&user, "id = ?", userID).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "Pengguna tidak ditemukan")
	}

	// Count existing calendar connections for this user
	var connectionCount int64
	config.DB.Model(&models.CalendarConnection{}).Where("user_id = ? AND is_active = true", userID).Count(&connectionCount)

	maxAllowed := 1
	if user.Plan == "pro" {
		maxAllowed = 5
	}

	if int(connectionCount) >= maxAllowed {
		return utils.JSONError(c, http.StatusForbidden, fmt.Sprintf("Batas maksimal koneksi kalender Anda sudah tercapai. Batas Anda: %d koneksi.", maxAllowed))
	}

	conn, err := services.InstanceCalendarService.ConnectCalendar(c.Request().Context(), userID, input.CalendarType, input.AuthCode)
	if err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Failed to connect calendar: "+err.Error())
	}

	// Broadcast pembaruan kalender secara real-time via WebSocket
	services.WSHub.Broadcast(userID.String(), []byte(`{"type":"CALENDAR_SYNCED"}`))

	return utils.JSONSuccess(c, http.StatusCreated, conn)
}

// GetCalendarEvents fetches synced calendar events for user
func GetCalendarEvents(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	startStr := c.QueryParam("start_date")
	endStr := c.QueryParam("end_date")

	var start, end time.Time
	var err error

	if startStr != "" {
		start, err = time.Parse(time.RFC3339, startStr)
		if err != nil {
			start, err = time.Parse("2006-01-02", startStr)
		}
	} else {
		// Default to 7 days ago
		start = time.Now().AddDate(0, 0, -7)
	}

	if endStr != "" {
		end, err = time.Parse(time.RFC3339, endStr)
		if err != nil {
			end, err = time.Parse("2006-01-02", endStr)
		}
	} else {
		// Default to 14 days ahead
		end = time.Now().AddDate(0, 0, 14)
	}

	ctx, cancel := config.QueryCtx()
	defer cancel()

	events, err := services.InstanceCalendarService.GetCalendarEvents(ctx, userID, start, end)
	if err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Failed to retrieve calendar events: "+err.Error())
	}

	return utils.JSONSuccess(c, http.StatusOK, events)
}

// SyncCalendar triggers manual sync of calendar events
func SyncCalendar(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	connections, err := services.InstanceCalendarService.GetConnections(c.Request().Context(), userID)
	if err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Failed to list connections")
	}

	syncedTotal := 0
	for i := range connections {
		count, err := services.InstanceCalendarService.SyncCalendarEvents(c.Request().Context(), &connections[i])
		if err == nil {
			syncedTotal += count
		}
	}

	// Broadcast pembaruan kalender secara real-time via WebSocket
	services.WSHub.Broadcast(userID.String(), []byte(`{"type":"CALENDAR_SYNCED"}`))

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"message":      "Calendars synchronized successfully",
		"syncedEvents": syncedTotal,
	})
}

// GetConnections retrieves connected calendars
func GetConnections(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	connections, err := services.InstanceCalendarService.GetConnections(c.Request().Context(), userID)
	if err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Failed to list connections")
	}

	return utils.JSONSuccess(c, http.StatusOK, connections)
}

// DisconnectConnection disconnects an active calendar
func DisconnectConnection(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	connIDStr := c.Param("id")
	connID, err := uuid.Parse(connIDStr)
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Invalid connection ID format")
	}

	err = services.InstanceCalendarService.DisconnectCalendar(c.Request().Context(), userID, connID)
	if err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Failed to disconnect: "+err.Error())
	}

	// Broadcast pembaruan kalender secara real-time via WebSocket
	services.WSHub.Broadcast(userID.String(), []byte(`{"type":"CALENDAR_SYNCED"}`))

	return utils.JSONSuccess(c, http.StatusOK, map[string]string{
		"message": "Calendar disconnected successfully",
	})
}
