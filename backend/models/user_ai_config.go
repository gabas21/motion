package models

import (
	"time"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserAIConfig struct {
	ID                 uuid.UUID  `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID             uuid.UUID  `gorm:"type:varchar(36);uniqueIndex;not null" json:"userId"`
	EncryptedGeminiKey string     `gorm:"type:text" json:"-"`
	EncryptedGroqKey   string     `gorm:"type:text" json:"-"`
	EncryptedORKey     string     `gorm:"type:text" json:"-"`
	GeminiKeyLast4     string     `gorm:"type:varchar(10)" json:"geminiKeyLast4,omitempty"`
	GroqKeyLast4       string     `gorm:"type:varchar(10)" json:"groqKeyLast4,omitempty"`
	ORKeyLast4         string     `gorm:"type:varchar(10)" json:"orKeyLast4,omitempty"`
	GeminiIsValid      bool       `gorm:"default:false" json:"geminiIsValid"`
	GroqIsValid        bool       `gorm:"default:false" json:"groqIsValid"`
	ORIsValid          bool       `gorm:"default:false" json:"orIsValid"`
	GeminiValidatedAt  *time.Time `json:"geminiValidatedAt,omitempty"`
	GroqValidatedAt    *time.Time `json:"groqValidatedAt,omitempty"`
	ORValidatedAt      *time.Time `json:"orValidatedAt,omitempty"`
	CreatedAt          time.Time  `json:"createdAt"`
	UpdatedAt          time.Time  `json:"updatedAt"`
}

// BeforeCreate: GORM hook untuk auto-generate UUID (sama seperti User model)
func (u *UserAIConfig) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return
}
