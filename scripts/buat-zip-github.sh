#!/bin/bash
# Kemas file WAJIB proyek Pencatat Nilai Siswa menjadi ZIP siap upload ke GitHub.
# File privat (PRD, panduan deploy, Code.gs) dan artefak lokal sengaja TIDAK ikut.
set -euo pipefail

SRC=/home/z/my-project
STAGE=/tmp/zip-stage/pencatat-nilai-github
OUT=/home/z/my-project/download/Pencatat-Nilai-GitHub.zip

rm -rf /tmp/zip-stage "$OUT"
mkdir -p "$STAGE"

cd "$SRC"

# --- Daftar file/folder WAJIB (build + deploy GitHub Pages) ---
mkdir -p "$STAGE/.github"
cp -a .github/workflows "$STAGE/.github/"      # workflow deploy GitHub Actions
cp -a src public prisma "$STAGE/"              # kode sumber + aset + skema prisma
cp -a .gitignore "$STAGE/"
cp -a package.json bun.lock "$STAGE/"          # bun.lock wajib: workflow pakai --frozen-lockfile
cp -a next.config.ts tsconfig.json postcss.config.mjs tailwind.config.ts \
      eslint.config.mjs components.json "$STAGE/"

# --- Sanity check: rahasia & dokumen privat tidak boleh lolos ---
if find "$STAGE" \( -name ".env*" -o -name "*.log" -o -name "PANDUAN*" \
     -o -name "PRD-*" -o -name "Code.gs" \) -type f | grep -q .; then
  echo "GAGAL: ada file yang seharusnya tidak ikut:"
  find "$STAGE" \( -name ".env*" -o -name "*.log" -o -name "PANDUAN*" \
       -o -name "PRD-*" -o -name "Code.gs" \) -type f
  exit 1
fi

# URL Apps Script asli tidak boleh ada di kode sumber
if grep -rIn "AKfyc" "$STAGE" >/dev/null 2>&1; then
  echo "GAGAL: ada URL Apps Script asli di kode sumber:"; grep -rIn "AKfyc" "$STAGE"
  exit 1
fi

cd "$STAGE"
echo "Jumlah file  : $(find . -type f | wc -l)"
echo "Ukuran staging: $(du -sh . | cut -f1)"

zip -qr "$OUT" .
echo "ZIP dibuat   : $OUT ($(du -h "$OUT" | cut -f1))"
echo "--- isi folder teratas ---"
unzip -l "$OUT" | awk 'NR>3 {print $4}' | grep -v '^$' | cut -d/ -f1 | sort -u
