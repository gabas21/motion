package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
)

// Sesi Percakapan Telegram untuk State Machine
type SessionState string

const (
	StateIdle            SessionState = "IDLE"
	StateWaitingTitle    SessionState = "WAITING_TITLE"
	StateWaitingPriority SessionState = "WAITING_PRIORITY"
	StateWaitingDueDate  SessionState = "WAITING_DUE_DATE"
)

type TelegramSession struct {
	UserID         uuid.UUID
	State          SessionState
	TempTitle      string
	TempPriority   int
	TempDueDate    *time.Time
	LastActiveTime time.Time
}

var (
	// Map sesi Telegram: telegram_chat_id -> TelegramSession
	sessions     = make(map[string]*TelegramSession)
	sessionsMu   sync.RWMutex
	telegramHost = "https://api.telegram.org"
)

// JSON API Telegram Structs
type TelegramUpdate struct {
	UpdateID      int64                  `json:"update_id"`
	Message       *TelegramMessage       `json:"message"`
	CallbackQuery *TelegramCallbackQuery `json:"callback_query"`
}

type TelegramMessage struct {
	MessageID int64         `json:"message_id"`
	From      TelegramUser  `json:"from"`
	Chat      TelegramChat  `json:"chat"`
	Text      string        `json:"text"`
	Date      int64         `json:"date"`
}

type TelegramUser struct {
	ID        int64  `json:"id"`
	IsBot     bool   `json:"is_bot"`
	FirstName string `json:"first_name"`
	Username  string `json:"username"`
}

type TelegramChat struct {
	ID   int64  `json:"id"`
	Type string `json:"type"`
}

type TelegramCallbackQuery struct {
	ID            string           `json:"id"`
	From          TelegramUser     `json:"from"`
	Message       *TelegramMessage `json:"message"`
	Data          string           `json:"data"`
}

type TelegramInlineKeyboardButton struct {
	Text         string `json:"text"`
	CallbackData string `json:"callback_data"`
}

type TelegramKeyboardButton struct {
	Text string `json:"text"`
}

type TelegramReplyMarkup struct {
	InlineKeyboard [][]TelegramInlineKeyboardButton `json:"inline_keyboard,omitempty"`
	Keyboard       [][]TelegramKeyboardButton       `json:"keyboard,omitempty"`
	ResizeKeyboard bool                           `json:"resize_keyboard,omitempty"`
}

// StartLongPolling menjalankan background worker untuk polling pesan baru dari Telegram di lokal
func StartLongPolling() {
	token := config.AppConfig.TelegramBotToken
	if token == "" {
		log.Println("Telegram Bot Token is empty. Skipping Telegram background service.")
		return
	}

	log.Printf("Starting Telegram Bot Polling service for @Agasita_bot...")

	// Jalankan rutin pembersihan sesi kedaluwarsa secara berkala
	go cleanExpiredSessions()

	go func() {
		offset := int64(0)
		client := &http.Client{Timeout: 30 * time.Second}

		for {
			url := fmt.Sprintf("%s/bot%s/getUpdates?offset=%d&timeout=25", telegramHost, token, offset)
			resp, err := client.Get(url)
			if err != nil {
				log.Printf("Telegram polling connection error: %v. Retrying in 5 seconds...", err)
				time.Sleep(5 * time.Second)
				continue
			}

			body, err := io.ReadAll(resp.Body)
			resp.Body.Close()
			if err != nil {
				log.Printf("Telegram polling failed to read body: %v", err)
				time.Sleep(2 * time.Second)
				continue
			}

			if resp.StatusCode != http.StatusOK {
				log.Printf("Telegram polling API returned status %d: %s", resp.StatusCode, string(body))
				time.Sleep(5 * time.Second)
				continue
			}

			var result struct {
				Ok     bool             `json:"ok"`
				Result []TelegramUpdate `json:"result"`
			}

			if err := json.Unmarshal(body, &result); err != nil {
				log.Printf("Telegram polling failed to parse JSON: %v", err)
				time.Sleep(2 * time.Second)
				continue
			}

			if result.Ok {
				for _, update := range result.Result {
					// Panggil fungsi utama pemrosesan pesan
					ProcessTelegramUpdate(update)
					offset = update.UpdateID + 1
				}
			}

			time.Sleep(200 * time.Millisecond)
		}
	}()
}

