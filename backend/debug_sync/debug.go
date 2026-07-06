package main

import (
	"log"

	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/services"
)

func main() {
	log.Println("=== STARTING DIRECT REST DEBUG SYNC ===")
	config.LoadConfig()
	config.ConnectDB()

	var conn models.MoodleConnection
	err := config.DB.Where("is_connected = true").First(&conn).Error
	if err != nil {
		log.Fatalf("No active moodle connection found: %v", err)
	}

	log.Printf("Processing connection for UserID: %s, Username: %s", conn.UserID, conn.MoodleUsername)

	err = services.SyncViaREST(config.DB, &conn, nil)
	if err != nil {
		log.Fatalf("CRITICAL ERROR DURING SYNC: %v", err)
	}

	log.Println("=== SYNC COMPLETED SUCCESSFULLY ===")
}
