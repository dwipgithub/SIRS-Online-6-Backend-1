import { DataTypes, QueryTypes } from "sequelize"
import { databaseSIRS } from "../config/Database.js"

export const rlTigaTitikDuaHeader = databaseSIRS.define('rl_tiga_titik_dua', 
    {
        rs_id: {
            type: DataTypes.STRING
        },
        periode: {
            type: DataTypes.DATE
        },
        user_id: {
            type: DataTypes.INTEGER
        },
    }
)

export const rlTigaTitikDuaDetail = databaseSIRS.define('rl_tiga_titik_dua_detail',{
    rl_tiga_titik_dua_id: {
        type: DataTypes.INTEGER
    },
    rs_id: {
        type: DataTypes.STRING
    },
    periode: {
        type: DataTypes.DATE
    },
    rl_tiga_titik_dua_jenis_pelayanan_id: {
        type: DataTypes.INTEGER
    },
    pasien_awal_bulan: {
        type: DataTypes.INTEGER
    },
    pasien_masuk: {
        type: DataTypes.INTEGER
    },
    pasien_pindahan: {
        type: DataTypes.INTEGER
    },
    pasien_dipindahkan: {
        type: DataTypes.INTEGER
    },
    pasien_keluar_hidup: {
        type: DataTypes.INTEGER
    },
    pasien_keluar_mati_kurang_dari_48_jam: {
        type: DataTypes.INTEGER
    },
    pasien_keluar_mati_lebih_dari_atau_sama_dengan_48_jam: {
        type: DataTypes.INTEGER
    },
    pasien_wanita_keluar_mati_kurang_dari_48_jam: {
        type: DataTypes.INTEGER
    },
    pasien_wanita_keluar_mati_lebih_dari_atau_sama_dengan_48_jam: {
        type: DataTypes.INTEGER
    },
    jumlah_lama_dirawat: {
        type: DataTypes.INTEGER
    },
    rincian_hari_perawatan_kelas_VVIP: {
        type: DataTypes.INTEGER
    },
    rincian_hari_perawatan_kelas_VIP: {
        type: DataTypes.INTEGER
    },
    rincian_hari_perawatan_kelas_1: {
        type: DataTypes.INTEGER
    },
    rincian_hari_perawatan_kelas_2: {
        type: DataTypes.INTEGER
    },
    rincian_hari_perawatan_kelas_3: {
        type: DataTypes.INTEGER
    },
    rincian_hari_perawatan_kelas_khusus: {
        type: DataTypes.INTEGER
    },
    jumlah_alokasi_tempat_tidur_awal_bulan: {
        type: DataTypes.INTEGER
    },
    user_id: {
        type: DataTypes.INTEGER
    }
})

