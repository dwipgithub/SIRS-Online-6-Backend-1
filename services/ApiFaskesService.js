import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

// Klien API Faskes (API_FASKES di .env), dipakai bersama oleh daftar RS,
// pengecekan wilayah, dan profil RS.
//
// Hasil pengamatan endpoint (Nov 2026):
//   POST /faskes/login                 -> { access_token, expires_in, ... } (±15 menit)
//   GET  /faskes/rumahsakit            -> semua RS (±3.500), berhalaman
//        ?provinsiId=31 | ?kabKotaId=3174, &page=N&limit=M (limit maks. 1000)
//        respons: { status, message, pagination: { totalNumberOfPages, ... }, data: [...] }
//        item: kode, nama, alamat, provinsi_id, provinsiNama, kab_kota_id,
//              kabKotaNama, statusAktivasi, ... (juga berisi kontak PIC/direktur:
//              JANGAN diteruskan ke frontend apa adanya)
//   GET  /faskes/rumahsakit/{kode}     -> profil satu RS
// Tanpa parameter, satu halaman 1000 RS butuh ±9-10 detik, jadi hasil
// HARUS di-cache (lihat WilayahRSService.js).

const BASE_URL = process.env.API_FASKES;
const LIMIT_PER_HALAMAN = 1000;
const TIMEOUT_MS = 30000;

let token = null;
let tokenKedaluwarsa = 0;
let loginBerjalan = null;

// Token disimpan & dipakai ulang sampai 1 menit sebelum kedaluwarsa.
// Login yang bersamaan digabung menjadi satu permintaan.
const ambilToken = async () => {
  if (token && Date.now() < tokenKedaluwarsa) return token;
  if (!loginBerjalan) {
    loginBerjalan = axios
      .post(
        `${BASE_URL}/faskes/login`,
        {
          userName: process.env.username_API_FASKES,
          password: process.env.password_API_FASKES,
        },
        { headers: { "Content-Type": "application/json" }, timeout: TIMEOUT_MS }
      )
      .then((r) => {
        const d = r.data.access_token ? r.data : r.data.data || {};
        token = d.access_token;
        const detik = Number(d.expires_in) || 15 * 60;
        tokenKedaluwarsa = Date.now() + Math.max(60, detik - 60) * 1000;
        return token;
      })
      .finally(() => {
        loginBerjalan = null;
      });
  }
  return loginBerjalan;
};

// GET ke API Faskes; bila token ditolak (401), login ulang sekali lalu coba lagi
const get = async (path, params) => {
  const kirim = async () =>
    axios.get(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${await ambilToken()}` },
      params,
      timeout: TIMEOUT_MS,
    });
  try {
    return await kirim();
  } catch (error) {
    if (error.response && error.response.status === 401) {
      token = null;
      return kirim();
    }
    throw error;
  }
};

/**
 * Semua RS (semua status aktivasi) di sebuah wilayah, seluruh halaman.
 * Halaman ke-2 dst. diambil paralel.
 * @param {{provinsiId?: string, kabKotaId?: string}} wilayah  kosong = se-Indonesia
 */
export const ambilSemuaRS = async ({ provinsiId, kabKotaId } = {}) => {
  const params = { limit: LIMIT_PER_HALAMAN };
  if (provinsiId) params.provinsiId = provinsiId;
  if (kabKotaId) params.kabKotaId = kabKotaId;

  const pertama = await get("/faskes/rumahsakit", { ...params, page: 1 });
  const hasil = [...(pertama.data.data || [])];
  const jumlahHalaman = Number(
    (pertama.data.pagination || {}).totalNumberOfPages || 1
  );

  if (jumlahHalaman > 1) {
    const sisa = await Promise.all(
      Array.from({ length: jumlahHalaman - 1 }, (_, i) =>
        get("/faskes/rumahsakit", { ...params, page: i + 2 })
      )
    );
    sisa.forEach((r) => hasil.push(...(r.data.data || [])));
  }
  return hasil;
};

/** Profil satu RS (data mentah dari API) */
export const ambilProfilRS = async (kode) => {
  const r = await get(`/faskes/rumahsakit/${encodeURIComponent(kode)}`);
  return r.data.data;
};
