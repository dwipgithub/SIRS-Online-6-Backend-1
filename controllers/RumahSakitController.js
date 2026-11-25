import { ambilProfilRS } from "../services/ApiFaskesService.js";
import { daftarRSAktif } from "../services/WilayahRSService.js";

// export const getRumahSakit = (req, res) => {
//     get(req, (err, results) => {
//         const message = results.length ? 'data found' : 'data not found'
//         res.status(200).send({
//             status: true,
//             message: message,
//             data: results
//         })
//     })
// }

// export const showRumahSakit = (req, res) => {
//     show(req.params.id, (err, results) => {
//         if (err) {
//             res.status(422).send({
//                 status: false,
//                 message: err
//             })
//             return
//         }

//         const message = results.length ? 'data found' : 'data not found'
//         const data = results.length ? results[0] : null

//         res.status(200).send({
//             status: true,
//             message: message,
//             data: data
//         })
//     })
// }


// GET /apisirs6v2/rumahsakit?provinsiId=..|kabKotaId=..
// Sumber: API Faskes (di-cache, cadangan db_fasyankes) lewat WilayahRSService.
// Bentuk respons sama dengan versi lama (dipakai banyak halaman RL):
//   { id (= kode RS), nama, alamat, kab_kota_nama, provinsi_nama }
export const getRumahSakit = async (req, res) => {
  try {
    const wilayah = {};
    if (req.query.provinsiId) wilayah.provinsiId = String(req.query.provinsiId);
    if (req.query.kabKotaId) wilayah.kabKotaId = String(req.query.kabKotaId);

    const daftar = (await daftarRSAktif(wilayah))
      .map((rs) => ({
        id: rs.kode,
        nama: rs.nama,
        alamat: rs.alamat,
        kab_kota_nama: rs.kab_kota_nama,
        provinsi_nama: rs.provinsi_nama,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    res.status(200).send({
      status: true,
      message: daftar.length ? "data found" : "data not found",
      data: daftar,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ status: false, message: "Gagal mengambil daftar rumah sakit" });
  }
};
export const showRumahSakit = async (req, res) => {
  try {
    // Token API Faskes disimpan & dipakai ulang (ApiFaskesService)
    const apiData = await ambilProfilRS(req.params.id);
    const data = {
      // Field lama (dipakai form-form RL) — jangan diubah
      id: apiData.kode,
      nama: apiData.nama,
      alamat: apiData.alamat,
      provinsi_nama: apiData.provinsiNama,
      kab_kota_nama: apiData.kabKotaNama,
      // Field tambahan untuk Beranda
      kecamatan_nama: apiData.kecamatanNama,
      kelurahan_nama: apiData.kelurahanNama,
      jenis: apiData.jenis,
      kelas: apiData.kelas,
      telepon: apiData.telepon,
      email: apiData.email,
      website: apiData.website,
      status_blu: apiData.statusBLU,
      no_surat_ijin_operasional: apiData.noSuratIjinOperasional,
      tanggal_surat_ijin_operasional: apiData.tanggalSuratIjinOperasional,
      direktur: apiData.direktur,
      ketersediaan_simrs: apiData.ketersediaanSIMRS,
      luas_tanah: apiData.luasTanah,
      luas_bangunan: apiData.luasBangunan,
      kepemilikan: apiData.kepemilikan,
    };

    res.status(200).send({
      status: true,
      message: "data found",
      data: data,
    });
  } catch (error) {
    res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};
