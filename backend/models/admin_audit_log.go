package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AdminAuditLog struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	AdminID      uuid.UUID `gorm:"type:varchar(36);index;not null" json:"adminId"`
	Admin        *User     `gorm:"foreignKey:AdminID" json:"admin,omitempty"`
	TargetUserID uuid.UUID `gorm:"type:varchar(36);index" json:"targetUserId"`
	TargetUser   *User     `gorm:"foreignKey:TargetUserID" json:"targetUser,omitempty"`
	Action       string    `gorm:"type:varchar(100);not null;index" json:"action"`
	Reason       string    `gorm:"type:text;not null" json:"reason"`
	BeforeState  string    `gorm:"type:text" json:"beforeState,omitempty"` // JSON string of state before change
	AfterState   string    `gorm:"type:text" json:"afterState,omitempty"`  // JSON string of state after change
	IPAddress    string    `gorm:"type:varchar(45)" json:"ipAddress,omitempty"`
	CreatedAt    time.Time `gorm:"index" json:"createdAt"`
}

func (AdminAuditLog) TableName() string {
	return "admin_audit_logs"
}

func (a *AdminAuditLog) BeforeCreate(tx *gorm.DB) error {
	if a.CreatedAt.IsZero() {
		a.CreatedAt = time.Now()
	}
	return nil
}
