package welearn

import (
	"regexp"
	"strings"
)

// cleanSectionName cleans the section name from whitespace and noise characters.
func cleanSectionName(name string) string {
	cleaned := strings.TrimSpace(name)
	cleaned = strings.ReplaceAll(cleaned, "\n", " ")
	for strings.Contains(cleaned, "  ") {
		cleaned = strings.ReplaceAll(cleaned, "  ", " ")
	}
	cleaned = strings.TrimPrefix(cleaned, "#")
	return strings.TrimSpace(cleaned)
}

// CleanCourseName removes administrative prefixes (such as "2024/2025_1_REG_...")
// from Moodle course names. It is designed to be resilient to changes in prefix formats.
func CleanCourseName(name string) string {
	original := name
	
	// Step 1: Try regex-based cleanup for known patterns first
	re := regexp.MustCompile(`^\d{4}/\d{4}_\d+_\w+_(PA|REG|EXT|PJJ)_\w+_(PA|REG|EXT|PJJ)_\d+_(Class_)?`)
	name = re.ReplaceAllString(name, "")
	
	reAlt := regexp.MustCompile(`^\d{4}/\d{4}_\d+_\w+_`)
	name = reAlt.ReplaceAllString(name, "")

	name = strings.TrimSpace(name)
	if name != "" && name != original {
		return name
	}

	// Step 2: Fallback/Robust Strategy: Split by underscore and filter administrative codes
	parts := strings.Split(original, "_")
	var cleanedParts []string
	
	digitRegex := regexp.MustCompile(`^\d+$`)
	acadYearRegex := regexp.MustCompile(`^\d{4}/\d{4}$`)
	
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		
		// Skip academic year (e.g. 2024/2025)
		if acadYearRegex.MatchString(trimmed) {
			continue
		}
		
		// Skip pure numbers (e.g. 12345, semester numbers like 1, 2)
		if digitRegex.MatchString(trimmed) {
			continue
		}
		
		// Skip uppercase administrative codes (length <= 4, e.g. REG, PA, IF, PJJ, EXT, TI, SI)
		if len(trimmed) <= 4 && trimmed == strings.ToUpper(trimmed) {
			continue
		}
		
		// Skip common noise words
		lower := strings.ToLower(trimmed)
		if lower == "class" || lower == "regular" || lower == "ekstensi" {
			continue
		}
		
		cleanedParts = append(cleanedParts, part)
	}
	
	if len(cleanedParts) > 0 {
		cleaned := strings.TrimSpace(strings.Join(cleanedParts, "_"))
		if cleaned != "" {
			return cleaned
		}
	}
	
	return strings.TrimSpace(original)
}
