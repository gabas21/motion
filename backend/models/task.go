package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Task struct {
	ID                  uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID              uuid.UUID      `gorm:"type:varchar(36);not null;index:idx_user_status_due,priority:1;index:idx_user_category,priority:1" json:"userId"`
	User                User           `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Title               string         `gorm:"type:varchar(255);not null" json:"title"`
	Description         string         `gorm:"type:text" json:"description"`
	TimeEstimateMinutes int            `gorm:"type:integer;default:30" json:"timeEstimateMinutes"`
	DueDate             *time.Time     `gorm:"index:idx_user_status_due,priority:3" json:"dueDate"`
	Priority            int            `gorm:"type:integer;default:3;index" json:"priority"` // 1 (lowest) to 5 (highest)
	Status              string         `gorm:"type:varchar(50);default:'pending';index:idx_user_status_due,priority:2" json:"status"` // pending, in_progress, completed, cancelled
	ScheduledStart      *time.Time     `gorm:"index" json:"scheduledStart"`
	ScheduledEnd        *time.Time     `gorm:"index" json:"scheduledEnd"`
	CompletedAt         *time.Time     `gorm:"index" json:"completedAt"`
	Category            string         `gorm:"type:varchar(100);default:'general';index:idx_user_category,priority:2" json:"category"` // work, personal, etc
	ReminderSent        bool           `gorm:"type:boolean;default:false" json:"reminderSent"`
	CreatedAt           time.Time      `json:"createdAt"`
	UpdatedAt           time.Time      `json:"updatedAt"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate is a GORM hook to generate UUID before creating a task
func (t *Task) BeforeCreate(tx *gorm.DB) (err error) {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return
}
