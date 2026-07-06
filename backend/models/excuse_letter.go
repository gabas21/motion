package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MoodleExcuseLetter struct {
	ID              uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID          uuid.UUID      `gorm:"type:varchar(36);not null;index" json:"userId"`
	User            User           `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Nama            string         `gorm:"type:varchar(255);not null" json:"nama"`
	NIM             string         `gorm:"type:varchar(50);not null" json:"nim"`
	Prodi           string         `gorm:"type:varchar(100);not null" json:"prodi"`
	Kelompok        string         `gorm:"type:varchar(50);not null" json:"kelompok"`
	CourseID        string         `gorm:"type:varchar(100);not null" json:"courseId"`
	CourseName      string         `gorm:"type:varchar(255);not null" json:"courseName"`
	HariTanggal     string         `gorm:"type:varchar(100);not null" json:"hariTanggal"`
	Alasan          string         `gorm:"type:text;not null" json:"alasan"`
	TanggalSurat    string         `gorm:"type:varchar(100);not null" json:"tanggalSurat"`
	SignatureBase64 string         `gorm:"type:text;not null" json:"signatureBase64"` // Base64 data ttd PNG
	CreatedAt       time.Time      `json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

func (m *MoodleExcuseLetter) BeforeCreate(tx *gorm.DB) (err error) {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return
}
