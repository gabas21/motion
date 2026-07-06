import { create } from 'zustand';
import API from '../lib/api';

export interface CalendarConnection {
  id: string;
  userId: string;
  calendarType: string; // "google", "mock"
  calendarId: string;
  calendarName: string;
  isPrimary: boolean;
  isActive: boolean;
  lastSyncedAt: string | null;
  syncErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  externalEventId: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  calendarSource: string;
  isBusy: boolean;
}

interface CalendarState {
  connections: CalendarConnection[];
  events: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
  fetchConnections: () => Promise<void>;
  fetchEvents: (startDate?: string, endDate?: string) => Promise<void>;
  connectCalendar: (calendarType: string, authCode: string) => Promise<boolean>;
  syncCalendar: () => Promise<boolean>;
  disconnectCalendar: (id: string) => Promise<boolean>;
  clearError: () => void;
}

export const useCalendar = create<CalendarState>((set, get) => ({
  connections: [],
  events: [],
  isLoading: false,
  error: null,

  fetchConnections: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await API.get('/calendar/connections');
      set({ connections: response.data.data || [], isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Failed to load calendar integrations.', isLoading: false });
    }
  },

  fetchEvents: async (startDate, endDate) => {
    set({ isLoading: true, error: null });
    try {
      let url = '/calendar/events';
      const params: string[] = [];
      if (startDate) params.push(`start_date=${startDate}`);
      if (endDate) params.push(`end_date=${endDate}`);
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const response = await API.get(url);
      set({ events: response.data.data || [], isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Failed to fetch calendar events.', isLoading: false });
    }
  },

  connectCalendar: async (calendarType, authCode) => {
    set({ isLoading: true, error: null });
    try {
      await API.post('/calendar/connect', { calendarType, authCode });
      
      // Refresh state after successful connection
      await get().fetchConnections();
      
      // Fetch events for current timeframe
      await get().fetchEvents();
      
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Failed to connect calendar provider.', isLoading: false });
      return false;
    }
  },

  syncCalendar: async () => {
    set({ isLoading: true, error: null });
    try {
      await API.post('/calendar/sync');
      
      // Refresh connections and events
      await get().fetchConnections();
      await get().fetchEvents();
      
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Synchronization failed.', isLoading: false });
      return false;
    }
  },

  disconnectCalendar: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await API.delete(`/calendar/connections/${id}`);
      
      // Refresh connections and events
      await get().fetchConnections();
      await get().fetchEvents();
      
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Failed to disconnect calendar connection.', isLoading: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
