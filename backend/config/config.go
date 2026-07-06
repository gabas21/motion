package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"github.com/motion/backend/pkg/utils"
)

type Config struct {
	ServerPort           string
	ServerEnv            string
	DBHost               string
	DBPort               string
	DBUser               string
	DBPassword           string
	DBName               string
	JWTSecret            string
	JWTExpiration        string
	GoogleClientID       string
	GoogleClientSecret   string
	FrontendURL          string
	SMTPHost             string
	SMTPPort             string
	SMTPUser             string
	SMTPPassword         string
	TelegramBotToken     string
	OpenRouterAPIKey     string
	OpenRouterModel      string
	GeminiAPIKey         string
	GeminiModel          string
	GroqAPIKey           string
	GroqModel            string
	ActiveSemesterPrefix  string
	AcademicYearPrefix    string
	MLServiceURL          string
	HermesInternalSecret  string // Secret untuk auth internal MCP Server (opsional)
	DbEncryptionKey       string
	WeatherAPIKey        string
	AdminEmail           string
	AdminPassword        string
	SentryDSN            string
	TripayApiKey         string
	TripayPrivateKey     string
	TripayMerchantCode   string
	TripayApiURL         string
}

var AppConfig *Config

func LoadConfig() {
	// Try loading from .env, if it fails, assume system env is used
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found or error loading it, reading from system environment variables")
	}

	env := getEnv("SERVER_ENV", "development")

	// Validate DB_PASSWORD
	dbPass := getEnv("DB_PASSWORD", "")
	if dbPass == "" {
		log.Fatalf("FATAL: DB_PASSWORD tidak dikonfigurasi di .env")
	}
	if dbPass == "Floresita_201004" {
		if env == "production" {
			log.Fatalf("SECURITY ERROR: Menggunakan default password! Change immediately!")
		} else {
			log.Println("[SECURITY WARNING] Menggunakan default password 'Floresita_201004'! Segera ganti sebelum masuk ke production!")
		}
	}

	jwtSecret := getEnv("JWT_SECRET", "")
	if jwtSecret == "" {
		log.Fatalf("CRITICAL SECURITY ERROR: JWT_SECRET environment variable is required and cannot be empty!")
	}
	// Tolak nilai default dari .env.example — developer harus menggantinya
	defaultPlaceholders := []string{
		"your_super_secret_jwt_key_change_this_in_production",
		"your-secret-key",
		"secret",
		"changeme",
	}
	for _, placeholder := range defaultPlaceholders {
		if jwtSecret == placeholder {
			log.Fatalf("CRITICAL SECURITY ERROR: JWT_SECRET masih menggunakan nilai default '%s'. Ganti dengan nilai acak yang kuat di file .env!", placeholder)
		}
	}
	if len(jwtSecret) < 64 {
		log.Fatalf("CRITICAL SECURITY ERROR: JWT_SECRET must be at least 64 characters long to ensure cryptographic strength (current length: %d)", len(jwtSecret))
	}

	dbEncryptionKey := getEnv("DB_ENCRYPTION_KEY", "")
	if dbEncryptionKey == "" {
		log.Println("[WARN] DB_ENCRYPTION_KEY tidak diset di .env. Menggunakan JWT_SECRET sebagai fallback. Ini tidak direkomendasikan di production!")
		dbEncryptionKey = jwtSecret
	} else if len(dbEncryptionKey) < 32 {
		log.Fatalf("CRITICAL SECURITY ERROR: DB_ENCRYPTION_KEY must be at least 32 characters long to ensure cryptographic strength (current length: %d)", len(dbEncryptionKey))
	}

	AppConfig = &Config{
		ServerPort:         getEnv("SERVER_PORT", "8080"),
		ServerEnv:          env,
		DBHost:             getEnv("DB_HOST", "localhost"),
		DBPort:             getEnv("DB_PORT", "5432"),
		DBUser:             getEnv("DB_USER", "postgres"),
		DBPassword:         dbPass,
		DBName:             getEnv("DB_NAME", "postgres"),
		JWTSecret:          jwtSecret,
		JWTExpiration:      getEnv("JWT_EXPIRATION", "24h"),
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		FrontendURL:        getEnv("FRONTEND_URL", "http://localhost:3000"),
		SMTPHost:           getEnv("SMTP_HOST", "localhost"),
		SMTPPort:           getEnv("SMTP_PORT", "1025"),
		SMTPUser:           getEnv("SMTP_USER", ""),
		SMTPPassword:       getEnv("SMTP_PASSWORD", ""),
		TelegramBotToken:   getEnv("TELEGRAM_BOT_TOKEN", ""),
		OpenRouterAPIKey:   getEnv("OPENROUTER_API_KEY", ""),
		OpenRouterModel:    getEnv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free"),
		GeminiAPIKey:         getEnv("GEMINI_API_KEY", ""),
		GeminiModel:          getEnv("GEMINI_MODEL", "gemini-2.0-flash"), // gemini-3.5-flash tidak ada
		GroqAPIKey:           getEnv("GROQ_API_KEY", ""),
		GroqModel:            getEnv("GROQ_MODEL", "llama-3.3-70b-versatile"),
		ActiveSemesterPrefix:  getEnv("ACTIVE_SEMESTER_PREFIX", ""),
		AcademicYearPrefix:    strings.Split(getEnv("ACTIVE_SEMESTER_PREFIX", ""), "_")[0],
		MLServiceURL:          getEnv("ML_SERVICE_URL", "http://localhost:8000"),
		HermesInternalSecret:  getEnv("HERMES_INTERNAL_SECRET", ""),
		DbEncryptionKey:       dbEncryptionKey,
		WeatherAPIKey:        getEnv("WEATHER_API_KEY", ""),
		AdminEmail:         getEnv("ADMIN_EMAIL", "bagasa020@gmail.com"),
		AdminPassword:      getEnv("ADMIN_PASSWORD", "AdminMotion2026!"),
		SentryDSN:          getEnv("SENTRY_DSN", ""),
		TripayApiKey:       getEnv("TRIPAY_API_KEY", "DEV-your-tripay-api-key"),
		TripayPrivateKey:   getEnv("TRIPAY_PRIVATE_KEY", "your-tripay-private-key"),
		TripayMerchantCode: getEnv("TRIPAY_MERCHANT_CODE", "T12345"),
		TripayApiURL:       getEnv("TRIPAY_API_URL", "https://tripay.co.id/api-sandbox"),
	}

	// Inisialisasi kunci enkripsi dan JWT secara runtime untuk memecah siklus import
	utils.SetJWTSecret(AppConfig.JWTSecret)
	utils.SetEncryptionKey(AppConfig.DbEncryptionKey)
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
