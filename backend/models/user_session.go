package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserSession struct {
	ID               uuid.UUID  `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID           uuid.UUID  `gorm:"type:varchar(36);index;not null" json:"userId"`
	User             *User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	RefreshTokenHash string     `gorm:"type:text;not null" json:"-"`
	DeviceInfo       string     `gorm:"type:text" json:"deviceInfo"`
	IPAddress        string     `gorm:"type:varchar(45)" json:"ipAddress"`
	LastActiveAt     time.Time  `gorm:"index" json:"lastActiveAt"`
	RevokedAt        *time.Time `gorm:"index" json:"revokedAt,omitempty"`
	CreatedAt        time.Time  `gorm:"index" json:"createdAt"`
}

func (UserSession) TableName() string {
	return "user_sessions"
}

func (s *UserSession) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	if s.CreatedAt.IsZero() {
		s.CreatedAt = time.Now()
	}
	if s.LastActiveAt.IsZero() {
		s.LastActiveAt = time.Now()
	}
	return nil
}

func (s *UserSession) IsActive() bool {
	return s.RevokedAt == nil
}
