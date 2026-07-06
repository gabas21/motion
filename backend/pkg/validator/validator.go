package validator

import (
	"fmt"
	"sync"

	gv "github.com/go-playground/validator/v10"
)

var (
	instance *gv.Validate
	once     sync.Once
)

// Get returns the single instance of the validator.
func Get() *gv.Validate {
	once.Do(func() {
		instance = gv.New()
	})
	return instance
}

// FieldError represents a validation error on a specific struct field.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Validate validates a struct and returns descriptive field errors if any are found.
func Validate(data any) []FieldError {
	var errs []FieldError
	if err := Get().Struct(data); err != nil {
		for _, e := range err.(gv.ValidationErrors) {
			errs = append(errs, FieldError{
				Field:   e.Field(),
				Message: fmt.Sprintf("gagal validasi '%s'", e.Tag()),
			})
		}
	}
	return errs
}
