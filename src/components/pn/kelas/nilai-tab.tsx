'use client';

// Tab Nilai (PRD 7.2): matrik siswa × mapel per ujian, inline edit, autosave instan ke IndexedDB.
// Tabel berwarna (PRD v1.9): header biru SRMS teks putih, zebra, garis batas sel tegas (slate-300),
// konsisten dengan tabel rekap; tulisan bobot tidak ditampilkan di area ujian (permintaan guru).
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/pn/db';
import {
  buatKategori, buatUjian, ubahUjian, hapusUjianCascade, saranNamaUjian,
  setNilai, NamaDuplikatError,
} from '@/lib/pn/ops';
import { afterMutation } from '@/lib/pn/sync/engine';
import { KATEGORI_PRESET_NAMA } from '@/lib/pn/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Plus, MoreVertical, Pencil, Trash2, Zap } from 'lucide-react';

interface Props {
  idKelas: string;
}

interface DraftUjian {
  id?: string;
  idKategori: string;
  nama: string;
  tanggal: string;
  /** true bila nama masih saran otomatis → boleh ditimpa saat kategori diganti. */
  namaOtomatis?: boolean;
}

function parseNilai(text: string): number | null | 'invalid' {
  const t = text.trim().replace(',', '.');
  if (t === '') return null; // kosongkan = hapus nilai
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 100) return 'invalid';
  return n;
}

