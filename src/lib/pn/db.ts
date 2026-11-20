// Database lokal offline-first, Dexie/IndexedDB (PRD v1.7 bagian 5 & 6, v1.8 konfigurasi build)
import Dexie, { type Table } from 'dexie';
import type {
  Kelas,
  Kategori,
  Siswa,
  Mapel,
  Ujian,
  Nilai,
  OpLog,
  MetaRow,
} from './types';
import { GAS_URL_BUILD } from './config';

class PNDatabase extends Dexie {
  kelas!: Table<Kelas, string>;
  kategori!: Table<Kategori, string>;
  siswa!: Table<Siswa, string>;
  mapel!: Table<Mapel, string>;
  ujian!: Table<Ujian, string>;
  nilai!: Table<Nilai, string>;
  oplog!: Table<OpLog, number>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('pencatat-nilai');
    this.version(1).stores({
      // Index sekadar membantu query; keunikan nama divalidasi di lapisan aplikasi.
      kelas: 'id',
      kategori: 'id, idKelas, [idKelas+nama]',
      siswa: 'id, idKelas, [idKelas+absen]',
      mapel: 'id, idKelas, [idKelas+urutan]',
      ujian: 'id, idKelas, idKategori, [idKelas+nama]',
      nilai: 'id, idSiswa, idMapel, idUjian, [idSiswa+idMapel+idUjian]',
      oplog: '++seq, status',
      meta: 'key',
    });
  }
}

export const db = new PNDatabase();

/** Id unik: timestamp base36 + acak. */
export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

let cachedDeviceId: string | null = null;

/** Identitas perangkat, dibuat acak sekali per browser (PRD 6). */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  const row = await db.meta.get('deviceId');
  if (row?.value) {
    cachedDeviceId = row.value;
    return cachedDeviceId;
  }
  const id = `dev-${genId()}`;
  await db.meta.put({ key: 'deviceId', value: id });
  cachedDeviceId = id;
  return id;
}

/** Asal URL Web App yang aktif (PRD v1.8). */
export interface GasUrlInfo {
  url: string | null;
  /** 'tersimpan' = diisi manual di perangkat (versi lama); 'build' = ditanam saat build. */
  sumber: 'tersimpan' | 'build' | null;
}

/**
 * URL Web App aktif: yang tersimpan di perangkat lebih diutamakan,
 * lalu fallback ke URL yang ditanam saat build (NEXT_PUBLIC_GAS_URL).
 * Keduanya tidak ada → mode data lokal (tanpa sinkronisasi).
 */
export async function getGasUrlDetail(): Promise<GasUrlInfo> {
  const row = await db.meta.get('gasUrl');
  if (row?.value) return { url: row.value, sumber: 'tersimpan' };
  if (GAS_URL_BUILD) return { url: GAS_URL_BUILD, sumber: 'build' };
  return { url: null, sumber: null };
}

export async function getGasUrl(): Promise<string | null> {
  return (await getGasUrlDetail()).url;
}

export async function setGasUrl(url: string | null): Promise<void> {
  if (url) await db.meta.put({ key: 'gasUrl', value: url });
  else await db.meta.delete('gasUrl');
}

export async function getLastSync(): Promise<number | null> {
  const row = await db.meta.get('lastSync');
  return row?.value ? Number(row.value) : null;
}

export async function setLastSync(ts: number): Promise<void> {
  await db.meta.put({ key: 'lastSync', value: String(ts) });
}
