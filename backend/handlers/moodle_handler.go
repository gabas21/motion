package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
	"github.com/motion/backend/services"
)

type MoodleHandler struct {
	DB *gorm.DB
}

// --- Request / Response structs ---

type ConnectMoodleRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	BaseURL  string `json:"baseUrl"`
}

type MoodleStatusResponse struct {
	IsConnected    bool       `json:"isConnected"`
	MoodleUsername string     `json:"moodleUsername,omitempty"`
	LastSyncAt     *time.Time `json:"lastSyncAt"`
}

// Connect: POST /api/v1/moodle/connect
// Simpan kredensial WeLearn (password dienkripsi) DAN BaseURL (diisi default jika kosong) dan lakukan sync perdana.
func (h *MoodleHandler) Connect(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	req := new(ConnectMoodleRequest)
	if err := c.Bind(req); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Request tidak valid")
	}

	if req.Username == "" || req.Password == "" {
		return utils.JSONError(c, http.StatusBadRequest, "Username dan password wajib diisi")
	}

	if req.BaseURL == "" {
		req.BaseURL = "https://welearn.wicida.ac.id"
	}

	// Verifikasi login ke WeLearn sebelum menyimpan
	session := services.NewWeLearnSession(req.Username, req.Password, req.BaseURL)
	if err := session.Login(); err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Login WeLearn gagal: "+err.Error())
	}

	// Enkripsi password sebelum simpan ke DB
	encrypted, err := utils.EncryptWithSalt(req.Password, userID.String())
	if err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengamankan kredensial")
	}

	// Upsert koneksi
	conn := models.MoodleConnection{
		UserID:            userID,
		MoodleUsername:    req.Username,
		EncryptedPassword: encrypted,
		MoodleBaseURL:     req.BaseURL,
		IsConnected:       true,
	}
	
	var existingConn models.MoodleConnection
	err = h.DB.Where("user_id = ?", userID).First(&existingConn).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			if createErr := h.DB.Create(&conn).Error; createErr != nil {
				return utils.JSONError(c, http.StatusInternalServerError, "Gagal menghubungkan WeLearn")
			}
		} else {
			return utils.JSONError(c, http.StatusInternalServerError, "Gagal memproses basis data")
		}
	} else {
		existingConn.MoodleUsername = req.Username
		existingConn.EncryptedPassword = encrypted
		existingConn.MoodleBaseURL = req.BaseURL
		existingConn.IsConnected = true
		if saveErr := h.DB.Save(&existingConn).Error; saveErr != nil {
			return utils.JSONError(c, http.StatusInternalServerError, "Gagal memperbarui hubungan WeLearn")
		}
		conn = existingConn
	}

	// Sync perdana di background
	go services.SyncUserAssignmentsInternal(h.DB, session, userID, conn.ID)

	return utils.JSONSuccess(c, http.StatusOK, map[string]string{
		"message": "WeLearn berhasil terhubung, sinkronisasi berjalan di latar belakang",
	})
}

// Status: GET /api/v1/moodle/status
// Cek status koneksi Moodle user saat ini.
func (h *MoodleHandler) Status(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	var conn models.MoodleConnection
	if err := h.DB.Where("user_id = ?", userID).First(&conn).Error; err != nil {
		return utils.JSONSuccess(c, http.StatusOK, MoodleStatusResponse{IsConnected: false})
	}

	return utils.JSONSuccess(c, http.StatusOK, MoodleStatusResponse{
		IsConnected:    conn.IsConnected,
		MoodleUsername: conn.MoodleUsername,
		LastSyncAt:     conn.LastSyncAt,
	})
}

// Sync: POST /api/v1/moodle/sync
// Picu sinkronisasi manual oleh user — menggunakan AJAX Moodle internal + Smart Session Cache.
func (h *MoodleHandler) Sync(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	var conn models.MoodleConnection
	if err := h.DB.Where("user_id = ? AND is_connected = true", userID).First(&conn).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "Akun WeLearn belum terhubung")
	}

	if err := services.SyncViaREST(h.DB, &conn, nil); err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Sinkronisasi gagal: "+err.Error())
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]string{
		"message": "Sinkronisasi selesai",
	})
}

