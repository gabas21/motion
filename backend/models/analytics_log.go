package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AnalyticsLog struct {
	ID                     uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID                 uuid.UUID      `gorm:"type:varchar(36);not null;uniqueIndex:idx_user_date" json:"userId"`
	Date                   time.Time      `gorm:"type:date;not null;uniqueIndex:idx_user_date" json:"date"`
	TotalTasks             int            `gorm:"type:integer;default:0" json:"totalTasks"`
	CompletedTasks         int            `gorm:"type:integer;default:0" json:"completedTasks"`
	OnTimeTasks            int            `gorm:"type:integer;default:0" json:"onTimeTasks"`
	LateTasks              int            `gorm:"type:integer;default:0" json:"lateTasks"`
	CancelledTasks         int            `gorm:"type:integer;default:0" json:"cancelledTasks"`
	FocusHours             float64        `gorm:"type:decimal(5,2);default:0.0" json:"focusHours"`
	MeetingHours           float64        `gorm:"type:decimal(5,2);default:0.0" json:"meetingHours"`
	BreakHours             float64        `gorm:"type:decimal(5,2);default:0.0" json:"breakHours"`
	ProductivityPercentage float64        `gorm:"type:decimal(5,2);default:0.0" json:"productivityPercentage"`
	CreatedAt              time.Time      `json:"createdAt"`
	UpdatedAt              time.Time      `json:"updatedAt"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"-"`
}

func (al *AnalyticsLog) BeforeCreate(tx *gorm.DB) (err error) {
	if al.ID == uuid.Nil {
		al.ID = uuid.New()
	}
	return
}
