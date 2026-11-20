// Operasi mutasi: tulis instan ke IndexedDB + catat OpLog (PRD 7.2, 8.10)
// Operasi cascade masuk sebagai satu batch transaksi (PRD 6).
import { db, genId, getDeviceId } from './db';
import type {
  Kelas,
  Kategori,
  Siswa,
  Mapel,
  Ujian,
  Nilai,
  Entitas,
} from './types';

export class NamaDuplikatError extends Error {
  constructor(pesan: string) {
    super(pesan);
    this.name = 'NamaDuplikatError';
  }
}

async function stamp() {
  const deviceId = await getDeviceId();
  return { updatedAt: Date.now(), deviceId };
}

async function catat(
  entitas: Entitas,
  aksi: 'upsert' | 'delete',
  data: { rows?: Record<string, unknown>[]; ids?: string[] }
) {
  await db.oplog.add({
    entitas,
    aksi,
    rows: data.rows,
    ids: data.ids,
    ts: Date.now(),
    status: 'menunggu',
  });
}

// ---------- KELAS ----------

export async function buatKelas(nama: string, tahunAjaran: string): Promise<Kelas> {
  const ada = await db.kelas.filter((k) => k.nama.toLowerCase() === nama.toLowerCase()).count();
  if (ada) throw new NamaDuplikatError(`Kelas "${nama}" sudah ada.`);
  const meta = await stamp();
  const kelas: Kelas = { id: genId(), nama, tahunAjaran, ...meta };
  await db.transaction('rw', db.kelas, db.oplog, async () => {
    await db.kelas.add(kelas);
    await catat('kelas', 'upsert', { rows: [kelas as unknown as Record<string, unknown>] });
  });
  return kelas;
}

export async function ubahKelas(id: string, nama: string, tahunAjaran: string) {
  const lama = await db.kelas.get(id);
  if (!lama) return;
  const ada = await db.kelas
    .filter((k) => k.id !== id && k.nama.toLowerCase() === nama.toLowerCase())
    .count();
  if (ada) throw new NamaDuplikatError(`Kelas "${nama}" sudah ada.`);
  const meta = await stamp();
  const baru: Kelas = { ...lama, nama, tahunAjaran, ...meta };
  await db.transaction('rw', db.kelas, db.oplog, async () => {
    await db.kelas.put(baru);
    await catat('kelas', 'upsert', { rows: [baru as unknown as Record<string, unknown>] });
  });
}

/** Hapus kelas → cascade seluruh siswa, mapel, kategori, ujian, nilai (PRD 8.6). */
export async function hapusKelasCascade(id: string) {
  const kategori = await db.kategori.where('idKelas').equals(id).toArray();
  const siswa = await db.siswa.where('idKelas').equals(id).toArray();
  const [mapel, ujian, nilai] = await Promise.all([
    db.mapel.where('idKelas').equals(id).toArray(),
    db.ujian.where('idKelas').equals(id).toArray(),
    db.nilai.where('idSiswa').anyOf(siswa.map((s) => s.id)).toArray(),
  ]);
  await db.transaction(
    'rw',
    [db.kelas, db.kategori, db.siswa, db.mapel, db.ujian, db.nilai, db.oplog],
    async () => {
      await db.kelas.delete(id);
      await db.kategori.bulkDelete(kategori.map((x) => x.id));
      await db.siswa.bulkDelete(siswa.map((x) => x.id));
      await db.mapel.bulkDelete(mapel.map((x) => x.id));
      await db.ujian.bulkDelete(ujian.map((x) => x.id));
      await db.nilai.bulkDelete(nilai.map((x) => x.id));
      await catat('kelas', 'delete', { ids: [id] });
      if (kategori.length) await catat('kategori', 'delete', { ids: kategori.map((x) => x.id) });
      if (siswa.length) await catat('siswa', 'delete', { ids: siswa.map((x) => x.id) });
      if (mapel.length) await catat('mapel', 'delete', { ids: mapel.map((x) => x.id) });
      if (ujian.length) await catat('ujian', 'delete', { ids: ujian.map((x) => x.id) });
      if (nilai.length) await catat('nilai', 'delete', { ids: nilai.map((x) => x.id) });
    }
  );
}

// ---------- KATEGORI ----------

export async function buatKategori(idKelas: string, nama: string, bobot: number): Promise<Kategori> {
  const ada = await db.kategori
    .where('[idKelas+nama]')
    .equals([idKelas, nama])
    .count();
  if (ada) throw new NamaDuplikatError(`Kategori "${nama}" sudah ada di kelas ini.`);
  const meta = await stamp();
  const k: Kategori = { id: genId(), idKelas, nama, bobot, ...meta };
  await db.transaction('rw', db.kategori, db.oplog, async () => {
    await db.kategori.add(k);
    await catat('kategori', 'upsert', { rows: [k as unknown as Record<string, unknown>] });
  });
  return k;
}

