'use client';

// Halaman Detail Kelas: tab Nilai (matrik per ujian) & Data Kelas (master).
// Rekap dipindah ke menu tersendiri di bawah Dashboard (rute /rekap), permintaan guru.
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, Link } from 'react-router-dom';
import { db } from '@/lib/pn/db';
import { hapusKelasCascade } from '@/lib/pn/ops';
import { afterMutation } from '@/lib/pn/sync/engine';
import { NilaiTab } from './nilai-tab';
import { DataTab } from './data-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export function KelasPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const kelas = useLiveQuery(async () => (id ? db.kelas.get(id) : undefined), [id]);
  const jumlahSiswa = useLiveQuery(async () => (id ? db.siswa.where('idKelas').equals(id).count() : 0), [id]);
  const jumlahNilai = useLiveQuery(async () => {
    if (!id) return 0;
    const ujianIds = (await db.ujian.where('idKelas').equals(id).toArray()).map((u) => u.id);
    const siswaIds = (await db.siswa.where('idKelas').equals(id).toArray()).map((s) => s.id);
    return db.nilai.where('idUjian').anyOf(ujianIds).filter((n) => siswaIds.includes(n.idSiswa)).count();
  }, [id]);
  const [konfirmHapus, setKonfirmHapus] = useState(false);

  if (!kelas) {
    return id ? (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <div className="text-center text-sm text-muted-foreground">
          Kelas tidak ditemukan?{' '}
          <Link to="/" className="underline">Kembali ke dashboard</Link>
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="size-11" aria-label="Kembali">
            <Link to="/">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold leading-tight">{kelas.nama}</h1>
            <p className="text-sm text-muted-foreground">
              {kelas.tahunAjaran} · {jumlahSiswa ?? 0} siswa · {jumlahNilai ?? 0} nilai tercatat
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="min-h-11 text-destructive hover:text-destructive"
          onClick={() => setKonfirmHapus(true)}
        >
          <Trash2 className="size-4" /> Hapus Kelas
        </Button>
      </div>

      <Tabs defaultValue="nilai">
        <TabsList className="h-11 w-full sm:w-auto">
          <TabsTrigger value="nilai" className="min-h-11 flex-1 sm:flex-none">Nilai</TabsTrigger>
          <TabsTrigger value="data" className="min-h-11 flex-1 sm:flex-none">Data Kelas</TabsTrigger>
        </TabsList>
        <TabsContent value="nilai" className="mt-4">
          <NilaiTab idKelas={kelas.id} />
        </TabsContent>
        <TabsContent value="data" className="mt-4">
          <DataTab idKelas={kelas.id} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={konfirmHapus} onOpenChange={setKonfirmHapus}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus kelas &quot;{kelas.nama}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh siswa, mapel, kategori, ujian, dan seluruh nilai di kelas ini akan
              terhapus permanen dan ikut antrean sinkron.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                await hapusKelasCascade(kelas.id);
                await afterMutation();
                toast({ title: 'Kelas dihapus' });
                setKonfirmHapus(false);
              }}
            >
              Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