// GetAssignments: GET /api/v1/moodle/assignments
// Ambil daftar tugas. Query params: ?filter=upcoming|overdue|all (default: all) & ?page=1 & ?limit=20
func (h *MoodleHandler) GetAssignments(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}
	filter := c.QueryParam("filter")

	// Paginasi opsional
	pageStr := c.QueryParam("page")
	limitStr := c.QueryParam("limit")
	usePagination := pageStr != "" || limitStr != ""

	page := 1
	limit := 20

	if pageStr != "" {
		if val, err := strconv.Atoi(pageStr); err == nil && val > 0 {
			page = val
		}
	}
	if limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 {
			limit = val
			if limit > 100 {
				limit = 100
			}
		}
	}
	offset := (page - 1) * limit

	query := h.DB.Where("user_id = ?", userID)
	if config.AppConfig.AcademicYearPrefix != "" {
		query = query.Where("course_name LIKE ?", "%"+config.AppConfig.AcademicYearPrefix+"%")
	}

	switch filter {
	case "overdue":
		query = query.Where("due_date < ? AND submission_status != 'submitted'", time.Now())
	case "upcoming":
		query = query.Where("due_date >= ?", time.Now())
	}

	var total int64
	if err := query.Model(&models.MoodleAssignment{}).Count(&total).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal menghitung total tugas")
	}

	var assignments []models.MoodleAssignment
	dbQuery := query.Order("due_date ASC")
	if usePagination {
		dbQuery = dbQuery.Limit(limit).Offset(offset)
	}

	if err := dbQuery.Find(&assignments).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal memuat tugas WeLearn")
	}

	if usePagination {
		return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
			"assignments": assignments,
			"pagination": map[string]interface{}{
				"page":  page,
				"limit": limit,
				"total": total,
			},
		})
	}

	return utils.JSONSuccess(c, http.StatusOK, assignments)
}

// GetCourses: GET /api/v1/moodle/courses
// Ambil daftar mata kuliah yang tersinkronisasi.
func (h *MoodleHandler) GetCourses(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	var courses []models.MoodleCourse
	query := h.DB.Where("user_id = ?", userID)
	if config.AppConfig.AcademicYearPrefix != "" {
		query = query.Where("name LIKE ?", "%"+config.AppConfig.AcademicYearPrefix+"%")
	}
	if err := query.Order("name ASC").Find(&courses).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal memuat daftar mata kuliah")
	}

	// Hubungkan dengan tugas untuk menghitung jumlah total & tertunda menggunakan query agregat tunggal
	type CourseWithCount struct {
		models.MoodleCourse
		TotalAssignments   int64 `json:"totalAssignments"`
		PendingAssignments int64 `json:"pendingAssignments"`
	}

	type courseStat struct {
		CourseID string
		Total    int64
		Pending  int64
	}
	var stats []courseStat
	if err := h.DB.Model(&models.MoodleAssignment{}).
		Select("course_id, COUNT(*) as total, SUM(CASE WHEN submission_status != 'submitted' THEN 1 ELSE 0 END) as pending").
		Where("user_id = ?", userID).
		Group("course_id").
		Find(&stats).Error; err != nil {
		log.Printf("[GetCourses] Gagal mengambil stats tugas: %v", err)
	}

	statsMap := make(map[string]courseStat)
	for _, s := range stats {
		statsMap[s.CourseID] = s
	}

	result := make([]CourseWithCount, 0, len(courses))
	for _, course := range courses {
		stat := statsMap[course.MoodleCourseID]
		result = append(result, CourseWithCount{
			MoodleCourse:       course,
			TotalAssignments:   stat.Total,
			PendingAssignments: stat.Pending,
		})
	}

	return utils.JSONSuccess(c, http.StatusOK, result)
}

// GetCourseAssignments: GET /api/v1/moodle/courses/:courseId/assignments
// Ambil semua tugas dalam satu mata kuliah.
func (h *MoodleHandler) GetCourseAssignments(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}
	courseID := c.Param("courseId")

	var assignments []models.MoodleAssignment
	if err := h.DB.Where("user_id = ? AND course_id = ?", userID, courseID).
		Order("due_date ASC").
		Find(&assignments).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal memuat tugas")
	}

	return utils.JSONSuccess(c, http.StatusOK, assignments)
}

// Disconnect: POST /api/v1/moodle/disconnect
// Hapus koneksi Moodle user secara permanen (soft delete).
func (h *MoodleHandler) Disconnect(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	// Hapus data dengan error handling yang proper
	if err := h.DB.Where("user_id = ?", userID).Delete(&models.MoodleConnection{}).Error; err != nil {
		log.Printf("[Moodle-Disconnect] Gagal hapus MoodleConnection user %s: %v", userID, err)
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal memutus koneksi WeLearn")
	}
	if err := h.DB.Where("user_id = ?", userID).Delete(&models.MoodleAssignment{}).Error; err != nil {
		log.Printf("[Moodle-Disconnect] Gagal hapus MoodleAssignment user %s: %v", userID, err)
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal menghapus data tugas WeLearn")
	}
	if err := h.DB.Where("user_id = ?", userID).Delete(&models.MoodleCourse{}).Error; err != nil {
		log.Printf("[Moodle-Disconnect] Gagal hapus MoodleCourse user %s: %v", userID, err)
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal menghapus data mata kuliah WeLearn")
	}

	return utils.JSONSuccess(c, http.StatusOK, map[string]string{
		"message": "Koneksi WeLearn dibatalkan",
	})
}

