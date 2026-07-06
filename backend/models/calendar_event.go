package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CalendarEvent struct {
	ID              uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID          uuid.UUID      `gorm:"type:varchar(36);not null;index:idx_user_time,priority:1" json:"userId"`
	ExternalEventID string         `gorm:"type:varchar(255);index" json:"externalEventId"`
	Title           string         `gorm:"type:varchar(255);not null" json:"title"`
	Description     string         `gorm:"type:text" json:"description"`
	StartTime       time.Time      `gorm:"not null;index:idx_user_time,priority:2" json:"startTime"`
	EndTime         time.Time      `gorm:"not null;index" json:"endTime"`
	CalendarSource  string         `gorm:"type:varchar(50);not null;index" json:"calendarSource"` // "google", "outlook", "mock"
	IsBusy          bool           `gorm:"default:true" json:"isBusy"`
	CreatedAt       time.Time      `json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ce *CalendarEvent) BeforeCreate(tx *gorm.DB) (err error) {
	if ce.ID == uuid.Nil {
		ce.ID = uuid.New()
	}
	return
}
