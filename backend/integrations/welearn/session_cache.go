package welearn

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/motion/backend/models"
	"gorm.io/gorm"
)

// serializeCookies converts HTTP client cookies into a JSON string for database caching.
func (s *WeLearnSession) serializeCookies() (string, error) {
	u, err := url.Parse(s.BaseURL)
	if err != nil {
		return "", err
	}
	cookies := s.client.Jar.Cookies(u)
	entries := make([]cookieEntry, 0, len(cookies))
	for _, c := range cookies {
		entries = append(entries, cookieEntry{Name: c.Name, Value: c.Value})
	}
	b, err := json.Marshal(entries)
	if err != nil {
		return "", fmt.Errorf("gagal marshal cookie: %w", err)
	}
	return string(b), nil
}

// restoreCookies restores cookies from a JSON string into the HTTP client cookie jar.
func (s *WeLearnSession) restoreCookies(cookieJSON string) error {
	if cookieJSON == "" {
		return fmt.Errorf("cookie JSON kosong")
	}
	var entries []cookieEntry
	if err := json.Unmarshal([]byte(cookieJSON), &entries); err != nil {
		return fmt.Errorf("gagal unmarshal cookie JSON: %w", err)
	}
	u, err := url.Parse(s.BaseURL)
	if err != nil {
		return err
	}
	httpCookies := make([]*http.Cookie, 0, len(entries))
	for _, e := range entries {
		httpCookies = append(httpCookies, &http.Cookie{
			Name:  e.Name,
			Value: e.Value,
			Path:  "/",
		})
	}
	s.client.Jar.SetCookies(u, httpCookies)
	log.Printf("[welearn-ajax] %d cookie direstorasi ke http.Client", len(httpCookies))
	return nil
}

// extractSessionInfo opens /my/ to extract the sesskey and numerical user ID.
func (s *WeLearnSession) extractSessionInfo() (sessionInfo, error) {
	globalSemaphore <- struct{}{}
	resp, err := s.client.Get(s.BaseURL + "/my/")
	<-globalSemaphore
	if err != nil {
		return sessionInfo{}, fmt.Errorf("gagal GET /my/: %w", err)
	}
	defer resp.Body.Close()

	if strings.Contains(resp.Request.URL.Path, "/login/") {
		return sessionInfo{}, fmt.Errorf("SESSION_EXPIRED: /my/ redirect ke halaman login")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return sessionInfo{}, fmt.Errorf("gagal baca body /my/: %w", err)
	}

	reSesskey := regexp.MustCompile(`"sesskey"\s*:\s*"([^"]{5,50})"`)
	sm := reSesskey.FindSubmatch(body)
	if len(sm) < 2 {
		return sessionInfo{}, fmt.Errorf("sesskey tidak ditemukan di /my/ — periksa apakah Moodle mengubah format M.cfg")
	}
	sesskey := string(sm[1])

	reUserID := regexp.MustCompile(`data-userid="(\d+)"`)
	um := reUserID.FindSubmatch(body)
	var userID int64
	if len(um) >= 2 {
		fmt.Sscanf(string(um[1]), "%d", &userID)
	} else {
		reUserIDURL := regexp.MustCompile(`[?&]userid=(\d+)`)
		umURL := reUserIDURL.FindSubmatch(body)
		if len(umURL) >= 2 {
			fmt.Sscanf(string(umURL[1]), "%d", &userID)
		}
	}
	if userID == 0 {
		return sessionInfo{}, fmt.Errorf("userid tidak ditemukan di halaman /my/ — tidak bisa memanggil AJAX courses tanpa userid valid")
	}

	log.Printf("[welearn-ajax] Session info OK — sesskey=%s…, userid=%d", sesskey[:min(4, len(sesskey))], userID)
	return sessionInfo{Sesskey: sesskey, UserID: userID}, nil
}

// ExtractSesskey is a public wrapper for backward compatibility.
func (s *WeLearnSession) ExtractSesskey() (string, error) {
	info, err := s.extractSessionInfo()
	return info.Sesskey, err
}

// resolveSession resolves which session to use, checking cache validation first.
func resolveSession(db *gorm.DB, conn *models.MoodleConnection, session *WeLearnSession) (sesskey string, moodleUserID int64, err error) {
	now := time.Now()

	cacheValid := conn.CachedSesskey != "" &&
		conn.CachedCookies != "" &&
		conn.CachedMoodleUserID != 0 &&
		conn.CachedSessionExpiry != nil &&
		conn.CachedSessionExpiry.After(now) &&
		!strings.HasPrefix(conn.CachedSesskey, "rest_") // make sure it's not a REST token cache

	if cacheValid {
		if restoreErr := session.restoreCookies(conn.CachedCookies); restoreErr == nil {
			log.Printf("[welearn-ajax] Cache sesi valid s/d %s — skip login", conn.CachedSessionExpiry.Format(time.RFC3339))
			return conn.CachedSesskey, conn.CachedMoodleUserID, nil
		}
		log.Println("[welearn-ajax] Gagal restorasi cookie dari cache, fallback ke login baru...")
	}

	log.Println("[welearn-ajax] Cache sesi kedaluwarsa atau tidak lengkap, login baru...")
	return forceRefreshSession(db, conn, session)
}

// forceRefreshSession logs in fully and saves session details to the DB.
func forceRefreshSession(db *gorm.DB, conn *models.MoodleConnection, session *WeLearnSession) (string, int64, error) {
	var loggedIn = false
	u, err := url.Parse(session.BaseURL)
	if err == nil && len(session.client.Jar.Cookies(u)) > 0 {
		loggedIn = true
		log.Println("[welearn-ajax] Sesi terdeteksi sudah login via cookie jar — skip Login()")
	}

	if !loggedIn {
		if err := session.Login(); err != nil {
			return "", 0, fmt.Errorf("login WeLearn gagal: %w", err)
		}
	}

	info, err := session.extractSessionInfo()
	if err != nil {
		return "", 0, fmt.Errorf("gagal ekstrak session info dari /my/: %w", err)
	}

	cookieJSON, cookieErr := session.serializeCookies()
	if cookieErr != nil {
		log.Printf("[welearn-ajax] ⚠ Gagal serialisasi cookie: %v (cache tidak akan disimpan)", cookieErr)
		cookieJSON = ""
	}

	expiry := time.Now().Add(90 * time.Minute)

	if dbErr := db.Model(&models.MoodleConnection{}).
		Where("id = ?", conn.ID).
		Updates(map[string]any{
			"cached_sesskey":        info.Sesskey,
			"cached_cookies":        cookieJSON,
			"cached_session_expiry": expiry,
			"cached_moodle_user_id": info.UserID,
		}).Error; dbErr != nil {
		log.Printf("[welearn-ajax] ⚠ Gagal simpan cache sesi ke DB: %v", dbErr)
	}

	log.Printf("[welearn-ajax] Sesi baru disimpan — userid=%d, berlaku s/d %s", info.UserID, expiry.Format(time.RFC3339))
	return info.Sesskey, info.UserID, nil
}

// forceRefreshSesskey is a public shim.
func forceRefreshSesskey(db *gorm.DB, conn *models.MoodleConnection, session *WeLearnSession) (string, error) {
	sesskey, _, err := forceRefreshSession(db, conn, session)
	return sesskey, err
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
