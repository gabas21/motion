package services

import (
	"context"
	"log"

	"github.com/google/uuid"
	"github.com/motion/backend/models"
	"github.com/motion/backend/integrations/welearn"
	"gorm.io/gorm"
)

func init() {
	welearn.BroadcastCallback = func(userID string, message []byte) {
		if WSHub != nil {
			WSHub.Broadcast(userID, message)
		}
	}

	welearn.ScheduleTaskCallback = func(task *models.Task) {
		go func() {
			if err := InstanceSchedulingEngine.ScheduleTask(context.Background(), task); err != nil {
				log.Printf("[welearn-mirror] ⚠ Penjadwalan otomatis AI gagal untuk tugas cerminan %s: %v", task.ID, err)
			}
		}()
	}

	welearn.IngestRAGCallback = func(userID uuid.UUID, courseName string, assignName string, introHTML string) {
		go IngestWeLearnAssignmentDescription(userID, courseName, assignName, introHTML)
	}
}

// WeLearnSession is a shim for backward compatibility
type WeLearnSession = welearn.WeLearnSession

// DebugScrapeResult is a shim for backward compatibility
type DebugScrapeResult = welearn.DebugScrapeResult

// NewWeLearnSession is a shim for backward compatibility
func NewWeLearnSession(username, password, baseURL string) *WeLearnSession {
	return welearn.NewWeLearnSession(username, password, baseURL)
}

// SyncUserAssignmentsInternal is a shim for backward compatibility
func SyncUserAssignmentsInternal(db *gorm.DB, activeSession *WeLearnSession, userID, connID uuid.UUID) {
	welearn.SyncUserAssignmentsInternal(db, activeSession, userID, connID)
}

// SyncViaREST is a shim for backward compatibility
func SyncViaREST(db *gorm.DB, conn *models.MoodleConnection, activeSession *WeLearnSession) error {
	return welearn.SyncViaREST(db, conn, activeSession)
}

// SyncViaAJAX is a shim for backward compatibility
func SyncViaAJAX(db *gorm.DB, conn *models.MoodleConnection, activeSession *WeLearnSession) error {
	return welearn.SyncViaAJAX(db, conn, activeSession)
}

// DebugScrapeREST is a shim for REST diagnostics
func DebugScrapeREST(db *gorm.DB, conn *models.MoodleConnection) DebugScrapeResult {
	return welearn.DebugScrapeREST(db, conn)
}

// cleanCourseName is a shim for backward compatibility inside services package
func cleanCourseName(name string) string {
	return welearn.CleanCourseName(name)
}





