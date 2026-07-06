'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Activity, ArrowLeft, Sparkles, Shield, CloudSun, ClipboardList } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [weather, setWeather] = useState<{ temp: number; name: string; city: string } | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      let lat = -0.5022, lon = 117.1536, city = 'Samarinda';
      const tz = user?.timezone || '';
      if (tz.includes('Jakarta'))           { lat = -6.2088;  lon = 106.8456; city = 'Jakarta'; }
      else if (tz.includes('Surabaya'))     { lat = -7.2504;  lon = 112.7688; city = 'Surabaya'; }
      else if (tz.includes('Bandung'))      { lat = -6.9175;  lon = 107.6191; city = 'Bandung'; }
      else if (tz.includes('Medan'))        { lat = 3.5952;   lon = 98.6722;  city = 'Medan'; }
      else if (tz.includes('Semarang'))     { lat = -6.9932;  lon = 110.4203; city = 'Semarang'; }
      else if (tz.includes('Palembang'))    { lat = -2.9761;  lon = 104.7754; city = 'Palembang'; }
      else if (tz.includes('Makassar') || tz.includes('Ujung_Pandang')) { lat = -5.1477; lon = 119.4327; city = 'Makassar'; }
      else if (tz.includes('Balikpapan'))   { lat = -1.2654;  lon = 116.8312; city = 'Balikpapan'; }
      else if (tz.includes('Pontianak'))    { lat = -0.0226;  lon = 109.3324; city = 'Pontianak'; }
      else if (tz.includes('Jayapura'))     { lat = -2.5337;  lon = 140.7181; city = 'Jayapura'; }
      else if (tz.includes('Manado'))       { lat = 1.4748;   lon = 124.8421; city = 'Manado'; }
      else if (tz.includes('Denpasar') || tz.includes('Bali')) { lat = -8.6705; lon = 115.2126; city = 'Denpasar'; }

      try {
        const query = `${lat},${lon}`;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const resp = await fetch(
          `${apiUrl}/weather?city=${query}`,
          { credentials: 'include' }
        );
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.current) {
          setWeather({
            temp: Math.round(data.current.temp_c),
            name: data.current.condition.text,
            city: data.location?.name || city
          });
        }
      } catch (err) {
        console.error('Failed to fetch weather in Admin:', err);
      }
    };

    fetchWeather();
  }, [user]);

  const menuItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Pengguna', path: '/admin/users', icon: Users, badge: 'BARU' },
    { name: 'Aktivitas', path: '/admin/activity', icon: Activity },
    { name: 'Audit Logs', path: '/admin/audit-logs', icon: ClipboardList, badge: 'NEW' },
  ];

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      {/* Sidebar Admin */}
      <aside className="w-72 bg-[#121214] text-white flex flex-col border-r-3 border-black shrink-0">
        {/* Header Logo */}
        <div className="p-6 border-b-2 border-black flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neoYellow border-2 border-black flex items-center justify-center shadow-neo-sm">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <div>
              <h1 className="font-black text-base tracking-tight leading-none text-white">Motion</h1>
              <span className="text-[10px] font-black text-neoYellow uppercase tracking-wider">ADMIN PORTAL</span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 font-bold transition-all duration-150 select-none ${
                  isActive
                    ? 'bg-neoYellow text-black border-black shadow-neo-sm translate-x-[2px] translate-y-[2px]'
                    : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-black' : 'text-gray-400 hover:text-white'}`} />
                <span>{item.name}</span>
                {item.badge && (
                  <span className={`ml-auto text-[8px] font-black px-1.5 py-0.5 rounded border border-black shadow-neo-sm ${
                    isActive ? 'bg-neoPink text-black' : 'bg-neoYellow text-black'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer / User Profile */}
        <div className="p-4 border-t-2 border-black bg-black/30 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neoPink border-2 border-black flex items-center justify-center font-black text-black">
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="min-w-0">
              <p className="font-black text-sm truncate text-white leading-none">{user?.name || 'Administrator'}</p>
              <span className="text-[10px] font-extrabold text-[#30E3CA] truncate uppercase tracking-wider">{user?.email || 'admin@motion.ai'}</span>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-xs font-black text-black bg-white border-2 border-black rounded-lg shadow-neo-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke App</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col min-w-0">
        <header className="h-16 border-b-3 border-black bg-white px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-neoOrange" />
            <h2 className="font-black text-base uppercase tracking-wide">
              {menuItems.find((m) => pathname.startsWith(m.path))?.name || 'Admin Panel'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {weather && (
              <div className="flex items-center gap-1.5 bg-neoYellow border-2 border-black px-3 py-1 rounded-lg text-xs font-black shadow-neo-sm">
                <CloudSun className="w-4 h-4 text-black shrink-0" />
                <span>{weather.temp}°C · {weather.name}</span>
                <span className="text-black/55 font-mono text-[9px] font-bold">({weather.city})</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-neoCream border-2 border-black px-3 py-1 rounded-lg text-xs font-extrabold shadow-neo-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-black" />
              <span>Sistem Online</span>
            </div>
          </div>
        </header>
        <div className="flex-1 p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
