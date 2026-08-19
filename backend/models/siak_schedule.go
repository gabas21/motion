package models

import (
	"time"

	"gorm.io/gorm"
)

// SiakSchedule menyimpan cache jadwal kuliah mingguan yang di-scrape dari SIAK.
type SiakSchedule struct {
	ID         string         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID     string         `gorm:"type:varchar(36);not null;index" json:"userId"`
	KodeMatkul string         `gorm:"type:varchar(20);not null" json:"kodeMatkul"`
	NamaMatkul string         `gorm:"type:varchar(255);not null" json:"namaMatkul"`
	Hari       string         `gorm:"type:varchar(20);not null" json:"hari"`
	JamMulai   string         `gorm:"type:varchar(10);not null" json:"jamMulai"`
	JamSelesai string         `gorm:"type:varchar(10);not null" json:"jamSelesai"`
	Ruangan    string         `gorm:"type:varchar(100)" json:"ruangan"`
	Dosen      string         `gorm:"type:varchar(255)" json:"dosen"`
	SKS        int            `json:"sks"`
	Semester   string         `gorm:"type:varchar(50)" json:"semester"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}
