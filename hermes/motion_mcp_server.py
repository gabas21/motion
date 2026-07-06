#!/usr/bin/env python3
"""
Motion MCP Server — Mengekspos tools Motion Backend ke Hermes Agent.

Perbaikan dari audit:
- Menggunakan X-Internal-Secret header untuk auth (bukan X-User-ID polos)
- Semua call ke /api/internal/ yang memerlukan auth proper
- user_id dikirim via X-User-ID header (diparse sebagai UUID di middleware Go)

Cara menjalankan:
    pip install -r requirements.txt
    MOTION_INTERNAL_SECRET=<secret> python motion_mcp_server.py

Atau via Docker (lihat docker-compose.yml untuk konfigurasi):
    docker compose up hermes-agent
"""

import os
import json
import asyncio
import logging
from typing import Optional
from mcp.server.fastmcp import FastMCP
import httpx

# ─── Konfigurasi ──────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="[MCP] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

MOTION_API_BASE = os.environ.get("MOTION_API_URL", "http://backend-go:8080/api/v1")
INTERNAL_SECRET = os.environ.get("MOTION_INTERNAL_SECRET", "")
INTERNAL_ENDPOINT = f"{MOTION_API_BASE}/internal"

if not INTERNAL_SECRET:
    logger.warning(
        "⚠️  MOTION_INTERNAL_SECRET tidak dikonfigurasi! "
        "Set environment variable ini sebelum menjalankan server."
    )

# ─── FastMCP Server ───────────────────────────────────────────────────────────

mcp = FastMCP(
    name="Motion Scheduler",
    description="Tools untuk mengelola tugas, jadwal, dan AI asisten Motion App",
)

# ─── Helper ───────────────────────────────────────────────────────────────────


def _internal_headers(user_id: str) -> dict:
    """
    Membangun headers untuk request ke endpoint internal Motion.
    X-Internal-Secret: auth bypass JWT (hanya valid dari Docker network)
    X-User-ID: UUID user yang sedang diakses
    """
    return {
        "X-Internal-Secret": INTERNAL_SECRET,
        "X-User-ID": user_id,
        "Content-Type": "application/json",
    }


async def _get(path: str, user_id: str, params: dict = None) -> dict:
    """Helper GET request ke internal endpoint."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{INTERNAL_ENDPOINT}{path}",
            headers=_internal_headers(user_id),
            params=params or {},
        )
        resp.raise_for_status()
        return resp.json()


async def _post(path: str, user_id: str, body: dict = None) -> dict:
    """Helper POST request ke internal endpoint."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{INTERNAL_ENDPOINT}{path}",
            headers=_internal_headers(user_id),
            json=body or {},
        )
        resp.raise_for_status()
        return resp.json()


# ─── Tools ────────────────────────────────────────────────────────────────────


@mcp.tool()
async def get_pending_tasks(user_id: str) -> str:
    """
    Mengambil semua tugas yang belum selesai (status: pending) milik user dari Motion.
    
    Args:
        user_id: UUID user di Motion (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    
    Returns:
        JSON string berisi daftar tugas pending beserta detail (deadline, prioritas, estimasi waktu).
    """
    try:
        result = await _get("/tasks", user_id, params={"status": "pending", "limit": "50"})
        return json.dumps(result, ensure_ascii=False, indent=2)
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"HTTP {e.response.status_code}: {e.response.text}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
async def create_task(
    user_id: str,
    title: str,
    priority: int = 3,
    due_date: str = "",
    category: str = "general",
    estimate_minutes: int = 30,
    description: str = "",
) -> str:
    """
    Membuat tugas baru di Motion Scheduler untuk user tertentu.
    
    Args:
        user_id: UUID user di Motion
        title: Judul tugas (wajib)
        priority: Tingkat prioritas 1-5 (1=terendah, 5=tertinggi, default=3)
        due_date: Tanggal deadline dalam format ISO 8601 (contoh: "2026-06-25T17:00:00Z"), kosong = tanpa deadline
        category: Kategori tugas (contoh: "academic", "personal", "work", default="general")
        estimate_minutes: Estimasi waktu pengerjaan dalam menit (default=30)
        description: Deskripsi tugas (opsional)
    
    Returns:
        JSON string berisi data tugas yang berhasil dibuat.
    """
    try:
        body = {
            "title": title,
            "priority": priority,
            "category": category,
            "timeEstimateMinutes": estimate_minutes,
        }
        if due_date:
            body["dueDate"] = due_date
        if description:
            body["description"] = description

        result = await _post("/tasks", user_id, body)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"HTTP {e.response.status_code}: {e.response.text}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
