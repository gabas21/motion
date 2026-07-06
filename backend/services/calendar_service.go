package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
)

type CalendarService struct{}

var InstanceCalendarService = &CalendarService{}

type GoogleTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

type GoogleCalendarResponse struct {
	Items []GoogleCalendarEventItem `json:"items"`
}

type GoogleCalendarEventItem struct {
	ID          string `json:"id"`
	Summary     string `json:"summary"`
	Description string `json:"description"`
	Start       struct {
		DateTime string `json:"dateTime"`
		Date     string `json:"date"`
	} `json:"start"`
	End struct {
		DateTime string `json:"dateTime"`
		Date     string `json:"date"`
	} `json:"end"`
	Transparency string `json:"transparency"` // if set to "transparent", it is "Free", else "Busy"
}

// ConnectCalendar connects an external calendar (or seeds a sandbox mock)
func (s *CalendarService) ConnectCalendar(ctx context.Context, userID uuid.UUID, calendarType string, authCode string) (*models.CalendarConnection, error) {
	// If credentials aren't set in config or code is sandbox mock, treat as a Sandbox Mock Calendar
	isMock := calendarType == "mock" || authCode == "sandbox-mock-code" || strings.HasPrefix(authCode, "mock_") || config.AppConfig.GoogleClientID == "" || config.AppConfig.GoogleClientID == "your_google_client_id"

	var conn models.CalendarConnection
	conn.UserID = userID
	conn.IsActive = true
	conn.IsPrimary = true

	if isMock {
		conn.CalendarType = "mock"
		conn.CalendarID = "sandbox-mock-primary"
		conn.CalendarName = "Sandbox Mock Calendar"
		conn.AccessToken = "mock-access-token-" + uuid.New().String()
		conn.RefreshToken = "mock-refresh-token-" + uuid.New().String()
		conn.TokenExpiresAt = time.Now().Add(365 * 24 * time.Hour)
	} else {
		// Real Google Calendar token exchange
		tokenResp, err := exchangeGoogleCode(authCode)
		if err != nil {
			log.Printf("Google OAuth exchange failed: %v, falling back to Mock Sandbox", err)
			// Fallback to mock for seamless local development
			conn.CalendarType = "mock"
			conn.CalendarID = "sandbox-mock-fallback"
			conn.CalendarName = "Sandbox Mock (Google Fallback)"
			conn.AccessToken = "mock-access-token-" + uuid.New().String()
			conn.RefreshToken = "mock-refresh-token-" + uuid.New().String()
			conn.TokenExpiresAt = time.Now().Add(365 * 24 * time.Hour)
		} else {
			conn.CalendarType = "google"
			conn.CalendarID = "google-primary"
			conn.CalendarName = "Google Calendar (" + getGoogleUserEmail(tokenResp.AccessToken) + ")"
			conn.AccessToken = tokenResp.AccessToken
			conn.RefreshToken = tokenResp.RefreshToken
			conn.TokenExpiresAt = time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
		}
	}

	// Save connection in DB (deleting any existing of same type first to prevent GORM duplicate unique key error)
	var existing models.CalendarConnection
	if err := config.DB.Where("user_id = ? AND calendar_type = ?", userID.String(), conn.CalendarType).First(&existing).Error; err == nil {
		config.DB.Unscoped().Delete(&existing)
	}

	if err := config.DB.Create(&conn).Error; err != nil {
		return nil, err
	}

	// Trigger initial sync
	_, err := s.SyncCalendarEvents(ctx, &conn)
	if err != nil {
		log.Printf("Warning: initial sync failed: %v", err)
	}

	return &conn, nil
}

// SyncCalendarEvents fetches calendar events and saves them to local cache
func (s *CalendarService) SyncCalendarEvents(ctx context.Context, connection *models.CalendarConnection) (int, error) {
	// First, clean up previous events connected to this source to avoid duplicates
	config.DB.Where("user_id = ? AND calendar_source = ?", connection.UserID.String(), connection.CalendarType).Unscoped().Delete(&models.CalendarEvent{})

	var events []models.CalendarEvent
	now := time.Now()

	if connection.CalendarType == "mock" {
		// Populate rich sandbox mock events for current week dynamically
		events = generateMockEvents(connection.UserID, now)
	} else {
		// Sync real Google Calendar
		googleEvents, err := fetchGoogleEvents(connection.AccessToken)
		if err != nil {
			return 0, err
		}

		for _, item := range googleEvents {
			var start, end time.Time
			var err1, err2 error

			if item.Start.DateTime != "" {
				start, err1 = time.Parse(time.RFC3339, item.Start.DateTime)
			} else {
				start, err1 = time.Parse("2006-01-02", item.Start.Date)
			}

			if item.End.DateTime != "" {
				end, err2 = time.Parse(time.RFC3339, item.End.DateTime)
			} else {
				end, err2 = time.Parse("2006-01-02", item.End.Date)
			}

			if err1 != nil || err2 != nil {
				continue // Skip malformed dates
			}

			isBusy := item.Transparency != "transparent"

			events = append(events, models.CalendarEvent{
				UserID:          connection.UserID,
				ExternalEventID: item.ID,
				Title:           item.Summary,
				Description:     item.Description,
				StartTime:       start,
				EndTime:         end,
				CalendarSource:  "google",
				IsBusy:          isBusy,
			})
		}
	}

	// Save all synced events to DB
	syncedCount := 0
	for _, ev := range events {
		if err := config.DB.Create(&ev).Error; err == nil {
			syncedCount++
		}
	}

	// Update connection LastSyncedAt
	nowTime := time.Now()
	connection.LastSyncedAt = &nowTime
	config.DB.Save(connection)

	return syncedCount, nil
}

