# Scorify — Aplikasi Pencatat Nilai Siswa

Aplikasi web **offline-first** untuk guru: mencatat nilai siswa per ujian, rekap otomatis
berbobot kategori, ranking, dan sinkronisasi ke Google Sheets. Semua data tersimpan di
perangkat (IndexedDB) sehingga tetap bisa dipakai tanpa internet.

## Fitur

- Kelola kelas, siswa, mata pelajaran, kategori ujian (berbobot), dan ujian
- Input nilai per ujian + ekspor/impor Excel
- Rekap otomatis berbobot kategori, ranking, dan grafik
- Sinkronisasi opsional ke Google Sheets (backend Google Apps Script)
- Mode offline penuh; antrean perubahan tersinkron otomatis saat online

## Teknologi

Next.js 16 (static export) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui ·
Dexie (IndexedDB) · ExcelJS · Google Apps Script

## Menjalankan Lokal

```bash
bun install
bun run dev        # buka http://localhost:3000
```

Build produksi untuk GitHub Pages:

```bash
STATIC_EXPORT=true NEXT_PUBLIC_BASE_PATH=/<nama-repo> bun run build:pages
```

## Deploy ke GitHub Pages

Deploy otomatis via [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml):

1. Push repository ini ke GitHub (branch `main`).
2. Buka **Settings > Secrets and variables > Actions > New repository secret**:
   - Name: `GAS_WEB_APP_URL`
   - Value: URL Web App Apps Script Anda (berakhir `/exec`)
3. Buka **Settings > Pages > Build and deployment > Source**: pilih **GitHub Actions**.
4. Setiap push ke `main` akan build & publish otomatis ke
   `https://<username>.github.io/<nama-repo>/`.

Nama repo otomatis dipakai sebagai basePath (`NEXT_PUBLIC_BASE_PATH`). Untuk repo
`<username>.github.io`, hapus variabel `NEXT_PUBLIC_BASE_PATH` pada langkah build
di workflow.

Tanpa secret `GAS_WEB_APP_URL`, aplikasi tetap berjalan penuh dalam mode data lokal
(perangkat) — sinkronisasi ke Sheets saja yang tidak aktif.

## Struktur

```
src/app/            # Entry Next.js (SPA client-side di route /)
src/components/pn/  # UI aplikasi (dashboard, kelas, rekap, pengaturan)
src/lib/pn/         # Logika domain: IndexedDB, perhitungan rekap, Excel, sinkronisasi
public/             # Aset statis
```