// ProcessTelegramUpdate memproses pesan atau tombol callback dari Telegram
func ProcessTelegramUpdate(update TelegramUpdate) {
	token := config.AppConfig.TelegramBotToken
	if token == "" {
		return
	}

	// 1. Tangani Klik Tombol Inline (Callback Query)
	if update.CallbackQuery != nil {
		chatIDStr := strconv.FormatInt(update.CallbackQuery.Message.Chat.ID, 10)
		callbackData := update.CallbackQuery.Data

		// Jawab callback query ke telegram agar loading-nya hilang
		answerCallbackQuery(update.CallbackQuery.ID)

		sessionsMu.Lock()
		session, hasSession := sessions[chatIDStr]
		if hasSession {
			session.LastActiveTime = time.Now()
		}
		sessionsMu.Unlock()

		if !hasSession {
			SendTelegramMessage(chatIDStr, "⚠️ Sesi Anda telah kedaluwarsa atau belum dimulai. Silakan kirim /add untuk membuat tugas baru.", nil)
			return
		}

		handleCallbackQuery(chatIDStr, session, callbackData)
		return
	}

	// 2. Tangani Pesan Teks
	if update.Message != nil && update.Message.Text != "" {
		chatIDStr := strconv.FormatInt(update.Message.Chat.ID, 10)
		text := strings.TrimSpace(update.Message.Text)

		// Ambil user dari database berdasarkan Chat ID Telegram
		var user models.User
		dbErr := config.DB.Where("telegram_chat_id = ?", chatIDStr).First(&user).Error
		isSynced := dbErr == nil

		// A. Jika belum tersinkronisasi, hanya izinkan perintah /sync atau /start
		if !isSynced {
			if strings.HasPrefix(text, "/sync") || strings.HasPrefix(text, "/start") {
				handleSyncCommand(chatIDStr, text)
			} else {
				// Beri petunjuk cara sinkronisasi
				msg := "👋 Selamat datang di <b>Motion Scheduler Bot</b>!\n\n" +
					"Akun Telegram Anda belum terhubung dengan akun aplikasi Motion.\n\n" +
					"Untuk menghubungkannya:\n" +
					"1. Masuk ke aplikasi <b>Motion</b> di web.\n" +
					"2. Buka <b>Pengaturan > Integrasi > Telegram</b>.\n" +
					"3. Klik tombol <b>Hubungkan</b> untuk mendapatkan kode OTP 6-Digit.\n" +
					"4. Kirimkan pesan di sini: <code>/sync &lt;kode_otp&gt;</code>\n" +
					"   <i>(Contoh: <code>/sync 123456</code>)</i>"
				SendTelegramMessage(chatIDStr, msg, nil)
			}
			return
		}

		// B. Jika sudah tersinkronisasi, periksa state session
		sessionsMu.Lock()
		session, hasSession := sessions[chatIDStr]
		if !hasSession {
			// Buat sesi baru (Idle) jika belum ada
			session = &TelegramSession{
				UserID:         user.ID,
				State:          StateIdle,
				LastActiveTime: time.Now(),
			}
			sessions[chatIDStr] = session
		} else {
			session.LastActiveTime = time.Now()
		}
		sessionsMu.Unlock()

		// C. Jalankan Form Conversational jika sedang aktif mengisi
		if session.State != StateIdle {
			handleConversationalForm(chatIDStr, session, text)
			return
		}

		// D. Jalankan Menu Perintah Utama (State IDLE)
		handleCommand(chatIDStr, session, text, user.Name)
	}
}

