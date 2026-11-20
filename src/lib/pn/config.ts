// Konfigurasi build (PRD v1.8): URL Web App Google Apps Script ditanam saat build.
// GitHub Actions mengisi NEXT_PUBLIC_GAS_URL dari secret GAS_WEB_APP_URL, sehingga
// aplikasi hasil deploy langsung terhubung ke Google Sheets tanpa setup di dalam aplikasi.
// Tanpa variabel ini, aplikasi tetap berfungsi penuh dalam mode data lokal (tanpa sinkron).
export const GAS_URL_BUILD: string = (process.env.NEXT_PUBLIC_GAS_URL || '').trim();

export const ADA_URL_BUILD: boolean = GAS_URL_BUILD.length > 0;
