// Mesin sinkron offline-first (PRD 5 & 7.7):
// push antrean OpLog (batch) → pull snapshot penuh → ganti cache lokal.
// Data tidak pernah dibuang saat gagal (tetap di antrean); retry otomatis dengan jeda meningkat.
// PRD v1.8: data lokal yang dibuat sebelum koneksi terpasang dikirim dulu pada sinkron pertama
// (migrasi awal) agar tidak tertimpa snapshot awal dari Sheets.
import { useSyncStore } from './store';
import { loadSnapshot, pushMutate } from './gas';
import { db, getGasUrl, getLastSync, setLastSync } from '../db';
import type { Table } from 'dexie';
import type { Entitas, MutateOp, Snapshot } from '../types';

const TABEL = {
  kelas: db.kelas,
  kategori: db.kategori,
  siswa: db.siswa,
  mapel: db.mapel,
  ujian: db.ujian,
  nilai: db.nilai,
} as const;

/** Tabel entitas dengan tipe generik umum (dipakai saat menerapkan snapshot). */
type TabelUmum = Table<{ id: string } & Record<string, unknown>, string>;

const JEDA_RETRY = [5000, 15000, 45000, 120000, 300000];

let sinkronBerjalan = false;
let timerDebounce: ReturnType<typeof setTimeout> | null = null;
let timerRetry: ReturnType<typeof setTimeout> | null = null;
let indeksRetry = 0;

async function hitungPending(): Promise<number> {
  return db.oplog.count();
}

async function perbaruiPending() {
  const n = await hitungPending();
  useSyncStore.getState().setPending(n);
  return n;
}

/** Terapkan snapshot dari Sheets ke tabel lokal (protect record yang masih menunggu). */
async function terapkanSnapshot(snap: Snapshot) {
  const pendingIds = new Map<Entitas, Set<string>>();
  const entitasList: Entitas[] = ['kelas', 'kategori', 'siswa', 'mapel', 'ujian', 'nilai'];
  for (const e of entitasList) pendingIds.set(e, new Set());
  await db.oplog.each((op) => {
    if (op.aksi === 'upsert') {
      (op.rows ?? []).forEach((r) => {
        const id = r['id'] as string | undefined;
        if (id) pendingIds.get(op.entitas)?.add(id);
      });
    } else {
      (op.ids ?? []).forEach((id) => pendingIds.get(op.entitas)?.add(id));
    }
  });

  await db.transaction(
    'rw',
    [db.kelas, db.kategori, db.siswa, db.mapel, db.ujian, db.nilai],
    async () => {
      for (const e of entitasList) {
        const rows = (snap[e] ?? []) as unknown as Array<{ id: string } & Record<string, unknown>>;
        const tabel = TABEL[e] as unknown as TabelUmum;
        const terkunci = pendingIds.get(e) ?? new Set<string>();
        await tabel.bulkPut(rows.filter((r) => !terkunci.has(r.id)));
        const snapIds = new Set(rows.map((r) => r.id));
        const lokal = await tabel.toArray();
        const hapusIds = lokal
          .filter((r) => !snapIds.has(r.id) && !terkunci.has(r.id))
          .map((r) => r.id);
        if (hapusIds.length) await tabel.bulkDelete(hapusIds);
      }
    }
  );
}

/** Baca seluruh data lokal sebagai opsi upsert (migrasi awal, PRD v1.8). */
async function opsDariLokal(): Promise<MutateOp[]> {
  const entitasList: Entitas[] = ['kelas', 'kategori', 'siswa', 'mapel', 'ujian', 'nilai'];
  const ops: MutateOp[] = [];
  for (const e of entitasList) {
    const rows = await TABEL[e].toArray();
    if (rows.length) {
      ops.push({
        entitas: e,
        aksi: 'upsert',
        rows: rows as unknown as Record<string, unknown>[],
      });
    }
  }
  return ops;
}

