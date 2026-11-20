// Verifikasi struktur file ekspor hasil uji jalan di browser.
import ExcelJS from 'exceljs';

const path = process.argv[2] || process.env.HOME + '/Downloads/Nilai_8B_2026-11-19.xlsx';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path);

console.log('Sheets:', wb.worksheets.map((w) => w.name).join(' | '));

const rekap = wb.getWorksheet('Rekap');
console.log('\n-- Rekap (judul):', rekap.getCell(1, 1).value);
console.log('-- Header baris 3:', JSON.stringify(rekap.getRow(3).values));
for (let r = 4; r <= 8; r++) {
  const v = rekap.getRow(r).values;
  if (v.some((x) => x != null && x !== '')) console.log(`-- Baris ${r}:`, JSON.stringify(v));
}

const dm = wb.getWorksheet('Data Master');
console.log('\n-- Data Master judul:', dm.getCell(1, 1).value);
