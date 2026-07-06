package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
)

type RateLimiter struct {
	attempts    map[string][]time.Time
	mu          sync.RWMutex
	maxAttempts int
	windowSize  time.Duration
}

func NewRateLimiter(maxAttempts int, windowSize time.Duration) *RateLimiter {
	rl := &RateLimiter{
		attempts:    make(map[string][]time.Time),
		maxAttempts: maxAttempts,
		windowSize:  windowSize,
	}

	// Cleanup old entries every minute
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			rl.cleanup()
		}
	}()

	return rl
}

func (rl *RateLimiter) IsAllowed(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-rl.windowSize)

	// Get attempts within window
	attempts := rl.attempts[key]
	validAttempts := []time.Time{}
	for _, attempt := range attempts {
		if attempt.After(windowStart) {
			validAttempts = append(validAttempts, attempt)
		}
	}

	// Check if limit exceeded
	if len(validAttempts) >= rl.maxAttempts {
		rl.attempts[key] = validAttempts
		return false
	}

	// Add new attempt
	validAttempts = append(validAttempts, now)
	rl.attempts[key] = validAttempts
	return true
}

func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-rl.windowSize)

	for key, attempts := range rl.attempts {
		validAttempts := []time.Time{}
		for _, attempt := range attempts {
			if attempt.After(windowStart) {
				validAttempts = append(validAttempts, attempt)
			}
		}

		if len(validAttempts) == 0 {
			delete(rl.attempts, key)
		} else {
			rl.attempts[key] = validAttempts
		}
	}
}

// Global Limiter instance for Login
var LoginLimiter = NewRateLimiter(5, 1*time.Minute)

// RateLimitLogin restricts login requests by IP and email
func RateLimitLogin(limiter *RateLimiter) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			var email string

			// Support reading email from JSON request body without permanently consuming the body
			if c.Request().Header.Get(echo.HeaderContentType) == echo.MIMEApplicationJSON {
				bodyBytes, err := io.ReadAll(c.Request().Body)
				if err == nil {
					// Restore body
					c.Request().Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

					var bodyStruct struct {
						Email string `json:"email"`
					}
					json.Unmarshal(bodyBytes, &bodyStruct)
					email = bodyStruct.Email
				}
			} else {
				email = c.FormValue("email")
			}

			clientIP := c.RealIP()
			emailKey := fmt.Sprintf("login:email:%s", email)
			ipKey := fmt.Sprintf("login:ip:%s", clientIP)

			if (email != "" && !limiter.IsAllowed(emailKey)) || !limiter.IsAllowed(ipKey) {
				return c.JSON(http.StatusTooManyRequests, map[string]string{
					"error": "Terlalu banyak percobaan login. Coba lagi dalam 1 menit.",
				})
			}

			return next(c)
		}
	}
}
