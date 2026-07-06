package main

import (
	"fmt"
	"log"

	"github.com/joho/godotenv"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if err := godotenv.Load("../../.env"); err != nil {
		log.Println("Tidak ada .env, pakai env system")
	}

	config.LoadConfig()
	config.ConnectDB()

	var u models.User
	err := config.DB.Where("email = ?", "bagasa020@gmail.com").First(&u).Error
	if err != nil {
		fmt.Printf("User bagasa020@gmail.com tidak ditemukan di DB: %v\n", err)
		return
	}

	fmt.Printf("User found: ID=%s | Email=%s | Name=%s | FailedLoginAttempts=%d | LockedUntil=%v\n",
		u.ID, u.Email, u.Name, u.FailedLoginAttempts, u.LockedUntil)

	// Check password
	err = bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte("AdminMotion2026!"))
	if err != nil {
		fmt.Printf("Password check failed for 'AdminMotion2026!': %v\n", err)
		
		// Reset password hash to "AdminMotion2026!"
		hashed, hashErr := bcrypt.GenerateFromPassword([]byte("AdminMotion2026!"), bcrypt.DefaultCost)
		if hashErr != nil {
			log.Fatalf("Gagal hash password baru: %v", hashErr)
		}
		
		u.PasswordHash = string(hashed)
		u.FailedLoginAttempts = 0
		u.LockedUntil = nil
		
		if saveErr := config.DB.Save(&u).Error; saveErr != nil {
			fmt.Printf("Gagal reset password di DB: %v\n", saveErr)
		} else {
			fmt.Println("Password berhasil di-reset ke 'AdminMotion2026!'")
		}
	} else {
		fmt.Println("Password MATCHES 'AdminMotion2026!'")
		
		// If matches, maybe locked or failed attempts?
		if u.FailedLoginAttempts > 0 || u.LockedUntil != nil {
			u.FailedLoginAttempts = 0
			u.LockedUntil = nil
			if saveErr := config.DB.Save(&u).Error; saveErr != nil {
				fmt.Printf("Gagal reset lock status di DB: %v\n", saveErr)
			} else {
				fmt.Println("Status lock/failed attempts berhasil di-reset")
			}
		}
	}
}
