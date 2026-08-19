package services

import (
	"context"
	"testing"
	"time"
)

func TestGetKeyLast4(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"AIzaSyD-1234567890ABCD", "ABCD"},
		{"gsk_abcdef1234", "1234"},
		{"abc", "abc"},
		{"", ""},
		{"   sk-proj-xyz9876   ", "9876"},
	}

	for _, tt := range tests {
		result := GetKeyLast4(tt.input)
		if result != tt.expected {
			t.Errorf("GetKeyLast4(%q) = %q; expected %q", tt.input, result, tt.expected)
		}
	}
}

func TestValidateProviderKey_RejectsEmptyAndInvalid(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Empty key
	if err := ValidateProviderKey(ctx, "gemini", ""); err == nil {
		t.Errorf("Expected error for empty API key, got nil")
	}

	// Unsupported provider
	if err := ValidateProviderKey(ctx, "invalid_provider", "some_key"); err == nil {
		t.Errorf("Expected error for unsupported provider, got nil")
	}

	// Fake key test call to Gemini (should fail fast with HTTP error or network timeout)
	err := ValidateProviderKey(ctx, "gemini", "INVALID_FAKE_KEY_12345")
	if err == nil {
		t.Errorf("Expected error for invalid fake Gemini key, got nil")
	}
}
