import { databaseSIRS } from '../config/Database.js'
import { show, rlTigaTitikDuaHeader, rlTigaTitikDuaDetail, getRSBerdata, getDetailRS, getTotalRS } from '../models/RLTigaTitikDuaModel.js'
import ExcelJS from 'exceljs'
import { ambilInfoRS } from '../services/WilayahRSService.js'
import Joi from 'joi'
import joiDate from "@joi/date"
import { periodeAwalBulan } from '../services/Periode.js'

const MAKS_RS_PER_HALAMAN = 100

// Kode RS yang punya data, diurutkan menurut nama RS (lalu kode)
const urutkanMenurutNama = async (rsBerdata) => {
    const info = rsBerdata.length ? await ambilInfoRS(rsBerdata) : new Map()
    const namaRS = (kode) => (info.get(String(kode)) || {}).nama || null
    const urut = [...rsBerdata].sort((a, b) =>
        String(namaRS(a) || '').localeCompare(String(namaRS(b) || ''), 'id') ||
        String(a).localeCompare(String(b)))
    return { urut, namaRS }
}

// GET /apisirs6v2/rltigatitikdua?rsId=A;B;C&periode=2026-1&page=1&limit=10
// Daftar RS sudah divalidasi terhadap wilayah user oleh middleware
// cekWilayahRS (req.aksesRS.kode). Tabel berisi satu baris per RS per jenis
// pelayanan. Pagination dihitung per RS, bukan per baris, agar data satu RS
// tidak terpotong di dua halaman. Total dihitung di database untuk seluruh
// RS terpilih.
export const getRLTigaTitikDua = async (req, res) => {
    const joi = Joi.extend(joiDate)

    const schema = joi.object({
        rsId: joi.string(),
        semuaWilayah: joi.string().valid('0', '1'),
        provinsiId: joi.string(),
        kabKotaId: joi.string(),
        periode: joi.date().format("YYYY-M").required(),
        page: joi.number().integer().min(1),
        limit: joi.number().integer().min(1).max(MAKS_RS_PER_HALAMAN)
    })

    const { error, value } = schema.validate(req.query)

    if (error) {
        res.status(400).send({
            status: false,
            message: error.details[0].message
        })
        return
    }

    const page = value.page || 1
    const limit = value.limit || 10
    const periode = req.query.periode
    const kodeDipilih = req.aksesRS.kode

    try {
        const [rsBerdata, total] = await Promise.all([
            getRSBerdata(kodeDipilih, periode),
            getTotalRS(kodeDipilih, periode)
        ])

        const { urut, namaRS } = await urutkanMenurutNama(rsBerdata)
        const kodeHalaman = urut.slice((page - 1) * limit, page * limit)
        const rows = kodeHalaman.length ? await getDetailRS(kodeHalaman, periode) : []

        // urutkan baris mengikuti urutan RS di halaman ini
        const posisi = new Map(kodeHalaman.map((k, i) => [String(k), i]))
        const data = rows
            .map((row) => ({ ...row, nama_rs: namaRS(row.rs_id) }))
            .sort((a, b) => posisi.get(String(a.rs_id)) - posisi.get(String(b.rs_id)))

        res.status(200).send({
            status: true,
            message: data.length ? 'data found' : 'data not found',
            data: data,
            rumahSakit: kodeHalaman.map((kode) => ({ kode, nama: namaRS(kode) })),
            total: total,
            pagination: {
                page: page,
                limit: limit,
                totalRS: rsBerdata.length,
                totalHalaman: Math.ceil(rsBerdata.length / limit),
                rsDipilih: kodeDipilih.length,
                rsTanpaData: kodeDipilih.length - rsBerdata.length
            }
        })
    } catch (err) {
        console.error(err)
        res.status(500).send({
            status: false,
            message: 'Gagal mengambil data RL 3.2'
        })
    }
}

// Validasi parameter periode untuk excel
const validasiPeriode = (query) => {
    const joi = Joi.extend(joiDate)
    return joi.object({
        rsId: joi.string(),
        semuaWilayah: joi.string().valid('0', '1'),
        provinsiId: joi.string(),
        kabKotaId: joi.string(),
        periode: joi.date().format("YYYY-M").required()
    }).validate(query)
}

