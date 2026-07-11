package models

import (
	"time"

	"gorm.io/gorm"
)

type SiakAccount struct {
	ID                string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID            string         `gorm:"type:varchar(36);not null;uniqueIndex" json:"user_id"` // Hubungan 1-ke-1 ke User
	NIM               string         `gorm:"type:varchar(20);not null" json:"nim"`
	PasswordEncrypted string         `gorm:"type:text;not null" json:"-"` // Enkripsi AES-256
	LastSyncAt        *time.Time     `json:"last_sync_at"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}
