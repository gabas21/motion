package services

import (
	"fmt"
	"log"
	"net/smtp"
	"time"

	"github.com/motion/backend/config"
)

// SendVerificationEmail sends email with verification link
func SendVerificationEmail(toEmail, username, verifyToken string) error {
	verifyLink := fmt.Sprintf("%s/auth/verify-email?token=%s", config.AppConfig.FrontendURL, verifyToken)
	
	subject := "Verifikasi Email Akun Motion"
	
	body := fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<head>
		<meta charset="UTF-8">
		<title>Verifikasi Email Motion Account</title>
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
				background-color: #38BDF8; /* Neo Mint/Sky Blue */
				padding: 30px 20px;
				text-align: center;
				border-bottom: 3px solid #000000;
			}
			.header h1 {
				margin: 0;
				font-family: 'Outfit', Arial, sans-serif;
				font-size: 24px;
				font-weight: 900;
				text-transform: uppercase;
				letter-spacing: -1px;
				color: #000000;
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
			.description {
				font-size: 14px;
				line-height: 1.6;
				color: #333333;
				margin-bottom: 25px;
			}
			.btn-container {
				text-align: center;
				margin: 30px 0;
			}
			.btn-cta {
				display: inline-block;
				background-color: #FBBF24; /* Neo Yellow */
				color: #000000 !important;
				text-decoration: none !important;
				font-weight: 900;
				font-size: 14px;
				padding: 12px 30px;
				border: 2px solid #000000;
				box-shadow: 3px 3px 0px 0px #000000;
				border-radius: 10px;
				transition: all 0.15s ease;
			}
			.footer {
				background-color: #FAF9F5;
				border-top: 2px solid #000000;
				padding: 20px;
				text-align: center;
				font-size: 11px;
				font-weight: 700;
				color: #666666;
			}
		</style>
	</head>
	<body>
		<div class="email-container">
			<div class="header">
				<h1>MOTION AI</h1>
			</div>
			<div class="content">
				<div class="greeting">Halo %s! 👋</div>
				<div class="description">
					Terima kasih telah mendaftar di Motion. Silakan klik tombol di bawah ini untuk memverifikasi alamat email kamu dan mengaktifkan akunmu secara instan.
				</div>
				<div class="btn-container">
					<a href="%s" class="btn-cta">VERIFIKASI EMAIL KAMU</a>
				</div>
				<div class="description" style="font-size: 12px; color: #666666;">
					Link ini berlaku selama 24 jam. Jika kamu tidak merasa mendaftar di Motion, abaikan email ini dengan aman.
				</div>
			</div>
			<div class="footer">
				&copy; %d Motion AI. Dibuat dengan presisi untuk produktivitas Anda.
			</div>
		</div>
	</body>
	</html>
	`, username, verifyLink, time.Now().Year())

	return sendEmail(toEmail, subject, body)
}

// SendPasswordResetEmail sends password reset link
func SendPasswordResetEmail(toEmail, username, resetToken string) error {
	resetLink := fmt.Sprintf("%s/auth/reset-password?token=%s", config.AppConfig.FrontendURL, resetToken)
	
	subject := "Reset Password Akun Motion"
	
	body := fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<head>
		<meta charset="UTF-8">
		<title>Reset Password Motion Account</title>
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
				background-color: #FF7A00; /* Neo Orange */
				padding: 30px 20px;
				text-align: center;
				border-bottom: 3px solid #000000;
			}
			.header h1 {
				margin: 0;
				font-family: 'Outfit', Arial, sans-serif;
				font-size: 24px;
				font-weight: 900;
				text-transform: uppercase;
				letter-spacing: -1px;
				color: #000000;
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
			.description {
				font-size: 14px;
				line-height: 1.6;
				color: #333333;
				margin-bottom: 25px;
			}
			.btn-container {
				text-align: center;
				margin: 30px 0;
			}
			.btn-cta {
				display: inline-block;
				background-color: #8B5CF6; /* Neo Violet */
				color: #FFFFFF !important;
				text-decoration: none !important;
				font-weight: 900;
				font-size: 14px;
				padding: 12px 30px;
				border: 2px solid #000000;
				box-shadow: 3px 3px 0px 0px #000000;
				border-radius: 10px;
				transition: all 0.15s ease;
			}
			.footer {
				background-color: #FAF9F5;
				border-top: 2px solid #000000;
				padding: 20px;
				text-align: center;
				font-size: 11px;
				font-weight: 700;
				color: #666666;
			}
		</style>
	</head>
	<body>
		<div class="email-container">
			<div class="header">
				<h1>RESET PASSWORD</h1>
			</div>
			<div class="content">
				<div class="greeting">Halo %s! 👋</div>
				<div class="description">
					Kamu menerima email ini karena ada permintaan untuk mengatur ulang password akun Motion milikmu. Silakan klik tombol di bawah ini untuk memproses pengaturan ulang password.
				</div>
				<div class="btn-container">
					<a href="%s" class="btn-cta">RESET PASSWORD KAMU</a>
				</div>
				<div class="description" style="font-size: 12px; color: #666666;">
					Link ini berlaku selama 1 jam. Jika kamu tidak meminta reset password, silakan abaikan email ini dengan aman.
				</div>
			</div>
			<div class="footer">
				&copy; %d Motion AI. Dibuat dengan presisi untuk produktivitas Anda.
			</div>
		</div>
	</body>
	</html>
	`, username, resetLink, time.Now().Year())

	return sendEmail(toEmail, subject, body)
}

func sendEmail(to, subject, body string) error {
	smtpHost := config.AppConfig.SMTPHost
	smtpPort := config.AppConfig.SMTPPort
	from := "noreply@motion.ai"

	subjectHeader := fmt.Sprintf("Subject: %s\n", subject)
	mimeHeader := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"

	msg := []byte(subjectHeader + mimeHeader + body)

	var auth smtp.Auth
	if config.AppConfig.SMTPUser != "" {
		auth = smtp.PlainAuth("", config.AppConfig.SMTPUser, config.AppConfig.SMTPPassword, smtpHost)
	}

	err := smtp.SendMail(smtpHost+":"+smtpPort, auth, from, []string{to}, msg)
	if err != nil {
		log.Printf("SMTP Auth Service: Gagal mengirim email ke %s: %v", to, err)
		return err
	}

	log.Printf("SMTP Auth Service: Sukses mengirim email ke %s dengan subjek '%s'", to, subject)
	return nil
}
