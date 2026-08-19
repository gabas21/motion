package models

import (
	"time"

	"gorm.io/gorm"
)

// SiakExam menyimpan cache jadwal ujian (UTS/UAS) yang di-scrape dari SIAK.
type SiakExam struct {
	ID           string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID       string         `gorm:"type:varchar(36);not null;index" json:"userId"`
	KodeMatkul   string         `gorm:"type:varchar(20);not null" json:"kodeMatkul"`
	NamaMatkul   string         `gorm:"type:varchar(255);not null" json:"namaMatkul"`
	TanggalUjian *time.Time     `gorm:"index" json:"tanggalUjian"`
	JamMulai     string         `gorm:"type:varchar(10)" json:"jamMulai"`
	JamSelesai   string         `gorm:"type:varchar(10)" json:"jamSelesai"`
	Ruangan      string         `gorm:"type:varchar(100)" json:"ruangan"`
	JenisUjian       string         `gorm:"type:varchar(10)" json:"jenisUjian"`
	Semester         string         `gorm:"type:varchar(50)" json:"semester"`
	NotifiedDaysLeft string         `gorm:"type:varchar(50);default:''" json:"-"`
	CreatedAt        time.Time      `json:"createdAt"`
	UpdatedAt        time.Time      `json:"updatedAt"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}
