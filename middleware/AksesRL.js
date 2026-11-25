import { PERAN, peranDari, namaPeran } from "../config/peran.js";
import { ambilInfoRS, daftarKodeRSWilayah } from "../services/WilayahRSService.js";

// Batas jumlah RS per permintaan
// Tabel: diambil per halaman (10 RS) dan total dihitung di database,
// sehingga beban per permintaan tetap kecil berapa pun jumlah RS terpilih.
export const MAKS_RS_DETAIL = 5000;
export const MAKS_RS_EXCEL = 1000; // file Excel (baris per RS)

const tolak = (res, status, message) =>
  res.status(status).send({ status: false, message });

/**
 * Apakah user boleh mengakses data milik RS ini?
 * @param {object} user  req.user (payload JWT)
 * @param {object} info  hasil ambilInfoRS: {kode, provinsi_id, kab_kota_id}
 */
export const bolehAksesRS = (user, info) => {
  if (!info) return false;
  const satKer = String(user.satKerId);
  switch (peranDari(user)) {
    case PERAN.KEMENKES:
      return true;
    case PERAN.DINKES_PROVINSI:
      return info.provinsi_id === satKer;
    case PERAN.DINKES_KABKOTA:
      return info.kab_kota_id === satKer;
    case PERAN.RS:
      return info.kode === satKer;
    default:
      return false;
  }
};

/**
 * Hanya peran tertentu yang boleh lanjut.
 * Contoh: router.post(url, verifyToken, hanyaPeran(PERAN.RS), handler)
 */
export const hanyaPeran =
  (...daftarPeran) =>
  (req, res, next) => {
    if (!daftarPeran.includes(peranDari(req.user))) {
      return tolak(
        res,
        403,
        `Akses ditolak: ${namaPeran(peranDari(req.user))} tidak diizinkan melakukan tindakan ini`
      );
    }
    next();
  };

/**
 * Tentukan wilayah "semua RS" yang diminta, dibatasi oleh wilayah user.
 * Mengembalikan { provinsiId, kabKotaId } atau { error: [status, pesan] }.
 */
const wilayahDiminta = (user, query) => {
  const peran = peranDari(user);
  const satKer = String(user.satKerId);
  const prov = query.provinsiId ? String(query.provinsiId) : null;
  const kab = query.kabKotaId ? String(query.kabKotaId) : null;

  switch (peran) {
    case PERAN.DINKES_KABKOTA:
      if (kab && kab !== satKer) return { error: [403, "Kab/Kota di luar wilayah Anda"] };
      return { kabKotaId: satKer };
    case PERAN.DINKES_PROVINSI:
      if (prov && prov !== satKer) return { error: [403, "Provinsi di luar wilayah Anda"] };
      // kab/kota di provinsi lain otomatis menghasilkan daftar kosong
      return { provinsiId: satKer, kabKotaId: kab };
    case PERAN.KEMENKES:
      if (!prov && !kab) return { error: [400, "Pilih provinsi terlebih dahulu"] };
      return { provinsiId: prov, kabKotaId: kab };
    default:
      return { error: [403, "Akses ditolak"] };
  }
};

/**
 * Validasi daftar RS yang diminta terhadap wilayah user.
 * Dua cara meminta RS:
 *   1. rsId=A;B;C                     -> daftar kode RS tertentu
 *   2. semuaWilayah=1&provinsiId=..   -> semua RS aktif di wilayah
 *      (&kabKotaId=.. opsional)          (tidak perlu mengirim ratusan kode)
 * Aturan per peran:
 *   - RS              : hanya RS sendiri (rsId boleh kosong -> otomatis RS sendiri)
 *   - Dinkes Kab/Kota : hanya RS di kab/kota user
 *   - Dinkes Provinsi : hanya RS di provinsi user
 *   - Kemenkes        : bebas
 * Jika ada satu saja RS di luar wilayah, seluruh permintaan ditolak.
 * Hasil: req.aksesRS = { kode: string[], semuaWilayah: boolean }
 */
