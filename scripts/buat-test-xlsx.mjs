// Buat file .xlsx uji coba untuk menguji alur Impor Excel (meniru format ekspor aplikasi).
import ExcelJS from 'exceljs';

const wb = new ExcelJS.Workbook();

// --- Sheet Data Master ---
const dm = wb.addWorksheet('Data Master');
dm.getCell(1, 1).value = 'Data Master — 8B (2026/2027)';
let r = 3;
dm.getRow(r).values = ['', 'Kategori', 'Bobot (%)'];
r += 1;
dm.getRow(r).values = ['', 'Ulangan Harian', 30];
r += 1;
dm.getRow(r).values = ['', 'UTS', 30];
r += 1;
dm.getRow(r).values = ['', 'UAS', 40];
r += 2;
dm.getRow(r).values = ['', 'Ujian', 'Kategori', 'Tanggal'];
r += 1;
dm.getRow(r).values = ['', 'UH1', 'Ulangan Harian', '2026-11-10'];
r += 1;
dm.getRow(r).values = ['', 'UTS', 'UTS', ''];
r += 2;
dm.getRow(r).values = ['', 'No. Absen', 'Nama Siswa'];
r += 1;
const siswa = ['Ali Rahman', 'Bella Safira', 'Candra Wijaya'];
siswa.forEach((nama, i) => {
  dm.getRow(r).values = ['', i + 1, nama];
  r += 1;
});
r += 1;
dm.getRow(r).values = ['', 'Mapel'];
r += 1;
dm.getRow(r).values = ['', 'Matematika'];
r += 1;
dm.getRow(r).values = ['', 'Bahasa Indonesia'];

// --- Sheet UH1 (satu sel tidak valid untuk uji pratinjau) ---
const u1 = wb.addWorksheet('UH1');
u1.mergeCells(1, 1, 1, 4);
u1.getCell(1, 1).value = 'UH1 (Ulangan Harian) — 8B (2026/2027)';
u1.getRow(3).values = ['', 'No. Absen', 'Nama Siswa', 'Matematika', 'Bahasa Indonesia'];
let ru = 4;
const nilaiUH1 = [
  [85, 78],
  ['abc', 92],   // sel tidak valid — harus dilewati & dilaporkan
  [70, 105],     // di luar 0–100 — harus dilewati & dilaporkan
];
for (const s of siswa) {
  u1.getRow(ru).values = ['', siswa.indexOf(s) + 1, s, '', ''];
  const [m, b] = nilaiUH1[ru - 4];
  u1.getCell(ru, 4).value = m;
  u1.getCell(ru, 5).value = b;
  ru += 1;
}

// --- Sheet UTS (parsial: hanya 2 siswa) ---
const u2 = wb.addWorksheet('UTS');
u2.mergeCells(1, 1, 1, 4);
u2.getCell(1, 1).value = 'UTS (UTS) — 8B (2026/2027)';
u2.getRow(3).values = ['', 'No. Absen', 'Nama Siswa', 'Matematika', 'Bahasa Indonesia'];
ru = 4;
for (const s of siswa.slice(0, 2)) {
  u2.getRow(ru).values = ['', siswa.indexOf(s) + 1, s, '', ''];
  u2.getCell(ru, 4).value = 75 + siswa.indexOf(s) * 5;
  u2.getCell(ru, 5).value = 80 + siswa.indexOf(s) * 3;
  ru += 1;
}

await wb.xlsx.writeFile('/tmp/render/test-impor.xlsx');
console.log('OK: /tmp/render/test-impor.xlsx dibuat');
