import axios from 'axios';

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1',
  // withCredentials: true agar browser otomatis menyertakan HTTP-only cookie
  // yang di-set oleh backend saat login. Token TIDAK perlu disimpan di localStorage.
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  // Timeout 15 detik — lebih toleran terhadap cold start backend / Supabase
  timeout: 15000,
});

// Request interceptor: Sesuaikan baseURL secara dinamis jika diakses dari IP jaringan lokal (misal HP via IP 172.x.x.x / 192.168.x.x)
API.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      config.baseURL = `http://${hostname}:8080/api/v1`;
    }
  }
  return config;
});

// Flag and queue for managing token refresh
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// Response interceptor: tangkap error 401 (token expired) secara global,
// lakukan silent refresh token, lalu ulangi request asli yang gagal.
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Tangkap error 403 jika akun dinonaktifkan (ACCOUNT_SUSPENDED)
    if (error.response?.status === 403) {
      const errData = error.response.data;
      if (errData?.code === 'ACCOUNT_SUSPENDED' || (typeof errData?.error === 'string' && errData.error.includes('dinonaktifkan'))) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('motion_user');
          if (window.location.pathname !== '/auth/suspended') {
            window.location.href = '/auth/suspended';
          }
        }
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
      const isOnAuthPage = pathname.startsWith('/auth');
      const isOnLandingPage = pathname === '/';
      const isPublicPage = isOnAuthPage || isOnLandingPage;

      if (isOnAuthPage) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return API(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Panggil endpoint refresh token secara silent menggunakan HTTP-only refresh_token cookie
        await axios.post(
          `${API.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        isRefreshing = false;
        processQueue(null);
        return API(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError);
        
        // Bersihkan data user local dan redirect jika silent refresh juga gagal
        if (typeof window !== 'undefined') {
          localStorage.removeItem('motion_user');
          if (!isPublicPage) {
            window.location.href = '/auth/login';
          }
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default API;
