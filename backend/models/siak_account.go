package models

import (
	"time"

	"gorm.io/gorm"
)

type SiakAccount struct {
	ID                string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID            string         `gorm:"type:varchar(36);not null;uniqueIndex" json:"userId"` // Hubungan 1-ke-1 ke User
	NIM               string         `gorm:"type:varchar(20);not null" json:"nim"`
	PasswordEncrypted string         `gorm:"type:text;not null" json:"-"` // Enkripsi AES-256
	LastSyncAt        *time.Time     `json:"lastSyncAt"`
	CreatedAt         time.Time      `json:"createdAt"`
	UpdatedAt         time.Time      `json:"updatedAt"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}
