package services

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"strings"
	"sync"
	"time"

	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
	"github.com/google/uuid"
	"github.com/motion/backend/pkg/logger"
	"google.golang.org/genai"

)

// ─── Structs OpenRouter ───────────────────────────────────────────────────────

type OpenRouterMessage struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"`
}

type OpenRouterFunction struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
}

type OpenRouterTool struct {
	Type     string              `json:"type"`
	Function *OpenRouterFunction `json:"function"`
}

type OpenRouterRequest struct {
	Model    string              `json:"model"`
	Messages []OpenRouterMessage `json:"messages"`
	Tools    []OpenRouterTool    `json:"tools,omitempty"`
}

type OpenRouterToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type OpenRouterResponse struct {
	Choices []struct {
		Message struct {
			Role      string               `json:"role"`
			Content   string               `json:"content"`
			ToolCalls []OpenRouterToolCall `json:"tool_calls,omitempty"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
	} `json:"error,omitempty"`
}

// ─── Structs Groq ─────────────────────────────────────────────────────────────

type GroqMessage struct {
	Role       string         `json:"role"`
	Content    interface{}    `json:"content,omitempty"`
	Name       string         `json:"name,omitempty"`
	ToolCallID string         `json:"tool_call_id,omitempty"`
	ToolCalls  []GroqToolCall `json:"tool_calls,omitempty"`
}

type GroqToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type GroqRequest struct {
	Model    string           `json:"model"`
	Messages []GroqMessage    `json:"messages"`
	Tools    []OpenRouterTool `json:"tools,omitempty"`
}

type GroqResponse struct {
	Choices []struct {
		Message struct {
			Role      string         `json:"role"`
			Content   string         `json:"content"`
			ToolCalls []GroqToolCall `json:"tool_calls,omitempty"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// ─── Asep Singleton Agent ─────────────────────────────────────────────────────

// AsepAgent adalah struct yang menyimpan semua dependensi Asep AI.
// Client SDK hanya dibuat sekali saat startup untuk efisiensi koneksi (connection pooling).
type AsepAgent struct {
	geminiClient *genai.Client
	httpClient   *http.Client
}

var (
	GlobalAsep *AsepAgent
	asepOnce   sync.Once
)

// InitAsepAgent menginisialisasi singleton Asep Agent satu kali saat startup.
// HARUS dipanggil dari main.go setelah LoadConfig().
func InitAsepAgent() {
	asepOnce.Do(func() {
		// CATATAN: InsecureSkipVerify TIDAK diset di DefaultTransport global
		// karena itu akan menonaktifkan TLS verification untuk SEMUA request HTTP
		// di seluruh proses (termasuk Supabase, Gemini). InsecureSkipVerify hanya
		// ada di httpClient AsepAgent sendiri untuk mengatasi self-signed cert
		// Windows/Laragon di environment development lokal.

		apiKey := config.AppConfig.GeminiAPIKey

		var geminiClient *genai.Client
		if apiKey != "" {
			ctx := context.Background()
			client, err := genai.NewClient(ctx, &genai.ClientConfig{
				APIKey:  apiKey,
				Backend: genai.BackendGeminiAPI,
			})
			if err != nil {
				logger.Error("Failed to create Gemini client, falling back to OpenRouter", err)
			} else {
				geminiClient = client
				logger.Info("Singleton Gemini SDK client loaded successfully", "model", config.AppConfig.GeminiModel)
			}
		} else {
			logger.Info("Gemini API Key not configured, using OpenRouter as primary")
		}

		// Konfigurasi TLS — InsecureSkipVerify HANYA diaktifkan di environment development
		// untuk mengatasi self-signed cert Windows/Laragon.
		// Di production, TLS verification selalu aktif.
		tlsConfig := &tls.Config{}
		if config.AppConfig != nil && config.AppConfig.ServerEnv == "development" {
			tlsConfig.InsecureSkipVerify = true //nolint:gosec
			logger.Warn("TLS verification disabled (development mode)")
		}

		GlobalAsep = &AsepAgent{
			geminiClient: geminiClient,
			httpClient: &http.Client{
				// [Fix #1] Timeout dihapus agar tidak konflik dengan context timeout per-request
				Transport: &http.Transport{
					TLSClientConfig: tlsConfig,
				},
			},
		}

		logger.Info("Asep AI Agent initialized successfully")
	})
}

// ─── AIChatRequest ────────────────────────────────────────────────────────────

// AIChatInput adalah struktur input dari handler setelah binding request.
type AIChatInput struct {
	UserID      string
	Message     string
	History     []map[string]string
	Personality string // "productive" | "bestie" | "academic"
	ImageBase64 string // Opsional: gambar soal di-encode sebagai base64
	InstantMode bool   // Jika true: otomatis generate .docx dari jawaban akademik
}

// AIChatKeys menyimpan API Key yang siap dipakai untuk satu request chat
var (
	ErrNoAPIKeyRegistered   = fmt.Errorf("no_key_registered")
	ErrAPIKeyInvalidOrQuota = fmt.Errorf("key_invalid_or_quota")
)

type AIChatKeys struct {
	GeminiKey     string
	GroqKey       string
	OpenRouterKey string
	HasValidKey   bool
	Reason        string // "no_key_registered" | ""
}

// fetchUserKeys mengambil kunci milik user dari DB. Untuk non-admin, wajib memiliki kunci kustom terverifikasi (BYOK).
func fetchUserKeys(userIDStr string) AIChatKeys {
	userUUID, err := uuid.Parse(userIDStr)
	var user models.User
	isPrivileged := false
	if err == nil && config.DB != nil {
		if err := config.DB.Select("id", "role").First(&user, "id = ?", userUUID).Error; err == nil {
			isPrivileged = user.IsPrivileged()
		}
	}

	enforceBYOK := true
	if config.AppConfig != nil {
		enforceBYOK = config.AppConfig.EnforceBYOKForNonAdmin
	}
	isBYOKEnforced := enforceBYOK && !isPrivileged

	keys := AIChatKeys{
		HasValidKey: false,
		Reason:      "no_key_registered",
	}

	// 1. Coba ambil custom key dari DB terlebih dahulu
	if err == nil && config.DB != nil {
		var userCfg models.UserAIConfig
		if err := config.DB.Where("user_id = ?", userUUID).First(&userCfg).Error; err == nil {
			if userCfg.EncryptedGeminiKey != "" && userCfg.GeminiIsValid {
				decrypted, err := utils.DecryptWithSalt(userCfg.EncryptedGeminiKey, userUUID.String())
				if err == nil && decrypted != "" {
					keys.GeminiKey = decrypted
					keys.HasValidKey = true
				}
			}
			if userCfg.EncryptedGroqKey != "" && userCfg.GroqIsValid {
				decrypted, err := utils.DecryptWithSalt(userCfg.EncryptedGroqKey, userUUID.String())
				if err == nil && decrypted != "" {
					keys.GroqKey = decrypted
					keys.HasValidKey = true
				}
			}
			if userCfg.EncryptedORKey != "" && userCfg.ORIsValid {
				decrypted, err := utils.DecryptWithSalt(userCfg.EncryptedORKey, userUUID.String())
				if err == nil && decrypted != "" {
					keys.OpenRouterKey = decrypted
					keys.HasValidKey = true
				}
			}
		}
	}

	// 2. Jika user adalah admin atau BYOK tidak di-enforce, fallback ke system key jika key user belum ada
	if !isBYOKEnforced {
		if keys.GeminiKey == "" {
			keys.GeminiKey = config.AppConfig.GeminiAPIKey
		}
		if keys.GroqKey == "" {
			keys.GroqKey = config.AppConfig.GroqAPIKey
		}
		if keys.OpenRouterKey == "" {
			keys.OpenRouterKey = config.AppConfig.OpenRouterAPIKey
		}
		if keys.GeminiKey != "" || keys.GroqKey != "" || keys.OpenRouterKey != "" {
			keys.HasValidKey = true
			keys.Reason = ""
		}
	} else if keys.HasValidKey {
		keys.Reason = ""
	}

	return keys
}


// ─── Circuit Breaker State per Provider ───────────────────────────────────────

var (
	providerFailures = make(map[string]int)
	providerCooldown = make(map[string]time.Time)
	cbMu             sync.RWMutex
)

func isProviderHealthy(provider string) bool {
	cbMu.RLock()
	defer cbMu.RUnlock()

	if cooldown, ok := providerCooldown[provider]; ok {
		if time.Now().Before(cooldown) {
			return false
		}
	}
	return true
}

func recordProviderFailure(provider string, err error) {
	cbMu.Lock()
	defer cbMu.Unlock()

	providerFailures[provider]++
	if providerFailures[provider] >= 3 {
		errStr := ""
		if err != nil {
			errStr = strings.ToLower(err.Error())
		}

		cooldown := 2 * time.Minute
		if strings.Contains(errStr, "rate_limit") || strings.Contains(errStr, "rate limit") || strings.Contains(errStr, "429") {
			cooldown = 65 * time.Second // Groq/other rate-limits reset faster
		} else if strings.Contains(errStr, "timeout") || strings.Contains(errStr, "deadline exceeded") || strings.Contains(errStr, "canceled") {
			cooldown = 30 * time.Second // Timeouts recover quicker
		}

		providerCooldown[provider] = time.Now().Add(cooldown)
		logger.Warn("Provider circuit breaker activated cooldown", "provider", provider, "cooldown", cooldown, "error", err)
	}
}

func recordProviderSuccess(provider string) {
	cbMu.Lock()
	defer cbMu.Unlock()

	providerFailures[provider] = 0
	delete(providerCooldown, provider)
}

func GetProviderStatus() map[string]interface{} {
	cbMu.RLock()
	defer cbMu.RUnlock()

	status := map[string]interface{}{}
	for provider, cooldown := range providerCooldown {
		remaining := time.Until(cooldown)
		if remaining > 0 {
			status[provider] = map[string]interface{}{
				"healthy":                    false,
				"cooldown_remaining_seconds": remaining.Seconds(),
				"failures":                   providerFailures[provider],
			}
		} else {
			status[provider] = map[string]interface{}{"healthy": true, "failures": 0}
		}
	}
	// Make sure all providers are included in the status response
	providers := []string{"groq", "gemini", "openrouter"}
	for _, p := range providers {
		if _, ok := status[p]; !ok {
			status[p] = map[string]interface{}{"healthy": true, "failures": 0}
		}
	}
	return status
}

func ResetProviderCircuitBreaker(provider string) {
	cbMu.Lock()
	defer cbMu.Unlock()
	providerFailures[provider] = 0
	delete(providerCooldown, provider)
	logger.Info("Circuit breaker manually reset", "provider", provider)
}

// ─── Persistent Chat History (via PostgreSQL) ─────────────────────────────────

// maxHistoryMessages adalah batas maksimum pesan yang disimpan per user.
// Pesan lama secara otomatis dihapus saat batas ini tercapai.
const maxHistoryMessages = 20

// LoadChatHistory mengambil riwayat percakapan user dari database.
// Mengembalikan slice kosong jika belum ada riwayat.
func LoadChatHistory(userID string) []map[string]string {
	if config.DB == nil || userID == "" {
		return nil
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil
	}

	var record models.ChatHistory
	if err := config.DB.Where("user_id = ?", userUUID).First(&record).Error; err != nil {
		return nil // Belum ada riwayat untuk user ini
	}

	var messages []map[string]string
	if err := json.Unmarshal(record.Messages, &messages); err != nil {
		logger.Error("Failed to parse history", err, "user_id", userID)
		return nil
	}

	logger.Info("Chat history loaded successfully", "count", len(messages), "user_id", userID)
	return messages
}

// SaveChatHistory menyimpan riwayat percakapan user ke database.
// Menggunakan UPSERT (INSERT OR UPDATE) berdasarkan user_id.
// Otomatis memotong history jika melebihi maxHistoryMessages.
func SaveChatHistory(userID string, history []map[string]string) {
	if config.DB == nil || userID == "" || len(history) == 0 {
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return
	}

	// Batasi jumlah pesan — simpan hanya N pesan terakhir
	if len(history) > maxHistoryMessages {
		history = history[len(history)-maxHistoryMessages:]
	}

	messagesJSON, err := json.Marshal(history)
	if err != nil {
		logger.Error("Failed to marshal history", err)
		return
	}

	// UPSERT: update jika sudah ada, insert jika belum
	result := config.DB.Where(models.ChatHistory{UserID: userUUID}).
		Assign(models.ChatHistory{Messages: messagesJSON}).
		FirstOrCreate(&models.ChatHistory{})

	if result.Error != nil {
		logger.Error("Failed to save chat history", result.Error, "user_id", userID)
		return
	}

	logger.Info("Chat history saved successfully", "count", len(history), "user_id", userID)
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

// AskAsep adalah pintu gerbang utama. Dipanggil dari handler.
// Secara otomatis memuat dan menyimpan riwayat percakapan dari PostgreSQL
// sehingga Asep mengingat konteks lintas sesi.
func AskAsep(input AIChatInput) (string, error) {
	if GlobalAsep == nil {
		return "", fmt.Errorf("Asep agent belum diinisialisasi — pastikan InitAsepAgent() dipanggil di main.go")
	}

	keys := fetchUserKeys(input.UserID)
	if !keys.HasValidKey {
		return "", ErrNoAPIKeyRegistered
	}

	// Auto-load riwayat dari DB jika frontend tidak mengirim history.
	// Ini memungkinkan Asep mengingat percakapan dari sesi sebelumnya.
	if len(input.History) == 0 && input.UserID != "" {
		dbHistory := LoadChatHistory(input.UserID)
		if len(dbHistory) > 0 {
			input.History = dbHistory
			logger.Info("Chat history loaded from DB", "count", len(dbHistory), "user_id", input.UserID)
		}
	}

	// Rakit System Prompt dari prompt engine (modular & dinamis) sekali untuk seluruh rangkaian request
	systemPrompt := GenerateSystemPrompt(input.Personality, input.UserID)

	// RAG: Cari ingatan materi kuliah terdekat di Supabase pgvector sekali
	ragContext := fetchRAGContext(input.UserID, input.Message)
	if ragContext != "" {
		systemPrompt += ragContext
	}

	var reply string
	var err error
	var errs []string

	// 1. Gunakan Groq jika API Key dikonfigurasi dan provider sehat
	if keys.GroqKey != "" {
		if isProviderHealthy("groq") {
			logger.Info("Calling Groq provider", "model", config.AppConfig.GroqModel)
			reply, err = GlobalAsep.askGroq(input, systemPrompt, keys.GroqKey)
			if err == nil {
				recordProviderSuccess("groq")
				reply = handleAutoDocx(input, reply)
				saveChatTurn(input, reply) // Simpan ke DB setelah berhasil
				return reply, nil
			}
			recordProviderFailure("groq", err)
			logger.Warn("Groq error occurred, fallback initiated", "error", err)
			errs = append(errs, fmt.Sprintf("Groq (%v)", err))
		} else {
			logger.Info("Skipping Groq due to unhealthy/cooldown status")
			errs = append(errs, "Groq (circuit-breaker-cooldown)")
		}
	}

	// 2. Gunakan Gemini SDK jika client tersedia atau user memiliki key sendiri, dan provider sehat
	if keys.GeminiKey != "" {
		if isProviderHealthy("gemini") {
			logger.Info("Calling Gemini SDK provider", "model", config.AppConfig.GeminiModel)
			reply, err = GlobalAsep.askGemini(input, systemPrompt, keys.GeminiKey)
			if err == nil {
				recordProviderSuccess("gemini")
				reply = handleAutoDocx(input, reply)
				saveChatTurn(input, reply) // Simpan ke DB setelah berhasil
				return reply, nil
			}
			recordProviderFailure("gemini", err)
			logger.Warn("Gemini SDK error occurred", "error", err)
			errs = append(errs, fmt.Sprintf("Gemini (%v)", err))

			// Jika pengguna mengirimkan gambar, log warning dan izinkan fallback ke OpenRouter (karena model vision fallback didukung!)
			if input.ImageBase64 != "" {
				logger.Warn("Gemini SDK failed to process image, enabling fallback to OpenRouter Vision models", "error", err)
			}
		} else {
			logger.Info("Skipping Gemini due to unhealthy/cooldown status")
			errs = append(errs, "Gemini (circuit-breaker-cooldown)")
		}
	}

	// 3. Fallback ke OpenRouter
	if isProviderHealthy("openrouter") {
		logger.Info("Calling OpenRouter fallback provider")
		reply, err = GlobalAsep.askOpenRouter(input, systemPrompt, keys.OpenRouterKey)
		if err == nil {
			recordProviderSuccess("openrouter")
			reply = handleAutoDocx(input, reply)
			saveChatTurn(input, reply) // Simpan ke DB setelah berhasil
			return reply, nil
		}
		recordProviderFailure("openrouter", err)
		errs = append(errs, fmt.Sprintf("OpenRouter (%v)", err))
	} else {
		logger.Info("Skipping OpenRouter due to unhealthy/cooldown status")
		errs = append(errs, "OpenRouter (circuit-breaker-cooldown)")
	}

	// Gabungkan semua error dari model yang dicoba
	combinedErr := fmt.Errorf("Koneksi ke Asep terganggu! Semua model AI (termasuk Groq) sedang sibuk atau mengalami rate-limit. Detail: %s", strings.Join(errs, ", "))
	return "", combinedErr
}


// saveChatTurn menambahkan giliran percakapan (user + assistant) ke riwayat DB.
// Dipanggil secara internal setelah setiap reply berhasil dari provider manapun.
func saveChatTurn(input AIChatInput, reply string) {
	if input.UserID == "" {
		return
	}

	// Ambil history yang sudah ada (termasuk yang di-load dari DB)
	history := input.History

	// Tambahkan giliran ini
	history = append(history, map[string]string{
		"role":    "user",
		"content": input.Message,
	})
	history = append(history, map[string]string{
		"role":    "assistant",
		"content": reply,
	})

	// Simpan ke DB (async agar tidak blok response ke user)
	go SaveChatHistory(input.UserID, history)
}

// handleAutoDocx memicu generator dokumen Word (.docx) HANYA jika:
// 1. Flag InstantMode dikirim secara eksplisit dari frontend (user aktif di Mode Jawaban Instan), DAN
// 2. Belum ada link download yang tersisipkan dari function calling native model.
// Ini mencegah .docx dibuat secara tidak sengaja untuk jawaban chat biasa.
func handleAutoDocx(input AIChatInput, reply string) string {
	// Hanya proses jika flag InstantMode secara eksplisit dikirim dari frontend
	if !input.InstantMode {
		return reply
	}

	// Jangan duplikasi jika model sudah memanggil GenerateWeLearnDocx via function calling
	hasDownloadLink := strings.Contains(reply, "/downloads/")
	if hasDownloadLink {
		return reply
	}

	// Pastikan jawaban cukup panjang untuk layak dijadikan dokumen (minimal 300 karakter)
	if len(reply) < 300 {
		return reply
	}

	logger.Info("Instant answer mode active, executing auto-docx generator")

	title := extractTitleFromReply(reply, "Tugas_Asep_AI")
	docArgs := map[string]interface{}{
		"title":   title,
		"content": reply,
	}

	result := generateWeLearnDocx(input.UserID, docArgs)
	if result.Success {
		logger.Info("Auto-docx document generated successfully", "title", title)
		return reply + "\n\n" + result.Message
	}

	logger.Warn("Failed to generate auto-docx document", "error", result.Message)
	return reply + "\n\n⚠️ **Catatan Sistem:** Gagal membuat dokumen Word — pastikan Python ML Service sedang berjalan."
}

// extractTitleFromReply memindai baris pertama yang berisi Heading (# ) dari konten Markdown
// untuk diekstrak menjadi nama berkas fisik .docx yang cantik dan profesional.
func extractTitleFromReply(reply string, defaultTitle string) string {
	lines := strings.Split(reply, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "# ") {
			title := strings.TrimPrefix(line, "# ")
			title = strings.TrimSpace(title)
			// Clean symbols
			var cleanTitle strings.Builder
			for _, r := range title {
				if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
					cleanTitle.WriteRune(r)
				} else if r == ' ' || r == '-' || r == '_' {
					cleanTitle.WriteRune('_')
				}
			}
			cleaned := cleanTitle.String()
			// Bersihkan double underscore
			for strings.Contains(cleaned, "__") {
				cleaned = strings.ReplaceAll(cleaned, "__", "_")
			}
			cleaned = strings.Trim(cleaned, "_")
			if len(cleaned) > 40 {
				cleaned = cleaned[:40]
			}
			if cleaned != "" {
				return cleaned
			}
		}
	}
	return defaultTitle
}

// ─── Gemini SDK (Primary) ─────────────────────────────────────────────────────

func (h *AsepAgent) askGemini(input AIChatInput, systemPrompt string, userApiKey string) (string, error) {
	modelName := config.AppConfig.GeminiModel
	if modelName == "" {
		modelName = "gemini-2.0-flash"
	}

	timeout := 45 * time.Second
	if input.InstantMode {
		timeout = 90 * time.Second  // Mode Jawaban Instan: izinkan lebih lama untuk docx berkualitas
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	var client *genai.Client
	var err error
	if userApiKey != "" && userApiKey != config.AppConfig.GeminiAPIKey {
		// Buat client transient khusus untuk request ini
		client, err = genai.NewClient(ctx, &genai.ClientConfig{
			APIKey:  userApiKey,
			Backend: genai.BackendGeminiAPI,
		})
		if err != nil {
			return "", fmt.Errorf("gagal membuat transient Gemini client: %w", err)
		}
	} else {
		client = h.geminiClient
	}

	if client == nil {
		return "", fmt.Errorf("Gemini client tidak tersedia (API Key kosong)")
	}

	estimatedTokens := len(systemPrompt) / 4 // Rough estimate: 1 token ≈ 4 karakter
	logger.Info("AskGemini initialized", "estimated_tokens", estimatedTokens, "history_len", len(input.History))
	if estimatedTokens > 3000 {
		logger.Warn("System prompt is very long, consider truncating RAG context", "tokens", estimatedTokens)
	}


	// Susun history percakapan
	var contents []*genai.Content
	for _, h := range input.History {
		role := h["role"]
		if role == "assistant" {
			role = "model"
		}
		if role == "user" || role == "model" {
			contents = append(contents, &genai.Content{
				Role:  role,
				Parts: []*genai.Part{{Text: h["content"]}},
			})
		}
	}

	// Susun pesan user saat ini (dengan dukungan Vision/gambar)
	var userParts []*genai.Part

	// Jika ada gambar, decode base64 dan kirim sebagai InlineData (Vision)
	if input.ImageBase64 != "" {
		rawB64 := utils.CleanBase64String(input.ImageBase64)
		imgBytes, err := base64.StdEncoding.DecodeString(rawB64)
		if err == nil && len(imgBytes) > 0 {
			mimeType := utils.DetectMimeType(imgBytes)
			userParts = append(userParts, &genai.Part{
				InlineData: &genai.Blob{
					MIMEType: mimeType,
					Data:     imgBytes,
				},
			})
			logger.Info("Image enabled for Gemini request", "mime_type", mimeType, "size", len(imgBytes))
		} else {
			logger.Warn("Failed to decode base64 image", "error", err)
		}
	}

	userParts = append(userParts, &genai.Part{Text: input.Message})
	contents = append(contents, &genai.Content{
		Role:  "user",
		Parts: userParts,
	})

	// Definisi Tool yang bisa dipanggil oleh model
	tools := buildGeminiToolDeclarations()

	cfg := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{{Text: systemPrompt}},
		},
		Tools: tools,
	}

	resp, err := client.Models.GenerateContent(ctx, modelName, contents, cfg)
	if err != nil {
		return "", fmt.Errorf("gemini generate error: %w", err)
	}

	if resp == nil {
		return "", fmt.Errorf("empty response dari Gemini")
	}

	// ─── Tool Call Dispatch Loop ──────────────────────────────────────────────
	// Jika model meminta eksekusi tool, kita tangkap dan eksekusi, lalu
	// kirim hasilnya kembali ke model untuk mendapatkan respons teks final.
	for _, candidate := range resp.Candidates {
		if candidate.Content == nil {
			continue
		}
		for _, part := range candidate.Content.Parts {
			if part.FunctionCall == nil {
				continue
			}

			fc := part.FunctionCall
			logger.Info("Model requested tool execution", "tool", fc.Name)

			// [FIX] Untuk GenerateWeLearnDocx: model kadang mengirim content yang
			// hanya berupa draf singkat, bukan jawaban lengkap yang ditampilkan di chat.
			// Solusi: dapatkan finalResp (jawaban naratif model) DULU, lalu overwrite
			// args["content"] dengan teks naratif yang lebih lengkap jika tersedia.
			if fc.Name == "GenerateWeLearnDocx" {
				// Langkah 1: Kumpulkan semua teks non-tool dari kandidat ini sebagai jawaban chat
				var narrativeParts []string
				for _, p := range candidate.Content.Parts {
					if p.Text != "" {
						narrativeParts = append(narrativeParts, p.Text)
					}
				}
				narrativeText := strings.Join(narrativeParts, "\n")

				// Langkah 2: Jika teks naratif dari model lebih panjang dari args content,
				// gunakan itu sebagai konten docx agar jawaban chat == isi dokumen.
				if argsContent, ok := fc.Args["content"].(string); ok {
					if len(narrativeText) > len(argsContent) {
						fc.Args["content"] = narrativeText
						logger.Info("Overwriting docx content with full narrative chat response", "narrative_len", len(narrativeText), "args_len", len(argsContent))
					}
				} else if narrativeText != "" {
					fc.Args["content"] = narrativeText
				}
			}

			// Eksekusi tool via tool_handler
			result := ExecuteAsepTool(input.UserID, fc.Name, fc.Args)

			// Kirim function response kembali ke model
			functionResponseContent := &genai.Content{
				Role: "tool",
				Parts: []*genai.Part{
					{
						FunctionResponse: &genai.FunctionResponse{
							Name: fc.Name,
							Response: map[string]interface{}{
								"success": result.Success,
								"message": result.Message,
							},
						},
					},
				},
			}

			// Tambahkan konteks tool call + response ke history
			contentsWithTool := append(contents,
				&genai.Content{
					Role:  "model",
					Parts: []*genai.Part{{FunctionCall: fc}},
				},
				functionResponseContent,
			)

			// Minta model untuk merumuskan jawaban akhir berdasarkan hasil tool
			finalResp, err := h.geminiClient.Models.GenerateContent(ctx, modelName, contentsWithTool, &genai.GenerateContentConfig{
				SystemInstruction: cfg.SystemInstruction,
			})
			if err != nil {
				logger.Warn("Failed to generate final response after tool execution, using tool message directly", "error", err)
				return result.Message, nil
			}

			if finalResp != nil && finalResp.Text() != "" {
				// [FIX] Untuk GenerateWeLearnDocx: jika model masih belum menyertakan
				// link download di finalResp, append link dari result tool agar user
				// tetap bisa mengunduh dokumen.
				if fc.Name == "GenerateWeLearnDocx" && result.Success {
					finalText := finalResp.Text()
					if !strings.Contains(finalText, "/downloads/") {
						// Ekstrak hanya baris link dari result.Message
						for _, line := range strings.Split(result.Message, "\n") {
							if strings.Contains(line, "/downloads/") {
								return finalText + "\n\n" + line, nil
							}
						}
					}
					return finalText, nil
				}
				return finalResp.Text(), nil
			}

			return result.Message, nil
		}
	}

	// Tidak ada tool call — respons teks biasa
	if resp.Text() == "" {
		return "", fmt.Errorf("empty text response dari Gemini")
	}

	return resp.Text(), nil
}

// buildGeminiToolDeclarations mendefinisikan tool/function yang bisa dipanggil oleh LLM.
func buildGeminiToolDeclarations() []*genai.Tool {
	return []*genai.Tool{
		{
			FunctionDeclarations: []*genai.FunctionDeclaration{
				{
					Name:        "CreateUserTask",
					Description: "Membuat tugas baru ke dalam daftar tugas aktif pengguna di aplikasi Motion. Gunakan ketika pengguna meminta membuat tugas, jadwal, atau reminder baru.",
					Parameters: &genai.Schema{
						Type: genai.TypeObject,
						Properties: map[string]*genai.Schema{
							"title": {
								Type:        genai.TypeString,
								Description: "Judul singkat tugas, misal: 'Laporan Aljabar Linier Bab 3'",
							},
							"estimate": {
								Type:        genai.TypeInteger,
								Description: "Perkiraan durasi pengerjaan dalam menit, misal: 60",
							},
							"category": {
								Type:        genai.TypeString,
								Description: "Kategori tugas: 'work', 'personal', 'health', atau 'education'",
							},
							"priority": {
								Type:        genai.TypeInteger,
								Description: "Tingkat urgensi tugas: 1 (paling rendah) hingga 5 (paling tinggi)",
							},
							"description": {
								Type:        genai.TypeString,
								Description: "Deskripsi opsional tugas, catatan, atau tautan referensi",
							},
							"due_date": {
								Type:        genai.TypeString,
								Description: "Tanggal tenggat opsional dalam format RFC3339 atau 'YYYY-MM-DD', misal: '2026-06-15'",
							},
						},
						Required: []string{"title", "estimate", "category", "priority"},
					},
				},
				{
					Name:        "TriggerAutoSchedule",
					Description: "Menjalankan mesin AI Auto-Scheduler untuk menjadwalkan ulang semua tugas pending pengguna secara optimal berdasarkan prioritas dan preferensi waktu mereka. Gunakan ketika pengguna ingin merapikan jadwal atau mengatur ulang semua agenda.",
					Parameters: &genai.Schema{
						Type:       genai.TypeObject,
						Properties: map[string]*genai.Schema{},
					},
				},
				{
					Name:        "GetWeLearnAssignments",
					Description: "Mengambil daftar tugas aktif, deadline, status pengumpulan (BELUM, DRAF, TERKUMPUL), dan mata kuliah dari integrasi WeLearn Moodle milik pengguna. Gunakan ketika pengguna menanyakan tentang tugas akademik WeLearn mereka.",
					Parameters: &genai.Schema{
						Type: genai.TypeObject,
						Properties: map[string]*genai.Schema{
							"status_filter": {
								Type:        genai.TypeString,
								Description: "Filter status opsional: 'new' (belum dikumpul), 'draft' (draf), 'submitted' (sudah dikumpul), atau 'all' (semua)",
							},
						},
					},
				},
				{
					Name:        "GetWeLearnCourses",
					Description: "Mengambil daftar mata kuliah aktif mahasiswa beserta statistik jumlah tugas terbengkalai dari LMS WeLearn WICIDA. Gunakan ketika pengguna menanyakan mata kuliah aktif mereka.",
					Parameters: &genai.Schema{
						Type:       genai.TypeObject,
						Properties: map[string]*genai.Schema{},
					},
				},
				{
					Name: "GenerateWeLearnDocx",
					Description: "Menghasilkan berkas Word .docx profesional dari jawaban LENGKAP yang telah Anda tulis. " +
						"PENTING: Sebelum memanggil tool ini, Anda WAJIB menuliskan seluruh jawaban akademik secara lengkap, " +
						"komprehensif, dan terstruktur di dalam field 'content' tool ini — jangan hanya menulis ringkasan atau draf singkat. " +
						"Field 'content' harus berisi jawaban final yang persis sama dengan yang ditampilkan kepada pengguna di chat. " +
						"Gunakan heading (#, ##), bullet points (-), dan tabel (|) sesuai kebutuhan akademik.",
					Parameters: &genai.Schema{
						Type: genai.TypeObject,
						Properties: map[string]*genai.Schema{
							"title": {
								Type:        genai.TypeString,
								Description: "Judul dokumen tugas akademik, misal: 'Tugas Mandiri 3 - Analisis Leksikal'",
							},
							"content": {
								Type: genai.TypeString,
								Description: "Isi LENGKAP dokumen dalam format Markdown. Ini harus berupa jawaban final yang sudah selesai " +
									"— bukan outline, bukan draf singkat. Tulis semua bagian, penjelasan, contoh, dan kesimpulan secara penuh.",
							},
						},
						Required: []string{"title", "content"},
					},
				},
			},
		},
	}
}

func (h *AsepAgent) askGroq(input AIChatInput, systemPrompt string, userApiKey string) (string, error) {
	apiKey := userApiKey
	if apiKey == "" {
		apiKey = config.AppConfig.GroqAPIKey
	}
	primaryModel := config.AppConfig.GroqModel
	if primaryModel == "" {
		primaryModel = "llama-3.3-70b-versatile"
	}

	// [Fix Groq] Internal fallback model list — jika primary rate-limited,
	// coba model cadangan yang lebih ringan sebelum menyerah ke Gemini/OpenRouter.
	groqModelsToTry := []string{
		primaryModel,             // Model utama dari config (default: llama-3.3-70b-versatile)
		"llama-3.1-8b-instant",  // Super ringan, hampir tidak pernah rate-limit
		"gemma2-9b-it",          // Google Gemma via Groq, cadangan terakhir
	}

	// Jika ada gambar, gunakan model vision dan skip model teks
	if input.ImageBase64 != "" {
		groqModelsToTry = []string{"meta-llama/llama-4-scout-17b-16e-instruct"}
	}

	timeout := 45 * time.Second
	if input.InstantMode {
		timeout = 90 * time.Second
	}

	var baseMessages []GroqMessage
	baseMessages = append(baseMessages, GroqMessage{Role: "system", Content: systemPrompt})
	for _, hist := range input.History {
		role := hist["role"]
		content := hist["content"]
		if role == "user" || role == "assistant" {
			baseMessages = append(baseMessages, GroqMessage{Role: role, Content: content})
		}
	}

	var userContent interface{}
	if input.ImageBase64 != "" {
		imgURL := input.ImageBase64
		if !strings.HasPrefix(imgURL, "data:") {
			rawB64 := utils.CleanBase64String(imgURL)
			imgBytes, err := base64.StdEncoding.DecodeString(rawB64)
			mimeType := "image/png"
			if err == nil && len(imgBytes) > 0 {
				mimeType = utils.DetectMimeType(imgBytes)
			}
			imgURL = fmt.Sprintf("data:%s;base64,%s", mimeType, rawB64)
		}
		userContent = []map[string]interface{}{
			{"type": "text", "text": input.Message},
			{"type": "image_url", "image_url": map[string]interface{}{"url": imgURL}},
		}
		logger.Info("Image enabled for Groq vision request")
	} else {
		userContent = input.Message
	}

	messages := append(baseMessages, GroqMessage{Role: "user", Content: userContent})

	// [Fix #2] Only send tools if the message contains tool-relevant keywords
	var tools []OpenRouterTool
	if shouldSendTools(input.Message) {
		tools = buildOpenRouterTools()
	}


	// ─── Internal Groq Fallback Loop ─────────────────────────────────────────
	var lastGroqErr error
	for _, modelName := range groqModelsToTry {
		logger.Info("Trying Groq model", "model", modelName)

		ctx, cancel := context.WithTimeout(context.Background(), timeout)

		reqBody := GroqRequest{
			Model:    modelName,
			Messages: messages,
			Tools:    tools,
		}

		jsonBytes, err := json.Marshal(reqBody)
		if err != nil {
			cancel()
			lastGroqErr = fmt.Errorf("marshal error for %s: %w", modelName, err)
			continue
		}

		req, err := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(jsonBytes))
		if err != nil {
			cancel()
			lastGroqErr = fmt.Errorf("request error for %s: %w", modelName, err)
			continue
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		req.Header.Set("Content-Type", "application/json")

		resp, err := h.httpClient.Do(req.WithContext(ctx))
		if err != nil {
			cancel()
			lastGroqErr = fmt.Errorf("failed to call groq api (%s): %w", modelName, err)
			logger.Warn("Failed to call Groq model", "model", modelName, "error", err)
			continue
		}

		// Baca body SEBELUM cancel context — mencegah ReadErr: context canceled
		bodyBytes, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		cancel() // Cancel SETELAH body selesai dibaca

		if readErr != nil {
			lastGroqErr = fmt.Errorf("failed to read groq response (%s): %w", modelName, readErr)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			lastGroqErr = fmt.Errorf("groq api error status %d (%s): %s", resp.StatusCode, modelName, string(bodyBytes))
			logger.Warn("Groq model returned error status", "model", modelName, "status", resp.StatusCode)
			continue
		}

		var groqResp GroqResponse
		if err := json.Unmarshal(bodyBytes, &groqResp); err != nil {
			lastGroqErr = fmt.Errorf("unmarshal groq response error (%s): %w", modelName, err)
			continue
		}

		if groqResp.Error != nil {
			lastGroqErr = fmt.Errorf("groq api error (%s): %s", modelName, groqResp.Error.Message)
			logger.Warn("Groq model returned API error", "model", modelName, "error", groqResp.Error.Message)
			continue
		}

		if len(groqResp.Choices) == 0 {
			lastGroqErr = fmt.Errorf("empty choices from groq (%s)", modelName)
			logger.Warn("Groq model returned empty choices", "model", modelName)
			continue
		}

		choice := groqResp.Choices[0]

		// ─── Tool Call Handling ────────────────────────────────────────────
		if len(choice.Message.ToolCalls) > 0 {
			toolCall := choice.Message.ToolCalls[0]
			logger.Info("Groq model requested tool execution", "model", modelName, "tool", toolCall.Function.Name)

			var args map[string]interface{}
			if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
				logger.Warn("Failed to parse tool call arguments from Groq", "error", err)
				args = make(map[string]interface{})
			}

			result := ExecuteAsepTool(input.UserID, toolCall.Function.Name, args)

			toolMessages := append(messages, GroqMessage{
				Role:      "assistant",
				ToolCalls: choice.Message.ToolCalls,
			})
			toolMessages = append(toolMessages, GroqMessage{
				Role:       "tool",
				Name:       toolCall.Function.Name,
				ToolCallID: toolCall.ID,
				Content:    result.Message,
			})

			// [Fix #3] Rebuild finalMessages starting with systemPrompt
			finalMessages := []GroqMessage{{Role: "system", Content: systemPrompt}}
			finalMessages = append(finalMessages, toolMessages[1:]...)

			finalReqBody := GroqRequest{Model: modelName, Messages: finalMessages}
			finalJsonBytes, err := json.Marshal(finalReqBody)
			if err != nil {
				return result.Message, nil
			}

			finalReq, err := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(finalJsonBytes))
			if err != nil {
				return result.Message, nil
			}
			finalReq.Header.Set("Authorization", "Bearer "+apiKey)
			finalReq.Header.Set("Content-Type", "application/json")

			finalCtx, finalCancel := context.WithTimeout(context.Background(), timeout)
			finalResp, err := h.httpClient.Do(finalReq.WithContext(finalCtx))
			if err != nil {
				finalCancel()
				return result.Message, nil
			}
			finalBodyBytes, _ := io.ReadAll(finalResp.Body)
			finalResp.Body.Close()
			finalCancel()

			var finalGroqResp GroqResponse
			if err := json.Unmarshal(finalBodyBytes, &finalGroqResp); err != nil {
				return result.Message, nil
			}
			if len(finalGroqResp.Choices) > 0 && finalGroqResp.Choices[0].Message.Content != "" {
				logger.Info("Tool call execution finished via Groq", "model", modelName)
				return finalGroqResp.Choices[0].Message.Content, nil
			}
			return result.Message, nil
		}

		// ─── Sukses (teks biasa) ───────────────────────────────────────────
		if choice.Message.Content == "" {
			lastGroqErr = fmt.Errorf("empty content dari model %s", modelName)
			logger.Warn("Groq model returned empty content", "model", modelName)
			continue
		}

		logger.Info("Successfully obtained answer from Groq", "model", modelName)
		return choice.Message.Content, nil
	}

	return "", fmt.Errorf("semua Groq model gagal. Error terakhir: %v", lastGroqErr)
}

