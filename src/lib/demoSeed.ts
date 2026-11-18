import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { gradeExamAttempt } from './grading';
import { saveExamPackageWithItems } from './firestoreService';
import type {
  ExamAttempt,
  ExamPackage,
  ExamSession,
  ExamToken,
  Question,
  School,
  SchoolClass,
  Stimulus,
  Student,
  StudentDirectoryEntry,
  Subject,
} from '../types/tka';

export const DEMO_SCHOOLS: School[] = [
  {
    id: 'sekolah_a',
    name: 'SDN Nusantara 01',
    npsn: '20104511',
    address: 'Jl. Merdeka Pendidikan No. 14, Jakarta Pusat',
    logoUrl: '/src/assets/images/logo_sdn_nusantara_1794999853387.jpg',
    isActive: true,
  },
  {
    id: 'sekolah_b',
    name: 'SD Harapan Bangsa',
    npsn: '20108922',
    address: 'Jl. Cendekia Raya No. 88, Bandung',
    logoUrl: '/src/assets/images/logo_sd_harapan_1794999854156.jpg',
    isActive: true,
  },
];

export const DEMO_SUBJECTS: Subject[] = [
  {
    id: 'bahasa_indonesia',
    name: 'Bahasa Indonesia',
    code: 'BIND',
    topics: [
      'Memahami Teks Informasi',
      'Menyimpulkan Ide Pokok & Makna Tersirat',
      'Menafsirkan Data Tabel & Infografik',
      'Kosakata Baku & Struktur Kalimat',
    ],
  },
  {
    id: 'matematika',
    name: 'Matematika',
    code: 'MTK',
    topics: [
      'Operasi Bilangan & Pecahan',
      'Bangun Datar & Pengukuran',
      'Debit, Kecepatan & Perbandingan',
      'Pengolahan Data & Diagram',
    ],
  },
];

export function buildDemoStimuli(createdBy: string): Stimulus[] {
  return [
    {
      id: 'stim_bindo_kebun',
      subjectId: 'bahasa_indonesia',
      title: 'Kebun Edukasi dan Panen Air Hujan di Sekolah',
      stimulusType: 'mixed',
      imageUrl: '/src/assets/images/stimulus_taman_sekolah_1794999855787.jpg',
      readingText:
        'Sejak awal semester genap, siswa kelas 6 SD mengelola Kebun Edukasi di halaman belakang sekolah. Air hujan dari talang atap ditampung ke dalam gentong penampungan berkapasitas 300 liter. Setiap pagi, regu piket menyiram bedengan sawi, tomat, dan terong menggunakan air hujan tersebut sehingga sekolah mampu menghemat pemakaian air PDAM hingga 40 persen.\n\nSelain menghemat air, siswa juga mengolah sisa daun kering dan sampah organik kantin di kotak kompos kayu. Setelah 21 hari, kompos matang dicampurkan ke tanah bedengan untuk menyuburkan tanaman tanpa pupuk kimia sintetis. Hasil panen pertama sebanyak 18 kg sayuran dibagikan kepada warga sekitar dan sebagian diolah di kelas keterampilan.',
      isDemo: true,
      createdBy,
    },
    {
      id: 'stim_bindo_perpus',
      subjectId: 'bahasa_indonesia',
      title: 'Laporan Kunjungan & Peminjaman Buku Perpustakaan SD',
      stimulusType: 'table',
      readingText:
        'Perpustakaan Tunas Ilmu mencatat jumlah peminjaman buku siswa kelas 6 selama empat bulan terakhir. Program "15 Menit Membaca Sebelum Pelajaran" dimulai pada awal bulan Maret.',
      tableData: {
        headers: ['Bulan', 'Buku Fiksi', 'Buku Sains & Pengetahuan', 'Total Peminjaman'],
        rows: [
          ['Januari', '64', '38', '102'],
          ['Februari', '70', '45', '115'],
          ['Maret', '96', '78', '174'],
          ['April', '104', '92', '196'],
        ],
      },
      isDemo: true,
      createdBy,
    },
    {
      id: 'stim_mtk_lapangan',
      subjectId: 'matematika',
      title: 'Denah Lapangan Olahraga dan Panggung Setengah Lingkaran',
      stimulusType: 'mixed',
      imageUrl: '/src/assets/images/stimulus_denah_lapangan_1794999855787.jpg',
      readingText:
        'Sekolah merenovasi lapangan olahraga berbentuk persegi panjang dengan panjang 28 meter dan lebar 14 meter. Di sisi kanan lapangan terdapat panggung upacara berbentuk setengah lingkaran dengan diameter tepat sama dengan lebar lapangan (14 meter). Bagian tengah lapangan akan ditanami rumput sintetis, sedangkan lintasan lari mengelilingi tepi lapangan.',
      isDemo: true,
      createdBy,
    },
    {
      id: 'stim_mtk_panen',
      subjectId: 'matematika',
      title: 'Grafik Hasil Panen Buah Kebun Sekolah (Kilogram)',
      stimulusType: 'chart',
      readingText:
        'Diagram batang berikut menunjukkan jumlah hasil panen buah di kebun praktik kelas 6 selama satu tahun ajaran dalam satuan kilogram (kg).',
      chartData: {
        chartType: 'bar',
        title: 'Hasil Panen Buah Kebun Sekolah (kg)',
        xLabel: 'Jenis Buah',
        yLabel: 'Berat (kg)',
        labels: ['Mangga', 'Jambu', 'Pepaya', 'Pisang', 'Jeruk'],
        values: [45, 30, 55, 40, 30],
      },
      isDemo: true,
      createdBy,
    },
  ];
}

