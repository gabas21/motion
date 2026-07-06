/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,

  images: {
    remotePatterns: [
      { hostname: 'api.motion.local' },
      { hostname: 'welearn.dev' },
      { hostname: 'example.com' }
    ],
    formats: ['image/avif', 'image/webp'],
  },

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-slot',
      'recharts',
      'animejs',
    ],
  },

  // Aktifkan polling watcher agar hot-reload bekerja di dalam Docker Desktop (Windows).
  // fsnotify (event-based) sering gagal melewati lapisan virtualisasi WSL2/Hyper-V.
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,           // Cek perubahan file setiap 1 detik
        aggregateTimeout: 300, // Tunggu 300ms setelah perubahan terakhir sebelum rebuild
      };
    }
    if (!isServer && config.optimization.splitChunks) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          reuseExistingChunk: true,
        },
        animejs: {
          test: /[\\/]node_modules[\\/]animejs/,
          name: 'animejs',
          priority: 20,
          reuseExistingChunk: true,
        },
      };
    }
    return config;
  },
};

export default nextConfig;
