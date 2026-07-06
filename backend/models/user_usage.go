package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserUsage struct {
	ID             uuid.UUID `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID         uuid.UUID `gorm:"type:varchar(36);uniqueIndex;not null" json:"userId"`
	DailyChatCount int       `gorm:"type:integer;default:0" json:"dailyChatCount"`
	LastChatDate   string    `gorm:"type:varchar(10);not null;default:''" json:"lastChatDate"` // Format: YYYY-MM-DD
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// BeforeCreate is a GORM hook to generate UUID before creating a record
func (uu *UserUsage) BeforeCreate(tx *gorm.DB) (err error) {
	if uu.ID == uuid.Nil {
		uu.ID = uuid.New()
	}
	return
}
