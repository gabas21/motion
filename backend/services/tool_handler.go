package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/motion/backend/pkg/logger"


	"github.com/google/uuid"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"gorm.io/gorm"
)

// ToolCallResult adalah hasil dari eksekusi tool calling oleh Asep AI
type ToolCallResult struct {
	Success bool
	Message string // Pesan balikan untuk diteruskan ke LLM setelah eksekusi
}

// ExecuteAsepTool menangani eksekusi tool/function yang diminta oleh LLM.
// Fungsi ini dipanggil di dalam dispatch loop di ai_service.go ketika model
// mengembalikan FunctionCall (bukan teks biasa).
func ExecuteAsepTool(userID string, toolName string, args map[string]interface{}) ToolCallResult {
	logger.Info("Executing Asep tool", "tool", toolName, "user_id", userID, "args", args)

	switch toolName {
	case "CreateUserTask":
		return createUserTask(userID, args)
	case "TriggerAutoSchedule":
		return triggerAutoSchedule(userID)
	case "GetWeLearnAssignments":
		return getWeLearnAssignments(userID, args)
	case "GetWeLearnCourses":
		return getWeLearnCourses(userID)
	case "GenerateWeLearnDocx":
		return generateWeLearnDocx(userID, args)
	default:
		logger.Warn("Asep tool not recognized", "tool", toolName)
		return ToolCallResult{
			Success: false,
			Message: fmt.Sprintf("Tool '%s' tidak dikenal oleh sistem.", toolName),
		}
	}
}

// createUserTask membuat tugas baru di database atas nama Asep AI.
func createUserTask(userID string, args map[string]interface{}) ToolCallResult {
	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		return ToolCallResult{Success: false, Message: "ID pengguna tidak valid."}
	}

	// Ekstrak argumen dengan validasi
	title, _ := args["title"].(string)
	if title == "" {
		return ToolCallResult{Success: false, Message: "Judul tugas tidak boleh kosong."}
	}

	category, _ := args["category"].(string)
	if category == "" {
		category = "general"
	}

	// JSON number di-decode sebagai float64 oleh Go
	estimate := 30
	if v, ok := args["estimate"].(float64); ok && v > 0 {
		estimate = int(v)
	}

	priority := 3
	if v, ok := args["priority"].(float64); ok && v >= 1 && v <= 5 {
		priority = int(v)
	}

	description, _ := args["description"].(string)

	// Parsing due_date jika disertakan (format RFC3339 atau tanggal sederhana)
	var dueDate *time.Time
	if dueDateStr, ok := args["due_date"].(string); ok && dueDateStr != "" {
		// Coba parse berbagai format tanggal
		formats := []string{
			time.RFC3339,
			"2006-01-02",
			"02-01-2006",
			"02/01/2006",
		}
		for _, format := range formats {
			if parsed, err := time.Parse(format, dueDateStr); err == nil {
				dueDate = &parsed
				break
			}
		}
	}

	task := models.Task{
		UserID:              parsedUserID,
		Title:               title,
		Description:         description,
		TimeEstimateMinutes: estimate,
		Priority:            priority,
		Category:            category,
		DueDate:             dueDate,
		Status:              "pending",
	}

	if err := config.DB.Create(&task).Error; err != nil {
		logger.Error("Failed to create task via Asep tool", err)
		return ToolCallResult{
			Success: false,
			Message: fmt.Sprintf("Gagal menyimpan tugas '%s' ke database: %v", title, err),
		}
	}

	// Picu auto-schedule untuk tugas yang baru dibuat
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := InstanceSchedulingEngine.ScheduleTask(ctx, &task); err != nil {
		logger.Warn("Auto-scheduling failed for new task", "task_id", task.ID, "error", err)
	}

	// Broadcast WebSocket agar UI memperbarui daftar tugas secara real-time
	WSHub.Broadcast(userID, []byte(`{"type":"TASK_UPDATED"}`))

	dueInfo := "tanpa tenggat waktu"
	if dueDate != nil {
		dueInfo = fmt.Sprintf("dengan tenggat %s", dueDate.Format("02 January 2006"))
	}

	return ToolCallResult{
		Success: true,
		Message: fmt.Sprintf(
			"Berhasil! Tugas **'%s'** (Prioritas: %d, Estimasi: %d menit, Kategori: %s, %s) telah ditambahkan ke daftar tugasmu dan sudah dijadwalkan oleh AI. Cek papan tugasmu ya!",
			title, priority, estimate, category, dueInfo,
		),
	}
}

