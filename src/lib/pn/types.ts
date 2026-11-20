// Tipe data domain, Scorify (PRD v1.7)

export type Entitas = 'kelas' | 'kategori' | 'siswa' | 'mapel' | 'ujian' | 'nilai';

/** Metadata sinkronisasi yang melekat pada setiap record (last-write-wins). */
export interface SyncMeta {
  updatedAt: number;
  deviceId: string;
}

export interface Kelas extends SyncMeta {
  id: string;
  nama: string;
  tahunAjaran: string;
}

export interface Kategori extends SyncMeta {
  id: string;
  idKelas: string;
  nama: string;
  bobot: number;
}

export interface Siswa extends SyncMeta {
  id: string;
  idKelas: string;
  nama: string;
  absen: number | null;
}

export interface Mapel extends SyncMeta {
  id: string;
  idKelas: string;
  nama: string;
  urutan: number;
}

export interface Ujian extends SyncMeta {
  id: string;
  idKelas: string;
  idKategori: string;
  nama: string;
  tanggal: string | null;
}

export interface Nilai extends SyncMeta {
  id: string;
  idSiswa: string;
  idMapel: string;
  idUjian: string;
  nilai: number;
}

/** Antrean operasi sinkron (hanya IndexedDB, tidak dikirim utuh ke Sheets). */
export interface OpLog {
  seq?: number;
  entitas: Entitas;
  aksi: 'upsert' | 'delete';
  /** Record utuh untuk aksi upsert. */
  rows?: Record<string, unknown>[];
  /** Id record untuk aksi delete. */
  ids?: string[];
  ts: number;
  status: 'menunggu' | 'terkirim';
}

export interface MetaRow {
  key: string;
  value: string;
}

/** Snapshot penuh data dari GAS `load` / database lokal. */
export interface Snapshot {
  kelas: Kelas[];
  kategori: Kategori[];
  siswa: Siswa[];
  mapel: Mapel[];
  ujian: Ujian[];
  nilai: Nilai[];
}

export const EMPTY_SNAPSHOT: Snapshot = {
  kelas: [],
  kategori: [],
  siswa: [],
  mapel: [],
  ujian: [],
  nilai: [],
};

/** Operasi `mutate` yang dikirim ke GAS. */
export interface MutateOp {
  entitas: Entitas;
  aksi: 'upsert' | 'delete';
  rows?: Record<string, unknown>[];
  ids?: string[];
}

/** Template kategori saat membuat kelas. */
export interface KategoriDraft {
  nama: string;
  bobot: number;
}

export const KATEGORI_STANDAR: KategoriDraft[] = [
  { nama: 'Ulangan Harian', bobot: 30 },
  { nama: 'UTS', bobot: 30 },
  { nama: 'UAS', bobot: 40 },
];

export const KATEGORI_PRESET_NAMA = [
  'Ulangan Harian',
  'Tugas',
  'Praktik',
  'UTS',
  'UAS',
];
