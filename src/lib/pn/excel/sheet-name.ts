/** Karakter ilegal nama sheet Excel (\\ / ? * [ ] :), dipakai ekspor & impor. */
export function bersihkanNamaSheet(nama: string): string {
  return nama.replace(/[\\/?*[\]:]/g, '-').slice(0, 31).trim() || 'Sheet';
}