export function NilaiTab({ idKelas }: Props) {
  const { toast } = useToast();
  const kategori = useLiveQuery(
    () => db.kategori.where('idKelas').equals(idKelas).toArray(),
    [idKelas]
  );
  const ujian = useLiveQuery(
    () => db.ujian.where('idKelas').equals(idKelas).toArray(),
    [idKelas]
  );
  const siswa = useLiveQuery(
    () => db.siswa.where('idKelas').equals(idKelas).toArray(),
    [idKelas]
  );
  const mapel = useLiveQuery(
    () => db.mapel.where('idKelas').equals(idKelas).toArray(),
    [idKelas]
  );
  const nilai = useLiveQuery(async () => {
    const ujianIds = await db.ujian.where('idKelas').equals(idKelas).primaryKeys();
    return db.nilai.where('idUjian').anyOf(ujianIds as string[]).toArray();
  }, [idKelas]);

  const katSorted = useMemo(
    () => [...(kategori ?? [])].sort((a, b) => a.nama.localeCompare(b.nama)),
    [kategori]
  );
  const mapelSorted = useMemo(
    () => [...(mapel ?? [])].sort((a, b) => a.urutan - b.urutan),
    [mapel]
  );
  const siswaSorted = useMemo(
    () =>
      [...(siswa ?? [])].sort(
        (a, b) => (a.absen ?? 999) - (b.absen ?? 999) || a.nama.localeCompare(b.nama)
      ),
    [siswa]
  );
  const ujianByKategori = useMemo(() => {
    const map = new Map<string, NonNullable<typeof ujian>>();
    for (const u of ujian ?? []) {
      const list = map.get(u.idKategori) ?? [];
      list.push(u);
      map.set(u.idKategori, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.nama.localeCompare(b.nama, 'id', { numeric: true }));
    }
    return map;
  }, [ujian]);

  const [dipilih, setDipilih] = useState<string | null>(null);

  // Ujian aktif: pilihan guru bila masih valid, selain itu ujian pertama (derived, tanpa effect).
  const ujianAktif = useMemo(() => {
    if (dipilih && (ujian ?? []).some((u) => u.id === dipilih)) return dipilih;
    const pertama = katSorted
      .flatMap((k) => ujianByKategori.get(k.id) ?? [])
      .map((u) => u.id);
    return pertama[0] ?? null;
  }, [dipilih, ujian, katSorted, ujianByKategori]);

  const nilaiKeyMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nilai ?? []) {
      m.set(`${n.idSiswa}|${n.idMapel}|${n.idUjian}`, n.nilai);
    }
    return m;
  }, [nilai]);

  // Buffer sel yang sedang diedit (agar tidak bentrok dengan live update).
  const [buffer, setBuffer] = useState<{ key: string; text: string } | null>(null);

  const displayValue = (key: string): string => {
    if (buffer?.key === key) return buffer.text;
    const v = nilaiKeyMap.get(key);
    return v != null ? String(v) : '';
  };

  const commit = async (key: string, idSiswa: string, idMapel: string, text: string) => {
    setBuffer(null);
    const hasil = parseNilai(text);
    if (hasil === 'invalid') {
      toast({ title: 'Nilai harus angka 0-100', variant: 'destructive' });
      return;
    }
    const sekarang = nilaiKeyMap.get(key);
    if (hasil === null ? sekarang == null : hasil === sekarang) return;
    try {
      await setNilai(idSiswa, idMapel, ujianAktif as string, hasil);
      await afterMutation();
    } catch (e) {
      toast({
        title: 'Gagal menyimpan nilai',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  };

  // Dialog tambah/ubah ujian
  const [dialogUjian, setDialogUjian] = useState<DraftUjian | null>(null);
  const [dialogKategoriBaru, setDialogKategoriBaru] = useState(false);
  const [namaKategoriBaru, setNamaKategoriBaru] = useState('');
  const [bobotKategoriBaru, setBobotKategoriBaru] = useState('1');
  const [hapusTarget, setHapusTarget] = useState<{ id: string; nama: string; nilai: number } | null>(null);

  // Guru memilih kategori sendiri di dialog, tidak otomatis kategori pertama (permintaan guru).
  const bukaDialogTambah = () => {
    setDialogUjian({ idKategori: '', nama: '', tanggal: '', namaOtomatis: true });
    setDialogKategoriBaru(katSorted.length === 0); // belum ada kategori → tawarkan buat langsung
    setNamaKategoriBaru('');
    setBobotKategoriBaru('1');
  };

  const pilihKategoriDiDialog = async (idKategori: string) => {
    const namaSaran = await saranNamaUjian(idKelas, idKategori);
    setDialogUjian((d) =>
      d
        ? {
            ...d,
            idKategori,
            nama: d.namaOtomatis || !d.nama.trim() ? namaSaran : d.nama,
            namaOtomatis: true,
          }
        : d
    );
  };

  const simpanUjian = async () => {
    if (!dialogUjian) return;
    if (!dialogUjian.idKategori) {
      toast({ title: 'Pilih kategori terlebih dahulu', description: 'Ujian harus masuk ke salah satu kategori.', variant: 'destructive' });
      return;
    }
    const nama = dialogUjian.nama.trim();
    if (!nama) {
      toast({ title: 'Nama ujian wajib diisi', variant: 'destructive' });
      return;
    }
    try {
      if (dialogUjian.id) {
        await ubahUjian(dialogUjian.id, dialogUjian.idKategori, nama, dialogUjian.tanggal || null);
        toast({ title: 'Ujian diperbarui' });
      } else {
        const baru = await buatUjian(idKelas, dialogUjian.idKategori, nama, dialogUjian.tanggal || null);
        setDipilih(baru.id);
        toast({ title: `Ujian "${nama}" dibuat`, description: 'Matriks siap diisi, perubahan tersimpan instan.' });
      }
      await afterMutation();
      setDialogUjian(null);
    } catch (e) {
      toast({
        title: e instanceof NamaDuplikatError ? 'Nama sudah dipakai' : 'Gagal menyimpan ujian',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  };

  const tambahKategoriCepat = async () => {
    const nama = namaKategoriBaru.trim();
    if (!nama) return;
    try {
      const kat = await buatKategori(idKelas, nama, Number(bobotKategoriBaru) || 1);
      await afterMutation();
      setNamaKategoriBaru('');
      setBobotKategoriBaru('1');
      setDialogKategoriBaru(false);
      const namaSaran = await saranNamaUjian(idKelas, kat.id);
      setDialogUjian((d) => (d ? { ...d, idKategori: kat.id, nama: namaSaran, namaOtomatis: true } : d));
      toast({ title: `Kategori "${nama}" ditambahkan` });
    } catch (e) {
      toast({
        title: 'Gagal menambah kategori',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  };

  const uhBerikutnya = async () => {
    const kat = katSorted.find((k) => k.nama === 'Ulangan Harian');
    if (!kat) {
      toast({ title: 'Kategori "Ulangan Harian" tidak ada', description: 'Tambah dulu di tab Data Kelas.' });
      return;
    }
    const nama = await saranNamaUjian(idKelas, kat.id);
    try {
      const u = await buatUjian(idKelas, kat.id, nama, null);
      await afterMutation();
      setDipilih(u.id);
      toast({ title: `Ujian "${nama}" dibuat` });
    } catch (e) {
      toast({
        title: 'Gagal membuat ujian',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  };

  const ujianDipilih = (ujian ?? []).find((u) => u.id === ujianAktif);
  const kategoriDipilih = kategoriDipilihFn(katSorted, ujianDipilih);

  const belumLengkap = !siswaSorted.length || !mapelSorted.length;

  if (!kategori || !ujian || !siswa || !mapel || !nilai) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Memuat…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Pemilih ujian per kategori (PRD 7.2) */}
      <div className="space-y-3">
        {katSorted.map((k) => {
          const daftar = ujianByKategori.get(k.id) ?? [];
          return (
            <div key={k.id} className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="min-h-8 px-3">
                {k.nama}
              </Badge>
              {daftar.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setDipilih(u.id)}
                  className={`min-h-11 rounded-md border px-4 text-sm font-medium transition-colors ${
                    ujianAktif === u.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-muted'
                  }`}
                >
                  {u.nama}
                </button>
              ))}
            </div>
          );
        })}
        {katSorted.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Belum ada kategori/ujian. Buka tab <strong>Data Kelas</strong> atau tombol di bawah.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-11" onClick={bukaDialogTambah}>
            <Plus className="size-4" /> Tambah Ujian
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={uhBerikutnya}>
            <Zap className="size-4" /> UH berikutnya
          </Button>
        </div>
      </div>

      {/* Info ujian aktif + aksi */}
      {ujianDipilih && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            Mengisi: <strong className="text-foreground">{ujianDipilih.nama}</strong>
            {kategoriDipilih ? ` (${kategoriDipilih.nama})` : ''}
            {ujianDipilih.tanggal ? ` · ${ujianDipilih.tanggal}` : ''}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9" aria-label="Aksi ujian">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() =>
                  setDialogUjian({
                    id: ujianDipilih.id,
                    idKategori: ujianDipilih.idKategori,
                    nama: ujianDipilih.nama,
                    tanggal: ujianDipilih.tanggal ?? '',
                    namaOtomatis: false,
                  })
                }
              >
                <Pencil className="size-4" /> Ubah ujian
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={async () => {
                  const jml = await db.nilai.where('idUjian').equals(ujianDipilih.id).count();
                  setHapusTarget({ id: ujianDipilih.id, nama: ujianDipilih.nama, nilai: jml });
                }}
              >
                <Trash2 className="size-4" /> Hapus ujian
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {belumLengkap ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Tambahkan minimal <strong>1 siswa</strong> dan <strong>1 mapel</strong> di tab{' '}
            <strong>Data Kelas</strong> untuk mulai mengisi nilai.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Matriks desktop, grid penuh bergaris jelas (border-separate agar kolom sticky tetap bergaris) */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-300 bg-white md:block">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-12 min-w-12 border-b border-r border-slate-300 bg-blue-700 px-2 py-2 text-center font-semibold text-white">No</th>
                  <th className="sticky left-12 z-10 min-w-44 border-b border-r border-slate-300 bg-blue-700 px-3 py-2 text-left font-semibold text-white">Nama Siswa</th>
                  {mapelSorted.map((m) => (
                    <th key={m.id} className="min-w-24 border-b border-r border-slate-300 bg-blue-700 px-2 py-2 text-center font-semibold text-white last:border-r-0">{m.nama}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {siswaSorted.map((s, i) => {
                  const zebra = i % 2 === 1 ? 'bg-slate-50' : 'bg-white';
                  return (
                    <tr key={s.id} className={zebra}>
                      <td className={`sticky left-0 z-10 w-12 min-w-12 border-b border-r border-slate-300 px-2 py-1 text-center text-muted-foreground ${zebra}`}>
                        {s.absen ?? i + 1}
                      </td>
                      <td className={`sticky left-12 z-10 border-b border-r border-slate-300 px-3 py-1 font-medium ${zebra}`}>
                        {s.nama}
                      </td>
                      {mapelSorted.map((m) => {
                        const key = `${s.id}|${m.id}|${ujianAktif}`;
                        return (
                          <td
                            key={m.id}
                            className={`border-b border-r border-slate-300 p-1 last:border-r-0 has-[input:focus]:border-primary has-[input:focus]:bg-primary/5 ${
                              buffer?.key === key ? 'border-primary bg-primary/5' : ''
                            }`}
                          >
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`Nilai ${s.nama} pada ${m.nama}`}
                              className="h-11 w-full rounded-md bg-transparent px-2 text-center outline-none focus:bg-white"
                              value={displayValue(key)}
                              onFocus={() => setBuffer({ key, text: displayValue(key) })}
                              onChange={(e) => setBuffer({ key, text: e.target.value })}
                              onBlur={(e) => void commit(key, s.id, m.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Kartu mobile (PRD 7.4) */}
          <div className="space-y-3 md:hidden">
            {siswaSorted.map((s, i) => (
              <Card key={s.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-baseline justify-between">
                    <p className="font-medium">{s.nama}</p>
                    <span className="text-xs text-muted-foreground">No. {s.absen ?? i + 1}</span>
                  </div>
                  {mapelSorted.map((m) => {
                    const key = `${s.id}|${m.id}|${ujianAktif}`;
                    return (
                      <div key={m.id} className="flex items-center gap-2">
                        <span className="flex-1 text-sm text-muted-foreground">{m.nama}</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Nilai ${s.nama} pada ${m.nama}`}
                          className="h-11 w-24 rounded border bg-transparent px-2 text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          value={displayValue(key)}
                          onFocus={() => setBuffer({ key, text: displayValue(key) })}
                          onChange={(e) => setBuffer({ key, text: e.target.value })}
                          onBlur={(e) => void commit(key, s.id, m.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                          }}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Kosongkan sel dan pindah kursor = nilai dihapus. Nilai di luar 0-100 ditolak.
          </p>
        </>
      )}

      {/* Dialog tambah/ubah ujian */}
      <Dialog open={!!dialogUjian} onOpenChange={(v) => !v && setDialogUjian(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialogUjian?.id ? 'Ubah Ujian' : 'Tambah Ujian'}</DialogTitle>
            <DialogDescription>
              Nama ujian bebas (mis. Ulangan Harian 1, UTS, Praktik). Ujian baru tidak mengganggu ujian lain.
            </DialogDescription>
          </DialogHeader>
          {dialogUjian && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Kategori</Label>
                {katSorted.length > 0 && (
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pilih kategori ujian">
                    {katSorted.map((k) => {
                      const aktif = dialogUjian.idKategori === k.id;
                      return (
                        <button
                          key={k.id}
                          type="button"
                          role="radio"
                          aria-checked={aktif}
                          onClick={() => void pilihKategoriDiDialog(k.id)}
                          className={`min-h-10 rounded-lg border px-3 text-sm font-medium transition-colors ${
                            aktif
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-primary/50 hover:bg-primary/5'
                          }`}
                        >
                          {k.nama}
                        </button>
                      );
                    })}
                  </div>
                )}
                {!dialogKategoriBaru && (
                  <button
                    type="button"
                    onClick={() => setDialogKategoriBaru(true)}
                    className="min-h-9 w-fit rounded-lg border border-dashed border-slate-300 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    + Kategori baru…
                  </button>
                )}
                {dialogKategoriBaru && (
                  <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                    <div className="flex gap-2">
                      <Input
                        className="min-h-11 flex-1"
                        placeholder="Nama kategori baru"
                        value={namaKategoriBaru}
                        onChange={(e) => setNamaKategoriBaru(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void tambahKategoriCepat()}
                      />
                      <Input
                        type="number"
                        min={0}
                        className="w-20 min-h-11 text-center"
                        aria-label="Bobot kategori baru"
                        value={bobotKategoriBaru}
                        onChange={(e) => setBobotKategoriBaru(e.target.value)}
                      />
                      <Button variant="outline" className="min-h-11" onClick={tambahKategoriCepat}>
                        Tambah
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {KATEGORI_PRESET_NAMA.map((n) => (
                        <button
                          key={n}
                          type="button"
                          className="min-h-9 rounded border border-slate-300 bg-white px-2 text-xs hover:border-primary/50 hover:bg-primary/5"
                          onClick={() => setNamaKategoriBaru(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!dialogUjian.idKategori && (
                  <p className="text-xs text-muted-foreground">
                    Pilih kategori tempat ujian ini masuk.
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nama-ujian">Nama ujian</Label>
                <Input
                  id="nama-ujian"
                  className="min-h-11"
                  placeholder={dialogUjian.idKategori ? 'Mis. UH1, UTS1, Praktik 1' : 'Pilih kategori dulu, nama terisi otomatis'}
                  value={dialogUjian.nama}
                  onChange={(e) => setDialogUjian({ ...dialogUjian, nama: e.target.value, namaOtomatis: false })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tanggal-ujian">Tanggal (opsional)</Label>
                <Input
                  id="tanggal-ujian"
                  type="date"
                  className="min-h-11"
                  value={dialogUjian.tanggal}
                  onChange={(e) => setDialogUjian({ ...dialogUjian, tanggal: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setDialogUjian(null)}>
              Batal
            </Button>
            <Button className="min-h-11" onClick={simpanUjian}>
              {dialogUjian?.id ? 'Simpan' : 'Buat Ujian'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus ujian */}
      <AlertDialog open={!!hapusTarget} onOpenChange={(v) => !v && setHapusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus ujian &quot;{hapusTarget?.nama}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh nilai pada ujian ini akan ikut terhapus
              {hapusTarget && hapusTarget.nilai > 0 ? ` (${hapusTarget.nilai} nilai)` : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!hapusTarget) return;
                await hapusUjianCascade(hapusTarget.id);
                await afterMutation();
                toast({ title: `Ujian "${hapusTarget.nama}" dihapus` });
                setHapusTarget(null);
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function kategoriDipilihFn(
  kat: Array<{ id: string; nama: string }>,
  ujianAktif?: { idKategori: string }
) {
  if (!ujianAktif) return null;
  return kat.find((k) => k.id === ujianAktif.idKategori) ?? null;
}
