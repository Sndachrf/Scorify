/* eslint-disable @typescript-eslint/no-require-imports */
// Verifikasi isi workbook hasil ekspor (struktur PRD 7.5)
const fs = require('fs');
const ExcelJS = require('/home/z/my-project/node_modules/exceljs');

(async () => {
  const b64 = fs.readFileSync('/tmp/export_b64.txt', 'utf8').trim().replace(/^"/, '').replace(/"$/, '');
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync('/tmp/Nilai_7A.xlsx', buf);
  console.log('size:', buf.length);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  console.log('sheets:', wb.worksheets.map((w) => w.name).join(', '));

  const rekap = wb.getWorksheet('Rekap');
  console.log('\n-- Rekap --');
  console.log('A1:', rekap.getCell(1, 1).value);
  console.log('A2:', rekap.getCell(2, 1).value);
  const header = rekap.getRow(3).values.slice(1);
  console.log('header:', JSON.stringify(header));
  // Baris siswa pertama (Ahmad Fauzi)
  const row4 = rekap.getRow(4).values.slice(1);
  console.log('baris4 (Ahmad):', JSON.stringify(row4));
  // Ringkasan
  const rowsCount = rekap.rowCount;
  const rataRow = rekap.getRow(rowsCount - 2).values.slice(1);
  const maxRow = rekap.getRow(rowsCount - 1).values.slice(1);
  const minRow = rekap.getRow(rowsCount).values.slice(1);
  console.log('Rata-rata Mapel:', JSON.stringify(rataRow));
  console.log('Tertinggi:', JSON.stringify(maxRow));
  console.log('Terendah:', JSON.stringify(minRow));
  console.log('freeze:', JSON.stringify(rekap.views));

  const dm = wb.getWorksheet('Data Master');
  console.log('\n-- Data Master --');
  console.log('A1:', dm.getCell(1, 1).value);
  const dmVals = [];
  dm.eachRow((row, no) => {
    if (no > 1) dmVals.push(no + ':' + JSON.stringify(row.values.slice(1).map((v) => (v == null ? '' : v))));
  });
  console.log(dmVals.join('\n'));

  // Sheet ujian pertama
  const ujianSheet = wb.worksheets.find((w) => w.name !== 'Rekap' && w.name !== 'Data Master');
  console.log('\n-- Ujian:', ujianSheet.name, '--');
  console.log('A1:', ujianSheet.getCell(1, 1).value);
  console.log('A2:', ujianSheet.getCell(2, 1).value);
  console.log('header:', JSON.stringify(ujianSheet.getRow(3).values.slice(1)));
  console.log('baris4:', JSON.stringify(ujianSheet.getRow(4).values.slice(1)));
  console.log('freeze:', JSON.stringify(ujianSheet.views));
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