// DebugScrape: GET /api/v1/moodle/debug
// Endpoint diagnostik — menjalankan sync AJAX dan mengembalikan ringkasan tanpa simpan ke DB.
func (h *MoodleHandler) DebugScrape(c echo.Context) error {
	if config.AppConfig.ServerEnv == "production" {
		return utils.JSONError(c, http.StatusForbidden, "Endpoint diagnostik dinonaktifkan di production")
	}

	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	var conn models.MoodleConnection
	if err := h.DB.Where("user_id = ? AND is_connected = true", userID).First(&conn).Error; err != nil {
		return utils.JSONError(c, http.StatusNotFound, "Akun WeLearn belum terhubung")
	}

	debugResult := services.DebugScrapeREST(h.DB, &conn)
	return utils.JSONSuccess(c, http.StatusOK, debugResult)
}

// --- Excuse Letter Handlers ---

type CreateExcuseLetterRequest struct {
	Nama            string `json:"nama"`
	NIM             string `json:"nim"`
	Prodi           string `json:"prodi"`
	Kelompok        string `json:"kelompok"`
	CourseID        string `json:"courseId"`
	CourseName      string `json:"courseName"`
	HariTanggal     string `json:"hariTanggal"`
	Alasan          string `json:"alasan"`
	TanggalSurat    string `json:"tanggalSurat"`
	SignatureBase64 string `json:"signatureBase64"`
}

// CreateExcuseLetter: POST /api/v1/moodle/excuse-letters
func (h *MoodleHandler) CreateExcuseLetter(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	req := new(CreateExcuseLetterRequest)
	if err := c.Bind(req); err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "Request tidak valid")
	}

	// Validasi input
	if req.Nama == "" || req.NIM == "" || req.Prodi == "" || req.Kelompok == "" || req.CourseID == "" || req.CourseName == "" || req.HariTanggal == "" || req.Alasan == "" || req.TanggalSurat == "" || req.SignatureBase64 == "" {
		return utils.JSONError(c, http.StatusBadRequest, "Semua formulir dan tanda tangan wajib diisi")
	}

	// Simpan ke database
	excuse := models.MoodleExcuseLetter{
		UserID:          userID,
		Nama:            req.Nama,
		NIM:             req.NIM,
		Prodi:           req.Prodi,
		Kelompok:        req.Kelompok,
		CourseID:        req.CourseID,
		CourseName:      req.CourseName,
		HariTanggal:     req.HariTanggal,
		Alasan:          req.Alasan,
		TanggalSurat:    req.TanggalSurat,
		SignatureBase64: req.SignatureBase64,
	}

	if err := h.DB.Create(&excuse).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal menyimpan data surat izin ke basis data: "+err.Error())
	}

	// Generate PDF
	pdfURL, err := services.GenerateExcuseLetterPDF(&excuse)
	if err != nil {
		h.DB.Delete(&excuse)
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengenerate file PDF: "+err.Error())
	}

	return utils.JSONSuccess(c, http.StatusCreated, map[string]interface{}{
		"message": "Surat izin berhasil dibuat",
		"pdfUrl":  pdfURL,
		"excuse":  excuse,
	})
}

// GetExcuseLetters: GET /api/v1/moodle/excuse-letters
func (h *MoodleHandler) GetExcuseLetters(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	var excuses []models.MoodleExcuseLetter
	if err := h.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&excuses).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengambil riwayat surat izin")
	}

	return utils.JSONSuccess(c, http.StatusOK, excuses)
}

// DeleteExcuseLetter: DELETE /api/v1/moodle/excuse-letters/:id
func (h *MoodleHandler) DeleteExcuseLetter(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
	}

	id := c.Param("id")
	if id == "" {
		return utils.JSONError(c, http.StatusBadRequest, "ID tidak boleh kosong")
	}

	var excuse models.MoodleExcuseLetter
	if err := h.DB.Where("id = ? AND user_id = ?", id, userID).First(&excuse).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return utils.JSONError(c, http.StatusNotFound, "Surat izin tidak ditemukan")
		}
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal memproses basis data")
	}

	if err := h.DB.Delete(&excuse).Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal menghapus surat izin")
	}

	// Hapus berkas fisiknya secara aman
	pdfFilename := fmt.Sprintf("excuse_letter_%s.pdf", id)
	pdfPath := filepath.Join("public", "downloads", "excuse_letters", pdfFilename)
	_ = os.Remove(pdfPath)

	return utils.JSONSuccess(c, http.StatusOK, map[string]string{
		"message": "Surat izin berhasil dihapus",
	})
}


