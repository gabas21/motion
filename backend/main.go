package main

// @title Motion API
// @version 1.0
// @description Backend API Server for Motion Productivity App.
// @host localhost:8080
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/getsentry/sentry-go"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	_ "github.com/motion/backend/docs"
	echoSwagger "github.com/swaggo/echo-swagger"
	"github.com/motion/backend/config"
	"github.com/motion/backend/handlers"
	customMiddleware "github.com/motion/backend/middleware"
	"github.com/motion/backend/services"
)

func main() {
	// 1. Load Configurations
	config.LoadConfig()

	// Initialize Sentry if DSN is configured
	if config.AppConfig.SentryDSN != "" {
		err := sentry.Init(sentry.ClientOptions{
			Dsn:              config.AppConfig.SentryDSN,
			Environment:      config.AppConfig.ServerEnv,
			TracesSampleRate: 0.1,
		})
		if err != nil {
			log.Printf("Sentry initialization failed: %v", err)
		} else {
			log.Println("Sentry error tracking initialized successfully.")
			defer sentry.Flush(2 * time.Second)
		}
	}

	// 2. Connect to Database & Run Migrations
	config.ConnectDB()

	// Inisialisasi Asep AI Agent (Singleton — hanya sekali saat startup)
	services.InitAsepAgent()

	// Inisialisasi WebSocket Hub & Scheduler Pengingat Latar Belakang
	services.InitWebSocketHub()
	services.StartReminderScheduler()
	services.StartLongPolling()
	services.StartWeLearnCronSync()         // Auto-sync WeLearn terjadwal setiap 2 jam dengan semaphore
	services.StartWeLearnDeadlineNotifier() // Pemindaian deadline WeLearn setiap 30 menit

	// 3. Create Echo Instance
	e := echo.New()

	// 4. Register Standard Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	if config.AppConfig.SentryDSN != "" {
		e.Use(customMiddleware.SentryMiddleware())
	}
	e.Use(middleware.GzipWithConfig(middleware.GzipConfig{Level: 5}))
	e.Use(customMiddleware.ConfigureCORS())
	e.Use(customMiddleware.SecurityHeaders())

	// 5. Public Routes
	os.MkdirAll("public/downloads/excuse_letters", 0755)
	e.Static("/downloads", "public/downloads")

	e.GET("/health", func(c echo.Context) error {
		type HealthResponse struct {
			Status      string    `json:"status"` // "healthy" | "degraded" | "unhealthy"
			Database    string    `json:"database"`
			Redis       string    `json:"redis"`
			MLService   string    `json:"ml_service"`
			Environment string    `json:"environment"`
			Timestamp   time.Time `json:"timestamp"`
		}

		res := HealthResponse{
			Status:      "healthy",
			Database:    "healthy",
			Redis:       "healthy",
			MLService:   "healthy",
			Environment: config.AppConfig.ServerEnv,
			Timestamp:   time.Now(),
		}

		// 1. Check DB
		sqlDB, err := config.DB.DB()
		if err != nil || sqlDB.Ping() != nil {
			res.Database = "unhealthy"
			res.Status = "unhealthy"
		}

		// 2. Check Redis via TCP ping
		redisHost := config.AppConfig.RedisHost
		redisPort := config.AppConfig.RedisPort
		if redisHost == "" {
			redisHost = "localhost"
		}
		if redisPort == "" {
			redisPort = "6379"
		}
		connRedis, errRedis := net.DialTimeout("tcp", net.JoinHostPort(redisHost, redisPort), 1*time.Second)
		if errRedis != nil {
			res.Redis = "unhealthy"
			if res.Status != "unhealthy" {
				res.Status = "degraded"
			}
		} else {
			connRedis.Close()
		}

		// 3. Check ML Service via TCP ping
		mlHost := "localhost"
		mlPort := "8000"
		u, errParse := url.Parse(config.AppConfig.MLServiceURL)
		if errParse == nil {
			host, port, errSplit := net.SplitHostPort(u.Host)
			if errSplit == nil {
				mlHost = host
				mlPort = port
			} else {
				mlHost = u.Host
				if u.Scheme == "https" {
					mlPort = "443"
				} else {
					mlPort = "80"
				}
			}
		}
		connML, errML := net.DialTimeout("tcp", net.JoinHostPort(mlHost, mlPort), 1*time.Second)
		if errML != nil {
			res.MLService = "unhealthy"
			if res.Status != "unhealthy" {
				res.Status = "degraded"
			}
		} else {
			connML.Close()
		}

		statusHTTP := http.StatusOK
		if res.Status == "unhealthy" {
			statusHTTP = http.StatusServiceUnavailable
		}

		return c.JSON(statusHTTP, res)
	})

	// Swagger documentation route
	e.GET("/swagger/*", echoSwagger.WrapHandler)

	api := e.Group("/api/v1")

	// Public Webhook Endpoints
	api.POST("/webhook/telegram", handlers.HandleTelegramWebhook)
	api.POST("/payment/webhook", handlers.HandleTripayWebhook)

	// Authentication Endpoints (Public)
	// Rate limit: max 10 request/menit per IP untuk mencegah brute force
	authRateLimiter := middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(10))
	authGroup := api.Group("/auth")
	authGroup.POST("/register", handlers.Register, authRateLimiter)
	authGroup.POST("/login", handlers.Login, customMiddleware.RateLimitLogin(customMiddleware.LoginLimiter))
	authGroup.POST("/logout", handlers.Logout)
	authGroup.POST("/refresh", handlers.RefreshToken)

	// Email verification and password reset routes
	verifyRateLimiter := middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(3))
	resetRateLimiter := middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(3))
	authGroup.POST("/verify-email/request", handlers.RequestEmailVerification, verifyRateLimiter)
	authGroup.GET("/verify-email", handlers.VerifyEmail)
	authGroup.POST("/request-password-reset", handlers.RequestPasswordReset, resetRateLimiter)
	authGroup.POST("/reset-password", handlers.ResetPassword, resetRateLimiter)

	// User Profile Endpoint (Protected)
	authGroup.GET("/me", handlers.GetMe, customMiddleware.AuthRequired)
	authGroup.PUT("/me", handlers.UpdateMe, customMiddleware.AuthRequired)
	api.GET("/users/quota", handlers.GetUserQuota, customMiddleware.AuthRequired)
	api.GET("/weather", handlers.GetWeatherProxy, customMiddleware.AuthRequired)

	// Telegram Integration Endpoints (Protected)
	authGroup.POST("/telegram/otp", handlers.GenerateTelegramOTP, customMiddleware.AuthRequired)
	authGroup.GET("/telegram/status", handlers.GetTelegramStatus, customMiddleware.AuthRequired)
	authGroup.POST("/telegram/unlink", handlers.UnlinkTelegram, customMiddleware.AuthRequired)

	// Task CRUD Endpoints (Protected)
	tasksGroup := api.Group("/tasks", customMiddleware.AuthRequired)
	tasksGroup.POST("", handlers.CreateTask)
	tasksGroup.GET("", handlers.GetTasks)
	tasksGroup.GET("/:id", handlers.GetTask)
	tasksGroup.PATCH("/:id", handlers.UpdateTask)
	tasksGroup.PATCH("/:id/complete", handlers.CompleteTask)
	tasksGroup.DELETE("/:id", handlers.DeleteTask)

	// Calendar Integration Endpoints (Protected)
	calendarGroup := api.Group("/calendar", customMiddleware.AuthRequired)
	calendarGroup.POST("/connect", handlers.ConnectCalendar)
	calendarGroup.GET("/events", handlers.GetCalendarEvents)
	calendarGroup.POST("/sync", handlers.SyncCalendar)
	calendarGroup.GET("/connections", handlers.GetConnections)
	calendarGroup.DELETE("/connections/:id", handlers.DisconnectConnection)

	// AI Scheduling Endpoints (Protected)
	schedulingGroup := api.Group("/scheduling", customMiddleware.AuthRequired)
	schedulingGroup.POST("/auto-schedule", handlers.AutoScheduleTask)
	schedulingGroup.GET("/preferences", handlers.GetPreferences)
	schedulingGroup.PATCH("/preferences", handlers.UpdatePreferences)

	// AI Core Engine Chat Endpoints (Protected)
	// Rate limit: max 3 request/menit per IP untuk mencegah abuse AI
	aiRateLimiter := middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(3))
	aiGroup := api.Group("/ai", customMiddleware.AuthRequired)
	aiGroup.POST("/chat", handlers.HandleAIChat, aiRateLimiter)
	aiGroup.POST("/documents/upload", handlers.UploadDocument)
	aiGroup.POST("/documents/generate-docx-direct", handlers.HandleGenerateDocxDirect)
	aiGroup.GET("/config", handlers.HandleGetAIConfig)
	aiGroup.PUT("/config", handlers.HandleSaveAIConfig)

	// Public AI status & debugging endpoints
	api.GET("/ai/health", handlers.HandleAIHealth)
	api.POST("/ai/reset-provider/:name", handlers.HandleResetProvider)

	// Subscription Endpoints (Protected)
	subscriptionGroup := api.Group("/subscription", customMiddleware.AuthRequired)
	subscriptionGroup.GET("/status", handlers.GetSubscriptionStatus)
	subscriptionGroup.POST("/upgrade", handlers.UpgradeSubscription)

	// Analytics Endpoints (Protected)
	analyticsGroup := api.Group("/analytics", customMiddleware.AuthRequired)
	analyticsGroup.GET("/dashboard", handlers.GetAnalyticsDashboard)
	analyticsGroup.GET("/insights", handlers.GetAnalyticsInsights)
	analyticsGroup.GET("/pdf", handlers.ExportProductivityPDF)

	// Moodle WeLearn Endpoints (Protected)
	moodleHandler := &handlers.MoodleHandler{DB: config.DB}
	moodleGroup := api.Group("/moodle", customMiddleware.AuthRequired)
	moodleGroup.POST("/connect", moodleHandler.Connect)
	moodleGroup.GET("/status", moodleHandler.Status)
	moodleGroup.POST("/sync", moodleHandler.Sync)
	moodleGroup.GET("/assignments", moodleHandler.GetAssignments)
	moodleGroup.GET("/courses", moodleHandler.GetCourses)
	moodleGroup.GET("/courses/:courseId/assignments", moodleHandler.GetCourseAssignments)
	moodleGroup.POST("/disconnect", moodleHandler.Disconnect)
	moodleGroup.GET("/debug", moodleHandler.DebugScrape)
	moodleGroup.POST("/excuse-letters", moodleHandler.CreateExcuseLetter)
	moodleGroup.GET("/excuse-letters", moodleHandler.GetExcuseLetters)
	moodleGroup.DELETE("/excuse-letters/:id", moodleHandler.DeleteExcuseLetter)

	// SIAK Integration Endpoints (Protected)
	siakGroup := api.Group("/siak", customMiddleware.AuthRequired)
	siakGroup.POST("/connect", handlers.ConnectSiak)
	siakGroup.GET("/grades", handlers.GetSiakGrades)
	siakGroup.POST("/sync", handlers.SyncSiakGrades)
	siakGroup.DELETE("/disconnect", handlers.DisconnectSiak)

	// WebSocket Real-time Endpoint (Protected)
	api.GET("/ws", func(c echo.Context) error {
		userIDVal := c.Get("userId")
		userID, ok := userIDVal.(uuid.UUID)
		if !ok {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		}
		services.HandleWebSocketConnection(c.Response().Writer, c.Request(), userID.String())
		return nil
	}, customMiddleware.AuthRequired)

	// Admin Dashboard Endpoints (Protected & Admin Only)
	adminGroup := api.Group("/admin", customMiddleware.AuthRequired, customMiddleware.AdminOnly)
	adminGroup.GET("/stats", handlers.GetAdminStats)
	adminGroup.GET("/users", handlers.GetAdminUsers)
	adminGroup.GET("/users/:id", handlers.GetAdminUser)
	adminGroup.PATCH("/users/:id/role", handlers.UpdateUserRole)
	adminGroup.PATCH("/users/:id/suspend", handlers.ToggleSuspendUser)
	adminGroup.PATCH("/users/:id/plan", handlers.AdminUpdatePlan)
	adminGroup.PATCH("/users/:id/force-reset", handlers.AdminForcePasswordReset)
	adminGroup.DELETE("/users/:id", handlers.AdminDeleteUser)
	adminGroup.GET("/activity", handlers.GetSystemActivity)
	adminGroup.GET("/audit-logs", handlers.GetAuditLogs) // Audit trail lengkap dengan filter

	// Internal API — Untuk MCP Server (Hermes Agent) dari dalam Docker network.
	// Dilindungi X-Internal-Secret header, BUKAN JWT user.
	// ⚠️ Jangan expose port ini ke publik!
	internalGroup := api.Group("/internal", customMiddleware.InternalAuthRequired)
	internalGroup.GET("/tasks", handlers.GetTasks)                       // Ambil tasks user
	internalGroup.POST("/tasks", handlers.CreateTask)                    // Buat task baru
	internalGroup.POST("/tasks/complete", handlers.CompleteTaskViaAI)    // Selesaikan task via AI
	internalGroup.POST("/scheduling/trigger", handlers.TriggerAllSchedule)     // Memicu AI scheduler (route mismatch compatibility)
	internalGroup.POST("/scheduling/trigger-all", handlers.TriggerAllSchedule) // Memicu AI scheduler (legacy)
	internalGroup.POST("/scheduling/study-block", handlers.ScheduleStudyBlock) // Jadwalkan study block via AI
	internalGroup.POST("/ai/chat", handlers.HandleAIChat)               // Chat dengan Asep (bagi Hermes)

	// 6. Start HTTP Server
	serverAddr := fmt.Sprintf(":%s", config.AppConfig.ServerPort)
	
	// Run server in a goroutine so it doesn't block the signal channel
	go func() {
		log.Printf("Starting Motion backend server on port %s...", config.AppConfig.ServerPort)
		if err := e.Start(serverAddr); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server stopped unexpectedly: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shut down the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down Motion backend server gracefully...")

	// Timeout 15 seconds for active connections to finish
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := e.Shutdown(ctx); err != nil {
		log.Fatalf("Server shutdown failed: %v", err)
	}
	log.Println("Motion backend server exited cleanly.")
}
