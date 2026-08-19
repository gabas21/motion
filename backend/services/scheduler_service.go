package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
)

// StartReminderScheduler memulai proses asinkron pemindaian pengingat tugas di latar belakang
func StartReminderScheduler() {
	// Jalankan pemindaian berkala setiap 1 menit
	ticker := time.NewTicker(1 * time.Minute)
	go func() {
		for range ticker.C {
			ScanAndSendReminders()
		}
	}()
	log.Println("Scheduler: Pengingat tugas latar belakang diaktifkan (memindai setiap 1 menit).")
}

// ScanAndSendReminders memindai database PostgreSQL Supabase untuk mencari tugas yang mendekati jatuh tempo
func ScanAndSendReminders() {
	if config.DB == nil {
		return
	}

	// 1. Dapatkan Distributed Lock via Redis jika tersedia
	if config.IsRedisAvailable() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		// SetNX (Set if Not Exists) untuk lock "lock:reminder:scan" dengan TTL 50 detik
		success, err := config.RedisClient.SetNX(ctx, "lock:reminder:scan", "1", 50*time.Second).Result()
		if err != nil {
			log.Printf("Scheduler: Gagal berinteraksi dengan Redis untuk lock: %v. Fallback menjalankan tanpa lock.", err)
		} else if !success {
			// Lock sudah dipegang oleh instance lain, lewati eksekusi kali ini
			return
		}
	}

	var tasks []models.Task
	now := time.Now()
	// Batas waktu 15 menit ke depan
	upcomingLimit := now.Add(15 * time.Minute)

	// Cari tugas yang mendekati jatuh tempo DAN pemiliknya masih ada di database
	// (JOIN dengan tabel users untuk otomatis skip orphan tasks)
	err := config.DB.
		Joins("JOIN users ON users.id = tasks.user_id AND users.deleted_at IS NULL").
		Where(
			"tasks.scheduled_start IS NOT NULL AND tasks.reminder_sent = ? AND tasks.scheduled_start <= ? AND tasks.status NOT IN ('completed', 'cancelled')",
			false, upcomingLimit,
		).
		Where("tasks.deleted_at IS NULL").
		Find(&tasks).Error

	if err != nil {
		log.Printf("Scheduler: Gagal memindai pengingat tugas: %v", err)
		return
	}

	if len(tasks) == 0 {
		return
	}

	log.Printf("Scheduler: Menemukan %d tugas yang mendekati tenggat jatuh tempo untuk diberi notifikasi.", len(tasks))

	for _, task := range tasks {
		// Ambil data profil pengguna yang memiliki tugas tersebut
		var user models.User
		if err := config.DB.First(&user, "id = ?", task.UserID).Error; err != nil {
			// User tidak ditemukan (seharusnya tidak terjadi karena sudah di-JOIN)
			// Tandai reminder_sent agar tidak diproses lagi
			config.DB.Model(&task).Update("reminder_sent", true)
			continue
		}

		// Jalankan pengiriman notifikasi di dalam goroutine terpisah agar tidak memblokir antrean tugas lainnya
		go func(t models.Task, u models.User) {
			// 1. Kirim Email Notifikasi (Mailpit Laragon)
			SendEmailTaskReminder(u.Email, u.Name, t.Title, *t.ScheduledStart)

			// 2. Kirim Pesan Real-time via WebSocket
			reminderPayload := map[string]interface{}{
				"type":      "TASK_REMINDER",
				"taskTitle": t.Title,
				"taskId":    t.ID.String(),
				"startTime": t.ScheduledStart.Format(time.RFC3339),
			}
			msgBytes, err := json.Marshal(reminderPayload)
			if err == nil {
				WSHub.Broadcast(t.UserID.String(), msgBytes)
			}

			// 3. Kirim Telegram Message jika telegram_chat_id terhubung
			if u.TelegramChatID != "" {
				loc, _ := time.LoadLocation("Asia/Jakarta")
				waktuLokal := t.ScheduledStart.In(loc)
				waktuIndo := waktuLokal.Format("15:04")

				telegramMsg := fmt.Sprintf(
					"⏰ <b>Pengingat Tugas Penting!</b>\n\nHalo <b>%s</b>, tugas Anda:\n👉 <b>%s</b>\nakan segera dimulai pada pukul <b>%s</b> WIB!\n\nTetap fokus dan selesaikan tugas ini ya! 🎯",
					escapeHTML(u.Name), escapeHTML(t.Title), waktuIndo,
				)

				// Berikan Inline Keyboard untuk menyelesaikan tugas langsung dari HP
				markup := &TelegramReplyMarkup{
					InlineKeyboard: [][]TelegramInlineKeyboardButton{
						{
							{Text: "✅ Selesaikan Sekarang", CallbackData: "complete_task_" + t.ID.String()},
						},
					},
				}

				if err := SendTelegramMessage(u.TelegramChatID, telegramMsg, markup); err != nil {
					log.Printf("Scheduler: Gagal mengirim pesan Telegram ke %s: %v", u.TelegramChatID, err)
				} else {
					log.Printf("Scheduler: Sukses mengirim pesan Telegram pengingat tugas '%s' ke %s", t.Title, u.TelegramChatID)
				}
			}
		}(task, user)

		// Tandai reminder_sent = true di database PostgreSQL Supabase untuk mencegah pengiriman berulang
		if err := config.DB.Model(&task).Update("reminder_sent", true).Error; err != nil {
			log.Printf("Scheduler: Gagal memperbarui status pengingat tugas %s ke database: %v", task.ID, err)
		}
	}

	// Bersihkan orphan tasks (tasks yang pemiliknya sudah tidak ada) dalam satu batch query
	// agar tidak terus menerus memindai tasks yang tidak berguna
	cleanupResult := config.DB.Exec(`
		UPDATE tasks SET reminder_sent = true
		WHERE reminder_sent = false
		AND deleted_at IS NULL
		AND user_id NOT IN (SELECT id FROM users WHERE deleted_at IS NULL)
	`)
	if cleanupResult.RowsAffected > 0 {
		log.Printf("Scheduler: Membersihkan %d orphan tasks (pemilik sudah tidak ada).", cleanupResult.RowsAffected)
	}
}



