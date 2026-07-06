package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
)

type EmbedResponseItem struct {
	Content   string    `json:"content"`
	Embedding []float32 `json:"embedding"`
}

type PythonEmbedResponse struct {
	DocumentName string              `json:"documentName"`
	ChunksCount  int                 `json:"chunksCount"`
	Data         []EmbedResponseItem `json:"data"`
}

// UploadDocumentHandler menerima berkas PDF/TXT dari Next.js, mengirimkannya
// ke Python ML Service untuk di-chunk & di-embed menggunakan Gemini text-embedding-004,
// kemudian menyimpannya ke Supabase pgvector.
func UploadDocument(c echo.Context) error {
	userID, err := utils.GetUserID(c)
	if err != nil {
		return utils.JSONError(c, http.StatusUnauthorized, "Otorisasi gagal")
	}

	// 1. Ambil berkas dari Multipart Form
	file, err := c.FormFile("file")
	if err != nil {
		return utils.JSONError(c, http.StatusBadRequest, "File dokumen wajib dilampirkan")
	}

	src, err := file.Open()
	if err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal membuka file dokumen")
	}
	defer src.Close()

	// Baca seluruh isi file ke byte slice agar dapat di-reuse oleh fallback
	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal membaca isi dokumen")
	}

	// 2. Siapkan Multipart Form Request ke Python ML Service
	bodyBuf := new(bytes.Buffer)
	writer := multipart.NewWriter(bodyBuf)

	// Tulis file ke form data
	part, err := writer.CreateFormFile("file", file.Filename)
	if err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal membuat form berkas")
	}
	if _, err := io.Copy(part, bytes.NewReader(fileBytes)); err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal menyalin berkas form")
	}

	// Tulis API Key Gemini ke form data (diperlukan Python untuk calling Google Embedding API)
	apiKey := config.AppConfig.GeminiAPIKey
	if apiKey == "" {
		apiKey = config.AppConfig.OpenRouterAPIKey // fallback jika memakai satu key
	}
	if apiKey == "" {
		return utils.JSONError(c, http.StatusBadRequest, "Kunci API Gemini belum dikonfigurasi di backend/.env")
	}

	err = writer.WriteField("gemini_api_key", apiKey)
	if err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal menyisipkan kunci API")
	}

	writer.Close()

	// 3. Kirim ke Python ML Service (FastAPI)
	pythonClient := &http.Client{Timeout: 45 * time.Second} // Beri durasi longgar untuk parsing dokumen tebal
	targetURL := config.AppConfig.MLServiceURL + "/documents/embed"
	req, err := http.NewRequest("POST", targetURL, bodyBuf)
	if err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal merakit koneksi ke Python ML Service")
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := pythonClient.Do(req)
	if err != nil {
		log.Printf("[RAG-Upload] Python ML Service tidak aktif/offline (%v). Menjalankan Go-native fallback...", err)
		return uploadWithGoNativeFallback(c, userID, file.Filename, fileBytes)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		log.Printf("[RAG-Upload-Error] Python service returned status %d: %s", resp.StatusCode, string(respBytes))
		return utils.JSONError(c, resp.StatusCode, "Gagal memproses embeddings di Python ML Engine: "+string(respBytes))
	}

	// 4. Parse hasil potongan teks & vektor dari Python
	var pythonRes PythonEmbedResponse
	if err := json.NewDecoder(resp.Body).Decode(&pythonRes); err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal mengurai respon embeddings")
	}

	if len(pythonRes.Data) == 0 {
		return utils.JSONError(c, http.StatusInternalServerError, "Tidak ada data embedding yang dihasilkan")
	}

	// 5. Simpan potongan & vektor secara batch ke Supabase pgvector
	tx := config.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	totalSaved := 0
	batchSize := 100
	for i := 0; i < len(pythonRes.Data); i += batchSize {
		end := i + batchSize
		if end > len(pythonRes.Data) {
			end = len(pythonRes.Data)
		}
		batchData := pythonRes.Data[i:end]

		// Build multi-row INSERT query dynamically
		var queryBuf bytes.Buffer
		queryBuf.WriteString("INSERT INTO document_chunks (user_id, document_name, content, embedding) VALUES ")
		var params []interface{}
		
		for idx, item := range batchData {
			if idx > 0 {
				queryBuf.WriteString(", ")
			}
			queryBuf.WriteString("(?, ?, ?, ?)")
			params = append(params, userID.String(), pythonRes.DocumentName, item.Content, models.Vector(item.Embedding))
		}

		if err := tx.Exec(queryBuf.String(), params...).Error; err != nil {
			tx.Rollback()
			log.Printf("[RAG-Upload-DB-Error] Gagal bulk insert chunk ke database: %v", err)
			return utils.JSONError(c, http.StatusInternalServerError, "Gagal menyimpan vektor dokumen ke database")
		}
		totalSaved += len(batchData)
	}

	if err := tx.Commit().Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal commit database transaksi")
	}

	log.Printf("[RAG-Upload-Success] User %s sukses mengunggah berkas %s (%d chunks tersimpan).",
		userID, pythonRes.DocumentName, totalSaved)

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"message":      "Materi kuliah berhasil diproses dan disinkronkan ke ingatan Hermes AI!",
		"documentName": pythonRes.DocumentName,
		"chunksCount":  totalSaved,
	})
}
