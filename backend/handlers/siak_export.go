package handlers

import (
	"bytes"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jung-kurt/gofpdf"
	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
)

// ExportSiakTranscriptPDF menghasilkan PDF transkrip nilai dari cache SIAK
func ExportSiakTranscriptPDF(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]any{"success": false, "message": "Unauthorized"})
	}

	var account models.SiakAccount
	if err := config.DB.Where("user_id = ?", userID.String()).First(&account).Error; err != nil {
		return c.JSON(http.StatusBadRequest, map[string]any{"success": false, "message": "Akun SIAK belum dihubungkan"})
	}

	var grades []models.SiakGrade
	if err := config.DB.Where("user_id = ?", userID.String()).Order("semester ASC, kode_matkul ASC").Find(&grades).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal mengambil nilai"})
	}

	totalSKS := 0
	totalMutu := 0.0
	for _, g := range grades {
		totalSKS += g.SKS
		totalMutu += g.Mutu
	}
	ipk := 0.0
	if totalSKS > 0 {
		ipk = totalMutu / float64(totalSKS)
	}

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.AddPage()

	// Header
	pdf.SetFont("Helvetica", "B", 18)
	pdf.SetTextColor(0, 0, 0)
	pdf.CellFormat(0, 10, "TRANSKRIP NILAI AKADEMIK SIAK", "", 1, "C", false, 0, "")

	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(100, 100, 100)
	pdf.CellFormat(0, 6, "STMIK WICIDA SAMARINDA - MOTION APP INTEGRATION", "", 1, "C", false, 0, "")
	pdf.Ln(4)

	// User Info Box
	pdf.SetFillColor(250, 249, 245)
	pdf.SetDrawColor(0, 0, 0)
	pdf.SetLineWidth(0.4)
	pdf.Rect(15, pdf.GetY(), 180, 22, "FD")

	currY := pdf.GetY() + 4
	pdf.SetXY(20, currY)
	pdf.SetFont("Helvetica", "B", 10)
	pdf.SetTextColor(0, 0, 0)
	pdf.Cell(30, 5, "NIM:")
	pdf.SetFont("Helvetica", "", 10)
	pdf.Cell(60, 5, account.NIM)

	pdf.SetFont("Helvetica", "B", 10)
	pdf.Cell(30, 5, "IPK Kumulatif:")
	pdf.SetFont("Helvetica", "B", 10)
	pdf.SetTextColor(0, 128, 0)
	pdf.Cell(30, 5, fmt.Sprintf("%.2f / 4.00", ipk))

	pdf.SetXY(20, currY+7)
	pdf.SetFont("Helvetica", "B", 10)
	pdf.SetTextColor(0, 0, 0)
	pdf.Cell(30, 5, "Total SKS:")
	pdf.SetFont("Helvetica", "", 10)
	pdf.Cell(60, 5, fmt.Sprintf("%d SKS", totalSKS))

	pdf.SetFont("Helvetica", "B", 10)
	pdf.Cell(30, 5, "Total Matkul:")
	pdf.SetFont("Helvetica", "", 10)
	pdf.Cell(30, 5, strconv.Itoa(len(grades)))

	pdf.SetY(currY + 22)

	// Table Header
	pdf.SetFillColor(240, 240, 240)
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetTextColor(0, 0, 0)
	pdf.CellFormat(10, 8, "No", "1", 0, "C", true, 0, "")
	pdf.CellFormat(25, 8, "Kode", "1", 0, "C", true, 0, "")
	pdf.CellFormat(75, 8, "Mata Kuliah", "1", 0, "L", true, 0, "")
	pdf.CellFormat(25, 8, "Semester", "1", 0, "C", true, 0, "")
	pdf.CellFormat(15, 8, "SKS", "1", 0, "C", true, 0, "")
	pdf.CellFormat(15, 8, "Nilai", "1", 0, "C", true, 0, "")
	pdf.CellFormat(15, 8, "Mutu", "1", 1, "C", true, 0, "")

	// Table Body
	pdf.SetFont("Helvetica", "", 9)
	for i, g := range grades {
		// Page break check
		if pdf.GetY() > 270 {
			pdf.AddPage()
			pdf.SetFillColor(240, 240, 240)
			pdf.SetFont("Helvetica", "B", 9)
			pdf.CellFormat(10, 8, "No", "1", 0, "C", true, 0, "")
			pdf.CellFormat(25, 8, "Kode", "1", 0, "C", true, 0, "")
			pdf.CellFormat(75, 8, "Mata Kuliah", "1", 0, "L", true, 0, "")
			pdf.CellFormat(25, 8, "Semester", "1", 0, "C", true, 0, "")
			pdf.CellFormat(15, 8, "SKS", "1", 0, "C", true, 0, "")
			pdf.CellFormat(15, 8, "Nilai", "1", 0, "C", true, 0, "")
			pdf.CellFormat(15, 8, "Mutu", "1", 1, "C", true, 0, "")
			pdf.SetFont("Helvetica", "", 9)
		}

		fill := i%2 == 1
		if fill {
			pdf.SetFillColor(252, 252, 252)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}

		namaTrunc := g.NamaMatkul
		if len(namaTrunc) > 42 {
			namaTrunc = namaTrunc[:40] + ".."
		}

		pdf.CellFormat(10, 7, strconv.Itoa(i+1), "1", 0, "C", fill, 0, "")
		pdf.CellFormat(25, 7, g.KodeMatkul, "1", 0, "C", fill, 0, "")
		pdf.CellFormat(75, 7, namaTrunc, "1", 0, "L", fill, 0, "")
		pdf.CellFormat(25, 7, g.Semester, "1", 0, "C", fill, 0, "")
		pdf.CellFormat(15, 7, strconv.Itoa(g.SKS), "1", 0, "C", fill, 0, "")
		pdf.CellFormat(15, 7, g.NilaiHuruf, "1", 0, "C", fill, 0, "")
		pdf.CellFormat(15, 7, fmt.Sprintf("%.2f", g.Mutu), "1", 1, "C", fill, 0, "")
	}

	pdf.Ln(4)
	pdf.SetFont("Helvetica", "I", 8)
	pdf.SetTextColor(120, 120, 120)
	pdf.CellFormat(0, 5, fmt.Sprintf("Dicetak otomatis oleh Motion App pada %s", time.Now().Format("02 Jan 2006 15:04 WIB")), "", 1, "R", false, 0, "")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal membuat PDF"})
	}

	filename := fmt.Sprintf("Transkrip_SIAK_%s.pdf", account.NIM)
	c.Response().Header().Set("Content-Type", "application/pdf")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	return c.Blob(http.StatusOK, "application/pdf", buf.Bytes())
}

