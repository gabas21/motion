import { create } from 'zustand';

/**
 * useAIChatBridge — Jembatan komunikasi antara WeLearnTab dan AIChatWidget.
 *
 * Karena kedua komponen tidak punya parent yang sama untuk prop drilling,
 * kita pakai Zustand store ringan ini sebagai "bus" state global:
 *
 *   WeLearnTab  ──openWithContext(ctx)──►  AIChatBridge  ──►  AIChatWidget
 */

interface AIBridgeState {
  /** Apakah chat widget harus dibuka */
  isOpen: boolean;
  /** Teks konteks tugas yang akan dimasukkan ke input chat */
  pendingContext: string | null;
  /** Buka chat dan isi input dengan konteks tugas */
  openWithContext: (context: string) => void;
  /** Reset bridge setelah AIChatWidget sudah membaca context */
  clearContext: () => void;
  /** Set state isOpen secara manual */
  setOpen: (open: boolean) => void;
}

export const useAIChatBridge = create<AIBridgeState>((set) => ({
  isOpen: false,
  pendingContext: null,

  openWithContext: (context: string) =>
    set({ isOpen: true, pendingContext: context }),

  clearContext: () =>
    set({ isOpen: false, pendingContext: null }),

  setOpen: (open: boolean) =>
    set({ isOpen: open }),
}));
