package models

import (
	"time"

	"gorm.io/gorm"
)

// SiakGrade menyimpan cache nilai per mata kuliah dari SIAK
type SiakGrade struct {
	ID         string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID     string         `gorm:"type:varchar(36);not null;index" json:"user_id"`
	Semester   string         `gorm:"type:varchar(50);not null" json:"semester"` // e.g. "2025/2026 Gasal"
	KodeMatkul string         `gorm:"type:varchar(20);not null" json:"kode_matkul"`
	NamaMatkul string         `gorm:"type:varchar(255);not null" json:"nama_matkul"`
	SKS        int            `json:"sks"`
	NilaiHuruf string         `gorm:"type:varchar(5)" json:"nilai_huruf"` // A, B+, B, C, dll
	NilaiAngka float64        `json:"nilai_angka"`                       // 4.0, 3.5, 3.0, dll
	Mutu       float64        `json:"mutu"`                              // SKS × NilaiAngka
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

// SiakSummary menyimpan IPK dan total SKS untuk dikembalikan ke frontend
type SiakSummary struct {
	NIM        string     `json:"nim"`
	IPK        float64    `json:"ipk"`
	TotalSKS   int        `json:"total_sks"`
	TotalMutu  float64    `json:"total_mutu"`
	LastSyncAt *time.Time `json:"last_sync_at"`
}
