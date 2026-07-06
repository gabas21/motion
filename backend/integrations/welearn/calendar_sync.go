package welearn

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/url"
	"time"

	"github.com/google/uuid"
	"github.com/motion/backend/models"
	"gorm.io/gorm"
)

// SyncMoodleCalendarEvents fetches academic calendar events from Moodle and mirrors them to Motion's calendar_events.
func SyncMoodleCalendarEvents(db *gorm.DB, baseURL, wstoken string, courseIDs []int64, userID uuid.UUID) error {
	if len(courseIDs) == 0 {
		return nil
	}

	log.Printf("[welearn-calendar] Syncing Moodle calendar events for user %s with %d courses...", userID, len(courseIDs))

	params := url.Values{
		"wstoken":            {wstoken},
		"moodlewsrestformat": {"json"},
	}

	for i, id := range courseIDs {
		params.Set(fmt.Sprintf("events[courseids][%d]", i), fmt.Sprintf("%d", id))
	}

	// Range options: -30 days to +120 days
	now := time.Now()
	timeStart := now.AddDate(0, 0, -30).Unix()
	timeEnd := now.AddDate(0, 0, 120).Unix()
	params.Set("options[timestart]", fmt.Sprintf("%d", timeStart))
	params.Set("options[timeend]", fmt.Sprintf("%d", timeEnd))

	var res MoodleCalendarEventsResponse
	err := GlobalCircuitBreaker.Execute(func() error {
		endpoint := fmt.Sprintf("%s/webservice/rest/server.php?wsfunction=core_calendar_get_calendar_events&%s", baseURL, params.Encode())
		resp, err := restGet(endpoint)
		if err != nil {
			return fmt.Errorf("REST calendar network error: %w", err)
		}
		defer resp.Body.Close()

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to read calendar response: %w", err)
		}

		if err := json.Unmarshal(bodyBytes, &res); err != nil {
			return fmt.Errorf("failed to parse calendar JSON: %w", err)
		}

		if res.Exception != "" {
			return fmt.Errorf("Moodle calendar exception: %s", res.Message)
		}
		return nil
	})

	if err != nil {
		return err
	}

	// Load courses map to resolve course names
	var courses []models.MoodleCourse
	if err := db.Where("user_id = ?", userID).Find(&courses).Error; err != nil {
		log.Printf("[welearn-calendar] Warning: gagal load courses: %v", err)
	}
	courseMap := make(map[string]string)
	for _, c := range courses {
		courseMap[c.MoodleCourseID] = c.Name
	}

	// Fetch existing calendar events for the user from "welearn" source
	var existingEvents []models.CalendarEvent
	if err := db.Where("user_id = ? AND calendar_source = ?", userID, "welearn").Find(&existingEvents).Error; err != nil {
		log.Printf("[welearn-calendar] Warning: gagal load existing calendar events: %v", err)
	}

	existingEventsMap := make(map[string]*models.CalendarEvent)
	for i := range existingEvents {
		e := &existingEvents[i]
		existingEventsMap[e.ExternalEventID] = e
	}

	fetchedEventIDs := make(map[string]bool)

	for _, event := range res.Events {
		// Ignore invisible events
		if event.Visible == 0 {
			continue
		}

		externalID := fmt.Sprintf("welearn-%d", event.ID)
		fetchedEventIDs[externalID] = true

		startTime := time.Unix(event.TimeStart, 0).UTC()
		endTime := startTime.Add(1 * time.Hour) // Default duration: 1 hour
		if event.TimeDuration > 0 {
			endTime = startTime.Add(time.Duration(event.TimeDuration) * time.Second)
		}

		// Resolve course name
		courseIDStr := fmt.Sprintf("%d", event.CourseID)
		courseName := "Akademik"
		if name, ok := courseMap[courseIDStr]; ok {
			courseName = CleanCourseName(name)
		}

		title := fmt.Sprintf("[%s] %s", courseName, event.Name)
		if len(title) > 255 {
			title = title[:252] + "..."
		}

		if existing, ok := existingEventsMap[externalID]; ok {
			// Update if changed
			if existing.Title != title ||
				existing.Description != event.Description ||
				!existing.StartTime.Equal(startTime) ||
				!existing.EndTime.Equal(endTime) {
				
				existing.Title = title
				existing.Description = event.Description
				existing.StartTime = startTime
				existing.EndTime = endTime

				if err := db.Save(existing).Error; err != nil {
					log.Printf("[welearn-calendar] Gagal memperbarui event %s: %v", externalID, err)
				}
			}
		} else {
			// Create new event
			newEvent := models.CalendarEvent{
				UserID:          userID,
				ExternalEventID: externalID,
				Title:           title,
				Description:     event.Description,
				StartTime:       startTime,
				EndTime:         endTime,
				CalendarSource:  "welearn",
				IsBusy:          true,
			}

			if err := db.Create(&newEvent).Error; err != nil {
				log.Printf("[welearn-calendar] Gagal membuat event baru %s: %v", externalID, err)
			}
		}
	}

	// Delete old events no longer present in Moodle
	for extID, ev := range existingEventsMap {
		if !fetchedEventIDs[extID] {
			log.Printf("[welearn-calendar] Menghapus calendar event lama: %s", ev.Title)
			if err := db.Delete(ev).Error; err != nil {
				log.Printf("[welearn-calendar] Gagal menghapus event %s: %v", extID, err)
			}
		}
	}

	log.Printf("[welearn-calendar] ✓ Kalender akademik tersinkronisasi: %d event aktif.", len(res.Events))
	return nil
}
