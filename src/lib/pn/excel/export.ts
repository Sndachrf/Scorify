// Ekspor Excel (PRD 7.5): sheet Rekap + satu sheet per ujian + sheet Data Master.
// exceljs dimuat lazily (dynamic import) saat fitur pertama kali dipakai.
import { db } from '../db';
import { hitungRekap } from '../calc';
import { bersihkanNamaSheet } from './sheet-name';

const WARNA_HEADER = '1F4E79'; // biru tua (PRD 7.5)

function namaSheetUnik(dipakai: Set<string>, nama: string): string {
  let dasar = bersihkanNamaSheet(nama);
  if (!dipakai.has(dasar)) {
    dipakai.add(dasar);
    return dasar;
  }
  let i = 2;
  while (dipakai.has(`${dasar.slice(0, 28)}(${i})`)) i += 1;
  const unik = `${dasar.slice(0, 28)}(${i})`;
  dipakai.add(unik);
  return unik;
}

function slug(nama: string): string {
  return nama
    .trim()
    .replace(/[^a-zA-Z0-9\-_ ]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

function tanggalFile(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function styleHeader(sheet: import('exceljs').Worksheet, rowIdx: number, colCount: number) {
  const row = sheet.getRow(rowIdx);
  for (let c = 1; c <= colCount; c += 1) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARNA_HEADER } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    };
  }
  row.height = 22;
}

function styleBody(sheet: import('exceljs').Worksheet, dariRow: number, sampaiRow: number, colCount: number) {
  for (let r = dariRow; r <= sampaiRow; r += 1) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= colCount; c += 1) {
      row.getCell(c).border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };
    }
  }
}

function angka2(cell: import('exceljs').Cell, nilai: number | null) {
  if (nilai == null) {
    cell.value = null;
    return;
  }
  cell.value = Math.round(nilai * 100) / 100;
  cell.numFmt = '0.00';
  cell.alignment = { horizontal: 'center' };
}

function lebarKolomOtomatis(sheet: import('exceljs').Worksheet, colCount: number) {
  for (let c = 1; c <= colCount; c += 1) {
    const col = sheet.getColumn(c);
    let maks = 8;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const t = cell.value == null ? '' : String(cell.value);
      maks = Math.max(maks, t.length + 2);
    });
    col.width = Math.min(Math.max(maks, 8), 28);
  }
}

