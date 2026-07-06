package utils

import (
	"github.com/labstack/echo/v4"
)

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// JSONSuccess returns a formatted success response
func JSONSuccess(c echo.Context, statusCode int, data interface{}) error {
	return c.JSON(statusCode, APIResponse{
		Success: true,
		Data:    data,
	})
}

// JSONError returns a formatted error response
func JSONError(c echo.Context, statusCode int, errMsg string) error {
	return c.JSON(statusCode, APIResponse{
		Success: false,
		Error:   errMsg,
	})
}
