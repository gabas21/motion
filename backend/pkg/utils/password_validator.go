package utils

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode"
)

const (
	MinPasswordLength = 12
	MaxPasswordLength = 128
)

type PasswordValidator struct {
	MinLength           int
	RequireUppercase    bool
	RequireLowercase    bool
	RequireNumbers      bool
	RequireSpecialChars bool
}

var DefaultPasswordValidator = PasswordValidator{
	MinLength:           MinPasswordLength,
	RequireUppercase:    true,
	RequireLowercase:    true,
	RequireNumbers:      true,
	RequireSpecialChars: true,
}

func (pv PasswordValidator) Validate(password string) error {
	if len(password) < pv.MinLength {
		return errors.New("password minimal " + fmt.Sprintf("%d", pv.MinLength) + " karakter")
	}

	if len(password) > MaxPasswordLength {
		return errors.New("password maksimal " + fmt.Sprintf("%d", MaxPasswordLength) + " karakter")
	}

	hasUpper := false
	hasLower := false
	hasNumber := false
	hasSpecial := false

	for _, r := range password {
		if unicode.IsUpper(r) {
			hasUpper = true
		} else if unicode.IsLower(r) {
			hasLower = true
		} else if unicode.IsDigit(r) {
			hasNumber = true
		} else if !unicode.IsLetter(r) && !unicode.IsDigit(r) {
			hasSpecial = true
		}
	}

	if pv.RequireUppercase && !hasUpper {
		return errors.New("password harus mengandung minimal satu huruf besar (A-Z)")
	}
	if pv.RequireLowercase && !hasLower {
		return errors.New("password harus mengandung minimal satu huruf kecil (a-z)")
	}
	if pv.RequireNumbers && !hasNumber {
		return errors.New("password harus mengandung minimal satu angka (0-9)")
	}
	if pv.RequireSpecialChars && !hasSpecial {
		return errors.New("password harus mengandung minimal satu karakter khusus (!@#$%^&*)")
	}

	// Pola umum dinonaktifkan agar memudahkan pengguna membuat password
	/*
	if isCommonPattern(password) {
		return errors.New("password terlalu mudah atau menggunakan pola umum")
	}
	*/

	return nil
}

func isCommonPattern(password string) bool {
	commonPatterns := []string{
		"password", "qwerty", "123456", "admin", "letmein",
		"welcome", "monkey", "dragon", "master", "sunshine",
	}

	lowerPwd := strings.ToLower(password)
	for _, pattern := range commonPatterns {
		if strings.Contains(lowerPwd, pattern) {
			return true
		}
	}

	if matched, _ := regexp.MatchString(`\d{6,}`, password); matched {
		return true
	}

	if matched, _ := regexp.MatchString(`(.)\1{3,}`, password); matched {
		return true
	}

	return false
}
