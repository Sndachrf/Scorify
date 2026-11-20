'use client';

// Pengaturan (PRD v1.8 & v1.9): hanya status sinkronisasi, tanpa setup apa pun.
// URL Web App ditanam saat build (NEXT_PUBLIC_GAS_URL), sehingga aplikasi hasil deploy
// langsung siap dipakai begitu dibuka. URL tetap ditutup sebagian (permintaan v1.7).
// v1.9: kartu penjelasan "Mode Data Lokal" disembunyikan; status cukup tampil ringkas (badge + satu baris).
import { useEffect, useState } from 'react';
import { getGasUrlDetail, type GasUrlInfo } from '@/lib/pn/db';
import { syncNow } from '@/lib/pn/sync/engine';
import { useSyncStore } from '@/lib/pn/sync/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2, Copy, Database, Eye, EyeOff, RefreshCw, ShieldAlert, Wifi, WifiOff,
} from 'lucide-react';

/** Sembunyikan bagian tengah URL (PRD v1.7 7.7): hanya sebagian awal dan akhir yang tampil. */
function maskUrl(url: string): string {
  const m = url.match(/^(https:\/\/script\.google\.com\/macros\/s\/)([^/]+)(\/.*)$/);
  if (!m) {
    return url.length <= 24 ? url : `${url.slice(0, 24)}…`;
  }
  const id = m[2];
  const potongan = id.length <= 10 ? id : `${id.slice(0, 6)}…${id.slice(-2)}`;
  return `${m[1]}${potongan}${m[3]}`;
}

export function Pengaturan() {
  const { toast } = useToast();
  const sync = useSyncStore();
  const [info, setInfo] = useState<GasUrlInfo>({ url: null, sumber: null });
  const [lihatUrl, setLihatUrl] = useState(false);

  useEffect(() => {
    void getGasUrlDetail().then(setInfo);
  }, []);

  const salinUrl = async () => {
    if (!info.url) return;
    try {
      await navigator.clipboard.writeText(info.url);
      toast({ title: 'URL disalin', description: 'Tempel hanya di tempat yang aman.' });
    } catch {
      toast({ title: 'Gagal menyalin', description: 'Tampilkan URL lalu salin manual.', variant: 'destructive' });
    }
  };

  const terhubung = info.sumber != null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">
          {terhubung
            ? 'Aplikasi siap dipakai: koneksi Google Sheets sudah terpasang otomatis, tidak ada yang perlu disetel di sini.'
            : 'Aplikasi berjalan dalam mode data lokal: semua fitur bisa dipakai tanpa koneksi cloud.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status Sinkronisasi</CardTitle>
          <CardDescription>
            Semua perubahan tersimpan instan di perangkat; koneksi Google Sheets hanya untuk
            sinkronisasi antar perangkat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              {sync.online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
              {sync.online ? 'Online' : 'Offline'}
            </Badge>
            {terhubung ? (
              <Badge variant="outline" className="gap-1.5">
                <CheckCircle2 className="size-3.5" /> Terhubung ke Google Sheets
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1.5">
                <Database className="size-3.5" /> Mode data lokal: tanpa sinkronisasi
              </Badge>
            )}
            {sync.pending > 0 && <Badge variant="secondary">{sync.pending} perubahan menunggu</Badge>}
          </div>
          <p className="text-muted-foreground">
            Sinkron terakhir:{' '}
            {sync.lastSync ? new Date(sync.lastSync).toLocaleString('id-ID') : 'belum pernah'}
          </p>
          {info.url && (
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                URL Web App terpasang
                {info.sumber === 'build' ? ' (ditanam saat build)' : ' (tersimpan di perangkat)'}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <code
                  className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 font-mono text-xs"
                  title={lihatUrl ? info.url : undefined}
                >
                  {lihatUrl ? info.url : maskUrl(info.url)}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-10 shrink-0"
                  aria-label={lihatUrl ? 'Sembunyikan URL' : 'Tampilkan URL'}
                  aria-pressed={lihatUrl}
                  onClick={() => setLihatUrl((v) => !v)}
                >
                  {lihatUrl ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-10 shrink-0"
                  aria-label="Salin URL"
                  onClick={() => void salinUrl()}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                URL tertutup sebagian secara default untuk menjaga kerahasiaannya.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={!terhubung}
              onClick={() => void syncNow()}
            >
              <RefreshCw className="size-4" /> Sinkronkan sekarang
            </Button>
          </div>
          {sync.status === 'gagal' && sync.pesanGagal && (
            <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              Gagal: {sync.pesanGagal}. Akan dicoba ulang otomatis.
            </p>
          )}
        </CardContent>
      </Card>

      {terhubung && (
        <Card>
          <CardHeader>
            <CardTitle>Tentang Koneksi Ini</CardTitle>
            <CardDescription>
              Koneksi dipasang saat aplikasi dibangun (build), bukan di halaman ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              URL Web App Google Apps Script ditanam ke aplikasi saat build (secret
              GAS_WEB_APP_URL di repository GitHub). Karena itu aplikasi langsung terhubung
              begitu dibuka, di perangkat mana pun.
            </p>
            <p>
              Perlu ganti koneksi (misal pindah ke spreadsheet baru)? Ikuti panduan deploy yang
              menyertai proyek: deploy ulang skrip, perbarui secret, lalu deploy ulang aplikasi.
              Tidak ada yang perlu diubah di perangkat ini.
            </p>
            <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <p>
                Jaga kerahasiaan URL dan tautan aplikasi: siapa pun yang memegang URL
                <code className="mx-1">/exec</code>
                dapat membaca dan mengubah data. Jangan menampilkan halaman ini saat layar
                diproyeksikan. Jangan mengubah tab nilai langsung di Google Sheets (gunakan
                aplikasi ini) agar data tidak rusak.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Mode Offline</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Saat offline, aplikasi tetap berfungsi penuh: input nilai, kelola data master, bahkan
            impor Excel. Perubahan masuk antrean dan otomatis terkirim ke Google Sheets saat
            kembali online (indikator di header memantau statusnya).
          </p>
          <p className="mt-2">
            Data yang sudah tersinkron aman di Google Sheets dan bisa dipulihkan di perangkat
            lain yang membuka aplikasi yang sama.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