// ─── OpenRouter (Fallback) ────────────────────────────────────────────────────

func (h *AsepAgent) askOpenRouter(input AIChatInput, systemPrompt string, userApiKey string) (string, error) {
	apiKey := userApiKey
	if apiKey == "" {
		apiKey = config.AppConfig.OpenRouterAPIKey
	}
	primaryModel := config.AppConfig.OpenRouterModel

	if apiKey == "" {
		return "👋 **Halo! Aku Asep, Asisten Pribadi Motion kamu.**\n\n" +
			"Sepertinya kunci akses AI belum dikonfigurasi. Untuk mengaktifkan kecerdasan penuhku:\n" +
			"1. Buka file `backend/.env` di komputer kamu.\n" +
			"2. Temukan variabel `GEMINI_API_KEY` atau `OPENROUTER_API_KEY`.\n" +
			"3. Tempelkan kunci API kamu di sana lalu restart server.\n\n" +
			"Setelah itu, aku bisa membaca seluruh tugasmu dan memberikan rekomendasi penjadwalan cerdas! 🚀", nil
	}

	var messages []OpenRouterMessage
	messages = append(messages, OpenRouterMessage{Role: "system", Content: systemPrompt})

	for _, h := range input.History {
		role := h["role"]
		content := h["content"]
		if role == "user" || role == "assistant" {
			messages = append(messages, OpenRouterMessage{Role: role, Content: content})
		}
	}

	var userContent interface{}
	if input.ImageBase64 != "" {
		// Pastikan format base64 diawali dengan data URL jika belum ada
		imgURL := input.ImageBase64
		if !strings.HasPrefix(imgURL, "data:") {
			rawB64 := utils.CleanBase64String(imgURL)
			imgBytes, err := base64.StdEncoding.DecodeString(rawB64)
			mimeType := "image/png"
			if err == nil && len(imgBytes) > 0 {
				mimeType = utils.DetectMimeType(imgBytes)
			}
			imgURL = fmt.Sprintf("data:%s;base64,%s", mimeType, rawB64)
		}

		userContent = []map[string]interface{}{
			{
				"type": "text",
				"text": input.Message,
			},
			{
				"type": "image_url",
				"image_url": map[string]interface{}{
					"url": imgURL,
				},
			},
		}
		logger.Info("Image enabled for OpenRouter with vision fallback model")
	} else {
		userContent = input.Message
	}

	messages = append(messages, OpenRouterMessage{Role: "user", Content: userContent})

	// Rakit daftar kandidat model.
	modelsToTry := []string{primaryModel}

	// Jika ada gambar, prioritaskan model-model Vision yang terkonfirmasi aktif
	if input.ImageBase64 != "" {
		visionModels := []string{
			"google/gemma-4-31b-it:free",      // mendukung multimodal
			"google/gemma-4-26b-a4b-it:free",  // mendukung multimodal (lebih ringan)
			"google/gemini-2.5-flash",          // paid fallback vision andal
		}
		for _, vm := range visionModels {
			exists := false
			for _, m := range modelsToTry {
				if m == vm {
					exists = true
					break
				}
			}
			if !exists {
				modelsToTry = append([]string{vm}, modelsToTry...)
			}
		}
	}
	
	// [Fix #3] Fallback model bertingkat — diurutkan dari yang paling stabil & jarang rate-limit.
	// Model berbayar yang butuh kredit (deepseek-chat, dll) DIHAPUS karena membuang timeout sia-sia.
	fallbackModels := []string{
		// Tier 1 — Gratis, Cepat, Andal (jarang rate-limit, rekomendasi utama)
		"meta-llama/llama-3.3-70b-instruct:free",           // Meta 70B — paling stabil & terpercaya
		"google/gemma-4-31b-it:free",                       // Google Gemma 4 31B — Google, jarang antre
		"qwen/qwen3-coder:free",                            // Qwen Coder — sangat bagus untuk akademis

		// Tier 2 — Gratis, Besar (kualitas tinggi, mungkin antre lebih lama)
		"openai/gpt-oss-120b:free",                         // OpenAI OSS 120B — sangat kuat
		"qwen/qwen3-next-80b-a3b-instruct:free",            // Qwen3 MoE 80B
		"google/gemma-4-26b-a4b-it:free",                   // Google Gemma 4 26B MoE (lebih ringan)
		"openai/gpt-oss-20b:free",                          // OpenAI OSS 20B

		// Tier 3 — Gratis Kecil (jaring pengaman, hampir tidak pernah rate-limit)
		"meta-llama/llama-3.2-3b-instruct:free",            // Llama 3.2 3B — super ringan

		// Tier 4 — Berbayar stabil (HANYA jika ada kredit OpenRouter)
		"google/gemini-2.5-flash",
		"meta-llama/llama-3.3-70b-instruct",
	}
	for _, fb := range fallbackModels {
		exists := false
		for _, m := range modelsToTry {
			if m == fb {
				exists = true
				break
			}
		}
		if !exists {
			modelsToTry = append(modelsToTry, fb)
		}
	}

	var lastErr error
	var responseText string

	for _, currentModel := range modelsToTry {
		logger.Info("Trying OpenRouter model", "model", currentModel)
		
		reqBody := OpenRouterRequest{
			Model:    currentModel,
			Messages: messages,
		}

		jsonBytes, err := json.Marshal(reqBody)
		if err != nil {
			lastErr = fmt.Errorf("gagal marshal request untuk %s: %w", currentModel, err)
			logger.Warn("Failed to marshal OpenRouter request", "model", currentModel, "error", err)
			continue
		}

		req, err := http.NewRequest("POST", "https://openrouter.ai/api/v1/chat/completions", bytes.NewBuffer(jsonBytes))
		if err != nil {
			lastErr = fmt.Errorf("gagal membuat request untuk %s: %w", currentModel, err)
			logger.Warn("Failed to create OpenRouter request", "model", currentModel, "error", err)
			continue
		}

		req.Header.Set("Authorization", "Bearer "+apiKey)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("HTTP-Referer", config.AppConfig.FrontendURL)
		req.Header.Set("X-Title", "Motion — Asep AI")

		// Timeout dinamis berdasarkan ukuran model:
		// - Model besar gratis (405B, 120B): butuh antrean server, izinkan 75 detik
		// - Model gratis medium (20-80B): 55 detik
		// - Model berbayar (response SLA lebih baik): 35 detik
		modelTimeout := 35 * time.Second
		if strings.Contains(currentModel, ":free") {
			if strings.Contains(currentModel, "405b") || strings.Contains(currentModel, "120b") {
				modelTimeout = 75 * time.Second
			} else {
				modelTimeout = 55 * time.Second
			}
		}
		reqCtx, reqCancel := context.WithTimeout(context.Background(), modelTimeout)
		req = req.WithContext(reqCtx)

		resp, err := h.httpClient.Do(req)
		if err != nil {
			reqCancel()
			lastErr = fmt.Errorf("gagal menghubungi OpenRouter untuk %s: %w", currentModel, err)
			logger.Warn("Failed to execute OpenRouter request", "model", currentModel, "error", err)
			continue
		}

		// [Fix #1] Baca body SEBELUM cancel context — mencegah ReadErr: context canceled
		// pada model yang merespons Status 200 tapi body terbaca kosong.
		bodyBytes, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		reqCancel() // Cancel SETELAH body selesai dibaca
		bodyBytes = bytes.TrimSpace(bodyBytes)

		logger.Info("OpenRouter model response received", "model", currentModel, "status", resp.StatusCode, "len", len(bodyBytes), "read_err", readErr)
		
		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("HTTP %d dari %s: %s", resp.StatusCode, currentModel, string(bodyBytes))
			logger.Warn("OpenRouter model returned error status", "model", currentModel, "status", resp.StatusCode)
			continue
		}

		if len(bodyBytes) == 0 {
			logger.Warn("OpenRouter response body is empty", "headers", resp.Header, "model", currentModel)
			lastErr = fmt.Errorf("response kosong dari %s (ReadErr: %v, Status: %d)", currentModel, readErr, resp.StatusCode)
			continue
		}

		if bodyBytes[0] != '{' {
			lastErr = fmt.Errorf("format JSON tidak valid dari %s: %s", currentModel, string(bodyBytes))
			logger.Warn("OpenRouter model returned invalid JSON format", "model", currentModel)
			continue
		}

		var orResp OpenRouterResponse
		if err := json.Unmarshal(bodyBytes, &orResp); err != nil {
			lastErr = fmt.Errorf("gagal parse response OpenRouter dari %s: %w", currentModel, err)
			logger.Warn("Failed to unmarshal OpenRouter response", "model", currentModel, "error", err)
			continue
		}

		if orResp.Error != nil {
			lastErr = fmt.Errorf("error OpenRouter dari %s: %s", currentModel, orResp.Error.Message)
			logger.Warn("OpenRouter model returned API error", "model", currentModel, "error", orResp.Error.Message)
			continue
		}

		if len(orResp.Choices) == 0 || orResp.Choices[0].Message.Content == "" {
			lastErr = fmt.Errorf("tidak ada jawaban dari %s", currentModel)
			logger.Warn("OpenRouter model returned empty choices", "model", currentModel)
			continue
		}

		// Jika ada tool calls dari model OpenRouter, tangani (fallback jika tools diaktifkan di masa depan)
		choice := orResp.Choices[0]
		if len(choice.Message.ToolCalls) > 0 {
			toolCall := choice.Message.ToolCalls[0]
			logger.Info("OpenRouter model requested tool execution", "model", currentModel, "tool", toolCall.Function.Name)

			var args map[string]interface{}
			if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
				logger.Warn("Failed to parse tool call arguments from OpenRouter", "error", err)
				args = make(map[string]interface{})
			}

			result := ExecuteAsepTool(input.UserID, toolCall.Function.Name, args)

			toolMessage := OpenRouterMessage{
				Role:    "user",
				Content: fmt.Sprintf("[SISTEM] Hasil eksekusi fungsi %s: %s (Sukses: %t)", toolCall.Function.Name, result.Message, result.Success),
			}

			newMessages := append(messages, 
				OpenRouterMessage{
					Role:    "assistant",
					Content: choice.Message.Content,
				},
				toolMessage,
			)

			finalReqBody := OpenRouterRequest{
				Model:    currentModel,
				Messages: newMessages,
			}

			finalJsonBytes, err := json.Marshal(finalReqBody)
			if err != nil {
				responseText = result.Message
				logger.Info("Partial tool call success via OpenRouter", "tool", toolCall.Function.Name, "model", currentModel)
				return responseText, nil
			}

			finalReq, err := http.NewRequest("POST", "https://openrouter.ai/api/v1/chat/completions", bytes.NewBuffer(finalJsonBytes))
			if err != nil {
				responseText = result.Message
				return responseText, nil
			}

			finalReq.Header.Set("Authorization", "Bearer "+apiKey)
			finalReq.Header.Set("Content-Type", "application/json")
			finalReq.Header.Set("HTTP-Referer", config.AppConfig.FrontendURL)
			finalReq.Header.Set("X-Title", "Motion — Asep AI")

			finalResp, err := h.httpClient.Do(finalReq)
			if err != nil {
				responseText = result.Message
				return responseText, nil
			}
			defer finalResp.Body.Close()

			finalBodyBytes, _ := io.ReadAll(finalResp.Body)
			var finalOrResp OpenRouterResponse
			if err := json.Unmarshal(finalBodyBytes, &finalOrResp); err != nil {
				responseText = result.Message
				return responseText, nil
			}

			if len(finalOrResp.Choices) > 0 && finalOrResp.Choices[0].Message.Content != "" {
				responseText = finalOrResp.Choices[0].Message.Content
				return responseText, nil
			}

			responseText = result.Message
			return responseText, nil
		}

		// Sukses biasa
		responseText = choice.Message.Content
		logger.Info("Successfully obtained answer from OpenRouter", "model", currentModel)
		return responseText, nil
	}

	// Jika semua model dalam list gagal, return error agar handler HTTP bisa memberikan response status 503
	logger.Error("All OpenRouter models failed", lastErr)
	return "", fmt.Errorf("Koneksi ke Asep terganggu! Semua model AI gratis (termasuk Qwen) sedang sibuk atau mengalami rate-limit. Error terakhir: %v", lastErr)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func shouldSendTools(message string) bool {
	msg := strings.ToLower(message)
	keywords := []string{"buat tugas", "jadwalkan", "welearn", "reminder", "schedule", "tugas", "agenda", "docx"}
	for _, kw := range keywords {
		if strings.Contains(msg, kw) {
			return true
		}
	}
	return false
}