export async function eksporKelas(idKelas: string): Promise<string> {
  const [kelas, kategori, siswa, mapel, ujian, nilai] = await Promise.all([
    db.kelas.get(idKelas),
    db.kategori.where('idKelas').equals(idKelas).toArray(),
    db.siswa.where('idKelas').equals(idKelas).toArray(),
    db.mapel.where('idKelas').equals(idKelas).toArray(),
    db.ujian.where('idKelas').equals(idKelas).toArray(),
    db.nilai.where('idSiswa').anyOf((await db.siswa.where('idKelas').equals(idKelas).toArray()).map((s) => s.id)).toArray(),
  ]);
  if (!kelas) throw new Error('Kelas tidak ditemukan.');
  if (!siswa.length || !mapel.length || !ujian.length) {
    throw new Error('Kelas belum lengkap: butuh minimal 1 siswa, 1 mapel, dan 1 ujian.');
  }

  const katSorted = [...kategori].sort((a, b) => a.nama.localeCompare(b.nama));
  const mapelSorted = [...mapel].sort((a, b) => a.urutan - b.urutan);
  const siswaSorted = [...siswa].sort((a, b) => (a.absen ?? 999) - (b.absen ?? 999) || a.nama.localeCompare(b.nama));
  const rekap = hitungRekap(siswaSorted, mapelSorted, katSorted, ujian, nilai);

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Scorify';

  const nilaiByUjian = new Map<string, Map<string, number>>();
  for (const n of nilai) {
    if (!nilaiByUjian.has(n.idUjian)) nilaiByUjian.set(n.idUjian, new Map());
    nilaiByUjian.get(n.idUjian)!.set(`${n.idSiswa}|${n.idMapel}`, n.nilai);
  }

  // ---------- Sheet Rekap ----------
  const ws = wb.addWorksheet('Rekap');
  const jumlahKolom = 3 + mapelSorted.length + 2; // A kosong, absen, nama, mapel…, rata-rata, ranking
  ws.mergeCells(1, 1, 1, jumlahKolom);
  ws.getCell(1, 1).value = `Rekap Nilai - ${kelas.nama} (${kelas.tahunAjaran})`;
  ws.getCell(1, 1).font = { bold: true, size: 13 };
  ws.mergeCells(2, 1, 2, jumlahKolom);
  ws.getCell(2, 1).value = `Diekspor: ${new Date().toLocaleString('id-ID')}`;
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: 'FF666666' } };

  const headerRow = 3;
  ws.getRow(headerRow).values = [
    '',
    'No. Absen',
    'Nama Siswa',
    ...mapelSorted.map((m) => m.nama),
    'Rata-rata',
    'Ranking',
  ];
  styleHeader(ws, headerRow, jumlahKolom);

  let r = headerRow + 1;
  for (const b of rekap.baris) {
    ws.getRow(r).values = [
      '',
      b.siswa.absen ?? '',
      b.siswa.nama,
      ...mapelSorted.map((m) => ''),
      '',
      '',
    ];
    mapelSorted.forEach((m, i) => angka2(ws.getCell(r, 4 + i), b.akhir.perMapel[m.id]));
    angka2(ws.getCell(r, 2 + mapelSorted.length + 2), b.akhir.rataSiswa);
    const rankCell = ws.getCell(r, 3 + mapelSorted.length + 2);
    rankCell.value = b.akhir.ranking ?? null;
    rankCell.alignment = { horizontal: 'center' };
    r += 1;
  }

  const ringkasan = [
    { label: 'Rata-rata Mapel', ambil: (s: { rata: number | null }) => s.rata },
    { label: 'Tertinggi', ambil: (s: { max: number | null }) => s.max },
    { label: 'Terendah', ambil: (s: { min: number | null }) => s.min },
  ];
  const ringkasanMulai = r;
  for (const ring of ringkasan) {
    ws.getRow(r).values = ['', '', ring.label, ...mapelSorted.map(() => ''), '', ''];
    mapelSorted.forEach((m, i) => angka2(ws.getCell(r, 4 + i), ring.ambil(rekap.statistikMapel[m.id])));
    const statRata = {
      rata: rekap.rataKelas,
      max: rekap.maxRata,
      min: rekap.minRata,
    };
    angka2(ws.getCell(r, 2 + mapelSorted.length + 2), ring.ambil(statRata));
    ws.getCell(r, 3).font = { bold: true };
    r += 1;
  }
  styleBody(ws, headerRow + 1, r - 1, jumlahKolom);
  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: headerRow }];
  lebarKolomOtomatis(ws, jumlahKolom);

  // ---------- Satu sheet per ujian ----------
  const dipakai = new Set<string>(['Rekap', 'Data Master']);
  for (const u of ujian) {
    const kategoriUjian = katSorted.find((k) => k.id === u.idKategori);
    const sheetName = namaSheetUnik(dipakai, u.nama);
    const wu = wb.addWorksheet(sheetName);
    const kolomUjian = 2 + mapelSorted.length;
    wu.mergeCells(1, 1, 1, kolomUjian);
    wu.getCell(1, 1).value = `${u.nama}${kategoriUjian ? ` (${kategoriUjian.nama})` : ''} - ${kelas.nama} (${kelas.tahunAjaran})`;
    wu.getCell(1, 1).font = { bold: true, size: 12 };
    wu.mergeCells(2, 1, 2, kolomUjian);
    wu.getCell(2, 1).value = u.tanggal ? `Tanggal: ${u.tanggal}` : '';
    wu.getCell(2, 1).font = { italic: true, size: 10, color: { argb: 'FF666666' } };

    wu.getRow(3).values = ['', 'No. Absen', 'Nama Siswa', ...mapelSorted.map((m) => m.nama)];
    styleHeader(wu, 3, kolomUjian);
    let ru = 4;
    for (const s of siswaSorted) {
      wu.getRow(ru).values = ['', s.absen ?? '', s.nama, ...mapelSorted.map(() => '')];
      mapelSorted.forEach((m, i) => {
        const v = nilaiByUjian.get(u.id)?.get(`${s.id}|${m.id}`);
        const cell = wu.getCell(ru, 4 + i);
        if (v != null) {
          cell.value = v;
          cell.numFmt = '0.00';
          cell.alignment = { horizontal: 'center' };
        }
      });
      ru += 1;
    }
    styleBody(wu, 4, ru - 1, kolomUjian);
    wu.views = [{ state: 'frozen', xSplit: 3, ySplit: 3 }];
    lebarKolomOtomatis(wu, kolomUjian);
  }

  // ---------- Sheet Data Master ----------
  const dm = wb.addWorksheet('Data Master');
  dm.mergeCells(1, 1, 1, 4);
  dm.getCell(1, 1).value = `Data Master - ${kelas.nama} (${kelas.tahunAjaran})`;
  dm.getCell(1, 1).font = { bold: true, size: 13 };
  let rd = 3;

  dm.getRow(rd).values = ['', 'Kategori', 'Bobot (%)'];
  styleHeader(dm, rd, 3);
  rd += 1;
  for (const k of katSorted) {
    dm.getRow(rd).values = ['', k.nama, k.bobot];
    rd += 1;
  }
  rd += 1;

  dm.getRow(rd).values = ['', 'Ujian', 'Kategori', 'Tanggal'];
  styleHeader(dm, rd, 4);
  rd += 1;
  for (const u of ujian) {
    const kategoriUjian = katSorted.find((k) => k.id === u.idKategori);
    dm.getRow(rd).values = ['', u.nama, kategoriUjian?.nama ?? '', u.tanggal ?? ''];
    rd += 1;
  }
  rd += 1;

  dm.getRow(rd).values = ['', 'No. Absen', 'Nama Siswa'];
  styleHeader(dm, rd, 3);
  rd += 1;
  for (const s of siswaSorted) {
    dm.getRow(rd).values = ['', s.absen ?? '', s.nama];
    rd += 1;
  }
  rd += 1;

  dm.getRow(rd).values = ['', 'Mapel'];
  styleHeader(dm, rd, 2);
  rd += 1;
  for (const m of mapelSorted) {
    dm.getRow(rd).values = ['', m.nama];
    rd += 1;
  }
  lebarKolomOtomatis(dm, 4);

  const namaFile = `Nilai_${slug(kelas.nama)}_${tanggalFile()}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaFile;
  a.click();
  URL.revokeObjectURL(url);
  return namaFile;
}