export async function ubahKategori(id: string, nama: string, bobot: number) {
  const lama = await db.kategori.get(id);
  if (!lama) return;
  const ada = await db.kategori
    .where('[idKelas+nama]')
    .equals([lama.idKelas, nama])
    .filter((x) => x.id !== id)
    .count();
  if (ada) throw new NamaDuplikatError(`Kategori "${nama}" sudah ada di kelas ini.`);
  const meta = await stamp();
  const baru: Kategori = { ...lama, nama, bobot, ...meta };
  await db.transaction('rw', db.kategori, db.oplog, async () => {
    await db.kategori.put(baru);
    await catat('kategori', 'upsert', { rows: [baru as unknown as Record<string, unknown>] });
  });
}

/** Hapus kategori → ujian di kategori itu beserta nilainya ikut terhapus (PRD 8.6). */
export async function hapusKategoriCascade(id: string) {
  const ujian = await db.ujian.where('idKategori').equals(id).toArray();
  const nilai = await db.nilai.where('idUjian').anyOf(ujian.map((u) => u.id)).toArray();
  await db.transaction('rw', db.kategori, db.ujian, db.nilai, db.oplog, async () => {
    await db.kategori.delete(id);
    await db.ujian.bulkDelete(ujian.map((x) => x.id));
    await db.nilai.bulkDelete(nilai.map((x) => x.id));
    await catat('kategori', 'delete', { ids: [id] });
    if (ujian.length) await catat('ujian', 'delete', { ids: ujian.map((x) => x.id) });
    if (nilai.length) await catat('nilai', 'delete', { ids: nilai.map((x) => x.id) });
  });
}

// ---------- SISWA ----------

export async function buatSiswa(idKelas: string, nama: string, absen: number | null): Promise<Siswa> {
  if (absen != null) {
    const ada = await db.siswa.where('[idKelas+absen]').equals([idKelas, absen]).count();
    if (ada) throw new NamaDuplikatError(`Nomor absen ${absen} sudah dipakai di kelas ini.`);
  }
  const meta = await stamp();
  const s: Siswa = { id: genId(), idKelas, nama, absen, ...meta };
  await db.transaction('rw', db.siswa, db.oplog, async () => {
    await db.siswa.add(s);
    await catat('siswa', 'upsert', { rows: [s as unknown as Record<string, unknown>] });
  });
  return s;
}

export async function ubahSiswa(id: string, nama: string, absen: number | null) {
  const lama = await db.siswa.get(id);
  if (!lama) return;
  if (absen != null) {
    const ada = await db.siswa
      .where('[idKelas+absen]')
      .equals([lama.idKelas, absen])
      .filter((x) => x.id !== id)
      .count();
    if (ada) throw new NamaDuplikatError(`Nomor absen ${absen} sudah dipakai di kelas ini.`);
  }
  const meta = await stamp();
  const baru: Siswa = { ...lama, nama, absen, ...meta };
  await db.transaction('rw', db.siswa, db.oplog, async () => {
    await db.siswa.put(baru);
    await catat('siswa', 'upsert', { rows: [baru as unknown as Record<string, unknown>] });
  });
}

/** Hapus siswa → nilainya ikut terhapus (PRD 8.6). */
export async function hapusSiswaCascade(id: string) {
  const nilai = await db.nilai.where('idSiswa').equals(id).toArray();
  await db.transaction('rw', db.siswa, db.nilai, db.oplog, async () => {
    await db.siswa.delete(id);
    await db.nilai.bulkDelete(nilai.map((x) => x.id));
    await catat('siswa', 'delete', { ids: [id] });
    if (nilai.length) await catat('nilai', 'delete', { ids: nilai.map((x) => x.id) });
  });
}

// ---------- MAPEL ----------

export async function buatMapel(idKelas: string, nama: string): Promise<Mapel> {
  const ada = await db.mapel.filter((m) => m.idKelas === idKelas && m.nama.toLowerCase() === nama.toLowerCase()).count();
  if (ada) throw new NamaDuplikatError(`Mapel "${nama}" sudah ada di kelas ini.`);
  const terakhir = await db.mapel.where('idKelas').equals(idKelas).toArray();
  const urutan = terakhir.reduce((mx, m) => Math.max(mx, m.urutan), 0) + 1;
  const meta = await stamp();
  const m: Mapel = { id: genId(), idKelas, nama, urutan, ...meta };
  await db.transaction('rw', db.mapel, db.oplog, async () => {
    await db.mapel.add(m);
    await catat('mapel', 'upsert', { rows: [m as unknown as Record<string, unknown>] });
  });
  return m;
}

export async function ubahMapel(id: string, nama: string) {
  const lama = await db.mapel.get(id);
  if (!lama) return;
  const ada = await db.mapel
    .filter((m) => m.idKelas === lama.idKelas && m.id !== id && m.nama.toLowerCase() === nama.toLowerCase())
    .count();
  if (ada) throw new NamaDuplikatError(`Mapel "${nama}" sudah ada di kelas ini.`);
  const meta = await stamp();
  const baru: Mapel = { ...lama, nama, ...meta };
  await db.transaction('rw', db.mapel, db.oplog, async () => {
    await db.mapel.put(baru);
    await catat('mapel', 'upsert', { rows: [baru as unknown as Record<string, unknown>] });
  });
}

