package services

import (
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/motion/backend/models"
	"golang.org/x/net/html"
)

const (
	siakBaseURL     = "https://siak.wicida.ac.id/wicida.ac.id/siawicida/"
	siakLoginURL    = siakBaseURL + "index.php"
	siakGradesURL   = siakBaseURL + "index.php?page=mrkp"
	siakScheduleURL = siakBaseURL + "index.php?page=mkrs" // ✅ Dikonfirmasi dari SIAK Wicida (KRS / Jadwal Kuliah)
	siakExamURL     = siakBaseURL + "index.php?page=mkhs" // ✅ Dikonfirmasi dari SIAK Wicida (KHS / Jadwal Ujian)
)

type SiakSession struct {
	client *http.Client
	nim    string
}

// FetchPageRaw mengambil konten HTML dari URL SIAK manapun
func (s *SiakSession) FetchPageRaw(targetURL string) (string, error) {
	resp, err := s.client.Get(targetURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(bodyBytes), nil
}

// SiakLogin melakukan autentikasi ke SIAK STMIK WICIDA
func SiakLogin(nim, password string) (*SiakSession, error) {
	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{
		Jar:     jar,
		Timeout: 20 * time.Second,
	}

	// Langkah 1: POST login credentials
	// Field names sesuai HTML form SIAK yang asli:
	// <input type="text" name="user" />
	// <input type="password" name="pass" />
	// <button type="submit" name="login_admin">Login</button>
	formData := url.Values{
		"user":        {nim},
		"pass":        {password},
		"login_admin": {"Login"}, // Submit button — wajib ada agar PHP mendeteksi form submission
	}

	resp, err := client.PostForm(siakLoginURL, formData)
	if err != nil {
		return nil, fmt.Errorf("gagal menghubungi server SIAK: %v", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	bodyStr := string(bodyBytes)

	// Validasi apakah login sukses:
	// Setelah login berhasil, SIAK akan menampilkan menu dengan kata "logout" atau nama/NIM mahasiswa
	// Jika gagal, halaman form login tetap muncul (masih ada <input type="text" name="user">)
	if strings.Contains(bodyStr, `name="user"`) || strings.Contains(bodyStr, `name='user'`) {
		return nil, fmt.Errorf("NIM atau Password SIAK Anda salah")
	}

	return &SiakSession{
		client: client,
		nim:    nim,
	}, nil
}

// SiakDebugResult menyimpan hasil inspeksi satu URL SIAK
type SiakDebugResult struct {
	Label       string   `json:"label"`
	URL         string   `json:"url"`
	HTTPStatus  int      `json:"httpStatus"`
	BodySize    int      `json:"bodySize"`
	IsLoginPage bool     `json:"isLoginPage"`
	Error       string   `json:"error,omitempty"`
	HTMLSnippet string   `json:"htmlSnippet"` // 5000 char pertama
	Links       []string `json:"links"`       // semua href yang ditemukan
}

// DebugFetchPages mengambil dan menganalisa semua URL kandidat jadwal/ujian SIAK.
// Mengembalikan struct terstruktur yang dikirim ke response JSON.
func (s *SiakSession) DebugFetchPages() []SiakDebugResult {
	reHref := regexp.MustCompile(`href=["']([^"']+)["']`)

	urls := []struct{ label, url string }{
		{"MENU UTAMA", siakLoginURL},
		{"JADWAL (page=jadwal)", siakScheduleURL},
		{"UJIAN (page=ujian)", siakExamURL},
		{"KRS (page=krs)", siakBaseURL + "index.php?page=krs"},
		{"JADWAL (page=jdwl)", siakBaseURL + "index.php?page=jdwl"},
		{"UJIAN (page=ujn)", siakBaseURL + "index.php?page=ujn"},
		{"JADWAL (page=jadwalmhs)", siakBaseURL + "index.php?page=jadwalmhs"},
		{"JADWAL (page=jadwal_mhs)", siakBaseURL + "index.php?page=jadwal_mhs"},
		{"UJIAN (page=ujian_mhs)", siakBaseURL + "index.php?page=ujian_mhs"},
	}

	var results []SiakDebugResult
	for _, u := range urls {
		result := SiakDebugResult{Label: u.label, URL: u.url}

		resp, err := s.client.Get(u.url)
		if err != nil {
			result.Error = err.Error()
			fmt.Printf("[SIAK-DEBUG] Gagal GET %s: %v\n", u.url, err)
			results = append(results, result)
			continue
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			result.Error = "Gagal baca body: " + err.Error()
			results = append(results, result)
			continue
		}

		bodyStr := string(body)
		result.HTTPStatus = resp.StatusCode
		result.BodySize = len(bodyStr)
		result.IsLoginPage = strings.Contains(bodyStr, `name="user"`) || strings.Contains(bodyStr, `name='user'`)

		// Snippet HTML (5000 karakter pertama)
		snippetLen := 5000
		if len(bodyStr) < snippetLen {
			snippetLen = len(bodyStr)
		}
		result.HTMLSnippet = bodyStr[:snippetLen]

		// Ekstrak semua link
		seen := make(map[string]bool)
		for _, m := range reHref.FindAllStringSubmatch(bodyStr, -1) {
			if len(m) > 1 && !seen[m[1]] {
				seen[m[1]] = true
				result.Links = append(result.Links, m[1])
			}
		}

		// Log ke terminal juga
		status := "✅ OK"
		if result.IsLoginPage {
			status = "⚠️  LOGIN PAGE"
		}
		fmt.Printf("[SIAK-DEBUG] %-35s %s  (%d bytes, %d links)\n", u.label, status, result.BodySize, len(result.Links))

		results = append(results, result)
	}
	return results
}



// FetchGrades mengambil halaman nilai kumulatif dan mem-parsing-nya
func (s *SiakSession) FetchGrades() ([]models.SiakGrade, *models.SiakSummary, error) {
	resp, err := s.client.Get(siakGradesURL)
	if err != nil {
		return nil, nil, fmt.Errorf("gagal mengambil halaman nilai: %v", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, err
	}
	bodyStr := string(bodyBytes)

	// DEBUG: Log 50000 karakter pertama dari response untuk analisa struktur HTML
	debugLen := 50000
	if len(bodyStr) < debugLen {
		debugLen = len(bodyStr)
	}
	fmt.Printf("[SIAK-DEBUG] Halaman nilai (50000 char pertama):\n%s\n[SIAK-DEBUG-END]\n", bodyStr[:debugLen])

	// Cek jika session habis / terlempar ke login page
	if strings.Contains(bodyStr, `name="user"`) || strings.Contains(bodyStr, `name='user'`) {
		return nil, nil, fmt.Errorf("sesi login SIAK telah berakhir, harap hubungkan ulang")
	}

	return ParseSiakGradesHTML(bodyStr, s.nim)
}

// Helper untuk mengekstrak teks polos dari node HTML
func getInnerText(n *html.Node) string {
	if n.Type == html.TextNode {
		return n.Data
	}
	var sb strings.Builder
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		sb.WriteString(getInnerText(c))
	}
	return sb.String()
}

// ParseSiakGradesHTML bertugas mem-parsing HTML tabel nilai SIAK Wicida
func ParseSiakGradesHTML(htmlContent, nim string) ([]models.SiakGrade, *models.SiakSummary, error) {
	doc, err := html.Parse(strings.NewReader(htmlContent))
	if err != nil {
		return nil, nil, fmt.Errorf("gagal memproses dokumen HTML: %v", err)
	}

	var grades []models.SiakGrade
	var totalSKS = 0
	var ipk = 0.0

	// Compile regex untuk mencari IPK dan SKS di bagian ringkasan/footer
	// Contoh: "Jumlah SKS 96" dan "IP Kumulatif 3.18"
	ipkRegex := regexp.MustCompile(`IP\s*(?:Kumulatif|Accumulative|Akumulatif|):\s*([0-9.,]+)|IP\s*Kumulatif\s*([0-9.,]+)|IPK\s*=\s*([0-9.,]+)`)
	sksRegex := regexp.MustCompile(`Jumlah\s*SKS\s*(\d+)|Jumlah\s*SKS\s*:\s*(\d+)|Total\s*SKS\s*=\s*(\d+)`)

	// Fungsi pembantu rekursif untuk menyusuri node DOM
	var parseNode func(*html.Node)
	parseNode = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "tr" {
			// Ambil semua kolom td di baris ini
			var cells []*html.Node
			for c := n.FirstChild; c != nil; c = c.NextSibling {
				if c.Type == html.ElementNode && c.Data == "td" {
					cells = append(cells, c)
				}
			}

			if len(cells) > 0 {
				rowText := strings.TrimSpace(getInnerText(n))
				// Normalisasi spasi berlebih
				rowText = regexp.MustCompile(`\s+`).ReplaceAllString(rowText, " ")

				// 1. Parse baris nilai mata kuliah (memiliki minimal 8 atau 9 kolom)
				if len(cells) >= 8 {
					col1 := strings.TrimSpace(getInnerText(cells[0]))
					_, err := strconv.Atoi(col1)

					// Cek jika kolom pertama berupa nomor urut, berarti ini baris matkul
					if err == nil {
						kode := strings.TrimSpace(getInnerText(cells[1]))
						nama := strings.TrimSpace(getInnerText(cells[2]))
						smtStr := strings.TrimSpace(getInnerText(cells[3])) // Kolom SMT
						sksStr := strings.TrimSpace(getInnerText(cells[4])) // Kolom SKS
						bobotStr := strings.TrimSpace(getInnerText(cells[6])) // Kolom Bobot (Skala 4.0)
						nilaiHuruf := strings.TrimSpace(getInnerText(cells[7])) // Kolom Huruf (A, B, C, D, E)

						sks, _ := strconv.Atoi(sksStr)
						bobotStr = strings.Replace(bobotStr, ",", ".", -1)
						nilaiAngka, _ := strconv.ParseFloat(bobotStr, 64)

						// Hitung mutu: SKS * Bobot (nilaiAngka)
						mutu := float64(sks) * nilaiAngka

						semesterLabel := "Lainnya"
						if smtStr != "" {
							semesterLabel = "Semester " + smtStr
						}

						if nama != "" && kode != "" && sks > 0 {
							grades = append(grades, models.SiakGrade{
								Semester:   semesterLabel,
								KodeMatkul: kode,
								NamaMatkul: nama,
								SKS:        sks,
								NilaiHuruf: nilaiHuruf,
								NilaiAngka: nilaiAngka,
								Mutu:       mutu,
							})
						}
					}
				}

				// 2. Deteksi SKS / IPK di baris ringkasan/footer
				if strings.Contains(rowText, "IP Kumulatif") || strings.Contains(rowText, "IPK") {
					if matches := ipkRegex.FindStringSubmatch(rowText); len(matches) > 0 {
						for _, m := range matches[1:] {
							if m != "" {
								m = strings.Replace(m, ",", ".", -1)
								ipk, _ = strconv.ParseFloat(m, 64)
								break
							}
						}
					}
				}
				if strings.Contains(rowText, "Jumlah SKS") || strings.Contains(rowText, "Total SKS") {
					if matches := sksRegex.FindStringSubmatch(rowText); len(matches) > 0 {
						for _, m := range matches[1:] {
							if m != "" {
								totalSKS, _ = strconv.Atoi(m)
								break
							}
						}
					}
				}
			}
		}

		for c := n.FirstChild; c != nil; c = c.NextSibling {
			parseNode(c)
		}
	}

	parseNode(doc)

	// Fallback hitung SKS jika regex gagal menemukan ringkasan di footer HTML
	calculatedSKS := 0
	totalMutu := 0.0
	for _, g := range grades {
		calculatedSKS += g.SKS
		totalMutu += g.Mutu
	}
	if totalSKS == 0 {
		totalSKS = calculatedSKS
	}
	if ipk == 0.0 && totalSKS > 0 {
		ipk = totalMutu / float64(totalSKS)
	}

	now := time.Now()
	summary := &models.SiakSummary{
		NIM:        nim,
		IPK:        ipk,
		TotalSKS:   totalSKS,
		TotalMutu:  totalMutu,
		LastSyncAt: &now,
	}

	return grades, summary, nil
}

func cleanSemesterString(raw string) string {
	raw = strings.ToUpper(raw)
	// Hapus kata SEMESTER dan tanda baca
	raw = strings.Replace(raw, "SEMESTER", "", -1)
	raw = strings.Replace(raw, ":", "", -1)
	raw = strings.Replace(raw, "-", "", -1)
	raw = strings.TrimSpace(raw)

	// Ubah case menjadi Title Case secara manual untuk GASAL / GENAP
	if strings.Contains(raw, "GASAL") {
		raw = strings.Replace(raw, "GASAL", "Gasal", -1)
	} else if strings.Contains(raw, "GENAP") {
		raw = strings.Replace(raw, "GENAP", "Genap", -1)
	} else if strings.Contains(raw, "PENDEK") {
		raw = strings.Replace(raw, "PENDEK", "Pendek", -1)
	}

	return raw
}

// fetchPage fetches a URL and returns the body as string (closes body immediately, no defer-in-loop bug).
// Returns empty string if request fails or page redirects to login.
func (s *SiakSession) fetchPage(targetURL string) string {
	resp, err := s.client.Get(targetURL)
	if err != nil {
		fmt.Printf("[SIAK] Gagal GET %s: %v\n", targetURL, err)
		return ""
	}
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		fmt.Printf("[SIAK] Gagal baca body %s: %v\n", targetURL, err)
		return ""
	}
	str := string(body)
	if strings.Contains(str, `name="user"`) || strings.Contains(str, `name='user'`) {
		fmt.Printf("[SIAK] URL %s → redirect ke login (session expired / URL salah)\n", targetURL)
		return ""
	}
	fmt.Printf("[SIAK] URL %s → OK (%d bytes)\n", targetURL, len(str))
	return str
}

// FetchSchedule mengambil halaman jadwal kuliah dan mem-parsing-nya
func (s *SiakSession) FetchSchedule() ([]models.SiakSchedule, error) {
	candidateURLs := []string{
		siakScheduleURL,
		siakBaseURL + "index.php?page=jdwl",
		siakBaseURL + "index.php?page=krs",
		siakBaseURL + "index.php?page=jadwalmhs",
		siakBaseURL + "index.php?page=jadwal_mhs",
	}

	for _, targetURL := range candidateURLs {
		bodyStr := s.fetchPage(targetURL)
		if bodyStr == "" {
			continue
		}
		schedules, err := ParseSiakScheduleHTML(bodyStr)
		if err != nil {
			fmt.Printf("[SIAK] ParseSiakScheduleHTML error (%s): %v\n", targetURL, err)
			continue
		}
		if len(schedules) == 0 {
			fmt.Printf("[SIAK] FetchSchedule: halaman OK tapi 0 jadwal ter-parse dari %s, coba URL lain...\n", targetURL)
			continue
		}
		fmt.Printf("[SIAK] FetchSchedule: berhasil parse %d jadwal dari %s\n", len(schedules), targetURL)
		return schedules, nil
	}

	fmt.Printf("[SIAK] FetchSchedule: tidak ada URL yang menghasilkan jadwal — perlu debug HTML manual\n")
	return []models.SiakSchedule{}, nil
}

// FetchExams mengambil halaman jadwal ujian dan mem-parsing-nya
func (s *SiakSession) FetchExams() ([]models.SiakExam, error) {
	candidateURLs := []string{
		siakExamURL,
		siakBaseURL + "index.php?page=ujn",
		siakBaseURL + "index.php?page=ujian_mhs",
		siakBaseURL + "index.php?page=ujianmhs",
	}

	for _, targetURL := range candidateURLs {
		bodyStr := s.fetchPage(targetURL)
		if bodyStr == "" {
			continue
		}
		exams, err := ParseSiakExamsHTML(bodyStr)
		if err != nil {
			fmt.Printf("[SIAK] ParseSiakExamsHTML error (%s): %v\n", targetURL, err)
			continue
		}
		if len(exams) == 0 {
			fmt.Printf("[SIAK] FetchExams: halaman OK tapi 0 ujian ter-parse dari %s, coba URL lain...\n", targetURL)
			continue
		}
		fmt.Printf("[SIAK] FetchExams: berhasil parse %d ujian dari %s\n", len(exams), targetURL)
		return exams, nil
	}

	fmt.Printf("[SIAK] FetchExams: tidak ada URL yang menghasilkan data ujian — perlu debug HTML manual\n")
	return []models.SiakExam{}, nil
}

// ParseSiakScheduleHTML mem-parsing tabel HTML jadwal kuliah SIAK Wicida (page=mkrs)
func ParseSiakScheduleHTML(htmlContent string) ([]models.SiakSchedule, error) {
	doc, err := html.Parse(strings.NewReader(htmlContent))
	if err != nil {
		return nil, fmt.Errorf("gagal memproses HTML jadwal: %v", err)
	}

	var schedules []models.SiakSchedule

	var parseNode func(*html.Node)
	parseNode = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "tr" {
			var cells []*html.Node
			for c := n.FirstChild; c != nil; c = c.NextSibling {
				if c.Type == html.ElementNode && c.Data == "td" {
					cells = append(cells, c)
				}
			}

			// Format SIAK Wicida page=mkrs: Memiliki 8 kolom
			// Col 0: No | Col 1: Hari | Col 2: Jam Mulai | Col 3: Ruangan | Col 4: Kode | Col 5: Nama Matkul | Col 6: Kelas | Col 7: SKS
			if len(cells) >= 6 {
				col0 := strings.TrimSpace(getInnerText(cells[0]))
				if _, numErr := strconv.Atoi(col0); numErr == nil {
					hari := strings.TrimSpace(getInnerText(cells[1]))
					jamMulai := strings.TrimSpace(getInnerText(cells[2]))
					ruangan := strings.TrimSpace(getInnerText(cells[3]))
					kode := strings.TrimSpace(getInnerText(cells[4]))
					nama := strings.TrimSpace(getInnerText(cells[5]))

					sks := 0
					if len(cells) >= 8 {
						sksText := strings.TrimSpace(getInnerText(cells[7]))
						sks, _ = strconv.Atoi(sksText)
					}

					// Normalisasi jam
					if jamMulai != "" {
						jamMulai = strings.ReplaceAll(jamMulai, ".", ":")
					}

					// Hitung perkiraan jam selesai jika SKS > 0 (1 SKS = 50 menit)
					jamSelesai := ""
					if jamMulai != "" {
						var h, m int
						if _, err := fmt.Sscanf(jamMulai, "%d:%d", &h, &m); err == nil {
							durationMinutes := 100 // Default 2 SKS = 100 menit
							if sks > 0 {
								durationMinutes = sks * 50
							}
							totalMinutes := h*60 + m + durationMinutes
							jamSelesai = fmt.Sprintf("%02d:%02d", (totalMinutes/60)%24, totalMinutes%60)
						}
					}
					if jamSelesai == "" {
						jamSelesai = "10:00"
					}

					if nama != "" {
						if hari == "" {
							hari = "Lainnya"
						} else {
							hari = strings.Title(strings.ToLower(hari))
						}

						schedules = append(schedules, models.SiakSchedule{
							KodeMatkul: kode,
							NamaMatkul: nama,
							Hari:       hari,
							JamMulai:   jamMulai,
							JamSelesai: jamSelesai,
							Ruangan:    ruangan,
							Dosen:      "",
							SKS:        sks,
						})
					}
				}
			}
		}

		for c := n.FirstChild; c != nil; c = c.NextSibling {
			parseNode(c)
		}
	}

	parseNode(doc)
	return schedules, nil
}