// GetCalendarEvents retrieves synced events for a user in a specific time range
func (s *CalendarService) GetCalendarEvents(ctx context.Context, userID uuid.UUID, start time.Time, end time.Time) ([]models.CalendarEvent, error) {
	var events []models.CalendarEvent
	err := config.DB.WithContext(ctx).Where("user_id = ? AND start_time >= ? AND end_time <= ?", userID.String(), start, end).Order("start_time asc").Find(&events).Error
	return events, err
}

// GetConnections retrieves connected calendars for a user
func (s *CalendarService) GetConnections(ctx context.Context, userID uuid.UUID) ([]models.CalendarConnection, error) {
	var connections []models.CalendarConnection
	err := config.DB.WithContext(ctx).Where("user_id = ?", userID.String()).Find(&connections).Error
	return connections, err
}

// DisconnectCalendar deletes a calendar connection and removes all its synced events
func (s *CalendarService) DisconnectCalendar(ctx context.Context, userID uuid.UUID, connectionID uuid.UUID) error {
	var conn models.CalendarConnection
	if err := config.DB.WithContext(ctx).Where("id = ? AND user_id = ?", connectionID.String(), userID.String()).First(&conn).Error; err != nil {
		return errors.New("connection not found")
	}

	// Delete synced events
	config.DB.WithContext(ctx).Where("user_id = ? AND calendar_source = ?", userID.String(), conn.CalendarType).Unscoped().Delete(&models.CalendarEvent{})

	// Delete connection
	return config.DB.WithContext(ctx).Unscoped().Delete(&conn).Error
}

// Helper: Exchange Authorization Code for Google Tokens
func exchangeGoogleCode(code string) (*GoogleTokenResponse, error) {
	tokenURL := "https://oauth2.googleapis.com/token"
	data := url.Values{}
	data.Set("code", code)
	data.Set("client_id", config.AppConfig.GoogleClientID)
	data.Set("client_secret", config.AppConfig.GoogleClientSecret)
	data.Set("redirect_uri", config.AppConfig.FrontendURL+"/auth/oauth-callback")
	data.Set("grant_type", "authorization_code")

	resp, err := http.PostForm(tokenURL, data)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("google oauth token response status %d: %s", resp.StatusCode, string(body))
	}

	var tokenResp GoogleTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, err
	}

	return &tokenResp, nil
}

// Helper: Get user email from google access token
func getGoogleUserEmail(accessToken string) string {
	resp, err := http.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + accessToken)
	if err != nil {
		return "user@gmail.com"
	}
	defer resp.Body.Close()

	var profile struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&profile); err == nil && profile.Email != "" {
		return profile.Email
	}

	return "user@gmail.com"
}

// Helper: Fetch Google calendar events
func fetchGoogleEvents(accessToken string) ([]GoogleCalendarEventItem, error) {
	timeMin := time.Now().Add(-7 * 24 * time.Hour).Format(time.RFC3339)
	timeMax := time.Now().Add(14 * 24 * time.Hour).Format(time.RFC3339)
	url := fmt.Sprintf("https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=%s&timeMax=%s&singleEvents=true&orderBy=startTime&access_token=%s",
		url.QueryEscape(timeMin),
		url.QueryEscape(timeMax),
		accessToken,
	)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google fetch status code %d", resp.StatusCode)
	}

	var calResp GoogleCalendarResponse
	if err := json.NewDecoder(resp.Body).Decode(&calResp); err != nil {
		return nil, err
	}

	return calResp.Items, nil
}

