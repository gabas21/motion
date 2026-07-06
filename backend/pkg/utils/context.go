package utils

import (
	"fmt"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

// GetUserID mengekstrak UUID user dari Echo context yang sudah diisi oleh AuthRequired middleware.
// Mengembalikan error jika context tidak mengandung userId yang valid.
//
// Contoh penggunaan:
//
//	userID, err := utils.GetUserID(c)
//	if err != nil {
//	    return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
//	}
func GetUserID(c echo.Context) (uuid.UUID, error) {
	val := c.Get("userId")
	if val == nil {
		return uuid.Nil, fmt.Errorf("userId tidak ditemukan di context")
	}
	id, ok := val.(uuid.UUID)
	if !ok {
		return uuid.Nil, fmt.Errorf("userId bukan tipe UUID yang valid")
	}
	return id, nil
}

// MustGetUserID adalah versi GetUserID yang langsung menulis error response ke Echo context.
// Mengembalikan (uuid.UUID, bool) — jika bool false, response sudah ditulis dan handler harus return.
//
// Contoh penggunaan:
//
//	userID, ok := utils.MustGetUserID(c)
//	if !ok {
//	    return nil // response sudah ditulis oleh MustGetUserID
//	}
func MustGetUserID(c echo.Context) (uuid.UUID, bool) {
	id, err := GetUserID(c)
	if err != nil {
		_ = JSONError(c, http.StatusUnauthorized, "Unauthorized")
		return uuid.Nil, false
	}
	return id, true
}