/** Hapus mapel → nilainya ikut terhapus. */
export async function hapusMapelCascade(id: string) {
  const nilai = await db.nilai.where('idMapel').equals(id).toArray();
  await db.transaction('rw', db.mapel, db.nilai, db.oplog, async () => {
    await db.mapel.delete(id);
    await db.nilai.bulkDelete(nilai.map((x) => x.id));
    await catat('mapel', 'delete', { ids: [id] });
    if (nilai.length) await catat('nilai', 'delete', { ids: nilai.map((x) => x.id) });
  });
}

// ---------- UJIAN ----------

/** Nama otomatis "UH berikutnya", per kategori, hindari benturan (PRD 7.1). */
export async function saranNamaUjian(idKelas: string, idKategori: string): Promise<string> {
  const kategori = await db.kategori.get(idKategori);
  const ujianKategori = await db.ujian.where('idKategori').equals(idKategori).toArray();
  const prefix = kategori?.nama || 'Ujian';
  const prefixPendek =
    prefix === 'Ulangan Harian' ? 'UH' : prefix === 'UTS' || prefix === 'UAS' ? prefix : prefix.slice(0, 3).toUpperCase();
  const angka = ujianKategori
    .map((u) => u.nama.match(/(\d+)\s*$/)?.[1])
    .filter(Boolean)
    .map(Number);
  const berikut = (angka.length ? Math.max(...angka) : 0) + 1;
  return `${prefixPendek}${berikut}`;
}

export async function buatUjian(
  idKelas: string,
  idKategori: string,
  nama: string,
  tanggal: string | null
): Promise<Ujian> {
  const ada = await db.ujian.where('[idKelas+nama]').equals([idKelas, nama]).count();
  if (ada) throw new NamaDuplikatError(`Ujian "${nama}" sudah ada di kelas ini.`);
  const meta = await stamp();
  const u: Ujian = { id: genId(), idKelas, idKategori, nama, tanggal, ...meta };
  await db.transaction('rw', db.ujian, db.oplog, async () => {
    await db.ujian.add(u);
    await catat('ujian', 'upsert', { rows: [u as unknown as Record<string, unknown>] });
  });
  return u;
}

export async function ubahUjian(id: string, idKategori: string, nama: string, tanggal: string | null) {
  const lama = await db.ujian.get(id);
  if (!lama) return;
  const ada = await db.ujian
    .where('[idKelas+nama]')
    .equals([lama.idKelas, nama])
    .filter((x) => x.id !== id)
    .count();
  if (ada) throw new NamaDuplikatError(`Ujian "${nama}" sudah ada di kelas ini.`);
  const meta = await stamp();
  const baru: Ujian = { ...lama, idKategori, nama, tanggal, ...meta };
  await db.transaction('rw', db.ujian, db.oplog, async () => {
    await db.ujian.put(baru);
    await catat('ujian', 'upsert', { rows: [baru as unknown as Record<string, unknown>] });
  });
}

/** Hapus ujian → seluruh nilai pada ujian itu ikut terhapus (PRD 8.6). */
export async function hapusUjianCascade(id: string) {
  const nilai = await db.nilai.where('idUjian').equals(id).toArray();
  await db.transaction('rw', db.ujian, db.nilai, db.oplog, async () => {
    await db.ujian.delete(id);
    await db.nilai.bulkDelete(nilai.map((x) => x.id));
    await catat('ujian', 'delete', { ids: [id] });
    if (nilai.length) await catat('nilai', 'delete', { ids: nilai.map((x) => x.id) });
  });
}

// ---------- NILAI ----------

/** Set nilai sel (null = kosongkan → hapus). Validasi 0-100 di lapisan UI + di sini. */
export async function setNilai(
  idSiswa: string,
  idMapel: string,
  idUjian: string,
  nilai: number | null
) {
  const kunci = { idSiswa, idMapel, idUjian };
  const lama = await db.nilai.where('[idSiswa+idMapel+idUjian]').equals([idSiswa, idMapel, idUjian]).first();
  if (nilai == null) {
    if (!lama) return;
    await db.transaction('rw', db.nilai, db.oplog, async () => {
      await db.nilai.delete(lama.id);
      await catat('nilai', 'delete', { ids: [lama.id] });
    });
    return;
  }
  if (!Number.isFinite(nilai) || nilai < 0 || nilai > 100) {
    throw new RangeError('Nilai harus angka 0-100.');
  }
  const meta = await stamp();
  const row: Nilai = {
    id: lama?.id ?? genId(),
    ...kunci,
    nilai,
    ...meta,
  };
  await db.transaction('rw', db.nilai, db.oplog, async () => {
    await db.nilai.put(row);
    await catat('nilai', 'upsert', { rows: [row as unknown as Record<string, unknown>] });
  });
}