// Menangani sinkronisasi akun via OTP
func handleSyncCommand(chatIDStr string, text string) {
	parts := strings.Fields(text)
	var otpCode string

	if len(parts) > 1 {
		otpCode = parts[1]
	} else if strings.HasPrefix(text, "/start ") {
		// Menangani jika dipicu dari tautan t.me/Agasita_bot?start=123456
		otpCode = strings.TrimPrefix(text, "/start ")
	}

	if otpCode == "" {
		msg := "⚠️ Mohon sertakan kode OTP sinkronisasi Anda.\nFormat: <code>/sync &lt;kode_otp&gt;</code>\nContoh: <code>/sync 832910</code>"
		SendTelegramMessage(chatIDStr, msg, nil)
		return
	}

	// Cari user dengan OTP yang valid dan belum kedaluwarsa
	var user models.User
	now := time.Now()
	err := config.DB.Where("telegram_otp = ? AND telegram_otp_exp > ?", otpCode, now).First(&user).Error
	if err != nil {
		SendTelegramMessage(chatIDStr, "❌ <b>Kode OTP Salah atau Sudah Kedaluwarsa!</b>\nSilakan generate kode baru di halaman Pengaturan Aplikasi Motion Anda.", nil)
		return
	}

	// Simpan Chat ID Telegram pengguna ke dalam model database User
	user.TelegramChatID = chatIDStr
	user.TelegramOTP = "" // Hapus OTP setelah sukses
	user.TelegramOTPExp = nil
	if err := config.DB.Save(&user).Error; err != nil {
		SendTelegramMessage(chatIDStr, "❌ Gagal menyimpan koneksi Telegram. Silakan coba beberapa saat lagi.", nil)
		return
	}

	welcomeMsg := fmt.Sprintf("🎉 <b>Koneksi Sukses!</b>\n\nHalo <b>%s</b>, akun Telegram Anda berhasil terhubung dengan akun Motion Anda.\n\n"+
		"Sekarang Anda dapat dengan mudah mengelola tugas langsung dari HP menggunakan menu berikut:\n"+
		"• Ketik <code>/add</code> atau klik tombol di bawah untuk membuat tugas baru.\n"+
		"• Ketik <code>/list</code> untuk melihat daftar tugas hari ini.\n"+
		"• Ketik <code>/done</code> untuk menyelesaikan tugas.\n"+
		"• Ketik <code>/help</code> untuk bantuan.", escapeHTML(user.Name))

	// Berikan Custom Keyboard Menu Utama di bagian bawah layar HP
	markup := TelegramReplyMarkup{
		Keyboard: [][]TelegramKeyboardButton{
			{{Text: "➕ Tambah Tugas"}, {Text: "📋 Daftar Tugas"}},
			{{Text: "✅ Selesaikan Tugas"}, {Text: "❓ Bantuan"}},
		},
		ResizeKeyboard: true,
	}

	SendTelegramMessage(chatIDStr, welcomeMsg, &markup)
}

