'use client';

// Komponen Rekap (PRD 7.3 & 7.5): rata-rata, ranking, tertinggi/terendah + drill-down kategori
// + Ekspor Excel. Dipakai oleh halaman Rekap Nilai (menu /rekap, di bawah Dashboard).
// PRD v1.7: tabel berwarna (header biru SRMS, zebra, badge 3 peringkat teratas, baris ringkasan
// ditandai) dengan garis batas sel tetap tegas, kolom nama & header sticky saat digeser,
// dan dukungan tampilan per kategori (Semua kategori = nilai akhir berbobot).
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/pn/db';
import { hitungRekap, rekapKategori, fmt2 } from '@/lib/pn/calc';
import { eksporKelas } from '@/lib/pn/excel/export';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  idKelas: string;
  /** null = Semua kategori (nilai akhir berbobot); selain itu id kategori terpilih. */
  idKategoriFilter: string | null;
}

/** Badge warna untuk 3 peringkat teratas (emas, perak, perunggu). */
function BadgeRanking({ rank }: { rank: number }) {
  if (rank <= 3) {
    const style =
      rank === 1
        ? 'bg-amber-400 text-amber-950 shadow-sm shadow-amber-400/40'
        : rank === 2
          ? 'bg-slate-300 text-slate-800'
          : 'bg-orange-300 text-orange-950';
    return (
      <span
        className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${style}`}
      >
        {rank}
      </span>
    );
  }
  return <span className="text-slate-600">{rank}</span>;
}

export function RekapTab({ idKelas, idKategoriFilter }: Props) {
  const { toast } = useToast();
  const kelas = useLiveQuery(() => db.kelas.get(idKelas), [idKelas]);
  const kategori = useLiveQuery(() => db.kategori.where('idKelas').equals(idKelas).toArray(), [idKelas]);
  const siswa = useLiveQuery(() => db.siswa.where('idKelas').equals(idKelas).toArray(), [idKelas]);
  const mapel = useLiveQuery(() => db.mapel.where('idKelas').equals(idKelas).toArray(), [idKelas]);
  const ujian = useLiveQuery(() => db.ujian.where('idKelas').equals(idKelas).toArray(), [idKelas]);
  const nilai = useLiveQuery(async () => {
    const ujianIds = await db.ujian.where('idKelas').equals(idKelas).primaryKeys();
    return db.nilai.where('idUjian').anyOf(ujianIds as string[]).toArray();
  }, [idKelas]);

  const [drillMapel, setDrillMapel] = useState<string | null>(null);
  const [mengEkspor, setMengEkspor] = useState(false);

  const rekapPenuh = useMemo(() => {
    if (!siswa || !mapel || !kategori || !ujian || !nilai) return null;
    const mapelSorted = [...mapel].sort((a, b) => a.urutan - b.urutan);
    const siswaSorted = [...siswa].sort(
      (a, b) => (a.absen ?? 999) - (b.absen ?? 999) || a.nama.localeCompare(b.nama)
    );
    return {
      mapelSorted,
      siswaSorted,
      hasil: hitungRekap(siswaSorted, mapelSorted, kategori, ujian, nilai),
    };
  }, [siswa, mapel, kategori, ujian, nilai]);

  // Tampilan per kategori: kolom = rata-rata kategori terpilih; statistik & ranking dihitung ulang.
  const hasil = useMemo(() => {
    if (!rekapPenuh) return null;
    if (!idKategoriFilter) return rekapPenuh.hasil;
    return rekapKategori(rekapPenuh.hasil, idKategoriFilter);
  }, [rekapPenuh, idKategoriFilter]);

  const katFilter = idKategoriFilter
    ? (kategori ?? []).find((k) => k.id === idKategoriFilter) ?? null
    : null;
  const katSort = useMemo(
    () => [...(kategori ?? [])].sort((a, b) => a.nama.localeCompare(b.nama)),
    [kategori]
  );

  const jalankanEkspor = async () => {
    setMengEkspor(true);
    try {
      const namaFile = await eksporKelas(idKelas);
      toast({ title: 'Excel diekspor', description: namaFile });
    } catch (e) {
      toast({
        title: 'Ekspor gagal',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setMengEkspor(false);
    }
  };

  if (!rekapPenuh || !hasil || !kategori || !ujian || !kelas) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Memuat…</div>;
  }

  const { mapelSorted, siswaSorted } = rekapPenuh;
  const tidakBisaEkspor = !siswaSorted.length || !mapelSorted.length || !ujian.length;
  const mapelDrill = mapelSorted.find((m) => m.id === drillMapel);
  const kategoriTanpaUjian =
    !!idKategoriFilter && !ujian.some((u) => u.idKategori === idKategoriFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {katFilter ? (
            <>
              Menampilkan <strong className="text-foreground">{katFilter.nama}</strong> (bobot{' '}
              {katFilter.bobot}) per mapel; ranking dihitung ulang dari nilai tampilan ini.
            </>
          ) : (
            <>Nilai akhir per mapel = gabungan tertimbang rata-rata kategori.</>
          )}{' '}
          Klik nama mapel untuk rincian per kategori.
        </p>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  className="min-h-11"
                  disabled={tidakBisaEkspor || mengEkspor}
                  onClick={jalankanEkspor}
                >
                  {mengEkspor ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  Ekspor Excel
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-56 text-xs">
              {tidakBisaEkspor
                ? 'Butuh minimal 1 siswa, 1 mapel, dan 1 ujian untuk mengekspor.'
                : 'Sheet Rekap + per ujian + Data Master. Ekspor selalu berisi rekap lengkap berbobot.'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {tidakBisaEkspor ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Rekap akan tampil setelah ada siswa, mapel, dan nilai.
        </div>
      ) : (
        <>
          {kategoriTanpaUjian && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Kategori ini belum memiliki ujian, jadi seluruh kolom tampil kosong.
            </p>
          )}
          {/* Tabel berwarna (PRD v1.7): header biru, zebra, badge top-3, garis batas tegas,
              kolom nama & header sticky (border-separate agar border sticky tidak hilang). */}
          <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-300 bg-white">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 w-12 min-w-12 border-b border-r border-slate-300 bg-blue-700 px-2 py-2 text-center font-semibold text-white">No</th>
                  <th className="sticky left-12 top-0 z-30 min-w-44 border-b border-r border-slate-300 bg-blue-700 px-3 py-2 text-left font-semibold text-white">Nama Siswa</th>
                  {mapelSorted.map((m) => (
                    <th key={m.id} className="sticky top-0 z-20 min-w-24 border-b border-r border-slate-300 bg-blue-700 px-2 py-2 text-center font-semibold text-white last:border-r-0">
                      <button
                        className="min-h-8 font-semibold hover:underline"
                        onClick={() => setDrillMapel(m.id)}
                        aria-label={`Rincian kategori untuk ${m.nama}`}
                      >
                        {m.nama}
                      </button>
                    </th>
                  ))}
                  <th className="sticky top-0 z-20 min-w-24 border-b border-r border-slate-300 bg-blue-700 px-2 py-2 text-center font-semibold text-white">Rata-rata</th>
                  <th className="sticky top-0 z-20 min-w-16 border-b border-slate-300 bg-blue-700 px-2 py-2 text-center font-semibold text-white">Ranking</th>
                </tr>
              </thead>
              <tbody>
                {hasil.baris.map((b, i) => {
                  const zebra = i % 2 === 1 ? 'bg-slate-50' : 'bg-white';
                  return (
                    <tr key={b.siswa.id}>
                      <td className={`sticky left-0 z-10 w-12 min-w-12 border-b border-r border-slate-300 px-2 py-1.5 text-center text-muted-foreground ${zebra}`}>
                        {b.siswa.absen ?? i + 1}
                      </td>
                      <td className={`sticky left-12 z-10 border-b border-r border-slate-300 px-3 py-1.5 font-medium ${zebra}`}>
                        {b.siswa.nama}
                      </td>
                      {mapelSorted.map((m) => (
                        <td key={m.id} className={`border-b border-r border-slate-300 px-2 py-1.5 text-center tabular-nums ${zebra}`}>
                          {fmt2(b.akhir.perMapel[m.id])}
                        </td>
                      ))}
                      <td className={`border-b border-r border-slate-300 px-2 py-1.5 text-center font-semibold tabular-nums ${zebra}`}>
                        {fmt2(b.akhir.rataSiswa)}
                      </td>
                      <td className={`border-b border-slate-300 px-2 py-1.5 text-center tabular-nums ${zebra}`}>
                        {b.akhir.ranking != null ? <BadgeRanking rank={b.akhir.ranking} /> : ''}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-blue-50 font-semibold">
                  <td colSpan={2} className="sticky left-0 z-10 border-b border-r border-slate-300 bg-blue-50 px-3 py-1.5">
                    <span className="flex items-center gap-1">
                      <Info className="size-3.5" /> Rata-rata Mapel
                    </span>
                  </td>
                  {mapelSorted.map((m) => (
                    <td key={m.id} className="border-b border-r border-slate-300 px-2 py-1.5 text-center tabular-nums">
                      {fmt2(hasil.statistikMapel[m.id].rata)}
                    </td>
                  ))}
                  <td className="border-b border-r border-slate-300 px-2 py-1.5 text-center tabular-nums">{fmt2(hasil.rataKelas)}</td>
                  <td className="border-b border-slate-300" />
                </tr>
                <tr className="bg-blue-50 font-semibold">
                  <td colSpan={2} className="sticky left-0 z-10 border-b border-r border-slate-300 bg-blue-50 px-3 py-1.5">Tertinggi</td>
                  {mapelSorted.map((m) => (
                    <td key={m.id} className="border-b border-r border-slate-300 px-2 py-1.5 text-center tabular-nums">
                      {fmt2(hasil.statistikMapel[m.id].max)}
                    </td>
                  ))}
                  <td className="border-b border-r border-slate-300 px-2 py-1.5 text-center tabular-nums">{fmt2(hasil.maxRata)}</td>
                  <td className="border-b border-slate-300" />
                </tr>
                <tr className="bg-blue-50 font-semibold">
                  <td colSpan={2} className="sticky left-0 z-10 border-b border-r border-slate-300 bg-blue-50 px-3 py-1.5">Terendah</td>
                  {mapelSorted.map((m) => (
                    <td key={m.id} className="border-b border-r border-slate-300 px-2 py-1.5 text-center tabular-nums">
                      {fmt2(hasil.statistikMapel[m.id].min)}
                    </td>
                  ))}
                  <td className="border-b border-r border-slate-300 px-2 py-1.5 text-center tabular-nums">{fmt2(hasil.minRata)}</td>
                  <td className="border-b border-slate-300" />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Drill-down rincian per kategori untuk satu mapel */}
      <Dialog open={!!drillMapel} onOpenChange={(v) => !v && setDrillMapel(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Rincian per kategori: {mapelDrill?.nama}</DialogTitle>
            <DialogDescription>
              Nilai akhir = Σ(rata-rata kategori × bobot) atas kategori yang sudah ber-nilai.
            </DialogDescription>
          </DialogHeader>
          {mapelDrill && kategori.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
              <Table className="border-collapse">
                <TableHeader>
                  <TableRow className="bg-blue-700 hover:bg-blue-700">
                    <TableHead className="min-w-40 border-b border-r border-slate-300 text-white">Nama Siswa</TableHead>
                    {katSort.map((k) => (
                      <TableHead key={k.id} className="min-w-24 border-b border-r border-slate-300 text-center text-white">
                        {k.nama}
                        <span className="block text-xs font-normal text-blue-100">
                          bobot {k.bobot}
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="min-w-24 border-b border-slate-300 text-center text-white">Nilai Akhir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rekapPenuh.hasil.baris.map((b) => (
                    <TableRow key={b.siswa.id} className="even:bg-slate-50/60">
                      <TableCell className="border-b border-r border-slate-300 font-medium">{b.siswa.nama}</TableCell>
                      {katSort.map((k) => (
                        <TableCell key={k.id} className="border-b border-r border-slate-300 text-center tabular-nums">
                          {fmt2(b.akhir.perKategori[mapelDrill.id]?.[k.id])}
                        </TableCell>
                      ))}
                      <TableCell className="border-b border-slate-300 text-center font-semibold tabular-nums">
                        {fmt2(b.akhir.perMapel[mapelDrill.id])}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
