// Kode Google Apps Script backend (PRD v1.8): dipasang guru SEKALI di luar aplikasi saat deploy
// (lihat panduan deploy proyek), lalu URL /exec ditanam ke aplikasi via secret GAS_WEB_APP_URL.
// Web App: execute as Me, access Anyone. API: ping | load | mutate (POST JSON, text/plain).

export const GAS_SCRIPT = String.raw`/**
 * Backend Scorify (Pencatat Nilai Siswa), Google Apps Script (PRD v1.8)
 * Pasang sekali di luar aplikasi: buka Spreadsheet > Extensions > Apps Script >
 * tempel > Deploy as Web App (Execute as: Me, Who has access: Anyone).
 * Salin URL /exec lalu pasang sebagai secret GAS_WEB_APP_URL di repository GitHub.
 */
var SHEETS = {
  kelas:    ['id','nama','tahunAjaran','updatedAt','deviceId'],
  kategori: ['id','idKelas','nama','bobot','updatedAt','deviceId'],
  siswa:    ['id','idKelas','nama','absen','updatedAt','deviceId'],
  mapel:    ['id','idKelas','nama','urutan','updatedAt','deviceId'],
  ujian:    ['id','idKelas','idKategori','nama','tanggal','updatedAt','deviceId'],
  nilai:    ['id','idSiswa','idMapel','idUjian','nilai','updatedAt','deviceId']
};
var NUM_FIELDS = { bobot:1, absen:1, urutan:1, nilai:1, updatedAt:1 };

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  return handle({ action: p.action || 'ping' });
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {}
  return handle(body);
}

function handle(req) {
  try {
    var action = req.action || 'ping';
    ensureTabs();
    if (action === 'ping') {
      return out({ ok: true, action: 'ping', tabs: Object.keys(SHEETS) });
    }
    if (action === 'load') {
      return out({ ok: true, action: 'load', data: readAll() });
    }
    if (action === 'mutate') {
      var ops = req.ops || [];
      applyOps(ops);
      return out({ ok: true, action: 'mutate', applied: ops.length });
    }
    return out({ ok: false, error: 'Aksi tidak dikenal: ' + action });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }

function ensureTabs() {
  var book = ss();
  Object.keys(SHEETS).forEach(function (nama) {
    var sh = book.getSheetByName(nama);
    if (!sh) {
      sh = book.insertSheet(nama);
      sh.getRange(1, 1, 1, SHEETS[nama].length).setValues([SHEETS[nama]]);
      sh.setFrozenRows(1);
    }
  });
}

function readAll() {
  var book = ss();
  var data = {};
  Object.keys(SHEETS).forEach(function (nama) {
    var sh = book.getSheetByName(nama);
    var cols = SHEETS[nama];
    var values = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).getValues() : [];
    var rows = values
      .filter(function (row) { return row[0] !== '' && row[0] !== null; })
      .map(function (row) {
        var obj = {};
        cols.forEach(function (col, i) {
          var v = row[i];
          if (NUM_FIELDS[col]) {
            v = (v === '' || v === null) ? null : Number(v);
            if (v === null && col === 'updatedAt') v = 0;
          } else if (col === 'tanggal') {
            v = (v === '' || v === null) ? null : (v instanceof Date ? toISODate(v) : String(v));
          } else {
            v = (v === null || v === undefined) ? '' : String(v);
            if (col !== 'id' && v === '') v = '';
          }
          obj[col] = v;
        });
        obj.updatedAt = Number(obj.updatedAt) || 0;
        return obj;
      });
    data[nama] = rows;
  });
  return data;
}

function toISODate(d) {
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function applyOps(ops) {
  var book = ss();
  var cache = {};
  ops.forEach(function (op) {
    var nama = op.entitas;
    if (!SHEETS[nama]) return;
    var sh = book.getSheetByName(nama);
    var cols = SHEETS[nama];
    if (!cache[nama]) {
      var last = sh.getLastRow();
      cache[nama] = {
        sh: sh,
        cols: cols,
        lastRow: last,
        ids: last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : []
      };
    }
    var c = cache[nama];
    if (op.aksi === 'upsert') {
      (op.rows || []).forEach(function (row) {
        if (!row.id) return;
        var arr = cols.map(function (col) {
          var v = row[col];
          if (v === undefined || v === null) return '';
          if (typeof v === 'object') return '';
          return v;
        });
        var idx = c.ids.indexOf(String(row.id));
        if (idx === -1) {
          c.sh.getRange(c.lastRow + 1, 1, 1, arr.length).setValues([arr]);
          c.ids.push(String(row.id));
          c.lastRow += 1;
        } else {
          c.sh.getRange(idx + 2, 1, 1, arr.length).setValues([arr]);
        }
      });
    } else if (op.aksi === 'delete') {
      var ids = (op.ids || []).map(String);
      var rowsToDelete = [];
      ids.forEach(function (id) {
        var idx = c.ids.indexOf(id);
        if (idx !== -1) rowsToDelete.push(idx + 2);
      });
      if (rowsToDelete.length) {
        rowsToDelete.sort(function (a, b) { return b - a; }).forEach(function (r) {
          c.sh.deleteRow(r);
          c.ids.splice(r - 2, 1);
          c.lastRow -= 1;
        });
      }
    }
  });
}`;
