'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, Calendar, Clock, Plus, Trash2, CheckCircle2, Circle, 
  LogOut, User, Folder, AlertCircle, Filter, Loader, CalendarDays,
  LayoutDashboard
} from 'lucide-react';
import dynamic from 'next/dynamic';
import StaggeredMenu from '../../components/ui/StaggeredMenu';
import { useAuth } from '../../hooks/useAuth';
import { useCalendar } from '../../hooks/useCalendar';
import { useScheduling } from '../../hooks/useScheduling';
import { useMoodle, MoodleAssignment } from '../../hooks/useMoodle';
import API from '../../lib/api';
import { BookOpen, ExternalLink } from 'lucide-react';
import OverviewTab from '../../components/Dashboard/OverviewTab';
import CustomSelect from '../../components/ui/CustomSelect';
import DatePicker from '../../components/ui/DatePicker';
import {
  DashboardHeaderSkeleton,
  TaskFormSkeleton,
  TaskListSkeleton,
  TaskItemSkeleton,
  SkeletonCard,
} from '../../components/ui/Skeleton';

// Heavy tab/widget components loaded dynamically
const WeLearnTab = dynamic(() => import('../../components/Dashboard/WeLearnTab'), {
  loading: () => <SkeletonCard className="h-[600px] animate-pulse" />,
  ssr: false
});

const CalendarView = dynamic(() => import('../../components/Calendar/CalendarView'), {
  loading: () => <SkeletonCard className="h-[500px] animate-pulse" />,
  ssr: false
});

const ExcuseLetterTab = dynamic(() => import('../../components/Dashboard/ExcuseLetterTab'), {
  loading: () => <SkeletonCard className="h-[500px] animate-pulse" />,
  ssr: false
});

const ProductivityDashboard = dynamic(() => import('../../components/Analytics/ProductivityDashboard'), {
  loading: () => <SkeletonCard className="h-[500px] animate-pulse" />,
  ssr: false
});

const IntegrationsTab = dynamic(() => import('../../components/Settings/IntegrationsTab'), {
  loading: () => <SkeletonCard className="h-[400px] animate-pulse" />,
  ssr: false
});

const ProfileTab = dynamic(() => import('../../components/Dashboard/ProfileTab'), {
  loading: () => <SkeletonCard className="h-[600px] animate-pulse" />,
  ssr: false
});

const PreferencesTab = dynamic(() => import('../../components/Settings/PreferencesTab'), {
  loading: () => <SkeletonCard className="h-[400px] animate-pulse" />,
  ssr: false
});

const BillingTab = dynamic(() => import('../../components/Dashboard/BillingTab'), {
  loading: () => <SkeletonCard className="h-[500px] animate-pulse" />,
  ssr: false
});

