import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (message: string, type: ToastType, duration?: number) => void;
  dismissToast: (id: string) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }],
    }));
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  success: (message, duration) => {
    useToast.getState().addToast(message, 'success', duration);
  },
  error: (message, duration) => {
    useToast.getState().addToast(message, 'error', duration);
  },
  info: (message, duration) => {
    useToast.getState().addToast(message, 'info', duration);
  },
  warning: (message, duration) => {
    useToast.getState().addToast(message, 'warning', duration);
  },
}));

export const toast = {
  success: (message: string, duration?: number) => useToast.getState().success(message, duration),
  error: (message: string, duration?: number) => useToast.getState().error(message, duration),
  info: (message: string, duration?: number) => useToast.getState().info(message, duration),
  warning: (message: string, duration?: number) => useToast.getState().warning(message, duration),
};
