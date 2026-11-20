'use client';

// Pengaturan (PRD v1.8 & v1.9, revisi v1.10): hanya status sinkronisasi, tanpa setup apa pun.
// URL Web App ditanam saat build (NEXT_PUBLIC_GAS_URL), sehingga aplikasi hasil deploy
// langsung siap dipakai begitu dibuka.
// v1.9: kartu penjelasan "Mode Data Lokal" disembunyikan; status cukup tampil ringkas (badge + satu baris).
// v1.10: URL Web App tidak ditampilkan sama sekali dan kartu "Tentang Koneksi Ini" dihapus
//        (permintaan guru: cukup status, detail koneksi tidak perlu terlihat pengguna).
import { useEffect, useState } from 'react';
import { getGasUrlDetail, type GasUrlInfo } from '@/lib/pn/db';
import { syncNow } from '@/lib/pn/sync/engine';
import { useSyncStore } from '@/lib/pn/sync/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Database, RefreshCw, Wifi, WifiOff,
} from 'lucide-react';

export function Pengaturan() {
  const sync = useSyncStore();
  const [info, setInfo] = useState<GasUrlInfo>({ url: null, sumber: null });

  useEffect(() => {
    void getGasUrlDetail().then(setInfo);
  }, []);

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