// Menangani perintah standar di status IDLE
func handleCommand(chatIDStr string, session *TelegramSession, text string, userName string) {
	// Normalisasi teks input
	cmd := strings.ToLower(text)

	switch {
	case cmd == "/start" || cmd == "❓ bantuan" || cmd == "/help":
		helpMsg := fmt.Sprintf("👋 Halo <b>%s</b>!\nBerikut adalah perintah yang bisa Anda gunakan:\n\n"+
			"1. <b>➕ Tambah Tugas</b>: Ketik <code>/add</code> atau klik tombol menu untuk memulai pengisian formulir tugas baru langkah demi langkah.\n"+
			"2. <b>📋 Daftar Tugas</b>: Ketik <code>/list</code> untuk menampilkan tugas-tugas aktif Anda.\n"+
			"3. <b>✅ Selesaikan Tugas</b>: Ketik <code>/done</code> untuk mencoret tugas selesai.\n"+
			"4. <b>❌ Batalkan</b>: Jika sedang mengisi form, ketik <code>/cancel</code> untuk membatalkan pengisian.\n"+
			"5. <b>🤖 Tanya Asep</b>: Cukup kirim pesan teks biasa apa saja (contoh: <i>tugas apa saja yang deadline minggu ini?</i>), atau gunakan perintah <code>/ask &lt;pertanyaan&gt;</code> untuk berkonsultasi langsung dengan AI asisten Anda!", escapeHTML(userName))
		SendTelegramMessage(chatIDStr, helpMsg, nil)

	case cmd == "/add" || cmd == "➕ tambah tugas":
		// Mulai Formulir Chat Interaktif!
		session.State = StateWaitingTitle
		session.TempTitle = ""
		session.TempPriority = 3
		session.TempDueDate = nil

		// Kirim tombol Cancel di Keyboard agar pengguna bisa membatalkan kapan saja
		cancelMarkup := TelegramReplyMarkup{
			Keyboard: [][]TelegramKeyboardButton{
				{{Text: "❌ Batalkan Pengisian"}},
			},
			ResizeKeyboard: true,
		}
		SendTelegramMessage(chatIDStr, "📝 <b>[1/3] Nama Tugas</b>\nSilakan ketik nama atau judul tugas baru Anda:", &cancelMarkup)

	case cmd == "/list" || cmd == "📋 daftar tugas":
		listTasks(chatIDStr, session.UserID)

	case cmd == "/done" || cmd == "✅ selesaikan tugas":
		showTasksForCompletion(chatIDStr, session.UserID)

	default:
		// Periksa apakah pesan menggunakan command /ask
		question := text
		if strings.HasPrefix(cmd, "/ask ") {
			question = strings.TrimSpace(text[5:])
		} else if cmd == "/ask" {
			SendTelegramMessage(chatIDStr, "🤖 Silakan ketik pertanyaan Anda setelah <code>/ask</code>.\n\n<i>Contoh:</i> <code>/ask apa saja tugas kuliahku hari ini?</code>", nil)
			return
		}

		// Kirim status "typing" secara asinkron ke Telegram agar terasa alami
		go sendChatAction(chatIDStr, "typing")

		// Panggil AI secara asinkron (Goroutine) agar tidak menahan polling event loop
		go func(chatId string, uID string, q string) {
			reply, err := AskAsep(AIChatInput{
				UserID:      uID,
				Message:     q,
				History:     nil,
				Personality: "productive",
			})
			if err != nil {
				SendTelegramMessage(chatId, "⚠️ Maaf Kak, otak AI saya sedang mengalami gangguan koneksi. Silakan coba lagi nanti ya!", nil)
				return
			}
			SendTelegramMessage(chatId, reply, nil)
		}(chatIDStr, session.UserID.String(), question)
	}
}

// Menangani pengisian formulir chat interaktif (Conversational State Machine)
func handleConversationalForm(chatIDStr string, session *TelegramSession, text string) {
	// Izinkan pembatalan kapan saja
	if strings.ToLower(text) == "/cancel" || text == "❌ Batalkan Pengisian" {
		session.State = StateIdle
		resetReplyKeyboardToMain(chatIDStr, "❌ Pengisian tugas telah dibatalkan.")
		return
	}

	switch session.State {
	case StateWaitingTitle:
		title := strings.TrimSpace(text)
		if len(title) < 3 {
			SendTelegramMessage(chatIDStr, "⚠️ Judul tugas terlalu pendek. Mohon ketik nama tugas yang lebih jelas (min. 3 karakter):", nil)
			return
		}

		session.TempTitle = title
		session.State = StateWaitingPriority

		// Buat inline keyboard untuk memilih Prioritas 1 - 5
		markup := TelegramReplyMarkup{
			InlineKeyboard: [][]TelegramInlineKeyboardButton{
				{
					{Text: "1 - Rendah", CallbackData: "priority_1"},
					{Text: "2", CallbackData: "priority_2"},
				},
				{
					{Text: "3 - Sedang", CallbackData: "priority_3"},
					{Text: "4", CallbackData: "priority_4"},
				},
				{
					{Text: "5 - Tinggi", CallbackData: "priority_5"},
				},
			},
		}

		msg := fmt.Sprintf("📝 <b>Judul</b>: <i>%s</i>\n\n🔥 <b>[2/3] Prioritas Tugas</b>\nSilakan pilih tingkat prioritas tugas ini:", escapeHTML(title))
		SendTelegramMessage(chatIDStr, msg, &markup)

	default:
		SendTelegramMessage(chatIDStr, "⚠️ Terjadi kesalahan input sesi. Silakan ketik /cancel untuk mereset.", nil)
	}
}

