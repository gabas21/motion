package welearn

import "testing"

func TestCleanCourseName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{
			input:    "2024/2025_1_REG_PA_IF_PA_12345_Pemrograman Web",
			expected: "Pemrograman Web",
		},
		{
			input:    "2023/2024_2_EXT_PA_TI_Class_67890_Kecerdasan Buatan",
			expected: "Kecerdasan Buatan",
		},
		{
			input:    "Struktur Data",
			expected: "Struktur Data",
		},
		{
			input:    "2024/2025_1_PJJ_Jaringan Komputer",
			expected: "Jaringan Komputer",
		},
	}

	for _, tt := range tests {
		result := CleanCourseName(tt.input)
		if result != tt.expected {
			t.Errorf("CleanCourseName(%q) = %q; expected %q", tt.input, result, tt.expected)
		}
	}
}
