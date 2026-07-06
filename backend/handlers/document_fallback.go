package handlers

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/dslipak/pdf"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
	"github.com/motion/backend/services"
)

func uploadWithGoNativeFallback(c echo.Context, userID uuid.UUID, filename string, fileBytes []byte) error {
	log.Printf("[RAG-Upload-Fallback] Mulai memproses dokumen %s secara native...", filename)

	var text string
	var err error

	// 1. Ekstrak teks berdasarkan ekstensi file
	isPDF := strings.HasSuffix(strings.ToLower(filename), ".pdf")
	if isPDF {
		text, err = extractTextFromPDF(fileBytes)
		if err != nil {
			log.Printf("[RAG-Upload-Fallback-Error] Gagal mengekstrak teks dari PDF: %v", err)
			return utils.JSONError(c, http.StatusBadRequest, "Gagal memproses file PDF secara native: "+err.Error())
		}
	} else {
		text = string(fileBytes)
	}

	if strings.TrimSpace(text) == "" {
		return utils.JSONError(c, http.StatusBadRequest, "Dokumen kosong atau tidak memiliki teks yang dapat dibaca")
	}

	// 2. Lakukan chunking teks
	chunks := chunkText(text, 1000, 150)
	if len(chunks) == 0 {
		return utils.JSONError(c, http.StatusBadRequest, "Gagal memotong dokumen menjadi bagian-bagian kecil")
	}

	log.Printf("[RAG-Upload-Fallback] Berhasil memotong teks menjadi %d chunks", len(chunks))

	// 3. Generate embeddings menggunakan Gemini API untuk setiap chunk
	type EmbedResult struct {
		Content   string
		Embedding []float32
	}
	var embedResults []EmbedResult

	for i, chunk := range chunks {
		chunk = strings.TrimSpace(chunk)
		if chunk == "" {
			continue
		}
		
		// Rate limiting/throttling jika chunk terlalu banyak
		if i > 0 && i%30 == 0 {
			time.Sleep(1 * time.Second)
		}

		vector, err := services.GenerateGeminiEmbedding(chunk)
		if err != nil {
			log.Printf("[RAG-Upload-Fallback-Error] Gagal generate embedding untuk chunk %d: %v", i, err)
			return utils.JSONError(c, http.StatusInternalServerError, fmt.Sprintf("Gagal generate embedding pada chunk %d: %v", i, err))
		}
		embedResults = append(embedResults, EmbedResult{
			Content:   chunk,
			Embedding: vector,
		})
	}

	// 4. Simpan ke Supabase pgvector secara batch
	tx := config.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	totalSaved := 0
	batchSize := 50
	for i := 0; i < len(embedResults); i += batchSize {
		end := i + batchSize
		if end > len(embedResults) {
			end = len(embedResults)
		}
		batchData := embedResults[i:end]

		var queryBuf bytes.Buffer
		queryBuf.WriteString("INSERT INTO document_chunks (user_id, document_name, content, embedding) VALUES ")
		var params []interface{}
		
		for idx, item := range batchData {
			if idx > 0 {
				queryBuf.WriteString(", ")
			}
			queryBuf.WriteString("(?, ?, ?, ?)")
			params = append(params, userID.String(), filename, item.Content, models.Vector(item.Embedding))
		}

		if err := tx.Exec(queryBuf.String(), params...).Error; err != nil {
			tx.Rollback()
			log.Printf("[RAG-Upload-Fallback-DB-Error] Gagal bulk insert chunk ke database: %v", err)
			return utils.JSONError(c, http.StatusInternalServerError, "Gagal menyimpan vektor dokumen ke database")
		}
		totalSaved += len(batchData)
	}

	if err := tx.Commit().Error; err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "Gagal commit database transaksi")
	}

	log.Printf("[RAG-Upload-Fallback-Success] User %s sukses mengunggah berkas %s secara native (%d chunks tersimpan).",
		userID, filename, totalSaved)

	return utils.JSONSuccess(c, http.StatusOK, map[string]interface{}{
		"message":      "[Fallback Mode] Materi kuliah berhasil diproses secara native dan disinkronkan ke ingatan Hermes AI!",
		"documentName": filename,
		"chunksCount":  totalSaved,
	})
}

func extractTextFromPDF(data []byte) (string, error) {
	r, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	b, err := r.GetPlainText()
	if err != nil {
		return "", err
	}
	_, err = buf.ReadFrom(b)
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}

func chunkText(text string, chunkSize int, overlap int) []string {
	paragraphs := strings.Split(text, "\n")
	var chunks []string
	var currentChunk strings.Builder

	for _, p := range paragraphs {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		
		if currentChunk.Len() > 0 && currentChunk.Len()+len(p) > chunkSize {
			chunks = append(chunks, currentChunk.String())
			currentChunk.Reset()
		}
		
		if currentChunk.Len() > 0 {
			currentChunk.WriteString("\n")
		}
		currentChunk.WriteString(p)
	}
	
	if currentChunk.Len() > 0 {
		chunks = append(chunks, currentChunk.String())
	}
	
	var finalChunks []string
	for _, chunk := range chunks {
		if len(chunk) <= chunkSize {
			finalChunks = append(finalChunks, chunk)
		} else {
			runes := []rune(chunk)
			for i := 0; i < len(runes); i += chunkSize - overlap {
				end := i + chunkSize
				if end > len(runes) {
					end = len(runes)
				}
				finalChunks = append(finalChunks, string(runes[i:end]))
				if end == len(runes) {
					break
				}
			}
		}
	}
	
	return finalChunks
}
