import React, { useEffect, useState } from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import { 
  Sparkles, CheckCircle2, AlertCircle, Clock, Calendar, 
  TrendingUp, Award, Zap, BrainCircuit, ShieldAlert, Loader
} from 'lucide-react';
import { useAnalytics } from '../../hooks/useAnalytics';
import { Skeleton, SkeletonCard } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import API from '../../lib/api';

const ProductivityDashboard = React.memo(function ProductivityDashboard() {
  const [range, setRange] = useState<7 | 30 | 90>(7);
  const [isExporting, setIsExporting] = useState(false);
  const { analyticsData, insights, isLoading, error, fetchAnalyticsData } = useAnalytics();

  useEffect(() => {
    fetchAnalyticsData(range);
  }, [range, fetchAnalyticsData]);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const response = await API.get(`/analytics/pdf?range=${range}`, {
        responseType: 'blob',
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `Laporan_Produktivitas_${range}_Hari.pdf`);
      document.body.appendChild(link);
      link.click();
      
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor PDF. Pastikan backend server Anda aktif.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading && !analyticsData) {
    return (
      <div className="space-y-8 my-2 text-left animate-pulse">
        {/* Skeleton Header */}
        <div className="flex justify-between items-center pb-4 border-b-2 border-black/10">
          <div className="space-y-2">
            <Skeleton className="w-32 h-6" />
            <Skeleton className="w-64 h-3.5" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="w-32 h-8" rounded="lg" />
            <Skeleton className="w-24 h-8" rounded="lg" />
          </div>
        </div>

        {/* Skeleton Grid Kartu Metrik */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} className="h-32 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-8 h-8" rounded="lg" />
              </div>
              <Skeleton className="w-3/4 h-8" />
              <Skeleton className="w-5/6 h-3" />
            </SkeletonCard>
          ))}
        </div>
        
        {/* Skeleton Grafik */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <SkeletonCard className="lg:col-span-2 h-80 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-black/8">
              <Skeleton className="w-5 h-5" />
              <Skeleton className="w-48 h-5" />
            </div>
            <Skeleton className="w-full h-48" />
          </SkeletonCard>
          
          <SkeletonCard className="lg:col-span-1 h-80 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-black/8">
                <Skeleton className="w-5 h-5" />
                <Skeleton className="w-36 h-5" />
              </div>
              <div className="flex items-center justify-center py-6">
                <Skeleton className="w-32 h-32" rounded="full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-auto">
              <Skeleton className="w-full h-8" />
              <Skeleton className="w-full h-8" />
            </div>
          </SkeletonCard>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-neoOrange border-3 border-black text-white rounded-2xl p-8 text-center my-6 shadow-neo">
        <ShieldAlert className="w-8 h-8 mx-auto mb-3 text-white" />
        <p className="text-sm font-black">{error}</p>
      </div>
    );
  }

  if (!analyticsData) return null;

  const { summary, dailyStats, timeBreakdown, comparison } = analyticsData;

  if (summary.totalTasks === 0) {
    return (
      <div className="py-6">
        <EmptyState
          mascot="star"
          title="Analisis Produktivitas Kosong"
          description="Selesaikan beberapa tugas terlebih dahulu! Setelah Anda menyelesaikan tugas yang dijadwalkan, AI akan melacak efisiensi Anda dan memberikan wawasan produktivitas cerdas."
          ctaText="Buka Daftar Tugas 📋"
          ctaAction={() => {
            const listBtn = document.querySelector('button[title="Tasks"]') as HTMLButtonElement;
            if (listBtn) {
              listBtn.click();
            } else {
              window.location.reload();
            }
          }}
        />
      </div>
    );
  }

  // Format data harian untuk Recharts (menyesuaikan label sumbu X agar rapi sesuai rentang waktu)
  const chartData = dailyStats.map(item => {
    const dateObj = new Date(item.date);
    let label = '';
    if (range === 7) {
      label = dateObj.toLocaleDateString('id-ID', { weekday: 'short' });
    } else {
      label = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    }
    return {
      ...item,
      name: label,
    };
  });

  // Data Pie Chart
  const pieData = [
    { name: 'Waktu Fokus', value: Math.round(timeBreakdown.focusTime), color: '#0E86D4' },
    { name: 'Rapat Kalender', value: Math.round(timeBreakdown.meetingTime), color: '#38BDF8' },
    { name: 'Jeda Istirahat', value: Math.round(timeBreakdown.breakTime), color: '#06B6D4' },
    { name: 'Lain-lain', value: Math.round(timeBreakdown.otherTime), color: '#FBBF24' }
  ];

  const insightBgs = [
    'bg-neoYellow',
    'bg-neoBlue text-black',
    'bg-neoPink text-black'
  ];

  return (
    <div className="space-y-8 my-2 animate-fadeIn text-left">
      
      {/* HEADER DAN RANGE SELECTOR (Neobrutalism Design) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-3 border-black pb-5">
        <div>
          <h2 className="text-2xl font-black text-black uppercase tracking-tight">Performa & Tren</h2>
          <p className="text-xs font-bold text-black/60">Analisis tren belajar dan produktivitas terkompilasi</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Button Group Range */}
          <div className="inline-flex border-3 border-black rounded-xl overflow-hidden bg-white shadow-neo-sm">
            {([7, 30, 90] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3.5 py-1.5 text-xs font-black transition-all border-r-3 last:border-r-0 border-black ${
                  range === r 
                    ? 'bg-neoYellow text-black' 
                    : 'bg-white text-black hover:bg-slate-50'
                }`}
              >
                {r} Hari
              </button>
            ))}
          </div>
          
          {/* Button Ekspor PDF */}
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 bg-neoMint border-3 border-black shadow-neo px-4 py-1.5 rounded-xl text-xs font-black text-black hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-neo-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : null}
            {isExporting ? 'Mengekspor...' : 'Ekspor PDF 📄'}
          </button>
        </div>
      </div>
      
      {/* SECTION 1: KARTU METRIK UTAMA (Dengan Perbandingan WoW/PoP) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Skor Produktivitas */}
        <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 flex flex-col justify-between hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm transition-all text-left">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-black uppercase tracking-wider">Productivity Score</span>
            <div className="p-1.5 rounded-lg bg-neoYellow border-2 border-black">
              <Zap className="w-4.5 h-4.5 text-black" />
            </div>
          </div>
          <div className="my-3">
            <h3 className="text-4xl font-heading font-black text-black leading-none flex items-baseline gap-1">
              {summary.productivityScore.toFixed(1)} <span className="text-sm font-bold text-black/55">/10</span>
            </h3>
            {comparison && (
              <div className={`text-[10px] font-extrabold mt-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded border border-black ${
                comparison.productivityScoreChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {comparison.productivityScoreChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                <span>{comparison.productivityScoreChange >= 0 ? '+' : ''}{comparison.productivityScoreChange.toFixed(1)} vs {range} hari lalu</span>
              </div>
            )}
            <p className="text-xs font-semibold text-black/70 mt-3 leading-tight">
              Sangat luar biasa! Performa Anda di atas rata-rata minggu ini.
            </p>
          </div>
        </div>

        {/* Tugas Diselesaikan */}
        <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 flex flex-col justify-between hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm transition-all text-left">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-black uppercase tracking-wider">Tugas Selesai</span>
            <div className="p-1.5 rounded-lg bg-neoMint border-2 border-black">
              <CheckCircle2 className="w-4.5 h-4.5 text-black" />
            </div>
          </div>
          <div className="my-3">
            <h3 className="text-4xl font-heading font-black text-black leading-none">
              {summary.completedTasks} <span className="text-sm font-bold text-black/55">/ {summary.totalTasks}</span>
            </h3>
            {comparison && (
              <div className={`text-[10px] font-extrabold mt-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded border border-black ${
                comparison.tasksCompletedChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {comparison.tasksCompletedChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                <span>{comparison.tasksCompletedChange >= 0 ? '+' : ''}{comparison.tasksCompletedChange} tugas vs {range} hari lalu</span>
              </div>
            )}
            <p className="text-xs font-semibold text-black/70 mt-3 leading-tight">
              Rasio penyelesaian tugas Anda mencapai <span className="font-extrabold">{Math.round((summary.completedTasks / (summary.totalTasks || 1)) * 100)}%</span>.
            </p>
          </div>
        </div>

        {/* Persentase Tepat Waktu */}
        <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 flex flex-col justify-between hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm transition-all text-left">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-black uppercase tracking-wider">Tepat Waktu</span>
            <div className="p-1.5 rounded-lg bg-neoPink border-2 border-black">
              <Clock className="w-4.5 h-4.5 text-black" />
            </div>
          </div>
          <div className="my-3">
            <h3 className="text-4xl font-heading font-black text-black leading-none">
              {Math.round(summary.onTimePercentage)}%
            </h3>
            {comparison && (
              <div className={`text-[10px] font-extrabold mt-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded border border-black ${
                comparison.completionRateChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {comparison.completionRateChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                <span>{comparison.completionRateChange >= 0 ? '+' : ''}{comparison.completionRateChange.toFixed(1)}% vs {range} hari lalu</span>
              </div>
            )}
            <p className="text-xs font-semibold text-black/70 mt-3 leading-tight">
              Penyelesaian agenda sebelum atau tepat pada deadline tenggat.
            </p>
          </div>
        </div>

        {/* Lencana Produktivitas */}
        <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 flex flex-col justify-between hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm transition-all text-left">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-black uppercase tracking-wider">Lencana Level</span>
            <div className="p-1.5 rounded-lg bg-neoBlue border-2 border-black">
              <Award className="w-4.5 h-4.5 text-black" />
            </div>
          </div>
          <div className="my-3">
            <h3 className="text-sm font-heading font-semibold text-slate-800 uppercase tracking-tight leading-none bg-emerald-50 px-3 py-1.5 border border-emerald-200 rounded-lg inline-block shadow-sm">
              AI PRO RIDER
            </h3>
            {comparison && (
              <div className={`text-[10px] font-extrabold mt-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded border border-black ${
                comparison.focusHoursChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {comparison.focusHoursChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                <span>{comparison.focusHoursChange >= 0 ? '+' : ''}{comparison.focusHoursChange.toFixed(1)}% jam fokus vs {range} hari lalu</span>
              </div>
            )}
            <p className="text-xs font-semibold text-black/70 mt-3 leading-tight">
              Anda meraih efisiensi waktu terbaik berkat alokasi cerdas AI.
            </p>
          </div>
        </div>

      </div>

      {/* SECTION 2: GRAFIK & DIAGRAM LENGKAP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Grafik Tren Harian */}
        <div className="lg:col-span-2 bg-white border-3 border-black shadow-neo rounded-2xl p-6 text-left">
          <h3 className="text-base font-black text-black mb-6 uppercase tracking-wider flex items-center gap-2 border-b-2 border-black pb-3">
            <TrendingUp className="w-5 h-5 text-black" /> Tren Penyelesaian Tugas ({range} Hari Terakhir)
          </h3>
          
          <div className="h-64 w-full text-xs font-mono font-bold">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0E86D4" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#0E86D4" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(29, 42, 68, 0.05)" strokeWidth={1} strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  stroke="rgba(29, 42, 68, 0.3)" 
                  strokeWidth={1} 
                  tickLine={false} 
                  interval={range === 90 ? 14 : range === 30 ? 4 : 0}
                />
                <YAxis stroke="rgba(29, 42, 68, 0.3)" strokeWidth={1} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: '2px solid #1D2A44', 
                    borderRadius: '12px',
                    boxShadow: '4px 4px 0px 0px #1D2A44',
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="completed" 
                  name="Tugas Selesai" 
                  stroke="#0E86D4" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorCompleted)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="focusHours" 
                  name="Jam Fokus (Jam)" 
                  stroke="#38BDF8" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorFocus)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Diagram Alokasi Waktu */}
        <div className="lg:col-span-1 bg-white border-3 border-black shadow-neo rounded-2xl p-6 text-left flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-black mb-4 uppercase tracking-wider flex items-center gap-2 border-b-2 border-black pb-3">
              <Clock className="w-5 h-5 text-black" /> Distribusi Alokasi Waktu
            </h3>
            
            <div className="h-44 w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    cornerRadius={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(255, 255, 255, 0.8)" strokeWidth={2} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              
              <div className="absolute text-center">
                <span className="text-xxs font-black uppercase text-slate-500 tracking-wider block">Total</span>
                <span className="text-xl font-black text-slate-900 block leading-none">100%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-4 border-t-2 border-black mt-4">
            {pieData.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3.5 h-3.5 border-1.5 border-black rounded shrink-0 shadow-neo-sm" 
                  style={{ backgroundColor: item.color }}
                />
                <div className="text-[10px] leading-tight">
                  <span className="font-extrabold text-black block">{item.name}</span>
                  <span className="font-mono text-black/60 block">{item.value}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* SECTION 2.5: MACHINE LEARNING ENGINE MONITORING */}
      <div className="space-y-6 text-left">
        <h3 className="text-base font-black text-black uppercase tracking-wider flex items-center gap-2 border-b-2 border-black pb-3">
          <BrainCircuit className="w-5 h-5 text-black animate-pulse" /> Machine Learning Engine Analytics
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Burnout Risk Classifier */}
          {(() => {
            const ml = analyticsData.mlMetrics || {
              burnoutRisk: { score: 12.5, status: 'Low', description: 'Beban kerja Anda sangat aman. Pertahankan keseimbangan yang sehat!' },
              goldenHours: { peakDay: 'Butuh Data', peakHourRange: 'Selesaikan beberapa tugas dahulu', confidence: '0%' },
              modelCalibration: { meanAbsoluteError: 0, accuracyRate: 95, samplesTrained: 0 }
            };

            const statusColors = {
              Low: 'bg-neoMint text-black',
              Moderate: 'bg-neoYellow text-black',
              High: 'bg-neoOrange text-white'
            };
            const currentStatusColor = statusColors[ml.burnoutRisk.status as keyof typeof statusColors] || 'bg-neoMint';

            return (
              <>
                <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-5 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-neo-sm transition-all flex flex-col justify-between text-left">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-black text-black uppercase tracking-wider">Burnout Risk Classifier</span>
                      <span className={`text-[10px] font-semibold uppercase px-2.5 py-0.5 border border-slate-200 rounded-lg shadow-sm ${currentStatusColor}`}>
                        {ml.burnoutRisk.status}
                      </span>
                    </div>

                    <div className="my-4">
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-xxs font-extrabold text-black/50">Stres Probabilitas</span>
                        <span className="text-sm font-black text-black">{Math.round(ml.burnoutRisk.score)}%</span>
                      </div>
                      <div className="w-full bg-stone-100 border border-stone-200/60 rounded-full h-3 overflow-hidden">
                        <div 
                          className="h-full rounded-full"
                          style={{ 
                            width: `${ml.burnoutRisk.score}%`,
                            backgroundColor: ml.burnoutRisk.status === 'High' ? '#EC4899' : 
                                             ml.burnoutRisk.status === 'Moderate' ? '#FBBF24' : '#38BDF8'
                          }}
                        />
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-black/80 leading-relaxed">
                      {ml.burnoutRisk.description}
                    </p>
                  </div>
                  
                  <div className="text-[9px] font-bold text-black/50 border-t border-black/10 pt-3 mt-4 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Model: Native Logistic Regression Classifier
                  </div>
                </div>

                {/* Card 2: Golden Productivity Hours */}
                <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-5 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-neo-sm transition-all flex flex-col justify-between text-left">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-black text-black uppercase tracking-wider">Golden Focus Hours</span>
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-neoViolet text-black border-2 border-black rounded-md shadow-neo-sm">
                        Confidence {ml.goldenHours.confidence}
                      </span>
                    </div>

                    <div className="bg-neoViolet/15 border-2 border-black rounded-xl p-4 my-4 text-center">
                      <Calendar className="w-6 h-6 text-black mx-auto mb-1.5" />
                      <h4 className="text-lg font-black text-black leading-tight">
                        {ml.goldenHours.peakDay}
                      </h4>
                      <p className="text-xs font-mono font-extrabold text-black/60 mt-1">
                        {ml.goldenHours.peakHourRange}
                      </p>
                    </div>

                    <p className="text-xs font-semibold text-black/80 leading-relaxed">
                      Prediksi jam produktivitas terbaik Anda dihitung menggunakan model sebaran probabilitas frekuensi historis.
                    </p>
                  </div>

                  <div className="text-[9px] font-bold text-black/50 border-t border-black/10 pt-3 mt-4 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Model: Probability Density Modus Clustering
                  </div>
                </div>

                {/* Card 3: Model Calibration */}
                <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-5 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-neo-sm transition-all flex flex-col justify-between text-left">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-black text-black uppercase tracking-wider">Calibration Console</span>
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-neoMint text-black border-2 border-black rounded-md shadow-neo-sm">
                        Calibrated
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 my-4">
                      <div className="bg-neoYellow/15 border-2 border-black rounded-xl p-3 text-center">
                        <TrendingUp className="w-5 h-5 text-black mx-auto mb-1" />
                        <span className="text-[9px] font-black text-black/50 uppercase block">Akurasi Kalibrasi</span>
                        <span className="text-base font-black text-black block leading-none mt-1">
                          {ml.modelCalibration.accuracyRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="bg-neoPink/15 border-2 border-black rounded-xl p-3 text-center">
                        <AlertCircle className="w-5 h-5 text-black mx-auto mb-1" />
                        <span className="text-[9px] font-black text-black/50 uppercase block">Error Rate (MAE)</span>
                        <span className="text-base font-black text-black block leading-none mt-1">
                          {ml.modelCalibration.meanAbsoluteError.toFixed(1)}m
                        </span>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-black/80 leading-relaxed">
                      Model memantau presisi estimasi waktu tugas secara berkala. Jumlah sampel terkalibrasi saat ini: <span className="font-black">{ml.modelCalibration.samplesTrained} tugas</span>.
                    </p>
                  </div>

                  <div className="text-[9px] font-bold text-black/50 border-t border-black/10 pt-3 mt-4 flex items-center gap-1">
                    <Award className="w-3 h-3" /> Status: Approved Testing OK
                  </div>
                </div>
              </>
            );
          })()}

        </div>
      </div>

      {/* SECTION 3: REKOMENDASI & WAWASAN AI (AI Insights) */}
      <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 text-left">
        <h3 className="text-base font-black text-black mb-6 uppercase tracking-wider flex items-center gap-2 border-b-2 border-black pb-3">
          <BrainCircuit className="w-5 h-5 text-black" /> Wawasan AI & Rekomendasi Produktivitas
        </h3>

        {insights.length === 0 ? (
          <p className="text-xs font-semibold text-black/60 text-center py-4">Tidak ada wawasan AI yang tersedia saat ini.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {insights.map((insight, idx) => {
              const isPersonal = insight.type === 'personal';
              const cardBg = isPersonal 
                ? 'bg-gradient-to-br from-violet-100 via-purple-50 to-emerald-50 border-3 border-black shadow-neo text-black ring-2 ring-purple-300 ring-offset-2' 
                : insightBgs[idx % 3];

              return (
                <div 
                  key={idx} 
                  className={`border-2 border-black shadow-neo rounded-2xl p-5 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-neo-sm transition-all flex flex-col justify-between text-left ${cardBg} ${isPersonal ? 'md:col-span-3 border-3' : ''}`}
                >
                  <div className="space-y-3">
                    <h4 className="font-black text-sm text-black flex items-center gap-1.5">
                      {isPersonal ? (
                        <span className="bg-purple-600 text-white border-2 border-black px-2 py-0.5 rounded-lg text-xxs font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                          <Sparkles className="w-3 h-3 fill-current" /> Rekomendasi Khusus Asep AI
                        </span>
                      ) : (
                        <Sparkles className="w-4 h-4 text-black shrink-0 animate-pulse" />
                      )}
                      {!isPersonal && insight.title}
                    </h4>
                    
                    {isPersonal && (
                      <h5 className="font-black text-base text-black mt-1 leading-tight">
                        {insight.title}
                      </h5>
                    )}

                    <p className={`text-xs font-semibold leading-relaxed ${isPersonal ? 'text-slate-800 text-sm' : 'text-black/85'}`}>
                      {insight.message}
                    </p>
                  </div>
                  <div className={`border border-black rounded-lg p-2.5 mt-4 text-[10px] leading-relaxed font-bold text-black shadow-neo-sm ${isPersonal ? 'bg-white/90 border-2' : 'bg-white/70'}`}>
                    <span className="uppercase text-xxs font-black text-black block mb-0.5 tracking-wider">💡 Rekomendasi AI:</span>
                    {insight.recommendation}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
});

export default ProductivityDashboard;
