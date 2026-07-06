package main

import (
	"fmt"
	"log"

	"github.com/joho/godotenv"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
)

func main() {
	// Load .env dari folder backend
	if err := godotenv.Load("../../.env"); err != nil {
		log.Println("Tidak ada .env, pakai env system")
	}

	config.LoadConfig()
	config.ConnectDB()

	var users []models.User
	config.DB.Unscoped().
		Select("id, email, name, role, password_hash, failed_login_attempts, locked_until, created_at").
		Order("created_at DESC").
		Limit(20).
		Find(&users)

	fmt.Printf("\n%-36s  %-30s  %-20s  %-10s  %-12s  %-12s  %-15s  %-20s\n", "ID", "Email", "Name", "Role", "Hash Status", "Password Check", "Failed Attempts", "Locked Until")
	fmt.Println("------------------------------------------------------------------------------------------------------------------------------------------------------")
	for _, u := range users {
		hashStatus := "✅ ADA"
		if u.PasswordHash == "" {
			hashStatus = "❌ KOSONG"
		}
		passCheck := "N/A"
		if u.Email == "bagasa020@gmail.com" {
			if u.CheckPassword("AdminMotion2026!") {
				passCheck = "✅ MATCH"
			} else {
				passCheck = "❌ FAIL"
			}
			// Jika akun terkunci atau ada failed attempts, reset
			if u.FailedLoginAttempts > 0 || u.LockedUntil != nil {
				config.DB.Model(&u).Updates(map[string]interface{}{
					"failed_login_attempts": 0,
					"locked_until":          nil,
				})
				u.FailedLoginAttempts = 0
				u.LockedUntil = nil
				fmt.Println("[INFO] Mengatur ulang failed attempts dan status kunci untuk bagasa020@gmail.com")
			}
		}
		lockedUntilStr := "None"
		if u.LockedUntil != nil {
			lockedUntilStr = u.LockedUntil.Format("2006-01-02 15:04:05")
		}
		fmt.Printf("%-36s  %-30s  %-20s  %-10s  %-12s  %-12s  %-15d  %s\n", u.ID, u.Email, u.Name, u.Role, hashStatus, passCheck, u.FailedLoginAttempts, lockedUntilStr)
	}
	fmt.Println()
}
