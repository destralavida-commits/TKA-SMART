import * as XLSX from 'xlsx';
import { sanitizeId } from './firestoreService';
import type {
  DifficultyLevel,
  Question,
  QuestionOption,
  QuestionStatement,
  QuestionType,
  Stimulus,
  StimulusType,
  SubjectId,
} from '../types/tka';

export interface TemplateGeneratorConfig {
  subjectId: SubjectId;
  totalQuestions: number;
  pgCount: number;
  pgkMcmaCount: number;
  pgkKategoriCount: number;
  mediaImageCount: number;
  mediaTextCount: number;
  mediaChartTableDiagramCount: number;
  difficultyEasyCount: number;
  difficultyMediumCount: number;
  difficultyHardCount: number;
}

export interface ConfigValidationResult {
  isValid: boolean;
  typeSum: number;
  difficultySum: number;
  errors: string[];
}

export interface ParsedStimulusDraft {
  id: string;
  subjectId: SubjectId;
  title: string;
  stimulusType: StimulusType;
  readingText?: string;
  imageUrl?: string;
  imageRef?: string;
  tableData?: Stimulus['tableData'];
  chartData?: Stimulus['chartData'];
  isExistingInDb: boolean;
  rowErrors: string[];
}

export interface ParsedImageRef {
  id: string;
  description: string;
  url: string;
  notes: string;
  rowNumber: number;
}

export interface ParsedQuestionDraft {
  rowNumber: number;
  questionNumber: number;
  subjectId: SubjectId;
  questionType: QuestionType;
  topic: string;
  competency: string;
  indicator: string;
  difficulty: DifficultyLevel;
  mediaTypes: string[];
  stimulusId?: string;
  imageRef?: string;
  imageUrl?: string;
  questionText: string;
  options?: QuestionOption[];
  statements?: QuestionStatement[];
  correctOptionId?: string;
  correctOptionIds?: string[];
  correctCategories?: Record<string, 'Benar' | 'Salah'>;
  points: number;
  explanation: string;
  rowErrors: string[];
}

export interface ExcelImportValidationReport {
  fileName: string;
  expectedTotalFromSheet?: number;
  expectedBreakdown?: {
    pg?: number;
    pgkMcma?: number;
    pgkKategori?: number;
  };
  workbookErrors: string[];
  checks: {
    formatValid: boolean;
    questionTypesValid: boolean;
    totalCountValid: boolean;
    answerKeysValid: boolean;
    stimulusIdsValid: boolean;
    imageRefsValid: boolean;
  };
  stimuliDrafts: ParsedStimulusDraft[];
  imageRefs: ParsedImageRef[];
  questionDrafts: ParsedQuestionDraft[];
  validQuestionCount: number;
  invalidQuestionCount: number;
  canConfirmSave: boolean;
}

export const INDICATOR_CATALOG: Array<{
  code: string;
  subjectId: SubjectId;
  topic: string;
  competency: string;
  indicator: string;
}> = [
  {
    code: 'IND-BI-01',
    subjectId: 'bahasa_indonesia',
    topic: 'Memahami Teks Informasi',
    competency: 'Menemukan informasi tersurat pada teks',
    indicator: 'Mengidentifikasi fakta utama dalam teks bacaan nonfiksi kelas 6',
  },
  {
    code: 'IND-BI-02',
    subjectId: 'bahasa_indonesia',
    topic: 'Menyimpulkan Ide Pokok & Makna Tersirat',
    competency: 'Menyimpulkan isi dan amanat bacaan',
    indicator: 'Menentukan ide pokok paragraf dan simpulan logis dari teks',
  },
  {
    code: 'IND-BI-03',
    subjectId: 'bahasa_indonesia',
    topic: 'Menafsirkan Data Tabel & Infografik',
    competency: 'Memadukan informasi teks dengan tabel/grafik',
    indicator: 'Menilai kebenaran pernyataan berdasarkan data tabel atau gambar',
  },
  {
    code: 'IND-BI-04',
    subjectId: 'bahasa_indonesia',
    topic: 'Kosakata Baku & Struktur Kalimat',
    competency: 'Menerapkan kaidah kebahasaan yang efektif',
    indicator: 'Memperbaiki penggunaan kata baku, ejaan, dan tanda baca',
  },
  {
    code: 'IND-MTK-01',
    subjectId: 'matematika',
    topic: 'Operasi Bilangan & Pecahan',
    competency: 'Menyelesaikan masalah operasi bilangan cacah, pecahan, dan persen',
    indicator: 'Menghitung operasi hitung campuran dalam konteks kehidupan sehari-hari',
  },
  {
    code: 'IND-MTK-02',
    subjectId: 'matematika',
    topic: 'Bangun Datar & Pengukuran',
    competency: 'Menentukan keliling, luas, dan volume bangun sederhana',
    indicator: 'Menyelesaikan soal bangun datar/ruang berdasarkan gambar atau diagram',
  },
  {
    code: 'IND-MTK-03',
    subjectId: 'matematika',
    topic: 'Debit, Kecepatan & Perbandingan',
    competency: 'Menggunakan penalaran rasio dan perbandingan',
    indicator: 'Menghitung perbandingan senilai, kecepatan, jarak, atau waktu tempuh',
  },
  {
    code: 'IND-MTK-04',
    subjectId: 'matematika',
    topic: 'Pengolahan Data & Diagram',
    competency: 'Membaca dan menafsirkan data statistik sederhana',
    indicator: 'Menentukan rata-rata, modus, atau selisih dari tabel dan grafik batang',
  },
];

