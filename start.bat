//Email: bagasa020@gmail.com
//Kata Sandi: AdminMotion2026!
@echo off
setlocal enabledelayedexpansion
title Motion Orchestrator
color 0B

:orchestrator_menu
cls
echo ====================================================
echo          MOTION APP PREMIUM ORCHESTRATOR
echo ====================================================
echo.
echo [1] Mulai Lingkungan Dev Lokal (Auto-Stop Docker)
echo [2] Mulai Lingkungan Docker Dev (Membuka docker-start.bat)
echo [3] Hentikan Semua Layanan Docker (Clean Up Ports)
echo [4] Keluar
echo.
set /p mode_choice="Pilih Mode [1-4]: "

if "%mode_choice%"=="2" (
    call docker-start.bat
    exit /b 0
)
if "%mode_choice%"=="3" (
    cls
    echo ====================================================
    echo        MENGHENTIKAN LAYANAN DOCKER COMPOSE
    echo ====================================================
    echo.
    echo [INFO] Menjalankan 'docker-compose down' untuk membersihkan port...
    docker-compose down
    echo.
    echo [OK] Layanan Docker dihentikan dan port berhasil dibersihkan!
    pause
    goto orchestrator_menu
)
if "%mode_choice%"=="4" (
    exit /b 0
)
if not "%mode_choice%"=="1" (
    goto orchestrator_menu
)

cls
echo ====================================================
echo          MEMULAI LINGKUNGAN DEV LOKAL
echo ====================================================
echo.

:: ────────────────────────────────────────────────────────
:: 1. CHECK DEPENDENCIES & ENVS
:: ────────────────────────────────────────────────────────
echo [INFO] Memeriksa dependensi sistem...

where go >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Go / Golang tidak terdeteksi di PATH.
    echo           Akan menggunakan backend.exe yang ada jika tersedia.
    set USE_GO_RUN=0
) else (
    echo [OK] Go / Golang terdeteksi.
    set USE_GO_RUN=1
)

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js tidak terdeteksi di PATH.
    echo         Pastikan Node.js sudah diinstal untuk menjalankan Frontend Next.js.
    pause
    exit /b 1
) else (
    echo [OK] Node.js terdeteksi.
)

set PYTHON_EXE=
if exist "C:\laragon\bin\python\python-3.13\python.exe" (
    echo [OK] Python terdeteksi [Laragon Python 3.13].
    set USE_PYTHON=1
    set PYTHON_EXE=C:\laragon\bin\python\python-3.13\python.exe
)

if "%PYTHON_EXE%"=="" (
    where python >nul 2>&1
    if errorlevel 1 (
        echo [WARNING] Python tidak terdeteksi di PATH.
        echo           Layanan Python ML Service tidak bisa dijalankan otomatis.
        echo           Sistem akan jatuh kembali - fallback - menggunakan Go Math Engine lokal.
        set USE_PYTHON=0
    ) else (
        echo [OK] Python terdeteksi.
        set USE_PYTHON=1
        set PYTHON_EXE=python
    )
)

:: Check and Download Mailpit if missing
echo [INFO] Memeriksa Mailpit SMTP Server...
if not exist "mailpit\mailpit.exe" (
    echo [WARNING] Mailpit tidak ditemukan di folder 'mailpit'.
    echo           Mengunduh Mailpit v1.30.1 dari GitHub Releases...
    if not exist "mailpit" mkdir "mailpit"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/axllent/mailpit/releases/download/v1.30.1/mailpit-windows-amd64.zip' -OutFile 'mailpit\mailpit.zip'"
    if exist "mailpit\mailpit.zip" (
        echo [INFO] Ekstraksi berkas Mailpit...
        powershell -Command "Expand-Archive -Path 'mailpit\mailpit.zip' -DestinationPath 'mailpit' -Force"
        del "mailpit\mailpit.zip"
        if exist "mailpit\mailpit.exe" (
            echo [OK] Mailpit berhasil diunduh dan dipasang di folder 'mailpit'.
        ) else (
            echo [ERROR] Gagal mengekstrak Mailpit.
        )
    ) else (
        echo [ERROR] Gagal mengunduh Mailpit.
    )
) else (
    echo [OK] Mailpit terdeteksi di folder 'mailpit'.
)