export const get = (req, callback) => { 
    const sqlSelect = 'SELECT ' +
        'rl_tiga_titik_dua_detail.id, ' +
        'rl_tiga_titik_dua_detail.rs_id, ' +
        'rl_tiga_titik_dua_jenis_pelayanan.nama as nama_jenis_pelayanan, ' +
        'rl_tiga_titik_dua_detail.pasien_awal_bulan, ' +
        'rl_tiga_titik_dua_detail.pasien_masuk, ' +
        'rl_tiga_titik_dua_detail.pasien_pindahan, ' +
        'rl_tiga_titik_dua_detail.pasien_dipindahkan, ' +
        'rl_tiga_titik_dua_detail.pasien_keluar_hidup, ' +
        'rl_tiga_titik_dua_detail.pasien_keluar_mati_kurang_dari_48_jam, ' +
        'rl_tiga_titik_dua_detail.pasien_keluar_mati_lebih_dari_atau_sama_dengan_48_jam, ' +
        'rl_tiga_titik_dua_detail.pasien_wanita_keluar_mati_kurang_dari_48_jam, ' +
        'rl_tiga_titik_dua_detail.pasien_wanita_keluar_mati_lebih_dari_atau_sama_dengan_48_jam, ' +
        'rl_tiga_titik_dua_detail.jumlah_lama_dirawat, ' +
        'rl_tiga_titik_dua_detail.rincian_hari_perawatan_kelas_VVIP, ' +
        'rl_tiga_titik_dua_detail.rincian_hari_perawatan_kelas_VIP, ' +
        'rl_tiga_titik_dua_detail.rincian_hari_perawatan_kelas_1, ' +
        'rl_tiga_titik_dua_detail.rincian_hari_perawatan_kelas_2, ' +
        'rl_tiga_titik_dua_detail.rincian_hari_perawatan_kelas_3, ' +
        'rl_tiga_titik_dua_detail.rincian_hari_perawatan_kelas_khusus, ' +
        'rl_tiga_titik_dua_detail.jumlah_alokasi_tempat_tidur_awal_bulan, ' +
        'rl_tiga_titik_dua_kelompok_jenis_pelayanan.nama as nama_kelompok_jenis_pelayanan '
    
    const sqlFrom = 'FROM ' +
        'rl_tiga_titik_dua_detail ' +
        'INNER JOIN rl_tiga_titik_dua_jenis_pelayanan ' +
        'ON rl_tiga_titik_dua_jenis_pelayanan.id = rl_tiga_titik_dua_detail.rl_tiga_titik_dua_jenis_pelayanan_id ' +
        'LEFT OUTER JOIN rl_tiga_titik_dua_kelompok_jenis_pelayanan ' +
        'ON rl_tiga_titik_dua_kelompok_jenis_pelayanan.id = rl_tiga_titik_dua_jenis_pelayanan.rl_tiga_titik_dua_kelompok_jenis_pelayanan_id '

    const sqlWhere = 'WHERE '

    const sqlOrder = 'ORDER BY rl_tiga_titik_dua_detail.rs_id'

    const filter = []
    const sqlFilterValue = []

    const rsId = req.query.rsId || null
    const periode = req.query.periode || null

    if (rsId != null) {
        filter.push("rl_tiga_titik_dua_detail.rs_id IN ( ? ) ")
        sqlFilterValue.push(req.query.rsId.split(';'))
    }

    if (periode != null) {
        const customDate = new Date(periode)
        filter.push("YEAR(rl_tiga_titik_dua_detail.periode) = ? AND MONTH(rl_tiga_titik_dua_detail.periode) = ? ")
        sqlFilterValue.push(customDate.getFullYear())
        sqlFilterValue.push(customDate.getMonth() + 1)
    }

    let sqlFilter = ''
    filter.forEach((value, index) => {
        if (index == 0) {
            sqlFilter = sqlWhere.concat(value)
        } else if (index > 0) {
            sqlFilter = sqlFilter.concat(' AND ').concat(value)
        }
    })

    const sql = sqlSelect.concat(sqlFrom).concat(sqlFilter).concat(sqlOrder)
    databaseSIRS.query(sql, {
        type: QueryTypes.SELECT,
        replacements: sqlFilterValue
    })
    .then((res) => {
        callback(null, res)
    })
    .catch((error) => {
        callback(error, null)
    })
}

