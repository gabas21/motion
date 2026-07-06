package main

import (
	"fmt"
	"log"

	"github.com/joho/godotenv"
	"github.com/motion/backend/config"
)

func main() {
	if err := godotenv.Load("../../.env"); err != nil {
		log.Println("Tidak ada .env, pakai env system")
	}

	config.LoadConfig()
	config.ConnectDB()

	type AuditLog struct {
		ID        string `gorm:"column:id"`
		UserID    string `gorm:"column:user_id"`
		Action    string `gorm:"column:action"`
		Resource  string `gorm:"column:resource"`
		Details   string `gorm:"column:details"`
		CreatedAt string `gorm:"column:created_at"`
	}

	var logs []AuditLog
	err := config.DB.Table("audit_logs").
		Where("action = ? OR action = ?", "LOGIN_FAILED", "LOGIN_SUCCESS").
		Order("created_at DESC").
		Limit(10).
		Find(&logs).Error

	if err != nil {
		fmt.Printf("Gagal membaca audit logs: %v\n", err)
		return
	}

	fmt.Printf("\n--- RECENT LOGIN AUDIT LOGS (%d) ---\n", len(logs))
	for _, l := range logs {
		fmt.Printf("Time: %s | Action: %s | UserID: %s | Details: %s\n",
			l.CreatedAt, l.Action, l.UserID, l.Details)
	}
}
