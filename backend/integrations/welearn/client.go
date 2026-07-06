package welearn

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"time"
)

// globalSemaphore limits all concurrent HTTP requests to WeLearn to avoid hammering the server.
var globalSemaphore = make(chan struct{}, 8)

// restClient is a dedicated HTTP client with timeout for REST endpoints.
var restClient = &http.Client{
	Timeout: 30 * time.Second,
}

// WeLearnSession manages the HTTP session with cookie jar.
type WeLearnSession struct {
	client   *http.Client
	username string
	password string
	BaseURL  string
}

// NewWeLearnSession creates a new session with isolated cookie jar.
func NewWeLearnSession(username, password, baseURL string) *WeLearnSession {
	jar, _ := cookiejar.New(nil)
	if baseURL == "" {
		baseURL = "https://welearn.wicida.ac.id"
	}
	return &WeLearnSession{
		username: username,
		password: password,
		BaseURL:  baseURL,
		client: &http.Client{
			Jar:     jar,
			Timeout: 30 * time.Second,
		},
	}
}

// Login performs authentication to WeLearn.
func (s *WeLearnSession) Login() error {
	globalSemaphore <- struct{}{}
	defer func() { <-globalSemaphore }()

	resp, err := s.client.Get(s.BaseURL + "/login/index.php")
	if err != nil {
		return fmt.Errorf("gagal akses halaman login: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("gagal baca halaman login: %w", err)
	}

	loginToken := extractInputValue(body, "logintoken")

	formData := url.Values{
		"username":   {s.username},
		"password":   {s.password},
		"logintoken": {loginToken},
		"anchor":     {""},
	}

	resp2, err := s.client.PostForm(s.BaseURL+"/login/index.php", formData)
	if err != nil {
		return fmt.Errorf("gagal POST login: %w", err)
	}
	defer resp2.Body.Close()

	finalURL := resp2.Request.URL.String()
	if strings.Contains(finalURL, "/login/index.php") {
		respBody, _ := io.ReadAll(resp2.Body)
		if strings.Contains(string(respBody), "Invalid login") {
			return fmt.Errorf("username atau password WeLearn salah")
		}
		return fmt.Errorf("login gagal: masih di halaman login setelah POST")
	}

	log.Printf("[welearn] ✓ Login berhasil: %s", s.username)
	return nil
}

// IsLoggedIn checks if current session is still logged in.
func (s *WeLearnSession) IsLoggedIn() bool {
	globalSemaphore <- struct{}{}
	defer func() { <-globalSemaphore }()

	resp, err := s.client.Get(s.BaseURL + "/my/")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return !strings.Contains(resp.Request.URL.Path, "/login/")
}

// callAJAX sends a batch request to /lib/ajax/service.php.
func (s *WeLearnSession) callAJAX(sesskey string, reqs []ajaxRequest) ([]ajaxEnvelopeItem, error) {
	globalSemaphore <- struct{}{}
	defer func() { <-globalSemaphore }()

	payload, err := json.Marshal(reqs)
	if err != nil {
		return nil, fmt.Errorf("gagal marshal AJAX request: %w", err)
	}

	endpoint := fmt.Sprintf("%s/lib/ajax/service.php?sesskey=%s", s.BaseURL, sesskey)
	resp, err := s.client.Post(endpoint, "application/json", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("gagal POST AJAX: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("AJAX_SESSION_EXPIRED: HTTP %d dari Moodle", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("gagal baca AJAX response body: %w", err)
	}

	if len(bodyBytes) > 0 && bodyBytes[0] == '<' {
		return nil, fmt.Errorf("AJAX_SESSION_EXPIRED: Moodle mengembalikan HTML bukan JSON")
	}

	var envelope []ajaxEnvelopeItem
	if err := json.Unmarshal(bodyBytes, &envelope); err != nil {
		preview := bodyBytes
		if len(preview) > 200 {
			preview = preview[:200]
		}
		return nil, fmt.Errorf("gagal decode AJAX JSON: %w — preview: %s", err, string(preview))
	}
	return envelope, nil
}

// restGet executes a GET request under global rate limit.
func restGet(endpoint string) (*http.Response, error) {
	globalSemaphore <- struct{}{}
	defer func() { <-globalSemaphore }()

	resp, err := restClient.Get(endpoint)
	if err != nil && isTransientError(err) {
		log.Printf("[welearn-client] Request GET %s gagal (%v). Mencoba kembali (retry 1/1)...", endpoint, err)
		time.Sleep(1 * time.Second)
		return restClient.Get(endpoint)
	}
	return resp, err
}

// restPostForm executes a POST request under global rate limit.
func restPostForm(uri string, data url.Values) (*http.Response, error) {
	globalSemaphore <- struct{}{}
	defer func() { <-globalSemaphore }()
	return restClient.PostForm(uri, data)
}

// extractInputValue extracts a value from a hidden input tag.
func extractInputValue(body []byte, name string) string {
	idx := strings.Index(string(body), `name="`+name+`"`)
	if idx < 0 {
		return ""
	}
	prefix := string(body[:idx])
	tagStart := strings.LastIndex(prefix, "<input")
	if tagStart < 0 {
		return ""
	}
	inputTag := string(body[tagStart:])
	tagEnd := strings.Index(inputTag, ">")
	if tagEnd > 0 {
		inputTag = inputTag[:tagEnd]
	}

	valIdx := strings.Index(inputTag, `value="`)
	if valIdx < 0 {
		return ""
	}
	rest := inputTag[valIdx+7:]
	endIdx := strings.Index(rest, `"`)
	if endIdx < 0 {
		return ""
	}
	return rest[:endIdx]
}