export const show = (id, callback) => {
    const sql = 'SELECT ' +
        'rl_tiga_titik_dua_detail.id, ' +
        'rl_tiga_titik_dua_detail.rs_id, ' +
        'rl_tiga_titik_dua_jenis_pelayanan.nama as nama_jenis_pelayanan, ' +
        'rl_tiga_titik_dua_detail.pasien_awal_bulan, ' +
        'rl_tiga_titik_dua_detail.pasien_masuk, ' +
        'rl_tiga_titik_dua_detail.pasien_pindahan, ' +
        'rl_tiga_titik_dua_detail.pasien_dipindahkan, ' +
        'rl_tiga_titik_dua_detail.pasien_keluar_hidup, ' +
        'rl_tiga_titik_dua_detail.pasien_keluar_mati_kurang_dari_48_jam, ' +
        'rl_tiga_titik_dua_detail.pasien_keluar_mati_lebih_dari_atau_sama_dengan_48_jam, ' +
        'rl_tiga_titik_dua_detail.pasien_wanita_keluar_mati_kurang_dari_48_jam, ' +
        'rl_tiga_titik_dua_detail.pasien_wanita_keluar_mati_lebih_dari_atau_sama_dengan_48_jam, ' +
        'rl_tiga_titik_dua_detail.jumlah_lama_dirawat, ' +
        'rl_tiga_titik_dua_detail.rincian_hari_perawatan_kelas_VVIP, ' +
        'rl_tiga_titik_dua_detail.rincian_hari_perawatan_kelas_VIP, ' +
        'rl_tiga_titik_dua_detail.rincian_hari_perawatan_kelas_1, ' +
        'rl_tiga_titik_dua_detail.rincian_hari_perawatan_kelas_2, ' +
        'rl_tiga_titik_dua_detail.rincian_hari_perawatan_kelas_3, ' +
        'rl_tiga_titik_dua_detail.rincian_hari_perawatan_kelas_khusus, ' +
        'rl_tiga_titik_dua_detail.jumlah_alokasi_tempat_tidur_awal_bulan, ' +
        'rl_tiga_titik_dua_kelompok_jenis_pelayanan.nama as kelompok_jenis_pelayanan_nama ' +
    'FROM ' +
        'rl_tiga_titik_dua_detail ' +
        'INNER JOIN rl_tiga_titik_dua_jenis_pelayanan ' +
        'ON rl_tiga_titik_dua_jenis_pelayanan.id = rl_tiga_titik_dua_detail.rl_tiga_titik_dua_jenis_pelayanan_id ' +
        'LEFT OUTER JOIN rl_tiga_titik_dua_kelompok_jenis_pelayanan ' +
        'ON rl_tiga_titik_dua_kelompok_jenis_pelayanan.id = rl_tiga_titik_dua_jenis_pelayanan.rl_tiga_titik_dua_kelompok_jenis_pelayanan_id ' +
    'WHERE ' +
        'rl_tiga_titik_dua_detail.id = ? '

    const sqlFilterValue = [id]
    databaseSIRS.query(sql, {
        type: QueryTypes.SELECT,
        replacements: sqlFilterValue
    })
    .then(
        (res) => {
            callback(null, res)
        },(error) => {
            throw error
        }
    )
    .catch((error) => {
            console.error(error)
        }
    )
}
// ===================================================================
// Query untuk tampilan multi-RS dengan pagination per RS
// (dipakai getRLTigaTitikDua; akses wilayah sudah dicek middleware)
// ===================================================================

// Kolom angka yang dijumlahkan untuk total
export const KOLOM_ANGKA_RL32 = [
    'pasien_awal_bulan',
    'pasien_masuk',
    'pasien_pindahan',
    'pasien_dipindahkan',
    'pasien_keluar_hidup',
    'pasien_keluar_mati_kurang_dari_48_jam',
    'pasien_keluar_mati_lebih_dari_atau_sama_dengan_48_jam',
    'pasien_wanita_keluar_mati_kurang_dari_48_jam',
    'pasien_wanita_keluar_mati_lebih_dari_atau_sama_dengan_48_jam',
    'jumlah_lama_dirawat',
    'rincian_hari_perawatan_kelas_VVIP',
    'rincian_hari_perawatan_kelas_VIP',
    'rincian_hari_perawatan_kelas_1',
    'rincian_hari_perawatan_kelas_2',
    'rincian_hari_perawatan_kelas_3',
    'rincian_hari_perawatan_kelas_khusus',
    'jumlah_alokasi_tempat_tidur_awal_bulan'
]

