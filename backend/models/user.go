package models

import (
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type User struct {
	ID             uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	Email          string         `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash   string         `gorm:"type:varchar(255);not null" json:"-"`
	Name           string         `gorm:"type:varchar(255);not null" json:"name"`
	Timezone       string         `gorm:"type:varchar(50);default:'UTC'" json:"timezone"`
	Plan           string         `gorm:"type:varchar(20);default:'free'" json:"plan"`
	SubscriptionExpiresAt *time.Time     `json:"subscriptionExpiresAt,omitempty"`
	Role           string         `gorm:"type:varchar(20);default:'user'" json:"role"` // 'user' | 'admin'
	TelegramChatID        string         `gorm:"type:varchar(100);index" json:"telegramChatId,omitempty"`
	TelegramOTP           string         `gorm:"type:varchar(10)" json:"-"`
	TelegramOTPExp        *time.Time     `json:"-"`
	FailedLoginAttempts   int            `gorm:"default:0" json:"failedLoginAttempts"`
	LockedUntil           *time.Time     `json:"lockedUntil,omitempty"`
	LastLoginAt           *time.Time     `json:"lastLoginAt,omitempty"`
	RequirePasswordChange bool           `gorm:"default:false" json:"requirePasswordChange"`
	// Email verification
	EmailVerified      bool       `gorm:"default:false" json:"emailVerified"`
	EmailVerifiedAt    *time.Time `json:"emailVerifiedAt,omitempty"`
	EmailVerifyToken   string     `gorm:"type:varchar(255);index" json:"-"`
	EmailVerifyExpires *time.Time `json:"-"`
	// Password reset
	ResetToken         string     `gorm:"type:varchar(255);index" json:"-"`
	ResetTokenExpires  *time.Time `json:"-"`
	Tasks                 []Task         `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	MoodleExcuseLetters   []MoodleExcuseLetter `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	CalendarConnections   []CalendarConnection `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	CreatedAt             time.Time      `json:"createdAt"`
	UpdatedAt             time.Time      `json:"updatedAt"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate is a GORM hook to generate UUID before creating a user
func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return
}

// HashPassword hashes user password before saving
func (u *User) HashPassword(password string) error {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.PasswordHash = string(hashed)
	return nil
}

// CheckPassword checks if password matches the hash
func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
	return err == nil
}

// IncrementFailedLogin increments failed attempts and locks user if it reaches 5
func (u *User) IncrementFailedLogin() {
	u.FailedLoginAttempts++
	if u.FailedLoginAttempts >= 5 {
		lockTime := time.Now().Add(15 * time.Minute)
		u.LockedUntil = &lockTime
	}
}

// IsLocked checks if the user account is locked
func (u *User) IsLocked() bool {
	return u.LockedUntil != nil && u.LockedUntil.After(time.Now())
}

// ResetFailedLogin resets login attempts and clears lock status
func (u *User) ResetFailedLogin() {
	u.FailedLoginAttempts = 0
	u.LockedUntil = nil
}

// IsSuspended checks if the user is suspended indefinitely by an admin
func (u *User) IsSuspended() bool {
	if u.LockedUntil == nil {
		return false
	}
	// If lock duration is greater than 30 days, we consider it suspended
	return u.LockedUntil.After(time.Now().AddDate(0, 1, 0))
}
