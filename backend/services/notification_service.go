package services

import (
	"fmt"
	"log"
	"net/smtp"
	"time"

	"github.com/motion/backend/config"
)

// SendEmailTaskReminder mengirim notifikasi email bermotif Neobrutalisme ke Mailpit Laragon
func SendEmailTaskReminder(toEmail string, userName string, taskTitle string, scheduledTime time.Time) error {
	smtpHost := config.AppConfig.SMTPHost
	smtpPort := config.AppConfig.SMTPPort

	// Susun format waktu ke Bahasa Indonesia yang cantik
	loc, _ := time.LoadLocation("Asia/Jakarta")
	waktuLokal := scheduledTime.In(loc)
	waktuIndo := waktuLokal.Format("15:04")

	subject := fmt.Sprintf("Subject: ⏰ Pengingat Tugas AI: %s akan segera dimulai!\n", taskTitle)
	mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"

	// Template HTML bergaya Neobrutalisme premium
	body := fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<head>
		<meta charset="UTF-8">
		<title>Pengingat Tugas Motion AI</title>
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
				background-color: #FFDE4D; /* Neo Yellow */
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
				background-color: #C084FC; /* Neo Violet */
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
				<h1>Motion AI</h1>
			</div>
			<div class="content">
				<div class="greeting">Halo, %s! 👋</div>
				<p style="font-weight: 600; line-height: 1.6;">
					Mesin AI kami mendeteksi bahwa salah satu agenda tugas terjadwal Anda akan segera dimulai. Silakan bersiap-siap untuk fokus!
				</p>
				
				<div class="info-box">
					<h3 class="info-title">%s</h3>
					<span class="info-meta">⏰ Pukul %s WIB</span>
				</div>
				
				<p style="font-weight: 600; line-height: 1.6; margin-bottom: 25px;">
					Lindungi fokus Anda, hindari interupsi rapat eksternal, dan selesaikan hari produktif ini bersama AI Calendar Motion!
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
	`, userName, taskTitle, waktuIndo, time.Now().Year())

	msg := []byte(subject + mime + body)

	var auth smtp.Auth
	if config.AppConfig.SMTPUser != "" {
		auth = smtp.PlainAuth("", config.AppConfig.SMTPUser, config.AppConfig.SMTPPassword, smtpHost)
	}

	// Kirim email asinkron ke server SMTP (Mailpit atau SMTP eksternal)
	err := smtp.SendMail(smtpHost+":"+smtpPort, auth, "reminder@motion.ai", []string{toEmail}, msg)
	if err != nil {
		log.Printf("SMTP Notifikasi: Gagal mengirim email ke %s: %v", toEmail, err)
		return err
	}

	log.Printf("SMTP Notifikasi: Sukses mengirim email pengingat tugas '%s' ke %s", taskTitle, toEmail)
	return nil
}
