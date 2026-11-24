// Tanggal periode laporan dalam format ISO "YYYY-MM-01".
// Sebelumnya periode disusun sebagai `${tahun}-${bulan}-1` (mis. "2026-11-1"),
// yang bukan format ISO; Sequelize (lewat moment) lalu mencetak peringatan
// "Deprecation warning: value provided is not in a recognized RFC2822 or ISO
// format" karena terpaksa menebak tanggal dengan Date().
export const periodeAwalBulan = (tahun, bulan) =>
  `${String(tahun).trim()}-${String(bulan).trim().padStart(2, "0")}-01`;