// ─── RAG Helpers ─────────────────────────────────────────────────────────────

// fetchRAGContext mengambil potongan materi kuliah terdekat dari Supabase pgvector
func fetchRAGContext(userID string, question string) string {
	if config.DB == nil {
		return ""
	}

	// 1. Generate embedding dari pertanyaan user (menggunakan cache jika ada)
	vector, err := GetCachedOrFetchEmbedding(question)
	if err != nil {
		logger.Warn("Failed to generate embedding for RAG question", "error", err)
		return ""
	}

	// 2. Query pencarian semantik kosinus menggunakan custom models.Vector type-safe parameter
	type ChunkResult struct {
		Content      string
		DocumentName string
	}
	var chunks []ChunkResult

	// Ambil 6 chunk paling relevan (threshold kosinus < 0.85 untuk menyaring chunk tidak relevan).
	// Meningkat dari 3→6 untuk memberikan konteks akademik yang lebih komprehensif ke model.
	qErr := config.DB.Raw(`
		SELECT content, document_name 
		FROM document_chunks 
		WHERE user_id = ? AND (embedding <=> ?) < 0.85
		ORDER BY embedding <=> ? 
		LIMIT 6
	`, userID, models.Vector(vector), models.Vector(vector)).Scan(&chunks).Error

	if qErr != nil {
		// Log info jika ekstensi pgvector belum aktif/tidak didukung di DB lokal
		logger.Info("Cannot perform vector search, database extension might not be enabled", "error", qErr)
		return ""
	}

	if len(chunks) == 0 {
		return ""
	}

	// 4. Susun potongan teks ke dalam format konteks system prompt
	var sb strings.Builder
	sb.WriteString("\n## DOKUMEN MATERI KULIAH MAHASISWA (Gunakan sebagai dasar jawaban utama):\n")
	for _, ch := range chunks {
		sb.WriteString(fmt.Sprintf("[Dokumen: %s]\n%s\n\n", ch.DocumentName, ch.Content))
	}
	logger.Info("Successfully injected relevant course document chunks to Asep prompt", "chunks_count", len(chunks))
	
	return sb.String()
}