export const aksesWilayahRS =
  ({ maks = MAKS_RS_DETAIL } = {}) =>
  async (req, res, next) => {
    try {
      const user = req.user;
      const peran = peranDari(user);
      const satKer = String(user.satKerId);

      let kode = String(req.query.rsId || "")
        .split(";")
        .map((k) => k.trim())
        .filter(Boolean);
      kode = [...new Set(kode)];

      if (peran === PERAN.RS) {
        if (kode.length === 0) kode = [satKer];
        if (kode.length !== 1 || kode[0] !== satKer) {
          return tolak(res, 403, "Kode RS Tidak Sesuai");
        }
        req.aksesRS = { kode, semuaWilayah: false };
        return next();
      }

      if (!Object.values(PERAN).includes(peran)) {
        return tolak(res, 403, "Akses ditolak: peran pengguna tidak dikenal");
      }

      // Cara 2: semua RS di wilayah
      if (String(req.query.semuaWilayah) === "1") {
        const w = wilayahDiminta(user, req.query);
        if (w.error) return tolak(res, w.error[0], w.error[1]);
        kode = await daftarKodeRSWilayah(w);
        if (kode.length === 0) {
          return tolak(res, 404, "Tidak ada rumah sakit aktif di wilayah ini");
        }
        if (kode.length > maks) {
          return tolak(
            res,
            400,
            `Wilayah ini berisi ${kode.length} rumah sakit, melebihi batas ${maks} untuk tampilan ini`
          );
        }
        req.aksesRS = { kode, semuaWilayah: true };
        return next();
      }

      // Cara 1: daftar kode RS
      if (kode.length === 0) {
        return tolak(res, 400, "Pilih minimal satu rumah sakit");
      }
      if (kode.length > maks) {
        return tolak(
          res,
          400,
          `Maksimal ${maks} rumah sakit per permintaan (dipilih ${kode.length})`
        );
      }

      const info = await ambilInfoRS(kode);
      const tidakDikenal = kode.filter((k) => !info.has(k));
      if (tidakDikenal.length > 0) {
        return tolak(res, 400, `Kode RS tidak dikenal: ${tidakDikenal.slice(0, 10).join(", ")}`);
      }
      const diLuarWilayah = kode.filter((k) => !bolehAksesRS(user, info.get(k)));
      if (diLuarWilayah.length > 0) {
        return tolak(
          res,
          403,
          `Rumah sakit berikut di luar wilayah Anda: ${diLuarWilayah.slice(0, 10).join(", ")}`
        );
      }

      req.aksesRS = { kode, semuaWilayah: false };
      next();
    } catch (error) {
      console.error(error);
      tolak(res, 500, "Gagal memeriksa akses wilayah rumah sakit");
    }
  };

// Untuk tabel data per RS (maks. MAKS_RS_DETAIL RS)
export const cekWilayahRS = aksesWilayahRS({ maks: MAKS_RS_DETAIL });

/**
 * Cek akses untuk endpoint yang memakai :id baris data.
 * @param {(id) => Promise<string|null>} cariRsId  mengembalikan rs_id pemilik baris
 * Contoh: cekAksesData(async (id) => (await model.findByPk(id))?.rs_id)
 */
export const cekAksesData = (cariRsId) => async (req, res, next) => {
  try {
    const rsId = await cariRsId(req.params.id);
    if (rsId == null) return tolak(res, 404, "Data tidak ditemukan");

    const kode = String(rsId);
    if (peranDari(req.user) === PERAN.RS) {
      if (kode !== String(req.user.satKerId)) {
        return tolak(res, 403, "Kode RS Tidak Sesuai");
      }
      return next();
    }

    const info = await ambilInfoRS([kode]);
    if (!bolehAksesRS(req.user, info.get(kode))) {
      return tolak(res, 403, "Data rumah sakit ini di luar wilayah Anda");
    }
    next();
  } catch (error) {
    console.error(error);
    tolak(res, 500, "Gagal memeriksa akses data");
  }
};