:: Auto-copy .env if missing in backend
if not exist "backend\.env" (
    if exist "backend\.env.example" (
        echo [INFO] File backend/.env tidak ditemukan. Menyalin dari .env.example...
        copy "backend\.env.example" "backend\.env" >nul
        echo [OK] File backend/.env berhasil dibuat. Silakan sesuaikan konfigurasinya jika diperlukan.
    ) else (
        echo [WARNING] File backend/.env dan .env.example tidak ditemukan.
    )
)

echo.

:: ────────────────────────────────────────────────────────
:: 2. DETECT & CLEAN PORT CONFLICTS (8080, 3000, 8000, 1025 & 8025)
:: ────────────────────────────────────────────────────────
echo [INFO] Menghentikan container Docker yang menggunakan port (jika ada)...
docker-compose down >nul 2>&1
timeout /t 1 /nobreak >nul
echo [INFO] Memeriksa konflik port lokal...

:: Check Port 1025 (Mailpit SMTP)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :1025 ^| findstr LISTENING') do (
    set MAILPIT_SMTP_PID=%%a
    echo [WARNING] Port 1025 [Mailpit SMTP] sudah digunakan oleh PID !MAILPIT_SMTP_PID!.
    echo           Menghentikan proses lama agar Mailpit baru bisa berjalan...
    taskkill /F /PID !MAILPIT_SMTP_PID! >nul 2>&1
    timeout /t 1 >nul
)

:: Check Port 8025 (Mailpit UI)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8025 ^| findstr LISTENING') do (
    set MAILPIT_UI_PID=%%a
    echo [WARNING] Port 8025 [Mailpit UI] sudah digunakan oleh PID !MAILPIT_UI_PID!.
    echo           Menghentikan proses lama agar Mailpit baru bisa berjalan...
    taskkill /F /PID !MAILPIT_UI_PID! >nul 2>&1
    timeout /t 1 >nul
)

:: Check Port 8080 (Go Backend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do (
    set BACKEND_PID=%%a
    echo [WARNING] Port 8080 sudah digunakan oleh PID !BACKEND_PID!.
    echo           Menghentikan proses lama agar backend baru bisa berjalan...
    taskkill /F /PID !BACKEND_PID! >nul 2>&1
    timeout /t 1 >nul
)

:: Check Port 3000 (Next.js Frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    set FRONTEND_PID=%%a
    echo [WARNING] Port 3000 sudah digunakan oleh PID !FRONTEND_PID!.
    echo           Menghentikan proses lama agar frontend baru bisa berjalan...
    taskkill /F /PID !FRONTEND_PID! >nul 2>&1
    timeout /t 1 >nul
)

:: Check Port 8000 (Python ML Service)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    set PY_PID=%%a
    echo [WARNING] Port 8000 sudah digunakan oleh PID !PY_PID!.
    echo           Menghentikan proses lama agar ML Service baru bisa berjalan...
    taskkill /F /PID !PY_PID! >nul 2>&1
    timeout /t 1 >nul
)

echo [OK] Semua port bersih dan siap digunakan.
echo.

:: ────────────────────────────────────────────────────────
:: 3. START BACKEND (PORT 8080)
:: ────────────────────────────────────────────────────────
echo [1/4] Memeriksa apakah perlu rebuild backend...

powershell -Command "$exe = Get-Item 'backend\backend.exe' -ErrorAction SilentlyContinue; if (!$exe) { exit 1 }; $lastGo = Get-ChildItem -Path 'backend' -Filter '*.go' -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($lastGo.LastWriteTime -gt $exe.LastWriteTime) { exit 1 } else { exit 0 }"
if %ERRORLEVEL% NEQ 0 (
    echo       [INFO] Perubahan kode terdeteksi atau backend.exe belum ada. Melakukan rebuild...
    taskkill /F /IM backend.exe >nul 2>&1
    cd backend && go build -o backend.exe . && cd ..
    if errorlevel 1 (
        echo [ERROR] Rebuild backend gagal!
        pause
        exit /b 1
    )
    echo       [OK] Backend binary berhasil di-rebuild!
) else (
    echo       [OK] Binary backend.exe masih up-to-date. Skip rebuild.
)

