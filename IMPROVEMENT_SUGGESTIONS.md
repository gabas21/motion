# 🛠️ Motion Project — Saran Perbaikan Komprehensif

> Dokumen ini berisi analisis mendalam dan saran konkret untuk meningkatkan kualitas,
> keamanan, dan maintainability project Motion secara keseluruhan.
>
> **Dibuat:** 2026-06-08  
> **Prioritas:** 🔴 Kritis · 🟠 Tinggi · 🟡 Sedang · 🟢 Rendah

---

## 📋 Daftar Isi

1. [Keamanan (Security)](#1-keamanan-security)
2. [Arsitektur & Struktur](#2-arsitektur--struktur)
3. [Backend (Go)](#3-backend-go)
4. [ML Service (Python)](#4-ml-service-python)
5. [Frontend (Next.js)](#5-frontend-nextjs)
6. [DevOps & Deployment](#6-devops--deployment)
7. [Kode & Best Practices](#7-kode--best-practices)
8. [Teknis Moodle/WeLearn](#8-teknis-moodlewelearn)
9. [Quick Wins — Bisa Dikerjakan Hari Ini](#9-quick-wins--bisa-dikerjakan-hari-ini)

---

## 1. Keamanan (Security)

### 🔴 KRITIS — `InsecureSkipVerify: true` di AI Service

**File:** `backend/services/ai_service.go` (baris ~120)

**Masalah:**
```go
TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec
```
Ini menonaktifkan verifikasi sertifikat TLS. Artinya koneksi ke Gemini/OpenRouter
bisa di-intercept oleh Man-in-the-Middle tanpa terdeteksi. Bahaya di production.

**Solusi:**
```go
// Untuk development lokal Laragon yang punya self-signed cert,
// gunakan environment variable sebagai toggle — JANGAN hardcode.
tlsConfig := &tls.Config{}
if os.Getenv("SERVER_ENV") == "development" {
    tlsConfig.InsecureSkipVerify = true // hanya dev!
    log.Println("[WARN] TLS verification disabled — development mode only!")
}

httpClient: &http.Client{
    Timeout: 35 * time.Second,
    Transport: &http.Transport{
        TLSClientConfig: tlsConfig,
    },
}
```

---

### 🔴 KRITIS — Token OAuth Kalender Disimpan Plain Text (atau Encryption Lemah)

**File:** `backend/models/` + `backend/handlers/calendar.go`

**Masalah:** `access_token` dan `refresh_token` Google/Outlook disimpan di database.
Jika database bocor, seluruh akses kalender semua user ikut bocor.

**Solusi:**
- Gunakan **envelope encryption**: enkripsi token dengan AES-256-GCM menggunakan
  key yang disimpan di environment variable (atau AWS KMS / HashiCorp Vault di production).
- Untuk MVP: minimal gunakan `AES-256-GCM` dengan key dari `JWT_SECRET` + salt per-user.

```go
// pkg/utils/encryption.go — tambahkan fungsi ini
func EncryptAESGCM(plaintext, key []byte) ([]byte, error) { ... }
func DecryptAESGCM(ciphertext, key []byte) ([]byte, error) { ... }
```

---

### 🟠 TINGGI — Password WeLearn Disimpan di Database

**File:** `backend/handlers/moodle_handler.go` (baris ~59)

**Masalah:** Password WeLearn user dienkripsi lalu disimpan di database.
Menyimpan password pihak ketiga — walau terenkripsi — adalah risiko besar.

**Solusi Ideal:** Gunakan **session token** (simpan cookie/session Moodle, bukan password).  
**Solusi Realistis:** Pastikan encryption key-nya:
- Dirotasi secara berkala
- Tidak sama dengan `JWT_SECRET`
- Disimpan di env, bukan di kode

---

### 🟠 TINGGI — JWT Secret Lemah di `.env.example`

**File:** `backend/.env.example`

```
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
```

Banyak developer lupa mengganti ini. Tambahkan validasi saat startup:

```go
// config/config.go
func LoadConfig() {
    // ...
    if cfg.JWTSecret == "" || cfg.JWTSecret == "your_super_secret_jwt_key_change_this_in_production" {
        log.Fatal("[FATAL] JWT_SECRET belum dikonfigurasi! Ganti di file .env sebelum menjalankan server.")
    }
    if len(cfg.JWTSecret) < 32 {
        log.Fatal("[FATAL] JWT_SECRET terlalu pendek — minimal 32 karakter.")
    }
}
```

---

### 🟡 SEDANG — Rate Limiting Belum Ada di Endpoint Sensitif

**Masalah:** Endpoint `/api/v1/auth/login`, `/api/v1/auth/register`, dan `/api/v1/ai/chat`
tidak memiliki rate limiting. Rentan terhadap brute force dan abuse.

**Solusi:** Gunakan middleware rate limiter dari Echo:
```go
import "github.com/labstack/echo/v4/middleware"

// Untuk auth endpoints — ketat
authGroup.Use(middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(10))) // 10 req/detik

// Untuk AI chat — lebih longgar tapi tetap dibatasi
aiGroup.Use(middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(3))) // 3 req/detik
```

---

## 2. Arsitektur & Struktur

### 🟠 TINGGI — Scope Creep: Moodle Tidak Ada di Blueprint

**Masalah:** WeLearn/Moodle integration (`welearn_ajax_client.go` 27KB,
`welearn_rest_client.go` 22KB, `welearn_scraper.go`) adalah fitur besar yang
tidak terdokumentasi di blueprint dan memperbesar kompleksitas secara signifikan.

**Saran:**
```
motion/
├── backend/          ← Core Motion app (tasks, calendar, AI)
└── welearn-addon/    ← Pisahkan sebagai modul/service tersendiri
    ├── scraper.go
    ├── ajax_client.go
    └── rest_client.go
```

Atau setidaknya buat **package terpisah** di dalam backend:
```
backend/
└── integrations/
    └── welearn/
        ├── ajax_client.go
        ├── rest_client.go
        └── scraper.go
```

---

### 🟡 SEDANG — Tidak Ada Interface/Abstraction untuk AI Provider

**File:** `backend/services/ai_service.go`

**Masalah:** Logic Gemini dan OpenRouter langsung di-implement di `HermesAgent`.
Kalau mau ganti AI provider, harus ubah banyak tempat.

**Solusi:** Definisikan interface:
```go
// services/ai_provider.go
type AIProvider interface {
    Chat(ctx context.Context, input AIChatInput) (string, error)
}

type GeminiProvider struct { client *genai.Client }
type OpenRouterProvider struct { client *http.Client }

// HermesAgent hanya orchestrate
type HermesAgent struct {
    primary  AIProvider
    fallback AIProvider
}
```

---

### 🟡 SEDANG — Folder Backup Di-commit ke Repository

**Masalah:**
```
app_backup_temp/
hooks_backup_temp/
lib_backup_temp/
```
Tiga folder backup ada di root project. Ini menandakan tidak ada workflow Git yang proper.

**Solusi Segera:**
```bash
# Hapus folder backup dari tracking
git rm -r --cached app_backup_temp hooks_backup_temp lib_backup_temp

# Tambahkan ke .gitignore
echo "*_backup_temp/" >> .gitignore
echo "*_backup/" >> .gitignore
git commit -m "chore: remove backup folders from tracking"
```

**Workflow yang Benar:**
```bash
# Sebelum refactor besar, buat branch — BUKAN copy folder
git checkout -b refactor/hooks-restructure
```

---

## 3. Backend (Go)

### 🟠 TINGGI — Error Handling Tidak Konsisten di Moodle Handler

**File:** `backend/handlers/moodle_handler.go` (baris ~246)

```go
// MASALAH: Tidak ada error handling!
h.DB.Where("user_id = ?", userID).Delete(&models.MoodleConnection{})
h.DB.Where("user_id = ?", userID).Delete(&models.MoodleAssignment{})
h.DB.Where("user_id = ?", userID).Delete(&models.MoodleCourse{})
```

**Solusi:**
```go
if err := h.DB.Where("user_id = ?", userID).Delete(&models.MoodleConnection{}).Error; err != nil {
    log.Printf("[Moodle-Disconnect-Warn] Gagal hapus connection: %v", err)
    return utils.JSONError(c, http.StatusInternalServerError, "Gagal memutus koneksi WeLearn")
}
// dst...
```

---

### 🟡 SEDANG — `userID` Type Assertion Berulang di Setiap Handler

**Masalah:** Di hampir setiap handler ada kode duplikat ini:
```go
userIDVal := c.Get("userId")
userID, ok := userIDVal.(uuid.UUID)
if !ok {
    return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
}
```

**Solusi:** Buat helper function di middleware atau utils:
```go
// pkg/utils/context.go
func GetUserID(c echo.Context) (uuid.UUID, error) {
    val := c.Get("userId")
    id, ok := val.(uuid.UUID)
    if !ok {
        return uuid.Nil, fmt.Errorf("invalid user id in context")
    }
    return id, nil
}

// Di handler, cukup:
userID, err := utils.GetUserID(c)
if err != nil {
    return utils.JSONError(c, http.StatusUnauthorized, "Unauthorized")
}
```

---

### 🟡 SEDANG — AI Service: Tool Call Loop Hanya Handle 1 Tool

**File:** `backend/services/ai_service.go` (baris ~345)

**Masalah:** Loop tool call di `askGemini` langsung `return` setelah tool pertama.
Jika model meminta multiple tool calls, hanya yang pertama yang dieksekusi.

**Solusi:** Implementasikan agentic loop yang proper:
```go
// Buat loop maksimum N iterasi untuk mencegah infinite loop
const maxToolIterations = 5
for iteration := 0; iteration < maxToolIterations; iteration++ {
    resp, err := h.geminiClient.Models.GenerateContent(ctx, modelName, contents, cfg)
    // ...
    hasToolCall := false
    for _, candidate := range resp.Candidates {
        // handle tool calls, append to contents
        hasToolCall = true
    }
    if !hasToolCall {
        return resp.Text(), nil // Model sudah selesai
    }
}
```

---

### 🟢 RENDAH — `go.mod` Module Path Tidak Standard

**File:** `backend/go.mod`

```
module github.com/motion/backend
```

Ini akan gagal jika codebase di-push ke GitHub karena path-nya tidak valid
(repo tidak ada di `github.com/motion/backend`). Gunakan path yang sesuai:

```
module github.com/YOURUSERNAME/motion-backend
```

---

## 4. ML Service (Python)

### 🟠 TINGGI — Logistic Regression dengan 2 Data Point Bukan ML

**File:** `ml_service/main.py` (baris ~83)

**Masalah:**
```python
X_train = np.array([
    [0.0, 0.0, 0.0],  # 2 data point saja!
    [0.8, 4.0, 3.0]
])
model.fit(X_train, y_train)
model.coef_ = np.array([[4.5, 0.8, 1.2]])  # Langsung di-overwrite!
```

Ini **bukan machine learning** — ini matematika manual dengan wrapper `sklearn`.

**Solusi Option A (Jujur):** Hapus sklearn, hitung langsung dengan fungsi sederhana:
```python
def calculate_burnout_score(overdue_ratio: float, midnight_count: float, workload_density: float) -> float:
    # Formula yang sama, tapi jujur bahwa ini rule-based
    raw_score = (overdue_ratio * 45.0) + (midnight_count * 8.0) + (workload_density * 12.0)
    return max(min(raw_score, 98.0), 5.0)
```

**Solusi Option B (Benar-benar ML):** Kumpulkan data nyata dulu,
train model offline, simpan sebagai `model.pkl`, load saat startup:
```python
import joblib
model = joblib.load("models/burnout_classifier.pkl")
```

---

### 🟡 SEDANG — Tidak Ada Input Validation di ML Endpoints

**File:** `ml_service/main.py`

**Masalah:** Endpoint `/predict/burnout` menerima list tasks tanpa batas.
1000 tasks = 1000 iterasi pandas = server lambat.

**Solusi:**
```python
@app.post("/predict/burnout")
def predict_burnout(data: MLInputData):
    if len(data.tasks) > 500:
        raise HTTPException(status_code=400, detail="Maksimum 500 task per request")
    # ...
```

---

### 🟡 SEDANG — KMeans dengan `n_clusters=1` adalah Hitung Rata-rata

**File:** `ml_service/main.py` (baris ~147)

```python
kmeans = KMeans(n_clusters=1, n_init="auto", random_state=42)
```

KMeans dengan 1 cluster = menghitung **centroid** = menghitung **rata-rata**.
Ini bisa diganti dengan `np.mean()` yang jauh lebih efisien:

```python
# Ganti seluruh KMeans dengan ini:
center_hour = float(np.mean(X[:, 0]))
center_day = float(np.mean(X[:, 1]))
```

---

### 🟢 RENDAH — Tidak Ada Health Check Endpoint di ML Service

**Solusi:**
```python
@app.get("/health")
def health_check():
    return {"status": "healthy", "version": "1.0", "service": "motion-ml"}
```

Ini juga diperlukan agar `start.bat` bisa melakukan health check sebelum
melanjutkan (saat ini hanya backend Go yang di-health-check).

---

## 5. Frontend (Next.js)

### 🟠 TINGGI — `useAI.ts` Perlu Error Boundary yang Lebih Robust

**File:** `frontend/hooks/useAI.ts`

Pastikan state error tidak membuat UI freeze. Tambahkan:
```typescript
// Timeout untuk AI requests — jangan biarkan user menunggu selamanya
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 detik

try {
    const response = await fetch('/api/v1/ai/chat', {
        signal: controller.signal,
        // ...
    });
} catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Request timeout — AI sedang sibuk, coba lagi.');
    }
} finally {
    clearTimeout(timeoutId);
}
```

---

### 🟡 SEDANG — Environment Variables Tidak Divalidasi di Frontend

**File:** `frontend/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

**Solusi:** Tambahkan validasi di `lib/config.ts`:
```typescript
// lib/config.ts
const requiredEnvVars = ['NEXT_PUBLIC_API_URL'] as const;

for (const key of requiredEnvVars) {
    if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}

export const config = {
    apiUrl: process.env.NEXT_PUBLIC_API_URL!,
} as const;
```

---

### 🟢 RENDAH — `tsconfig.tsbuildinfo` Ter-commit ke Repository

**File:** `frontend/tsconfig.tsbuildinfo` (229KB!)

Ini adalah cache file TypeScript yang tidak perlu masuk Git.

```bash
echo "tsconfig.tsbuildinfo" >> frontend/.gitignore
git rm --cached frontend/tsconfig.tsbuildinfo
```

---

## 6. DevOps & Deployment

### 🟠 TINGGI — `start.bat` Download Binary dari Internet Tanpa Verifikasi Hash

**File:** `start.bat` (baris ~63)

```bat
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/.../mailpit.zip' -OutFile 'mailpit\mailpit.zip'"
```

**Masalah:** Tidak ada verifikasi checksum. Jika URL di-hijack atau GitHub
di-spoof, binary berbahaya bisa dijalankan.

**Solusi:**
```bat
:: Verifikasi SHA256 setelah download
set EXPECTED_HASH=abc123def456...  (hash resmi dari release notes)
powershell -Command "$hash = (Get-FileHash 'mailpit\mailpit.zip' -Algorithm SHA256).Hash; if ($hash -ne '%EXPECTED_HASH%') { Write-Error 'Hash mismatch!'; exit 1 }"
```

Atau lebih baik: **commit `mailpit.exe` ke repo** atau gunakan Docker.

---

### 🟡 SEDANG — Docker Ada Tapi Tidak Dipakai

**Masalah:** Ada `docker-compose.yml` dan 3 `Dockerfile`, tapi `start.bat`
bypass semua itu dengan menjalankan service secara langsung dan hardcode ke
path Laragon lokal.

**Solusi:** Pilih salah satu strategi dan konsisten:

**Option A — Full Docker:**
```yaml
# docker-compose.yml yang benar-benar dipakai
services:
  backend:
    build: ./backend
    ports: ["8080:8080"]
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
  ml_service:
    build: ./ml_service
    ports: ["8000:8000"]
  mailpit:
    image: axllent/mailpit  # Jangan download manual!
    ports: ["1025:1025", "8025:8025"]
```

**Option B — Native + `start.bat`:**  
Hapus `Dockerfile` dan `docker-compose.yml` kalau memang tidak akan dipakai.
Jangan biarkan file mati menyesatkan contributor baru.

---

### 🟡 SEDANG — Tidak Ada `.env.example` yang Lengkap di Root

**Masalah:** Ada `backend/.env.example` tapi tidak ada di root project.
Developer baru harus tebak-tebak.

**Solusi:** Buat `README.md` yang jelas di root dengan instruksi setup,
atau buat script setup otomatis:
```bat
:: setup.bat
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env.local
echo [OK] File .env berhasil dibuat. Silakan isi nilai yang diperlukan.
```

---

## 7. Kode & Best Practices

### 🟡 SEDANG — `debug_sync` Folder Ada di Production Backend

**File:** `backend/debug_sync/` *(folder ini ada di production backend!)*

**Saran:** Folder debug tidak boleh ada di production build.
Gunakan build tag untuk mengecualikannya:
```go
//go:build debug
// +build debug

package debug_sync
```

Atau pindahkan ke luar `backend/` dan jangan include di build.

---

### 🟡 SEDANG — Log Statement Terlalu Verbose di Production

**File:** `backend/services/ai_service.go`

```go
log.Printf("[Hermes-OpenRouter] Model: %s, Status: %d, Response Length: %d", ...)
log.Printf("[Hermes-OpenRouter] ✅ Berhasil mendapatkan jawaban menggunakan model: %s", ...)
```

Di production, ini akan spam log dan menyulitkan monitoring.

**Solusi:** Gunakan structured logging dengan level:
```go
// Gunakan slog (Go 1.21+) atau zerolog
import "log/slog"

slog.Debug("OpenRouter response received",
    "model", currentModel,
    "status", resp.StatusCode,
    "length", len(bodyBytes),
)
slog.Info("AI response success", "model", currentModel)
```

---

### 🟢 RENDAH — Nama File `Go` dan `Python` di Root Project

**Masalah:**
```
c:\laragon\www\motion\Go    ← 38 bytes
c:\laragon\www\motion\Python ← 52 bytes
```

Ada dua file aneh bernama `Go` dan `Python` di root. Isinya apa?
Kemungkinan besar file teks konfigurasi atau catatan yang tidak sengaja di-commit.

**Solusi:** Cek isinya, lalu hapus atau pindahkan ke `docs/`.

---

## 8. Teknis Moodle/WeLearn

### 🟠 TINGGI — Scraping LMS Melanggar ToS

**Masalah:** `welearn_scraper.go` dan `welearn_ajax_client.go` melakukan
**web scraping** ke LMS institusi. Ini umumnya:
- Melanggar Terms of Service Moodle
- Rentan rusak kapan saja (saat template Moodle diupdate)
- Bisa menyebabkan IP block

**Solusi Jangka Panjang:**
- Gunakan **Moodle REST API resmi** jika institusi mengizinkan:
  `https://welearn.wicida.ac.id/webservice/rest/server.php`
- Koordinasi dengan pihak kampus untuk akses API resmi
- `welearn_rest_client.go` sudah ada — prioritaskan ini!

---

### 🟡 SEDANG — Session Cache WeLearn Tidak Ada Expiry yang Jelas

**File:** `backend/services/welearn_ajax_client.go`

Pastikan session cache memiliki expiry yang jelas dan tidak menyimpan
session yang sudah kadaluarsa selamanya di memory.

---

## 9. Quick Wins — Bisa Dikerjakan Hari Ini

Ini daftar perbaikan yang bisa dilakukan dalam **< 30 menit** dan langsung berdampak:

| # | Tindakan | File | Estimasi Waktu |
|---|----------|------|----------------|
| 1 | Hapus `app_backup_temp/`, `hooks_backup_temp/`, `lib_backup_temp/` dari Git | Root | 5 menit |
| 2 | Tambahkan `tsconfig.tsbuildinfo` ke `.gitignore` | `frontend/.gitignore` | 2 menit |
| 3 | Tambahkan validasi `JWT_SECRET` di startup | `backend/config/config.go` | 10 menit |
| 4 | Bungkus `InsecureSkipVerify` dengan env check | `backend/services/ai_service.go` | 10 menit |
| 5 | Tambahkan error handling di `Disconnect()` handler | `backend/handlers/moodle_handler.go` | 15 menit |
| 6 | Buat helper `GetUserID(c echo.Context)` | `backend/pkg/utils/context.go` | 20 menit |
| 7 | Tambahkan `/health` endpoint di ML Service | `ml_service/main.py` | 5 menit |
| 8 | Hapus atau dokumentasikan file `Go` dan `Python` di root | Root | 3 menit |

---

## 📊 Ringkasan Prioritas

```
🔴 KRITIS   (Perbaiki sebelum production)
  ├── InsecureSkipVerify tanpa env guard
  └── OAuth token & WeLearn password encryption strategy

🟠 TINGGI   (Perbaiki sprint ini)
  ├── Rate limiting di endpoint sensitif
  ├── Error handling konsisten di Moodle handler
  ├── Scope WeLearn dipisahkan sebagai package tersendiri
  ├── Burnout model bukan ML sejati — jadikan rule-based yang jujur
  └── start.bat download binary tanpa hash verification

🟡 SEDANG   (Backlog prioritas)
  ├── Interface abstraction untuk AI provider
  ├── Helper GetUserID() untuk eliminasi duplikasi
  ├── Agentic tool loop yang proper di Hermes
  ├── Input validation di ML endpoints
  ├── Structured logging dengan level
  └── Docker strategy yang konsisten

🟢 RENDAH   (Nice to have)
  ├── go.mod module path yang valid
  ├── Health check endpoint di ML service
  ├── KMeans → np.mean() untuk golden hours
  └── File Go & Python di root project
```

---

## 💪 Penutup

Project ini menunjukkan **ambisi yang serius** dan **kode yang umumnya bersih**.
Hermes AI dengan multi-model fallback, WeLearn integration, dan graceful shutdown
adalah implementasi yang non-trivial dan cukup solid.

Fokus perbaikan utama adalah:
1. **Security** — jangan biarkan `InsecureSkipVerify` masuk production
2. **Scope Control** — resist the urge to add more features, polish yang ada dulu
3. **Honesty in ML** — rule-based yang jelas lebih baik dari "fake ML"
4. **Git hygiene** — backup folder tidak boleh ada di repository

> *"Make it work, make it right, make it fast."*
> — Kent Beck
>
> Lo sudah di tahap **make it work**. Sekarang saatnya **make it right**. 🚀

---

*Dokumen ini dibuat berdasarkan analisis kode pada tanggal 2026-06-08.*
*Update dokumen ini setiap kali perbaikan signifikan selesai dilakukan.*
