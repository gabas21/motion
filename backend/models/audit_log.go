package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AuditLog mencatat semua aksi penting yang dilakukan user maupun admin.
// Ini adalah tabel immutable — tidak boleh ada UPDATE atau DELETE pada record audit.
type AuditLog struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       string    `gorm:"type:varchar(36);index;not null" json:"userId"`
	Action       string    `gorm:"type:varchar(100);not null;index" json:"action"`
	Category     string    `gorm:"type:varchar(50);not null;index" json:"category"`
	ResourceType string    `gorm:"type:varchar(50);index" json:"resourceType,omitempty"`
	ResourceID   string    `gorm:"type:varchar(36);index" json:"resourceId,omitempty"`
	Details      string    `gorm:"type:text" json:"details,omitempty"` // JSON string
	IPAddress    string    `gorm:"type:varchar(45)" json:"ipAddress,omitempty"`
	UserAgent    string    `gorm:"type:varchar(500)" json:"userAgent,omitempty"`
	Status       string    `gorm:"type:varchar(20);default:'success'" json:"status"` // "success" | "failed"
	CreatedAt    time.Time `gorm:"index" json:"createdAt"`
}

// TableName override
func (AuditLog) TableName() string {
	return "audit_logs"
}

// BeforeCreate is a GORM hook — AuditLog tidak perlu UUID karena pakai auto-increment
func (a *AuditLog) BeforeCreate(tx *gorm.DB) error {
	_ = uuid.Nil // ensure uuid import used
	if a.CreatedAt.IsZero() {
		a.CreatedAt = time.Now()
	}
	return nil
}

// Kategori aksi audit yang umum digunakan (konstanta untuk konsistensi)
const (
	AuditCategoryAuth         = "auth"
	AuditCategorySubscription = "subscription"
	AuditCategoryAdmin        = "admin"
	AuditCategoryTask         = "task"
	AuditCategoryProfile      = "profile"
	AuditCategoryPayment      = "payment"
	AuditCategorySecurity     = "security"

	AuditStatusSuccess = "success"
	AuditStatusFailed  = "failed"
)
