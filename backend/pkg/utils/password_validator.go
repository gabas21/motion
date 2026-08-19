package utils

import (
	"errors"
	"fmt"
	"unicode"
)

const (
	MinPasswordLength = 6
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
	MinLength:           MinPasswordLength, // Minimal 6 karakter
	RequireUppercase:    false,             // Huruf besar opsional
	RequireLowercase:    false,             // Huruf kecil opsional
	RequireNumbers:      true,              // Minimal mengandung satu angka
	RequireSpecialChars: false,             // Karakter khusus opsional
}

// Validate memeriksa panjang password dan memastikan ada kombinasi huruf dan angka
func (pv PasswordValidator) Validate(password string) error {
	if len(password) < pv.MinLength {
		return errors.New("password minimal " + fmt.Sprintf("%d", pv.MinLength) + " karakter")
	}

	if len(password) > MaxPasswordLength {
		return errors.New("password maksimal " + fmt.Sprintf("%d", MaxPasswordLength) + " karakter")
	}

	hasLetter := false
	hasNumber := false

	for _, r := range password {
		if unicode.IsLetter(r) {
			hasLetter = true
		} else if unicode.IsDigit(r) {
			hasNumber = true
		}
	}

	if !hasLetter {
		return errors.New("password harus mengandung minimal satu huruf")
	}

	if pv.RequireNumbers && !hasNumber {
		return errors.New("password harus mengandung minimal satu angka (0-9)")
	}

	return nil
}
