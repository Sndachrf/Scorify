'use client';

// Tab Data Kelas (PRD 8.9): kelola siswa, mapel, kategori+bobot, dan ujian.
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/pn/db';
import {
  buatSiswa, ubahSiswa, hapusSiswaCascade,
  buatMapel, ubahMapel, hapusMapelCascade,
  buatKategori, ubahKategori, hapusKategoriCascade,
  buatUjian, ubahUjian, hapusUjianCascade,
  saranNamaUjian,
} from '@/lib/pn/ops';
import { KATEGORI_PRESET_NAMA } from '@/lib/pn/types';
import { afterMutation } from '@/lib/pn/sync/engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Pencil, Users, BookOpen, Layers, FileText } from 'lucide-react';

interface Props {
  idKelas: string;
}

export function DataTab({ idKelas }: Props) {
  const { toast } = useToast();
  const kategori = useLiveQuery(() => db.kategori.where('idKelas').equals(idKelas).toArray(), [idKelas]);
  const siswa = useLiveQuery(() => db.siswa.where('idKelas').equals(idKelas).toArray(), [idKelas]);
  const mapel = useLiveQuery(() => db.mapel.where('idKelas').equals(idKelas).toArray(), [idKelas]);
  const ujian = useLiveQuery(() => db.ujian.where('idKelas').equals(idKelas).toArray(), [idKelas]);
  const nilai = useLiveQuery(() => db.nilai.toArray(), [idKelas]);

  // Form siswa
  const [namaSiswa, setNamaSiswa] = useState('');
  const [absenSiswa, setAbsenSiswa] = useState('');
  const [daftarNama, setDaftarNama] = useState('');
  const [editSiswa, setEditSiswa] = useState<{ id: string; nama: string; absen: string } | null>(null);
  const [hapusSiswa, setHapusSiswa] = useState<{ id: string; nama: string; nilai: number } | null>(null);

  // Form mapel
  const [namaMapel, setNamaMapel] = useState('');
  const [editMapel, setEditMapel] = useState<{ id: string; nama: string } | null>(null);
  const [hapusMapel, setHapusMapel] = useState<{ id: string; nama: string; nilai: number } | null>(null);

  // Form kategori
  const [namaKategori, setNamaKategori] = useState('');
  const [bobotKategori, setBobotKategori] = useState('1');
  const [editKategori, setEditKategori] = useState<{ id: string; nama: string; bobot: string } | null>(null);
  const [hapusKategori, setHapusKategori] = useState<{ id: string; nama: string; ujian: number } | null>(null);

  // Form ujian
  const [editUjian, setEditUjian] = useState<{ id: string; nama: string; idKategori: string; tanggal: string } | null>(null);
  const [hapusUjian, setHapusUjian] = useState<{ id: string; nama: string; nilai: number } | null>(null);

  // Dialog "Tambah Ujian": guru memilih kategori sendiri (tidak otomatis kategori pertama).
  const [tambahUjian, setTambahUjian] = useState<{ idKategori: string; nama: string; tanggal: string; namaOtomatis: boolean } | null>(null);
  const [katBaruDiDialog, setKatBaruDiDialog] = useState(false);
  const [namaKatBaruDialog, setNamaKatBaruDialog] = useState('');
  const [bobotKatBaruDialog, setBobotKatBaruDialog] = useState('1');

  const bukaTambahUjian = () => {
    setTambahUjian({ idKategori: '', nama: '', tanggal: '', namaOtomatis: true });
    setKatBaruDiDialog(katSorted.length === 0); // belum ada kategori → tawarkan buat langsung
    setNamaKatBaruDialog('');
    setBobotKatBaruDialog('1');
  };

  const pilihKategoriTambah = async (idKategori: string) => {
    const namaSaran = await saranNamaUjian(idKelas, idKategori);
    setTambahUjian((d) =>
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

  const buatKategoriCepatDialog = async () => {
    const nama = namaKatBaruDialog.trim();
    if (!nama || !tambahUjian) return;
    try {
      const kat = await buatKategori(idKelas, nama, Number(bobotKatBaruDialog) || 1);
      await afterMutation();
      setNamaKatBaruDialog('');
      setBobotKatBaruDialog('1');
      setKatBaruDiDialog(false);
      const namaSaran = await saranNamaUjian(idKelas, kat.id);
      setTambahUjian((d) => (d ? { ...d, idKategori: kat.id, nama: namaSaran, namaOtomatis: true } : d));
      toast({ title: `Kategori "${nama}" ditambahkan` });
    } catch (er) {
      gagal(er, 'Gagal menambah kategori');
    }
  };

  const simpanTambahUjian = async () => {
    if (!tambahUjian) return;
    if (!tambahUjian.idKategori) {
      toast({ title: 'Pilih kategori terlebih dahulu', description: 'Ujian harus masuk ke salah satu kategori.', variant: 'destructive' });
      return;
    }
    const nama = tambahUjian.nama.trim();
    if (!nama) {
      toast({ title: 'Nama ujian wajib diisi', variant: 'destructive' });
      return;
    }
    try {
      const u = await buatUjian(idKelas, tambahUjian.idKategori, nama, tambahUjian.tanggal || null);
      await afterMutation();
      setTambahUjian(null);
      const namaKategori = katSorted.find((k) => k.id === u.idKategori)?.nama ?? '';
      toast({ title: `Ujian "${nama}" dibuat`, description: `Kategori ${namaKategori}: isi nilai di tab Nilai.` });
    } catch (er) {
      gagal(er, 'Gagal membuat ujian');
    }
  };

  const gagal = (e: unknown, judul: string) =>
    toast({
      title: judul,
      description: e instanceof Error ? e.message : String(e),
      variant: 'destructive',
    });

  const siswaSorted = [...(siswa ?? [])].sort(
    (a, b) => (a.absen ?? 999) - (b.absen ?? 999) || a.nama.localeCompare(b.nama)
  );
  const mapelSorted = [...(mapel ?? [])].sort((a, b) => a.urutan - b.urutan);
  const katSorted = [...(kategori ?? [])].sort((a, b) => a.nama.localeCompare(b.nama));

  const absenBerikutnya = siswaSorted.reduce((mx, s) => Math.max(mx, s.absen ?? 0), 0) + 1;

  const tambahSiswa = async () => {
    const nama = namaSiswa.trim();
    if (!nama) return;
    const absen = absenSiswa.trim() === '' ? null : Number(absenSiswa);
    try {
      await buatSiswa(idKelas, nama, absen);
      await afterMutation();
      setNamaSiswa('');
      setAbsenSiswa('');
    } catch (e) {
      gagal(e, 'Gagal menambah siswa');
    }
  };

  const tambahBulkSiswa = async () => {
    const baris = daftarNama
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.replace(/^\s*\d+[\.\)\-,:]\s*/, '').replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
    if (!baris.length) return;
    let mulai = absenBerikutnya;
    let sukses = 0;
    for (const nama of baris) {
      try {
        await buatSiswa(idKelas, nama, mulai);
        mulai += 1;
        sukses += 1;
      } catch {
        // absen bentrok → coba tanpa absen
        try {
          await buatSiswa(idKelas, nama, null);
          sukses += 1;
        } catch (e2) {
          gagal(e2, `Gagal menambah "${nama}"`);
        }
      }
    }
    await afterMutation();
    setDaftarNama('');
    toast({ title: `${sukses} siswa ditambahkan`, description: 'Nomor absen diisi otomatis.' });
  };

  const jumlahNilaiSiswa = (idSiswa: string) =>
    (nilai ?? []).filter((n) => n.idSiswa === idSiswa).length;
  const jumlahNilaiMapel = (idMapel: string) =>
    (nilai ?? []).filter((n) => n.idMapel === idMapel).length;
  const ujianKategori = (idKategori: string) =>
    (ujian ?? []).filter((u) => u.idKategori === idKategori);
  const jumlahNilaiUjian = (idUjian: string) =>
    (nilai ?? []).filter((n) => n.idUjian === idUjian).length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* SISWA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" /> Siswa
            <Badge variant="secondary">{siswaSorted.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              className="min-h-11 flex-1"
              placeholder="Nama siswa"
              value={namaSiswa}
              onChange={(e) => setNamaSiswa(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void tambahSiswa()}
            />
            <Input
              type="number"
              className="w-24 min-h-11 text-center"
              placeholder={String(absenBerikutnya)}
              value={absenSiswa}
              onChange={(e) => setAbsenSiswa(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void tambahSiswa()}
            />
            <Button className="min-h-11" onClick={tambahSiswa} aria-label="Tambah siswa">
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulk-siswa">Tempel daftar nama (satu per baris, nomor di depan diabaikan)</Label>
            <Textarea
              id="bulk-siswa"
              rows={3}
              placeholder={'1. Ahmad Fauzi\n2. Bunga Lestari\n3. Citra Ayu'}
              value={daftarNama}
              onChange={(e) => setDaftarNama(e.target.value)}
            />
            <Button variant="outline" className="min-h-11" disabled={!daftarNama.trim()} onClick={tambahBulkSiswa}>
              <Plus className="size-4" /> Tambah Semua
            </Button>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {siswaSorted.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                <span className="w-8 text-center text-xs text-muted-foreground">{s.absen ?? i + 1}</span>
                <span className="flex-1 text-sm">{s.nama}</span>
                <Button
                  variant="ghost" size="icon" className="size-9"
                  aria-label={`Ubah ${s.nama}`}
                  onClick={() =>
                    setEditSiswa({ id: s.id, nama: s.nama, absen: s.absen != null ? String(s.absen) : '' })
                  }
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="size-9 text-destructive"
                  aria-label={`Hapus ${s.nama}`}
                  onClick={async () =>
                    setHapusSiswa({ id: s.id, nama: s.nama, nilai: jumlahNilaiSiswa(s.id) })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {!siswaSorted.length && (
              <p className="py-4 text-center text-sm text-muted-foreground">Belum ada siswa.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* MAPEL */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4" /> Mata Pelajaran
            <Badge variant="secondary">{mapelSorted.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              className="min-h-11 flex-1"
              placeholder="Nama mapel (mis. Matematika)"
              value={namaMapel}
              onChange={(e) => setNamaMapel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && namaMapel.trim()) {
                  void buatMapel(idKelas, namaMapel.trim())
                    .then(async () => {
                      await afterMutation();
                      setNamaMapel('');
                    })
                    .catch((er) => gagal(er, 'Gagal menambah mapel'));
                }
              }}
            />
            <Button
              className="min-h-11"
              disabled={!namaMapel.trim()}
              aria-label="Tambah mapel"
              onClick={async () => {
                try {
                  await buatMapel(idKelas, namaMapel.trim());
                  await afterMutation();
                  setNamaMapel('');
                } catch (er) {
                  gagal(er, 'Gagal menambah mapel');
                }
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
            {mapelSorted.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                <span className="flex-1 text-sm">{m.nama}</span>
                <Button
                  variant="ghost" size="icon" className="size-9"
                  aria-label={`Ubah ${m.nama}`}
                  onClick={() => setEditMapel({ id: m.id, nama: m.nama })}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="size-9 text-destructive"
                  aria-label={`Hapus ${m.nama}`}
                  onClick={async () =>
                    setHapusMapel({ id: m.id, nama: m.nama, nilai: jumlahNilaiMapel(m.id) })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {!mapelSorted.length && (
              <p className="py-4 text-center text-sm text-muted-foreground">Belum ada mapel.</p>
            )}
          </div>

          {/* KATEGORI */}
          <div className="pt-2">
            <CardTitle className="mb-3 flex items-center gap-2 text-base">
              <Layers className="size-4" /> Kategori Ujian &amp; Bobot
            </CardTitle>
            <div className="space-y-1.5">
              {katSorted.map((k) => (
                <div key={k.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                  <span className="flex-1 text-sm">
                    {k.nama}{' '}
                    <span className="text-xs text-muted-foreground">
                      · {ujianKategori(k.id).length} ujian
                    </span>
                  </span>
                  <Badge variant="outline">bobot {k.bobot}</Badge>
                  <Button
                    variant="ghost" size="icon" className="size-9"
                    aria-label={`Ubah kategori ${k.nama}`}
                    onClick={() =>
                      setEditKategori({ id: k.id, nama: k.nama, bobot: String(k.bobot) })
                    }
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="size-9 text-destructive"
                    aria-label={`Hapus kategori ${k.nama}`}
                    onClick={async () => {
                      const ujianCount = ujianKategori(k.id).length;
                      const nilaiCount = ujianKategori(k.id).reduce(
                        (a, u) => a + jumlahNilaiUjian(u.id), 0
                      );
                      setHapusKategori({ id: k.id, nama: k.nama, ujian: ujianCount || nilaiCount });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                className="min-h-11 flex-1"
                placeholder="Kategori baru (mis. Praktik)"
                value={namaKategori}
                onChange={(e) => setNamaKategori(e.target.value)}
              />
              <Input
                type="number" min={0}
                className="w-20 min-h-11 text-center"
                value={bobotKategori}
                onChange={(e) => setBobotKategori(e.target.value)}
                aria-label="Bobot kategori baru"
              />
              <Button
                className="min-h-11"
                disabled={!namaKategori.trim()}
                aria-label="Tambah kategori"
                onClick={async () => {
                  try {
                    await buatKategori(idKelas, namaKategori.trim(), Number(bobotKategori) || 1);
                    await afterMutation();
                    setNamaKategori('');
                  } catch (er) {
                    gagal(er, 'Gagal menambah kategori');
                  }
                }}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UJIAN */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" /> Daftar Ujian
            <Badge variant="secondary">{(ujian ?? []).length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {katSorted.map((k) => {
            const daftar = (ujian ?? []).filter((u) => u.idKategori === k.id);
            return (
              <div key={k.id}>
                <p className="mb-1.5 text-sm font-medium text-muted-foreground">
                  {k.nama}
                </p>
                <div className="space-y-1">
                  {daftar.map((u) => (
                    <div key={u.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                      <span className="flex-1 text-sm">
                        {u.nama}
                        {u.tanggal ? <span className="ml-2 text-xs text-muted-foreground">{u.tanggal}</span> : null}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {jumlahNilaiUjian(u.id)} nilai
                      </Badge>
                      <Button
                        variant="ghost" size="icon" className="size-9"
                        aria-label={`Ubah ujian ${u.nama}`}
                        onClick={async () =>
                          setEditUjian({
                            id: u.id,
                            nama: u.nama,
                            idKategori: u.idKategori,
                            tanggal: u.tanggal ?? '',
                          })
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="size-9 text-destructive"
                        aria-label={`Hapus ujian ${u.nama}`}
                        onClick={async () =>
                          setHapusUjian({ id: u.id, nama: u.nama, nilai: jumlahNilaiUjian(u.id) })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {!daftar.length && (
                    <p className="text-xs text-muted-foreground">Belum ada ujian di kategori ini.</p>
                  )}
                </div>
              </div>
            );
          })}
          {/* Guru memilih kategori sendiri lewat dialog, bukan otomatis kategori pertama (permintaan guru). */}
          <Button variant="outline" className="min-h-11" onClick={bukaTambahUjian}>
            <Plus className="size-4" /> Tambah Ujian
          </Button>
        </CardContent>
      </Card>

      {/* DIALOG: edit siswa */}
      <Dialog open={!!editSiswa} onOpenChange={(v) => !v && setEditSiswa(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Ubah Siswa</DialogTitle></DialogHeader>
          {editSiswa && (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-siswa-nama">Nama</Label>
                <Input id="edit-siswa-nama" className="min-h-11" value={editSiswa.nama}
                  onChange={(e) => setEditSiswa({ ...editSiswa, nama: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-siswa-absen">Nomor absen (opsional)</Label>
                <Input id="edit-siswa-absen" type="number" className="min-h-11" value={editSiswa.absen}
                  onChange={(e) => setEditSiswa({ ...editSiswa, absen: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setEditSiswa(null)}>Batal</Button>
            <Button className="min-h-11" onClick={async () => {
              if (!editSiswa) return;
              try {
                await ubahSiswa(editSiswa.id, editSiswa.nama.trim(),
                  editSiswa.absen.trim() === '' ? null : Number(editSiswa.absen));
                await afterMutation();
                setEditSiswa(null);
              } catch (er) { gagal(er, 'Gagal menyimpan'); }
            }}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: edit mapel */}
      <Dialog open={!!editMapel} onOpenChange={(v) => !v && setEditMapel(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Ubah Mapel</DialogTitle></DialogHeader>
          {editMapel && (
            <div className="grid gap-2">
              <Label htmlFor="edit-mapel">Nama mapel</Label>
              <Input id="edit-mapel" className="min-h-11" value={editMapel.nama}
                onChange={(e) => setEditMapel({ ...editMapel, nama: e.target.value })} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setEditMapel(null)}>Batal</Button>
            <Button className="min-h-11" onClick={async () => {
              if (!editMapel) return;
              try {
                await ubahMapel(editMapel.id, editMapel.nama.trim());
                await afterMutation();
                setEditMapel(null);
              } catch (er) { gagal(er, 'Gagal menyimpan'); }
            }}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: edit kategori */}
      <Dialog open={!!editKategori} onOpenChange={(v) => !v && setEditKategori(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ubah Kategori</DialogTitle>
            <DialogDescription>
              Mengubah bobot langsung menghitung ulang nilai akhir (PRD 8.9).
            </DialogDescription>
          </DialogHeader>
          {editKategori && (
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-kat-nama">Nama</Label>
                <Input id="edit-kat-nama" className="min-h-11" value={editKategori.nama}
                  onChange={(e) => setEditKategori({ ...editKategori, nama: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-kat-bobot">Bobot</Label>
                <Input id="edit-kat-bobot" type="number" min={0} className="min-h-11 text-center" value={editKategori.bobot}
                  onChange={(e) => setEditKategori({ ...editKategori, bobot: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setEditKategori(null)}>Batal</Button>
            <Button className="min-h-11" onClick={async () => {
              if (!editKategori) return;
              try {
                await ubahKategori(editKategori.id, editKategori.nama.trim(), Number(editKategori.bobot) || 1);
                await afterMutation();
                setEditKategori(null);
              } catch (er) { gagal(er, 'Gagal menyimpan'); }
            }}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: edit ujian */}
      <Dialog open={!!editUjian} onOpenChange={(v) => !v && setEditUjian(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Ubah Ujian</DialogTitle></DialogHeader>
          {editUjian && (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-ujian-nama">Nama ujian</Label>
                <Input id="edit-ujian-nama" className="min-h-11" value={editUjian.nama}
                  onChange={(e) => setEditUjian({ ...editUjian, nama: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Kategori</Label>
                <Select value={editUjian.idKategori}
                  onValueChange={(v) => setEditUjian({ ...editUjian, idKategori: v })}>
                  <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {katSorted.map((k) => (
                      <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-ujian-tanggal">Tanggal (opsional)</Label>
                <Input id="edit-ujian-tanggal" type="date" className="min-h-11" value={editUjian.tanggal}
                  onChange={(e) => setEditUjian({ ...editUjian, tanggal: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setEditUjian(null)}>Batal</Button>
            <Button className="min-h-11" onClick={async () => {
              if (!editUjian) return;
              try {
                await ubahUjian(editUjian.id, editUjian.idKategori, editUjian.nama.trim(), editUjian.tanggal || null);
                await afterMutation();
                setEditUjian(null);
              } catch (er) { gagal(er, 'Gagal menyimpan'); }
            }}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: tambah ujian (kategori dipilih guru sendiri) */}
      <Dialog open={!!tambahUjian} onOpenChange={(v) => !v && setTambahUjian(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah Ujian</DialogTitle>
            <DialogDescription>
              Pilih kategori tempat ujian masuk, lalu beri nama ujian (mis. UH1, UTS1, Praktik 1).
            </DialogDescription>
          </DialogHeader>
          {tambahUjian && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Kategori</Label>
                {katSorted.length > 0 && (
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pilih kategori ujian">
                    {katSorted.map((k) => {
                      const aktif = tambahUjian.idKategori === k.id;
                      return (
                        <button
                          key={k.id}
                          type="button"
                          role="radio"
                          aria-checked={aktif}
                          onClick={() => void pilihKategoriTambah(k.id)}
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
                {!katBaruDiDialog && (
                  <button
                    type="button"
                    onClick={() => setKatBaruDiDialog(true)}
                    className="min-h-9 w-fit rounded-lg border border-dashed border-slate-300 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    + Kategori baru…
                  </button>
                )}
                {katBaruDiDialog && (
                  <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                    <div className="flex gap-2">
                      <Input
                        className="min-h-11 flex-1"
                        placeholder="Nama kategori baru"
                        value={namaKatBaruDialog}
                        onChange={(e) => setNamaKatBaruDialog(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void buatKategoriCepatDialog()}
                      />
                      <Input
                        type="number"
                        min={0}
                        className="w-20 min-h-11 text-center"
                        aria-label="Bobot kategori baru"
                        value={bobotKatBaruDialog}
                        onChange={(e) => setBobotKatBaruDialog(e.target.value)}
                      />
                      <Button variant="outline" className="min-h-11" onClick={buatKategoriCepatDialog}>
                        Tambah
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {KATEGORI_PRESET_NAMA.map((n) => (
                        <button
                          key={n}
                          type="button"
                          className="min-h-9 rounded border border-slate-300 bg-white px-2 text-xs hover:border-primary/50 hover:bg-primary/5"
                          onClick={() => setNamaKatBaruDialog(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!tambahUjian.idKategori && (
                  <p className="text-xs text-muted-foreground">
                    Pilih kategori tempat ujian ini masuk.
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tambah-ujian-nama">Nama ujian</Label>
                <Input
                  id="tambah-ujian-nama"
                  className="min-h-11"
                  placeholder={tambahUjian.idKategori ? 'Mis. UH1, UTS1, Praktik 1' : 'Pilih kategori dulu, nama terisi otomatis'}
                  value={tambahUjian.nama}
                  onChange={(e) => setTambahUjian({ ...tambahUjian, nama: e.target.value, namaOtomatis: false })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tambah-ujian-tanggal">Tanggal (opsional)</Label>
                <Input
                  id="tambah-ujian-tanggal"
                  type="date"
                  className="min-h-11"
                  value={tambahUjian.tanggal}
                  onChange={(e) => setTambahUjian({ ...tambahUjian, tanggal: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setTambahUjian(null)}>
              Batal
            </Button>
            <Button className="min-h-11" onClick={simpanTambahUjian}>
              Buat Ujian
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ALERTS: konfirmasi hapus */}
      <AlertDialog open={!!hapusSiswa} onOpenChange={(v) => !v && setHapusSiswa(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus siswa &quot;{hapusSiswa?.nama}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh nilainya ikut terhapus
              {hapusSiswa && hapusSiswa.nilai > 0 ? ` (${hapusSiswa.nilai} nilai)` : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Batal</AlertDialogCancel>
            <AlertDialogAction className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!hapusSiswa) return;
                await hapusSiswaCascade(hapusSiswa.id);
                await afterMutation();
                setHapusSiswa(null);
              }}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!hapusMapel} onOpenChange={(v) => !v && setHapusMapel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus mapel &quot;{hapusMapel?.nama}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh nilai pada mapel ini ikut terhapus
              {hapusMapel && hapusMapel.nilai > 0 ? ` (${hapusMapel.nilai} nilai)` : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Batal</AlertDialogCancel>
            <AlertDialogAction className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!hapusMapel) return;
                await hapusMapelCascade(hapusMapel.id);
                await afterMutation();
                setHapusMapel(null);
              }}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!hapusKategori} onOpenChange={(v) => !v && setHapusKategori(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus kategori &quot;{hapusKategori?.nama}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              {hapusKategori && hapusKategori.ujian > 0
                ? `${hapusKategori.ujian} ujian di kategori ini beserta seluruh nilainya ikut terhapus.`
                : 'Kategori ini akan terhapus.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Batal</AlertDialogCancel>
            <AlertDialogAction className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!hapusKategori) return;
                await hapusKategoriCascade(hapusKategori.id);
                await afterMutation();
                setHapusKategori(null);
              }}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!hapusUjian} onOpenChange={(v) => !v && setHapusUjian(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus ujian &quot;{hapusUjian?.nama}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh nilai pada ujian ini ikut terhapus
              {hapusUjian && hapusUjian.nilai > 0 ? ` (${hapusUjian.nilai} nilai)` : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Batal</AlertDialogCancel>
            <AlertDialogAction className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!hapusUjian) return;
                await hapusUjianCascade(hapusUjian.id);
                await afterMutation();
                setHapusUjian(null);
              }}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