// Helper: Generate typical mock events dynamically relative to the current week
func generateMockEvents(userID uuid.UUID, now time.Time) []models.CalendarEvent {
	// Find Monday of current week
	weekday := int(now.Weekday())
	if weekday == 0 { // Sunday
		weekday = 7
	}
	monday := now.AddDate(0, 0, -weekday+1)

	var list []models.CalendarEvent

	// Mock Standups: Everyday Mon-Fri from 09:30 AM to 10:00 AM
	for d := 0; d < 5; d++ {
		day := monday.AddDate(0, 0, d)
		list = append(list, models.CalendarEvent{
			UserID:          userID,
			ExternalEventID: fmt.Sprintf("mock-standup-%d", d),
			Title:           "Daily Standup Meeting ☕",
			Description:     "Quick morning status sync with team. Review blocker issues.",
			StartTime:       time.Date(day.Year(), day.Month(), day.Day(), 9, 30, 0, 0, time.Local),
			EndTime:         time.Date(day.Year(), day.Month(), day.Day(), 10, 0, 0, 0, time.Local),
			CalendarSource:  "mock",
			IsBusy:          true,
		})
	}

	// Mock Lunches: Everyday Mon-Fri from 12:00 PM to 01:00 PM
	for d := 0; d < 5; d++ {
		day := monday.AddDate(0, 0, d)
		list = append(list, models.CalendarEvent{
			UserID:          userID,
			ExternalEventID: fmt.Sprintf("mock-lunch-%d", d),
			Title:           "Lunch Break 🍽️",
			Description:     "Away from keyboard. Taking a walk.",
			StartTime:       time.Date(day.Year(), day.Month(), day.Day(), 12, 0, 0, 0, time.Local),
			EndTime:         time.Date(day.Year(), day.Month(), day.Day(), 13, 0, 0, 0, time.Local),
			CalendarSource:  "mock",
			IsBusy:          true,
		})
	}

	// Mock weekly meetings
	// Monday: Weekly Team Sync at 10:30 AM - 11:30 AM
	list = append(list, models.CalendarEvent{
		UserID:          userID,
		ExternalEventID: "mock-weekly-sync",
		Title:           "Weekly Team Sync 🚀",
		Description:     "Company-wide coordination and sprint kickoff goals.",
		StartTime:       time.Date(monday.Year(), monday.Month(), monday.Day(), 10, 30, 0, 0, time.Local),
		EndTime:         time.Date(monday.Year(), monday.Month(), monday.Day(), 11, 30, 0, 0, time.Local),
		CalendarSource:  "mock",
		IsBusy:          true,
	})

	// Tuesday: Product Design Review at 02:00 PM - 03:00 PM
	tuesday := monday.AddDate(0, 0, 1)
	list = append(list, models.CalendarEvent{
		UserID:          userID,
		ExternalEventID: "mock-design-sync",
		Title:           "Product Design Sync 🎨",
		Description:     "Reviewing Figma mockups for the new Motion AI scheduling board widgets.",
		StartTime:       time.Date(tuesday.Year(), tuesday.Month(), tuesday.Day(), 14, 0, 0, 0, time.Local),
		EndTime:         time.Date(tuesday.Year(), tuesday.Month(), tuesday.Day(), 15, 0, 0, 0, time.Local),
		CalendarSource:  "mock",
		IsBusy:          true,
	})

	// Wednesday: Engineering Arch Review at 03:00 PM - 04:30 PM
	wednesday := monday.AddDate(0, 0, 2)
	list = append(list, models.CalendarEvent{
		UserID:          userID,
		ExternalEventID: "mock-arch-review",
		Title:           "Engineering Arch Review 🛠️",
		Description:     "Deep dive into Echo middleware, Redis queue scheduling and background workers.",
		StartTime:       time.Date(wednesday.Year(), wednesday.Month(), wednesday.Day(), 15, 0, 0, 0, time.Local),
		EndTime:         time.Date(wednesday.Year(), wednesday.Month(), wednesday.Day(), 16, 30, 0, 0, time.Local),
		CalendarSource:  "mock",
		IsBusy:          true,
	})

	// Thursday: One-on-One with CEO at 02:00 PM - 02:30 PM
	thursday := monday.AddDate(0, 0, 3)
	list = append(list, models.CalendarEvent{
		UserID:          userID,
		ExternalEventID: "mock-ceo-1on1",
		Title:           "1-on-1 w/ CEO 🤝",
		Description:     "Product feedback, roadmap alignment, career progression notes.",
		StartTime:       time.Date(thursday.Year(), thursday.Month(), thursday.Day(), 14, 0, 0, 0, time.Local),
		EndTime:         time.Date(thursday.Year(), thursday.Month(), thursday.Day(), 14, 30, 0, 0, time.Local),
		CalendarSource:  "mock",
		IsBusy:          true,
	})

	// Friday: Retrospective & Chill at 04:00 PM - 05:00 PM
	friday := monday.AddDate(0, 0, 4)
	list = append(list, models.CalendarEvent{
		UserID:          userID,
		ExternalEventID: "mock-retro",
		Title:           "Friday Retro & Chill 🍕",
		Description:     "Sprint review, team demos, jokes, weekend plans.",
		StartTime:       time.Date(friday.Year(), friday.Month(), friday.Day(), 16, 0, 0, 0, time.Local),
		EndTime:         time.Date(friday.Year(), friday.Month(), friday.Day(), 17, 0, 0, 0, time.Local),
		CalendarSource:  "mock",
		IsBusy:          true,
	})

	return list
}
