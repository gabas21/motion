package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Subscription struct {
	ID             uuid.UUID      `gorm:"type:varchar(36);primaryKey" json:"id"`
	UserID         uuid.UUID      `gorm:"type:varchar(36);index;not null" json:"userId"`
	Plan           string         `gorm:"type:varchar(20);not null" json:"plan"` // "free" | "pro"
	Status         string         `gorm:"type:varchar(20);default:'pending'" json:"status"` // "pending" | "active" | "cancelled" | "expired"
	Amount         float64        `gorm:"type:decimal(10,2);default:0" json:"amount"`
	PaymentGateway string         `gorm:"type:varchar(50)" json:"paymentGateway,omitempty"` // "midtrans" | "manual" | "promo"
	OrderID        string         `gorm:"type:varchar(100);index" json:"orderId,omitempty"` // Midtrans Order ID
	TransactionID  string         `gorm:"type:varchar(100)" json:"transactionId,omitempty"` // Gateway Transaction ID
	ExpiresAt      *time.Time     `json:"expiresAt,omitempty"`
	CheckoutURL    string         `gorm:"type:varchar(512)" json:"checkoutUrl,omitempty"`
	QrString       string         `gorm:"type:text" json:"qrString,omitempty"`
	QrURL          string         `gorm:"type:varchar(512)" json:"qrUrl,omitempty"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate is a GORM hook to generate UUID before creating a subscription
func (s *Subscription) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return
}