/** Sinkronisasi manual/pemicu: push → pull → perbarui status. */
export async function syncNow(): Promise<boolean> {
  const store = useSyncStore.getState();
  if (!navigator.onLine) {
    store.setOnline(false);
    await perbaruiPending();
    return false;
  }
  store.setOnline(true);

  const url = await getGasUrl();
  const pending = await perbaruiPending();
  if (!url) {
    useSyncStore.getState().patch({ status: 'belum-setup' });
    return false;
  }
  if (sinkronBerjalan) return false;

  sinkronBerjalan = true;
  useSyncStore.getState().patch({ status: 'menyinkron', pesanGagal: null });
  try {
    // 1) PUSH antrean sebagai satu batch mutate (PRD 7.7).
    if (pending > 0) {
      const entries = await db.oplog.orderBy('seq').toArray();
      const ops: MutateOp[] = entries.map((e) => ({
        entitas: e.entitas,
        aksi: e.aksi,
        rows: e.rows,
        ids: e.ids,
      }));
      if (ops.length) await pushMutate(url, ops);
      await db.oplog.bulkDelete(entries.map((e) => e.seq as number));
    }
    // 1b) Migrasi awal (PRD v1.8): perangkat sudah punya data sebelum koneksi terpasang,
    // belum pernah tersinkron, dan antrean kosong → kirim seluruh data lokal dulu
    // supaya tidak tertimpa snapshot (masih kosong) dari Sheets.
    const lastTs = await getLastSync();
    if (pending === 0 && lastTs == null) {
      const opsMigrasi = await opsDariLokal();
      if (opsMigrasi.length) await pushMutate(url, opsMigrasi);
    }

    // 2) PULL snapshot penuh; record yang masih menunggu dilindungi.
    const resp = await loadSnapshot(url);
    if (resp.data) await terapkanSnapshot(resp.data);

    const ts = Date.now();
    await setLastSync(ts);
    indeksRetry = 0;
    if (timerRetry) {
      clearTimeout(timerRetry);
      timerRetry = null;
    }
    const sisa = await perbaruiPending();
    useSyncStore.getState().patch({
      status: sisa > 0 ? 'idle' : 'tersinkron',
      lastSync: ts,
    });
    return true;
  } catch (err) {
    const pesan = err instanceof Error ? err.message : String(err);
    useSyncStore.getState().patch({
      status: 'gagal',
      pesanGagal: pesan,
      online: navigator.onLine,
    });
    jadwalkanRetry();
    return false;
  } finally {
    sinkronBerjalan = false;
  }
}

function jadwalkanRetry() {
  if (timerRetry) clearTimeout(timerRetry);
  const jeda = JEDA_RETRY[Math.min(indeksRetry, JEDA_RETRY.length - 1)];
  indeksRetry += 1;
  timerRetry = setTimeout(() => {
    void syncNow();
  }, jeda);
}

/** Dipanggil setelah mutasi lokal: perbarui hitungan + debounce auto-sync (±3,5 dtk, PRD 7.2). */
export async function afterMutation() {
  await perbaruiPending();
  const s = useSyncStore.getState();
  if (s.status === 'tersinkron' || s.status === 'belum-setup') {
    s.patch({ status: s.status === 'belum-setup' ? 'belum-setup' : 'idle' });
  }
  if (!s.online || !(await getGasUrl())) return;
  if (timerDebounce) clearTimeout(timerDebounce);
  timerDebounce = setTimeout(() => {
    void syncNow();
  }, 3500);
}

/** Inisialisasi saat aplikasi dibuka: muat lastSync, pasang listener, sinkron awal. */
export function initSync() {
  const store = useSyncStore.getState();
  setOnline(store.online);
  void getLastSync().then((ts) => store.setLastSync(ts));
  void perbaruiPending().then((n) => {
    if (n > 0) useSyncStore.getState().patch({ status: 'idle' });
  });

  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));

  void syncNow();
}

function setOnline(v: boolean) {
  useSyncStore.getState().setOnline(v);
  if (v) {
    void syncNow();
  } else {
    useSyncStore.getState().patch({ status: 'idle' });
    void perbaruiPending();
  }
}