var (
	embeddingCache sync.Map // key: string (teks), value: cachedEmbedding
)

type cachedEmbedding struct {
	Vector    []float32
	ExpiresAt time.Time
}

// GetCachedOrFetchEmbedding mengambil embedding dari cache in-memory jika tersedia dan belum expired
func GetCachedOrFetchEmbedding(text string) ([]float32, error) {
	if val, ok := embeddingCache.Load(text); ok {
		cached := val.(cachedEmbedding)
		if time.Now().Before(cached.ExpiresAt) {
			return cached.Vector, nil // Cache HIT
		}
	}
	// Cache MISS
	vector, err := GenerateGeminiEmbedding(text)
	if err == nil {
		embeddingCache.Store(text, cachedEmbedding{
			Vector:    vector,
			ExpiresAt: time.Now().Add(5 * time.Minute),
		})
	}
	return vector, err
}

// GenerateGeminiEmbedding memanggil Gemini Embeddings API (text-embedding-004) menggunakan SDK resmi Go
func GenerateGeminiEmbedding(text string) ([]float32, error) {
	apiKey := config.AppConfig.GeminiAPIKey
	if apiKey == "" {
		apiKey = config.AppConfig.OpenRouterAPIKey
	}
	if apiKey == "" {
		return nil, fmt.Errorf("kunci API belum dikonfigurasi")
	}

	var client *genai.Client
	if GlobalAsep != nil && GlobalAsep.geminiClient != nil {
		client = GlobalAsep.geminiClient
	} else {
		// Buat client sementara jika GlobalHermes belum siap atau nil
		ctx := context.Background()
		var err error
		client, err = genai.NewClient(ctx, &genai.ClientConfig{
			APIKey:  apiKey,
			Backend: genai.BackendGeminiAPI,
		})
		if err != nil {
			return nil, fmt.Errorf("gagal membuat client Gemini untuk embedding: %w", err)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	result, err := client.Models.EmbedContent(
		ctx,
		"text-embedding-004",
		genai.Text(text),
		&genai.EmbedContentConfig{
			TaskType: "RETRIEVAL_QUERY",
		},
	)
	if err != nil {
		// Log warning dan coba fallback HTTP raw jika SDK gagal
		logger.Warn("Gemini SDK EmbedContent failed, trying raw HTTP fallback", "error", err)
		return generateGeminiEmbeddingRaw(text, apiKey)
	}

	if result == nil || len(result.Embeddings) == 0 || result.Embeddings[0] == nil {
		return nil, fmt.Errorf("empty embeddings response dari Gemini SDK")
	}

	return result.Embeddings[0].Values, nil
}

// generateGeminiEmbeddingRaw adalah cadangan panggilan HTTP raw jika SDK mengalami kendala
func generateGeminiEmbeddingRaw(text string, apiKey string) ([]float32, error) {
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=%s", apiKey)
	
	payload := map[string]interface{}{
		"content": map[string]interface{}{
			"parts": []map[string]interface{}{
				{"text": text},
			},
		},
	}
	
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBytes))
	}
	
	var resData struct {
		Embedding struct {
			Values []float32 `json:"values"`
		} `json:"embedding"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&resData); err != nil {
		return nil, err
	}
	
	return resData.Embedding.Values, nil
}

// buildOpenRouterTools mendefinisikan tool/function yang bisa dipanggil oleh LLM via OpenRouter.
func buildOpenRouterTools() []OpenRouterTool {
	return []OpenRouterTool{
		{
			Type: "function",
			Function: &OpenRouterFunction{
				Name:        "CreateUserTask",
				Description: "Membuat tugas baru ke dalam daftar tugas aktif pengguna di aplikasi Motion. Gunakan ketika pengguna meminta membuat tugas, jadwal, atau reminder baru.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"title": map[string]interface{}{
							"type":        "string",
							"description": "Judul singkat tugas, misal: 'Laporan Aljabar Linier Bab 3'",
						},
						"estimate": map[string]interface{}{
							"type":        "integer",
							"description": "Perkiraan durasi pengerjaan dalam menit, misal: 60",
						},
						"category": map[string]interface{}{
							"type":        "string",
							"description": "Kategori tugas: 'work', 'personal', 'health', atau 'education'",
						},
						"priority": map[string]interface{}{
							"type":        "integer",
							"description": "Tingkat urgensi tugas: 1 (paling rendah) hingga 5 (paling tinggi)",
						},
						"description": map[string]interface{}{
							"type":        "string",
							"description": "Deskripsi opsional tugas, catatan, atau tautan referensi",
						},
						"due_date": map[string]interface{}{
							"type":        "string",
							"description": "Tanggal tenggat opsional dalam format RFC3339 atau 'YYYY-MM-DD', misal: '2026-06-15'",
						},
					},
					"required": []string{"title", "estimate", "category", "priority"},
				},
			},
		},
		{
			Type: "function",
			Function: &OpenRouterFunction{
				Name:        "TriggerAutoSchedule",
				Description: "Menjalankan mesin AI Auto-Scheduler untuk menjadwalkan ulang semua tugas pending pengguna secara optimal berdasarkan prioritas dan preferensi waktu mereka. Gunakan ketika pengguna ingin merapikan jadwal atau mengatur ulang semua agenda.",
				Parameters: map[string]interface{}{
					"type":       "object",
					"properties": map[string]interface{}{},
				},
			},
		},
		{
			Type: "function",
			Function: &OpenRouterFunction{
				Name:        "GetWeLearnAssignments",
				Description: "Mengambil daftar tugas aktif, deadline, status pengumpulan (BELUM, DRAF, TERKUMPUL), dan mata kuliah dari integrasi WeLearn Moodle milik pengguna. Gunakan ketika pengguna menanyakan tentang tugas akademik WeLearn mereka.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"status_filter": map[string]interface{}{
							"type":        "string",
							"description": "Filter status opsional: 'new' (belum dikumpul), 'draft' (draf), 'submitted' (sudah dikumpul), atau 'all' (semua)",
						},
					},
				},
			},
		},
		{
			Type: "function",
			Function: &OpenRouterFunction{
				Name:        "GetWeLearnCourses",
				Description: "Mengambil daftar mata kuliah aktif mahasiswa beserta statistik jumlah tugas terbengkalai dari LMS WeLearn WICIDA. Gunakan ketika pengguna menanyakan mata kuliah aktif mereka.",
				Parameters: map[string]interface{}{
					"type":       "object",
					"properties": map[string]interface{}{},
				},
			},
		},
		{
			Type: "function",
			Function: &OpenRouterFunction{
				Name:        "GenerateWeLearnDocx",
				Description: "Menghasilkan berkas Word .docx profesional dari draf jawaban Anda agar siap diunduh oleh pengguna. Gunakan ketika pengguna meminta dibuatkan file Word/docx dari jawaban soal, atau ketika pengguna berada di Mode Jawaban Instan.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"title": map[string]interface{}{
							"type":        "string",
							"description": "Judul dokumen tugas, misal: 'Tugas Mandiri 3 - Analisis Leksikal'",
						},
						"content": map[string]interface{}{
							"type":        "string",
							"description": "Isi dokumen lengkap dalam format Markdown terstruktur (gunakan heading #, ##, bullet points -, dan tabel | jika diperlukan). Berikan jawaban yang sangat detail, komprehensif, dan lengkap tanpa ringkasan.",
						},
					},
					"required": []string{"title", "content"},
				},
			},
		},
	}
}

// ─── AI Analytics Insights Helpers ───────────────────────────────────────────

type insightJSONResponse struct {
	Title          string `json:"title"`
	Message        string `json:"message"`
	Recommendation string `json:"recommendation"`
}

func parseInsightJSON(raw string) (string, string, string, error) {
	rawClean := strings.TrimSpace(raw)
	if strings.HasPrefix(rawClean, "```json") {
		rawClean = strings.TrimPrefix(rawClean, "```json")
		rawClean = strings.TrimSuffix(rawClean, "```")
		rawClean = strings.TrimSpace(rawClean)
	} else if strings.HasPrefix(rawClean, "```") {
		rawClean = strings.TrimPrefix(rawClean, "```")
		rawClean = strings.TrimSuffix(rawClean, "```")
		rawClean = strings.TrimSpace(rawClean)
	}

	var res insightJSONResponse
	if err := json.Unmarshal([]byte(rawClean), &res); err != nil {
		return "", "", "", err
	}
	return res.Title, res.Message, res.Recommendation, nil
}

