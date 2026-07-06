package models

import (
	"database/sql/driver"
	"fmt"
	"strconv"
	"strings"
)

// Vector represents a pgvector column type in PostgreSQL
type Vector []float32

// Scan implements the sql.Scanner interface
func (v *Vector) Scan(value interface{}) error {
	if value == nil {
		*v = nil
		return nil
	}

	var str string
	switch val := value.(type) {
	case string:
		str = val
	case []byte:
		str = string(val)
	default:
		return fmt.Errorf("failed to scan vector value: %v", value)
	}

	// Remove brackets '[' and ']' or '{' and '}'
	str = strings.Trim(str, "[]{}")
	if str == "" {
		*v = []float32{}
		return nil
	}

	parts := strings.Split(str, ",")
	res := make([]float32, len(parts))
	for i, part := range parts {
		val, err := strconv.ParseFloat(strings.TrimSpace(part), 32)
		if err != nil {
			return fmt.Errorf("failed to parse float in vector: %w", err)
		}
		res[i] = float32(val)
	}

	*v = res
	return nil
}

// Value implements the driver.Valuer interface
func (v Vector) Value() (driver.Value, error) {
	if v == nil {
		return nil, nil
	}
	if len(v) == 0 {
		return "[]", nil
	}

	var sb strings.Builder
	sb.WriteByte('[')
	for i, val := range v {
		if i > 0 {
			sb.WriteByte(',')
		}
		sb.WriteString(strconv.FormatFloat(float64(val), 'f', -1, 32))
	}
	sb.WriteByte(']')
	return sb.String(), nil
}

// GormDataType returns the database type definition for GORM auto-migration
func (Vector) GormDataType() string {
	return "vector(768)"
}
