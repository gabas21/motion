package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"sync"
)

var (
	encryptionKey   []byte
	encryptionKeyMu sync.RWMutex
)

// SetEncryptionKey menginisialisasi kunci enkripsi AES-256 secara dinamis.
// Harus dipanggil sekali saat startup aplikasi sebelum enkripsi/dekripsi digunakan.
func SetEncryptionKey(secret string) {
	encryptionKeyMu.Lock()
	defer encryptionKeyMu.Unlock()
	hash := sha256.Sum256([]byte(secret))
	encryptionKey = hash[:]
}

// deriveKey mengembalikan 32-byte AES key via SHA-256
func deriveKey() []byte {
	encryptionKeyMu.RLock()
	defer encryptionKeyMu.RUnlock()
	if len(encryptionKey) == 32 {
		return encryptionKey
	}
	hash := sha256.Sum256([]byte("super_secret_jwt_key_motion_app_2026"))
	return hash[:]
}

// EncryptPassword mengenkripsi plaintext password dengan AES-256-GCM.
// Output berupa base64 string yang aman disimpan di database.
func EncryptPassword(plaintext string) (string, error) {
	key := deriveKey()

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptPassword mendekripsi hasil EncryptPassword kembali ke plaintext.
func DecryptPassword(encoded string) (string, error) {
	key := deriveKey()

	ciphertext, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("ciphertext terlalu pendek")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", errors.New("dekripsi gagal: password atau kunci salah")
	}

	return string(plaintext), nil
}

// deriveKeyWithSalt menghasilkan kunci enkripsi 32-byte unik per-pengguna menggunakan SHA-256(BaseKey + Salt).
func deriveKeyWithSalt(salt string) []byte {
	baseKey := deriveKey()
	hash := sha256.Sum256(append(baseKey, []byte(salt)...))
	return hash[:]
}

// EncryptWithSalt mengenkripsi plaintext dengan AES-256-GCM menggunakan salt per-pengguna.
func EncryptWithSalt(plaintext string, salt string) (string, error) {
	if salt == "" {
		return EncryptPassword(plaintext)
	}
	key := deriveKeyWithSalt(salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptWithSalt mendekripsi ciphertext dengan AES-256-GCM menggunakan salt per-pengguna.
func DecryptWithSalt(encoded string, salt string) (string, error) {
	if salt == "" {
		return DecryptPassword(encoded)
	}
	key := deriveKeyWithSalt(salt)

	ciphertext, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("ciphertext terlalu pendek")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", errors.New("dekripsi gagal: data atau kunci salah")
	}

	return string(plaintext), nil
}