// Menangani Callback klik tombol inline
func handleCallbackQuery(chatIDStr string, session *TelegramSession, callbackData string) {
	if session.State == StateIdle {
		return
	}

	// 1. Pilih Prioritas
	if strings.HasPrefix(callbackData, "priority_") && session.State == StateWaitingPriority {
		pStr := strings.TrimPrefix(callbackData, "priority_")
		pVal, err := strconv.Atoi(pStr)
		if err != nil {
			pVal = 3
		}

		session.TempPriority = pVal
		session.State = StateWaitingDueDate

		// Buat inline keyboard untuk memilih Tenggat Waktu
		markup := TelegramReplyMarkup{
			InlineKeyboard: [][]TelegramInlineKeyboardButton{
				{
					{Text: "📅 Hari Ini", CallbackData: "due_today"},
					{Text: "🌅 Besok", CallbackData: "due_tomorrow"},
				},
				{
					{Text: "🗓️ Lusa", CallbackData: "due_day_after"},
					{Text: "⏳ Minggu Depan", CallbackData: "due_next_week"},
				},
				{
					{Text: "📂 Tanpa Tenggat", CallbackData: "due_none"},
				},
			},
		}

		pLabels := map[int]string{1: "1 (Rendah)", 2: "2", 3: "3 (Sedang)", 4: "4", 5: "5 (Tinggi)"}
		msg := fmt.Sprintf("📝 <b>Judul</b>: <i>%s</i>\n🔥 <b>Prioritas</b>: %s\n\n📅 <b>[3/3] Tenggat Waktu (Due Date)</b>\nKapan batas waktu penyelesaian tugas ini?", escapeHTML(session.TempTitle), pLabels[pVal])
		SendTelegramMessage(chatIDStr, msg, &markup)
		return
	}

	// 2. Pilih Tenggat Waktu (Finishing Form!)
	if strings.HasPrefix(callbackData, "due_") && session.State == StateWaitingDueDate {
		var dueTime *time.Time
		now := time.Now()
		dueLabel := "Tanpa Tenggat"

		switch callbackData {
		case "due_today":
			t := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, now.Location())
			dueTime = &t
			dueLabel = "Hari Ini (23:59)"
		case "due_tomorrow":
			tomorrow := now.AddDate(0, 0, 1)
			t := time.Date(tomorrow.Year(), tomorrow.Month(), tomorrow.Day(), 23, 59, 59, 0, tomorrow.Location())
			dueTime = &t
			dueLabel = "Besok (23:59)"
		case "due_day_after":
			dayAfter := now.AddDate(0, 0, 2)
			t := time.Date(dayAfter.Year(), dayAfter.Month(), dayAfter.Day(), 23, 59, 59, 0, dayAfter.Location())
			dueTime = &t
			dueLabel = "Lusa"
		case "due_next_week":
			nextWeek := now.AddDate(0, 0, 7)
			t := time.Date(nextWeek.Year(), nextWeek.Month(), nextWeek.Day(), 23, 59, 59, 0, nextWeek.Location())
			dueTime = &t
			dueLabel = "1 Minggu ke Depan"
		}

		session.TempDueDate = dueTime

		// Simpan tugas ke Database Supabase!
		task := models.Task{
			ID:                  uuid.New(),
			UserID:              session.UserID,
			Title:               session.TempTitle,
			Description:         "Dibuat via Telegram HP",
			TimeEstimateMinutes: 30, // Default estimate
			DueDate:             session.TempDueDate,
			Priority:            session.TempPriority,
			Status:              "pending",
			Category:            "general",
		}

		if err := config.DB.Create(&task).Error; err != nil {
			log.Printf("Failed to create task from Telegram: %v", err)
			session.State = StateIdle
			resetReplyKeyboardToMain(chatIDStr, "❌ Gagal menyimpan tugas ke database. Silakan coba kembali.")
			return
		}

		// Picu pengiriman WebSocket event ke frontend agar Dashboard langsung update otomatis tanpa refresh!
		TriggerTaskUpdateEvent(session.UserID.String())

		// Reset Sesi ke status IDLE
		session.State = StateIdle

		pLabels := map[int]string{1: "🟢 Rendah", 2: "🟡 Prioritas 2", 3: "🟠 Sedang", 4: "🔴 Prioritas 4", 5: "🔥 Tinggi"}
		successMsg := fmt.Sprintf("🚀 <b>Tugas Berhasil Ditambahkan!</b>\n\n"+
			"📋 <b>Judul</b>: <i>%s</i>\n"+
			"🔥 <b>Prioritas</b>: %s\n"+
			"📅 <b>Tenggat</b>: %s\n\n"+
			"Tugas ini telah disinkronisasikan ke Dashboard Motion Anda secara real-time! 💻",
			escapeHTML(task.Title), pLabels[task.Priority], dueLabel)

		resetReplyKeyboardToMain(chatIDStr, successMsg)
		return
	}

	// 3. Selesaikan Tugas via tombol inline callback klik
	if strings.HasPrefix(callbackData, "complete_task_") {
		taskIDStr := strings.TrimPrefix(callbackData, "complete_task_")
		taskID, err := uuid.Parse(taskIDStr)
		if err != nil {
			SendTelegramMessage(chatIDStr, "⚠️ ID Tugas tidak valid.", nil)
			return
		}

		// Perbarui status tugas di database
		var task models.Task
		if err := config.DB.First(&task, "id = ?", taskID).Error; err != nil {
			SendTelegramMessage(chatIDStr, "❌ Tugas tidak ditemukan atau sudah dihapus.", nil)
			return
		}

		now := time.Now()
		task.Status = "completed"
		task.CompletedAt = &now
		config.DB.Save(&task)

		// Trigger WebSocket update ke UI frontend
		TriggerTaskUpdateEvent(task.UserID.String())

		// Berikan balasan sukses
		editedText := fmt.Sprintf("✅ <b>Tugas Selesai!</b>\n\n<s>%s</s> berhasil dicoret dari jadwal Anda! 🎯", escapeHTML(task.Title))
		SendTelegramMessage(chatIDStr, editedText, nil)
	}

	// 4. Bantu Bikin Draf via tombol inline callback klik (Fase 3)
	if strings.HasPrefix(callbackData, "help_task_") {
		taskIDStr := strings.TrimPrefix(callbackData, "help_task_")
		taskID, err := uuid.Parse(taskIDStr)
		if err != nil {
			SendTelegramMessage(chatIDStr, "⚠️ ID Tugas tidak valid.", nil)
			return
		}

		// Cari tugas terkait
		var task models.Task
		if err := config.DB.First(&task, "id = ?", taskID).Error; err != nil {
			SendTelegramMessage(chatIDStr, "❌ Tugas tidak ditemukan atau sudah dihapus.", nil)
			return
		}

		// Kirim status "typing" secara asinkron ke Telegram agar terasa alami
		go sendChatAction(chatIDStr, "typing")

		// Panggil AI secara asinkron (Goroutine) agar tidak menahan polling event loop
		go func(chatId string, uID string, taskTitle string) {
			query := fmt.Sprintf("Buatkan draf outline jawaban/pengerjaan untuk tugas kuliah saya yang berjudul: '%s'. Cari referensi materi kuliah terkait di database RAG (pgvector document_chunks) kamu dan berikan panduan akademik lengkap agar saya bisa mengerjakannya.", taskTitle)
			
			reply, err := AskAsep(AIChatInput{
				UserID:      uID,
				Message:     query,
				History:     nil,
				Personality: "academic",
			})
			if err != nil {
				SendTelegramMessage(chatId, "⚠️ Maaf Kak, otak AI saya sedang mengalami gangguan koneksi. Silakan coba lagi nanti ya!", nil)
				return
			}
			SendTelegramMessage(chatId, reply, nil)
		}(chatIDStr, task.UserID.String(), task.Title)
	}
}