// triggerAutoSchedule memicu ulang mesin penjadwalan AI untuk semua tugas pengguna.
func triggerAutoSchedule(userID string) ToolCallResult {
	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		return ToolCallResult{Success: false, Message: "ID pengguna tidak valid."}
	}

	// Ambil semua tugas pending milik user
	var tasks []models.Task
	if err := config.DB.Where("user_id = ? AND status = 'pending'", parsedUserID).Find(&tasks).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			return ToolCallResult{
				Success: false,
				Message: "Gagal mengambil daftar tugas dari database.",
			}
		}
	}

	if len(tasks) == 0 {
		return ToolCallResult{
			Success: true,
			Message: "Kamu tidak punya tugas pending saat ini, jadi tidak ada yang perlu dijadwalkan ulang.",
		}
	}

	// Picu ulang scheduler untuk setiap tugas
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	successCount := 0
	for i := range tasks {
		if err := InstanceSchedulingEngine.ScheduleTask(ctx, &tasks[i]); err != nil {
			logger.Warn("Failed to reschedule task during auto-schedule", "task_id", tasks[i].ID, "error", err)
		} else {
			successCount++
		}
	}

	// Broadcast WebSocket
	WSHub.Broadcast(userID, []byte(`{"type":"TASK_UPDATED"}`))

	return ToolCallResult{
		Success: true,
		Message: fmt.Sprintf(
			"AI Auto-Schedule selesai! Berhasil menjadwalkan ulang **%d dari %d** tugas pendingmu secara optimal. Cek tampilan kalender untuk melihat jadwal barumu!",
			successCount, len(tasks),
		),
	}
}

// getWeLearnAssignments mengambil daftar tugas WeLearn dari database
func getWeLearnAssignments(userID string, args map[string]interface{}) ToolCallResult {
	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		return ToolCallResult{Success: false, Message: "ID pengguna tidak valid."}
	}

	statusFilter, _ := args["status_filter"].(string)
	if statusFilter == "" {
		statusFilter = "all"
	}

	var assignments []models.MoodleAssignment
	query := config.DB.Where("user_id = ?", parsedUserID)

	// Filter semester aktif jika dikonfigurasi
	if config.AppConfig.AcademicYearPrefix != "" {
		query = query.Where("course_name LIKE ?", "%"+config.AppConfig.AcademicYearPrefix+"%")
	}

	if statusFilter != "all" {
		query = query.Where("submission_status = ?", statusFilter)
	}

	if err := query.Order("due_date ASC").Find(&assignments).Error; err != nil {
		return ToolCallResult{
			Success: false,
			Message: "Gagal mengambil tugas WeLearn dari database: " + err.Error(),
		}
	}

	if len(assignments) == 0 {
		return ToolCallResult{
			Success: true,
			Message: "Tidak ditemukan tugas WeLearn yang sesuai dengan kriteria Anda.",
		}
	}

	var sb strings.Builder
	sb.WriteString("Berikut daftar tugas akademik WeLearn yang ditemukan:\n\n")
	for i, a := range assignments {
		statusStr := "❌ BELUM DIKUMPULKAN"
		if a.SubmissionStatus == "submitted" {
			statusStr = "✅ SUDAH TERKUMPUL"
		} else if a.SubmissionStatus == "draft" {
			statusStr = "📝 DRAF"
		}

		dueInfo := "tanpa tenggat"
		if a.DueDate != nil {
			dueInfo = a.DueDate.Local().Format("02 Jan 2006 15:04 WIB")
		}

		sb.WriteString(fmt.Sprintf("%d. **[%s] %s**\n", i+1, cleanCourseName(a.CourseName), a.Name))
		sb.WriteString(fmt.Sprintf("   - Status: %s\n", statusStr))
		sb.WriteString(fmt.Sprintf("   - Pertemuan: %s\n", a.SectionName))
		sb.WriteString(fmt.Sprintf("   - Tenggat: %s\n", dueInfo))
		if a.URL != "" {
			sb.WriteString(fmt.Sprintf("   - Link LMS: %s\n", a.URL))
		}
		sb.WriteString("\n")
	}

	return ToolCallResult{
		Success: true,
		Message: sb.String(),
	}
}

