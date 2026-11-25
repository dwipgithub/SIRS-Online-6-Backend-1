import { QueryTypes } from "sequelize";
import { databaseRSOnline } from "../config/Database.js";
import { ambilSemuaRS } from "./ApiFaskesService.js";

// Daftar & info RS (nama, wilayah, status aktif) untuk filter dan
// pengecekan akses wilayah.
//
// Sumber utama : API Faskes (services/ApiFaskesService.js)
// Cadangan     : db_fasyankes.data, dipakai bila API Faskes gagal/lambat
//
// Semua hasil di-cache di memori, karena API Faskes lambat untuk wilayah
// besar (se-Indonesia ±40 detik bila berurutan, ±10 detik paralel).

const TTL_MS = 15 * 60 * 1000; // daftar RS jarang berubah
const TTL_CADANGAN_MS = 2 * 60 * 1000; // hasil cadangan DB: coba API lagi lebih cepat
const TTL_TIDAK_DITEMUKAN_MS = 60 * 1000;
const MAKS_ENTRI_CACHE = 20000;

// Bentuk RS yang dipakai di aplikasi (tanpa data kontak dari API)
const ringkasDariAPI = (r) => ({
  kode: String(r.kode),
  nama: r.nama,
  alamat: r.alamat,
  provinsi_id: r.provinsi_id == null ? null : String(r.provinsi_id),
  provinsi_nama: r.provinsiNama || null,
  kab_kota_id: r.kab_kota_id == null ? null : String(r.kab_kota_id),
  kab_kota_nama: r.kabKotaNama || null,
  aktif: Number(r.statusAktivasi) === 1,
});

// ------------------------------------------------------------------
// Cache info per kode RS: kode -> { data | null, kedaluwarsa }
// ------------------------------------------------------------------
const cacheInfo = new Map();

const simpanInfo = (kode, data, ttl) => {
  if (cacheInfo.size >= MAKS_ENTRI_CACHE) cacheInfo.clear();
  cacheInfo.set(kode, { data, kedaluwarsa: Date.now() + ttl });
};

// ------------------------------------------------------------------
// Cache daftar per wilayah: "prov|kab" -> { data, kedaluwarsa }
// ------------------------------------------------------------------
const cacheDaftar = new Map();
const permintaanBerjalan = new Map(); // gabungkan permintaan yang bersamaan

const kunciWilayah = ({ provinsiId, kabKotaId } = {}) =>
  `${provinsiId || ""}|${kabKotaId || ""}`;

// Cadangan: baca dari db_fasyankes
const daftarDariDB = async ({ provinsiId, kabKotaId } = {}) => {
  const filter = [];
  const nilai = [];
  if (provinsiId) {
    filter.push("d.provinsi_id = ?");
    nilai.push(provinsiId);
  }
  if (kabKotaId) {
    filter.push("d.kab_kota_id = ?");
    nilai.push(kabKotaId);
  }
  const rows = await databaseRSOnline.query(
    "SELECT d.Propinsi AS kode, d.RUMAH_SAKIT AS nama, d.ALAMAT AS alamat, " +
      "d.provinsi_id, p.nama AS provinsi_nama, d.kab_kota_id, k.nama AS kab_kota_nama, d.aktive " +
      "FROM db_fasyankes.`data` d " +
      "LEFT JOIN db_fasyankes.provinsi p ON p.id = d.provinsi_id " +
      "LEFT JOIN db_fasyankes.kab_kota k ON k.id = d.kab_kota_id " +
      (filter.length ? "WHERE " + filter.join(" AND ") : ""),
    { type: QueryTypes.SELECT, replacements: nilai }
  );
  return rows.map((r) => ({
    kode: String(r.kode),
    nama: r.nama,
    alamat: r.alamat,
    provinsi_id: r.provinsi_id == null ? null : String(r.provinsi_id),
    provinsi_nama: r.provinsi_nama,
    kab_kota_id: r.kab_kota_id == null ? null : String(r.kab_kota_id),
    kab_kota_nama: r.kab_kota_nama,
    aktif: Number(r.aktive) === 1,
  }));
};

const unikPerKode = (daftar) => {
  const lihat = new Set();
  return daftar.filter((rs) => (lihat.has(rs.kode) ? false : lihat.add(rs.kode)));
};

/**
 * Semua RS (aktif & tidak aktif) di sebuah wilayah.
 * @param {{provinsiId?: string, kabKotaId?: string}} wilayah  kosong = se-Indonesia
 * @returns {Promise<Array<{kode, nama, alamat, provinsi_id, provinsi_nama,
 *                          kab_kota_id, kab_kota_nama, aktif}>>}
 */
