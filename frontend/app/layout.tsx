import type { Metadata } from 'next';
import { Fredoka, Nunito, Space_Mono } from 'next/font/google';
import './globals.css';
import AuthInitializer from './AuthInitializer';

const fredoka = Fredoka({
  subsets: ['latin'],
  variable: '--font-fredoka',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
});

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Motion — AI Calendar & Intelligent Task Manager',
  description: 'Automatically plan your days, sync calendars, and optimize focus hours using artificial intelligence.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} ${spaceMono.variable}`}>
      <body className="antialiased font-sans">
        {/* AuthInitializer memicu validasi sesi ke backend saat app pertama dimuat
            sehingga isInitialized menjadi true dan skeleton login bisa hilang */}
        <AuthInitializer />
        {children}
      </body>
    </html>
  );
}

