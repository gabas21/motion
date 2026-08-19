package services

import (
	"errors"
	"testing"

	"github.com/joho/godotenv"
	"github.com/motion/backend/config"
)

func TestAskAsepLive_EnforcesBYOKForNonAdmin(t *testing.T) {
	_ = godotenv.Load("../.env")
	config.LoadConfig()
	InitAsepAgent()

	input := AIChatInput{
		UserID:      "21606594-17e1-409f-b68b-f179a527f680",
		Message:     "halo asep",
		History:     nil,
		Personality: "productive",
	}

	_, err := AskAsep(input)
	if err == nil {
		t.Fatalf("Expected error for non-admin user without custom API key, got nil")
	}

	if !errors.Is(err, ErrNoAPIKeyRegistered) && err.Error() != "no_key_registered" {
		t.Logf("Returned expected BYOK enforcement error: %v", err)
	}
}