// Menampilkan daftar tugas pending hari ini
func listTasks(chatIDStr string, userID uuid.UUID) {
	var tasks []models.Task
	err := config.DB.Where("user_id = ? AND status != ? AND status != ? AND category != 'education_reminder'", userID, "completed", "cancelled").Order("priority desc, due_date asc").Limit(10).Find(&tasks).Error
	if err != nil {
		SendTelegramMessage(chatIDStr, "❌ Gagal memuat daftar tugas Anda.", nil)
		return
	}

	if len(tasks) == 0 {
		SendTelegramMessage(chatIDStr, "🌴 <b>Bagus sekali!</b> Tidak ada tugas pending saat ini. Semua jadwal bersih! 🥳", nil)
		return
	}

	var sb strings.Builder
	sb.WriteString("📋 <b>Daftar 10 Tugas Aktif Anda:</b>\n\n")
	
	pLabels := map[int]string{1: "🟢", 2: "🟡", 3: "🟠", 4: "🔴", 5: "🔥"}

	for i, task := range tasks {
		dueLabel := "Tanpa Tenggat"
		if task.DueDate != nil {
			dueLabel = task.DueDate.Format("02 Jan 2006")
			// Jika hari ini
			now := time.Now()
			if task.DueDate.Year() == now.Year() && task.DueDate.Month() == now.Month() && task.DueDate.Day() == now.Day() {
				dueLabel = "🚨 Hari Ini"
			}
		}
		sb.WriteString(fmt.Sprintf("%d. %s <b>%s</b>\n    <i>Batas: %s</i> | <i>Prioritas: %d</i>\n\n", i+1, pLabels[task.Priority], escapeHTML(task.Title), dueLabel, task.Priority))
	}

	SendTelegramMessage(chatIDStr, sb.String(), nil)
}