// Judul kolom Excel (urutan sama dengan tabel di frontend)
const KOLOM_EXCEL = [
    ['Pasien Awal Bulan', (r) => r.pasien_awal_bulan],
    ['Pasien Masuk', (r) => r.pasien_masuk],
    ['Pasien Pindahan', (r) => r.pasien_pindahan],
    ['Pasien Dipindahkan', (r) => r.pasien_dipindahkan],
    ['Pasien Keluar Hidup', (r) => r.pasien_keluar_hidup],
    ['Pasien Pria Keluar Mati <48 Jam', (r) => r.pasien_keluar_mati_kurang_dari_48_jam],
    ['Pasien Pria Keluar Mati >=48 Jam', (r) => r.pasien_keluar_mati_lebih_dari_atau_sama_dengan_48_jam],
    ['Pasien Wanita Keluar Mati <48 Jam', (r) => r.pasien_wanita_keluar_mati_kurang_dari_48_jam],
    ['Pasien Wanita Keluar Mati >=48 Jam', (r) => r.pasien_wanita_keluar_mati_lebih_dari_atau_sama_dengan_48_jam],
    ['Jumlah Lama Dirawat', (r) => r.jumlah_lama_dirawat],
    ['Pasien Akhir Bulan', (r) => angka(r.pasien_awal_bulan) + angka(r.pasien_masuk) + angka(r.pasien_pindahan) -
        (angka(r.pasien_dipindahkan) + angka(r.pasien_keluar_hidup) +
        angka(r.pasien_keluar_mati_kurang_dari_48_jam) + angka(r.pasien_keluar_mati_lebih_dari_atau_sama_dengan_48_jam) +
        angka(r.pasien_wanita_keluar_mati_kurang_dari_48_jam) + angka(r.pasien_wanita_keluar_mati_lebih_dari_atau_sama_dengan_48_jam))],
    ['Jumlah Hari Perawatan', (r) => angka(r.rincian_hari_perawatan_kelas_VVIP) + angka(r.rincian_hari_perawatan_kelas_VIP) +
        angka(r.rincian_hari_perawatan_kelas_1) + angka(r.rincian_hari_perawatan_kelas_2) +
        angka(r.rincian_hari_perawatan_kelas_3) + angka(r.rincian_hari_perawatan_kelas_khusus)],
    ['Hari Perawatan VVIP', (r) => r.rincian_hari_perawatan_kelas_VVIP],
    ['Hari Perawatan VIP', (r) => r.rincian_hari_perawatan_kelas_VIP],
    ['Hari Perawatan 1', (r) => r.rincian_hari_perawatan_kelas_1],
    ['Hari Perawatan 2', (r) => r.rincian_hari_perawatan_kelas_2],
    ['Hari Perawatan 3', (r) => r.rincian_hari_perawatan_kelas_3],
    ['Hari Perawatan Khusus', (r) => r.rincian_hari_perawatan_kelas_khusus],
    ['Jumlah Alokasi TT Awal Bulan', (r) => r.jumlah_alokasi_tempat_tidur_awal_bulan]
]

function angka(v) { return parseInt(v, 10) || 0 }

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
    'Agustus', 'September', 'Oktober', 'November', 'Desember']

const labelPeriode = (periode) => {
    const [t, b] = String(periode).split('-').map(Number)
    return `${NAMA_BULAN[b - 1] || b} ${t}`
}

// Tulis judul + header ke worksheet, kembalikan nomor baris berikutnya
const tulisJudul = (ws, judul, subjudul, headerKiri) => {
    ws.addRow([judul]).font = { bold: true, size: 14 }
    ws.addRow([subjudul]).font = { italic: true, color: { argb: 'FF4B5A6E' } }
    ws.addRow([])
    const header = ws.addRow([...headerKiri, ...KOLOM_EXCEL.map((k) => k[0])])
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    header.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5FA8' } }
    })
    header.height = 42
}

