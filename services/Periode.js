// Tanggal periode laporan dalam format ISO "YYYY-MM-01".
// Sebelumnya periode disusun sebagai `${tahun}-${bulan}-1` (mis. "2026-11-1"),
// yang bukan format ISO; Sequelize (lewat moment) lalu mencetak peringatan
// "Deprecation warning: value provided is not in a recognized RFC2822 or ISO
// format" karena terpaksa menebak tanggal dengan Date().
export const periodeAwalBulan = (tahun, bulan) =>
  `${String(tahun).trim()}-${String(bulan).trim().padStart(2, "0")}-01`;

// Periode dari query string ("2026-5", "2026-05", "2026-5-1") → "2026-05-01".
// Dipakai untuk where-clause Sequelize pada kolom DATE/DATEONLY. Frontend
// mengirim bulan tanpa nol di depan ("2026-5") yang memicu peringatan moment
// yang sama. Nilai yang tidak dikenali dikembalikan apa adanya.
export const periodeDariQuery = (teks) => {
  const m = String(teks ?? "").trim().match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (!m) return teks;
  return `${m[1]}-${m[2].padStart(2, "0")}-${(m[3] || "1").padStart(2, "0")}`;
};