func GeneratePersonalizedInsight(userIDStr string, totalTasks, completedTasks int, focusHours, meetingHours float64, peakDay, peakHourRange, burnoutStatus string, burnoutScore float64) (string, string, error) {
	if GlobalAsep == nil {
		return "", "", fmt.Errorf("Asep AI agent belum diinisialisasi")
	}

	keys := fetchUserKeys(userIDStr)

	prompt := fmt.Sprintf(
		"Data produktivitas pengguna:\n- Total Tugas: %d, Selesai: %d\n- Akumulasi Jam Fokus: %.1f jam\n- Jam Rapat/Kalender: %.1f jam\n- Hari Terproduktif (Golden Hours): %s pada %s\n- Status Stres/Burnout: %s (Skor: %.0f%%)\n",
		totalTasks, completedTasks, focusHours, meetingHours, peakDay, peakHourRange, burnoutStatus, burnoutScore,
	)

	systemPrompt := "Kamu adalah Asep, kating mentor produktivitas mahasiswa di WICIDA. " +
		"Berikan analisis produktivitas yang super personal, akrab (style kating: santai, bersahabat, cerdas, solutif), " +
		"dan memotivasi untuk adik tingkatmu berdasarkan data performa yang diberikan. " +
		"Tugasmu:\n" +
		"1. Analisis data tersebut dan berikan wawasan yang sangat personal dan spesifik pola produktivitas harian user (contoh: \"Kamu paling produktif di Selasa pagi...\" atau \"Wah, hari Kamis kamu bener-bener gaspol...\").\n" +
		"2. Berikan 1 rekomendasi konkret yang santai tapi praktis (misal: kurangi begadang di hari X, pasang blocker rapat, atau cicil tugas Moodle).\n" +
		"3. Batasi respon 'message' maksimal 250 karakter, dan 'recommendation' maksimal 150 karakter.\n" +
		"4. Tuliskan output dalam format JSON mentah (jangan pakai markdown code block ```json) dengan struktur berikut:\n" +
		"{\"title\": \"Analisis Personal Asep \\u26a1\", \"message\": \"<isi pesan wawasan>\", \"recommendation\": \"<isi rekomendasi konkret>\"}"

	var reply string
	var err error
	var errs []string

	// 1. Coba Groq
	if keys.GroqKey != "" && isProviderHealthy("groq") {
		logger.Info("Sending request to Groq for personalized insight")
		reply, err = GlobalAsep.askGroqSimple(systemPrompt, prompt, keys.GroqKey)
		if err == nil {
			recordProviderSuccess("groq")
			_, msg, rec, errParse := parseInsightJSON(reply)
			if errParse == nil {
				return msg, rec, nil
			}
			logger.Warn("Failed to parse JSON from Groq insight response", "error", errParse)
		} else {
			recordProviderFailure("groq", err)
			errs = append(errs, fmt.Sprintf("Groq (%v)", err))
		}
	}

	// 2. Coba Gemini
	if keys.GeminiKey != "" && isProviderHealthy("gemini") && GlobalAsep.geminiClient != nil {
		logger.Info("Sending request to Gemini for personalized insight")
		reply, err = GlobalAsep.askGeminiSimple(systemPrompt, prompt, keys.GeminiKey)
		if err == nil {
			recordProviderSuccess("gemini")
			_, msg, rec, errParse := parseInsightJSON(reply)
			if errParse == nil {
				return msg, rec, nil
			}
			logger.Warn("Failed to parse JSON from Gemini insight response", "error", errParse)
		} else {
			recordProviderFailure("gemini", err)
			errs = append(errs, fmt.Sprintf("Gemini (%v)", err))
		}
	}

	// 3. Coba OpenRouter
	if isProviderHealthy("openrouter") {
		logger.Info("Sending request to OpenRouter for personalized insight")
		reply, err = GlobalAsep.askOpenRouterSimple(systemPrompt, prompt, keys.OpenRouterKey)
		if err == nil {
			recordProviderSuccess("openrouter")
			_, msg, rec, errParse := parseInsightJSON(reply)
			if errParse == nil {
				return msg, rec, nil
			}
			logger.Warn("Failed to parse JSON from OpenRouter insight response", "error", errParse)
		} else {
			recordProviderFailure("openrouter", err)
			errs = append(errs, fmt.Sprintf("OpenRouter (%v)", err))
		}
	}

	// Fallback jika semua LLM gagal atau format salah
	fallbackMsg := fmt.Sprintf("Berdasarkan rekaman aktivitas, hari paling produktif Anda adalah %s pada range %s.", peakDay, peakHourRange)
	fallbackRec := "Pertahankan ritme ini! Gunakan waktu produktif tersebut untuk menyelesaikan tugas berprioritas tinggi."
	if len(errs) > 0 {
		return fallbackMsg, fallbackRec, fmt.Errorf("semua provider AI gagal: %s", strings.Join(errs, ", "))
	}
	return fallbackMsg, fallbackRec, nil
}