export function validateTemplateConfig(
  cfg: TemplateGeneratorConfig,
): ConfigValidationResult {
  const errors: string[] = [];
  const total = Number(cfg.totalQuestions) || 0;
  const typeSum =
    (Number(cfg.pgCount) || 0) +
    (Number(cfg.pgkMcmaCount) || 0) +
    (Number(cfg.pgkKategoriCount) || 0);
  const difficultySum =
    (Number(cfg.difficultyEasyCount) || 0) +
    (Number(cfg.difficultyMediumCount) || 0) +
    (Number(cfg.difficultyHardCount) || 0);

  if (total < 1 || total > 100) {
    errors.push('Total jumlah soal harus antara 1 sampai 100 butir.');
  }
  if (cfg.pgCount < 0 || cfg.pgkMcmaCount < 0 || cfg.pgkKategoriCount < 0) {
    errors.push('Jumlah setiap jenis soal tidak boleh bernilai negatif.');
  }
  if (typeSum !== total) {
    errors.push(
      `Total PG (${cfg.pgCount}) + PGK Multiple Answer (${cfg.pgkMcmaCount}) + PGK Kategori (${cfg.pgkKategoriCount}) = ${typeSum}, harus sama dengan Total Soal (${total}).`,
    );
  }
  if (
    cfg.difficultyEasyCount < 0 ||
    cfg.difficultyMediumCount < 0 ||
    cfg.difficultyHardCount < 0
  ) {
    errors.push('Jumlah tingkat kesulitan tidak boleh bernilai negatif.');
  }
  if (difficultySum !== total) {
    errors.push(
      `Total Mudah (${cfg.difficultyEasyCount}) + Sedang (${cfg.difficultyMediumCount}) + Sulit (${cfg.difficultyHardCount}) = ${difficultySum}, harus sama dengan Total Soal (${total}).`,
    );
  }
  if (cfg.mediaImageCount < 0 || cfg.mediaImageCount > total) {
    errors.push(
      `Jumlah soal bergambar (${cfg.mediaImageCount}) harus antara 0 sampai Total Soal (${total}).`,
    );
  }
  if (cfg.mediaTextCount < 0 || cfg.mediaTextCount > total) {
    errors.push(
      `Jumlah soal berbasis teks/stimulus (${cfg.mediaTextCount}) harus antara 0 sampai Total Soal (${total}).`,
    );
  }
  if (
    cfg.mediaChartTableDiagramCount < 0 ||
    cfg.mediaChartTableDiagramCount > total
  ) {
    errors.push(
      `Jumlah soal berbasis tabel/grafik/diagram (${cfg.mediaChartTableDiagramCount}) harus antara 0 sampai Total Soal (${total}).`,
    );
  }

  return {
    isValid: errors.length === 0,
    typeSum,
    difficultySum,
    errors,
  };
}

function subjectLabel(id: SubjectId): string {
  return id === 'bahasa_indonesia' ? 'Bahasa Indonesia' : 'Matematika';
}

function difficultyLabel(d: DifficultyLevel): string {
  if (d === 'mudah') return 'Mudah';
  if (d === 'sedang') return 'Sedang';
  return 'Sulit';
}

function questionTypeLabel(t: QuestionType): string {
  if (t === 'pg') return 'PG';
  if (t === 'pgk_mcma') return 'PGK Multiple Answer';
  return 'PGK Kategori';
}

