package models

import (
	"time"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserAIConfig struct {
	ID                 uuid.UUID `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID             uuid.UUID `gorm:"type:varchar(36);uniqueIndex;not null" json:"userId"`
	EncryptedGeminiKey string    `gorm:"type:text" json:"-"`
	EncryptedGroqKey   string    `gorm:"type:text" json:"-"`
	EncryptedORKey     string    `gorm:"type:text" json:"-"`
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

// BeforeCreate: GORM hook untuk auto-generate UUID (sama seperti User model)
func (u *UserAIConfig) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return
}