export function buildDemoQuestions(createdBy: string): Question[] {
  return [
    {
      id: 'q_bindo_01',
      subjectId: 'bahasa_indonesia',
      topic: 'Memahami Teks Informasi',
      competency: 'Menemukan informasi tersurat pada teks informasi',
      indicator: 'Mengidentifikasi manfaat langsung sistem penampungan air hujan di sekolah',
      difficulty: 'mudah',
      questionType: 'pg',
      stimulusId: 'stim_bindo_kebun',
      questionText:
        'Berdasarkan teks dan ilustrasi Kebun Edukasi, manfaat utama menampung air hujan di dalam gentong bagi sekolah adalah ...',
      options: [
        { id: 'A', label: 'A', text: 'Menghemat pemakaian air PDAM hingga 40 persen untuk menyiram tanaman' },
        { id: 'B', label: 'B', text: 'Menggantikan seluruh fungsi pupuk kompos pada bedengan sayuran' },
        { id: 'C', label: 'C', text: 'Menambah luas halaman belakang sekolah untuk tempat bermain' },
        { id: 'D', label: 'D', text: 'Mempercepat proses penguraian sampah daun kering menjadi 7 hari' },
      ],
      correctOptionId: 'A',
      pgkScoringRule: 'all_or_nothing',
      points: 10,
      explanation:
        'Pada paragraf pertama disebutkan bahwa menyiram bedengan menggunakan air hujan yang ditampung membuat sekolah mampu menghemat pemakaian air PDAM hingga 40 persen.',
      isDemo: true,
      createdBy,
    },
    {
      id: 'q_bindo_02',
      subjectId: 'bahasa_indonesia',
      topic: 'Menyimpulkan Ide Pokok & Makna Tersirat',
      competency: 'Mengevaluasi dan merefleksi isi teks informasi',
      indicator: 'Menentukan lebih dari satu pernyataan yang sesuai mengenai pengelolaan kebun edukasi',
      difficulty: 'sedang',
      questionType: 'pgk_mcma',
      stimulusId: 'stim_bindo_kebun',
      questionText:
        'Pilihlah DUA pernyataan yang benar mengenai kegiatan siswa di Kebun Edukasi berdasarkan bacaan!',
      options: [
        { id: 'A', label: 'A', text: 'Sampah organik kantin dan daun kering diolah menjadi kompos selama 21 hari.' },
        { id: 'B', label: 'B', text: 'Seluruh hasil panen sayuran dijual ke pasar induk untuk membeli pupuk kimia.' },
        { id: 'C', label: 'C', text: 'Tanaman sayur disiram dengan air hujan yang tertampung dari talang atap.' },
        { id: 'D', label: 'D', text: 'Pupuk kimia sintetis tetap digunakan setiap minggu agar sawi cepat tumbuh.' },
      ],
      correctOptionIds: ['A', 'C'],
      pgkScoringRule: 'partial_proportional',
      points: 10,
      explanation:
        'Pernyataan A sesuai (kompos matang setelah 21 hari) dan C sesuai (air hujan dari talang atap ditampung di gentong). B dan D bertentangan dengan isi teks.',
      isDemo: true,
      createdBy,
    },
    {
      id: 'q_bindo_03',
      subjectId: 'bahasa_indonesia',
      topic: 'Kosakata Baku & Struktur Kalimat',
      competency: 'Menilai ketepatan informasi dan pernyataan berdasarkan teks',
      indicator: 'Menentukan kebenaran beberapa pernyataan terkait teks Kebun Edukasi',
      difficulty: 'sedang',
      questionType: 'pgk_kategori',
      stimulusId: 'stim_bindo_kebun',
      questionText:
        'Tentukan apakah setiap pernyataan berikut Benar atau Salah sesuai isi teks Kebun Edukasi!',
      statements: [
        { id: 'S1', text: 'Kapasitas gentong penampung air hujan adalah 300 liter.' },
        { id: 'S2', text: 'Hasil panen pertama mencapai 18 kg sayuran yang dibagikan dan diolah.' },
        { id: 'S3', text: 'Kegiatan Kebun Edukasi dikelola oleh siswa kelas 3 tanpa regu piket.' },
      ],
      correctCategories: {
        S1: 'Benar',
        S2: 'Benar',
        S3: 'Salah',
      },
      pgkScoringRule: 'partial_proportional',
      points: 10,
      explanation:
        'S1 Benar (300 liter), S2 Benar (18 kg sayuran), S3 Salah karena dikelola oleh siswa kelas 6 dengan regu piket setiap pagi.',
      isDemo: true,
      createdBy,
    },
    {
      id: 'q_bindo_04',
      subjectId: 'bahasa_indonesia',
      topic: 'Menafsirkan Data Tabel & Infografik',
      competency: 'Menginterpretasikan data dalam tabel kunjungan perpustakaan',
      indicator: 'Menghitung selisih peningkatan peminjaman setelah program membaca dimulai',
      difficulty: 'sedang',
      questionType: 'pg',
      stimulusId: 'stim_bindo_perpus',
      questionText:
        'Berapakah kenaikan total peminjaman buku dari bulan Februari (sebelum program 15 Menit Membaca) ke bulan Maret (saat program dimulai)?',
      options: [
        { id: 'A', label: 'A', text: '49 buku' },
        { id: 'B', label: 'B', text: '59 buku' },
        { id: 'C', label: 'C', text: '69 buku' },
        { id: 'D', label: 'D', text: '72 buku' },
      ],
      correctOptionId: 'B',
      pgkScoringRule: 'all_or_nothing',
      points: 10,
      explanation:
        'Total peminjaman bulan Maret adalah 174 buku, sedangkan Februari adalah 115 buku. Selisihnya: 174 - 115 = 59 buku.',
      isDemo: true,
      createdBy,
    },
    {
      id: 'q_bindo_05',
      subjectId: 'bahasa_indonesia',
      topic: 'Menafsirkan Data Tabel & Infografik',
      competency: 'Menarik simpulan dari tren data tabel',
      indicator: 'Mengevaluasi kebenaran pernyataan tren peminjaman buku fiksi dan sains',
      difficulty: 'sukar',
      questionType: 'pgk_kategori',
      stimulusId: 'stim_bindo_perpus',
      questionText:
        'Berdasarkan tabel peminjaman buku, tentukan Benar atau Salah untuk setiap kesimpulan berikut!',
      statements: [
        { id: 'S1', text: 'Peminjaman buku fiksi selalu lebih banyak daripada buku sains setiap bulan.' },
        { id: 'S2', text: 'Peminjaman buku sains pada bulan April meningkat lebih dari dua kali lipat dibanding bulan Januari.' },
        { id: 'S3', text: 'Total peminjaman buku pada bulan Januari dan Februari digabung melebihi 250 buku.' },
      ],
      correctCategories: {
        S1: 'Benar',
        S2: 'Benar',
        S3: 'Salah',
      },
      pgkScoringRule: 'partial_proportional',
      points: 10,
      explanation:
        'S1 Benar (64>38, 70>45, 96>78, 104>92). S2 Benar (92 > 2×38=76). S3 Salah karena 102 + 115 = 217 (< 250).',
      isDemo: true,
      createdBy,
    },
    {
      id: 'q_mtk_01',
      subjectId: 'matematika',
      topic: 'Bangun Datar & Pengukuran',
      competency: 'Menghitung luas bangun datar gabungan (persegi panjang & setengah lingkaran)',
      indicator: 'Menentukan luas lapangan persegi panjang utama dari denah',
      difficulty: 'mudah',
      questionType: 'pg',
      stimulusId: 'stim_mtk_lapangan',
      questionText:
        'Luas bagian lapangan utama berbentuk persegi panjang yang akan ditanami rumput sintetis adalah ...',
      options: [
        { id: 'A', label: 'A', text: '84 m²' },
        { id: 'B', label: 'B', text: '292 m²' },
        { id: 'C', label: 'C', text: '392 m²' },
        { id: 'D', label: 'D', text: '469 m²' },
      ],
      correctOptionId: 'C',
      pgkScoringRule: 'all_or_nothing',
      points: 10,
      explanation: 'Luas persegi panjang = panjang × lebar = 28 m × 14 m = 392 m².',
      isDemo: true,
      createdBy,
    },
    {
      id: 'q_mtk_02',
      subjectId: 'matematika',
      topic: 'Bangun Datar & Pengukuran',
      competency: 'Menghitung keliling dan luas lingkaran dalam konteks nyata',
      indicator: 'Memilih pernyataan benar tentang ukuran panggung setengah lingkaran (π = 22/7)',
      difficulty: 'sukar',
      questionType: 'pgk_mcma',
      stimulusId: 'stim_mtk_lapangan',
      questionText:
        'Diketahui π = 22/7 dan diameter panggung setengah lingkaran adalah 14 meter. Pilihlah DUA pernyataan yang benar!',
      options: [
        { id: 'A', label: 'A', text: 'Jari-jari panggung setengah lingkaran adalah 7 meter.' },
        { id: 'B', label: 'B', text: 'Luas panggung setengah lingkaran adalah 154 m².' },
        { id: 'C', label: 'C', text: 'Luas panggung setengah lingkaran adalah 77 m².' },
        { id: 'D', label: 'D', text: 'Luas total lapangan dan panggung gabungan adalah 492 m².' },
      ],
      correctOptionIds: ['A', 'C'],
      pgkScoringRule: 'partial_proportional',
      points: 10,
      explanation:
        'Jari-jari r = 14 / 2 = 7 m (A benar). Luas 1/2 lingkaran = 1/2 × (22/7) × 7 × 7 = 77 m² (C benar). Luas gabungan = 392 + 77 = 469 m².',
      isDemo: true,
      createdBy,
    },
    {
      id: 'q_mtk_03',
      subjectId: 'matematika',
      topic: 'Operasi Bilangan & Pecahan',
      competency: 'Menyelesaikan masalah rasio, persentase, dan bilangan bulat',
      indicator: 'Menentukan kebenaran pernyataan terkait proporsi biaya rumput sintetis',
      difficulty: 'sedang',
      questionType: 'pgk_kategori',
      stimulusId: 'stim_mtk_lapangan',
      questionText:
        'Jika 1 m² rumput sintetis berharga Rp100.000 dan sekolah mendapat diskon 10%, tentukan Benar atau Salah untuk setiap pernyataan berikut!',
      statements: [
        { id: 'S1', text: 'Keliling bagian persegi panjang lapangan adalah 84 meter.' },
        { id: 'S2', text: 'Harga 1 m² rumput sintetis setelah diskon adalah Rp90.000.' },
        { id: 'S3', text: 'Jika siswa berlari 2 putaran mengelilingi persegi panjang lapangan, jarak tempuhnya 150 meter.' },
      ],
      correctCategories: {
        S1: 'Benar',
        S2: 'Benar',
        S3: 'Salah',
      },
      pgkScoringRule: 'partial_proportional',
      points: 10,
      explanation:
        'Keliling = 2×(28+14) = 84 m (Benar). Diskon 10% dari Rp100.000 = Rp90.000 (Benar). 2 putaran = 2×84 = 168 m, bukan 150 m (Salah).',
      isDemo: true,
      createdBy,
    },
    {
      id: 'q_mtk_04',
      subjectId: 'matematika',
      topic: 'Pengolahan Data & Diagram',
      competency: 'Menghitung rata-rata (mean) dan modus dari diagram batang',
      indicator: 'Menentukan rata-rata hasil panen buah per jenis dari diagram batang',
      difficulty: 'sedang',
      questionType: 'pg',
      stimulusId: 'stim_mtk_panen',
      questionText:
        'Berdasarkan grafik batang Hasil Panen Buah Kebun Sekolah, berapakah rata-rata hasil panen dari kelima jenis buah tersebut?',
      options: [
        { id: 'A', label: 'A', text: '38 kg' },
        { id: 'B', label: 'B', text: '40 kg' },
        { id: 'C', label: 'C', text: '42 kg' },
        { id: 'D', label: 'D', text: '45 kg' },
      ],
      correctOptionId: 'B',
      pgkScoringRule: 'all_or_nothing',
      points: 10,
      explanation:
        'Total panen = 45 + 30 + 55 + 40 + 30 = 200 kg. Rata-rata = 200 ÷ 5 jenis buah = 40 kg.',
      isDemo: true,
      createdBy,
    },
    {
      id: 'q_mtk_05',
      subjectId: 'matematika',
      topic: 'Debit, Kecepatan & Perbandingan',
      competency: 'Menganalisis perbandingan dan persentase dari data diagram',
      indicator: 'Memilih pernyataan yang tepat mengenai perbandingan hasil panen buah',
      difficulty: 'sedang',
      questionType: 'pgk_mcma',
      stimulusId: 'stim_mtk_panen',
      questionText:
        'Perhatikan diagram hasil panen buah. Pilihlah DUA pernyataan yang tepat!',
      options: [
        { id: 'A', label: 'A', text: 'Selisih panen terbanyak (Pepaya) dan paling sedikit (Jambu) adalah 25 kg.' },
        { id: 'B', label: 'B', text: 'Persentase panen Pisang terhadap total seluruh panen adalah 20%.' },
        { id: 'C', label: 'C', text: 'Perbandingan hasil panen Mangga dan Pepaya adalah 4 : 5.' },
        { id: 'D', label: 'D', text: 'Total hasil panen seluruh buah adalah 220 kg.' },
      ],
      correctOptionIds: ['A', 'B'],
      pgkScoringRule: 'partial_proportional',
      points: 10,
      explanation:
        'Selisih Pepaya (55) - Jambu (30) = 25 kg (A benar). Persentase Pisang = 40/200 × 100% = 20% (B benar). Mangga:Pepaya = 45:55 = 9:11.',
      isDemo: true,
      createdBy,
    },
  ];
}