// ExportSiakScheduleICS menghasilkan file iCal (.ics) dari jadwal kuliah SIAK
func ExportSiakScheduleICS(c echo.Context) error {
	userIDVal := c.Get("userId")
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]any{"success": false, "message": "Unauthorized"})
	}

	var schedules []models.SiakSchedule
	if err := config.DB.Where("user_id = ?", userID.String()).Find(&schedules).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]any{"success": false, "message": "Gagal mengambil jadwal"})
	}

	var icsBuilder strings.Builder
	icsBuilder.WriteString("BEGIN:VCALENDAR\r\n")
	icsBuilder.WriteString("VERSION:2.0\r\n")
	icsBuilder.WriteString("PRODID:-//Motion App//SIAK Schedule Calendar//ID\r\n")
	icsBuilder.WriteString("CALSCALE:GREGORIAN\r\n")
	icsBuilder.WriteString("METHOD:PUBLISH\r\n")
	icsBuilder.WriteString("X-WR-CALNAME:Jadwal Kuliah SIAK\r\n")
	icsBuilder.WriteString("X-WR-TIMEZONE:Asia/Makassar\r\n")

	dayToWeekday := map[string]time.Weekday{
		"senin":  time.Monday,
		"selasa": time.Tuesday,
		"rabu":   time.Wednesday,
		"kamis":  time.Thursday,
		"jumat":  time.Friday,
		"sabtu":  time.Saturday,
		"minggu": time.Sunday,
	}

	now := time.Now()

	for _, s := range schedules {
		weekday, exists := dayToWeekday[strings.ToLower(strings.TrimSpace(s.Hari))]
		if !exists {
			continue
		}

		var startHour, startMin, endHour, endMin int
		fmt.Sscanf(s.JamMulai, "%d:%d", &startHour, &startMin)
		fmt.Sscanf(s.JamSelesai, "%d:%d", &endHour, &endMin)

		daysAhead := int(weekday - now.Weekday())
		if daysAhead < 0 {
			daysAhead += 7
		}
		firstEventDate := now.AddDate(0, 0, daysAhead)

		startTime := time.Date(firstEventDate.Year(), firstEventDate.Month(), firstEventDate.Day(), startHour, startMin, 0, 0, time.Local)
		endTime := time.Date(firstEventDate.Year(), firstEventDate.Month(), firstEventDate.Day(), endHour, endMin, 0, 0, time.Local)

		dtStart := startTime.UTC().Format("20060102T150405Z")
		dtEnd := endTime.UTC().Format("20060102T150405Z")

		icsBuilder.WriteString("BEGIN:VEVENT\r\n")
		icsBuilder.WriteString(fmt.Sprintf("UID:siak-schedule-%s@motion.app\r\n", s.ID))
		icsBuilder.WriteString(fmt.Sprintf("SUMMARY:[KULIAH SIAK] %s\r\n", s.NamaMatkul))
		icsBuilder.WriteString(fmt.Sprintf("DESCRIPTION:Mata Kuliah: %s\\nKode: %s\\nDosen: %s\\nSKS: %d\r\n", s.NamaMatkul, s.KodeMatkul, s.Dosen, s.SKS))
		if s.Ruangan != "" {
			icsBuilder.WriteString(fmt.Sprintf("LOCATION:Ruang %s\r\n", s.Ruangan))
		}
		icsBuilder.WriteString(fmt.Sprintf("DTSTART:%s\r\n", dtStart))
		icsBuilder.WriteString(fmt.Sprintf("DTEND:%s\r\n", dtEnd))
		icsBuilder.WriteString("RRULE:FREQ=WEEKLY;COUNT=16\r\n")
		icsBuilder.WriteString("STATUS:CONFIRMED\r\n")
		icsBuilder.WriteString("END:VEVENT\r\n")
	}

	icsBuilder.WriteString("END:VCALENDAR\r\n")

	filename := "Jadwal_Kuliah_SIAK.ics"
	c.Response().Header().Set("Content-Type", "text/calendar; charset=utf-8")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	return c.String(http.StatusOK, icsBuilder.String())
}
