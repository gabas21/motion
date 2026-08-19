package models

import (
	"time"

	"gorm.io/gorm"
)

// SiakGrade menyimpan cache nilai per mata kuliah dari SIAK
type SiakGrade struct {
	ID         string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID     string         `gorm:"type:varchar(36);not null;index" json:"userId"`
	Semester   string         `gorm:"type:varchar(50);not null" json:"semester"` // e.g. "2025/2026 Gasal"
	KodeMatkul string         `gorm:"type:varchar(20);not null" json:"kodeMatkul"`
	NamaMatkul string         `gorm:"type:varchar(255);not null" json:"namaMatkul"`
	SKS        int            `json:"sks"`
	NilaiHuruf string         `gorm:"type:varchar(5)" json:"nilaiHuruf"` // A, B+, B, C, dll
	NilaiAngka float64        `json:"nilaiAngka"`                       // 4.0, 3.5, 3.0, dll
	Mutu       float64        `json:"mutu"`                              // SKS × NilaiAngka
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

// SiakSummary menyimpan IPK dan total SKS untuk dikembalikan ke frontend
type SiakSummary struct {
	NIM        string     `json:"nim"`
	IPK        float64    `json:"ipk"`
	TotalSKS   int        `json:"totalSks"`
	TotalMutu  float64    `json:"totalMutu"`
	LastSyncAt *time.Time `json:"lastSyncAt"`
}