echo       [Mode] Precompiled Binary - backend.exe [CEPAT]
start cmd /k "title Motion Backend && cd backend && echo [Latar Belakang] Menjalankan precompiled backend.exe... && backend.exe"

:: Tunggu Backend benar-benar siap sebelum menjalankan Frontend
:: Ini mencegah race condition di mana frontend dibuka sebelum /auth/me bisa dijawab
echo [INFO] Menunggu Backend siap di port 8080...
set BACKEND_READY=0
set BACKEND_WAIT_COUNT=0
:WAIT_BACKEND_LOOP
if %BACKEND_WAIT_COUNT% GEQ 30 (
    echo [WARNING] Backend belum merespons setelah 60 detik. Lanjutkan tetap...
    goto BACKEND_DONE
)
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8080/health' -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL%==0 (
    echo [OK] Backend siap menerima request!
    set BACKEND_READY=1
    goto BACKEND_DONE
)
set /a BACKEND_WAIT_COUNT+=1
timeout /t 2 /nobreak >nul
goto WAIT_BACKEND_LOOP
:BACKEND_DONE

:: ────────────────────────────────────────────────────────
:: 4. START PYTHON ML SERVICE (PORT 8000)
:: ────────────────────────────────────────────────────────
if %USE_PYTHON%==1 (
    echo [2/4] Menjalankan Python ML dan RAG Service di port 8000...
    echo       [Mode] FastAPI Server - uvicorn main:app
    start cmd /k "title Motion ML Service && cd ml_service && echo [Latar Belakang] Menjalankan Python FastAPI... && !PYTHON_EXE! -m uvicorn main:app --port 8000 --reload"
) else (
    echo [2/4] Skip Python ML Service - Python tidak terinstal atau tidak aktif.
)

:: ────────────────────────────────────────────────────────
:: 5. START FRONTEND (PORT 3000)
:: ────────────────────────────────────────────────────────
echo [3/4] Menjalankan Frontend (Next.js) di port 3000...
:: Frontend baru dijalankan setelah backend siap (health check di atas sudah memastikan ini)
start cmd /k "title Motion Frontend && cd frontend && echo [Latar Belakang] Menjalankan Next.js Frontend... && npm run dev"

:: ────────────────────────────────────────────────────────
:: 6. START MAILPIT (PORT 1025 & 8025)
:: ────────────────────────────────────────────────────────
echo [4/4] Menjalankan Mailpit SMTP dan Web UI...
start cmd /k "title Mailpit SMTP Server && cd mailpit && echo [Latar Belakang] Menjalankan Mailpit... && mailpit.exe --smtp 0.0.0.0:1025 --listen 0.0.0.0:8025"

echo.
echo ====================================================
echo  Semua Layanan Motion sedang berjalan di latar belakang!
echo   [+] Frontend UI  : http://localhost:3000
echo   [+] Go Backend   : http://localhost:8080
echo   [+] Python ML API: http://localhost:8000/docs (Swagger UI)
echo   [+] Mailpit WebUI: http://localhost:8025
echo ====================================================
echo.
echo [TIPS] Tekan sembarang tombol di Jendela Utama ini
echo        untuk MENUTUP semua layanan secara bersih (graceful stop).
echo ====================================================
echo.

pause

echo.
echo [INFO] Menghentikan semua layanan Motion secara bersih...

:: Stop Backend
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [OK] Backend [PID %%a] dihentikan.
)

:: Stop Python ML Service
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [OK] Python ML Service [PID %%a] dihentikan.
)

:: Stop Frontend
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [OK] Frontend [PID %%a] dihentikan.
)

:: Stop Mailpit SMTP
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :1025 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [OK] Mailpit SMTP [PID %%a] dihentikan.
)

:: Stop Mailpit WebUI
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8025 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [OK] Mailpit WebUI [PID %%a] dihentikan.
)

echo [OK] Semua layanan berhasil dihentikan.
echo Sampai jumpa lagi!
timeout /t 2 >nul
exit /b 0
