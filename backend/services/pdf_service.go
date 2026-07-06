package services

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
	"github.com/motion/backend/models"
)

// GenerateExcuseLetterPDF menghasilkan berkas PDF surat izin resmi dan menyimpannya di folder public/downloads.
// Fungsi ini mengembalikan relative URL path berkas PDF yang dihasilkan (e.g. "/downloads/excuse_letters/excuse_letter_ID.pdf")
func GenerateExcuseLetterPDF(excuse *models.MoodleExcuseLetter) (string, error) {
	// 1. Setup direktori penyimpanan berkas PDF
	relativeDir := filepath.Join("public", "downloads", "excuse_letters")
	err := os.MkdirAll(relativeDir, 0755)
	if err != nil {
		return "", fmt.Errorf("gagal membuat direktori download PDF: %v", err)
	}

	pdfFilename := fmt.Sprintf("excuse_letter_%s.pdf", excuse.ID.String())
	pdfPath := filepath.Join(relativeDir, pdfFilename)

	// 2. Inisialisasi gofpdf (Portrait, unit milimeter, format A4)
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(30, 30, 30) // Margin: Kiri=30mm, Atas=30mm, Kanan=30mm
	pdf.AddPage()

	// 3. Header Surat (Tebal, Bergaris Bawah, Tengah)
	pdf.SetFont("Times", "BU", 14)
	pdf.CellFormat(0, 10, "SURAT IZIN TIDAK MENGIKUTI PRAKTIKUM", "", 1, "C", false, 0, "")
	pdf.Ln(8)

	// 4. Perihal Surat
	pdf.SetFont("Times", "", 12)
	pdf.CellFormat(20, 6, "Perihal", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.SetFont("Times", "B", 12)
	pdf.CellFormat(0, 6, "Permohonan Izin Tidak Mengikuti Praktikum", "", 1, "", false, 0, "")
	pdf.Ln(6)

	// 5. Penerima Surat
	pdf.SetFont("Times", "", 12)
	pdf.CellFormat(0, 6, "Yth. Asisten Praktikum", "", 1, "", false, 0, "")
	pdf.CellFormat(0, 6, "Laboratorium Komputer STMIK WICIDA", "", 1, "", false, 0, "")
	pdf.CellFormat(0, 6, "STMIK Widya Cipta Dharma", "", 1, "", false, 0, "")
	pdf.CellFormat(0, 6, "di -", "", 1, "", false, 0, "")
	pdf.CellFormat(10, 6, "", "", 0, "", false, 0, "") // Indent
	pdf.CellFormat(0, 6, "Tempat", "", 1, "", false, 0, "")
	pdf.Ln(8)

	// 6. Pembuka
	pdf.CellFormat(0, 6, "Bersama ini saya sampaikan bahwa :", "", 1, "", false, 0, "")
	pdf.Ln(2)

	// 7. Blok Data Diri (Colons aligned perfectly)
	dataDiri := []struct {
		Label string
		Val   string
	}{
		{"Nama", excuse.Nama},
		{"NIM", excuse.NIM},
		{"Program Studi", excuse.Prodi},
		{"Kelompok", excuse.Kelompok},
		{"Mata Kuliah", excuse.CourseName},
	}

	for _, item := range dataDiri {
		pdf.CellFormat(10, 6, "", "", 0, "", false, 0, "") // Indent block
		pdf.CellFormat(35, 6, item.Label, "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		pdf.CellFormat(0, 6, item.Val, "", 1, "", false, 0, "")
	}
	pdf.Ln(6)

	// 8. Pernyataan Izin
	pdf.CellFormat(0, 6, "Saya memohon izin untuk tidak mengikuti kegiatan praktikum pada :", "", 1, "", false, 0, "")
	pdf.Ln(2)

	// 9. Blok Informasi Izin
	infoIzin := []struct {
		Label string
		Val   string
	}{
		{"Hari/Tanggal", excuse.HariTanggal},
		{"Alasan", excuse.Alasan},
	}

	for _, item := range infoIzin {
		pdf.CellFormat(10, 6, "", "", 0, "", false, 0, "") // Indent block
		pdf.CellFormat(35, 6, item.Label, "", 0, "", false, 0, "")
		pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
		
		// Jika alasannya panjang, gunakan MultiCell untuk auto-wrap agar tidak melebihi margin kanan
		if item.Label == "Alasan" {
			pdf.MultiCell(0, 6, item.Val, "", "", false)
		} else {
			pdf.CellFormat(0, 6, item.Val, "", 1, "", false, 0, "")
		}
	}
	pdf.Ln(8)

	// 10. Penutup
	pdf.MultiCell(0, 6, "Demikian surat permohonan izin ini, atas perhatian dan izin yang diberikan, saya mengucapkan terima kasih.", "", "", false)
	pdf.Ln(15)

	// 11. Tempat Tanda Tangan & Tanggal (Kanan Bawah)
	// Posisi X = 110 mm untuk meletakkan blok tanda tangan di kanan
	sigX := float64(110)
	
	pdf.SetX(sigX)
	pdf.CellFormat(0, 6, fmt.Sprintf("Samarinda, %s", excuse.TanggalSurat), "", 1, "", false, 0, "")
	pdf.Ln(2)

	// Menyisipkan gambar tanda tangan (jika ada)
	if excuse.SignatureBase64 != "" {
		base64Str := excuse.SignatureBase64
		// Bersihkan prefix base64 standar data URI jika dikirim dari frontend
		if strings.Contains(base64Str, ",") {
			parts := strings.Split(base64Str, ",")
			base64Str = parts[1]
		}

		imgBytes, err := base64.StdEncoding.DecodeString(base64Str)
		if err == nil {
			imgReader := bytes.NewReader(imgBytes)
			imgName := fmt.Sprintf("sig_%s", excuse.ID.String())
			
			// Register image secara dinamis dari memori (PNG dengan dukungan transparansi)
			pdf.RegisterImageOptionsReader(imgName, gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}, imgReader)
			
			// Dapatkan Y terkini untuk menggambar ttd di bawah tulisan Samarinda
			sigY := pdf.GetY()
			
			// Gambar tanda tangan dengan lebar 45mm dan tinggi auto (misal 20mm)
			pdf.ImageOptions(imgName, sigX + 5, sigY, 40, 20, false, gofpdf.ImageOptions{ImageType: "PNG", ReadDpi: true}, 0, "")
		}
	}
	
	pdf.Ln(22) // Berikan jarak vertikal yang cukup agar tidak tumpang tindih dengan gambar tanda tangan
	pdf.SetX(sigX)
	pdf.SetFont("Times", "B", 12)
	pdf.CellFormat(0, 6, fmt.Sprintf("( %s )", excuse.Nama), "", 1, "", false, 0, "")

	// 12. Tulis berkas PDF ke disk
	err = pdf.OutputFileAndClose(pdfPath)
	if err != nil {
		return "", fmt.Errorf("gagal menulis berkas PDF ke disk: %v", err)
	}

	// Kembalikan path relatif dari folder public agar Echo static server bisa menyajikannya langsung
	return fmt.Sprintf("/downloads/excuse_letters/%s", pdfFilename), nil
}

// ProductivityPDFData adalah struktur data input terpadu untuk menyusun PDF laporan
type ProductivityPDFData struct {
	UserName                string
	RangeDays               int
	TotalTasks              int
	CompletedTasks          int
	OnTimePercentage        float64
	ProductivityScore       float64
	CompletionRateChange    float64
	FocusHoursChange        float64
	TasksCompletedChange    float64
	ProductivityScoreChange float64
	FocusTimePct            float64
	MeetingTimePct          float64
	BreakTimePct            float64
	OtherTimePct            float64
	BurnoutScore            float64
	BurnoutStatus           string
	BurnoutDescription      string
	PeakDay                 string
	PeakHourRange           string
	GoldenConfidence        string
	PersonalInsightMessage  string
	PersonalInsightRec      string
}

// GenerateProductivityPDF menghasilkan laporan produktivitas berformat PDF dengan desain neobrutalist premium
func GenerateProductivityPDF(userID string, data ProductivityPDFData) (string, error) {
	// 1. Setup direktori download
	relativeDir := filepath.Join("public", "downloads", "reports")
	err := os.MkdirAll(relativeDir, 0755)
	if err != nil {
		return "", fmt.Errorf("gagal membuat direktori download laporan: %v", err)
	}

	pdfFilename := fmt.Sprintf("productivity_%s_%d.pdf", userID, time.Now().Unix())
	pdfPath := filepath.Join(relativeDir, pdfFilename)

	// 2. Setup pdf (Portrait, mm, A4)
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(20, 20, 20)
	pdf.AddPage()

	// 3. Desain Header Neobrutalist (Header Box tebal)
	pdf.SetLineWidth(0.8)
	pdf.SetDrawColor(0, 0, 0)
	
	// Banner atas (Neo Yellow background)
	pdf.SetFillColor(253, 224, 71) 
	pdf.Rect(20, 20, 170, 22, "FD")
	
	pdf.SetFont("Helvetica", "B", 16)
	pdf.SetTextColor(0, 0, 0)
	pdf.SetXY(20, 24)
	pdf.CellFormat(170, 8, "LAPORAN PRODUKTIVITAS AI MOTION", "", 1, "C", false, 0, "")
	
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetXY(20, 31)
	pdf.CellFormat(170, 6, fmt.Sprintf("Laporan Tren %d Hari Terakhir Pengguna", data.RangeDays), "", 1, "C", false, 0, "")
	pdf.Ln(8)

	// 4. Informasi Pengguna & Tanggal Cetak
	pdf.SetFont("Helvetica", "B", 10)
	pdf.CellFormat(30, 6, "Nama Pengguna", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.SetFont("Helvetica", "", 10)
	pdf.CellFormat(50, 6, data.UserName, "", 0, "", false, 0, "")

	pdf.SetFont("Helvetica", "B", 10)
	pdf.CellFormat(30, 6, "Tanggal Cetak", "", 0, "", false, 0, "")
	pdf.CellFormat(5, 6, ":", "", 0, "", false, 0, "")
	pdf.SetFont("Helvetica", "", 10)
	pdf.CellFormat(0, 6, time.Now().Format("02 Jan 2006 (15:04 WIB)"), "", 1, "", false, 0, "")
	pdf.Ln(4)

	// Garis pembatas tebal
	pdf.SetLineWidth(0.6)
	pdf.Line(20, 56, 190, 56)
	pdf.Ln(6)

	// 5. Grid Kartu Metrik Utama (2x2 Neobrutalist Grid)
	// Baris 1: Productivity Score & Tugas Selesai
	yGrid1 := pdf.GetY()
	
	// Card 1: Productivity Score (Neo Yellow)
	pdf.SetFillColor(253, 224, 71)
	pdf.Rect(20, yGrid1, 80, 22, "FD")
	pdf.SetXY(23, yGrid1 + 3)
	pdf.SetFont("Helvetica", "B", 8)
	pdf.CellFormat(74, 4, "PRODUCTIVITY SCORE", "", 1, "", false, 0, "")
	pdf.SetXY(23, yGrid1 + 8)
	pdf.SetFont("Helvetica", "B", 16)
	pdf.CellFormat(30, 8, fmt.Sprintf("%.1f / 10", data.ProductivityScore), "", 0, "", false, 0, "")
	pdf.SetFont("Helvetica", "B", 8)
	scoreChangeText := fmt.Sprintf("%+.1f WoW", data.ProductivityScoreChange)
	if data.ProductivityScoreChange >= 0 {
		pdf.SetTextColor(22, 101, 52) // Green
	} else {
		pdf.SetTextColor(153, 27, 27) // Red
	}
	pdf.CellFormat(40, 8, scoreChangeText, "", 1, "", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	// Card 2: Tugas Selesai (Neo Mint)
	pdf.SetFillColor(134, 239, 172)
	pdf.Rect(110, yGrid1, 80, 22, "FD")
	pdf.SetXY(113, yGrid1 + 3)
	pdf.SetFont("Helvetica", "B", 8)
	pdf.CellFormat(74, 4, "TUGAS SELESAI", "", 1, "", false, 0, "")
	pdf.SetXY(113, yGrid1 + 8)
	pdf.SetFont("Helvetica", "B", 16)
	pdf.CellFormat(30, 8, fmt.Sprintf("%d / %d", data.CompletedTasks, data.TotalTasks), "", 0, "", false, 0, "")
	pdf.SetFont("Helvetica", "B", 8)
	taskChangeText := fmt.Sprintf("%+.0f tugas WoW", data.TasksCompletedChange)
	if data.TasksCompletedChange >= 0 {
		pdf.SetTextColor(22, 101, 52)
	} else {
		pdf.SetTextColor(153, 27, 27)
	}
	pdf.CellFormat(40, 8, taskChangeText, "", 1, "", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	// Baris 2: Ketepatan Waktu & Risiko Stres
	yGrid2 := yGrid1 + 26
	
	// Card 3: Tepat Waktu (Neo Pink)
	pdf.SetFillColor(249, 168, 212)
	pdf.Rect(20, yGrid2, 80, 22, "FD")
	pdf.SetXY(23, yGrid2 + 3)
	pdf.SetFont("Helvetica", "B", 8)
	pdf.CellFormat(74, 4, "TEPAT WAKTU", "", 1, "", false, 0, "")
	pdf.SetXY(23, yGrid2 + 8)
	pdf.SetFont("Helvetica", "B", 16)
	pdf.CellFormat(35, 8, fmt.Sprintf("%.0f%%", data.OnTimePercentage), "", 0, "", false, 0, "")
	pdf.SetFont("Helvetica", "B", 8)
	rateChangeText := fmt.Sprintf("%+.1f%% WoW", data.CompletionRateChange)
	if data.CompletionRateChange >= 0 {
		pdf.SetTextColor(22, 101, 52)
	} else {
		pdf.SetTextColor(153, 27, 27)
	}
	pdf.CellFormat(35, 8, rateChangeText, "", 1, "", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	// Card 4: Risiko Burnout (Neo Blue/White)
	pdf.SetFillColor(142, 214, 255)
	pdf.Rect(110, yGrid2, 80, 22, "FD")
	pdf.SetXY(113, yGrid2 + 3)
	pdf.SetFont("Helvetica", "B", 8)
	pdf.CellFormat(74, 4, "STRES / BURNOUT RISK", "", 1, "", false, 0, "")
	pdf.SetXY(113, yGrid2 + 8)
	pdf.SetFont("Helvetica", "B", 16)
	pdf.CellFormat(35, 8, fmt.Sprintf("%.0f%%", data.BurnoutScore), "", 0, "", false, 0, "")
	pdf.SetFont("Helvetica", "B", 8)
	pdf.CellFormat(35, 8, fmt.Sprintf("Status: %s", data.BurnoutStatus), "", 1, "", false, 0, "")
	
	pdf.SetXY(20, yGrid2 + 26)

	// 6. Section AI Insight Asep AI (Neo Brutalist Gradient Look Box)
	yInsight := pdf.GetY()
	pdf.SetLineWidth(0.8)
	pdf.SetFillColor(245, 243, 255) // Light Purple
	pdf.Rect(20, yInsight, 170, 36, "FD")
	
	pdf.SetXY(24, yInsight + 4)
	pdf.SetFont("Helvetica", "B", 11)
	pdf.CellFormat(162, 5, "ANALISIS PERSONAL ASEP AI  ", "", 1, "", false, 0, "")
	
	pdf.SetXY(24, yInsight + 10)
	pdf.SetFont("Helvetica", "I", 9.5)
	
	// MultiCell to wrap the personalized insight safely
	pdf.MultiCell(162, 4.5, data.PersonalInsightMessage, "", "L", false)
	
	// Add AI Recommendation Box inside it
	pdf.SetXY(24, yInsight + 24)
	pdf.SetFont("Helvetica", "B", 8)
	pdf.SetTextColor(109, 40, 217) // Dark Purple
	pdf.CellFormat(30, 4, "REKOMENDASI AI:", "", 0, "", false, 0, "")
	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(0, 0, 0)
	pdf.CellFormat(0, 4, data.PersonalInsightRec, "", 1, "", false, 0, "")
	
	pdf.SetXY(20, yInsight + 42)

	// 7. Alokasi Waktu (Time Breakdown) & ML Engine Statistics
	yBreakdown := pdf.GetY()
	
	// Box kiri: Alokasi Waktu
	pdf.SetFillColor(255, 255, 255)
	pdf.Rect(20, yBreakdown, 80, 48, "FD")
	pdf.SetXY(23, yBreakdown + 4)
	pdf.SetFont("Helvetica", "B", 10)
	pdf.CellFormat(74, 5, "DISTRIBUSI ALOKASI WAKTU", "", 1, "", false, 0, "")
	pdf.Line(20, yBreakdown + 11, 100, yBreakdown + 11)
	
	timeTypes := []struct {
		Name string
		Pct  float64
	}{
		{"Waktu Fokus", data.FocusTimePct},
		{"Rapat Kalender", data.MeetingTimePct},
		{"Jeda Istirahat", data.BreakTimePct},
		{"Lain-lain", data.OtherTimePct},
	}
	
	for i, t := range timeTypes {
		pdf.SetXY(24, yBreakdown + 14 + float64(i*8))
		pdf.SetFont("Helvetica", "", 9)
		pdf.CellFormat(40, 6, t.Name, "", 0, "", false, 0, "")
		pdf.SetFont("Helvetica", "B", 9)
		pdf.CellFormat(0, 6, fmt.Sprintf("%.0f%%", t.Pct), "", 1, "", false, 0, "")
	}

	// Box kanan: Golden Focus Hours & Burnout Detail
	pdf.Rect(110, yBreakdown, 80, 48, "FD")
	pdf.SetXY(113, yBreakdown + 4)
	pdf.SetFont("Helvetica", "B", 10)
	pdf.CellFormat(74, 5, "MACHINE LEARNING ENGINE", "", 1, "", false, 0, "")
	pdf.Line(110, yBreakdown + 11, 190, yBreakdown + 11)
	
	pdf.SetXY(113, yBreakdown + 14)
	pdf.SetFont("Helvetica", "B", 8.5)
	pdf.CellFormat(74, 4, "Golden Productivity Hours:", "", 1, "", false, 0, "")
	pdf.SetXY(113, yBreakdown + 18)
	pdf.SetFont("Helvetica", "", 9.5)
	pdf.CellFormat(74, 5, fmt.Sprintf("%s (%s)", data.PeakDay, data.PeakHourRange), "", 1, "", false, 0, "")
	
	pdf.SetXY(113, yBreakdown + 25)
	pdf.SetFont("Helvetica", "B", 8.5)
	pdf.CellFormat(74, 4, "Rekomendasi Burnout:", "", 1, "", false, 0, "")
	pdf.SetXY(113, yBreakdown + 29)
	pdf.SetFont("Helvetica", "", 8.5)
	pdf.MultiCell(74, 3.8, data.BurnoutDescription, "", "L", false)
	
	pdf.Ln(10)

	// Footer dengan visual brand Motion
	pdf.SetLineWidth(0.4)
	pdf.Line(20, 260, 190, 260)
	pdf.SetXY(20, 262)
	pdf.SetFont("Helvetica", "B", 8)
	pdf.SetTextColor(120, 120, 120)
	pdf.CellFormat(0, 4, "Motion Productivity Report - Didukung oleh Asep AI Engine", "", 0, "", false, 0, "")
	pdf.CellFormat(0, 4, "Halaman 1 dari 1", "", 1, "R", false, 0, "")

	// 8. Tulis PDF ke file disk
	err = pdf.OutputFileAndClose(pdfPath)
	if err != nil {
		return "", fmt.Errorf("gagal menulis laporan PDF ke disk: %v", err)
	}

	return fmt.Sprintf("/downloads/reports/%s", pdfFilename), nil
}

