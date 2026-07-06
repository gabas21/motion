package services

import (
	"bytes"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
)

// StripHTMLTags removes HTML tags from a string
func StripHTMLTags(html string) string {
	re := regexp.MustCompile("<[^>]*>")
	return re.ReplaceAllString(html, "")
}

// IngestWeLearnAssignmentDescription chunks, embeds, and saves Moodle assignment intro text to pgvector document_chunks
func IngestWeLearnAssignmentDescription(userID uuid.UUID, courseName string, assignName string, introHTML string) {
	cleanedText := strings.TrimSpace(StripHTMLTags(introHTML))
	if cleanedText == "" {
		return
	}

	docName := "[Moodle] " + courseName + " - " + assignName

	// 1. Clean existing chunks for this specific document and user to prevent duplicates
	if err := config.DB.Exec("DELETE FROM document_chunks WHERE user_id = ? AND document_name = ?", userID.String(), docName).Error; err != nil {
		log.Printf("[RAG-Auto-Ingest-Error] Gagal membersihkan chunk lama untuk %s: %v", docName, err)
	}

	// 2. Chunk text
	chunks := chunkTextLocal(cleanedText, 1000, 150)
	if len(chunks) == 0 {
		return
	}

	log.Printf("[RAG-Auto-Ingest] Memproses auto-ingest untuk '%s' (%d chunks)...", docName, len(chunks))

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

		vector, err := GenerateGeminiEmbedding(chunk)
		if err != nil {
			log.Printf("[RAG-Auto-Ingest-Error] Gagal generate embedding untuk chunk %d dari %s: %v", i, docName, err)
			continue
		}
		embedResults = append(embedResults, EmbedResult{
			Content:   chunk,
			Embedding: vector,
		})
	}

	if len(embedResults) == 0 {
		return
	}

	// 3. Save to pgvector
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
			params = append(params, userID.String(), docName, item.Content, models.Vector(item.Embedding))
		}

		if err := tx.Exec(queryBuf.String(), params...).Error; err != nil {
			tx.Rollback()
			log.Printf("[RAG-Auto-Ingest-DB-Error] Gagal bulk insert chunks untuk %s ke DB: %v", docName, err)
			return
		}
		totalSaved += len(batchData)
	}

	if err := tx.Commit().Error; err != nil {
		log.Printf("[RAG-Auto-Ingest-DB-Error] Gagal commit tx RAG untuk %s: %v", docName, err)
		return
	}

	log.Printf("[RAG-Auto-Ingest-Success] Sukses menyimpan %d chunks RAG untuk '%s'", totalSaved, docName)
}

func chunkTextLocal(text string, chunkSize int, overlap int) []string {
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
