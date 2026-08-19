package utils

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	ACCESS_TOKEN_EXPIRY  = 30 * time.Minute
	REFRESH_TOKEN_EXPIRY = 7 * 24 * time.Hour
	MIN_SECRET_LENGTH    = 64
)

var (
	jwtSecret   []byte
	jwtSecretMu sync.RWMutex
)

// SetJWTSecret menginisialisasi secret key JWT secara dinamis.
// Harus dipanggil sekali saat startup aplikasi sebelum token dibuat/divalidasi.
func SetJWTSecret(secret string) {
	jwtSecretMu.Lock()
	defer jwtSecretMu.Unlock()
	jwtSecret = []byte(secret)
}

func getJWTSecret() []byte {
	jwtSecretMu.RLock()
	defer jwtSecretMu.RUnlock()
	if len(jwtSecret) > 0 {
		return jwtSecret
	}
	return []byte("super_secret_jwt_key_motion_app_2026_default_must_be_overridden_in_production_env")
}

type CustomClaims struct {
	UserID    uuid.UUID `json:"user_id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	TokenType string    `json:"token_type"` // "access" or "refresh"
	jwt.RegisteredClaims
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

// GenerateTokenPair generates a JWT access + refresh token pair using HS512
func GenerateTokenPair(userID uuid.UUID, email string, role string, secret string) (*TokenPair, error) {
	if len(secret) < MIN_SECRET_LENGTH {
		return nil, fmt.Errorf("JWT secret too short: %d < %d", len(secret), MIN_SECRET_LENGTH)
	}

	now := time.Now()

	// Access Token (short-lived)
	accessClaims := &CustomClaims{
		UserID:    userID,
		Email:     email,
		Role:      role,
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(ACCESS_TOKEN_EXPIRY)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "motion-app",
			Subject:   userID.String(),
			ID:        uuid.New().String(),
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS512, accessClaims)
	accessTokenStr, err := accessToken.SignedString([]byte(secret))
	if err != nil {
		return nil, err
	}

	// Refresh Token (long-lived)
	refreshClaims := &CustomClaims{
		UserID:    userID,
		Email:     email,
		Role:      role,
		TokenType: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(REFRESH_TOKEN_EXPIRY)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "motion-app",
			Subject:   userID.String(),
			ID:        uuid.New().String(),
		},
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS512, refreshClaims)
	refreshTokenStr, err := refreshToken.SignedString([]byte(secret))
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessTokenStr,
		RefreshToken: refreshTokenStr,
		ExpiresIn:    int(ACCESS_TOKEN_EXPIRY.Seconds()),
		TokenType:    "Bearer",
	}, nil
}

// VerifyToken parses and validates a token string against HS512 and custom claims
func VerifyToken(tokenStr string, secret string) (*CustomClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &CustomClaims{}, func(token *jwt.Token) (interface{}, error) {
		if token.Method.Alg() != "HS512" {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("token parse error: %w", err)
	}

	claims, ok := token.Claims.(*CustomClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}

	if claims.ExpiresAt.Time.Before(time.Now()) {
		return nil, fmt.Errorf("token expired at %v", claims.ExpiresAt)
	}

	if claims.Issuer != "motion-app" {
		return nil, fmt.Errorf("invalid issuer: %s", claims.Issuer)
	}

	return claims, nil
}

// RefreshAccessToken handles access token rotation using a valid refresh token
func RefreshAccessToken(refreshTokenStr string, secret string) (*TokenPair, error) {
	claims, err := VerifyToken(refreshTokenStr, secret)
	if err != nil {
		return nil, fmt.Errorf("refresh token invalid: %w", err)
	}

	if claims.TokenType != "refresh" {
		return nil, errors.New("token is not a refresh token")
	}

	return GenerateTokenPair(claims.UserID, claims.Email, claims.Role, secret)
}

// ValidateJWT is a backward-compatible validation wrapper
func ValidateJWT(tokenStr string) (*CustomClaims, error) {
	return VerifyToken(tokenStr, string(getJWTSecret()))
}

// GenerateJWT is a backward-compatible generation wrapper
func GenerateJWT(userID uuid.UUID, email string, role string) (string, error) {
	tokenPair, err := GenerateTokenPair(userID, email, role, string(getJWTSecret()))
	if err != nil {
		return "", err
	}
	return tokenPair.AccessToken, nil
}
