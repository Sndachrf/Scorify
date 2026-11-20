'use client';

// Scorify — Aplikasi Pencatat Nilai Siswa (PRD v1.7), SPA offline-first di dalam route /.
// Semua routing memakai hash (aman untuk GitHub Pages), data di IndexedDB + sinkron GAS.
// Aplikasi 100% client-side (IndexedDB & HashRouter) → dirender hanya setelah mount di browser.
import { useSyncExternalStore } from 'react';
import { AppRoot } from '@/components/pn/app-root';
import { Skeleton } from '@/components/ui/skeleton';

const subscribeNoop = () => () => {};

export default function Home() {
  // true di client, false di server, pola resmi untuk menghindari SSR render client-only tree.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!mounted) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <div className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-8">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }
  return <AppRoot />;
}