// Menampilkan tombol inline untuk memilih tugas mana yang ingin diselesaikan
func showTasksForCompletion(chatIDStr string, userID uuid.UUID) {
	var tasks []models.Task
	err := config.DB.Where("user_id = ? AND status = ? AND category != 'education_reminder'", userID, "pending").Order("priority desc").Limit(5).Find(&tasks).Error
	if err != nil {
		SendTelegramMessage(chatIDStr, "❌ Gagal memuat daftar tugas.", nil)
		return
	}

	if len(tasks) == 0 {
		SendTelegramMessage(chatIDStr, "😊 Tidak ada tugas pending yang dapat diselesaikan.", nil)
		return
	}

	var inlineButtons [][]TelegramInlineKeyboardButton
	for _, task := range tasks {
		btnText := fmt.Sprintf("✅ %s", task.Title)
		if len(btnText) > 30 {
			btnText = btnText[:27] + "..."
		}
		inlineButtons = append(inlineButtons, []TelegramInlineKeyboardButton{
			{Text: btnText, CallbackData: "complete_task_" + task.ID.String()},
		})
	}

	markup := TelegramReplyMarkup{
		InlineKeyboard: inlineButtons,
	}

	SendTelegramMessage(chatIDStr, "🎯 <b>Selesaikan Tugas</b>\nKlik salah satu tombol tugas di bawah ini untuk mencoretnya langsung secara instan:", &markup)
}

// Mengembalikan custom keyboard menu utama di bagian bawah layar HP
func resetReplyKeyboardToMain(chatIDStr string, text string) {
	markup := TelegramReplyMarkup{
		Keyboard: [][]TelegramKeyboardButton{
			{{Text: "➕ Tambah Tugas"}, {Text: "📋 Daftar Tugas"}},
			{{Text: "✅ Selesaikan Tugas"}, {Text: "❓ Bantuan"}},
		},
		ResizeKeyboard: true,
	}
	SendTelegramMessage(chatIDStr, text, &markup)
}

// Fungsi pembantu untuk mengirim callback query answer ke Telegram
func answerCallbackQuery(callbackQueryID string) {
	token := config.AppConfig.TelegramBotToken
	url := fmt.Sprintf("%s/bot%s/answerCallbackQuery", telegramHost, token)
	
	reqBody, _ := json.Marshal(map[string]string{
		"callback_query_id": callbackQueryID,
	})

	http.Post(url, "application/json", bytes.NewBuffer(reqBody))
}

