// Peran pengguna berdasarkan kolom users_sso.jenis_user_id
// (masuk ke JWT sebagai req.user.jenisUserId).
//
// Arti satKerId (users_sso.rs_id) berbeda per peran:
//   KEMENKES         -> tidak dipakai untuk pembatasan wilayah
//   DINKES_PROVINSI  -> kode provinsi  (= db_fasyankes.data.provinsi_id)
//   DINKES_KABKOTA   -> kode kab/kota  (= db_fasyankes.data.kab_kota_id)
//   RS               -> kode RS / kode faskes (= db_fasyankes.data.Propinsi)
export const PERAN = Object.freeze({
  KEMENKES: 1,
  DINKES_PROVINSI: 2,
  DINKES_KABKOTA: 3,
  RS: 4,
});

const NAMA_PERAN = {
  [PERAN.KEMENKES]: "Kemenkes",
  [PERAN.DINKES_PROVINSI]: "Dinkes Provinsi",
  [PERAN.DINKES_KABKOTA]: "Dinkes Kab/Kota",
  [PERAN.RS]: "Rumah Sakit",
};

export const namaPeran = (id) => NAMA_PERAN[Number(id)] || "Tidak dikenal";

// Peran user dari payload JWT (req.user)
export const peranDari = (user) => Number(user && user.jenisUserId);
