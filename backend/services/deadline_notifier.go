package services

import (
	"encoding/json"
	"fmt"
	"log"
	"net/smtp"
	"strings"
	"time"

	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
)

// StartWeLearnDeadlineNotifier memulai scheduler pemindaian tugas WeLearn mendekati deadline
func StartWeLearnDeadlineNotifier() {
	// Jalankan pemindaian berkala setiap 30 menit
	ticker := time.NewTicker(30 * time.Minute)
	go func() {
		// Tunggu 45 detik saat startup agar DB & WebSocket Hub siap
		time.Sleep(45 * time.Second)
		ScanAndSendWeLearnDeadlines()

		for range ticker.C {
			ScanAndSendWeLearnDeadlines()
		}
	}()
	log.Println("[welearn-notifier] ✓ Notifier deadline diaktifkan (memindai setiap 30 menit).")
}

// ScanAndSendWeLearnDeadlines memindai database untuk tugas WeLearn yang mendekati deadline (< 24 jam)
func ScanAndSendWeLearnDeadlines() {
	if config.DB == nil {
		return
	}

	var tasks []models.Task
	now := time.Now()
	// Batas waktu 24 jam ke depan
	deadlineLimit := now.Add(24 * time.Hour)

	// Cari tugas WeLearn yang mendekati deadline (due_date) dan reminder belum dikirim
	err := config.DB.
		Joins("JOIN users ON users.id = tasks.user_id AND users.deleted_at IS NULL").
		Where(
			"tasks.due_date IS NOT NULL AND tasks.reminder_sent = ? AND tasks.due_date > ? AND tasks.due_date <= ? AND tasks.status NOT IN ('completed', 'cancelled')",
			false, now, deadlineLimit,
		).
		Where("tasks.description LIKE ?", "%[welearn-assign-id:%").
		Where("tasks.deleted_at IS NULL").
		Find(&tasks).Error

	if err != nil {
		log.Printf("[welearn-notifier] Gagal memindai tenggat waktu tugas: %v", err)
		return
	}

	if len(tasks) == 0 {
		return
	}

	log.Printf("[welearn-notifier] Menemukan %d tugas WeLearn mendekati deadline untuk diberi notifikasi.", len(tasks))

	for _, task := range tasks {
		var user models.User
		if err := config.DB.First(&user, "id = ?", task.UserID).Error; err != nil {
			// Tandai agar tidak diproses lagi jika user tidak ada
			config.DB.Model(&task).Update("reminder_sent", true)
			continue
		}

		go func(t models.Task, u models.User) {
			// 1. Kirim Email Notifikasi Premium (Neobrutalism Red)
			if err := SendEmailWeLearnDeadline(u.Email, u.Name, t.Title, *t.DueDate); err != nil {
				log.Printf("[welearn-notifier] Gagal kirim email deadline ke %s: %v", u.Email, err)
			}

			// 2. Kirim Pesan Real-time via WebSocket
			deadlinePayload := map[string]interface{}{
				"type":      "WELEARN_DEADLINE_ALERT",
				"taskTitle": t.Title,
				"taskId":    t.ID.String(),
				"dueDate":   t.DueDate.Format(time.RFC3339),
			}
			msgBytes, err := json.Marshal(deadlinePayload)
			if err == nil && WSHub != nil {
				WSHub.Broadcast(t.UserID.String(), msgBytes)
			}

			// 3. Kirim Telegram Message jika terhubung
			if u.TelegramChatID != "" {
				loc, _ := time.LoadLocation("Asia/Jakarta")
				waktuLokal := t.DueDate.In(loc)
				tanggalIndo := waktuLokal.Format("02 Jan 2006")
				waktuIndo := waktuLokal.Format("15:04")

				// Hitung sisa jam
				durasiSisa := time.Until(*t.DueDate)
				jamSisa := int(durasiSisa.Hours())
				menitSisa := int(durasiSisa.Minutes()) % 60
				
				sisaWaktuText := fmt.Sprintf("%d jam %d menit lagi", jamSisa, menitSisa)
				if jamSisa == 0 {
					sisaWaktuText = fmt.Sprintf("%d menit lagi", menitSisa)
				}

				telegramMsg := fmt.Sprintf(
					"⚠️ <b>[WELEARN DEADLINE ALERT]</b> ⚠️\n\nHalo <b>%s</b>,\ntugas WeLearn Anda:\n👉 <b>%s</b>\n\nJatuh tempo pada tanggal <b>%s</b> pukul <b>%s</b> WIB (<b>%s</b>)!\n\nJangan lupa dikumpulkan ya Kak! 🎯",
					escapeHTML(u.Name), escapeHTML(t.Title), tanggalIndo, waktuIndo, sisaWaktuText,
				)

				// Markup inline keyboard untuk coret tugas & bantuan AI
				markup := &TelegramReplyMarkup{
					InlineKeyboard: [][]TelegramInlineKeyboardButton{
						{
							{Text: "✅ Selesaikan & Coret", CallbackData: "complete_task_" + t.ID.String()},
							{Text: "🤖 Bantu Bikin Draf", CallbackData: "help_task_" + t.ID.String()},
						},
					},
				}

				if err := SendTelegramMessage(u.TelegramChatID, telegramMsg, markup); err != nil {
					log.Printf("[welearn-notifier] Gagal kirim Telegram ke %s: %v", u.TelegramChatID, err)
				}
			}
		}(task, user)

		// Tandai reminder_sent = true untuk mencegah pengiriman berulang
		if err := config.DB.Model(&task).Update("reminder_sent", true).Error; err != nil {
			log.Printf("[welearn-notifier] Gagal perbarui status reminder_sent tugas %s: %v", task.ID, err)
		}
	}
}

