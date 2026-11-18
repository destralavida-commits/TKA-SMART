import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Layers,
  Scale,
  Upload,
  X,
} from 'lucide-react';
import {
  generateQuestionTemplateWorkbook,
  parseAndValidateExcelTemplate,
  validateTemplateConfig,
  type ExcelImportValidationReport,
  type TemplateGeneratorConfig,
} from '../../lib/excelTemplateService';
import {
  formatFirestoreErrorMessage,
  sanitizeId,
  saveQuestion,
  saveStimulus,
} from '../../lib/firestoreService';
import { StimulusRenderer } from '../StimulusRenderer';
import type { Question, Stimulus, SubjectId } from '../../types/tka';

interface TemplateGeneratorTabProps {
  questions: Question[];
  stimuli: Stimulus[];
  currentUserUid: string;
  onImportSuccess: (message: string) => void;
}

function PreviewImageWithFallback({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 max-w-sm flex items-center gap-2.5 text-xs text-amber-800">
        <ImageIcon className="w-4 h-4 shrink-0 text-amber-600" />
        <span className="truncate">Pratinjau gambar tidak dapat dimuat ({caption})</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 bg-white max-w-sm">
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full max-h-44 object-contain"
      />
      <div className="px-3 py-1.5 text-[11px] text-slate-500 border-t border-slate-100 flex items-center gap-1.5 truncate">
        <ImageIcon className="w-3 h-3 shrink-0" />
        <span className="truncate">{caption}</span>
      </div>
    </div>
  );
}

