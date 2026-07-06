import { create } from 'zustand';
import API from '../lib/api';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  imageBase64?: string; // Opsional: gambar yang dilampirkan user
}

export type Personality = 'productive' | 'bestie' | 'academic';
export type PersonalityMode = Personality; // alias untuk backward compat

interface AIState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string, personality?: Personality, imageBase64?: string, systemHint?: string, instantMode?: boolean) => Promise<void>;
  stopRequest: () => void;
  clearChat: () => void;
}

const WELCOME_MESSAGES: Record<Personality, string> = {
  productive: 'Halo! Aku **Asep**, kating AI kamu di **Motion** ⚡\n\nAda tugas atau jadwal kuliah yang perlu kita beresin? Kasih tahu aku, kita langsung eksekusi!',
  bestie: 'Heyy! Aku **Asep**, kating AI terdekatmu di **Motion** 🧸\n\nCerita dong, hari ini gimana kuliahnya? Atau ada tugas yang bikin pusing? Aku siap dengerin dan bantu kamu!',
  academic: 'Halo! Aku **Asep**, kating asisten tutor kamu di **Motion** 📚\n\nAda soal ujian, praktikum, atau kode program yang ingin kita pelajari bareng? Upload foto soal atau ketik pertanyaanmu!',
};

const DEFAULT_WELCOME = WELCOME_MESSAGES['productive'];

let activeAbortController: AbortController | null = null;

export const useAI = create<AIState>((set, get) => ({
  messages: [
    {
      role: 'assistant',
      content: DEFAULT_WELCOME,
      timestamp: new Date(),
    },
  ],
  isLoading: false,
  error: null,

  sendMessage: async (text: string, personality: Personality = 'productive', imageBase64?: string, systemHint?: string, instantMode: boolean = false) => {
    if (!text.trim() && !imageBase64) return;

    // Tambahkan pesan user ke state
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date(),
      imageBase64,
    };

    // Riwayat 10 pesan terakhir — filter role 'system' agar tidak mencemari konteks percakapan backend.
    // Data gambar juga dikecualikan agar payload tetap ringan.
    const historyPayload = get().messages
      .filter((msg) => msg.role !== 'system')  // Fix 3.2: jangan kirim pesan sistem ke backend
      .slice(-10)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();

    set((state) => ({
      messages: [...state.messages, userMsg],
      isLoading: true,
      error: null,
    }));

    try {
      const payload: Record<string, any> = {
        message: systemHint ? `${text}\n\n${systemHint}` : text,
        history: historyPayload,
        personality,
        instant_mode: instantMode,  // Fix 2.2: kirim flag eksplisit ke backend
      };

      // Sertakan gambar jika ada (base64 string)
      if (imageBase64) {
        payload.image_base64 = imageBase64;
      }

      // Timeout 75 detik khusus untuk AI chat — lebih lama dari timeout global (10 detik)
      // karena Asep bisa melewati beberapa model fallback sebelum mendapat respons.
      const response = await API.post('/ai/chat', payload, {
        signal: activeAbortController.signal,
        timeout: 75000,
      });

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response.data?.reply || 'Maaf Kak, aku tidak bisa memikirkan jawaban saat ini. Coba kirim lagi ya!',
        timestamp: new Date(),
      };

      activeAbortController = null;

      set((state) => ({
        messages: [...state.messages, assistantMsg],
        isLoading: false,
      }));
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        // Abaikan error karena request dibatalkan secara sengaja oleh pengguna
        return;
      }

      const status = err.response?.status;
      const errMsg = err.response?.data?.error || 'Gagal terhubung dengan server Asep AI.';

      let displayMessage = `⚠️ **Gagal terhubung ke Asep AI:**\n${errMsg}\n\nMohon pastikan file \`backend/.env\` sudah dikonfigurasi dengan API key yang benar.`;

      if (status === 503) {
        displayMessage = `⚠️ **Koneksi ke Asep AI Sibuk (Rate-Limit Upstream):**\n${errMsg}\n\n` +
          `Apa yang bisa kamu coba:\n` +
          `1. Tunggu 60-120 detik lalu kirim ulang\n` +
          `2. Pastikan API Key Groq/Gemini sudah dikonfigurasi di backend/.env\n` +
          `3. Periksa status provider: http://localhost:8080/api/v1/ai/health`;
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        displayMessage = `⏱️ **Request Timeout (75 detik):**\nAsep AI membutuhkan waktu terlalu lama untuk merespons.\n\nIni biasanya terjadi saat semua model gratis sedang antre. Coba kirim ulang pesanmu!`;
      }

      set((state) => ({
        error: errMsg,
        isLoading: false,
        messages: [
          ...state.messages,
          {
            role: 'assistant',
            content: displayMessage,
            timestamp: new Date(),
          },
        ],
      }));
    }
  },

  stopRequest: () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    set((state) => ({
      isLoading: false,
      messages: [
        ...state.messages,
        {
          role: 'assistant',
          content: '⏹️ **Pencarian dihentikan oleh pengguna.**',
          timestamp: new Date(),
        },
      ],
    }));
  },

  clearChat: () =>
    set({
      messages: [
        {
          role: 'assistant',
          content: DEFAULT_WELCOME,
          timestamp: new Date(),
        },
      ],
      isLoading: false,
      error: null,
    }),
}));