// SendEmailWeLearnDeadline mengirim notifikasi email bermotif Neobrutalisme Red khusus deadline WeLearn
func SendEmailWeLearnDeadline(toEmail string, userName string, taskTitle string, dueDate time.Time) error {
	smtpHost := config.AppConfig.SMTPHost
	smtpPort := config.AppConfig.SMTPPort

	loc, _ := time.LoadLocation("Asia/Jakarta")
	waktuLokal := dueDate.In(loc)
	waktuIndo := waktuLokal.Format("15:04")
	tanggalIndo := waktuLokal.Format("02 Jan 2006")

	// Bersihkan prefix "[WeLearn]" untuk subject jika ada
	cleanTitle := strings.Replace(taskTitle, "[WeLearn] ", "", 1)

	subject := fmt.Sprintf("Subject: ⚠️ WeLearn Deadline: %s jatuh tempo besok!\n", cleanTitle)
	mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"

	body := fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<head>
		<meta charset="UTF-8">
		<title>Peringatan Deadline WeLearn</title>
		<style>
			body {
				background-color: #FAF9F5;
				font-family: 'Plus Jakarta Sans', Arial, sans-serif;
				margin: 0;
				padding: 20px;
				color: #000000;
			}
			.email-container {
				max-width: 500px;
				margin: 0 auto;
				background-color: #FFFFFF;
				border: 3px solid #000000;
				box-shadow: 6px 6px 0px 0px #000000;
				border-radius: 16px;
				overflow: hidden;
			}
			.header {
				background-color: #FF5F5F; /* Neo Urgent Red */
				padding: 30px 20px;
				text-align: center;
				border-bottom: 3px solid #000000;
			}
			.header h1 {
				margin: 0;
				font-family: 'Outfit', Arial, sans-serif;
				font-size: 26px;
				font-weight: 900;
				text-transform: uppercase;
				letter-spacing: -1px;
				color: #FFFFFF;
				text-shadow: 2px 2px 0px #000000;
			}
			.content {
				padding: 30px 20px;
				text-align: left;
			}
			.greeting {
				font-size: 16px;
				font-weight: 800;
				margin-bottom: 15px;
			}
			.info-box {
				background-color: #FFA04D; /* Neo Orange */
				border: 2px solid #000000;
				box-shadow: 4px 4px 0px 0px #000000;
				border-radius: 12px;
				padding: 20px;
				margin: 25px 0;
			}
			.info-title {
				font-size: 18px;
				font-weight: 900;
				margin: 0 0 8px 0;
			}
			.info-meta {
				font-size: 13px;
				font-weight: 700;
				font-family: monospace;
				background-color: #FFFFFF;
				border: 1px solid #000000;
				display: inline-block;
				padding: 4px 10px;
				border-radius: 6px;
			}
			.footer {
				background-color: #FAF9F5;
				border-top: 2px solid #000000;
				padding: 20px;
				text-align: center;
				font-size: 11px;
				font-weight: 700;
				color: #555555;
			}
			.btn-cta {
				display: inline-block;
				background-color: #FF90E8; /* Neo Pink */
				color: #000000;
				text-decoration: none;
				font-weight: 900;
				font-size: 14px;
				padding: 12px 24px;
				border: 2px solid #000000;
				box-shadow: 3px 3px 0px 0px #000000;
				border-radius: 8px;
				margin-top: 15px;
				text-align: center;
			}
		</style>
	</head>
	<body>
		<div class="email-container">
			<div class="header">
				<h1>WELEARN DEADLINE</h1>
			</div>
			<div class="content">
				<div class="greeting">Halo, %s! 👋</div>
				<p style="font-weight: 600; line-height: 1.6;">
					Kami mendeteksi tugas WeLearn Anda yang belum selesai akan segera jatuh tempo dalam waktu kurang dari 24 jam. Jangan sampai terlewat!
				</p>
				
				<div class="info-box">
					<h3 class="info-title">%s</h3>
					<span class="info-meta">📅 %s pukul %s WIB</span>
				</div>
				
				<p style="font-weight: 600; line-height: 1.6; margin-bottom: 25px;">
					Segera buka dashboard Motion Anda untuk menandai progres tugas ini atau menyelesaikannya secara instan.
				</p>
				
				<div style="text-align: center;">
					<a href="http://localhost:3000/dashboard" class="btn-cta">Buka Dasbor Motion</a>
				</div>
			</div>
			<div class="footer">
				&copy; %d Motion AI. Dibuat dengan presisi untuk produktivitas Anda.
			</div>
		</div>
	</body>
	</html>
	`, userName, taskTitle, tanggalIndo, waktuIndo, time.Now().Year())

	msg := []byte(subject + mime + body)

	var auth smtp.Auth
	if config.AppConfig.SMTPUser != "" {
		auth = smtp.PlainAuth("", config.AppConfig.SMTPUser, config.AppConfig.SMTPPassword, smtpHost)
	}

	err := smtp.SendMail(smtpHost+":"+smtpPort, auth, "reminder@motion.ai", []string{toEmail}, msg)
	if err != nil {
		return err
	}

	log.Printf("[welearn-notifier] Sukses mengirim email pengingat deadline '%s' ke %s", taskTitle, toEmail)
	return nil
}