// getWeLearnCourses mengambil daftar mata kuliah WeLearn dari database
func getWeLearnCourses(userID string) ToolCallResult {
	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		return ToolCallResult{Success: false, Message: "ID pengguna tidak valid."}
	}

	var courses []models.MoodleCourse
	query := config.DB.Where("user_id = ?", parsedUserID)
	if config.AppConfig.AcademicYearPrefix != "" {
		query = query.Where("name LIKE ?", "%"+config.AppConfig.AcademicYearPrefix+"%")
	}

	if err := query.Order("name ASC").Find(&courses).Error; err != nil {
		return ToolCallResult{
			Success: false,
			Message: "Gagal mengambil daftar mata kuliah dari database: " + err.Error(),
		}
	}

	if len(courses) == 0 {
		return ToolCallResult{
			Success: true,
			Message: "Anda belum menyinkronkan mata kuliah dari WeLearn.",
		}
	}

	var sb strings.Builder
	sb.WriteString("Daftar mata kuliah aktif Anda yang disinkronkan dari WeLearn:\n\n")
	for i, c := range courses {
		// Hitung jumlah tugas per matkul
		var total, pending int64
		config.DB.Model(&models.MoodleAssignment{}).Where("user_id = ? AND course_id = ?", parsedUserID, c.MoodleCourseID).Count(&total)
		config.DB.Model(&models.MoodleAssignment{}).Where("user_id = ? AND course_id = ? AND submission_status != 'submitted'", parsedUserID, c.MoodleCourseID).Count(&pending)

		sb.WriteString(fmt.Sprintf("%d. **%s**\n", i+1, cleanCourseName(c.Name)))
		sb.WriteString(fmt.Sprintf("   - Kode Moodle ID: %s\n", c.MoodleCourseID))
		sb.WriteString(fmt.Sprintf("   - Jumlah Tugas: %d (%d belum selesai)\n\n", total, pending))
	}

	return ToolCallResult{
		Success: true,
		Message: sb.String(),
	}
}

// generateWeLearnDocx memanggil Python ML service untuk membuat dokumen Word dan menyimpannya di folder publik downloads
func generateWeLearnDocx(userID string, args map[string]interface{}) ToolCallResult {
	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		return ToolCallResult{Success: false, Message: "ID pengguna tidak valid."}
	}

	title, _ := args["title"].(string)
	content, _ := args["content"].(string)

	if title == "" || content == "" {
		return ToolCallResult{Success: false, Message: "Judul dan konten dokumen tidak boleh kosong."}
	}

	// Bersihkan konten dokumen agar hanya berisi materi akademik yang bersih tanpa emoji/chit-chat/greetings/outro!
	content = cleanDocxContent(content)

	// 1. Siapkan payload JSON untuk dikirim ke Python ML Service
	payloadBytes, err := json.Marshal(map[string]string{
		"title":   title,
		"content": content,
	})
	if err != nil {
		return ToolCallResult{Success: false, Message: "Gagal merakit data dokumen."}
	}

	// 2. Hubungi Python ML Service (FastAPI) untuk memproses dokumen
	client := &http.Client{Timeout: 20 * time.Second}
	targetURL := fmt.Sprintf("%s/documents/generate-docx", config.AppConfig.MLServiceURL)
	resp, err := client.Post(targetURL, "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil {
		logger.Error("Python docx generator is offline or returned an error", err)
		return ToolCallResult{
			Success: false,
			Message: "Gagal membuat dokumen Word: Python ML/RAG Service offline. Pastikan FastAPI menyala.",
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		logger.Error("Python docx generator API returned non-OK status", fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBytes)))
		return ToolCallResult{
			Success: false,
			Message: "Modul pembangun dokumen Python mengembalikan pesan error: " + string(respBytes),
		}
	}

	// 3. Buat nama berkas acak yang aman berbasis timestamp
	safeTitle := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			return r
		}
		if r == ' ' || r == '-' || r == '_' {
			return '_'
		}
		return -1
	}, title)
	
	if len(safeTitle) > 50 {
		safeTitle = safeTitle[:50]
	}

	filename := fmt.Sprintf("Jawaban_%s_%d.docx", safeTitle, time.Now().Unix())
	filepath := fmt.Sprintf("public/downloads/%s", filename)

	// Pastikan folder exist
	os.MkdirAll("public/downloads", 0755)

	out, err := os.Create(filepath)
	if err != nil {
		logger.Error("Failed to create physical docx file on server", err)
		return ToolCallResult{Success: false, Message: "Gagal menulis berkas Word ke harddisk server."}
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	if err != nil {
		logger.Error("Failed to copy bytes to docx file", err)
		return ToolCallResult{Success: false, Message: "Gagal menyalin byte berkas jawaban."}
	}

	downloadURL := fmt.Sprintf("/downloads/%s", filename)
	logger.Info("Successfully generated docx file for user", "filename", filename, "user_id", parsedUserID)

	return ToolCallResult{
		Success: true,
		Message: fmt.Sprintf(
			"🚀 **BERKAS JAWABAN Word (.docx) BERHASIL DICIPTAKAN!**\n\n"+
				"Saya telah menyusun jawaban lengkap, memformat tabel, list, dan tata letak dokumen secara otomatis ke dalam format Word berstandar akademik.\n\n"+
				"Silakan unduh di sini:\n"+
				"👉 **[Unduh %s](%s)**\n\n"+
				"Berkas ini sudah siap Anda kumpulkan langsung ke portal WeLearn WICIDA. Selamat belajar! 🚀",
			title+".docx", downloadURL,
		),
	}
}

