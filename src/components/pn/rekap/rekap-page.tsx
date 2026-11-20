'use client';

// Halaman Rekap Nilai: menu terpisah di bawah Dashboard (permintaan guru: rekap tidak lagi
// diletakkan di dalam detail kelas). Guru memilih kelas lewat dropdown dan kategori ujian
// (PRD v1.7 7.3), lalu rekap lengkap tampil di bawah. Kelas & kategori terpilih tersimpan
// di hash URL (#/rekap?kelas=…&kategori=…) supaya bisa di-bookmark / di-refresh.
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '@/lib/pn/db';
import type { Kategori } from '@/lib/pn/types';
import { RekapTab } from './rekap-tab';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, ChevronRight, Layers } from 'lucide-react';

export function RekapPage() {
  const kelas = useLiveQuery(() => db.kelas.toArray(), []);
  const [params, setParams] = useSearchParams();

  const daftar = useMemo(
    () => [...(kelas ?? [])].sort((a, b) => a.nama.localeCompare(b.nama, 'id')),
    [kelas]
  );

  const idDariUrl = params.get('kelas') ?? '';
  const dipilih = daftar.some((k) => k.id === idDariUrl) ? idDariUrl : (daftar[0]?.id ?? '');

  const kategori = useLiveQuery<Kategori[]>(
    async () =>
      dipilih ? db.kategori.where('idKelas').equals(dipilih).toArray() : [],
    [dipilih]
  );
  const kategoriSorted = useMemo(
    () => [...(kategori ?? [])].sort((a, b) => a.nama.localeCompare(b.nama)),
    [kategori]
  );

  // Kategori terpilih dari URL; kembali ke "semua" bila id tidak valid.
  const katUrl = params.get('kategori') ?? 'semua';
  const katValid = katUrl === 'semua' || kategoriSorted.some((k) => k.id === katUrl);
  const katDipilih = katValid ? katUrl : 'semua';

  const ubahPilihan = (kelasId: string, kategoriId: string) => {
    setParams(
      { kelas: kelasId, ...(kategoriId !== 'semua' ? { kategori: kategoriId } : {}) },
      { replace: true }
    );
  };

  if (!kelas) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!daftar.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BarChart3 className="size-6" aria-hidden />
          </span>
          <p className="text-sm text-muted-foreground">
            Belum ada kelas. Buat kelas dan input nilai dulu di Dashboard untuk melihat rekap.
          </p>
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            Ke Dashboard <ChevronRight className="size-4" aria-hidden />
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <label
            htmlFor="pilih-kelas-rekap"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <BarChart3 className="size-4 text-primary" aria-hidden /> Pilih kelas
          </label>
          <Select
            value={dipilih}
            onValueChange={(v) => ubahPilihan(v, katDipilih)}
          >
            <SelectTrigger
              id="pilih-kelas-rekap"
              className="min-h-11 w-full sm:w-56"
              aria-label="Pilih kelas untuk rekap"
            >
              <SelectValue placeholder="Pilih kelas" />
            </SelectTrigger>
            <SelectContent>
              {daftar.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label
            htmlFor="pilih-kategori-rekap"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <Layers className="size-4 text-primary" aria-hidden /> Kategori
          </label>
          <Select value={katDipilih} onValueChange={(v) => ubahPilihan(dipilih, v)}>
            <SelectTrigger
              id="pilih-kategori-rekap"
              className="min-h-11 w-full sm:w-72"
              aria-label="Pilih kategori ujian untuk rekap"
            >
              <SelectValue placeholder="Semua kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua kategori (nilai akhir berbobot)</SelectItem>
              {kategoriSorted.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.nama} (bobot {k.bobot})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-xs text-muted-foreground sm:ml-auto sm:text-right">
            {katDipilih === 'semua'
              ? 'Nilai akhir per mapel, rata-rata, ranking, dan ekspor Excel kelas terpilih.'
              : 'Rata-rata kategori terpilih per mapel; ranking dihitung ulang.'}
          </p>
        </CardContent>
      </Card>

      {dipilih && (
        <RekapTab
          key={`${dipilih}|${katDipilih}`}
          idKelas={dipilih}
          idKategoriFilter={katDipilih === 'semua' ? null : katDipilih}
        />
      )}
    </div>
  );
}
