// Impor Excel, restore penuh (PRD 7.6): parse Data Master + sheet per ujian,
// preview validasi, lalu buat semua data via operasi lokal (ikut antrean sinkron).
import { db } from '../db';
import { buatKelas, buatKategori, buatSiswa, buatMapel, buatUjian, setNilai } from '../ops';
import { bersihkanNamaSheet } from './sheet-name';

export interface HasilParse {
  kelasNama: string;
  tahunAjaran: string;
  kategori: { nama: string; bobot: number }[];
  ujian: { nama: string; kategori: string; tanggal: string | null }[];
  siswa: { absen: number | null; nama: string }[];
  mapel: string[];
  /** nama ujian → nama mapel → nilai */
  nilai: Record<string, Record<string, number>>;
  selTidakValid: { sheet: string; sel: string; nilai: string }[];
  siswaDilewati: string[];
  peringatan: string[];
}

type Row = import('exceljs').Row;

function teks(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') return '';
  return String(v).trim();
}

function headerCocok(row: Row, kunci: string[]): boolean {
  const vals: string[] = [];
  for (let i = 2; i <= 1 + kunci.length; i += 1) vals.push(teks(row.getCell(i).value));
  return kunci.every((k, i) => vals[i] === k);
}

export async function parseWorkbook(file: File): Promise<HasilParse> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const master = wb.worksheets.find((w) => w.name.toLowerCase() === 'data master');
  if (!master) {
    throw new Error('File tidak dikenali: sheet "Data Master" tidak ditemukan. Impor hanya menerima file hasil ekspor aplikasi ini.');
  }

  const hasil: HasilParse = {
    kelasNama: '',
    tahunAjaran: '',
    kategori: [],
    ujian: [],
    siswa: [],
    mapel: [],
    nilai: {},
    selTidakValid: [],
    siswaDilewati: [],
    peringatan: [],
  };

  // Judul: "Data Master - <Kelas> (<Tahun Ajaran>)" (pemisah tanda hubung; em dash lama tetap diterima).
  const judul = teks(master.getCell(1, 1).value);
  const mJudul = judul.match(/^Data Master\s*[\u2014-]\s*(.+?)\s*\((.+)\)\s*$/);
  if (mJudul) {
    hasil.kelasNama = mJudul[1].trim();
    hasil.tahunAjaran = mJudul[2].trim();
  } else {
    hasil.kelasNama = 'Kelas Impor';
    hasil.tahunAjaran = String(new Date().getFullYear());
    hasil.peringatan.push('Judul Data Master tidak memuat nama kelas; gunakan "Kelas Impor".');
  }

  // Parse blok berlabel di sheet Data Master.
  let blok: '' | 'kategori' | 'ujian' | 'siswa' | 'mapel' = '';
  master.eachRow((row, nomor) => {
    if (nomor === 1) return;
    const a = teks(row.getCell(2).value);
    const kosong = [2, 3, 4].every((c) => teks(row.getCell(c).value) === '');
    if (kosong) {
      blok = '';
      return;
    }
    if (headerCocok(row, ['Kategori', 'Bobot (%)'])) { blok = 'kategori'; return; }
    if (headerCocok(row, ['Ujian', 'Kategori', 'Tanggal'])) { blok = 'ujian'; return; }
    if (headerCocok(row, ['No. Absen', 'Nama Siswa'])) { blok = 'siswa'; return; }
    if (a === 'Mapel' && teks(row.getCell(3).value) === '') { blok = 'mapel'; return; }
    if (!blok) return;

    if (blok === 'kategori') {
      const bobot = Number(teks(row.getCell(3).value));
      if (!a || !Number.isFinite(bobot)) {
        hasil.peringatan.push(`Kategori baris ${nomor} dilewati (bobot tidak valid).`);
        return;
      }
      hasil.kategori.push({ nama: a, bobot });
    } else if (blok === 'ujian') {
      const tgl = teks(row.getCell(4).value);
      hasil.ujian.push({
        nama: a,
        kategori: teks(row.getCell(3).value),
        tanggal: tgl || null,
      });
    } else if (blok === 'siswa') {
      const nama = teks(row.getCell(3).value);
      const absenRaw = teks(row.getCell(2).value);
      const absen = absenRaw === '' ? null : Number(absenRaw);
      if (!nama) {
        hasil.siswaDilewati.push(`baris ${nomor}`);
        return;
      }
      hasil.siswa.push({ absen: absen != null && Number.isFinite(absen) ? absen : null, nama });
    } else if (blok === 'mapel') {
      if (a) hasil.mapel.push(a);
    }
  });

  if (!hasil.kategori.length) throw new Error('Data Master tidak memuat daftar kategori.');
  if (!hasil.ujian.length) throw new Error('Data Master tidak memuat daftar ujian.');
  if (!hasil.siswa.length) throw new Error('Data Master tidak memuat daftar siswa.');
  if (!hasil.mapel.length) throw new Error('Data Master tidak memuat daftar mapel.');

  // Nomori ulang nama duplikat di dalam file (PRD 7.6.6).
  const nomori = (nama: string, kumpulan: string[]): string => {
    let hasilNama = nama;
    let i = 2;
    while (kumpulan.includes(hasilNama)) {
      hasilNama = `${nama} ${i}`;
      i += 1;
    }
    kumpulan.push(hasilNama);
    return hasilNama;
  };
  const namaKategori: string[] = [];
  hasil.kategori = hasil.kategori.map((k) => ({ ...k, nama: nomori(k.nama, namaKategori) }));
  const namaUjian: string[] = [];
  hasil.ujian = hasil.ujian.map((u) => {
    const nama = nomori(u.nama, namaUjian);
    return { ...u, nama };
  });
  const namaMapel: string[] = [];
  hasil.mapel = hasil.mapel.map((m) => nomori(m, namaMapel));

  // Parse sheet per ujian: cocokkan nama sheet dengan nama ujian (sudah dibersihkan saat ekspor).
  const sheetTerpakai = new Set(['Rekap', 'Data Master']);
  const mapelSet = new Set(hasil.mapel);
  const siswaByNama = new Map(hasil.siswa.map((s) => [s.nama, s]));
  const sheetByUjian = new Map<string, import('exceljs').Worksheet>();
  for (const ws of wb.worksheets) {
    if (sheetTerpakai.has(ws.name)) continue;
    const ujianCocok = hasil.ujian.find((u) => bersihkanNamaSheet(u.nama) === ws.name);
    if (!ujianCocok) {
      hasil.peringatan.push(`Sheet "${ws.name}" diabaikan (bukan sheet ujian hasil ekspor).`);
      continue;
    }
    sheetByUjian.set(ujianCocok.nama, ws);
  }

  for (const u of hasil.ujian) {
    hasil.nilai[u.nama] = {};
    const ws = sheetByUjian.get(u.nama);
    if (!ws) continue;
    // Header mapel di baris 3, kolom 4..N (A kosong, B absen, C nama).
    const kolomMapel = new Map<number, string>();
    const headerRow = ws.getRow(3);
    headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
      const nama = teks(cell.value);
      if (col >= 4 && mapelSet.has(nama)) kolomMapel.set(col, nama);
    });
    ws.eachRow((row, nomor) => {
      if (nomor <= 3) return;
      const namaSiswa = teks(row.getCell(3).value);
      if (!namaSiswa || !siswaByNama.has(namaSiswa)) return;
      kolomMapel.forEach((namaMapelSatuan, col) => {
        const raw = row.getCell(col).value;
        if (raw == null || teks(raw) === '') return;
        const num = Number(typeof raw === 'object' ? '' : teks(raw));
        const sel = `${ws.name}!${row.getCell(col).address}`;
        if (!Number.isFinite(num) || num < 0 || num > 100) {
          hasil.selTidakValid.push({ sheet: ws.name, sel, nilai: teks(raw) });
          return;
        }
        hasil.nilai[u.nama][`${namaSiswa}|${namaMapelSatuan}`] = num;
      });
    });
  }

  return hasil;
}