// cleanDocxContent memotong bagian intro, outro, emoji, dan link download agar dokumen Word bersih dan siap dikumpulkan.
func cleanDocxContent(content string) string {
	lines := strings.Split(content, "\n")
	startIndex := -1
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		// Cari baris pertama yang merupakan judul utama materi kuliah akademik
		if strings.HasPrefix(trimmed, "#") || 
		   strings.Contains(strings.ToUpper(trimmed), "JAWABAN LENGKAP:") ||
		   strings.Contains(strings.ToUpper(trimmed), "TUGAS 1") ||
		   strings.HasPrefix(trimmed, "1. ") ||
		   strings.HasPrefix(trimmed, "**1. ") {
			startIndex = i
			break
		}
	}

	var cleanLines []string
	if startIndex != -1 {
		cleanLines = lines[startIndex:]
	} else {
		cleanLines = lines
	}

	var finalLines []string
	for _, line := range cleanLines {
		trimmed := strings.TrimSpace(line)

		// Hapus baris pemicu tool, JSON block, link unduh, atau pesan outro ramah dari bot
		if strings.Contains(line, "GenerateWeLearnDocx") || 
		   strings.Contains(line, "MEMANGGIL TOOL") || 
		   strings.Contains(trimmed, "```json") || 
		   strings.Contains(trimmed, "```") || 
		   strings.Contains(line, "\"action\":") || 
		   strings.Contains(line, "\"filename\":") || 
		   strings.Contains(line, "\"content\":") ||
		   strings.Contains(line, "/downloads/") ||
		   strings.Contains(line, "UNDUH TUGAS") ||
		   strings.Contains(line, "BERKAS JAWABAN") ||
		   strings.Contains(line, "Selesai! Jawaban Anda telah disusun") ||
		   strings.Contains(line, "Berkas ini sudah siap Anda kumpulkan") ||
		   strings.Contains(line, "TERMAUL") ||
		   strings.Contains(line, "TERMUSTAMAL") ||
		   trimmed == "---" {
			continue
		}

		// Bersihkan emoji dari baris teks
		cleanedLine := removeEmojis(line)
		finalLines = append(finalLines, cleanedLine)
	}

	return strings.TrimSpace(strings.Join(finalLines, "\n"))
}

// removeEmojis membuang karakter emoji dari dokumen Word agar format Word rapi dan formal.
func removeEmojis(s string) string {
	var sb strings.Builder
	for _, r := range s {
		// Filter out standard emoji rune ranges:
		if (r >= 0x1F300 && r <= 0x1F9FF) || 
		   (r >= 0x1FA70 && r <= 0x1FAFF) || 
		   (r >= 0x2600 && r <= 0x27BF) {
			continue
		}
		sb.WriteRune(r)
	}
	return sb.String()
}

