package config

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func ConnectDB() {
	// Format DSN PostgreSQL untuk koneksi ke Supabase (remote)
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=require TimeZone=UTC connect_timeout=30",
		AppConfig.DBHost,
		AppConfig.DBUser,
		AppConfig.DBPassword,
		AppConfig.DBName,
		AppConfig.DBPort,
	)

	// Konfigurasi logger GORM — naikkan SlowThreshold agar tidak noise
	// (koneksi ke Supabase remote memang lebih lambat dari lokal, itu normal)
	gormLogger := logger.New(
		log.Default(),
		logger.Config{
			SlowThreshold:             100 * time.Millisecond, // Alert lebih sensitif untuk query non-vector
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true, // Jangan log ErrRecordNotFound (itu bukan error)
			Colorful:                  false,
		},
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: gormLogger,
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Konfigurasi connection pool agar lebih stabil untuk koneksi remote
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("Failed to get sql.DB from gorm: %v", err)
	}
	sqlDB.SetMaxOpenConns(25)           // Lebih besar untuk paralel request AI + scheduler
	sqlDB.SetMaxIdleConns(10)           // Jaga koneksi siap pakai
	sqlDB.SetConnMaxLifetime(10 * time.Minute)  // Supabase pooler: koneksi lebih tahan lama
	sqlDB.SetConnMaxIdleTime(3 * time.Minute)

	// Verifikasi koneksi DB benar-benar dapat dijangkau saat startup dengan retry
	// (mengatasi Supabase cold start)
	maxRetries := 5
	var pingErr error
	for i := 1; i <= maxRetries; i++ {
		pingErr = sqlDB.Ping()
		if pingErr == nil {
			break
		}
		if i < maxRetries {
			log.Printf("[DB-Retry] Ping gagal (percobaan %d/%d): %v. Menunggu %d detik...", i, maxRetries, pingErr, i*2)
			time.Sleep(time.Duration(i*2) * time.Second)
		}
	}
	if pingErr != nil {
		log.Fatalf("Database tidak bisa dijangkau setelah %d percobaan: %v", maxRetries, pingErr)
	}


	log.Println("Database connection established and ping OK.")


	// Auto Migration
	err = db.AutoMigrate(
		&models.User{},
		&models.Task{},
		&models.CalendarConnection{},
		&models.CalendarEvent{},
		&models.SchedulingPreference{},
		&models.AnalyticsLog{},
		&models.MoodleConnection{},
		&models.MoodleCourse{},
		&models.MoodleAssignment{},
		&models.MoodleExcuseLetter{},
		&models.UserAIConfig{},
		&models.ChatHistory{}, // Persistent memory Asep AI lintas sesi
		&models.UserUsage{},
		&models.AuditLog{},    // Audit trail untuk semua aksi penting
		&models.Subscription{}, // Detail & riwayat transaksi langganan
	)
	if err != nil {
		log.Fatalf("Failed to run database migrations: %v", err)
	}

	log.Println("Database migration completed successfully.")

	// Seed super-admin dari environment configuration
	adminEmail := AppConfig.AdminEmail
	adminPassword := AppConfig.AdminPassword

	var adminUser models.User
	result := db.Where("email = ?", adminEmail).First(&adminUser)
	if result.Error != nil {
		adminUser = models.User{
			Email:         adminEmail,
			Name:          "Admin Motion",
			Timezone:      "Asia/Jakarta",
			Role:          "admin",
			EmailVerified: true, // Admin seed tidak butuh verifikasi email
		}
		if err := adminUser.HashPassword(adminPassword); err == nil {
			if err := db.Create(&adminUser).Error; err != nil {
				log.Printf("[Admin-Error] Gagal membuat super-admin seed: %v", err)
			} else {
				log.Printf("[Admin] Super-admin %s created successfully.", adminEmail)
			}
		} else {
			log.Printf("[Admin-Error] Gagal melakukan hash password admin seed: %v", err)
		}
	} else {
		// Selalu enforce email_verified=true dan role=admin untuk akun admin seed
		db.Model(&adminUser).Updates(map[string]interface{}{
			"role":           "admin",
			"email_verified": true,
		})
		// Update password if it doesn't match current environment configuration
		if !adminUser.CheckPassword(adminPassword) {
			if err := adminUser.HashPassword(adminPassword); err == nil {
				db.Model(&adminUser).Updates(map[string]interface{}{
					"password_hash":  adminUser.PasswordHash,
					"role":           "admin",
					"email_verified": true,
				})
				log.Printf("[Admin] Password, role, and email_verified updated for existing super-admin %s.", adminEmail)
			}
		} else {
			log.Printf("[Admin] Super-admin role & email_verified enforced for %s.", adminEmail)
		}
	}

	// Inisialisasi Ekstensi pgvector & Tabel document_chunks (Untuk Pencarian RAG Semantik)
	db.Exec("CREATE EXTENSION IF NOT EXISTS vector")
	err = db.Exec(`
		CREATE TABLE IF NOT EXISTS document_chunks (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id VARCHAR(36) NOT NULL,
			document_name VARCHAR(255) NOT NULL,
			content TEXT NOT NULL,
			embedding vector(768) NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)
	`).Error
	if err != nil {
		log.Printf("[Database-Warn] Gagal memverifikasi tabel document_chunks: %v (Apakah database Supabase mendukung pgvector?)", err)
	} else {
		db.Exec("CREATE INDEX IF NOT EXISTS document_chunks_hnsw_idx ON document_chunks USING hnsw (embedding vector_cosine_ops)")
		db.Exec("CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id ON document_chunks (user_id)")
		log.Println("Database pgvector document_chunks & index HNSW & user_id index verified successfully.")
	}

	DB = db

	// Inject audit persist function — menghindari import cycle antara utils dan models/config
	utils.SetAuditPersistFunc(func(entry utils.AuditEntry) {
		detailsJSON, _ := json.Marshal(entry.Details)
		auditLog := models.AuditLog{
			UserID:       entry.UserID,
			Action:       entry.Action,
			Category:     entry.Category,
			ResourceType: entry.ResourceType,
			ResourceID:   entry.ResourceID,
			Details:      string(detailsJSON),
			IPAddress:    entry.IPAddress,
			UserAgent:    entry.UserAgent,
			Status:       entry.Status,
		}
		if auditLog.Status == "" {
			auditLog.Status = "success"
		}
		if err := db.Create(&auditLog).Error; err != nil {
			log.Printf("[AUDIT-ERROR] Gagal menyimpan audit log ke DB: %v", err)
		}
	})
}

// QueryCtx mengembalikan context dengan timeout 8 detik untuk query database.
// Gunakan ini sebagai pengganti context.Background() pada query GORM.
func QueryCtx() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 8*time.Second)
}
