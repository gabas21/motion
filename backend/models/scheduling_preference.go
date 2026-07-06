
package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SchedulingPreference struct {
	ID                     uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID                 uuid.UUID      `gorm:"type:varchar(36);uniqueIndex;not null" json:"userId"`
	WorkHoursStart         int            `gorm:"type:integer;default:9" json:"workHoursStart"` // 0-23 (default 9 = 9 AM)
	WorkHoursEnd           int            `gorm:"type:integer;default:18" json:"workHoursEnd"`  // 0-23 (default 18 = 6 PM)
	BreakDurationMinutes   int            `gorm:"type:integer;default:15" json:"breakDurationMinutes"`
	AllowWeekendScheduling bool           `gorm:"type:boolean;default:false" json:"allowWeekendScheduling"`
	PreferredTaskTime      string         `gorm:"type:varchar(50);default:'morning'" json:"preferredTaskTime"` // "morning", "afternoon", "evening"
	CreatedAt              time.Time      `json:"createdAt"`
	UpdatedAt              time.Time      `json:"updatedAt"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"-"`
}

func (sp *SchedulingPreference) BeforeCreate(tx *gorm.DB) (err error) {
	if sp.ID == uuid.Nil {
		sp.ID = uuid.New()
	}
	return
}
