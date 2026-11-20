'use client';

// Shell aplikasi bergaya dashboard SRMS (tema referensi): sidebar putih dengan blok logo
// biru, header atas berisi judul halaman + indikator sinkron, konten latar abu terang.
// Di ponsel (<768px) sidebar diganti bottom navigation bar (PRD v1.6 & v1.7, bagian 7.8).
// PRD 5: HashRouter, deep-link aman di GitHub Pages.
import { useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, Link } from 'react-router-dom';
import { initSync } from '@/lib/pn/sync/engine';
import { useSyncStore } from '@/lib/pn/sync/store';
import { SyncIndicator } from './sync-indicator';
import { Dashboard } from './dashboard';
import { KelasPage } from './kelas/kelas-page';
import { RekapPage } from './rekap/rekap-page';
import { Pengaturan } from './pengaturan';
import { GraduationCap, LayoutDashboard, Settings, BarChart3 } from 'lucide-react';
import logoScorify from '@/assets/scorify-logo.png';

/** Blok logo biru dengan logo Scorify, khas sidebar SRMS. */
function LogoBlok() {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 px-4 py-4 text-white shadow-md shadow-blue-600/25">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-sm">
        <img
          src={logoScorify.src}
          alt="Logo Scorify"
          className="size-full object-contain"
          draggable={false}
        />
      </span>
      <span className="leading-tight">
        <span className="block text-base font-bold tracking-wide">Scorify</span>
        <span className="block text-[11px] font-medium text-blue-100">
          Pencatat Nilai Siswa
        </span>
      </span>
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const cls = (aktif: boolean) =>
    `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
      aktif
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'text-slate-600 hover:bg-primary/10 hover:text-primary'
    }`;
  return (
    <nav className="space-y-1" aria-label="Navigasi utama">
      <Link to="/" className={cls(pathname === '/')} onClick={onNavigate}>
        <LayoutDashboard className="size-5" aria-hidden /> Dashboard
      </Link>
      <Link
        to="/rekap"
        className={cls(pathname.startsWith('/rekap'))}
        onClick={onNavigate}
      >
        <BarChart3 className="size-5" aria-hidden /> Rekap Nilai
      </Link>
      <Link
        to="/pengaturan"
        className={cls(pathname.startsWith('/pengaturan'))}
        onClick={onNavigate}
      >
        <Settings className="size-5" aria-hidden /> Pengaturan
      </Link>
    </nav>
  );
}

function SidebarDesktop() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r bg-sidebar px-4 py-5 md:flex">
      <div className="space-y-6">
        <Link to="/" aria-label="Ke dashboard" className="block">
          <LogoBlok />
        </Link>
        <NavItems />
      </div>
      <div className="space-y-3">
        <div className="rounded-lg bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-800">
          <strong className="font-semibold">Offline-first.</strong> Data tersimpan di perangkat
          Anda &amp; tersinkron ke Google Sheets.
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          v1.11 · Dibuat untuk Guru Indonesia
        </p>
      </div>
    </aside>
  );
}

/** Bottom navigation bar untuk ponsel (PRD 7.8): Dashboard | Rekap | Pengaturan. */
function BottomNav() {
  const { pathname } = useLocation();
  const items = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, aktif: pathname === '/' },
    { to: '/rekap', label: 'Rekap', icon: BarChart3, aktif: pathname.startsWith('/rekap') },
    {
      to: '/pengaturan',
      label: 'Pengaturan',
      icon: Settings,
      aktif: pathname.startsWith('/pengaturan'),
    },
  ];
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-white md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto grid max-w-md grid-cols-3">
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            aria-current={it.aktif ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              it.aktif ? 'text-primary' : 'text-slate-500 active:text-primary'
            }`}
          >
            <it.icon className="size-5" aria-hidden />
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function judulHalaman(pathname: string): string {
  if (pathname.startsWith('/kelas')) return 'Detail Kelas';
  if (pathname.startsWith('/rekap')) return 'Rekap Nilai';
  if (pathname.startsWith('/pengaturan')) return 'Pengaturan';
  return 'Dashboard';
}

function Header() {
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-14 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <h1 className="text-base font-semibold sm:text-lg">{judulHalaman(pathname)}</h1>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <SyncIndicator />
          <span
            className="hidden items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-3 sm:flex"
            title="Mode guru: data milik Anda sendiri"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-white">
              <GraduationCap className="size-4" aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block text-xs font-semibold">Guru</span>
              <span className="block text-[10px] text-muted-foreground">Offline-first aktif</span>
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t bg-white py-3 text-center text-xs text-muted-foreground">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        © {new Date().getFullYear()} Scorify. Data milik Anda: tersimpan offline di perangkat
        &amp; tersinkron ke Google Sheets.
      </div>
    </footer>
  );
}

function BannerOffline() {
  const online = useSyncStore((s) => s.online);
  const status = useSyncStore((s) => s.status);
  const pending = useSyncStore((s) => s.pending);
  if (online) return null;
  if (status === 'belum-setup') return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      Mode Offline: perubahan tersimpan di perangkat
      {pending > 0 ? ` (${pending} menunggu)` : ''} dan akan tersinkron otomatis saat online.
    </div>
  );
}

export function AppRoot() {
  useEffect(() => {
    initSync();
  }, []);

  return (
    <HashRouter>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <SidebarDesktop />
        <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <Header />
          <BannerOffline />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/kelas/:id" element={<KelasPage />} />
              <Route path="/rekap" element={<RekapPage />} />
              <Route path="/pengaturan" element={<Pengaturan />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </main>
          <Footer />
        </div>
        <BottomNav />
      </div>
    </HashRouter>
  );
}
