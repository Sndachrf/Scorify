'use client';

// Dashboard: daftar kelas + buat kelas (template kategori) + impor Excel (PRD 7.1, 7.4, 7.6).
import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/pn/db';
import {
  buatKelas,
  buatKategori,
  hapusKelasCascade,
  ubahKelas,
  NamaDuplikatError,
} from '@/lib/pn/ops';
import { muatContohData } from '@/lib/pn/sample';
import { parseWorkbook, imporData, type HasilParse } from '@/lib/pn/excel/import';
import { afterMutation } from '@/lib/pn/sync/engine';
import { KATEGORI_STANDAR, type KategoriDraft } from '@/lib/pn/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, FileUp, Trash2, Pencil, MoreVertical, Sparkles, Users, BookOpen, Layers,
  FileText, BarChart3,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';

interface DraftKategoriRow extends KategoriDraft {
  kunci: number;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const kelasList = useLiveQuery(() => db.kelas.toArray(), []);
  const jumlahSiswa = useLiveQuery(async () => {
    const all = await db.siswa.toArray();
    const map = new Map<string, number>();
    all.forEach((s) => map.set(s.idKelas, (map.get(s.idKelas) ?? 0) + 1));
    return map;
  }, []);
  const jumlahMapel = useLiveQuery(async () => {
    const all = await db.mapel.toArray();
    const map = new Map<string, number>();
    all.forEach((m) => map.set(m.idKelas, (map.get(m.idKelas) ?? 0) + 1));
    return map;
  }, []);
  const totalUjian = useLiveQuery(() => db.ujian.count(), []);
  const totalNilai = useLiveQuery(() => db.nilai.count(), []);

  const [dialogBuat, setDialogBuat] = useState(false);
  const [editKelas, setEditKelas] = useState<{ id: string; nama: string; tahunAjaran: string } | null>(null);
  const [hapusTarget, setHapusTarget] = useState<{ id: string; nama: string; sisa: number } | null>(null);
  const [muatContoh, setMuatContoh] = useState(false);

  // Form buat kelas
  const [namaKelas, setNamaKelas] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [template, setTemplate] = useState<'standar' | 'rata' | 'custom'>('standar');
  const [draftKategori, setDraftKategori] = useState<DraftKategoriRow[]>(() =>
    KATEGORI_STANDAR.map((k, i) => ({ ...k, kunci: i }))
  );
  const [menyimpan, setMenyimpan] = useState(false);