// escapeHTML melakukan escaping karakter khusus HTML agar tidak merusak parser Telegram HTML
func escapeHTML(text string) string {
	r := strings.NewReplacer(
		"<", "&lt;",
		">", "&gt;",
		"&", "&amp;",
	)
	return r.Replace(text)
}

// SendTelegramMessage mengirim pesan teks HTML/Markdown ke Chat ID tertentu beserta reply markup jika ada
func SendTelegramMessage(chatIDStr string, text string, replyMarkup *TelegramReplyMarkup) error {
	token := config.AppConfig.TelegramBotToken
	if token == "" {
		return fmt.Errorf("telegram bot token is empty")
	}

	url := fmt.Sprintf("%s/bot%s/sendMessage", telegramHost, token)

	// Deteksi parse_mode secara dinamis berdasarkan keberadaan tag HTML
	parseMode := "Markdown"
	if strings.Contains(text, "<b>") || strings.Contains(text, "<i>") || strings.Contains(text, "<code>") || strings.Contains(text, "<s>") || strings.Contains(text, "<strike>") {
		parseMode = "HTML"
	}

	payload := map[string]interface{}{
		"chat_id":    chatIDStr,
		"text":       text,
		"parse_mode": parseMode,
	}

	if replyMarkup != nil {
		payload["reply_markup"] = replyMarkup
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[Telegram-WARNING] Gagal mengirim pesan dengan Markdown: %s. Melakukan fallback ke Plain Text...", string(body))

		// Fallback: Kirim tanpa parse_mode agar pesan tetap sampai!
		delete(payload, "parse_mode")
		jsonPayloadFallback, _ := json.Marshal(payload)

		respFallback, errFallback := http.Post(url, "application/json", bytes.NewBuffer(jsonPayloadFallback))
		if errFallback != nil {
			return errFallback
		}
		defer respFallback.Body.Close()

		if respFallback.StatusCode != http.StatusOK {
			bodyFallback, _ := io.ReadAll(respFallback.Body)
			return fmt.Errorf("telegram API returned status %d on fallback: %s", respFallback.StatusCode, string(bodyFallback))
		}
	}

	return nil
}

// Fungsi pembantu untuk memicu event WebSocket ke frontend (dashboard)
func TriggerTaskUpdateEvent(userIDStr string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered from panic in TriggerTaskUpdateEvent: %v", r)
		}
	}()

	payload := map[string]interface{}{
		"type":    "TASK_UPDATED",
		"message": "Tasks list has been updated via Telegram bot",
	}
	
	bytesPayload, err := json.Marshal(payload)
	if err == nil && WSHub != nil {
		WSHub.Broadcast(userIDStr, bytesPayload)
	}
}

// Routine background untuk membersihkan sesi yang kedaluwarsa setelah 15 menit tidak aktif
func cleanExpiredSessions() {
	for {
		time.Sleep(5 * time.Minute)
		sessionsMu.Lock()
		now := time.Now()
		for chatID, session := range sessions {
			if session.State != StateIdle && now.Sub(session.LastActiveTime) > 15*time.Minute {
				delete(sessions, chatID)
				// Reset keyboard di layar chat pengguna secara pasif
				go func(id string) {
					resetReplyKeyboardToMain(id, "⚠️ Sesi pengisian formulir Anda ditutup karena tidak ada aktivitas selama 15 menit.")
				}(chatID)
			}
		}
		sessionsMu.Unlock()
	}
}

// sendChatAction mengirim indikator aktivitas (seperti "typing") ke chat ID tertentu di Telegram
func sendChatAction(chatIDStr string, action string) {
	token := config.AppConfig.TelegramBotToken
	if token == "" {
		return
	}
	url := fmt.Sprintf("%s/bot%s/sendChatAction", telegramHost, token)
	payload := map[string]interface{}{
		"chat_id": chatIDStr,
		"action":  action,
	}
	jsonPayload, _ := json.Marshal(payload)
	http.Post(url, "application/json", bytes.NewBuffer(jsonPayload))
}
