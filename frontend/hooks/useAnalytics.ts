import { create } from 'zustand';
import API from '../lib/api';

export interface AnalyticsSummary {
  totalTasks: number;
  completedTasks: number;
  onTimePercentage: number;
  productivityScore: number;
}

export interface DailyStatItem {
  date: string;
  completed: number;
  onTime: number;
  focusHours: number;
}

export interface TimeBreakdownItem {
  focusTime: number;
  meetingTime: number;
  breakTime: number;
  otherTime: number;
}

export interface PeriodComparison {
  completionRateChange: number;
  focusHoursChange: number;
  tasksCompletedChange: number;
  productivityScoreChange: number;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  dailyStats: DailyStatItem[];
  timeBreakdown: TimeBreakdownItem;
  mlMetrics?: MLEngineResult;
  comparison?: PeriodComparison;
}

export interface BurnoutRiskResult {
  score: number;
  status: string;
  description: string;
}

export interface GoldenHoursResult {
  peakDay: string;
  peakHourRange: string;
  confidence: string;
}

export interface ModelCalibrationResult {
  meanAbsoluteError: number;
  accuracyRate: number;
  samplesTrained: number;
}

export interface GraduationRiskResult {
  score: number;
  status: string;
  description: string;
}

export interface MLEngineResult {
  burnoutRisk: BurnoutRiskResult;
  goldenHours: GoldenHoursResult;
  modelCalibration: ModelCalibrationResult;
  graduationRisk?: GraduationRiskResult;
}

export interface InsightItem {
  type: string;
  title: string;
  message: string;
  recommendation: string;
}

interface AnalyticsState {
  analyticsData: AnalyticsData | null;
  insights: InsightItem[];
  isLoading: boolean;
  error: string | null;
  fetchAnalyticsData: (range?: number) => Promise<void>;
  clearError: () => void;
}

export const useAnalytics = create<AnalyticsState>((set) => ({
  analyticsData: null,
  insights: [],
  isLoading: false,
  error: null,

  fetchAnalyticsData: async (range: number = 7) => {
    set({ isLoading: true, error: null });
    try {
      const [analyticsRes, insightsRes] = await Promise.all([
        API.get(`/analytics/dashboard?range=${range}`),
        API.get(`/analytics/insights?range=${range}`)
      ]);
      set({ 
        analyticsData: analyticsRes.data.data, 
        insights: insightsRes.data.data || [], 
        isLoading: false 
      });
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Gagal memuat data analitik dan wawasan AI.';
      set({ error: errMsg, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
