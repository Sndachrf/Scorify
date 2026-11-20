// Perhitungan rekap otomatis, bobot kategori gaya rapor (PRD 7.3, 8.3-8.5)
import type { Kategori, Mapel, Nilai, Siswa, Ujian } from './types';

export interface NilaiAkhir {
  /** Mapel id → nilai akhir (null = belum ada nilai sama sekali). */
  perMapel: Record<string, number | null>;
  /** Kategori id → rata-rata kategori (untuk drill-down). */
  perKategori: Record<string, Record<string, number | null>>;
  rataSiswa: number | null;
  ranking: number | null;
}

export interface RekapKelas {
  baris: Array<{ siswa: Siswa; akhir: NilaiAkhir }>;
  /** Statistik per mapel: rata / max / min dari nilai akhir siswa di mapel itu. */
  statistikMapel: Record<
    string,
    { rata: number | null; max: number | null; min: number | null; ada: boolean }
  >;
  rataKelas: number | null;
  maxRata: number | null;
  minRata: number | null;
}

const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/**
 * Nilai akhir satu siswa pada satu mapel:
 * Σ(rata-rata kategori × bobot kategori) dinormalisasi atas kategori yang sudah ber-nilai.
 * Sel kosong diabaikan (bukan 0).
 */
export function hitungNilaiAkhir(
  kategori: Kategori[],
  ujian: Ujian[],
  nilaiSiswaMapel: Nilai[]
): { akhir: number | null; perKategori: Record<string, number | null> } {
  const perKategori: Record<string, number | null> = {};
  const ujianByKategori = new Map<string, string[]>();
  for (const u of ujian) {
    const list = ujianByKategori.get(u.idKategori) ?? [];
    list.push(u.id);
    ujianByKategori.set(u.idKategori, list);
  }
  const nilaiByUjian = new Map<string, number[]>();
  for (const n of nilaiSiswaMapel) {
    const list = nilaiByUjian.get(n.idUjian) ?? [];
    list.push(n.nilai);
    nilaiByUjian.set(n.idUjian, list);
  }

  let totalBobot = 0;
  let totalNilai = 0;
  for (const k of kategori) {
    const ujianIds = ujianByKategori.get(k.id) ?? [];
    const nilaiUjian = ujianIds.flatMap((id) => nilaiByUjian.get(id) ?? []);
    const rata = mean(nilaiUjian);
    perKategori[k.id] = rata;
    if (rata != null) {
      totalBobot += k.bobot;
      totalNilai += rata * k.bobot;
    }
  }
  const akhir = totalBobot > 0 ? totalNilai / totalBobot : null;
  return { akhir, perKategori };
}

/**
 * Rekap kelas penuh: nilai akhir per siswa per mapel, rata-rata siswa,
 * ranking competition (1, 2, 2, 4), statistik per mapel & kelas.
 */