func (h *AsepAgent) askGroqSimple(systemPrompt, userMessage, apiKey string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	messages := []GroqMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userMessage},
	}

	reqBody := GroqRequest{
		Model:    "llama-3.1-8b-instant",
		Messages: messages,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.httpClient.Do(req.WithContext(ctx))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var groqResp GroqResponse
	if err := json.Unmarshal(bodyBytes, &groqResp); err != nil {
		return "", err
	}

	if len(groqResp.Choices) == 0 {
		return "", fmt.Errorf("empty choices")
	}

	return groqResp.Choices[0].Message.Content, nil
}

func (h *AsepAgent) askGeminiSimple(systemPrompt, userMessage, apiKey string) (string, error) {
	modelName := config.AppConfig.GeminiModel
	if modelName == "" {
		modelName = "gemini-2.0-flash"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	var client *genai.Client
	var err error
	if apiKey != "" && apiKey != config.AppConfig.GeminiAPIKey {
		client, err = genai.NewClient(ctx, &genai.ClientConfig{
			APIKey:  apiKey,
			Backend: genai.BackendGeminiAPI,
		})
		if err != nil {
			return "", err
		}
	} else {
		client = h.geminiClient
	}

	if client == nil {
		return "", fmt.Errorf("Gemini client nil")
	}

	contents := []*genai.Content{
		{
			Role:  "user",
			Parts: []*genai.Part{{Text: userMessage}},
		},
	}

	cfg := &genai.GenerateContentConfig{
		SystemInstruction: &genai.Content{
			Parts: []*genai.Part{{Text: systemPrompt}},
		},
	}

	resp, err := client.Models.GenerateContent(ctx, modelName, contents, cfg)
	if err != nil {
		return "", err
	}

	if resp == nil || resp.Text() == "" {
		return "", fmt.Errorf("empty text response")
	}

	return resp.Text(), nil
}

func (h *AsepAgent) askOpenRouterSimple(systemPrompt, userMessage, apiKey string) (string, error) {
	modelName := config.AppConfig.OpenRouterModel
	if modelName == "" {
		modelName = "meta-llama/llama-3.3-70b-instruct:free"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	messages := []OpenRouterMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userMessage},
	}

	reqBody := OpenRouterRequest{
		Model:    modelName,
		Messages: messages,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", "https://openrouter.ai/api/v1/chat/completions", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "https://github.com/motion/backend")
	req.Header.Set("X-Title", "Motion Analytics")

	resp, err := h.httpClient.Do(req.WithContext(ctx))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var orResp OpenRouterResponse
	if err := json.Unmarshal(bodyBytes, &orResp); err != nil {
		return "", err
	}

	if len(orResp.Choices) == 0 {
		return "", fmt.Errorf("empty choices")
	}

	return orResp.Choices[0].Message.Content, nil
}

