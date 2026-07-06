package utils

import (
	"strings"
)

// CleanBase64String menghapus prefiks data URL jika ada (misal: "data:image/png;base64,...")
func CleanBase64String(s string) string {
	if idx := strings.Index(s, ","); idx != -1 {
		return s[idx+1:]
	}
	return s
}

// DetectMimeType mendeteksi MIME type gambar berdasarkan magic bytes
func DetectMimeType(data []byte) string {
	if len(data) < 4 {
		return "image/png"
	}
	// JPEG: FF D8 FF
	if data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
		return "image/jpeg"
	}
	// PNG: 89 50 4E 47
	if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
		return "image/png"
	}
	// WebP: RIFF....WEBP
	if len(data) >= 12 && string(data[0:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return "image/webp"
	}
	// GIF: GIF8
	if len(data) >= 3 && string(data[0:3]) == "GIF" {
		return "image/gif"
	}
	return "image/png" // default
}