const AIChatWidget = dynamic(() => import('../../components/Dashboard/AIChatWidget'), {
  ssr: false
});
import { FileText } from 'lucide-react';
import { toast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/ui/Toast';
import { CheckBox } from '../../components/ui/checkbox';
import EmptyState from '../../components/ui/EmptyState';
import OnboardingWizard from '../../components/Onboarding/OnboardingWizard';
import OnboardingTooltip from '../../components/Onboarding/OnboardingTooltip';

const PRIORITY_COLORS = [
  "#1D2A44", // Priority 1 (Default)
  "#0E86D4", // Priority 2 (neoBlue)
  "#FBBF24", // Priority 3 (neoYellow)
  "#EC4899", // Priority 4 (neoPink)
  "#FF7A00"  // Priority 5 (neoOrange)
];



function parseWeLearnDescription(description: string) {
  if (!description) return { isWeLearn: false };
  const isWeLearn = description.includes('[welearn-assign-id:');
  if (!isWeLearn) return { isWeLearn: false };

  const courseMatch = description.match(/Mata Kuliah:\s*(.*)/);
  const sectionMatch = description.match(/Pertemuan\/Section:\s*(.*)/);
  const linkMatch = description.match(/Link:\s*(https?:\/\/[^\s\n]+)/);

  return {
    isWeLearn: true,
    course: courseMatch ? courseMatch[1].trim() : '',
    section: sectionMatch ? sectionMatch[1].trim() : '',
    link: linkMatch ? linkMatch[1].trim() : '',
  };
}

function cleanCourseName(name: string) {
  if (!name) return '';
  let cleaned = name.replace(/^\d{4}\/\d{4}_\d+_[A-Z0-9]+_[A-Z]+_/, '');
  cleaned = cleaned.replace(/^\d{4}\/\d{4}_\d+_\w+_/, '');
  cleaned = cleaned.replace(/_/g, ' ');
  return cleaned.trim();
}

interface Task {
  id: string;
  title: string;
  description: string;
  timeEstimateMinutes: number;
  dueDate: string | null;
  priority: number;
  status: string;
  category: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
}

const categoryOptions = [
  { value: 'work', label: 'Pekerjaan' },
  { value: 'personal', label: 'Pribadi' },
  { value: 'health', label: 'Kesehatan' },
  { value: 'education', label: 'Pendidikan' }
];

const priorityOptions = [
  { value: 1, label: '1 (Terendah)' },
  { value: 2, label: '2 (Rendah)' },
  { value: 3, label: '3 (Sedang)' },
  { value: 4, label: '4 (Tinggi)' },
  { value: 5, label: '5 (Tertinggi)' }
];

const filterStatusOptions = [
  { value: 'all', label: 'Semua Status' },
  { value: 'pending', label: 'Tertunda' },
  { value: 'completed', label: 'Selesai' }
];

const filterCategoryOptions = [
  { value: 'all', label: 'Semua Kategori' },
  { value: 'work', label: 'Pekerjaan' },
  { value: 'personal', label: 'Pribadi' },
  { value: 'health', label: 'Kesehatan' },
  { value: 'education', label: 'Pendidikan' }
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isInitialized, isAuthenticated, logout, initializeAuth, isLoading: authLoading } = useAuth();
  
  // Zustand Calendar hooks
  const { 
    events, 
    connections, 
    isLoading: calendarLoading, 
    fetchConnections, 
    fetchEvents, 
    connectCalendar, 
    syncCalendar, 
    disconnectCalendar 
  } = useCalendar();

  // Zustand Scheduling hooks (untuk memicu auto-schedule manual)
  const { triggerAutoSchedule, isLoading: schedulingLoading } = useScheduling();

  // Zustand Moodle hooks
  const { 
    status: moodleStatus, 
    fetchStatus: fetchMoodleStatus, 
    fetchAssignments: fetchMoodleAssignments,
    fetchCourses: fetchMoodleCourses
  } = useMoodle();

  // State navigasi tab
  const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'calendar' | 'analytics' | 'integrations' | 'preferences' | 'welearn' | 'excuse-letter' | 'profile' | 'billing'>('overview');

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  
  // Filter state
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Quota and plan state
  const [quota, setQuota] = useState<{
    plan: string;
    taskQuota: { used: number; limit: number };
    chatQuota: { used: number; limit: number };
  } | null>(null);

  const fetchQuota = useCallback(async () => {
    try {
      const response = await API.get('/users/quota');
      setQuota(response.data.data);
    } catch (err) {
      console.error('Gagal mengambil kuota pengguna:', err);
    }
  }, []);

  // New Task Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newEstimate, setNewEstimate] = useState(30);
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState(3);
  const [newCategory, setNewCategory] = useState('work');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [activeReminder, setActiveReminder] = useState<{ taskId: string; taskTitle: string; startTime: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState<string>('');

  // Onboarding Wizard State
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Cek apakah onboarding sudah selesai setelah autentikasi sukses
  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      const isDone = localStorage.getItem('motion_onboarding_done');
      if (!isDone) {
        setShowOnboarding(true);
      }
    }
  }, [isInitialized, isAuthenticated]);

  const handleOnboardingComplete = (connectWeLearn?: boolean) => {
    setShowOnboarding(false);
    if (connectWeLearn) {
      setActiveTab('welearn');
    }
  };

  // Inisialisasi otentikasi di client side secara aman untuk menghindari hydration mismatch
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Request desktop notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Periksa otentikasi sesi — tunggu hingga isInitialized = true agar tidak race condition
  // PENTING: Jangan redirect jika showOnboarding aktif — wizard bisa selesaikan setup
  // meski terjadi auth state glitch sementara
  useEffect(() => {
    if (!isInitialized) return;
    if (!isAuthenticated && !showOnboarding) {
      router.push('/auth/login');
    }
  }, [isInitialized, isAuthenticated, showOnboarding, router]);

  // Muat data kalender, rapat & moodle ketika terotentikasi
  useEffect(() => {
    if (isAuthenticated) {
      fetchConnections();
      fetchEvents();
      fetchMoodleStatus();
      fetchMoodleAssignments('upcoming');
      fetchQuota();
    }
  }, [isAuthenticated, fetchConnections, fetchEvents, fetchMoodleStatus, fetchMoodleAssignments, fetchQuota]);

  // Pengambil tugas-tugas pengguna dari API
  const fetchTasks = useCallback(async (silent = false) => {
    if (!silent) setTasksLoading(true);
    setTasksError(null);
    try {
      let url = '/tasks';
      const params: string[] = [];
      if (filterStatus !== 'all') params.push(`status=${filterStatus}`);
      if (filterCategory !== 'all') params.push(`category=${filterCategory}`);
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const response = await API.get(url);
      // Response format: { success: true, data: { tasks: [...], pagination: {...} } }
      const responseData = response.data.data;
      setTasks(responseData?.tasks || responseData || []);
    } catch (err: any) {
      setTasksError(err.response?.data?.error || 'Gagal mengambil daftar tugas kerja Anda.');
    } finally {
      if (!silent) setTasksLoading(false);
    }
  }, [filterStatus, filterCategory]);

  // Muat tugas saat filter berubah atau saat sudah terotentikasi
  useEffect(() => {
    if (isAuthenticated) {
      fetchTasks();
    }
  }, [isAuthenticated, fetchTasks]);

  // Real-time WebSocket synchronization
  useEffect(() => {
    if (!isAuthenticated) return;

    // Tentukan URL WebSocket berdasarkan konfigurasi API_URL.
    // Protocol (ws/wss) diturunkan dari API URL itu sendiri — BUKAN dari window.location —
    // agar tidak ada mismatch saat HTTPS frontend mengakses HTTP backend atau sebaliknya.
    const apiURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
    const wsProtocol = apiURL.startsWith('https') ? 'wss:' : 'ws:';
    const wsBaseURL = apiURL.replace(/^https?:/, wsProtocol);
    const wsURL = `${wsBaseURL}/ws`; // Cookie dikirim otomatis oleh browser

    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      console.log('Connecting to real-time WebSocket server...');
      socket = new WebSocket(wsURL);

      socket.onopen = () => {
        console.log('Real-time WebSocket connection established successfully.');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received WebSocket message:', data);
          
          // Sinkronisasi jika tipe event adalah pembaruan tugas
          if (data.type === 'TASK_UPDATED' || data.type === 'tasks_updated') {
            console.log('Real-time Sync: Tasks and Moodle lists updated, reloading dashboard...');
            fetchTasks();
            fetchEvents();
            fetchMoodleStatus();
            fetchMoodleAssignments('upcoming');
            fetchMoodleAssignments('all');
            fetchMoodleCourses();
            fetchQuota();
          } else if (data.type === 'TASK_REMINDER') {
            console.log('Task Reminder received:', data);
            setActiveReminder({
              taskId: data.taskId,
              taskTitle: data.taskTitle,
              startTime: data.startTime,
            });
            
            // Send HTML5 Web Notification if allowed
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              const notification = new Notification('⏰ Pengingat Tugas Motion AI', {
                body: `Tugas "${data.taskTitle}" akan segera dimulai!`,
                icon: '/favicon.ico',
              });
              notification.onclick = () => {
                window.focus();
                notification.close();
              };
            }
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      socket.onerror = (err) => {
        console.error('WebSocket connection error:', err);
      };

      socket.onclose = (event) => {
        console.log('WebSocket connection closed. Reconnecting in 3 seconds...', event.reason);
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (socket) {
        socket.onclose = null; // Hapus listener close agar tidak memicu reconnect loop
        socket.close();
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [isAuthenticated, fetchTasks, fetchEvents, fetchQuota]);

  // Pembuatan Tugas Baru
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setFormSubmitting(true);
    try {
      const taskData = {
        title: newTitle,
        description: newDescription,
        timeEstimateMinutes: Number(newEstimate),
        dueDate: newDueDate ? new Date(newDueDate).toISOString() : null,
        priority: Number(newPriority),
        category: newCategory
      };

      await API.post('/tasks', taskData);
      
      // Reset form
      setNewTitle('');
      setNewDescription('');
      setNewEstimate(30);
      setNewDueDate('');
      setNewPriority(3);
      setNewCategory('work');
      
      // Muat ulang daftar tugas (AI secara otomatis menjadwalkannya di backend)
      fetchTasks();
      fetchEvents(); // Memperbarui agenda kalender
      fetchQuota(); // Perbarui kuota
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Gagal membuat tugas.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Tandai Selesai / Belum Selesai
  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    // Optimistic UI Update: immediately toggle task status in local state to let checkbox animation play smoothly.
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    setTasks(prevTasks =>
      prevTasks.map(t => (t.id === taskId ? { ...t, status: nextStatus } : t))
    );

    try {
      if (currentStatus === 'completed') {
        await API.patch(`/tasks/${taskId}`, { status: 'pending' });
      } else {
        await API.patch(`/tasks/${taskId}/complete`);
      }
      // Silent refresh to keep state in sync without showing skeleton loaders.
      fetchTasks(true);
      fetchEvents();
    } catch (err: any) {
      // Rollback on failure
      setTasks(prevTasks =>
        prevTasks.map(t => (t.id === taskId ? { ...t, status: currentStatus } : t))
      );
      toast.error(err.response?.data?.error || 'Gagal memperbarui status tugas.');
    }
  };

  // Hapus Tugas (Membuka dialog konfirmasi kustom neobrutalisme)
  const handleDeleteTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    setDeleteConfirmId(taskId);
    setDeleteConfirmTitle(task ? task.title : 'Misi');
  };

  // Hubungkan Kalender
  const handleConnectCalendar = async (type: string, code: string) => {
    const ok = await connectCalendar(type, code);
    if (ok) {
      toast.success('Kalender berhasil terhubung dan tersinkronisasi!');
    }
    return ok;
  };

  // Keluar Sesi
  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  // Tampilkan skeleton loading saat sesi belum diinisialisasi (validasi token sedang berjalan)
  if (!isInitialized || authLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-transparent">
        <DashboardHeaderSkeleton />
        <main className="flex-grow max-w-[1750px] mx-auto w-full px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1">
              <TaskFormSkeleton />
            </div>
            <div className="lg:col-span-2">
              <TaskListSkeleton />
            </div>
          </div>
        </main>
      </div>
    );
  }
  // ─── Menu items untuk StaggeredMenu ───────────────────────────────────────
  const staggeredMenuItems = [
    { label: 'Ringkasan',       ariaLabel: 'Halaman Ringkasan',      onClick: () => setActiveTab('overview') },
    { label: 'Daftar Tugas',   ariaLabel: 'Daftar Tugas',           onClick: () => setActiveTab('list') },
    { label: 'Kalender',       ariaLabel: 'Kalender Agenda',        onClick: () => setActiveTab('calendar') },
    { label: 'WeLearn',        ariaLabel: 'Tugas WeLearn',          onClick: () => setActiveTab('welearn') },
    { label: 'Analisis',       ariaLabel: 'Analisis Performa',      onClick: () => setActiveTab('analytics') },
    { label: 'Surat Izin',     ariaLabel: 'Surat Izin Praktikum',   onClick: () => setActiveTab('excuse-letter') },
    { label: 'Integrasi',      ariaLabel: 'Integrasi Kalender',     onClick: () => setActiveTab('integrations') },
    { label: 'Preferensi AI',  ariaLabel: 'Preferensi AI',          onClick: () => setActiveTab('preferences') },
    { label: 'Langganan Pro',  ariaLabel: 'Langganan Premium',      onClick: () => setActiveTab('billing') },
    { label: 'Profil',         ariaLabel: 'Profil Pengguna',        onClick: () => setActiveTab('profile') },
    { label: 'Keluar',         ariaLabel: 'Keluar Sesi',            onClick: handleLogout },
  ];

  const staggeredSocialItems = [
    { label: 'GitHub',    link: 'https://github.com' },
    { label: 'Telegram',  link: 'https://t.me' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-transparent pb-16 md:pb-0">
      {showOnboarding && (
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      )}

      {/* STAGGERED MENU — Mengganti semua sistem navigasi lama (drawer + sidebar + mobile topbar) */}
      <StaggeredMenu
        isFixed
        position="left"
        colors={['#FBBF24', '#1D2A44']}
        accentColor="#FF7A00"
        menuButtonColor="#1D2A44"
        openMenuButtonColor="#1D2A44"
        changeMenuColorOnOpen={false}
        displayItemNumbering
        displaySocials={false}
        items={staggeredMenuItems}
        socialItems={staggeredSocialItems}
        logoText="Motion"
        headerLeft={
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neoYellow border-2 border-black flex items-center justify-center shadow-neo-sm shrink-0">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <span className="font-black text-lg tracking-tight text-black">Motion</span>
          </div>
        }
      />

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-grow max-w-[1550px] w-full mx-auto px-4 md:px-8 pt-20 pb-5 md:pt-24 md:pb-6">
          
          {/* Render Tab Ringkasan (Overview) */}
          {activeTab === 'overview' && (
            <OverviewTab onNavigateToTab={(tab) => setActiveTab(tab)} />
          )}

          {/* Render Tab Tugas WeLearn */}
          {activeTab === 'welearn' && (
            <div className="max-w-6xl mx-auto">
              <WeLearnTab onNavigateToSettings={() => setActiveTab('integrations')} />
            </div>
          )}

          {/* Render Tab Surat Izin Praktikum */}
          {activeTab === 'excuse-letter' && (
            <div className="max-w-6xl mx-auto">
              <ExcuseLetterTab />
            </div>
          )}

          {/* Render Tab Analisis Produktivitas */}
          {activeTab === 'analytics' && (
            <div className="w-full">
              <ProductivityDashboard />
            </div>
          )}

          {/* Render Tab Integrasi */}
          {activeTab === 'integrations' && (
            <div className="max-w-6xl mx-auto">
              <IntegrationsTab
                connections={connections}
                isLoading={calendarLoading}
                onConnect={handleConnectCalendar}
                onSync={syncCalendar}
                onDisconnect={disconnectCalendar}
                onNavigateToExcuseLetter={() => setActiveTab('excuse-letter')}
              />
            </div>
          )}

          {/* Render Tab Profil Pengguna */}
          {activeTab === 'profile' && (
            <div className="w-full">
              <ProfileTab />
            </div>
          )}

          {/* Render Tab Langganan Billing */}
          {activeTab === 'billing' && (
            <div className="max-w-6xl mx-auto">
              <BillingTab />
            </div>
          )}
 
          {/* Render Tab Preferensi AI */}
          {activeTab === 'preferences' && (
            <div className="max-w-6xl mx-auto">
              <PreferencesTab />
            </div>
          )}

          {/* Render Tab Tampilan Kalender */}
          {activeTab === 'calendar' && (
            <div className="w-full">
              <CalendarView
                events={events}
                tasks={tasks}
                onToggleTaskComplete={handleToggleComplete}
                onDeleteTask={handleDeleteTask}
              />
            </div>
          )}

          {/* Render Tab Utama Daftar Tugas */}
{/* Render Tab Utama Daftar Tugas */}
          {activeTab === 'list' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start text-left">
              
              {/* Panel Kiri: Form Pembuatan Tugas (Sticky on desktop for premium UX) */}
              <div className="lg:col-span-1 lg:sticky lg:top-[32px] z-10 space-y-6">
                <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-6 text-left">
                  <h2 className="text-base font-black mb-5 text-black border-b-2 border-black pb-3">
                    + Tambah Misi Baru! 🚀
                  </h2>

                  <form onSubmit={handleCreateTask} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-black uppercase tracking-wider">JUDUL TUGAS</label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Menulis materi presentasi"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="w-full neo-input rounded-xl px-4 py-3 text-sm font-black"
                        disabled={formSubmitting}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-black uppercase tracking-wider">DESKRIPSI TUGAS (OPSIONAL)</label>
                      <textarea
                        placeholder="Tulis catatan, tautan referensi, atau agenda di sini..."
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        className="w-full neo-input rounded-xl px-4 py-3 text-sm h-20 resize-none font-semibold"
                        disabled={formSubmitting}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-black uppercase tracking-wider">ESTIMASI (MENIT)</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                          <input
                            type="number"
                            required
                            min={5}
                            step={5}
                            value={newEstimate}
                            onChange={(e) => setNewEstimate(Number(e.target.value))}
                            className="w-full neo-input rounded-xl pl-9 pr-3 py-3 text-sm font-black"
                            disabled={formSubmitting}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-black uppercase tracking-wider">KATEGORI TUGAS</label>
                        <CustomSelect
                          options={categoryOptions}
                          value={newCategory}
                          onChange={setNewCategory}
                          disabled={formSubmitting}
                          icon={<Folder className="w-4 h-4 text-black shrink-0 font-extrabold" />}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-black uppercase tracking-wider">TENGGAT WAKTU</label>
                        <DatePicker
                          value={newDueDate}
                          onChange={setNewDueDate}
                          disabled={formSubmitting}
                          placeholder="dd/mm/yyyy"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-black uppercase tracking-wider">PRIORITAS</label>
                        <CustomSelect
                          options={priorityOptions}
                          value={newPriority}
                          onChange={setNewPriority}
                          disabled={formSubmitting}
                          placeholder="Pilih Prioritas"
                        />
                      </div>
                    </div>

                    {quota && (
                      <div className="bg-neoCream border-2 border-black p-3.5 rounded-xl shadow-neo-sm text-xs space-y-1 font-bold text-left">
                        <div className="flex justify-between items-center text-black font-black uppercase text-[9px] tracking-wider">
                          <span>Paket: {quota.plan === 'pro' ? '🚀 PRO / PREMIUM' : '🆓 GRATIS / FREE'}</span>
                          <span>{quota.taskQuota.limit === -1 ? 'Unlimited' : `${quota.taskQuota.used}/${quota.taskQuota.limit} Tugas`}</span>
                        </div>
                        <div className="w-full bg-slate-200 border border-black rounded-full h-2.5 overflow-hidden">
                          <div 
                            className={`h-full border-r border-black transition-all duration-500 ${
                              quota.plan === 'pro' 
                                ? 'bg-neoMint w-full' 
                                : quota.taskQuota.used >= quota.taskQuota.limit 
                                  ? 'bg-neoOrange' 
                                  : 'bg-neoBlue'
                            }`}
                            style={{ 
                              width: quota.plan === 'pro' 
                                ? '100%' 
                                : `${Math.min(100, (quota.taskQuota.used / quota.taskQuota.limit) * 100)}%` 
                            }}
                          />
                        </div>
                        {quota.plan !== 'pro' && (
                          <div className="text-[10px] text-gray-700 leading-tight mt-1 font-semibold">
                            {quota.taskQuota.used >= quota.taskQuota.limit ? (
                              <span className="text-red-500 font-black">Batas bulanan tercapai! Silakan upgrade ke Pro.</span>
                            ) : (
                              <span>Sisa kuota tugas bulan ini: {quota.taskQuota.limit - quota.taskQuota.used} misi.</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <OnboardingTooltip
                      hintId="auto-schedule"
                      text="Klik ini dan AI akan menyusun jadwal optimalmu!"
                      position="bottom"
                      accentBg="bg-neoMint"
                    >
                      <button
                        type="submit"
                        disabled={formSubmitting || !!(quota && quota.plan !== 'pro' && quota.taskQuota.used >= quota.taskQuota.limit)}
                        className="w-full neo-btn bg-white hover:bg-slate-50 text-black rounded-xl py-3 text-sm font-black shadow-neo flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {formSubmitting ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" /> Scheduling...
                          </>
                        ) : (
                          <>
                            Schedule <Sparkles className="w-4 h-4 text-black shrink-0" />
                          </>
                        )}
                      </button>
                    </OnboardingTooltip>
                  </form>
                </div>
              </div>

              {/* Panel Kanan: Daftar Tugas & Filter */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Penyaring Tugas (Filter Neobrutalist) */}
                <div className="bg-white border-3 border-black shadow-neo rounded-2xl p-4 flex flex-wrap gap-4 items-center justify-between text-left">
                  <div className="flex items-center gap-2 text-xs text-black font-black uppercase tracking-wider">
                    <Filter className="w-4.5 h-4.5 text-black shrink-0" /> Penyaring Tugas
                  </div>

                  <div className="flex gap-3 flex-wrap">
                    <CustomSelect
                      options={filterStatusOptions}
                      value={filterStatus}
                      onChange={setFilterStatus}
                      size="sm"
                      className="w-40"
                    />

                    <CustomSelect
                      options={filterCategoryOptions}
                      value={filterCategory}
                      onChange={setFilterCategory}
                      size="sm"
                      className="w-40"
                    />
                  </div>
                </div>

                {/* Kontainer Daftar Tugas */}
                {tasksLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TaskItemSkeleton key={i} index={i} />
                    ))}
                  </div>
                ) : tasksError ? (
                  <div className="bg-neoOrange border-3 border-black text-white rounded-2xl p-8 text-center shadow-neo">
                    <AlertCircle className="w-8 h-8 mx-auto mb-3 text-white" />
                    <p className="text-sm font-black">{tasksError}</p>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="py-4">
                    <EmptyState
                      mascot="zappy"
                      title="Belum Ada Misi Aktif!"
                      description="Papan tugas Anda bersih. Tambahkan misi baru di panel sebelah kiri, lalu biarkan AI Motion merancang jadwal optimal untuk Anda!"
                      ctaText="+ Tambah Tugas Pertama"
                      ctaAction={() => {
                        const inputEl = document.querySelector('input[placeholder="Contoh: Menulis materi presentasi"]') as HTMLInputElement;
                        if (inputEl) inputEl.focus();
                      }}
                      speechBubble="Papan tugas bersih, mantap!"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tasks.map((task) => {
                      const isCompleted = task.status === 'completed';
                      
                      const priorityBgs = [
                        'bg-neoCream',    // 1
                        'bg-neoBlue',     // 2
                        'bg-neoYellow',   // 3
                        'bg-neoPink',     // 4
                        'bg-neoOrange text-white' // 5
                      ];

                      const categoryTranslation: Record<string, string> = {
                        work: 'Pekerjaan',
                        personal: 'Pribadi',
                        health: 'Kesehatan',
                        education: 'Pendidikan',
                        general: 'Umum'
                      };

                      return (
                        <div 
                          key={task.id}
                          className={`bg-white border-3 border-black shadow-neo rounded-2xl p-4 flex gap-4 items-start transition-all hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-neo-sm text-left ${
                            isCompleted ? 'bg-neoCream opacity-70 shadow-none translate-x-[1.5px] translate-y-[1.5px]' : ''
                          }`}
                        >
                          {/* Tombol Centang Status */}
                          <div className="mt-1.5 shrink-0 select-none">
                            <CheckBox
                              checked={isCompleted}
                              onClick={() => handleToggleComplete(task.id, task.status)}
                              size={28}
                              color={PRIORITY_COLORS[(task.priority - 1) || 0] || "#1D2A44"}
                              duration={0.4}
                            />
                          </div>


                          {/* Konten Tugas */}
                          <div className="flex-1 space-y-2 text-left min-w-0">
                            <div className="flex flex-wrap items-center gap-2 justify-between">
                              <h3 className={`text-base font-black text-black truncate ${isCompleted ? 'line-through text-black/45' : ''}`}>
                                {task.title}
                              </h3>
                              
                              <div className="flex gap-1.5 items-center">
                                <span className={`neo-badge text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 shadow-neo-sm ${
                                  priorityBgs[(task.priority - 1) || 0]
                                }`}>
                                  Prioritas {task.priority}
                                </span>
                                
                                <span className="neo-badge bg-neoViolet text-black text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 shadow-neo-sm">
                                  {categoryTranslation[task.category] || task.category}
                                </span>
                              </div>
                            </div>

                            {task.description && (() => {
                              const parsed = parseWeLearnDescription(task.description);
                              if (parsed.isWeLearn) {
                                return (
                                  <div className="space-y-1.5 mt-1 border-l-3 border-neoBlue/35 pl-3 py-0.5">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-800 font-bold flex-wrap">
                                      <BookOpen className="w-3.5 h-3.5 text-neoBlue shrink-0" />
                                      <span className="text-gray-900 font-black">Mata Kuliah:</span>
                                      <span className={`text-gray-800 ${isCompleted ? 'line-through text-black/45' : ''}`}>
                                        {cleanCourseName(parsed.course || '')}
                                      </span>
                                    </div>
                                    {parsed.section && (
                                      <div className="flex items-center gap-1.5 text-xs text-gray-700 font-bold pl-5">
                                        <span className="text-gray-900 font-black">Section:</span>
                                        <span className="text-gray-800">{parsed.section}</span>
                                      </div>
                                    )}
                                    {parsed.link && (
                                      <div className="pt-1 pl-5">
                                        <a
                                          href={parsed.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xxs font-black text-white bg-neoBlue border-2 border-black rounded-lg shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none cursor-pointer transition-all w-fit"
                                        >
                                          <ExternalLink className="w-3 h-3 stroke-[2.5]" />
                                          <span>Buka di WeLearn ↗</span>
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return (
                                <p className={`text-xs font-semibold whitespace-pre-line text-gray-700 leading-relaxed ${isCompleted ? 'line-through text-black/45' : ''}`}>
                                  {task.description}
                                </p>
                              );
                            })()}

                            <div className="flex flex-wrap gap-4 pt-1 items-center text-[10px] text-black font-extrabold font-mono">
                              <div className="flex items-center gap-1 bg-white border border-black rounded px-1.5 py-0.2">
                                <Clock className="w-3.5 h-3.5 text-black shrink-0" />
                                <span>{task.timeEstimateMinutes} menit</span>
                              </div>
                              {task.dueDate && (
                                <div className="flex items-center gap-1 bg-white border border-black rounded px-1.5 py-0.2">
                                  <Calendar className="w-3.5 h-3.5 text-black shrink-0" />
                                  <span>Tenggat: {new Date(task.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                </div>
                              )}
                              {task.scheduledStart && (
                                <div className="bg-neoMint border-2 border-black text-black px-2.5 py-0.5 rounded-lg shadow-neo-sm text-xxs font-black flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-black shrink-0" />
                                  <span>AI Slot: {new Date(task.scheduledStart).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Tombol Hapus - Letaknya konsisten di sisi kanan */}
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-black hover:text-white w-10 h-10 bg-white border-2 border-black rounded-lg shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none hover:bg-neoOrange transition-all shrink-0 cursor-pointer flex items-center justify-center"
                            title="Hapus Tugas"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (Float at the bottom for easy thumb reach & larger tap targets) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-45 bg-white border-t-3 border-black py-2 px-3 shadow-[0_-3px_0_0_#000] flex justify-around items-center h-16">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl border-2 transition-all cursor-pointer ${
            activeTab === 'overview' ? 'bg-neoYellow border-black shadow-neo-sm' : 'border-transparent'
          }`}
          title="Overview"
        >
          <LayoutDashboard size={20} className="text-black" />
          <span className="text-[8px] font-black text-black mt-0.5 leading-none">Ringkasan</span>
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl border-2 transition-all cursor-pointer ${
            activeTab === 'list' ? 'bg-neoYellow border-black shadow-neo-sm' : 'border-transparent'
          }`}
          title="Tasks"
        >
          <CheckCircle2 size={20} className="text-black" />
          <span className="text-[8px] font-black text-black mt-0.5 leading-none">Tugas</span>
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl border-2 transition-all cursor-pointer ${
            activeTab === 'calendar' ? 'bg-neoViolet border-black shadow-neo-sm' : 'border-transparent'
          }`}
          title="Calendar"
        >
          <Calendar size={20} className="text-black" />
          <span className="text-[8px] font-black text-black mt-0.5 leading-none">Kalender</span>
        </button>
        <button
          onClick={() => setActiveTab('welearn')}
          className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl border-2 transition-all cursor-pointer ${
            activeTab === 'welearn' ? 'bg-neoYellow border-black shadow-neo-sm' : 'border-transparent'
          }`}
          title="WeLearn"
        >
          <BookOpen size={20} className="text-black" />
          <span className="text-[8px] font-black text-black mt-0.5 leading-none">WeLearn</span>
        </button>
      </nav>

      {/* Floating AI Chat Assistant */}
      <AIChatWidget />

      {/* Neobrutalist Toast Notification */}
      {activeReminder && (
        <div className="fixed bottom-20 md:bottom-6 left-6 z-50 max-w-sm w-[calc(100vw-48px)] md:w-full bg-neoYellow border-3 border-black p-5 rounded-2xl shadow-neo-lg text-left animate-in slide-in-from-bottom duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center shadow-neo-sm shrink-0">
              <Clock className="w-5 h-5 text-black" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-black uppercase tracking-wider">Tugas Akan Dimulai!</h4>
              <p className="text-xs font-extrabold text-black mt-1 line-clamp-2">
                {activeReminder.taskTitle}
              </p>
              <p className="text-xxs font-bold font-mono text-black/60 mt-0.5">
                Mulai: {new Date(activeReminder.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
              </p>
            </div>
          </div>
          <div className="flex gap-2.5 mt-4">
            <button
              onClick={async () => {
                try {
                  await API.patch(`/tasks/${activeReminder.taskId}/complete`);
                  fetchTasks();
                  fetchEvents();
                } catch (err: any) {
                  toast.error(err.response?.data?.error || 'Gagal menyelesaikan tugas.');
                } finally {
                  setActiveReminder(null);
                }
              }}
              className="flex-1 neo-btn bg-neoMint text-black text-xs font-black py-2.5 px-3 rounded-xl border-2 border-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer text-center"
            >
              Bereskan! ✅
            </button>
            <button
              onClick={() => setActiveReminder(null)}
              className="neo-btn bg-white text-black text-xs font-black py-2.5 px-3 rounded-xl border-2 border-black shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer text-center"
            >
              Nanti Saja
            </button>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal (Neobrutalism Style) */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border-4 border-black rounded-3xl p-6 max-w-sm w-full shadow-[6px_6px_0px_0px_#000] space-y-4 relative animate-in zoom-in-95 duration-200 text-left">
            {/* Header / Title */}
            <div className="flex items-center gap-2 border-b-2 border-black pb-3">
              <span className="p-1.5 bg-[#FF6B6B] border border-black rounded-lg shadow-[1px_1px_0px_#000] shrink-0 flex items-center justify-center">
                <Trash2 size={16} className="text-black font-black" />
              </span>
              <h3 className="text-base font-black text-black font-heading uppercase">
                HAPUS MISI?
              </h3>
            </div>

            {/* Description */}
            <div className="text-xs font-semibold text-gray-700 leading-relaxed font-body">
              Apakah Anda yakin ingin menghapus tugas <span className="font-black text-black">"{deleteConfirmTitle}"</span>? Tindakan ini tidak dapat dibatalkan.
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteConfirmTitle('');
                }}
                className="px-4 py-2 border-2 border-black bg-white hover:bg-slate-50 text-black font-black text-xs rounded-xl shadow-[2px_2px_0px_#000] active:translate-y-0.5 active:shadow-none hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteConfirmId;
                  setDeleteConfirmId(null);
                  setDeleteConfirmTitle('');
                  try {
                    await API.delete(`/tasks/${id}`);
                    toast.success('Misi berhasil dihapus dari daftar! 🗑️');
                    fetchTasks();
                    fetchEvents();
                    fetchQuota();
                  } catch (err: any) {
                    toast.error(err.response?.data?.error || 'Gagal menghapus tugas.');
                  }
                }}
                className="px-4 py-2 border-2 border-black bg-[#FF6B6B] hover:bg-[#FF6B6B]/80 text-black font-black text-xs rounded-xl shadow-[2px_2px_0px_#000] active:translate-y-0.5 active:shadow-none hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
