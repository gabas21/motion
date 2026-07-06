package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/motion/backend/pkg/utils"
)

type CalendarConnection struct {
	ID               uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID           uuid.UUID      `gorm:"type:varchar(36);not null;index" json:"userId"`
	User             User           `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	CalendarType     string         `gorm:"type:varchar(50);not null" json:"calendarType"` // "google", "outlook", "mock"
	CalendarID       string         `gorm:"type:varchar(255)" json:"calendarId"`
	CalendarName     string         `gorm:"type:varchar(255)" json:"calendarName"`
	AccessToken      string         `gorm:"type:varchar(1024);not null" json:"-"`
	RefreshToken     string         `gorm:"type:varchar(1024)" json:"-"`
	TokenExpiresAt   time.Time      `json:"tokenExpiresAt"`
	IsPrimary        bool           `gorm:"default:false" json:"isPrimary"`
	IsActive         bool           `gorm:"default:true" json:"isActive"`
	LastSyncedAt     *time.Time     `json:"lastSyncedAt"`
	SyncErrorMessage string         `gorm:"type:varchar(255)" json:"syncErrorMessage,omitempty"`
	CreatedAt        time.Time      `json:"createdAt"`
	UpdatedAt        time.Time      `json:"updatedAt"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

func (cc *CalendarConnection) BeforeCreate(tx *gorm.DB) (err error) {
	if cc.ID == uuid.Nil {
		cc.ID = uuid.New()
	}
	return
}

func (cc *CalendarConnection) BeforeSave(tx *gorm.DB) (err error) {
	if cc.AccessToken != "" {
		encrypted, err := utils.EncryptWithSalt(cc.AccessToken, cc.UserID.String())
		if err != nil {
			return err
		}
		cc.AccessToken = encrypted
	}
	if cc.RefreshToken != "" {
		encrypted, err := utils.EncryptWithSalt(cc.RefreshToken, cc.UserID.String())
		if err != nil {
			return err
		}
		cc.RefreshToken = encrypted
	}
	return nil
}

func (cc *CalendarConnection) AfterSave(tx *gorm.DB) (err error) {
	return cc.DecryptFields()
}

func (cc *CalendarConnection) AfterFind(tx *gorm.DB) (err error) {
	return cc.DecryptFields()
}

func (cc *CalendarConnection) DecryptFields() error {
	if cc.AccessToken != "" {
		decrypted, err := utils.DecryptWithSalt(cc.AccessToken, cc.UserID.String())
		if err != nil {
			// Fallback ke decrypt tanpa salt jika gagal (mendukung data lama)
			decryptedOld, errOld := utils.DecryptPassword(cc.AccessToken)
			if errOld == nil {
				cc.AccessToken = decryptedOld
			} else {
				// Jika keduanya gagal, biarkan saja
				return nil
			}
		} else {
			cc.AccessToken = decrypted
		}
	}
	if cc.RefreshToken != "" {
		decrypted, err := utils.DecryptWithSalt(cc.RefreshToken, cc.UserID.String())
		if err != nil {
			decryptedOld, errOld := utils.DecryptPassword(cc.RefreshToken)
			if errOld == nil {
				cc.RefreshToken = decryptedOld
			} else {
				return nil
			}
		} else {
			cc.RefreshToken = decrypted
		}
	}
	return nil
}
