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
	siakBaseURL   = "https://siak.wicida.ac.id/wicida.ac.id/siawicida/"
	siakLoginURL  = siakBaseURL + "index.php"
	siakGradesURL = siakBaseURL + "index.php?page=mrkp"
)

type SiakSession struct {
	client *http.Client
	nim    string
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
	formData := url.Values{
		"username": {nim}, // Biasanya field name di SIAK adalah 'username' atau 'user'
		"password": {password},
		"user":     {nim},      // Fallback fallback field names
		"pass":     {password},  // Fallback
		"login":    {"Login"},
		"Submit":   {"Login"},
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

	// Validasi apakah login sukses
	// Di sistem SIAK, jika login salah, halaman tetap memuat form login dengan error text
	// Jika sukses, biasanya muncul kata "logout", "Selamat Datang", atau menu akademik
	if strings.Contains(bodyStr, "salah") || strings.Contains(bodyStr, "Salah") ||
		(strings.Contains(bodyStr, "username") && !strings.Contains(bodyStr, "logout") && !strings.Contains(bodyStr, "LOGOUT")) {
		return nil, fmt.Errorf("NIM atau Password SIAK Anda salah")
	}

	return &SiakSession{
		client: client,
		nim:    nim,
	}, nil
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

	// Cek jika session habis / terlempar ke login page
	if strings.Contains(bodyStr, "username") && !strings.Contains(bodyStr, "logout") && !strings.Contains(bodyStr, "LOGOUT") {
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
	var currentSemester = "Lainnya"
	var totalSKS = 0
	var ipk = 0.0

	// Compile regex untuk mencari IPK dan SKS di bagian ringkasan/footer
	ipkRegex := regexp.MustCompile(`IPK\s*(?:Accumulative|Akumulatif|):\s*([0-9.,]+)|Indeks\s*Prestasi\s*Kumulatif\s*\(IPK\)\s*=\s*([0-9.,]+)|IPK\s*=\s*([0-9.,]+)`)
	sksRegex := regexp.MustCompile(`Total\s*SKS\s*(?:Lulus|Kredit|):\s*(\d+)|Total\s*SKS\s*=\s*(\d+)`)

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

				// 1. Deteksi baris semester header (biasanya memiliki colspan besar atau teks SEMESTER)
				if strings.Contains(strings.ToUpper(rowText), "SEMESTER") {
					// Bersihkan teks semester (contoh: "SEMESTER: 2024/2025 GASAL" -> "2024/2025 Gasal")
					currentSemester = cleanSemesterString(rowText)
				} else if len(cells) >= 6 {
					// 2. Parse baris nilai mata kuliah
					// Contoh format kolom SIAK: [No, Kode, Nama Matkul, SKS, Nilai Huruf, Bobot/Angka, Mutu]
					col1 := strings.TrimSpace(getInnerText(cells[0]))
					_, err := strconv.Atoi(col1)

					// Cek jika kolom pertama berupa nomor urut, berarti ini baris matkul
					if err == nil {
						kode := strings.TrimSpace(getInnerText(cells[1]))
						nama := strings.TrimSpace(getInnerText(cells[2]))
						sksStr := strings.TrimSpace(getInnerText(cells[3]))
						nilaiHuruf := strings.TrimSpace(getInnerText(cells[4]))
						nilaiAngkaStr := strings.TrimSpace(getInnerText(cells[5]))

						sks, _ := strconv.Atoi(sksStr)
						// Replace koma ke titik untuk parsing float
						nilaiAngkaStr = strings.Replace(nilaiAngkaStr, ",", ".", -1)
						nilaiAngka, _ := strconv.ParseFloat(nilaiAngkaStr, 64)

						mutu := float64(sks) * nilaiAngka

						if nama != "" && kode != "" && sks > 0 {
							grades = append(grades, models.SiakGrade{
								Semester:   currentSemester,
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

				// 3. Deteksi SKS / IPK di baris ringkasan
				if strings.Contains(rowText, "IPK") || strings.Contains(rowText, "Indeks Prestasi") {
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
				if strings.Contains(rowText, "SKS") {
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
