package services

import (
	"fmt"
	"strings"
	"time"

	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
)

// GenerateSystemPrompt merakit instruksi sistem Asep AI secara dinamis.
// Target: di bawah 800 token untuk menjaga kualitas model gratis.
func GenerateSystemPrompt(personality string, userID string) string {
	timeNow := time.Now().Format("Monday, 02 January 2006 — 15:04 WIB")
	userContext := getUserContext(userID)

	// ─── Blok 1: Identitas (ringkas) ───────────────────────────────────────────
	base := "Kamu adalah **Asep**, asisten AI pribadi di **Motion** (aplikasi manajemen waktu & jadwal kuliah berbasis AI). Karaktermu adalah seorang kakak tingkat (kating) kuliahan di Indonesia yang santai, bersahabat, sangat cerdas, dan paham betul dinamika dunia kampus (seperti tugas numpuk, revisi dosen, praktikum, dll).\n" +
		"Waktu sekarang: " + timeNow + "\n\n"

	// ─── Blok 2: Persona (singkat, berbasis pilihan) ────────────────────────────
	var tone string
	switch strings.ToLower(personality) {
	case "bestie", "curhat":
		tone = "**MODE: Bestie 🧸** — Bicara santai layaknya kating yang akrab. Gunakan sapaan santai seperti 'lo/gue' atau sapaan khas mahasiswa. " +
			"Tunjukkan empati tinggi, dengerin curhat tugas/kuliah mereka dengan gaya santai tapi tetap solutif dan cerdas.\n\n"
	case "academic", "akademik", "tutor":
		tone = "**MODE: Academic 📚** — Kating asisten dosen/laboratorium yang super cerdas tapi ramah. Bantu jelaskan konsep materi kuliah Indonesia secara metodologis menggunakan metode Sokratik (pandu pelan-pelan, jangan langsung beri jawaban mentah). " +
			"Tulis rumus dalam LaTeX ($...$) dan gunakan heading Markdown (## ###) agar rapi.\n\n"
	default: // productive
		tone = "**MODE: Productive ⚡** — Kating ambis yang suportif. Berikan jawaban yang padat, direct, dan actionable. " +
			"Ingatkan tenggat tugas terdekat, bantu menyusun prioritas, dan semangati mereka biar ga overthinking/prokrastinasi.\n\n"
	}

	// ─── Blok 3: Kapabilitas & Tool (daftar singkat, TANPA format JSON manual) ─
	// PENTING: Jangan pernah menulis format tool call secara manual di teks jawaban.
	// SDK Gemini dan OpenRouter sudah menangani function calling secara otomatis.
	capabilities := "**TOOL YANG TERSEDIA (gunakan langsung, jangan tulis format JSON manual):**\n" +
		"- `CreateUserTask` — Buat tugas baru ke daftar Motion.\n" +
		"- `TriggerAutoSchedule` — Jadwalkan ulang semua tugas pending secara AI-optimal.\n" +
		"- `GetWeLearnAssignments` — Ambil daftar tugas akademik WeLearn.\n" +
		"- `GetWeLearnCourses` — Ambil daftar mata kuliah aktif.\n" +
		"- `GenerateWeLearnDocx` — Buat file Word (.docx) dari jawaban akademik.\n\n" +
		"**ATURAN KRITIS UNTUK GenerateWeLearnDocx:**\n" +
		"- WAJIB: Tulis SELURUH jawaban akademik secara lengkap dan terstruktur di field `content` tool ini.\n" +
		"- JANGAN hanya mengirim draf singkat, outline, atau ringkasan ke field `content`.\n" +
		"- Isi `content` harus SAMA PERSIS dengan jawaban panjang yang kamu tampilkan di chat.\n" +
		"- Gunakan heading (#, ##, ###), bullet points (-), tabel (|) sesuai standar akademik.\n" +
		"- Panggil tool ini SETELAH selesai menulis jawaban, bukan sebelum.\n\n" +
		"**ATURAN UMUM:**\n" +
		"- Format jawaban dengan Markdown (bold, list, heading, kode) agar mudah dibaca.\n" +
		"- Gunakan data konteks tugas di bawah ini secara langsung. Jangan buat data fiktif.\n" +
		"- Untuk soal akademik: rekonstruksi pertanyaan → jawab mendalam → sertakan tabel/rumus jika perlu.\n\n"

	// ─── Blok 4: Konteks data real-time pengguna ───────────────────────────────
	contextSection := "**DATA TUGAS AKTIF PENGGUNA:**\n" + userContext

	return base + tone + capabilities + contextSection
}

// getUserContext mengembalikan ringkasan tugas & moodle aktif pengguna sebagai konteks AI.
func getUserContext(userID string) string {
	var sb strings.Builder

	// 1. Ambil Tugas Aktif dari database (limit 15 untuk efisiensi token, kecualikan pengingat)
	var tasks []models.Task
	if config.DB != nil {
		if err := config.DB.Where("user_id = ? AND status != 'completed' AND category != 'education_reminder'", userID).
			Order("priority desc, due_date asc").Limit(15).Find(&tasks).Error; err == nil {
			if len(tasks) > 0 {
				sb.WriteString("Tugas Aktif Motion:\n")
				for i, t := range tasks {
					dueStr := "Tanpa Tenggat"
					if t.DueDate != nil {
						dueStr = t.DueDate.Format("02 Jan 2006 15:04")
					}
					scheduledStr := ""
					if t.ScheduledStart != nil {
						scheduledStr = fmt.Sprintf(" | Slot AI: %s", t.ScheduledStart.Format("02 Jan 15:04"))
					}
					sb.WriteString(fmt.Sprintf("%d. [%s] %s (P%d, Tenggat: %s, Kat: %s%s)\n",
						i+1, t.Status, t.Title, t.Priority, dueStr, t.Category, scheduledStr))
				}
				sb.WriteString("\n")
			}
		}
	}

	// 2. Ambil Tugas WeLearn (Moodle) yang belum dikumpulkan (limit 15)
	var moodleAssignments []models.MoodleAssignment
	if config.DB != nil {
		moodleQuery := config.DB.Where("user_id = ? AND submission_status != 'submitted'", userID)
		if config.AppConfig.AcademicYearPrefix != "" {
			moodleQuery = moodleQuery.Where("course_name LIKE ?", "%"+config.AppConfig.AcademicYearPrefix+"%")
		}
		if err := moodleQuery.Order("due_date asc").Limit(15).Find(&moodleAssignments).Error; err == nil {
			if len(moodleAssignments) > 0 {
				sb.WriteString("Tugas WeLearn Belum Dikumpulkan:\n")
				for i, ma := range moodleAssignments {
					dueStr := "Tanpa Tenggat"
					if ma.DueDate != nil {
						dueStr = ma.DueDate.Format("02 Jan 2006 15:04")
					}
					sb.WriteString(fmt.Sprintf("%d. %s — %s (Section: %s, Tenggat: %s, Status: %s)\n",
						i+1, ma.Name, ma.CourseName, ma.SectionName, dueStr, ma.SubmissionStatus))
				}
				sb.WriteString("\n")
			}
		}
	}

	if sb.Len() == 0 {
		return "Tidak ada tugas aktif saat ini.\n"
	}

	return sb.String()
}