export async function seedDemoData(adminUid: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    const batchSchools = writeBatch(db);
    for (const s of DEMO_SCHOOLS) {
      batchSchools.set(doc(db, 'schools', s.id), { ...s, createdAt: now, updatedAt: now });
    }
    for (const sub of DEMO_SUBJECTS) {
      batchSchools.set(doc(db, 'subjects', sub.id), sub);
    }
    const stimuli = buildDemoStimuli(adminUid);
    const stimuliMap: Record<string, Stimulus> = {};
    for (const stim of stimuli) {
      stimuliMap[stim.id] = stim;
      batchSchools.set(doc(db, 'stimuli', stim.id), { ...stim, createdAt: now, updatedAt: now });
    }
    const questions = buildDemoQuestions(adminUid);
    const questionsMap: Record<string, Question> = {};
    for (const q of questions) {
      questionsMap[q.id] = q;
      batchSchools.set(doc(db, 'question_bank', q.id), { ...q, createdAt: now, updatedAt: now });
    }
    await batchSchools.commit();

    const classes: SchoolClass[] = [
      {
        id: 'cls_a_6a',
        school_id: 'sekolah_a',
        name: '6A',
        gradeLevel: '6',
        homeroomTeacher: 'Ibu Ratna Sari, S.Pd.',
        academicYear: '2025/2026',
        isActive: true,
        isDemo: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'cls_a_6b',
        school_id: 'sekolah_a',
        name: '6B',
        gradeLevel: '6',
        homeroomTeacher: 'Bapak Hendra Wijaya, S.Pd.',
        academicYear: '2025/2026',
        isActive: true,
        isDemo: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'cls_b_6a',
        school_id: 'sekolah_b',
        name: '6A',
        gradeLevel: '6',
        homeroomTeacher: 'Ibu Dewi Lestari, S.Pd.',
        academicYear: '2025/2026',
        isActive: true,
        isDemo: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'cls_b_6b',
        school_id: 'sekolah_b',
        name: '6B',
        gradeLevel: '6',
        homeroomTeacher: 'Bapak Arif Nugroho, S.Pd.',
        academicYear: '2025/2026',
        isActive: true,
        isDemo: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
    const batchClasses = writeBatch(db);
    for (const c of classes) {
      batchClasses.set(doc(db, 'classes', c.id), c);
    }
    await batchClasses.commit();

    const studentsData: Array<{
      id: string;
      school_id: string;
      classId: string;
      className: string;
      nis: string;
      name: string;
      gender: 'L' | 'P';
    }> = [
      { id: 'stu_a_1', school_id: 'sekolah_a', classId: 'cls_a_6a', className: '6A', nis: '260101', name: 'Aisyah Putri Rahmawati', gender: 'P' },
      { id: 'stu_a_2', school_id: 'sekolah_a', classId: 'cls_a_6a', className: '6A', nis: '260102', name: 'Bima Pratama Putra', gender: 'L' },
      { id: 'stu_a_3', school_id: 'sekolah_a', classId: 'cls_a_6a', className: '6A', nis: '260103', name: 'Citra Kirana Maharani', gender: 'P' },
      { id: 'stu_a_4', school_id: 'sekolah_a', classId: 'cls_a_6b', className: '6B', nis: '260104', name: 'Dimas Aditya Kusuma', gender: 'L' },
      { id: 'stu_a_5', school_id: 'sekolah_a', classId: 'cls_a_6b', className: '6B', nis: '260105', name: 'Elena Zahra Nabila', gender: 'P' },
      { id: 'stu_a_6', school_id: 'sekolah_a', classId: 'cls_a_6b', className: '6B', nis: '260106', name: 'Fajar Ramadhan', gender: 'L' },
      { id: 'stu_b_1', school_id: 'sekolah_b', classId: 'cls_b_6a', className: '6A', nis: '260201', name: 'Gita Anindya Putri', gender: 'P' },
      { id: 'stu_b_2', school_id: 'sekolah_b', classId: 'cls_b_6a', className: '6A', nis: '260202', name: 'Hafiz Alfarizi', gender: 'L' },
      { id: 'stu_b_3', school_id: 'sekolah_b', classId: 'cls_b_6a', className: '6A', nis: '260203', name: 'Intan Permata Sari', gender: 'P' },
      { id: 'stu_b_4', school_id: 'sekolah_b', classId: 'cls_b_6b', className: '6B', nis: '260204', name: 'Joko Santoso', gender: 'L' },
      { id: 'stu_b_5', school_id: 'sekolah_b', classId: 'cls_b_6b', className: '6B', nis: '260205', name: 'Kayla Azzahra', gender: 'P' },
      { id: 'stu_b_6', school_id: 'sekolah_b', classId: 'cls_b_6b', className: '6B', nis: '260206', name: 'Lutfi Hakim', gender: 'L' },
    ];

    const batchStudents = writeBatch(db);
    for (const st of studentsData) {
      const stuDoc: Student = { ...st, isActive: true, isDemo: true, createdAt: now, updatedAt: now };
      const dirDoc: StudentDirectoryEntry = {
        studentId: st.id,
        school_id: st.school_id,
        classId: st.classId,
        className: st.className,
        nis: st.nis,
        displayName: st.name,
        isActive: true,
        isDemo: true,
      };
      batchStudents.set(doc(db, 'students', st.id), stuDoc);
      batchStudents.set(doc(db, 'student_directory', `${st.school_id}__${st.nis}`), dirDoc);
    }
    await batchStudents.commit();

    // Save Packages with sanitized student_items
    const pkgCombined: ExamPackage = {
      id: 'pkg_tka_gabungan_01',
      title: 'Simulasi TKA Gabungan Kelas 6 (B. Indonesia & Matematika)',
      subjectMode: 'gabungan',
      description: 'Simulasi terpadu mengukur literasi membaca dan numerasi SD kelas 6 untuk kedua sekolah.',
      questionIds: questions.map((q) => q.id),
      questionCount: questions.length,
      durationMinutes: 45,
      startTime: new Date(Date.now() - 86400000).toISOString().slice(0, 16),
      endTime: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
      isActive: true,
      schoolScope: 'both',
      allowedSchoolIds: ['sekolah_a', 'sekolah_b'],
      randomizeQuestions: false,
      randomizeOptions: false,
      showResultsToStudent: true,
      showAnswersAfterExam: false,
      pgkScoringMode: 'partial_proportional',
      isDemo: true,
      createdBy: adminUid,
      createdAt: now,
      updatedAt: now,
    };

    const pkgBindo: ExamPackage = {
      id: 'pkg_tka_bindo_01',
      title: 'Simulasi TKA Bahasa Indonesia Kelas 6',
      subjectMode: 'bahasa_indonesia',
      description: 'Fokus literasi teks informasi, simpulan paragraf, dan interpretasi tabel.',
      questionIds: questions.filter((q) => q.subjectId === 'bahasa_indonesia').map((q) => q.id),
      questionCount: 5,
      durationMinutes: 25,
      isActive: true,
      schoolScope: 'both',
      allowedSchoolIds: ['sekolah_a', 'sekolah_b'],
      randomizeQuestions: false,
      randomizeOptions: false,
      showResultsToStudent: true,
      showAnswersAfterExam: true,
      pgkScoringMode: 'partial_proportional',
      isDemo: true,
      createdBy: adminUid,
      createdAt: now,
      updatedAt: now,
    };

    const pkgMtk: ExamPackage = {
      id: 'pkg_tka_mtk_01',
      title: 'Simulasi TKA Matematika Kelas 6',
      subjectMode: 'matematika',
      description: 'Fokus bangun datar gabungan, pengolahan data grafik, dan perbandingan.',
      questionIds: questions.filter((q) => q.subjectId === 'matematika').map((q) => q.id),
      questionCount: 5,
      durationMinutes: 30,
      isActive: true,
      schoolScope: 'both',
      allowedSchoolIds: ['sekolah_a', 'sekolah_b'],
      randomizeQuestions: false,
      randomizeOptions: false,
      showResultsToStudent: true,
      showAnswersAfterExam: false,
      pgkScoringMode: 'partial_proportional',
      isDemo: true,
      createdBy: adminUid,
      createdAt: now,
      updatedAt: now,
    };

    await saveExamPackageWithItems(pkgCombined, questionsMap, stimuliMap);
    await saveExamPackageWithItems(pkgBindo, questionsMap, stimuliMap);
    await saveExamPackageWithItems(pkgMtk, questionsMap, stimuliMap);

    // Tokens & Sessions
    const batch2 = writeBatch(db);
    const tokens: ExamToken[] = [
      {
        tokenCode: 'TKASMART26',
        packageId: pkgCombined.id,
        packageTitle: pkgCombined.title,
        school_id: 'ALL',
        sessionName: 'Try Out Nasional TKA Gabungan',
        isActive: true,
        isDemo: true,
        createdBy: adminUid,
        createdAt: now,
      },
      {
        tokenCode: 'BINDO26A',
        packageId: pkgBindo.id,
        packageTitle: pkgBindo.title,
        school_id: 'sekolah_a',
        sessionName: 'Sesi Literasi SDN Nusantara 01',
        isActive: true,
        isDemo: true,
        createdBy: adminUid,
        createdAt: now,
      },
      {
        tokenCode: 'MAT26B',
        packageId: pkgMtk.id,
        packageTitle: pkgMtk.title,
        school_id: 'sekolah_b',
        sessionName: 'Sesi Numerasi SD Harapan Bangsa',
        isActive: true,
        isDemo: true,
        createdBy: adminUid,
        createdAt: now,
      },
    ];
    for (const tk of tokens) {
      batch2.set(doc(db, 'exam_tokens', tk.tokenCode), tk);
    }

    const sessions: ExamSession[] = [
      {
        id: 'sess_a_01',
        school_id: 'sekolah_a',
        packageId: pkgCombined.id,
        packageTitle: pkgCombined.title,
        tokenCode: 'TKASMART26',
        sessionName: 'Simulasi Gabungan — SDN Nusantara 01',
        scheduledStart: now.slice(0, 16),
        status: 'active',
        proctorName: 'Ibu Ratna Sari, S.Pd.',
        isDemo: true,
        createdBy: adminUid,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'sess_b_01',
        school_id: 'sekolah_b',
        packageId: pkgCombined.id,
        packageTitle: pkgCombined.title,
        tokenCode: 'TKASMART26',
        sessionName: 'Simulasi Gabungan — SD Harapan Bangsa',
        scheduledStart: now.slice(0, 16),
        status: 'active',
        proctorName: 'Ibu Dewi Lestari, S.Pd.',
        isDemo: true,
        createdBy: adminUid,
        createdAt: now,
        updatedAt: now,
      },
    ];
    for (const s of sessions) {
      batch2.set(doc(db, 'exam_sessions', s.id), s);
    }

    // Demo completed attempts & results for 6 students (3 from School A, 3 from School B)
    // Leaving NIS 260101 (Aisyah) & 260201 (Gita) unattempted so user can immediately test live student login!
    const demoPerformers = [
      { student: studentsData[1], accuracy: 0.9 }, // Bima (A)
      { student: studentsData[2], accuracy: 0.78 }, // Citra (A)
      { student: studentsData[3], accuracy: 0.65 }, // Dimas (A)
      { student: studentsData[4], accuracy: 0.85 }, // Elena (A)
      { student: studentsData[7], accuracy: 0.92 }, // Hafiz (B)
      { student: studentsData[8], accuracy: 0.72 }, // Intan (B)
      { student: studentsData[9], accuracy: 0.58 }, // Joko (B)
      { student: studentsData[10], accuracy: 0.88 }, // Kayla (B)
    ];

    const demoOutcomes: Array<{ attempt: ExamAttempt; result: ReturnType<typeof gradeExamAttempt>['result']; review: ReturnType<typeof gradeExamAttempt>['review'] }> = [];

    demoPerformers.forEach((perf, idx) => {
      const answers: ExamAttempt['answers'] = {};
      questions.forEach((q, qIdx) => {
        const shouldBeCorrect = ((idx + qIdx) % 10) / 10 < perf.accuracy;
        if (q.questionType === 'pg') {
          answers[q.id] = {
            selectedOptionId: shouldBeCorrect
              ? q.correctOptionId
              : q.correctOptionId === 'A'
                ? 'B'
                : 'A',
          };
        } else if (q.questionType === 'pgk_mcma') {
          answers[q.id] = {
            selectedOptionIds: shouldBeCorrect ? q.correctOptionIds : ['B', 'D'],
          };
        } else {
          const cat: Record<string, 'Benar' | 'Salah'> = {};
          (q.statements || []).forEach((st, sIdx) => {
            const expected = q.correctCategories?.[st.id] || 'Benar';
            cat[st.id] =
              shouldBeCorrect || sIdx === 0
                ? expected
                : expected === 'Benar'
                  ? 'Salah'
                  : 'Benar';
          });
          answers[q.id] = { categoryChoices: cat };
        }
      });

      const attemptId = `${pkgCombined.id}__${perf.student.school_id}__${perf.student.nis}`;
      const attempt: ExamAttempt = {
        id: attemptId,
        packageId: pkgCombined.id,
        tokenCode: 'TKASMART26',
        school_id: perf.student.school_id,
        studentId: perf.student.id,
        studentName: perf.student.name,
        nis: perf.student.nis,
        classId: perf.student.classId,
        className: perf.student.className,
        status: 'in_progress',
        questionOrder: questions.map((q) => q.id),
        flaggedQuestionIds: [],
        currentQuestionIndex: questions.length - 1,
        answers,
        startedAtMs: Date.now() - 2500000,
        lastSavedAtMs: Date.now() - 400000,
        submittedAtMs: Date.now() - 400000,
        timeRemainingSeconds: 820,
        isDemo: true,
      };
      const { result, review } = gradeExamAttempt(attempt, pkgCombined, questionsMap, adminUid);
      batch2.set(doc(db, 'exam_attempts', attempt.id), attempt);
      demoOutcomes.push({ attempt, result, review });
    });

    await batch2.commit();

    const batch3 = writeBatch(db);
    for (const item of demoOutcomes) {
      batch3.set(doc(db, 'exam_results', item.result.id), item.result);
      batch3.set(doc(db, 'exam_result_reviews', item.review.id), item.review);
      batch3.update(doc(db, 'exam_attempts', item.attempt.id), { status: 'graded' });
    }
    await batch3.commit();
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, 'demo_seed');
  }
}

export async function clearDemoData(): Promise<number> {
  const demoCollections = [
    'exam_results',
    'exam_result_reviews',
    'exam_attempts',
    'exam_sessions',
    'exam_tokens',
    'students',
    'student_directory',
    'classes',
    'question_bank',
    'stimuli',
  ];

  let deletedCount = 0;
  try {
    for (const colName of demoCollections) {
      const snap = await getDocs(query(collection(db, colName), where('isDemo', '==', true)));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach((d) => {
          batch.delete(d.ref);
          deletedCount += 1;
        });
        await batch.commit();
      }
    }

    // Packages and their student_items subcollection
    const pkgSnap = await getDocs(
      query(collection(db, 'exam_packages'), where('isDemo', '==', true)),
    );
    for (const pkgDoc of pkgSnap.docs) {
      const itemsSnap = await getDocs(collection(db, 'exam_packages', pkgDoc.id, 'student_items'));
      const batch = writeBatch(db);
      itemsSnap.forEach((d) => batch.delete(d.ref));
      batch.delete(pkgDoc.ref);
      deletedCount += 1;
      await batch.commit();
    }

    return deletedCount;
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, 'clear_demo_data');
  }
}