export function generateQuestionTemplateWorkbook(
  config: TemplateGeneratorConfig,
  existingStimuli: Stimulus[],
  existingQuestions: Question[],
): void {
  const validation = validateTemplateConfig(config);
  if (!validation.isValid) {
    throw new Error(validation.errors[0]);
  }

  const total = config.totalQuestions;
  const mapelName = subjectLabel(config.subjectId);
  const subCode = config.subjectId === 'bahasa_indonesia' ? 'BIND' : 'MTK';

  // Build ordered question types
  const typeQueue: QuestionType[] = [
    ...Array<QuestionType>(config.pgCount).fill('pg'),
    ...Array<QuestionType>(config.pgkMcmaCount).fill('pgk_mcma'),
    ...Array<QuestionType>(config.pgkKategoriCount).fill('pgk_kategori'),
  ];

  // Build ordered difficulty levels
  const diffQueue: DifficultyLevel[] = [
    ...Array<DifficultyLevel>(config.difficultyEasyCount).fill('mudah'),
    ...Array<DifficultyLevel>(config.difficultyMediumCount).fill('sedang'),
    ...Array<DifficultyLevel>(config.difficultyHardCount).fill('sukar'),
  ];

  // Assign media attributes independently (overlap allowed when sum > total)
  const hasImage = Array.from({ length: total }, (_, i) => i < config.mediaImageCount);
  // Deterministic non-overlapping first, wrapping cleanly when overlapping
  const textFlags = new Array<boolean>(total).fill(false);
  for (let k = 0; k < config.mediaTextCount; k++) {
    const idx = (k + (config.mediaImageCount % total)) % total;
    textFlags[idx] = true;
  }
  const dataFlags = new Array<boolean>(total).fill(false);
  for (let k = 0; k < config.mediaChartTableDiagramCount; k++) {
    const idx = (k + ((config.mediaImageCount + config.mediaTextCount) % total)) % total;
    dataFlags[idx] = true;
  }

  // Group stimuli placeholders so consecutive stimulus questions can share or use dedicated IDs
  const generatedStimuliRows: Array<{
    id: string;
    subject: string;
    title: string;
    type: StimulusType;
    readingText: string;
    imageRef: string;
    tableCsv: string;
    chartSpec: string;
    status: string;
  }> = [];

  const generatedImageRefs: Array<{
    id: string;
    description: string;
    url: string;
    usage: string;
  }> = [];

  let stimCounter = 1;
  let imgCounter = 1;

  const dataSoalHeaders = [
    'Nomor soal',
    'Mata pelajaran',
    'Jenis soal',
    'Materi',
    'Indikator',
    'Tingkat kesulitan',
    'Jenis media',
    'ID stimulus',
    'Pertanyaan',
    'Opsi A',
    'Opsi B',
    'Opsi C',
    'Opsi D',
    'Opsi E',
    'Kunci jawaban',
    'Pembahasan',
    'Kompetensi',
    'Bobot poin',
    'Referensi gambar',
  ];

  const dataSoalRows: Array<(string | number)[]> = [dataSoalHeaders];

  const dataKindCycle = ['Tabel', 'Grafik', 'Diagram'] as const;

  for (let i = 0; i < total; i++) {
    const num = i + 1;
    const qType = typeQueue[i];
    const diff = diffQueue[i];
    const imgFlag = hasImage[i];
    const txtFlag = textFlags[i];
    const datFlag = dataFlags[i];

    const mediaParts: string[] = [];
    if (txtFlag) mediaParts.push('Teks');
    if (imgFlag) mediaParts.push('Gambar');
    if (datFlag) mediaParts.push(dataKindCycle[i % dataKindCycle.length]);
    const mediaLabel = mediaParts.length > 0 ? mediaParts.join(' + ') : 'Tanpa Media';

    let stimId = '';
    if (txtFlag || datFlag) {
      stimId = `STIM_${subCode}_${String(stimCounter).padStart(2, '0')}`;
      const stimType: StimulusType =
        txtFlag && imgFlag
          ? 'mixed'
          : datFlag
            ? i % 3 === 0
              ? 'table'
              : i % 3 === 1
                ? 'chart'
                : 'diagram'
            : 'text';
      generatedStimuliRows.push({
        id: stimId,
        subject: mapelName,
        title: `Stimulus ${mapelName} ${stimCounter}`,
        type: stimType,
        readingText: txtFlag
          ? `Tuliskan teks bacaan untuk stimulus ${stimId} di sini.`
          : '',
        imageRef: '',
        tableCsv:
          stimType === 'table'
            ? 'Kategori,Jumlah\nData A,25\nData B,40'
            : '',
        chartSpec:
          stimType === 'chart'
            ? 'Judul Grafik | Label 1,Label 2,Label 3 | 20,35,45'
            : '',
        status: 'Baru (Template)',
      });
      stimCounter += 1;
    }

    let imgRef = '';
    if (imgFlag) {
      imgRef = `IMG_${subCode}_${String(imgCounter).padStart(2, '0')}`;
      generatedImageRefs.push({
        id: imgRef,
        description: `Ilustrasi Soal Nomor ${num}`,
        url: '/assets/aistudio/image_527feef0.png',
        usage: `Digunakan pada soal nomor ${num} (${mediaLabel})`,
      });
      imgCounter += 1;
    }

    dataSoalRows.push([
      num,
      mapelName,
      questionTypeLabel(qType),
      '',
      '',
      difficultyLabel(diff),
      mediaLabel,
      stimId,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      10,
      imgRef,
    ]);
  }

  // Sheet 1: PETUNJUK (includes structured key-value metadata for import verification)
  const petunjukRows: Array<(string | number)[]> = [
    ['GENERATOR TEMPLATE SOAL — TKA SMART (SD KELAS 6)', '', ''],
    ['Panduan Pengisian Bank Soal Terpusat (Bahasa Indonesia & Matematika)', '', ''],
    ['', '', ''],
    ['RINGKASAN KONFIGURASI TEMPLATE', 'NILAI', 'KETERANGAN'],
    ['Mata Pelajaran', mapelName, 'Harus konsisten dengan kolom Mata pelajaran pada DATA SOAL'],
    ['Total Soal', total, 'Jumlah baris soal yang harus diisi pada sheet DATA SOAL'],
    ['Jumlah PG', config.pgCount, 'Pilihan Ganda tunggal (1 kunci jawaban, misal: A)'],
    ['Jumlah PGK Multiple Answer', config.pgkMcmaCount, 'Pilihan Ganda Kompleks (>1 kunci dipisah koma, misal: A,C)'],
    ['Jumlah PGK Kategori', config.pgkKategoriCount, 'Pernyataan Benar/Salah (isi pernyataan di Opsi A-E, kunci: S1:Benar; S2:Salah)'],
    ['Atribut Soal Bergambar', config.mediaImageCount, 'Atribut media (dapat tumpang tindih dengan teks/tabel/grafik/diagram)'],
    ['Atribut Soal Teks / Stimulus', config.mediaTextCount, 'Atribut media bacaan / stimulus terkelompok'],
    ['Atribut Soal Tabel / Grafik / Diagram', config.mediaChartTableDiagramCount, 'Atribut media data visual'],
    ['Komposisi Mudah', config.difficultyEasyCount, 'Tingkat kesulitan Mudah'],
    ['Komposisi Sedang', config.difficultyMediumCount, 'Tingkat kesulitan Sedang'],
    ['Komposisi Sulit', config.difficultyHardCount, 'Tingkat kesulitan Sulit/Sukar'],
    ['', '', ''],
    ['ATURAN PENGISIAN SHEET DATA SOAL', '', ''],
    ['1. Nomor soal', 'Angka urut 1 sampai Total Soal.', 'Jangan ada nomor ganda atau kosong.'],
    ['2. Mata pelajaran', 'Isi "Bahasa Indonesia" atau "Matematika".', 'Sesuai paket soal yang disusun.'],
    ['3. Jenis soal', 'Isi "PG", "PGK Multiple Answer", atau "PGK Kategori".', 'Harus sesuai jumlah komposisi di atas.'],
    ['4. Materi & Indikator', 'Isi materi dan indikator pencapaian.', 'Lihat referensi di sheet INDIKATOR.'],
    ['5. Tingkat kesulitan', 'Isi "Mudah", "Sedang", atau "Sulit".', 'Tingkat "Sukar" juga diterima.'],
    ['6. Jenis media', 'Contoh: "Tanpa Media", "Teks", "Gambar", "Teks + Gambar", "Tabel", "Grafik", "Diagram".', 'Satu soal boleh memakai lebih dari 1 media.'],
    ['7. ID stimulus', 'Jika memakai stimulus, isi ID dari sheet STIMULUS.', 'Beberapa soal boleh berbagi 1 ID stimulus yang sama.'],
    ['8. Opsi A - Opsi E', 'Untuk PG & PGK Multiple Answer: isi pilihan jawaban (min. 2 opsi). Untuk PGK Kategori: isi tiap baris pernyataan (S1 di Opsi A, S2 di Opsi B, dst).', 'Opsi E bersifat opsional.'],
    ['9. Kunci jawaban PG', 'Isi satu huruf opsi yang benar.', 'Contoh: B'],
    ['10. Kunci jawaban PGK Multiple Answer', 'Isi lebih dari satu huruf opsi dipisah koma.', 'Contoh: A,C atau A, B, D'],
    ['11. Kunci jawaban PGK Kategori', 'Isi Benar/Salah untuk setiap pernyataan terisi.', 'Contoh: S1:Benar; S2:Salah; S3:Benar atau Benar, Salah, Benar'],
    ['12. Referensi gambar', 'Isi ID gambar dari sheet REFERENSI GAMBAR (mis. IMG_BIND_01) atau URL gambar langsung.', 'Wajib diisi pada soal/stimulus dengan media Gambar.'],
  ];

  // Sheet 3: STIMULUS (template placeholders + existing DB stimuli for reuse)
  const stimuliRows: Array<(string | number)[]> = [
    [
      'ID stimulus',
      'Mata pelajaran',
      'Judul stimulus',
      'Jenis stimulus',
      'Teks bacaan',
      'Referensi gambar',
      'Data tabel (CSV)',
      'Data grafik (Judul | Label1,Label2 | Nilai1,Nilai2)',
      'Status',
    ],
    ...generatedStimuliRows.map((s) => [
      s.id,
      s.subject,
      s.title,
      s.type,
      s.readingText,
      s.imageRef,
      s.tableCsv,
      s.chartSpec,
      s.status,
    ]),
    ...existingStimuli.map((s) => [
      s.id,
      subjectLabel(s.subjectId),
      s.title,
      s.stimulusType,
      s.readingText || '',
      s.imageUrl || '',
      s.tableData
        ? [s.tableData.headers.join(','), ...s.tableData.rows.map((r) => r.join(','))].join('\n')
        : '',
      s.chartData
        ? `${s.chartData.title} | ${s.chartData.labels.join(',')} | ${s.chartData.values.join(',')}`
        : '',
      'Sudah Ada di Bank Soal',
    ]),
  ];

  // Sheet 4: INDIKATOR (built-in catalog + unique indicators from existing question bank)
  const seenIndicators = new Set<string>();
  const indicatorRows: Array<(string | number)[]> = [
    ['Kode', 'Mata pelajaran', 'Materi', 'Kompetensi', 'Indikator'],
  ];
  for (const item of INDICATOR_CATALOG) {
    const key = `${item.subjectId}::${item.indicator.toLowerCase()}`;
    seenIndicators.add(key);
    indicatorRows.push([
      item.code,
      subjectLabel(item.subjectId),
      item.topic,
      item.competency,
      item.indicator,
    ]);
  }
  let extraIndIdx = 1;
  for (const q of existingQuestions) {
    const key = `${q.subjectId}::${q.indicator.toLowerCase()}`;
    if (!seenIndicators.has(key) && q.indicator.trim()) {
      seenIndicators.add(key);
      indicatorRows.push([
        `IND-DB-${String(extraIndIdx++).padStart(2, '0')}`,
        subjectLabel(q.subjectId),
        q.topic,
        q.competency,
        q.indicator,
      ]);
    }
  }

  // Sheet 5: REFERENSI GAMBAR
  const imageRefRows: Array<(string | number)[]> = [
    ['ID gambar', 'Nama / Deskripsi gambar', 'URL atau Path Gambar', 'Keterangan Penggunaan'],
    ...generatedImageRefs.map((img) => [img.id, img.description, img.url, img.usage]),
    [
      'IMG_CONTOH_01',
      'Contoh Stimulus Kebun Sekolah',
      '/src/assets/images/stimulus_taman_sekolah_1794999855787.jpg',
      'Contoh path gambar lokal bawaan TKA SMART (ganti dengan URL/path gambar soal Anda)',
    ],
  ];

  const wb = XLSX.utils.book_new();

  const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjukRows);
  wsPetunjuk['!cols'] = [{ wch: 36 }, { wch: 38 }, { wch: 58 }];

  const wsDataSoal = XLSX.utils.aoa_to_sheet(dataSoalRows);
  wsDataSoal['!cols'] = [
    { wch: 11 }, // Nomor soal
    { wch: 18 }, // Mata pelajaran
    { wch: 21 }, // Jenis soal
    { wch: 24 }, // Materi
    { wch: 30 }, // Indikator
    { wch: 17 }, // Tingkat kesulitan
    { wch: 20 }, // Jenis media
    { wch: 16 }, // ID stimulus
    { wch: 44 }, // Pertanyaan
    { wch: 24 }, // Opsi A
    { wch: 24 }, // Opsi B
    { wch: 24 }, // Opsi C
    { wch: 24 }, // Opsi D
    { wch: 24 }, // Opsi E
    { wch: 24 }, // Kunci jawaban
    { wch: 38 }, // Pembahasan
    { wch: 28 }, // Kompetensi
    { wch: 12 }, // Bobot poin
    { wch: 22 }, // Referensi gambar
  ];

  const wsStimulus = XLSX.utils.aoa_to_sheet(stimuliRows);
  wsStimulus['!cols'] = [
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
    { wch: 15 },
    { wch: 46 },
    { wch: 22 },
    { wch: 28 },
    { wch: 34 },
    { wch: 22 },
  ];

  const wsIndikator = XLSX.utils.aoa_to_sheet(indicatorRows);
  wsIndikator['!cols'] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 28 },
    { wch: 36 },
    { wch: 48 },
  ];

  const wsGambar = XLSX.utils.aoa_to_sheet(imageRefRows);
  wsGambar['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 52 }, { wch: 38 }];

  XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'PETUNJUK');
  XLSX.utils.book_append_sheet(wb, wsDataSoal, 'DATA SOAL');
  XLSX.utils.book_append_sheet(wb, wsStimulus, 'STIMULUS');
  XLSX.utils.book_append_sheet(wb, wsIndikator, 'INDIKATOR');
  XLSX.utils.book_append_sheet(wb, wsGambar, 'REFERENSI GAMBAR');

  const fileName = `Template_Bank_Soal_TKA_SMART_${subCode}_${total}_Soal.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ---------- Excel Import Parsing & Validation ----------

function normHeader(val: unknown): string {
  return String(val ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function cellStr(val: unknown): string {
  return String(val ?? '').trim();
}

function parseSubject(raw: string): SubjectId | null {
  const s = raw.trim().toLowerCase();
  if (s === 'bahasa indonesia' || s === 'bahasa_indonesia' || s === 'bind' || s === 'bindo') {
    return 'bahasa_indonesia';
  }
  if (s === 'matematika' || s === 'mtk') {
    return 'matematika';
  }
  return null;
}

function parseDifficulty(raw: string): DifficultyLevel | null {
  const s = raw.trim().toLowerCase();
  if (s === 'mudah' || s === 'easy') return 'mudah';
  if (s === 'sedang' || s === 'medium') return 'sedang';
  if (s === 'sulit' || s === 'sukar' || s === 'hard') return 'sukar';
  return null;
}

function parseQuestionType(raw: string): QuestionType | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (s === 'pg' || s === 'pilihan ganda') return 'pg';
  if (
    s === 'pgk multiple answer' ||
    s === 'pgk mcma' ||
    s === 'pgk_mcma' ||
    s === 'pilihan ganda kompleks' ||
    s === 'pgk pilihan jamak' ||
    s === 'mcma'
  ) {
    return 'pgk_mcma';
  }
  if (
    s === 'pgk kategori' ||
    s === 'pgk_kategori' ||
    s === 'pgk benar/salah' ||
    s === 'benar/salah' ||
    s === 'kategori'
  ) {
    return 'pgk_kategori';
  }
  return null;
}

function parseStimulusType(raw: string): StimulusType | null {
  const s = raw.trim().toLowerCase();
  if (s === 'text' || s === 'teks' || s === 'bacaan') return 'text';
  if (s === 'image' || s === 'gambar') return 'image';
  if (s === 'table' || s === 'tabel') return 'table';
  if (s === 'chart' || s === 'grafik') return 'chart';
  if (s === 'diagram') return 'diagram';
  if (s === 'mixed' || s === 'campuran') return 'mixed';
  return null;
}

function isValidImageUrlOrPath(url: string): boolean {
  const u = url.trim();
  if (!u || u.length > 1000) return false;
  return (
    u.startsWith('https://') ||
    u.startsWith('http://') ||
    u.startsWith('/') ||
    u.startsWith('data:image/')
  );
}

function findSheetByName(wb: XLSX.WorkBook, target: string): XLSX.WorkSheet | null {
  const foundName = wb.SheetNames.find(
    (name) => name.trim().toLowerCase() === target.trim().toLowerCase(),
  );
  return foundName ? wb.Sheets[foundName] : null;
}

function sheetToAoa(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    blankrows: false,
  });
}

function parseCategoryAnswerKey(
  raw: string,
  statements: QuestionStatement[],
): { result: Record<string, 'Benar' | 'Salah'> | null; error?: string } {
  const cleaned = raw.trim();
  if (!cleaned) {
    return { result: null, error: 'Kunci jawaban PGK Kategori wajib diisi.' };
  }

  const normalizeBool = (val: string): 'Benar' | 'Salah' | null => {
    const v = val.trim().toLowerCase();
    if (v === 'benar' || v === 'b' || v === 'true' || v === 'ya') return 'Benar';
    if (v === 'salah' || v === 's' || v === 'false' || v === 'tidak') return 'Salah';
    return null;
  };

  const parts = cleaned
    .split(/[;,\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const out: Record<string, 'Benar' | 'Salah'> = {};

  const hasKeyedFormat = parts.some((p) => p.includes(':') || p.includes('='));
  if (hasKeyedFormat) {
    for (const part of parts) {
      const m = part.match(/^([A-Za-z0-9_]+)\s*[:=]\s*(.+)$/);
      if (!m) {
        return {
          result: null,
          error: `Format kunci PGK Kategori "${part}" tidak dikenali. Gunakan format "S1:Benar; S2:Salah".`,
        };
      }
      const keyToken = m[1].trim().toUpperCase();
      const val = normalizeBool(m[2]);
      if (!val) {
        return {
          result: null,
          error: `Nilai kunci "${m[2]}" pada ${keyToken} harus Benar atau Salah.`,
        };
      }
      // Map A->S1, B->S2, 1->S1, S1->S1
      let stmtId = keyToken;
      if (/^[A-E]$/.test(keyToken)) {
        stmtId = `S${keyToken.charCodeAt(0) - 64}`;
      } else if (/^\d+$/.test(keyToken)) {
        stmtId = `S${keyToken}`;
      }
      out[stmtId] = val;
    }
  } else {
    if (parts.length !== statements.length) {
      return {
        result: null,
        error: `Jumlah kunci PGK Kategori (${parts.length}) harus sama dengan jumlah pernyataan (${statements.length}).`,
      };
    }
    for (let idx = 0; idx < statements.length; idx++) {
      const val = normalizeBool(parts[idx]);
      if (!val) {
        return {
          result: null,
          error: `Nilai kunci "${parts[idx]}" harus Benar atau Salah.`,
        };
      }
      out[statements[idx].id] = val;
    }
  }

  for (const st of statements) {
    if (!out[st.id]) {
      return {
        result: null,
        error: `Kunci jawaban untuk pernyataan ${st.id} belum diisi.`,
      };
    }
  }

  return { result: out };
}

export async function parseAndValidateExcelTemplate(
  file: File,
  existingStimuli: Stimulus[],
): Promise<ExcelImportValidationReport> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const workbookErrors: string[] = [];
  const wsPetunjuk = findSheetByName(wb, 'PETUNJUK');
  const wsDataSoal = findSheetByName(wb, 'DATA SOAL');
  const wsStimulus = findSheetByName(wb, 'STIMULUS');
  const wsGambar = findSheetByName(wb, 'REFERENSI GAMBAR');

  if (!wsDataSoal) {
    workbookErrors.push('Sheet wajib "DATA SOAL" tidak ditemukan di dalam file Excel.');
  }

  // Parse optional expected counts from PETUNJUK
  let expectedTotalFromSheet: number | undefined;
  let expectedPg: number | undefined;
  let expectedPgkMcma: number | undefined;
  let expectedPgkKat: number | undefined;

  if (wsPetunjuk) {
    const pRows = sheetToAoa(wsPetunjuk);
    for (const row of pRows) {
      const k = normHeader(row[0]);
      const v = Number(row[1]);
      if (!Number.isFinite(v)) continue;
      if (k === 'total soal') expectedTotalFromSheet = v;
      if (k === 'jumlah pg') expectedPg = v;
      if (k === 'jumlah pgk multiple answer') expectedPgkMcma = v;
      if (k === 'jumlah pgk kategori') expectedPgkKat = v;
    }
  }

  // 1. Parse REFERENSI GAMBAR (Sheet 5)
  const imageRefs: ParsedImageRef[] = [];
  const imageRefMap = new Map<string, ParsedImageRef>();
  let imageRefsValid = true;

  if (wsGambar) {
    const gRows = sheetToAoa(wsGambar);
    if (gRows.length > 0) {
      const headers = gRows[0].map(normHeader);
      const idCol = headers.findIndex((h) => h.includes('id gambar') || h === 'id');
      const descCol = headers.findIndex((h) => h.includes('deskripsi') || h.includes('nama'));
      const urlCol = headers.findIndex((h) => h.includes('url') || h.includes('path'));
      const noteCol = headers.findIndex((h) => h.includes('keterangan'));

      for (let r = 1; r < gRows.length; r++) {
        const row = gRows[r];
        const rawId = cellStr(row[idCol >= 0 ? idCol : 0]);
        const url = cellStr(row[urlCol >= 0 ? urlCol : 2]);
        const desc = cellStr(row[descCol >= 0 ? descCol : 1]);
        const notes = cellStr(row[noteCol >= 0 ? noteCol : 3]);
        if (!rawId && !url && !desc) continue;

        const cleanId = rawId ? sanitizeId(rawId) : '';
        if (!cleanId) {
          workbookErrors.push(`Sheet REFERENSI GAMBAR baris ${r + 1}: ID gambar kosong.`);
          imageRefsValid = false;
          continue;
        }
        const entry: ParsedImageRef = {
          id: cleanId,
          description: desc || cleanId,
          url,
          notes,
          rowNumber: r + 1,
        };
        imageRefs.push(entry);
        imageRefMap.set(cleanId.toUpperCase(), entry);
      }
    }
  }

  // 2. Parse STIMULUS (Sheet 3)
  const existingStimMap = new Map(existingStimuli.map((s) => [s.id.toLowerCase(), s]));
  const stimuliDrafts: ParsedStimulusDraft[] = [];
  const stimuliLookupMap = new Map<string, ParsedStimulusDraft>();

  if (wsStimulus) {
    const sRows = sheetToAoa(wsStimulus);
    if (sRows.length > 0) {
      const headers = sRows[0].map(normHeader);
      const col = (key: string, fallback: number) => {
        const idx = headers.findIndex((h) => h.includes(key));
        return idx >= 0 ? idx : fallback;
      };
      const idCol = col('id stimulus', 0);
      const subjCol = col('mata pelajaran', 1);
      const titleCol = col('judul stimulus', 2);
      const typeCol = col('jenis stimulus', 3);
      const textCol = col('teks bacaan', 4);
      const imgCol = col('referensi gambar', 5);
      const tblCol = col('data tabel', 6);
      const chartCol = col('data grafik', 7);
      const statusCol = col('status', 8);

      for (let r = 1; r < sRows.length; r++) {
        const row = sRows[r];
        const rawId = cellStr(row[idCol]);
        const title = cellStr(row[titleCol]);
        const rawSubj = cellStr(row[subjCol]);
        const rawType = cellStr(row[typeCol]);
        const readingText = cellStr(row[textCol]);
        const rawImgRef = cellStr(row[imgCol]);
        const tableCsv = cellStr(row[tblCol]);
        const chartSpec = cellStr(row[chartCol]);
        const status = cellStr(row[statusCol]);

        if (!rawId && !title && !readingText) continue;

        const rowErrors: string[] = [];
        const cleanId = sanitizeId(rawId);
        const subjectId = parseSubject(rawSubj) || 'bahasa_indonesia';
        const stimulusType = parseStimulusType(rawType) || 'text';
        const existsInDb = existingStimMap.has(cleanId.toLowerCase());

        if (!rawId || !/^[a-zA-Z0-9_\-]+$/.test(cleanId)) {
          rowErrors.push(`Stimulus baris ${r + 1}: ID stimulus tidak valid.`);
        }
        if (title.length < 2) {
          rowErrors.push(`Stimulus "${rawId || r + 1}": Judul stimulus minimal 2 karakter.`);
        }

        let resolvedImgUrl: string | undefined;
        if (rawImgRef) {
          if (isValidImageUrlOrPath(rawImgRef)) {
            resolvedImgUrl = rawImgRef;
          } else {
            const refEntry = imageRefMap.get(rawImgRef.toUpperCase());
            if (!refEntry) {
              rowErrors.push(
                `Stimulus "${cleanId}": Referensi gambar "${rawImgRef}" tidak ditemukan di sheet REFERENSI GAMBAR.`,
              );
              imageRefsValid = false;
            } else if (!isValidImageUrlOrPath(refEntry.url)) {
              rowErrors.push(
                `Stimulus "${cleanId}": URL/path pada REFERENSI GAMBAR "${rawImgRef}" tidak valid.`,
              );
              imageRefsValid = false;
            } else {
              resolvedImgUrl = refEntry.url;
            }
          }
        }

        let tableData: Stimulus['tableData'] | undefined;
        if (tableCsv) {
          const tLines = tableCsv
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => l.split(',').map((c) => c.trim()));
          if (tLines.length >= 2) {
            tableData = { headers: tLines[0], rows: tLines.slice(1) };
          }
        }

        let chartData: Stimulus['chartData'] | undefined;
        if (chartSpec) {
          const parts = chartSpec.split('|').map((p) => p.trim());
          if (parts.length >= 3) {
            const labels = parts[1].split(',').map((x) => x.trim()).filter(Boolean);
            const values = parts[2].split(',').map((x) => Number(x.trim()) || 0);
            if (labels.length > 0) {
              chartData = {
                chartType: 'bar',
                title: parts[0] || title,
                xLabel: 'Kategori',
                yLabel: 'Nilai',
                labels,
                values,
              };
            }
          }
        }

        const draft: ParsedStimulusDraft = {
          id: cleanId,
          subjectId,
          title,
          stimulusType,
          readingText: readingText || undefined,
          imageUrl: resolvedImgUrl,
          imageRef: rawImgRef || undefined,
          tableData,
          chartData,
          isExistingInDb: existsInDb && status.toLowerCase().includes('sudah ada'),
          rowErrors,
        };
        stimuliDrafts.push(draft);
        stimuliLookupMap.set(cleanId.toLowerCase(), draft);
      }
    }
  }

  // 3. Parse DATA SOAL (Sheet 2)
  const questionDrafts: ParsedQuestionDraft[] = [];
  let formatValid = Boolean(wsDataSoal);
  let questionTypesValid = true;
  let answerKeysValid = true;
  let stimulusIdsValid = true;

  const requiredCols = [
    'nomor soal',
    'mata pelajaran',
    'jenis soal',
    'materi',
    'indikator',
    'tingkat kesulitan',
    'jenis media',
    'id stimulus',
    'pertanyaan',
    'opsi a',
    'opsi b',
    'opsi c',
    'opsi d',
    'opsi e',
    'kunci jawaban',
    'pembahasan',
  ];

  if (wsDataSoal) {
    const qRows = sheetToAoa(wsDataSoal);
    if (qRows.length < 2) {
      workbookErrors.push('Sheet "DATA SOAL" belum memiliki baris soal untuk diimpor.');
      formatValid = false;
    } else {
      const headers = qRows[0].map(normHeader);
      const colIndexMap: Record<string, number> = {};
      headers.forEach((h, idx) => {
        colIndexMap[h] = idx;
      });

      const missingCols = requiredCols.filter((c) => colIndexMap[c] === undefined);
      if (missingCols.length > 0) {
        workbookErrors.push(
          `Kolom wajib pada DATA SOAL tidak lengkap: ${missingCols.join(', ')}.`,
        );
        formatValid = false;
      }

      const getCol = (row: unknown[], key: string, fallbackIdx?: number): string => {
        const idx = colIndexMap[key];
        if (idx !== undefined) return cellStr(row[idx]);
        if (fallbackIdx !== undefined) return cellStr(row[fallbackIdx]);
        return '';
      };

      const seenNumbers = new Set<number>();

      for (let r = 1; r < qRows.length; r++) {
        const row = qRows[r];
        const rawNum = getCol(row, 'nomor soal');
        const rawSubj = getCol(row, 'mata pelajaran');
        const rawType = getCol(row, 'jenis soal');
        const rawTopic = getCol(row, 'materi');
        const rawIndicator = getCol(row, 'indikator');
        const rawDiff = getCol(row, 'tingkat kesulitan');
        const rawMedia = getCol(row, 'jenis media');
        const rawStimId = getCol(row, 'id stimulus');
        const rawQText = getCol(row, 'pertanyaan');
        const optA = getCol(row, 'opsi a');
        const optB = getCol(row, 'opsi b');
        const optC = getCol(row, 'opsi c');
        const optD = getCol(row, 'opsi d');
        const optE = getCol(row, 'opsi e');
        const rawKey = getCol(row, 'kunci jawaban');
        const rawExp = getCol(row, 'pembahasan');
        const rawComp = getCol(row, 'kompetensi');
        const rawPoints = getCol(row, 'bobot poin');
        const rawImgRef = getCol(row, 'referensi gambar');

        // Skip completely blank trailing rows
        if (
          !rawNum &&
          !rawQText &&
          !rawTopic &&
          !rawIndicator &&
          !rawKey
        ) {
          continue;
        }

        const rowErrors: string[] = [];

        const qNum = Number(rawNum);
        if (!Number.isInteger(qNum) || qNum < 1) {
          rowErrors.push(`Nomor soal "${rawNum || '-'}" harus berupa bilangan bulat >= 1.`);
        } else if (seenNumbers.has(qNum)) {
          rowErrors.push(`Nomor soal ${qNum} duplikat.`);
        } else {
          seenNumbers.add(qNum);
        }

        const subjectId = parseSubject(rawSubj);
        if (!subjectId) {
          rowErrors.push(
            `Mata pelajaran "${rawSubj || '-'}" tidak valid (gunakan Bahasa Indonesia atau Matematika).`,
          );
        }

        const questionType = parseQuestionType(rawType);
        if (!questionType) {
          rowErrors.push(
            `Jenis soal "${rawType || '-'}" tidak dikenal (gunakan PG, PGK Multiple Answer, atau PGK Kategori).`,
          );
          questionTypesValid = false;
        }

        const difficulty = parseDifficulty(rawDiff);
        if (!difficulty) {
          rowErrors.push(
            `Tingkat kesulitan "${rawDiff || '-'}" tidak valid (gunakan Mudah, Sedang, atau Sulit).`,
          );
        }

        if (!rawTopic) {
          rowErrors.push('Materi wajib diisi.');
        }
        if (!rawIndicator) {
          rowErrors.push('Indikator wajib diisi.');
        }
        if (rawQText.length < 3) {
          rowErrors.push('Pertanyaan wajib diisi (minimal 3 karakter).');
        }

        // Validate ID Stimulus
        let cleanStimId: string | undefined;
        let linkedStimulusHasImage = false;
        if (rawStimId) {
          cleanStimId = sanitizeId(rawStimId);
          const draftStim = stimuliLookupMap.get(cleanStimId.toLowerCase());
          const dbStim = existingStimMap.get(cleanStimId.toLowerCase());
          if (!draftStim && !dbStim) {
            rowErrors.push(
              `ID stimulus "${rawStimId}" tidak ditemukan di sheet STIMULUS maupun Bank Soal.`,
            );
            stimulusIdsValid = false;
          } else {
            if (draftStim && draftStim.rowErrors.length > 0) {
              rowErrors.push(
                `Stimulus "${cleanStimId}" memiliki galat: ${draftStim.rowErrors[0]}`,
              );
              stimulusIdsValid = false;
            }
            linkedStimulusHasImage = Boolean(draftStim?.imageUrl || dbStim?.imageUrl);
          }
        }

        // Media & Image Ref validation
        const mediaTypes = rawMedia
          ? rawMedia
              .split(/[+,/]/)
              .map((m) => m.trim())
              .filter(Boolean)
          : [];
        const expectsImage = mediaTypes.some((m) => m.toLowerCase().includes('gambar'));
        const expectsStimulus = mediaTypes.some((m) =>
          ['teks', 'stimulus', 'tabel', 'grafik', 'diagram'].some((kw) =>
            m.toLowerCase().includes(kw),
          ),
        );

        if (expectsStimulus && !cleanStimId) {
          rowErrors.push(
            `Jenis media "${rawMedia}" memerlukan ID stimulus yang valid.`,
          );
          stimulusIdsValid = false;
        }

        let resolvedImageUrl: string | undefined;
        if (rawImgRef) {
          if (isValidImageUrlOrPath(rawImgRef)) {
            resolvedImageUrl = rawImgRef;
          } else {
            const refEntry = imageRefMap.get(rawImgRef.toUpperCase());
            if (!refEntry) {
              rowErrors.push(
                `Referensi gambar "${rawImgRef}" tidak ditemukan di sheet REFERENSI GAMBAR.`,
              );
              imageRefsValid = false;
            } else if (!isValidImageUrlOrPath(refEntry.url)) {
              rowErrors.push(
                `URL/path gambar pada REFERENSI GAMBAR "${rawImgRef}" belum valid (harus https://, /, atau data:image/).`,
              );
              imageRefsValid = false;
            } else {
              resolvedImageUrl = refEntry.url;
            }
          }
        } else if (expectsImage && !linkedStimulusHasImage) {
          rowErrors.push(
            'Jenis media mencantumkan Gambar, tetapi Referensi gambar belum diisi pada soal maupun stimulus terkait.',
          );
          imageRefsValid = false;
        }

        // Options / Statements & Answer Key validation
        const rawOpts: Array<{ id: string; text: string }> = [
          { id: 'A', text: optA },
          { id: 'B', text: optB },
          { id: 'C', text: optC },
          { id: 'D', text: optD },
          { id: 'E', text: optE },
        ];
        const filledOpts = rawOpts.filter((o) => o.text.length > 0);

        let options: QuestionOption[] | undefined;
        let statements: QuestionStatement[] | undefined;
        let correctOptionId: string | undefined;
        let correctOptionIds: string[] | undefined;
        let correctCategories: Record<string, 'Benar' | 'Salah'> | undefined;

        if (questionType === 'pg') {
          if (filledOpts.length < 2) {
            rowErrors.push('Soal PG minimal harus memiliki 2 pilihan jawaban terisi (mis. Opsi A dan B).');
            answerKeysValid = false;
          } else {
            options = filledOpts.map((o) => ({ id: o.id, label: o.id, text: o.text }));
            const cleanKey = rawKey.trim().toUpperCase();
            const validIds = new Set(options.map((o) => o.id));
            if (!cleanKey || !/^[A-E]$/.test(cleanKey) || !validIds.has(cleanKey)) {
              rowErrors.push(
                `Kunci jawaban PG "${rawKey || '-'}" harus berupa 1 huruf opsi yang terisi (${Array.from(validIds).join('/')}).`,
              );
              answerKeysValid = false;
            } else {
              correctOptionId = cleanKey;
            }
          }
        } else if (questionType === 'pgk_mcma') {
          if (filledOpts.length < 2) {
            rowErrors.push('Soal PGK Multiple Answer minimal harus memiliki 2 pilihan jawaban terisi.');
            answerKeysValid = false;
          } else {
            options = filledOpts.map((o) => ({ id: o.id, label: o.id, text: o.text }));
            const validIds = new Set(options.map((o) => o.id));
            const keys = Array.from(
              new Set(
                rawKey
                  .toUpperCase()
                  .split(/[,;\s]+/)
                  .map((k) => k.trim())
                  .filter(Boolean),
              ),
            );
            if (keys.length === 0 || keys.some((k) => !validIds.has(k))) {
              rowErrors.push(
                `Kunci jawaban PGK Multiple Answer "${rawKey || '-'}" harus berisi minimal 1 huruf opsi valid dipisah koma (mis. A,C).`,
              );
              answerKeysValid = false;
            } else {
              correctOptionIds = keys;
            }
          }
        } else if (questionType === 'pgk_kategori') {
          if (filledOpts.length < 1) {
            rowErrors.push(
              'Soal PGK Kategori minimal harus memiliki 1 pernyataan terisi pada kolom Opsi A–E.',
            );
            answerKeysValid = false;
          } else {
            statements = filledOpts.map((o, idx) => ({
              id: `S${idx + 1}`,
              text: o.text,
            }));
            const parsedCat = parseCategoryAnswerKey(rawKey, statements);
            if (!parsedCat.result) {
              rowErrors.push(parsedCat.error || 'Kunci jawaban PGK Kategori tidak valid.');
              answerKeysValid = false;
            } else {
              correctCategories = parsedCat.result;
            }
          }
        }

        const parsedPoints = Number(rawPoints);
        const points =
          Number.isFinite(parsedPoints) && parsedPoints >= 1 && parsedPoints <= 100
            ? Math.round(parsedPoints)
            : 10;

        questionDrafts.push({
          rowNumber: r + 1,
          questionNumber: Number.isInteger(qNum) && qNum > 0 ? qNum : r,
          subjectId: subjectId || 'bahasa_indonesia',
          questionType: questionType || 'pg',
          topic: rawTopic.slice(0, 120) || 'Umum',
          competency: (rawComp || rawIndicator || rawTopic).slice(0, 200),
          indicator: rawIndicator.slice(0, 250),
          difficulty: difficulty || 'sedang',
          mediaTypes,
          stimulusId: cleanStimId,
          imageRef: rawImgRef || undefined,
          imageUrl: resolvedImageUrl,
          questionText: rawQText.slice(0, 4000),
          options,
          statements,
          correctOptionId,
          correctOptionIds,
          correctCategories,
          points,
          explanation: rawExp.slice(0, 4000),
          rowErrors,
        });
      }
    }
  }

  // Validate expected question counts from PETUNJUK if available
  let totalCountValid = questionDrafts.length > 0 && questionDrafts.length <= 100;
  if (questionDrafts.length > 100) {
    workbookErrors.push(
      `Maksimal 100 soal per sekali impor (ditemukan ${questionDrafts.length} soal).`,
    );
    totalCountValid = false;
  }
  if (
    expectedTotalFromSheet !== undefined &&
    expectedTotalFromSheet > 0 &&
    questionDrafts.length !== expectedTotalFromSheet
  ) {
    workbookErrors.push(
      `Jumlah soal pada DATA SOAL (${questionDrafts.length}) tidak sesuai dengan pengaturan template di PETUNJUK (${expectedTotalFromSheet} soal).`,
    );
    totalCountValid = false;
  }

  if (expectedPg !== undefined && expectedPgkMcma !== undefined && expectedPgkKat !== undefined) {
    const actualPg = questionDrafts.filter((q) => q.questionType === 'pg').length;
    const actualMcma = questionDrafts.filter((q) => q.questionType === 'pgk_mcma').length;
    const actualKat = questionDrafts.filter((q) => q.questionType === 'pgk_kategori').length;
    if (actualPg !== expectedPg || actualMcma !== expectedPgkMcma || actualKat !== expectedPgkKat) {
      workbookErrors.push(
        `Komposisi jenis soal pada DATA SOAL (PG: ${actualPg}, PGK MA: ${actualMcma}, PGK Kategori: ${actualKat}) belum sesuai pengaturan PETUNJUK (PG: ${expectedPg}, PGK MA: ${expectedPgkMcma}, PGK Kategori: ${expectedPgkKat}).`,
      );
      questionTypesValid = false;
    }
  }

  const hasStimulusErrors = stimuliDrafts.some((s) => s.rowErrors.length > 0);
  if (hasStimulusErrors) {
    stimulusIdsValid = false;
  }

  const validQuestionCount = questionDrafts.filter((q) => q.rowErrors.length === 0).length;
  const invalidQuestionCount = questionDrafts.length - validQuestionCount;

  const canConfirmSave =
    workbookErrors.length === 0 &&
    formatValid &&
    questionTypesValid &&
    totalCountValid &&
    answerKeysValid &&
    stimulusIdsValid &&
    imageRefsValid &&
    questionDrafts.length > 0 &&
    invalidQuestionCount === 0;

  return {
    fileName: file.name,
    expectedTotalFromSheet,
    expectedBreakdown:
      expectedPg !== undefined
        ? {
            pg: expectedPg,
            pgkMcma: expectedPgkMcma,
            pgkKategori: expectedPgkKat,
          }
        : undefined,
    workbookErrors,
    checks: {
      formatValid,
      questionTypesValid,
      totalCountValid,
      answerKeysValid,
      stimulusIdsValid,
      imageRefsValid,
    },
    stimuliDrafts,
    imageRefs,
    questionDrafts,
    validQuestionCount,
    invalidQuestionCount,
    canConfirmSave,
  };
}
