package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ChatHistory menyimpan riwayat percakapan Asep AI per user.
// Digunakan untuk memberi Asep "memori" lintas sesi tanpa perlu Redis baru.
// History dibatasi 20 pesan terakhir dan auto-expire 7 hari.
type ChatHistory struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex" json:"userId"` // 1 row per user
	Messages  []byte         `gorm:"type:jsonb;not null;default:'[]'" json:"messages"` // []map[string]string
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate adalah GORM hook untuk generate UUID sebelum insert.
func (ch *ChatHistory) BeforeCreate(tx *gorm.DB) (err error) {
	if ch.ID == uuid.Nil {
		ch.ID = uuid.New()
	}
	return
}