async def trigger_ai_schedule(user_id: str) -> str:
    """
    Memicu ulang AI auto-scheduler Motion untuk mengoptimalkan semua tugas pending.
    Scheduler akan menyusun urutan dan slot waktu optimal berdasarkan prioritas dan deadline.
    
    Args:
        user_id: UUID user di Motion
    
    Returns:
        JSON string berisi hasil auto-scheduling (jumlah tugas yang dijadwalkan, dll).
    """
    try:
        result = await _post("/scheduling/trigger", user_id)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"HTTP {e.response.status_code}: {e.response.text}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
async def schedule_study_block(
    user_id: str,
    task_id: str,
    start_time: str,
    end_time: str,
) -> str:
    """
    Menjadwalkan waktu belajar mandiri (study block) untuk tugas tertentu di kalender pengguna.
    
    Args:
        user_id: UUID user di Motion
        task_id: UUID tugas yang ingin dijadwalkan
        start_time: Tanggal & waktu mulai dalam format ISO 8601 (contoh: "2026-07-02T19:30:00Z")
        end_time: Tanggal & waktu selesai dalam format ISO 8601 (contoh: "2026-07-02T21:00:00Z")
    
    Returns:
        JSON string berisi informasi tugas yang berhasil dijadwalkan.
    """
    try:
        body = {
            "taskId": task_id,
            "startTime": start_time,
            "endTime": end_time,
        }
        result = await _post("/scheduling/study-block", user_id, body)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"HTTP {e.response.status_code}: {e.response.text}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
async def complete_task_via_ai(user_id: str, task_id: str) -> str:
    """
    Menandai tugas tertentu sebagai selesai (status: completed) di Motion.
    
    Args:
        user_id: UUID user di Motion
        task_id: UUID tugas yang ingin diselesaikan
    
    Returns:
        JSON string berisi detail tugas setelah ditandai selesai.
    """
    try:
        body = {
            "taskId": task_id,
        }
        result = await _post("/tasks/complete", user_id, body)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"HTTP {e.response.status_code}: {e.response.text}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
async def ask_asep(user_id: str, message: str, personality: str = "productive") -> str:
    """
    Mengirim pesan ke Asep AI (asisten Motion) dan mendapat balasan.
    Asep mengingat percakapan sebelumnya secara otomatis.
    
    Args:
        user_id: UUID user di Motion
        message: Pesan yang ingin dikirim ke Asep
        personality: Gaya komunikasi Asep — "productive" (formal+efisien), "bestie" (casual), "academic" (pelajar)
    
    Returns:
        String berisi balasan Asep AI.
    """
    try:
        body = {
            "message": message,
            "personality": personality,
            "history": [],  # Asep load history dari DB secara otomatis
        }
        result = await _post("/ai/chat", user_id, body)
        # Response dari handler chat berisi field "reply"
        if isinstance(result, dict):
            return result.get("reply", result.get("message", json.dumps(result)))
        return str(result)
    except httpx.HTTPStatusError as e:
        return f"Error {e.response.status_code}: {e.response.text}"
    except Exception as e:
        return f"Error: {str(e)}"


@mcp.tool()
async def get_welearn_assignments(user_id: str, course_id: str = "") -> str:
    """
    Mengambil daftar tugas WeLearn (Moodle/LMS) milik user.
    WeLearn adalah platform e-learning kampus yang terintegrasi dengan Motion.
    
    Args:
        user_id: UUID user di Motion
        course_id: ID mata kuliah tertentu (opsional, kosong = semua mata kuliah)
    
    Returns:
        JSON string berisi daftar tugas WeLearn beserta deadline dan status submit.
    """
    try:
        # WeLearn endpoint masih pakai JWT auth, tidak via internal endpoint
        # Untuk sementara, gunakan endpoint Moodle yang sudah ada
        # TODO: Tambahkan ke internal endpoint jika diperlukan
        return json.dumps({
            "note": "WeLearn assignments tersedia via endpoint /api/v1/moodle/assignments (butuh JWT user). "
                    "Gunakan get_pending_tasks untuk melihat tugas WeLearn yang sudah disinkronkan ke Motion."
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("🚀 Motion MCP Server dimulai...")
    logger.info(f"   Motion API: {MOTION_API_BASE}")
    logger.info(f"   Internal Secret: {'✅ Dikonfigurasi' if INTERNAL_SECRET else '❌ TIDAK DIKONFIGURASI'}")
    mcp.run()