export function TemplateGeneratorTab({
  questions,
  stimuli,
  currentUserUid,
  onImportSuccess,
}: TemplateGeneratorTabProps) {
  const [config, setConfig] = useState<TemplateGeneratorConfig>({
    subjectId: 'bahasa_indonesia',
    totalQuestions: 20,
    pgCount: 12,
    pgkMcmaCount: 4,
    pgkKategoriCount: 4,
    mediaImageCount: 4,
    mediaTextCount: 8,
    mediaChartTableDiagramCount: 4,
    difficultyEasyCount: 6,
    difficultyMediumCount: 10,
    difficultyHardCount: 4,
  });

  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parsingExcel, setParsingExcel] = useState(false);
  const [importReport, setImportReport] = useState<ExcelImportValidationReport | null>(null);
  const [savingImport, setSavingImport] = useState(false);
  const [saveImportError, setSaveImportError] = useState<string | null>(null);

  const validation = useMemo(() => validateTemplateConfig(config), [config]);

  const updateNum = (field: keyof TemplateGeneratorConfig, raw: string) => {
    const parsed = raw === '' ? 0 : Math.max(0, Math.floor(Number(raw) || 0));
    setConfig((prev) => ({ ...prev, [field]: parsed }));
    setDownloadNotice(null);
  };

  const applyPresetTotal = (total: number) => {
    const pg = Math.round(total * 0.6);
    const mcma = Math.round(total * 0.2);
    const kat = Math.max(0, total - pg - mcma);
    const easy = Math.round(total * 0.3);
    const med = Math.round(total * 0.5);
    const hard = Math.max(0, total - easy - med);
    setConfig((prev) => ({
      ...prev,
      totalQuestions: total,
      pgCount: pg,
      pgkMcmaCount: mcma,
      pgkKategoriCount: kat,
      difficultyEasyCount: easy,
      difficultyMediumCount: med,
      difficultyHardCount: hard,
      mediaImageCount: Math.min(prev.mediaImageCount, total),
      mediaTextCount: Math.min(prev.mediaTextCount, total),
      mediaChartTableDiagramCount: Math.min(prev.mediaChartTableDiagramCount, total),
    }));
    setDownloadNotice(null);
  };

  const autoBalanceDifficulty = () => {
    const total = Math.max(1, config.totalQuestions);
    const easy = Math.round(total * 0.3);
    const med = Math.round(total * 0.5);
    const hard = Math.max(0, total - easy - med);
    setConfig((prev) => ({
      ...prev,
      difficultyEasyCount: easy,
      difficultyMediumCount: med,
      difficultyHardCount: hard,
    }));
  };

  const handleDownloadTemplate = () => {
    if (!validation.isValid) return;
    setDownloadNotice(null);
    try {
      generateQuestionTemplateWorkbook(config, stimuli, questions);
      const mapel = config.subjectId === 'bahasa_indonesia' ? 'Bahasa Indonesia' : 'Matematika';
      setDownloadNotice(
        `Template Excel (.xlsx) untuk ${config.totalQuestions} soal ${mapel} berhasil dibuat dan diunduh dengan 5 sheet (PETUNJUK, DATA SOAL, STIMULUS, INDIKATOR, REFERENSI GAMBAR).`,
      );
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Gagal membuat file template Excel.');
    }
  };

  const handleExcelFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setSaveImportError(null);
    setParsingExcel(true);
    try {
      const report = await parseAndValidateExcelTemplate(file, stimuli);
      setImportReport(report);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? `Gagal membaca file Excel: ${err.message}`
          : 'File Excel tidak dapat dibaca. Pastikan berformat .xlsx yang valid.',
      );
    } finally {
      setParsingExcel(false);
      e.target.value = '';
    }
  };

  const handleConfirmSaveToBank = async () => {
    if (!importReport || !importReport.canConfirmSave) return;
    setSavingImport(true);
    setSaveImportError(null);

    try {
      const existingStimuliSet = new Set(stimuli.map((s) => s.id.toLowerCase()));
      const batchStamp = Date.now().toString();

      // 1. Save new stimuli from STIMULUS sheet first
      let savedStimCount = 0;
      for (const st of importReport.stimuliDrafts) {
        if (st.isExistingInDb || existingStimuliSet.has(st.id.toLowerCase())) {
          continue;
        }
        await saveStimulus({
          id: st.id,
          subjectId: st.subjectId,
          title: st.title,
          stimulusType: st.stimulusType,
          readingText: st.readingText,
          imageUrl: st.imageUrl,
          tableData: st.tableData,
          chartData: st.chartData,
          createdBy: currentUserUid,
        });
        existingStimuliSet.add(st.id.toLowerCase());
        savedStimCount += 1;
      }

      // 2. Save validated questions into centralized question_bank
      let savedQuestionCount = 0;
      for (const q of importReport.questionDrafts) {
        const prefix = q.subjectId === 'bahasa_indonesia' ? 'bindo' : 'mtk';
        const qId = sanitizeId(`q_${prefix}_${batchStamp}_${q.questionNumber}`);
        await saveQuestion({
          id: qId,
          subjectId: q.subjectId,
          topic: q.topic,
          competency: q.competency,
          indicator: q.indicator,
          difficulty: q.difficulty,
          questionType: q.questionType,
          stimulusId: q.stimulusId,
          questionText: q.questionText,
          imageUrl: q.imageUrl,
          options: q.options,
          statements: q.statements,
          correctOptionId: q.correctOptionId,
          correctOptionIds: q.correctOptionIds,
          correctCategories: q.correctCategories,
          pgkScoringRule: q.questionType === 'pg' ? 'all_or_nothing' : 'partial_proportional',
          points: q.points,
          explanation: q.explanation,
          createdBy: currentUserUid,
        });
        savedQuestionCount += 1;
      }

      setImportReport(null);
      onImportSuccess(
        `Berhasil mengimpor ${savedQuestionCount} soal${
          savedStimCount > 0 ? ` dan ${savedStimCount} stimulus baru` : ''
        } dari Excel ke Bank Soal Terpusat.`,
      );
    } catch (err) {
      setSaveImportError(
        formatFirestoreErrorMessage(err, 'Gagal menyimpan hasil impor Excel ke Firestore.'),
      );
    } finally {
      setSavingImport(false);
    }
  };

  const importedStimuliMap = useMemo(() => {
    const map = new Map<string, Stimulus>();
    for (const s of stimuli) {
      map.set(s.id.toLowerCase(), s);
    }
    if (importReport) {
      for (const st of importReport.stimuliDrafts) {
        if (!map.has(st.id.toLowerCase())) {
          map.set(st.id.toLowerCase(), {
            id: st.id,
            subjectId: st.subjectId,
            title: st.title,
            stimulusType: st.stimulusType,
            readingText: st.readingText,
            imageUrl: st.imageUrl,
            tableData: st.tableData,
            chartData: st.chartData,
            createdBy: currentUserUid,
          });
        }
      }
    }
    return map;
  }, [stimuli, importReport, currentUserUid]);

  return (
    <div className="space-y-6">
      {/* Main 2-column Config & Download/Upload Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Generator Configuration */}
        <div className="lg:col-span-7 neu-surface p-6 space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl neu-well-indigo flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1E1B4B]">
                  Generator Template Soal (.xlsx)
                </h3>
                <p className="text-xs text-slate-600">
                  Susun komposisi jenis soal, tingkat kesulitan, dan atribut media sebelum mengunduh template Excel.
                </p>
              </div>
            </div>
          </div>

          {/* 1. Mata Pelajaran & 2. Total Soal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#1E1B4B] mb-2">
                1. Mata Pelajaran
              </label>
              <div className="neu-inset p-1.5 grid grid-cols-2 gap-1.5">
                {(['bahasa_indonesia', 'matematika'] as SubjectId[]).map((subj) => {
                  const active = config.subjectId === subj;
                  return (
                    <button
                      key={subj}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({ ...prev, subjectId: subj }))
                      }
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                        active
                          ? 'neu-btn-primary shadow-sm'
                          : 'text-slate-600 hover:text-[#1E1B4B]'
                      }`}
                    >
                      {subj === 'bahasa_indonesia' ? 'Bahasa Indonesia' : 'Matematika'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="gen-total-soal"
                className="block text-xs font-bold text-[#1E1B4B] mb-2"
              >
                2. Total Jumlah Soal (1–100)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="gen-total-soal"
                  type="number"
                  min={1}
                  max={100}
                  value={config.totalQuestions}
                  onChange={(e) => updateNum('totalQuestions', e.target.value)}
                  className="neu-input w-24 px-3 py-2 rounded-xl text-sm font-mono-tabular font-bold text-[#1E1B4B]"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[10, 20, 30, 40].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyPresetTotal(preset)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-tabular font-semibold transition-colors ${
                        config.totalQuestions === preset
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'neu-btn-soft text-slate-700'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3-5. Jenis Soal */}
          <div className="neu-inset p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#1E1B4B]">
                3. Komposisi Jenis Soal (Wajib = Total Soal)
              </span>
              <span
                className={`text-xs font-mono-tabular font-bold ${
                  validation.typeSum === config.totalQuestions
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                }`}
              >
                {validation.typeSum} / {config.totalQuestions} soal
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="gen-pg"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Pilihan Ganda (PG)
                </label>
                <input
                  id="gen-pg"
                  type="number"
                  min={0}
                  max={100}
                  value={config.pgCount}
                  onChange={(e) => updateNum('pgCount', e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label
                  htmlFor="gen-pgk-mcma"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  PGK Multiple Answer
                </label>
                <input
                  id="gen-pgk-mcma"
                  type="number"
                  min={0}
                  max={100}
                  value={config.pgkMcmaCount}
                  onChange={(e) => updateNum('pgkMcmaCount', e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label
                  htmlFor="gen-pgk-kat"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  PGK Kategori (B/S)
                </label>
                <input
                  id="gen-pgk-kat"
                  type="number"
                  min={0}
                  max={100}
                  value={config.pgkKategoriCount}
                  onChange={(e) => updateNum('pgkKategoriCount', e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular"
                />
              </div>
            </div>
          </div>

          {/* 6-8. Atribut Media */}
          <div className="neu-inset p-4 space-y-3">
            <div>
              <span className="text-xs font-bold text-[#1E1B4B]">
                4. Atribut Media Soal (Tidak Menambah Total Soal)
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Kategori gambar, teks bacaan/stimulus, serta tabel/grafik/diagram bersifat atribut; satu soal dapat memiliki lebih dari satu media sekaligus.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="gen-media-img"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Menggunakan Gambar
                </label>
                <input
                  id="gen-media-img"
                  type="number"
                  min={0}
                  max={config.totalQuestions}
                  value={config.mediaImageCount}
                  onChange={(e) => updateNum('mediaImageCount', e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label
                  htmlFor="gen-media-text"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Teks Bacaan / Stimulus
                </label>
                <input
                  id="gen-media-text"
                  type="number"
                  min={0}
                  max={config.totalQuestions}
                  value={config.mediaTextCount}
                  onChange={(e) => updateNum('mediaTextCount', e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label
                  htmlFor="gen-media-data"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Tabel / Grafik / Diagram
                </label>
                <input
                  id="gen-media-data"
                  type="number"
                  min={0}
                  max={config.totalQuestions}
                  value={config.mediaChartTableDiagramCount}
                  onChange={(e) => updateNum('mediaChartTableDiagramCount', e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular"
                />
              </div>
            </div>
          </div>

          {/* 9. Tingkat Kesulitan */}
          <div className="neu-inset p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#1E1B4B]">
                5. Komposisi Tingkat Kesulitan
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={autoBalanceDifficulty}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Bagi Proporsional</span>
                </button>
                <span
                  className={`text-xs font-mono-tabular font-bold ${
                    validation.difficultySum === config.totalQuestions
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}
                >
                  {validation.difficultySum} / {config.totalQuestions} soal
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="gen-diff-easy"
                  className="block text-xs font-semibold text-emerald-700 mb-1"
                >
                  Mudah
                </label>
                <input
                  id="gen-diff-easy"
                  type="number"
                  min={0}
                  max={100}
                  value={config.difficultyEasyCount}
                  onChange={(e) => updateNum('difficultyEasyCount', e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label
                  htmlFor="gen-diff-med"
                  className="block text-xs font-semibold text-amber-700 mb-1"
                >
                  Sedang
                </label>
                <input
                  id="gen-diff-med"
                  type="number"
                  min={0}
                  max={100}
                  value={config.difficultyMediumCount}
                  onChange={(e) => updateNum('difficultyMediumCount', e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label
                  htmlFor="gen-diff-hard"
                  className="block text-xs font-semibold text-rose-700 mb-1"
                >
                  Sulit
                </label>
                <input
                  id="gen-diff-hard"
                  type="number"
                  min={0}
                  max={100}
                  value={config.difficultyHardCount}
                  onChange={(e) => updateNum('difficultyHardCount', e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Validation + Download & Import Cards */}
        <div className="lg:col-span-5 space-y-6">
          {/* Validation & Download Panel */}
          <div className="neu-surface p-6 space-y-4">
            <h4 className="text-sm font-bold text-[#1E1B4B]">
              Validasi Otomatis &amp; Unduh Template
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200/70">
                <span className="text-slate-600">PG + PGK MA + PGK Kategori</span>
                <span
                  className={`font-mono-tabular font-bold flex items-center gap-1 ${
                    validation.typeSum === config.totalQuestions
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}
                >
                  {validation.typeSum === config.totalQuestions ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5" />
                  )}
                  {validation.typeSum} / {config.totalQuestions}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-200/70">
                <span className="text-slate-600">Mudah + Sedang + Sulit</span>
                <span
                  className={`font-mono-tabular font-bold flex items-center gap-1 ${
                    validation.difficultySum === config.totalQuestions
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}
                >
                  {validation.difficultySum === config.totalQuestions ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5" />
                  )}
                  {validation.difficultySum} / {config.totalQuestions}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-600">Atribut Media</span>
                <span className="font-mono-tabular font-semibold text-indigo-700">
                  Gbr {config.mediaImageCount} · Teks {config.mediaTextCount} · Visual {config.mediaChartTableDiagramCount}
                </span>
              </div>
            </div>

            {!validation.isValid && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 space-y-1">
                {validation.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="neu-inset p-3.5 text-xs text-slate-600 space-y-1">
              <div className="font-bold text-[#1E1B4B]">Struktur 5 Sheet Excel (.xlsx):</div>
              <div>1. PETUNJUK · 2. DATA SOAL · 3. STIMULUS</div>
              <div>4. INDIKATOR · 5. REFERENSI GAMBAR</div>
            </div>

            {downloadNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{downloadNotice}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={!validation.isValid}
              className="neu-btn-primary w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD TEMPLATE</span>
            </button>
          </div>

          {/* Import Excel Panel */}
          <div className="neu-surface p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl neu-well-emerald flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1E1B4B]">
                  Impor Template Excel Terisi
                </h4>
                <p className="text-xs text-slate-600">
                  Validasi format, jenis soal, jumlah soal, kunci jawaban, ID stimulus, dan referensi gambar sebelum disimpan ke bank soal terpusat.
                </p>
              </div>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            <label className="neu-btn-soft w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-indigo-700 cursor-pointer">
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>
                {parsingExcel
                  ? 'Memvalidasi File Excel...'
                  : 'Upload Template Excel (.xlsx)'}
              </span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelFileSelected}
                disabled={parsingExcel}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Full Preview & Validation Modal Before Confirming Import */}
      {importReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-modal max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200/70 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-[#1E1B4B] truncate">
                  Pratinjau &amp; Validasi Impor Excel: {importReport.fileName}
                </h3>
                <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2 mt-0.5 font-mono-tabular">
                  <span>{importReport.questionDrafts.length} soal terbaca</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-700 font-semibold">
                    {importReport.validQuestionCount} valid
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      importReport.invalidQuestionCount > 0
                        ? 'text-rose-600 font-bold'
                        : 'text-slate-500'
                    }
                  >
                    {importReport.invalidQuestionCount} bermasalah
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {importReport.stimuliDrafts.filter((s) => !s.isExistingInDb).length} stimulus baru
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportReport(null)}
                className="neu-btn-soft p-2 rounded-xl text-slate-600 shrink-0"
                aria-label="Tutup pratinjau"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* 6-point Automated Checklist */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {[
                  { label: 'Format Sheet', ok: importReport.checks.formatValid },
                  { label: 'Jenis Soal', ok: importReport.checks.questionTypesValid },
                  { label: 'Jumlah Soal', ok: importReport.checks.totalCountValid },
                  { label: 'Kunci Jawaban', ok: importReport.checks.answerKeysValid },
                  { label: 'ID Stimulus', ok: importReport.checks.stimulusIdsValid },
                  { label: 'Ref. Gambar', ok: importReport.checks.imageRefsValid },
                ].map((chk) => (
                  <div
                    key={chk.label}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                      chk.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {chk.ok ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                    )}
                    <span className="truncate">{chk.label}</span>
                  </div>
                ))}
              </div>

              {importReport.workbookErrors.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 space-y-1.5">
                  <div className="font-bold text-rose-800">
                    Kesalahan Struktur / Komposisi Workbook:
                  </div>
                  {importReport.workbookErrors.map((err, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              {saveImportError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{saveImportError}</span>
                </div>
              )}

              {/* Preview List of All Parsed Questions */}
              <div className="space-y-4">
                {importReport.questionDrafts.length === 0 ? (
                  <div className="neu-inset p-8 text-center text-sm text-slate-500">
                    Tidak ada baris soal yang dapat dipratinjau.
                  </div>
                ) : (
                  importReport.questionDrafts.map((q) => {
                    const stim = q.stimulusId
                      ? importedStimuliMap.get(q.stimulusId.toLowerCase())
                      : undefined;
                    const hasErrors = q.rowErrors.length > 0;
                    return (
                      <div
                        key={`${q.rowNumber}-${q.questionNumber}`}
                        className={`p-5 rounded-2xl border space-y-3 ${
                          hasErrors
                            ? 'bg-rose-50/70 border-rose-300'
                            : 'neu-surface-sm border-white/80'
                        }`}
                      >
                        {/* Meta Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2 text-slate-600">
                            <span className="font-mono-tabular font-bold text-[#1E1B4B]">
                              Soal #{q.questionNumber}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-bold text-indigo-700">
                              {q.subjectId === 'bahasa_indonesia'
                                ? 'Bahasa Indonesia'
                                : 'Matematika'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-violet-700">
                              {q.questionType === 'pg'
                                ? 'PG'
                                : q.questionType === 'pgk_mcma'
                                  ? 'PGK Multiple Answer'
                                  : 'PGK Kategori'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize font-semibold text-slate-700">
                              {q.difficulty === 'sukar' ? 'Sulit' : q.difficulty}
                            </span>
                            {q.mediaTypes.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-cyan-700 font-medium">
                                  Media: {q.mediaTypes.join(' + ')}
                                </span>
                              </>
                            )}
                          </div>

                          <span
                            className={`font-semibold flex items-center gap-1 ${
                              hasErrors ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {hasErrors ? (
                              <>
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>Baris {q.rowNumber} Perlu Diperbaiki</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Siap Impor</span>
                              </>
                            )}
                          </span>
                        </div>

                        {hasErrors && (
                          <div className="p-3 rounded-xl bg-white border border-rose-200 text-xs text-rose-700 space-y-1">
                            {q.rowErrors.map((err, i) => (
                              <div key={i}>• {err}</div>
                            ))}
                          </div>
                        )}

                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                          <span>Materi: {q.topic || '-'}</span>
                          <span aria-hidden="true">·</span>
                          <span>Indikator: {q.indicator || '-'}</span>
                          {q.stimulusId && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular font-semibold text-indigo-700 inline-flex items-center gap-1">
                                <Layers className="w-3 h-3" />
                                Stimulus: {q.stimulusId}
                              </span>
                            </>
                          )}
                        </div>

                        {stim && (
                          <div className="neu-inset p-3.5">
                            <StimulusRenderer stimulus={stim} compact />
                          </div>
                        )}

                        {q.imageUrl && (
                          <PreviewImageWithFallback
                            src={q.imageUrl}
                            alt={`Gambar soal ${q.questionNumber}`}
                            caption={q.imageRef || q.imageUrl}
                          />
                        )}

                        <p className="text-sm font-medium text-[#1E1B4B] leading-relaxed">
                          {q.questionText || '(Pertanyaan kosong)'}
                        </p>

                        {(q.questionType === 'pg' || q.questionType === 'pgk_mcma') &&
                          q.options && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map((opt) => {
                                const isKey =
                                  q.questionType === 'pg'
                                    ? q.correctOptionId === opt.id
                                    : q.correctOptionIds?.includes(opt.id);
                                return (
                                  <div
                                    key={opt.id}
                                    className={`px-3 py-2 rounded-xl text-xs flex items-center gap-2 ${
                                      isKey
                                        ? 'bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold'
                                        : 'bg-white border border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <span className="font-mono-tabular">{opt.id}.</span>
                                    <span>{opt.text}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                        {q.questionType === 'pgk_kategori' && q.statements && (
                          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50 text-slate-700">
                                <tr>
                                  <th className="text-left px-3 py-2">Pernyataan</th>
                                  <th className="text-right px-3 py-2">Kunci</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {q.statements.map((st) => (
                                  <tr key={st.id}>
                                    <td className="px-3 py-2 text-slate-700">{st.text}</td>
                                    <td className="px-3 py-2 text-right font-bold text-emerald-700">
                                      {q.correctCategories?.[st.id] || '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {q.explanation && (
                          <div className="text-xs text-slate-600 flex items-start gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-500" />
                            <span>
                              <strong className="text-[#1E1B4B]">Pembahasan:</strong>{' '}
                              {q.explanation}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200/70 bg-white/75 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                {importReport.canConfirmSave
                  ? 'Seluruh validasi lolos. Soal akan masuk ke Bank Soal Terpusat untuk kedua sekolah.'
                  : 'Perbaiki terlebih dahulu kesalahan di file Excel lalu unggah ulang sebelum menyimpan.'}
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setImportReport(null)}
                  disabled={savingImport}
                  className="neu-btn-soft px-4 py-2 rounded-xl text-sm font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaveToBank}
                  disabled={!importReport.canConfirmSave || savingImport}
                  className="neu-btn-primary inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {savingImport
                      ? 'Menyimpan ke Firestore...'
                      : `Simpan ${importReport.validQuestionCount} Soal ke Bank Soal`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