// "2026-1" -> ['2026-01-01', '2026-02-01'] (rentang [awal, akhir) agar index
// pada kolom periode bisa dipakai, berbeda dengan YEAR()/MONTH())
const rentangPeriode = (periode) => {
    const [tahun, bulan] = String(periode).split('-').map(Number)
    const pad = (n) => String(n).padStart(2, '0')
    const awal = `${tahun}-${pad(bulan)}-01`
    const akhir = bulan === 12 ? `${tahun + 1}-01-01` : `${tahun}-${pad(bulan + 1)}-01`
    return [awal, akhir]
}

const WHERE_RS_PERIODE =
    'WHERE rl_tiga_titik_dua_detail.rs_id IN ( ? ) ' +
    'AND rl_tiga_titik_dua_detail.periode >= ? AND rl_tiga_titik_dua_detail.periode < ? '

// Daftar kode RS (dari daftarKode) yang punya data pada periode tsb, terurut
export const getRSBerdata = async (daftarKode, periode) => {
    const [awal, akhir] = rentangPeriode(periode)
    const rows = await databaseSIRS.query(
        'SELECT DISTINCT rl_tiga_titik_dua_detail.rs_id FROM rl_tiga_titik_dua_detail ' +
        WHERE_RS_PERIODE +
        'ORDER BY rl_tiga_titik_dua_detail.rs_id',
        { type: QueryTypes.SELECT, replacements: [daftarKode, awal, akhir] }
    )
    return rows.map((r) => String(r.rs_id))
}

// Baris detail untuk beberapa RS (satu halaman)
export const getDetailRS = async (daftarKode, periode) => {
    const [awal, akhir] = rentangPeriode(periode)
    const sql = 'SELECT ' +
        'rl_tiga_titik_dua_detail.id, ' +
        'rl_tiga_titik_dua_detail.rs_id, ' +
        'rl_tiga_titik_dua_jenis_pelayanan.nama as nama_jenis_pelayanan, ' +
        KOLOM_ANGKA_RL32.map((k) => `rl_tiga_titik_dua_detail.${k}`).join(', ') + ', ' +
        'rl_tiga_titik_dua_kelompok_jenis_pelayanan.nama as nama_kelompok_jenis_pelayanan ' +
        'FROM rl_tiga_titik_dua_detail ' +
        'INNER JOIN rl_tiga_titik_dua_jenis_pelayanan ' +
        'ON rl_tiga_titik_dua_jenis_pelayanan.id = rl_tiga_titik_dua_detail.rl_tiga_titik_dua_jenis_pelayanan_id ' +
        'LEFT OUTER JOIN rl_tiga_titik_dua_kelompok_jenis_pelayanan ' +
        'ON rl_tiga_titik_dua_kelompok_jenis_pelayanan.id = rl_tiga_titik_dua_jenis_pelayanan.rl_tiga_titik_dua_kelompok_jenis_pelayanan_id ' +
        WHERE_RS_PERIODE +
        'ORDER BY rl_tiga_titik_dua_detail.rs_id, rl_tiga_titik_dua_detail.rl_tiga_titik_dua_jenis_pelayanan_id'
    return databaseSIRS.query(sql, {
        type: QueryTypes.SELECT,
        replacements: [daftarKode, awal, akhir]
    })
}

// Total seluruh RS terpilih (tidak terpengaruh pagination)
export const getTotalRS = async (daftarKode, periode) => {
    const [awal, akhir] = rentangPeriode(periode)
    const sql = 'SELECT ' +
        KOLOM_ANGKA_RL32.map((k) => `COALESCE(SUM(rl_tiga_titik_dua_detail.${k}), 0) AS ${k}`).join(', ') + ' ' +
        'FROM rl_tiga_titik_dua_detail ' +
        WHERE_RS_PERIODE
    const rows = await databaseSIRS.query(sql, {
        type: QueryTypes.SELECT,
        replacements: [daftarKode, awal, akhir]
    })
    const total = {}
    KOLOM_ANGKA_RL32.forEach((k) => { total[k] = Number(rows[0] ? rows[0][k] : 0) })
    return total
}
