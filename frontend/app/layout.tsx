import type { Metadata, Viewport } from 'next';
import { Fredoka, Quicksand, Space_Mono, Cinzel, Orbitron } from 'next/font/google';
import './globals.css';
import AuthInitializer from './AuthInitializer';
import NetworkStatusBanner from '../components/ui/NetworkStatusBanner';
import { SpeedInsights } from '@vercel/speed-insights/next';

const fredoka = Fredoka({
  subsets: ['latin'],
  variable: '--font-fredoka',
  display: 'swap',
});

const quicksand = Quicksand({
  subsets: ['latin'],
  variable: '--font-quicksand',
  display: 'swap',
});

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#FBBF24',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'Motion — AI Calendar & Intelligent Task Manager',
  description: 'Otomatis jadwalkan harimu, sinkron kalender, integrasi SIAK Wicida & WeLearn Moodle otomatis.',
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'Motion — AI Calendar & Intelligent Task Manager',
    description: 'Otomatis jadwalkan harimu, sinkron kalender, integrasi SIAK Wicida & WeLearn Moodle otomatis.',
    url: 'https://motion-app.com',
    siteName: 'Motion App',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Motion — AI Calendar & Intelligent Task Manager',
      },
    ],
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Motion — AI Calendar & Intelligent Task Manager',
    description: 'Otomatis jadwalkan harimu, sinkron kalender, integrasi SIAK Wicida & WeLearn Moodle otomatis.',
    images: ['/og-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Motion AI',
  },
  icons: {
    icon: [
      { url: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${fredoka.variable} ${quicksand.variable} ${spaceMono.variable} ${cinzel.variable} ${orbitron.variable}`}>
      <body className="antialiased font-sans">
        <AuthInitializer />
        {children}
        <NetworkStatusBanner />
        <SpeedInsights />
      </body>
    </html>
  );
}
