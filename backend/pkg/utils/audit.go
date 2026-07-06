package utils

import (
	"encoding/json"
	"log"
)

// AuditEntry adalah data audit yang akan di-persist
type AuditEntry struct {
	UserID       string
	Action       string
	Category     string
	ResourceType string
	ResourceID   string
	Details      map[string]interface{}
	IPAddress    string
	UserAgent    string
	Status       string
}

// auditPersistFunc adalah callback yang di-inject dari layer database (menghindari import cycle)
var auditPersistFunc func(entry AuditEntry)

// SetAuditPersistFunc mengatur fungsi persist ke database (dipanggil saat startup dari config/database.go)
func SetAuditPersistFunc(fn func(entry AuditEntry)) {
	auditPersistFunc = fn
}

// LogAuditEvent mencatat aksi ke stdout dan secara async ke database (jika persist func sudah diset).
func LogAuditEvent(userID string, action string, category string, details map[string]interface{}) {
	detailsJSON, err := json.Marshal(details)
	if err != nil {
		log.Printf("[AUDIT] UserID: %s | Action: %s | Category: %s | Details: failed to marshal details: %v", userID, action, category, err)
		return
	}
	log.Printf("[AUDIT] UserID: %s | Action: %s | Category: %s | Details: %s", userID, action, category, string(detailsJSON))

	// Persist ke DB jika fungsi sudah diset
	if auditPersistFunc != nil {
		go auditPersistFunc(AuditEntry{
			UserID:   userID,
			Action:   action,
			Category: category,
			Details:  details,
			Status:   "success",
		})
	}
}

// LogAuditEventFull mencatat audit dengan informasi lengkap termasuk IP, resource, dan status.
func LogAuditEventFull(entry AuditEntry) {
	detailsJSON, _ := json.Marshal(entry.Details)
	log.Printf("[AUDIT] UserID: %s | Action: %s | Category: %s | Resource: %s/%s | Status: %s | IP: %s | Details: %s",
		entry.UserID, entry.Action, entry.Category, entry.ResourceType, entry.ResourceID,
		entry.Status, entry.IPAddress, string(detailsJSON))

	if auditPersistFunc != nil {
		go auditPersistFunc(entry)
	}
}
