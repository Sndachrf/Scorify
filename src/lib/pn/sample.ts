// Muat contoh data (tombol eksplisit di dashboard kosong), untuk mencoba aplikasi.
import { db, genId } from './db';
import { buatKelas, buatKategori, buatSiswa, buatMapel, buatUjian, setNilai } from './ops';
import { KATEGORI_STANDAR } from './types';

const NAMA_SISWA = [
  'Ahmad Fauzi', 'Bunga Lestari', 'Citra Ayu', 'Dimas Prakoso', 'Eka Wulandari',
  'Fajar Nugroho', 'Gita Hapsari', 'Hendra Saputra', 'Indah Permatasari', 'Joko Susilo',
];

const NAMA_MAPEL = ['Matematika', 'Bahasa Indonesia', 'IPA', 'IPS'];

export async function muatContohData(): Promise<string> {
  const kelas = await buatKelas('7A', `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`);

  const kategoriIds: Record<string, string> = {};
  for (const k of KATEGORI_STANDAR) {
    const kat = await buatKategori(kelas.id, k.nama, k.bobot);
    kategoriIds[k.nama] = kat.id;
  }

  const ujianIds: Record<string, string> = {};
  ujianIds['UH1'] = (await buatUjian(kelas.id, kategoriIds['Ulangan Harian'], 'UH1', '2026-11-02')).id;
  ujianIds['UH2'] = (await buatUjian(kelas.id, kategoriIds['Ulangan Harian'], 'UH2', '2026-11-09')).id;
  ujianIds['UTS'] = (await buatUjian(kelas.id, kategoriIds['UTS'], 'UTS', '2026-11-16')).id;

  const mapelIds: Record<string, string> = {};
  for (const m of NAMA_MAPEL) {
    const mp = await buatMapel(kelas.id, m);
    mapelIds[m] = mp.id;
  }

  const siswaIds: string[] = [];
  for (let i = 0; i < NAMA_SISWA.length; i += 1) {
    const s = await buatSiswa(kelas.id, NAMA_SISWA[i], i + 1);
    siswaIds.push(s.id);
  }

  // Nilai deterministik (formula sederhana); beberapa sel dibiarkan kosong agar
  // perilaku "belum dinilai" terlihat.
  const ujianNama = ['UH1', 'UH2', 'UTS'];
  for (let i = 0; i < siswaIds.length; i += 1) {
    for (let j = 0; j < NAMA_MAPEL.length; j += 1) {
      ujianNama.forEach((un, kIdx) => {
        // UTS belum lengkap: 2 siswa terakhir belum dinilai.
        if (un === 'UTS' && i >= siswaIds.length - 2) return;
        if (un === 'UH2' && j === 3 && i % 4 === 0) return; // beberapa sel kosong
        const dasar = 70 + ((i * 7 + j * 13 + kIdx * 5) % 25);
        void setNilai(siswaIds[i], mapelIds[NAMA_MAPEL[j]], ujianIds[un], dasar);
      });
    }
  }
  void db; void genId;
  return kelas.id;
}