const BARIS_TOTAL = { font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE3D6' } } }

// GET /apisirs6v2/rltigatitikdua/excel?(rsId=..|semuaWilayah=1&..)&periode=2026-1
// File Excel dibuat di server secara streaming (baris ditulis bertahap),
// sehingga browser tidak perlu memuat seluruh data. Isi satu sheet:
// baris per RS per jenis pelayanan (diambil per 50 RS) + baris TOTAL.
export const downloadExcelRLTigaTitikDua = async (req, res) => {
    const { error } = validasiPeriode(req.query)
    if (error) {
        res.status(400).send({ status: false, message: error.details[0].message })
        return
    }

    const periode = req.query.periode
    const kodeDipilih = req.aksesRS.kode
    let mulaiStreaming = false

    try {
        // Query yang bisa gagal dijalankan dulu, sebelum header file dikirim
        const [total, rsBerdata] = await Promise.all([
            getTotalRS(kodeDipilih, periode),
            getRSBerdata(kodeDipilih, periode)
        ])
        const { urut, namaRS } = await urutkanMenurutNama(rsBerdata)

        const namaFile = `RL32_Rawat_Inap_${String(periode).replace(/[^0-9-]/g, '')}.xlsx`
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename="${namaFile}"`)
        mulaiStreaming = true

        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true })
        const subjudul = `Periode ${labelPeriode(periode)} · ${rsBerdata.length} dari ${kodeDipilih.length} RS mengisi data`

        const ws = workbook.addWorksheet('RL 3.2', { views: [{ state: 'frozen', ySplit: 4, xSplit: 4 }] })
        ws.columns = [{ width: 6 }, { width: 12 }, { width: 36 }, { width: 32 }, ...KOLOM_EXCEL.map(() => ({ width: 14 }))]
        tulisJudul(ws, 'RL 3.2 Rawat Inap', subjudul, ['No', 'Kode RS', 'Nama RS', 'Jenis Pelayanan'])
        let no = 0
        const UKURAN_BLOK = 50
        for (let i = 0; i < urut.length; i += UKURAN_BLOK) {
            const blok = urut.slice(i, i + UKURAN_BLOK)
            const posisi = new Map(blok.map((k, j) => [String(k), j]))
            const rows = (await getDetailRS(blok, periode))
                .sort((a, b) => posisi.get(String(a.rs_id)) - posisi.get(String(b.rs_id)))
            rows.forEach((r) => {
                no += 1
                ws.addRow([no, r.rs_id, namaRS(r.rs_id) || '', r.nama_jenis_pelayanan,
                    ...KOLOM_EXCEL.map((k) => k[1](r))]).commit()
            })
        }
        const barisTotal = ws.addRow(['', '', '', 'TOTAL', ...KOLOM_EXCEL.map((k) => k[1](total))])
        barisTotal.font = BARIS_TOTAL.font
        barisTotal.eachCell((c) => { c.fill = BARIS_TOTAL.fill })
        barisTotal.commit()
        ws.commit()

        await workbook.commit()
    } catch (err) {
        console.error(err)
        if (!mulaiStreaming) {
            res.status(500).send({ status: false, message: 'Gagal membuat file Excel RL 3.2' })
        } else {
            // header file sudah terkirim; putuskan koneksi agar unduhan gagal
            res.destroy(err)
        }
    }
}

export const showRLTigaTitikDua = (req, res) => {
    show(req.params.id, (err, results) => {
        if (err) {
            res.status(422).send({
                status: false,
                message: err
            })
            return
        }

        const message = results.length ? 'data found' : 'data not found'
        const data = results.length ? results[0] : null

        res.status(200).send({
            status: true,
            message: message,
            data: data
        })
    })
}

export const insertRLTigaTitikDua =  async (req, res) => {
    const schema = Joi.object({
        periodeBulan: Joi.number().greater(0).less(13).required(),
        periodeTahun: Joi.number().greater(2022).required(),
        data: Joi.array()
            .items(
                Joi.object().keys({
                    rlTigaTitikDuaJenisPelayananId: Joi.number().required(),
                    pasienAwalBulan: Joi.number().required(),
                    pasienMasuk: Joi.number().required(),
                    pasienPindahan: Joi.number().required(),
                    pasienDipindahkan: Joi.number().required(),
                    pasienKeluarHidup: Joi.number().required(),
                    pasienKeluarMatiKurangDari48Jam: Joi.number().required(),
                    pasienKeluarMatiLebihDariAtauSamaDengan48Jam: Joi.number().required(),
                    pasienWanitaKeluarMatiKurangDari48Jam: Joi.number().required(),
                    pasienWanitaKeluarMatiLebihDariAtauSamaDengan48Jam: Joi.number().required(),
                    jumlahLamaDirawat: Joi.number().required(),
                    rincianHariPerawatanKelasVVIP: Joi.number().required(),
                    rincianHariPerawatanKelasVIP: Joi.number().required(),
                    rincianHariPerawatanKelas1: Joi.number().required(),
                    rincianHariPerawatanKelas2: Joi.number().required(),
                    rincianHariPerawatanKelas3: Joi.number().required(),
                    rincianHariPerawatanKelasKhusus: Joi.number().required(),
                    jumlahAlokasiTempatTidurAwalBulan: Joi.number().required()
                }).required()
            ).required()
    })

    const { error, value } =  schema.validate(req.body)
    if (error) {
        res.status(400).send({
            status: false,
            message: error.details[0].message
        })
        return
    }

    let errorPasienAkhirBulan = false
    let errorJumlahHariPerawatan = false
    let errorJumlahAlokasiTempatTidurAwalBulan = false
    // let errorPerbandinganJumlahHariPerawatan = false
    // let errorJumlahLamaDirawat = false
    req.body.data.forEach(element => { 
        // hitung jumlah pasien akhir bulan
        const pasienAkhirBulan = (parseInt(element.pasienAwalBulan) + parseInt(element.pasienMasuk) + parseInt(element.pasienPindahan)) -
        (parseInt(element.pasienDipindahkan) + parseInt(element.pasienKeluarHidup) + parseInt(element.pasienKeluarMatiKurangDari48Jam) + 
        parseInt(element.pasienKeluarMatiLebihDariAtauSamaDengan48Jam))

        // hitung jumlah hari perawatan
        const jumlahHariPerawatan = parseInt(element.rincianHariPerawatanKelasVVIP) +
            parseInt(element.rincianHariPerawatanKelasVIP) + 
            parseInt(element.rincianHariPerawatanKelas1) + 
            parseInt(element.rincianHariPerawatanKelas2) + 
            parseInt(element.rincianHariPerawatanKelas3) + 
            parseInt(element.rincianHariPerawatanKelasKhusus)

        const jumlahAlokasiTempatTidurAwalBulan = parseInt(element.jumlahAlokasiTempatTidurAwalBulan)

        if (pasienAkhirBulan < 0) {
            errorPasienAkhirBulan = true
        }

        if (jumlahHariPerawatan <= 0) {
            errorJumlahHariPerawatan = true
        }

        if (jumlahAlokasiTempatTidurAwalBulan <= 0) {
            errorJumlahAlokasiTempatTidurAwalBulan = true
        }

        if (element.rlTigaTitikDuaJenisPelayananId == 100) {
            errorPasienAkhirBulan = false
            errorJumlahHariPerawatan = false
            errorJumlahAlokasiTempatTidurAwalBulan = false
        }

        // if (jumlahHariPerawatan < element.jumlahLamaDirawat) {
        //     errorPerbandinganJumlahHariPerawatan = true
        // }

        // if (element.jumlahLamaDirawat < (parseInt(element.pasienAwalBulan) + parseInt(element.pasienMasuk) + parseInt(element.pasienPindahan))) {
        //     errorJumlahLamaDirawat = true
        // }
    })

    if (errorPasienAkhirBulan) {
        res.status(400).send({
            status: false,
            message: 'pasien akhir bulan tidak boleh kurang dari nilai 0'
        })
        return
    }

    if (errorJumlahHariPerawatan) {
        res.status(400).send({
            status: false,
            message: 'jumlah hari perawatan tidak boleh kurang dari nilai 1'
        })
        return
    }

    if (errorJumlahAlokasiTempatTidurAwalBulan) {
        res.status(400).send({
            status: false,
            message: 'jumlah alokasi tempat tidur awal bulan tidak boleh kurang dari nilai 1'
        })
        return
    }

    // if (errorPerbandinganJumlahHariPerawatan) {
    //     res.status(400).send({
    //         status: false,
    //         message: 'jumlah hari perawatan tidak boleh lebih kecil dari jumlah lama dirawat'
    //     })
    //     return
    // }

    // if (errorJumlahLamaDirawat) {
    //     res.status(400).send({
    //         status: false,
    //         message: 'jumlah lama dirawat tidak boleh lebih kecil dari pasien awal bulan + pasien masuk + pasien pindahan'
    //     })
    //     return
    // }

    const periodeBulan = String(req.body.periodeBulan)
    const periodeTahun = String(req.body.periodeTahun)
    const periode = periodeAwalBulan(req.body.periodeTahun, req.body.periodeBulan)

    const transaction = await databaseSIRS.transaction()
    try {
        const resultInsertHeader = await rlTigaTitikDuaHeader.create({
            rs_id: req.user.satKerId,
            periode: periode,
            user_id: req.user.id
        }, { 
            transaction: transaction
        })

        const dataDetail = req.body.data.map((value, index) => {
            return {
                rs_id: req.user.satKerId,
                periode: periode,
                rl_tiga_titik_dua_id: resultInsertHeader.id,
                rl_tiga_titik_dua_jenis_pelayanan_id: value.rlTigaTitikDuaJenisPelayananId,
                pasien_awal_bulan: value.pasienAwalBulan,
                pasien_masuk: value.pasienMasuk,
                pasien_pindahan: value.pasienPindahan,
                pasien_dipindahkan: value.pasienDipindahkan,
                pasien_keluar_hidup: value.pasienKeluarHidup,
                pasien_keluar_mati_kurang_dari_48_jam: value.pasienKeluarMatiKurangDari48Jam,
                pasien_keluar_mati_lebih_dari_atau_sama_dengan_48_jam: value.pasienKeluarMatiLebihDariAtauSamaDengan48Jam,
                pasien_wanita_keluar_mati_kurang_dari_48_jam: value.pasienWanitaKeluarMatiKurangDari48Jam,
                pasien_wanita_keluar_mati_lebih_dari_atau_sama_dengan_48_jam: value.pasienWanitaKeluarMatiLebihDariAtauSamaDengan48Jam,
                jumlah_lama_dirawat: value.jumlahLamaDirawat,
                rincian_hari_perawatan_kelas_VVIP: value.rincianHariPerawatanKelasVVIP,
                rincian_hari_perawatan_kelas_VIP: value.rincianHariPerawatanKelasVIP,
                rincian_hari_perawatan_kelas_1: value.rincianHariPerawatanKelas1,
                rincian_hari_perawatan_kelas_2: value.rincianHariPerawatanKelas2,
                rincian_hari_perawatan_kelas_3: value.rincianHariPerawatanKelas3,
                rincian_hari_perawatan_kelas_khusus: value.rincianHariPerawatanKelasKhusus,
                jumlah_alokasi_tempat_tidur_awal_bulan: value.jumlahAlokasiTempatTidurAwalBulan,
                user_id: req.user.id
            }
        })

        await rlTigaTitikDuaDetail.bulkCreate(dataDetail, { 
            transaction: transaction
        })
        
        await transaction.commit()
        res.status(201).send({
            status: true,
            message: "data created",
            data: {
                id: resultInsertHeader.id
            }
        })
    } catch (error) {
        console.error(error)
        await transaction.rollback()
        if(error.name === 'SequelizeUniqueConstraintError'){
            res.status(400).send({
                status: false,
                message: "Duplicate Entry"
            })
        } else {
            res.status(400).send({
                status: false,
                message: error
            })
        }
    }
}

// Aturan validasi disamakan dengan insertRLTigaTitikDua: aturan
// "jumlah hari perawatan >= lama dirawat" dan "lama dirawat >= awal bulan +
// masuk + pindahan" tidak dipakai, dan jenis pelayanan 100 dikecualikan.
export const updateRLTigaTitikDua = async(req,res)=>{
    let errorPasienAkhirBulan = false
    let errorJumlahHariPerawatan = false
    let errorJumlahAlokasiTempatTidurAwalBulan = false

    // hitung jumlah pasien akhir bulan
    const pasienAkhirBulan = (parseInt(req.body.pasienAwalBulan) + parseInt(req.body.pasienMasuk) + parseInt(req.body.pasienPindahan)) -
    (parseInt(req.body.pasienDipindahkan) + parseInt(req.body.pasienKeluarHidup) + parseInt(req.body.pasienKeluarMatiKurangDari48Jam) + 
    parseInt(req.body.pasienKeluarMatiLebihDariAtauSamaDengan48Jam))

    // hitung jumlah hari perawatan
    const jumlahHariPerawatan = parseInt(req.body.rincianHariPerawatanKelasVVIP) +
        parseInt(req.body.rincianHariPerawatanKelasVIP) + 
        parseInt(req.body.rincianHariPerawatanKelas1) + 
        parseInt(req.body.rincianHariPerawatanKelas2) + 
        parseInt(req.body.rincianHariPerawatanKelas3) + 
        parseInt(req.body.rincianHariPerawatanKelasKhusus)

    const jumlahAlokasiTempatTidurAwalBulan = parseInt(req.body.jumlahAlokasiTempatTidurAwalBulan)

    if (pasienAkhirBulan < 0) {
        errorPasienAkhirBulan = true
    }

    if (jumlahHariPerawatan <= 0) {
        errorJumlahHariPerawatan = true
    }

    if (jumlahAlokasiTempatTidurAwalBulan <= 0) {
        errorJumlahAlokasiTempatTidurAwalBulan = true
    }

    // jenis pelayanan baris yang diubah (tidak dikirim di body)
    let barisLama
    try {
        barisLama = await rlTigaTitikDuaDetail.findOne({
            attributes: ['rl_tiga_titik_dua_jenis_pelayanan_id'],
            where: { id: req.params.id, rs_id: req.user.satKerId }
        })
    } catch (error) {
        console.error(error)
        res.status(500).send({ status: false, message: 'Gagal membaca data RL 3.2' })
        return
    }
    if (!barisLama) {
        res.status(404).send({ status: false, message: 'Data tidak ditemukan' })
        return
    }

    if (barisLama.rl_tiga_titik_dua_jenis_pelayanan_id == 100) {
        errorPasienAkhirBulan = false
        errorJumlahHariPerawatan = false
        errorJumlahAlokasiTempatTidurAwalBulan = false
    }

    if (errorPasienAkhirBulan) {
        res.status(400).send({
            status: false,
            message: 'pasien akhir bulan tidak boleh kurang dari nilai 0'
        })
        return
    }

    if (errorJumlahHariPerawatan) {
        res.status(400).send({
            status: false,
            message: 'jumlah hari perawatan tidak boleh kurang dari nilai 1'
        })
        return
    }

    if (errorJumlahAlokasiTempatTidurAwalBulan) {
        res.status(400).send({
            status: false,
            message: 'jumlah alokasi tempat tidur awal bulan tidak boleh kurang dari nilai 1'
        })
        return
    }

    try{
        const update = await rlTigaTitikDuaDetail.update(
            {
                pasien_awal_bulan: req.body.pasienAwalBulan,
                pasien_masuk: req.body.pasienMasuk,
                pasien_pindahan: req.body.pasienPindahan,
                pasien_dipindahkan: req.body.pasienDipindahkan,
                pasien_keluar_hidup: req.body.pasienKeluarHidup,
                pasien_keluar_mati_kurang_dari_48_jam: req.body.pasienKeluarMatiKurangDari48Jam,
                pasien_keluar_mati_lebih_dari_atau_sama_dengan_48_jam: req.body.pasienKeluarMatiLebihDariAtauSamaDengan48Jam,
                pasien_wanita_keluar_mati_kurang_dari_48_jam: req.body.pasienWanitaKeluarMatiKurangDari48Jam,
                pasien_wanita_keluar_mati_lebih_dari_atau_sama_dengan_48_jam: req.body.pasienWanitaKeluarMatiLebihDariAtauSamaDengan48Jam,
                jumlah_lama_dirawat: req.body.jumlahLamaDirawat,
                rincian_hari_perawatan_kelas_VVIP: req.body.rincianHariPerawatanKelasVVIP,
                rincian_hari_perawatan_kelas_VIP: req.body.rincianHariPerawatanKelasVIP,
                rincian_hari_perawatan_kelas_1: req.body.rincianHariPerawatanKelas1,
                rincian_hari_perawatan_kelas_2: req.body.rincianHariPerawatanKelas2,
                rincian_hari_perawatan_kelas_3: req.body.rincianHariPerawatanKelas3,
                rincian_hari_perawatan_kelas_khusus: req.body.rincianHariPerawatanKelasKhusus,
                jumlah_alokasi_tempat_tidur_awal_bulan: req.body.jumlahAlokasiTempatTidurAwalBulan,
                user_id: req.user.id
            },
            {
                where:{
                    id: req.params.id,
                    rs_id: req.user.satKerId
            }
        });
        
        res.status(200).json({
            status: true,
            message: update
        });
    }catch(error){
        console.error(error.message);
    }
}

export const deleteRLTigaTitikDua = async(req, res) => {
    try {
        const count = await rlTigaTitikDuaDetail.destroy({
            where: {
                id: req.params.id,
                rs_id: req.user.satKerId
            }
        })
        if (count == 0) {
            res.status(404).send({
                status: true,
                message: "Data Not Found",
                data: {
                    'deleted_rows': count
                }
            })
        } else {
            res.status(201).send({
                status: true,
                message: "data deleted successfully",
                data: {
                    'deleted_rows': count
                }
            })
        }
    } catch (error) {
        res.status(404).send({
            status: false,
            message: error
        })
    }
}