  // Impor
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasilParse, setHasilParse] = useState<HasilParse | null>(null);
  const [sedangImpor, setSedangImpor] = useState(false);

  const pilihTemplate = (mode: 'standar' | 'rata' | 'custom') => {
    setTemplate(mode);
    if (mode === 'standar') {
      setDraftKategori(KATEGORI_STANDAR.map((k, i) => ({ ...k, kunci: i })));
    } else if (mode === 'rata') {
      setDraftKategori([
        { nama: 'Ulangan Harian', bobot: 1, kunci: 0 },
        { nama: 'UTS', bobot: 1, kunci: 1 },
        { nama: 'UAS', bobot: 1, kunci: 2 },
      ]);
    }
  };

  const tahunDefault = useMemo(() => `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`, []);

  const bukaDialogBuat = () => {
    setNamaKelas('');
    setTahunAjaran(tahunDefault);
    setTemplate('standar');
    setDraftKategori(KATEGORI_STANDAR.map((k, i) => ({ ...k, kunci: i })));
    setDialogBuat(true);
  };

  const simpanKelas = async () => {
    if (!namaKelas.trim()) {
      toast({ title: 'Nama kelas wajib diisi', variant: 'destructive' });
      return;
    }
    const kategoriBersih = draftKategori.filter((k) => k.nama.trim());
    if (!kategoriBersih.length) {
      toast({ title: 'Minimal satu kategori ujian', variant: 'destructive' });
      return;
    }
    setMenyimpan(true);
    try {
      const kelas = await buatKelas(namaKelas.trim(), tahunAjaran.trim() || tahunDefault);
      for (const k of kategoriBersih) {
        await buatKategori(kelas.id, k.nama.trim(), Number(k.bobot) || 1);
      }
      await afterMutation();
      toast({ title: `Kelas "${kelas.nama}" dibuat`, description: 'Lanjutkan menambah siswa & mapel.' });
      setDialogBuat(false);
      navigate(`/kelas/${kelas.id}`);
    } catch (e) {
      toast({
        title: e instanceof NamaDuplikatError ? 'Nama sudah dipakai' : 'Gagal membuat kelas',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setMenyimpan(false);
    }
  };

  const simpanEdit = async () => {
    if (!editKelas) return;
    try {
      await ubahKelas(editKelas.id, editKelas.nama.trim(), editKelas.tahunAjaran.trim());
      await afterMutation();
      toast({ title: 'Kelas diperbarui' });
      setEditKelas(null);
    } catch (e) {
      toast({
        title: 'Gagal memperbarui',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  };

  const konfirmasiHapus = async () => {
    if (!hapusTarget) return;
    await hapusKelasCascade(hapusTarget.id);
    await afterMutation();
    toast({ title: `Kelas "${hapusTarget.nama}" dihapus`, description: 'Seluruh data kelas ikut terhapus.' });
    setHapusTarget(null);
  };

  const pilihFile = async (file: File) => {
    try {
      const hasil = await parseWorkbook(file);
      setHasilParse(hasil);
    } catch (e) {
      toast({
        title: 'File tidak dapat dibaca',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  };

  const jalankanImpor = async () => {
    if (!hasilParse) return;
    setSedangImpor(true);
    try {
      const idKelas = await imporData(hasilParse);
      await afterMutation();
      toast({ title: `Kelas "${hasilParse.kelasNama}" berhasil diimpor`, description: 'Seluruh kategori, ujian, dan nilai ter-restore.' });
      setHasilParse(null);
      navigate(`/kelas/${idKelas}`);
    } catch (e) {
      toast({
        title: 'Impor gagal',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSedangImpor(false);
    }
  };

  const kelasKosong = !kelasList || kelasList.length === 0;

  // Statistik ringkas gaya SRMS (kartu ikon berwarna).
  const totalSiswa = jumlahSiswa
    ? Array.from(jumlahSiswa.values()).reduce((a, b) => a + b, 0)
    : 0;
  const statCards = [
    { label: 'Total Kelas', nilai: kelasList?.length ?? 0, sub: 'Kelas aktif', icon: Layers, tile: 'bg-blue-100 text-blue-600' },
    { label: 'Total Siswa', nilai: totalSiswa, sub: 'Di semua kelas', icon: Users, tile: 'bg-emerald-100 text-emerald-600' },
    { label: 'Total Ujian', nilai: totalUjian ?? 0, sub: 'UH, UTS, UAS, dll.', icon: FileText, tile: 'bg-purple-100 text-purple-600' },
    { label: 'Nilai Tercatat', nilai: totalNilai ?? 0, sub: 'Sel nilai terisi', icon: BarChart3, tile: 'bg-amber-100 text-amber-600' },
  ];
  const jam = new Date().getHours();
  const salam = jam < 11 ? 'Selamat Pagi' : jam < 15 ? 'Selamat Siang' : jam < 19 ? 'Selamat Sore' : 'Selamat Malam';

  return (
    <div className="space-y-6">
      {/* Banner sambutan gaya SRMS */}
      <section className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-r from-blue-100/90 via-blue-50 to-white px-5 py-5 sm:px-6 sm:py-6">
        <svg
          viewBox="0 0 170 100"
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 hidden h-24 w-auto -translate-y-1/2 sm:block sm:right-8"
        >
          {/* tanaman */}
          <rect x="14" y="62" width="24" height="20" rx="3" fill="#3B82F6" />
          <path
            d="M26 62 C26 50 19 47 16 43 C23 45 25 50 26 55 C27 48 31 43 36 40 C31 47 28 52 26 62 Z"
            fill="#22C55E"
          />
          {/* tumpukan buku */}
          <rect x="60" y="72" width="100" height="15" rx="3" fill="#1D4ED8" />
          <rect x="67" y="57" width="93" height="15" rx="3" fill="#F59E0B" />
          <rect x="60" y="42" width="100" height="15" rx="3" fill="#10B981" />
          <rect x="67" y="27" width="93" height="15" rx="3" fill="#3B82F6" />
          <rect x="72" y="32" width="55" height="5" rx="2.5" fill="#DBEAFE" />
          <rect x="65" y="47" width="55" height="5" rx="2.5" fill="#D1FAE5" />
          <rect x="72" y="62" width="55" height="5" rx="2.5" fill="#FEF3C7" />
        </svg>
        <div className="relative z-10 max-w-lg">
          <p className="text-sm text-slate-500">{salam},</p>
          <h1 className="mt-0.5 text-2xl font-bold text-primary sm:text-[1.7rem]">
            Selamat datang kembali!
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Perbarui perjalanan akademik kelas Anda: setiap perubahan tersimpan otomatis di
            perangkat.
          </p>
        </div>
      </section>

      {/* Kartu statistik */}
      <section
        aria-label="Statistik ringkas"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        {statCards.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm"
          >
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${s.tile}`}
              aria-hidden
            >
              <s.icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">{s.label}</span>
              <span className="block text-2xl font-bold leading-tight">
                {s.nilai.toLocaleString('id-ID')}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{s.sub}</span>
            </span>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Kelas Saya</h2>
          <p className="text-sm text-muted-foreground">
            Buat kelas, kelola nilai, dan lihat rekap otomatis.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="min-h-11" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" /> Impor Excel
          </Button>
          <Button className="min-h-11" onClick={bukaDialogBuat}>
            <Plus className="size-4" /> Buat Kelas
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pilihFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {kelasKosong ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Layers className="size-12 text-muted-foreground" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold">Belum ada kelas</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Mulai dengan membuat kelas, atau muat contoh data untuk melihat cara kerja aplikasi
                (kategori berbobot, input nilai, dan rekap otomatis).
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button className="min-h-11" onClick={bukaDialogBuat}>
                <Plus className="size-4" /> Buat Kelas
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={muatContoh}
                onClick={async () => {
                  setMuatContoh(true);
                  try {
                    const id = await muatContohData();
                    await afterMutation();
                    toast({ title: 'Contoh data dimuat', description: 'Kelas 7A dengan UH1, UH2, UTS.' });
                    navigate(`/kelas/${id}`);
                  } finally {
                    setMuatContoh(false);
                  }
                }}
              >
                <Sparkles className="size-4" /> {muatContoh ? 'Memuat…' : 'Muat Contoh Data'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kelasList!.map((k) => (
            <Card key={k.id} className="transition-all hover:border-primary/40 hover:shadow-md">
              <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-lg">
                  <Link to={`/kelas/${k.id}`} className="hover:underline">
                    {k.nama}
                  </Link>
                </CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-9" aria-label={`Menu kelas ${k.nama}`}>
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditKelas({ id: k.id, nama: k.nama, tahunAjaran: k.tahunAjaran })}>
                      <Pencil className="size-4" /> Ubah nama
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={async () => {
                        const s = jumlahSiswa?.get(k.id) ?? 0;
                        const m = jumlahMapel?.get(k.id) ?? 0;
                        setHapusTarget({ id: k.id, nama: k.nama, sisa: s + m });
                      }}
                    >
                      <Trash2 className="size-4" /> Hapus kelas
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{k.tahunAjaran}</p>
                <div className="mt-3 flex gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-4 text-muted-foreground" /> {jumlahSiswa?.get(k.id) ?? 0} siswa
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="size-4 text-muted-foreground" /> {jumlahMapel?.get(k.id) ?? 0} mapel
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-primary">
                  Buka kelas →
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Buat Kelas */}
      <Dialog open={dialogBuat} onOpenChange={setDialogBuat}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat Kelas</DialogTitle>
            <DialogDescription>
              Pilih template kategori ujian: menentukan bobot perhitungan nilai akhir (gaya rapor).
              Semua bobot di bawah bisa Anda ubah sendiri.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="nama-kelas">Nama kelas</Label>
              <Input
                id="nama-kelas"
                className="min-h-11"
                placeholder="mis. 7A"
                value={namaKelas}
                onChange={(e) => setNamaKelas(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tahun-ajaran">Tahun ajaran</Label>
              <Input
                id="tahun-ajaran"
                className="min-h-11"
                value={tahunAjaran}
                onChange={(e) => setTahunAjaran(e.target.value)}
              />
            </div>
            <RadioGroup
              value={template}
              onValueChange={(v) => pilihTemplate(v as 'standar' | 'rata' | 'custom')}
              className="grid grid-cols-3 gap-2"
            >
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border p-3 text-sm has-[button[data-state=checked]]:border-primary">
                <RadioGroupItem value="standar" id="tpl-standar" />
                <span>Standar<br /><span className="text-xs text-muted-foreground">UH 30 · UTS 30 · UAS 40</span></span>
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border p-3 text-sm has-[button[data-state=checked]]:border-primary">
                <RadioGroupItem value="rata" id="tpl-rata" />
                <span>Sama rata<br /><span className="text-xs text-muted-foreground">Semua bobot 1</span></span>
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border p-3 text-sm has-[button[data-state=checked]]:border-primary">
                <RadioGroupItem value="custom" id="tpl-custom" />
                <span>Custom<br /><span className="text-xs text-muted-foreground">Atur sendiri</span></span>
              </label>
            </RadioGroup>
            <div className="space-y-2">
              <Label>Kategori &amp; bobot</Label>
              {draftKategori.map((k, i) => (
                <div key={k.kunci} className="flex items-center gap-2">
                  <Input
                    className="min-h-11"
                    placeholder="Nama kategori"
                    value={k.nama}
                    onChange={(e) =>
                      setDraftKategori((d) => d.map((x, xi) => (xi === i ? { ...x, nama: e.target.value } : x)))
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    className="w-24 min-h-11 text-center"
                    value={k.bobot}
                    onChange={(e) =>
                      setDraftKategori((d) => d.map((x, xi) => (xi === i ? { ...x, bobot: Number(e.target.value) } : x)))
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label="Hapus kategori"
                    onClick={() => setDraftKategori((d) => d.filter((_, xi) => xi !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() =>
                  setDraftKategori((d) => [...d, { nama: '', bobot: 1, kunci: Date.now() }])
                }
              >
                <Plus className="size-4" /> Tambah Kategori
              </Button>
              <p className="text-xs text-muted-foreground">
                Total bobot {draftKategori.reduce((a, b) => a + (Number(b.bobot) || 0), 0)}. Boleh
                tidak 100, otomatis dinormalisasi.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setDialogBuat(false)}>
              Batal
            </Button>
            <Button className="min-h-11" disabled={menyimpan} onClick={simpanKelas}>
              {menyimpan ? 'Menyimpan…' : 'Buat Kelas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Ubah Kelas */}
      <Dialog open={!!editKelas} onOpenChange={(v) => !v && setEditKelas(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ubah Kelas</DialogTitle>
          </DialogHeader>
          {editKelas && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-nama">Nama kelas</Label>
                <Input
                  id="edit-nama"
                  className="min-h-11"
                  value={editKelas.nama}
                  onChange={(e) => setEditKelas({ ...editKelas, nama: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-tahun">Tahun ajaran</Label>
                <Input
                  id="edit-tahun"
                  className="min-h-11"
                  value={editKelas.tahunAjaran}
                  onChange={(e) => setEditKelas({ ...editKelas, tahunAjaran: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setEditKelas(null)}>
              Batal
            </Button>
            <Button className="min-h-11" onClick={simpanEdit}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi Hapus Kelas */}
      <AlertDialog open={!!hapusTarget} onOpenChange={(v) => !v && setHapusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus kelas &quot;{hapusTarget?.nama}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh siswa, mapel, kategori, ujian, dan{' '}
              <strong>seluruh nilai</strong> di kelas ini akan terhapus permanen.
              {hapusTarget && hapusTarget.sisa > 0 ? ` (${hapusTarget.sisa} data terkait)` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Batal</AlertDialogCancel>
            <AlertDialogAction className="min-h-11 bg-destructive text-white hover:bg-destructive/90" onClick={konfirmasiHapus}>
              Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Impor */}
      <Dialog open={!!hasilParse} onOpenChange={(v) => !v && setHasilParse(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Preview Impor</DialogTitle>
            <DialogDescription>
              Periksa data terdeteksi sebelum diimpor. Impor berjalan lokal dan ikut antrean sinkron.
            </DialogDescription>
          </DialogHeader>
          {hasilParse && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-3">
                <p><strong>Kelas:</strong> {hasilParse.kelasNama} ({hasilParse.tahunAjaran})</p>
                <p><strong>Kategori:</strong> {hasilParse.kategori.length} ({hasilParse.kategori.map((k) => `${k.nama} ${k.bobot}`).join(', ')})</p>
                <p><strong>Ujian:</strong> {hasilParse.ujian.length} ({hasilParse.ujian.map((u) => u.nama).join(', ')})</p>
                <p><strong>Siswa:</strong> {hasilParse.siswa.length} · <strong>Mapel:</strong> {hasilParse.mapel.length}</p>
                <p>
                  <strong>Nilai terdeteksi:</strong>{' '}
                  {Object.values(hasilParse.nilai).reduce((a, m) => a + Object.keys(m).length, 0)}
                </p>
              </div>
              {hasilParse.selTidakValid.length > 0 && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <p className="font-medium text-destructive">
                    {hasilParse.selTidakValid.length} sel tidak valid (dilewati):
                  </p>
                  <ul className="mt-1 max-h-32 list-inside list-disc overflow-y-auto text-xs">
                    {hasilParse.selTidakValid.map((s, i) => (
                      <li key={i}>{s.sel}: &quot;{s.nilai}&quot;</li>
                    ))}
                  </ul>
                </div>
              )}
              {hasilParse.siswaDilewati.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Siswa tanpa nama dilewati: {hasilParse.siswaDilewati.join(', ')}.
                </p>
              )}
              {hasilParse.peringatan.map((p, i) => (
                <p key={i} className="text-xs text-amber-700">{p}</p>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setHasilParse(null)}>
              Batal
            </Button>
            <Button className="min-h-11" disabled={sedangImpor} onClick={jalankanImpor}>
              {sedangImpor ? 'Mengimpor…' : 'Impor Sekarang'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
