package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MoodleConnection menyimpan kredensial WeLearn per user.
// Password disimpan terenkripsi AES-256-GCM — tidak pernah plaintext di DB.
type MoodleConnection struct {
	ID                   uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID               uuid.UUID      `gorm:"type:varchar(36);not null;uniqueIndex" json:"userId"`
	MoodleUsername       string         `gorm:"type:varchar(255);not null" json:"moodleUsername"`
	EncryptedPassword    string         `gorm:"type:text;not null" json:"-"` // tidak pernah dikirim ke frontend
	IsConnected          bool           `gorm:"type:boolean;default:false" json:"isConnected"`
	LastSyncAt           *time.Time     `json:"lastSyncAt"`
	MoodleBaseURL        string         `gorm:"type:varchar(255);default:'https://welearn.wicida.ac.id'" json:"moodleBaseUrl"`
	// Smart Session Cache (Bug Fix: cookie + sesskey + userid disimpan bersama)
	// CachedSesskey:       CSRF token sesi Moodle
	// CachedCookies:       JSON serialized MoodleSession cookie (WAJIB ada bersama sesskey)
	// CachedSessionExpiry: TTL cache (90 menit dari waktu login)
	// CachedMoodleUserID:  ID numerik user di Moodle (untuk core_enrol_get_users_courses)
	CachedSesskey        string         `gorm:"type:varchar(100)" json:"-"`
	CachedCookies        string         `gorm:"type:text" json:"-"`
	CachedSessionExpiry  *time.Time     `gorm:"index" json:"-"`
	CachedMoodleUserID   int64          `gorm:"type:bigint;default:0" json:"-"`
	CreatedAt            time.Time      `json:"createdAt"`
	UpdatedAt            time.Time      `json:"updatedAt"`
}

// BeforeCreate is a GORM hook to generate UUID before creating a connection
func (m *MoodleConnection) BeforeCreate(tx *gorm.DB) (err error) {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return
}

// MoodleCourse menyimpan daftar mata kuliah yang diikuti user.
type MoodleCourse struct {
	ID             uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID         uuid.UUID      `gorm:"type:varchar(36);not null;index;uniqueIndex:idx_user_course" json:"userId"`
	MoodleCourseID string         `gorm:"type:varchar(100);not null;uniqueIndex:idx_user_course" json:"moodleCourseId"` // ID dari Moodle
	Name           string         `gorm:"type:varchar(255);not null" json:"name"`
	Shortname      string         `gorm:"type:varchar(100)" json:"shortname"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
}

// BeforeCreate is a GORM hook to generate UUID before creating a course
func (m *MoodleCourse) BeforeCreate(tx *gorm.DB) (err error) {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return
}

// MoodleAssignment menyimpan tugas yang di-scrape dari WeLearn.
type MoodleAssignment struct {
	ID               uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID           uuid.UUID      `gorm:"type:varchar(36);not null;index;uniqueIndex:idx_user_assign;index:idx_user_course,priority:1" json:"userId"`
	MoodleAssignID   string         `gorm:"type:varchar(100);not null;uniqueIndex:idx_user_assign" json:"moodleAssignId"` // ID unik dari URL Moodle
	CourseID         string         `gorm:"type:varchar(100);index:idx_user_course,priority:2" json:"courseId"`
	CourseName       string         `gorm:"type:varchar(255)" json:"courseName"`
	Name             string         `gorm:"type:varchar(255);not null" json:"name"`
	DueDate          *time.Time     `gorm:"index" json:"dueDate"`
	EventType        string         `gorm:"type:varchar(50);default:'assign'" json:"eventType"` // assign, quiz, forum
	SubmissionStatus string         `gorm:"type:varchar(50);default:'new';index" json:"submissionStatus"` // new, draft, submitted
	SectionName      string         `gorm:"type:varchar(255)" json:"sectionName"` // e.g. Pertemuan 1, Topik 2
	URL              string         `gorm:"type:text" json:"url"`
	CreatedAt        time.Time      `json:"createdAt"`
	UpdatedAt        time.Time      `json:"updatedAt"`
}

// BeforeCreate is a GORM hook to generate UUID before creating an assignment
func (m *MoodleAssignment) BeforeCreate(tx *gorm.DB) (err error) {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return
}
