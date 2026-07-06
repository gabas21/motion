package services

import (
	"log"
	"testing"

	"github.com/joho/godotenv"
	"github.com/motion/backend/config"
)

func TestAskAsepLive(t *testing.T) {
	// Load root env first for test context
	_ = godotenv.Load("../.env")

	// Load config first
	config.LoadConfig()
	
	// Initialize Asep Agent
	InitAsepAgent()

	// Prepare input
	input := AIChatInput{
		UserID:      "21606594-17e1-409f-b68b-f179a527f680",
		Message:     "halo asep",
		History:     nil,
		Personality: "productive",
	}

	// Call
	reply, err := AskAsep(input)
	if err != nil {
		t.Fatalf("Error calling AskAsep: %v", err)
	}

	log.Printf("REPLY FROM ASEP: %s", reply)
}