export function hitungRekap(
  siswa: Siswa[],
  mapel: Mapel[],
  kategori: Kategori[],
  ujian: Ujian[],
  nilai: Nilai[]
): RekapKelas {
  // Nilai dikelompokkan per siswa+mapel.
  const nilaiIdx = new Map<string, Nilai[]>();
  for (const n of nilai) {
    const kunci = `${n.idSiswa}|${n.idMapel}`;
    const list = nilaiIdx.get(kunci) ?? [];
    list.push(n);
    nilaiIdx.set(kunci, list);
  }

  const baris = siswa.map((s) => {
    const perMapel: Record<string, number | null> = {};
    const perKategoriSemua: Record<string, Record<string, number | null>> = {};
    const nilaiAkhirList: number[] = [];
    for (const m of mapel) {
      const { akhir, perKategori } = hitungNilaiAkhir(
        kategori,
        ujian,
        nilaiIdx.get(`${s.id}|${m.id}`) ?? []
      );
      perMapel[m.id] = akhir;
      perKategoriSemua[m.id] = perKategori;
      if (akhir != null) nilaiAkhirList.push(akhir);
    }
    const rataSiswa = mean(nilaiAkhirList);
    return {
      siswa: s,
      akhir: { perMapel, perKategori: perKategoriSemua, rataSiswa, ranking: null as number | null },
    };
  });

  // Ranking competition: tertinggi = 1; sama = peringkat sama; berikutnya lompat (1, 2, 2, 4).
  const terurut = [...baris]
    .filter((b) => b.akhir.rataSiswa != null)
    .sort((a, b) => (b.akhir.rataSiswa as number) - (a.akhir.rataSiswa as number));
  let prevNilai: number | null = null;
  let prevRank = 0;
  terurut.forEach((b, i) => {
    const v = b.akhir.rataSiswa as number;
    const rank = prevNilai != null && Math.abs(v - prevNilai) < 1e-9 ? prevRank : i + 1;
    b.akhir.ranking = rank;
    prevNilai = v;
    prevRank = rank;
  });

  const statistikMapel: RekapKelas['statistikMapel'] = {};
  for (const m of mapel) {
    const vals = baris
      .map((b) => b.akhir.perMapel[m.id])
      .filter((v): v is number => v != null);
    statistikMapel[m.id] = {
      rata: mean(vals),
      max: vals.length ? Math.max(...vals) : null,
      min: vals.length ? Math.min(...vals) : null,
      ada: vals.length > 0,
    };
  }

  const rataSiswaSemua = baris
    .map((b) => b.akhir.rataSiswa)
    .filter((v): v is number => v != null);
  return {
    baris,
    statistikMapel,
    rataKelas: mean(rataSiswaSemua),
    maxRata: rataSiswaSemua.length ? Math.max(...rataSiswaSemua) : null,
    minRata: rataSiswaSemua.length ? Math.min(...rataSiswaSemua) : null,
  };
}

/** Format angka 2 desimal gaya Indonesia (85,71); kosong bila null. */
export function fmt2(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '';
  return v.toFixed(2).replace('.', ',');
}

/**
 * Turunkan rekap untuk tampilan satu kategori (PRD v1.7 7.3): kolom per mapel diambil dari
 * rata-rata kategori terpilih (bukan nilai akhir berbobot), lalu rata-rata siswa, ranking,
 * dan statistik dihitung ulang atas nilai tampilan tersebut.
 */
export function rekapKategori(rekap: RekapKelas, idKategori: string): RekapKelas {
  const baris = rekap.baris.map((b) => {
    const perMapel: Record<string, number | null> = {};
    for (const [idMapel, perKat] of Object.entries(b.akhir.perKategori)) {
      perMapel[idMapel] = perKat?.[idKategori] ?? null;
    }
    const rataSiswa = mean(Object.values(perMapel).filter((v): v is number => v != null));
    return {
      siswa: b.siswa,
      akhir: { perMapel, perKategori: b.akhir.perKategori, rataSiswa, ranking: null as number | null },
    };
  });

  const terurut = [...baris]
    .filter((b) => b.akhir.rataSiswa != null)
    .sort((a, b) => (b.akhir.rataSiswa as number) - (a.akhir.rataSiswa as number));
  let prevNilai: number | null = null;
  let prevRank = 0;
  terurut.forEach((b, i) => {
    const v = b.akhir.rataSiswa as number;
    const rank = prevNilai != null && Math.abs(v - prevNilai) < 1e-9 ? prevRank : i + 1;
    b.akhir.ranking = rank;
    prevNilai = v;
    prevRank = rank;
  });

  const statistikMapel: RekapKelas['statistikMapel'] = {};
  for (const [idMapel] of Object.entries(rekap.statistikMapel)) {
    const vals = baris
      .map((b) => b.akhir.perMapel[idMapel])
      .filter((v): v is number => v != null);
    statistikMapel[idMapel] = {
      rata: mean(vals),
      max: vals.length ? Math.max(...vals) : null,
      min: vals.length ? Math.min(...vals) : null,
      ada: vals.length > 0,
    };
  }

  const rataSiswaSemua = baris
    .map((b) => b.akhir.rataSiswa)
    .filter((v): v is number => v != null);
  return {
    baris,
    statistikMapel,
    rataKelas: mean(rataSiswaSemua),
    maxRata: rataSiswaSemua.length ? Math.max(...rataSiswaSemua) : null,
    minRata: rataSiswaSemua.length ? Math.min(...rataSiswaSemua) : null,
  };
}