export const daftarRSWilayah = async (wilayah = {}) => {
  const kunci = kunciWilayah(wilayah);
  const c = cacheDaftar.get(kunci);
  if (c && c.kedaluwarsa > Date.now()) return c.data;
  if (permintaanBerjalan.has(kunci)) return permintaanBerjalan.get(kunci);

  const janji = (async () => {
    let data;
    let ttl = TTL_MS;
    try {
      data = unikPerKode((await ambilSemuaRS(wilayah)).map(ringkasDariAPI));
    } catch (error) {
      console.error(
        `[WilayahRS] API Faskes gagal (${kunci}): ${error.message}. Memakai cadangan.`
      );
      if (c) return c.data; // pakai cache lama yang sudah kedaluwarsa
      data = unikPerKode(await daftarDariDB(wilayah));
      ttl = TTL_CADANGAN_MS;
    }
    data.forEach((rs) => simpanInfo(rs.kode, rs, ttl));
    if (cacheDaftar.size >= 2000) cacheDaftar.clear();
    cacheDaftar.set(kunci, { data, kedaluwarsa: Date.now() + ttl });
    return data;
  })().finally(() => permintaanBerjalan.delete(kunci));

  permintaanBerjalan.set(kunci, janji);
  return janji;
};

/** RS aktif saja (untuk daftar pilihan di filter) */
export const daftarRSAktif = async (wilayah = {}) =>
  (await daftarRSWilayah(wilayah)).filter((rs) => rs.aktif);

/**
 * Semua kode RS aktif di wilayah ("pilih semua RS di wilayah").
 * @returns {Promise<string[]>}
 */
export const daftarKodeRSWilayah = async ({ provinsiId, kabKotaId }) => {
  if (!provinsiId && !kabKotaId) return [];
  return (await daftarRSAktif({ provinsiId, kabKotaId })).map((rs) => rs.kode);
};

/**
 * Info beberapa RS sekaligus (termasuk RS tidak aktif, agar data lama
 * tetap bisa dibuka).
 * Urutan pencarian: cache -> daftar provinsi dari API (2 digit pertama kode
 * RS = kode provinsi) -> db_fasyankes.
 * @param {string[]} daftarKode
 * @returns {Promise<Map<string, object>>} RS yang tidak ditemukan tidak ada di Map
 */
export const ambilInfoRS = async (daftarKode) => {
  const hasil = new Map();
  let belum = [];
  const sekarang = Date.now();

  for (const k of new Set(daftarKode.map(String))) {
    const c = cacheInfo.get(k);
    if (c && c.kedaluwarsa > sekarang) {
      if (c.data) hasil.set(k, c.data);
    } else {
      belum.push(k);
    }
  }
  if (belum.length === 0) return hasil;

  // 1) Ambil daftar provinsi terkait (sekalian mengisi cache)
  const prefiks = [...new Set(belum.map((k) => k.slice(0, 2)))].filter((p) => /^\d{2}$/.test(p));
  await Promise.all(
    prefiks.map((p) => daftarRSWilayah({ provinsiId: p }).catch(() => []))
  );
  belum = belum.filter((k) => {
    const c = cacheInfo.get(k);
    if (c && c.data) {
      hasil.set(k, c.data);
      return false;
    }
    return true;
  });
  if (belum.length === 0) return hasil;

  // 2) Cadangan: db_fasyankes untuk kode yang masih belum ditemukan
  try {
    const rows = await databaseRSOnline.query(
      "SELECT d.Propinsi AS kode, d.RUMAH_SAKIT AS nama, d.ALAMAT AS alamat, " +
        "d.provinsi_id, d.kab_kota_id, d.aktive " +
        "FROM db_fasyankes.`data` d WHERE d.Propinsi IN (?)",
      { type: QueryTypes.SELECT, replacements: [belum] }
    );
    rows.forEach((r) => {
      const kode = String(r.kode);
      if (hasil.has(kode)) return;
      const data = {
        kode,
        nama: r.nama,
        alamat: r.alamat,
        provinsi_id: r.provinsi_id == null ? null : String(r.provinsi_id),
        provinsi_nama: null,
        kab_kota_id: r.kab_kota_id == null ? null : String(r.kab_kota_id),
        kab_kota_nama: null,
        aktif: Number(r.aktive) === 1,
      };
      simpanInfo(kode, data, TTL_CADANGAN_MS);
      hasil.set(kode, data);
    });
  } catch (error) {
    console.error(`[WilayahRS] cadangan DB gagal: ${error.message}`);
  }

  belum
    .filter((k) => !hasil.has(k))
    .forEach((k) => simpanInfo(k, null, TTL_TIDAK_DITEMUKAN_MS));
  return hasil;
};