/** Buat seluruh data dari hasil parse. Mengembalikan id kelas baru. */
export async function imporData(hasil: HasilParse): Promise<string> {
  // Bentrok nama kelas → sufiks (Impor <tanggal>) (PRD 7.6.3).
  let nama = hasil.kelasNama;
  const adaKelas = await db.kelas.filter((k) => k.nama.toLowerCase() === nama.toLowerCase()).count();
  if (adaKelas) {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    nama = `${nama} (Impor ${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()})`;
  }
  const kelas = await buatKelas(nama, hasil.tahunAjaran);

  const idKategoriByNama = new Map<string, string>();
  for (const k of hasil.kategori) {
    const kat = await buatKategori(kelas.id, k.nama, k.bobot);
    idKategoriByNama.set(k.nama, kat.id);
  }
  const idMapelByNama = new Map<string, string>();
  for (const m of hasil.mapel) {
    const mp = await buatMapel(kelas.id, m);
    idMapelByNama.set(m, mp.id);
  }
  const idSiswaByNama = new Map<string, string>();
  for (const s of hasil.siswa) {
    const sw = await buatSiswa(kelas.id, s.nama, s.absen);
    idSiswaByNama.set(s.nama, sw.id);
  }
  for (const u of hasil.ujian) {
    const idKategori = idKategoriByNama.get(u.kategori) ?? [...idKategoriByNama.values()][0];
    const uj = await buatUjian(kelas.id, idKategori, u.nama, u.tanggal);
    const nilaiUjian = hasil.nilai[u.nama] ?? {};
    for (const [kunci, nilai] of Object.entries(nilaiUjian)) {
      const [namaSiswa, namaMapel] = kunci.split('|');
      const idSiswa = idSiswaByNama.get(namaSiswa);
      const idMapel = idMapelByNama.get(namaMapel);
      if (idSiswa && idMapel) await setNilai(idSiswa, idMapel, uj.id, nilai);
    }
  }
  return kelas.id;
}