// ParseSiakExamsHTML mem-parsing tabel HTML jadwal ujian SIAK
func ParseSiakExamsHTML(htmlContent string) ([]models.SiakExam, error) {
	doc, err := html.Parse(strings.NewReader(htmlContent))
	if err != nil {
		return nil, fmt.Errorf("gagal memproses HTML ujian: %v", err)
	}

	var exams []models.SiakExam
	dateRegex := regexp.MustCompile(`(\d{1,2})[-/\s]+([A-Za-z]+|\d{1,2})[-/\s]+(\d{4})`)
	timeRegex := regexp.MustCompile(`(\d{1,2}[:.]\d{2})\s*[-–—]\s*(\d{1,2}[:.]\d{2})`)

	idMonthMap := map[string]string{
		"jan": "01", "januari": "01",
		"feb": "02", "februari": "02",
		"mar": "03", "maret": "03",
		"apr": "04", "april": "04",
		"mei": "05",
		"jun": "06", "juni": "06",
		"jul": "07", "juli": "07",
		"agu": "08", "agustus": "08", "agt": "08",
		"sep": "09", "september": "09",
		"okt": "10", "oktober": "10",
		"nov": "11", "november": "11",
		"des": "12", "desember": "12",
	}

	var parseNode func(*html.Node)
	parseNode = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "tr" {
			var cells []*html.Node
			for c := n.FirstChild; c != nil; c = c.NextSibling {
				if c.Type == html.ElementNode && c.Data == "td" {
					cells = append(cells, c)
				}
			}

			if len(cells) >= 4 {
				var kode, nama, jamMulai, jamSelesai, ruangan, jenisUjian string
				var tglUjian *time.Time

				for _, cell := range cells {
					txt := strings.TrimSpace(getInnerText(cell))
					if strings.Contains(strings.ToUpper(txt), "UTS") {
						jenisUjian = "UTS"
					} else if strings.Contains(strings.ToUpper(txt), "UAS") {
						jenisUjian = "UAS"
					}

					if timeRegex.MatchString(txt) && jamMulai == "" {
						m := timeRegex.FindStringSubmatch(txt)
						if len(m) >= 3 {
							jamMulai = strings.ReplaceAll(m[1], ".", ":")
							jamSelesai = strings.ReplaceAll(m[2], ".", ":")
						}
					}

					if dateRegex.MatchString(txt) && tglUjian == nil {
						m := dateRegex.FindStringSubmatch(txt)
						if len(m) >= 4 {
							dayStr := fmt.Sprintf("%02s", m[1])
							monthRaw := strings.ToLower(m[2])
							yearStr := m[3]

							monthStr := monthRaw
							if mapped, ok := idMonthMap[monthRaw]; ok {
								monthStr = mapped
							} else if num, err := strconv.Atoi(monthRaw); err == nil {
								monthStr = fmt.Sprintf("%02d", num)
							}

							dateFormatted := fmt.Sprintf("%s-%s-%s", yearStr, monthStr, dayStr)
							parsed, err := time.Parse("2006-01-02", dateFormatted)
							if err == nil {
								tglUjian = &parsed
							}
						}
					}

					// Detect room column (contains "Ruang", "Lab", "R.", "L. ", etc)
					txtUpper := strings.ToUpper(txt)
					if ruangan == "" && (strings.Contains(txtUpper, "RUANG") || strings.Contains(txtUpper, "LAB") || strings.HasPrefix(txtUpper, "R.") || strings.HasPrefix(txtUpper, "L.")) {
						ruangan = txt
					}
				}

				if len(cells) >= 3 {
					col0 := strings.TrimSpace(getInnerText(cells[0]))
					// Check if row starts with row index number or valid exam record
					if _, numErr := strconv.Atoi(col0); numErr == nil {
						kode = strings.TrimSpace(getInnerText(cells[1]))
						nama = strings.TrimSpace(getInnerText(cells[2]))
					} else {
						kode = col0
						nama = strings.TrimSpace(getInnerText(cells[1]))
					}
				}

				if jenisUjian == "" {
					jenisUjian = "UJIAN"
				}

				if nama != "" && kode != "" && (tglUjian != nil || jamMulai != "") {
					exams = append(exams, models.SiakExam{
						KodeMatkul:   kode,
						NamaMatkul:   nama,
						TanggalUjian: tglUjian,
						JamMulai:     jamMulai,
						JamSelesai:   jamSelesai,
						Ruangan:      ruangan,
						JenisUjian:   jenisUjian,
					})
				}
			}
		}

		for c := n.FirstChild; c != nil; c = c.NextSibling {
			parseNode(c)
		}
	}

	parseNode(doc)
	return exams, nil
}
