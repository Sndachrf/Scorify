import type { MetadataRoute } from "next";

/**
 * Manifest web Scorify (identitas PWA): dipakai Chrome/Android saat guru
 * menginstal aplikasi atau membuat pintasan, supaya nama, ikon, dan warna
 * tampil benar. Ikon memakai logo centang biru Scorify; purpose "maskable"
 * untuk ikon layar utama Android (zona aman), "any" untuk pemakaian umum.
 *
 * NEXT_PUBLIC_BASE_PATH diisi saat deploy ke GitHub Pages (project pages)
 * sehingga URL ikon & start_url ikut subpath /<nama-repo>/.
 */
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Wajib untuk static export (GitHub Pages): manifest dirender statis saat build.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scorify",
    short_name: "Scorify",
    description:
      "Aplikasi web offline-first untuk mencatat nilai siswa per ujian, dengan rekap otomatis berbobot kategori, ranking, dan sinkronisasi ke Google Sheets.",
    id: base ? `${base}/` : "/",
    start_url: base ? `${base}/` : "/",
    scope: base ? `${base}/` : "/",
    display: "standalone",
    orientation: "any",
    lang: "id",
    dir: "ltr",
    background_color: "#ffffff",
    theme_color: "#1d4ed8",
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: `${base}/icons/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
