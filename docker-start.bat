@echo off
setlocal enabledelayedexpansion
title Motion Docker Orchestrator
color 0A

:menu
cls
echo ====================================================
echo          MOTION APP DOCKER ORCHESTRATOR
echo ====================================================
echo.
echo [1] Build and Start DEV (Hot-Reload) Mode (docker compose up -d --build)
echo [2] Start DEV (Hot-Reload) Mode (docker compose up -d)
echo [3] Build and Start PROD (Standalone) Mode (docker compose -f docker-compose.yml up -d --build)
echo [4] Start PROD (Standalone) Mode (docker compose -f docker-compose.yml up -d)
echo [5] Stop Containers (docker compose down)
echo [6] View Container Status (docker compose ps)
echo [7] View Backend Logs (docker compose logs backend-go)
echo [8] View Frontend Logs (docker compose logs frontend-next)
echo [9] View ML Service Logs (docker compose logs ml-service-python)
echo [10] Restart Containers (docker compose restart)
echo [11] Clean Volumes and Cache (docker compose down -v)
echo [12] Exit
echo.

set /p choice="Pilih opsi [1-12]: "

if "%choice%"=="1" (
    echo [INFO] Membangun dan menjalankan kontainer Docker [Mode DEV - Hot Reload]...
    docker compose up -d --build
    echo.
    echo [+] Frontend UI  : http://localhost:3000
    echo [+] Go Backend   : http://localhost:8080
    echo [+] Python ML API: http://localhost:8000/docs
    echo [+] Mailpit WebUI: http://localhost:8025
    echo.
    pause
    goto menu
)

if "%choice%"=="2" (
    echo [INFO] Menjalankan kontainer Docker [Mode DEV - Hot Reload]...
    docker compose up -d
    pause
    goto menu
)

if "%choice%"=="3" (
    echo [INFO] Membangun dan menjalankan kontainer Docker [Mode PROD]...
    docker compose -f docker-compose.yml up -d --build
    echo.
    echo [+] Frontend UI  : http://localhost:3000
    echo [+] Go Backend   : http://localhost:8080
    echo [+] Python ML API: http://localhost:8000/docs
    echo [+] Mailpit WebUI: http://localhost:8025
    echo.
    pause
    goto menu
)

if "%choice%"=="4" (
    echo [INFO] Menjalankan kontainer Docker [Mode PROD]...
    docker compose -f docker-compose.yml up -d
    pause
    goto menu
)

if "%choice%"=="5" (
    echo [INFO] Menghentikan kontainer Docker...
    docker compose down
    pause
    goto menu
)

if "%choice%"=="6" (
    echo [INFO] Memeriksa status kontainer...
    docker compose ps
    pause
    goto menu
)

if "%choice%"=="7" (
    docker compose logs -f backend-go
    goto menu
)

if "%choice%"=="8" (
    docker compose logs -f frontend-next
    goto menu
)

if "%choice%"=="9" (
    docker compose logs -f ml-service-python
    goto menu
)

if "%choice%"=="10" (
    echo [INFO] Merestart kontainer...
    docker compose restart
    pause
    goto menu
)

if "%choice%"=="11" (
    echo [WARNING] Menghapus kontainer beserta volumes [Seluruh database cache / upload lokal akan hilang]...
    set /p confirm="Apakah Anda yakin? (Y/N): "
    if /i "!confirm!"=="y" (
        docker compose down -v
    )
    pause
    goto menu
)

if "%choice%"=="12" (
    exit /b 0
)

goto menu
