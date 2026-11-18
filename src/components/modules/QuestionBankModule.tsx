import React, { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Layers,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { TemplateGeneratorTab } from './TemplateGeneratorTab';
import {
  deleteQuestion,
  deleteStimulus,
  saveQuestion,
  saveStimulus,
  uploadAssetImage,
} from '../../lib/firestoreService';
import { downloadJson } from '../../lib/exportUtils';
import { StimulusRenderer } from '../StimulusRenderer';
import type {
  DifficultyLevel,
  PgkScoringRule,
  Question,
  QuestionOption,
  QuestionStatement,
  QuestionType,
  Stimulus,
  StimulusType,
  SubjectId,
} from '../../types/tka';

interface QuestionBankModuleProps {
  questions: Question[];
  stimuli: Stimulus[];
  currentUserUid: string;
}

const DEFAULT_TOPICS: Record<SubjectId, string[]> = {
  bahasa_indonesia: [
    'Memahami Teks Informasi',
    'Menyimpulkan Ide Pokok & Makna Tersirat',
    'Menafsirkan Data Tabel & Infografik',
    'Kosakata Baku & Struktur Kalimat',
  ],
  matematika: [
    'Operasi Bilangan & Pecahan',
    'Bangun Datar & Pengukuran',
    'Debit, Kecepatan & Perbandingan',
    'Pengolahan Data & Diagram',
  ],
};

export function QuestionBankModule({
  questions,
  stimuli,
  currentUserUid,
}: QuestionBankModuleProps) {
  const [activeTab, setActiveTab] = useState<'questions' | 'stimuli' | 'template_generator'>('questions');
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<'ALL' | SubjectId>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | QuestionType>('ALL');
  const [diffFilter, setDiffFilter] = useState<'ALL' | DifficultyLevel>('ALL');
  const [stimulusFilter, setStimulusFilter] = useState<string>('ALL');

  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  const [showStimulusForm, setShowStimulusForm] = useState(false);
  const [editingStimulus, setEditingStimulus] = useState<Stimulus | null>(null);

  // Question form state
  const [qSubject, setQSubject] = useState<SubjectId>('bahasa_indonesia');
  const [qTopic, setQTopic] = useState(DEFAULT_TOPICS.bahasa_indonesia[0]);
  const [qCompetency, setQCompetency] = useState('');
  const [qIndicator, setQIndicator] = useState('');
  const [qDiff, setQDiff] = useState<DifficultyLevel>('sedang');
  const [qType, setQType] = useState<QuestionType>('pg');
  const [qStimulusId, setQStimulusId] = useState('');
  const [qText, setQText] = useState('');
  const [qImageUrl, setQImageUrl] = useState('');
  const [qOptions, setQOptions] = useState<QuestionOption[]>([
    { id: 'A', label: 'A', text: '' },
    { id: 'B', label: 'B', text: '' },
    { id: 'C', label: 'C', text: '' },
    { id: 'D', label: 'D', text: '' },
  ]);
  const [qCorrectOptionId, setQCorrectOptionId] = useState('A');
  const [qCorrectOptionIds, setQCorrectOptionIds] = useState<string[]>(['A', 'B']);
  const [qStatements, setQStatements] = useState<QuestionStatement[]>([
    { id: 'S1', text: '' },
    { id: 'S2', text: '' },
    { id: 'S3', text: '' },
  ]);
  const [qCorrectCategories, setQCorrectCategories] = useState<Record<string, 'Benar' | 'Salah'>>({
    S1: 'Benar',
    S2: 'Benar',
    S3: 'Salah',
  });
  const [qPgkRule, setQPgkRule] = useState<PgkScoringRule>('partial_proportional');
  const [qPoints, setQPoints] = useState(10);
  const [qExplanation, setQExplanation] = useState('');
  const [qUploading, setQUploading] = useState(false);

  // Stimulus form state
  const [sSubject, setSSubject] = useState<SubjectId>('bahasa_indonesia');
  const [sTitle, setSTitle] = useState('');
  const [sType, setSType] = useState<StimulusType>('text');
  const [sReadingText, setSReadingText] = useState('');
  const [sImageUrl, setSImageUrl] = useState('');
  const [sTableCsv, setSTableCsv] = useState('Bulan,Jumlah\nJanuari,40\nFebruari,55');
  const [sChartTitle, setSChartTitle] = useState('Grafik Data Sekolah');
  const [sChartLabels, setSChartLabels] = useState('Kelas A,Kelas B,Kelas C');
  const [sChartValues, setSChartValues] = useState('30,45,35');
  const [sUploading, setSUploading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const stimuliMap = useMemo(
    () => Object.fromEntries(stimuli.map((s) => [s.id, s])),
    [stimuli],
  );

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (subjectFilter !== 'ALL' && q.subjectId !== subjectFilter) return false;
      if (typeFilter !== 'ALL' && q.questionType !== typeFilter) return false;
      if (diffFilter !== 'ALL' && q.difficulty !== diffFilter) return false;
      if (stimulusFilter !== 'ALL' && (q.stimulusId || 'NONE') !== stimulusFilter) return false;
      if (searchQuery) {
        const s = searchQuery.toLowerCase();
        return (
          q.questionText.toLowerCase().includes(s) ||
          q.topic.toLowerCase().includes(s) ||
          q.indicator.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [questions, subjectFilter, typeFilter, diffFilter, stimulusFilter, searchQuery]);

  const filteredStimuli = useMemo(() => {
    return stimuli.filter((st) => {
      if (subjectFilter !== 'ALL' && st.subjectId !== subjectFilter) return false;
      if (searchQuery && !st.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [stimuli, subjectFilter, searchQuery]);

  const openNewQuestion = () => {
    setEditingQuestion(null);
    setQSubject('bahasa_indonesia');
    setQTopic(DEFAULT_TOPICS.bahasa_indonesia[0]);
    setQCompetency('');
    setQIndicator('');
    setQDiff('sedang');
    setQType('pg');
    setQStimulusId('');
    setQText('');
    setQImageUrl('');
    setQOptions([
      { id: 'A', label: 'A', text: '' },
      { id: 'B', label: 'B', text: '' },
      { id: 'C', label: 'C', text: '' },
      { id: 'D', label: 'D', text: '' },
    ]);
    setQCorrectOptionId('A');
    setQCorrectOptionIds(['A', 'B']);
    setQStatements([
      { id: 'S1', text: '' },
      { id: 'S2', text: '' },
      { id: 'S3', text: '' },
    ]);
    setQCorrectCategories({ S1: 'Benar', S2: 'Benar', S3: 'Salah' });
    setQPgkRule('partial_proportional');
    setQPoints(10);
    setQExplanation('');
    setFormError(null);
    setShowQuestionForm(true);
  };

  const openEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setQSubject(q.subjectId);
    setQTopic(q.topic);
    setQCompetency(q.competency);
    setQIndicator(q.indicator);
    setQDiff(q.difficulty);
    setQType(q.questionType);
    setQStimulusId(q.stimulusId || '');
    setQText(q.questionText);
    setQImageUrl(q.imageUrl || '');
    setQOptions(
      q.options?.length
        ? q.options
        : [
            { id: 'A', label: 'A', text: '' },
            { id: 'B', label: 'B', text: '' },
            { id: 'C', label: 'C', text: '' },
            { id: 'D', label: 'D', text: '' },
          ],
    );
    setQCorrectOptionId(q.correctOptionId || 'A');
    setQCorrectOptionIds(q.correctOptionIds || ['A']);
    setQStatements(
      q.statements?.length
        ? q.statements
        : [
            { id: 'S1', text: '' },
            { id: 'S2', text: '' },
          ],
    );
    setQCorrectCategories(q.correctCategories || { S1: 'Benar', S2: 'Salah' });
    setQPgkRule(q.pgkScoringRule || 'partial_proportional');
    setQPoints(q.points || 10);
    setQExplanation(q.explanation || '');
    setFormError(null);
    setShowQuestionForm(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (qText.trim().length < 3 || !qCompetency.trim() || !qIndicator.trim()) {
      setFormError('Pertanyaan, kompetensi, dan indikator wajib diisi.');
      return;
    }

    if (qType === 'pg' || qType === 'pgk_mcma') {
      const filled = qOptions.filter((o) => o.text.trim().length > 0);
      if (filled.length < 2) {
        setFormError('Minimal 2 pilihan jawaban harus diisi.');
        return;
      }
      if (qType === 'pgk_mcma' && qCorrectOptionIds.length === 0) {
        setFormError('Pilih minimal 1 kunci jawaban benar untuk soal PGK MCMA.');
        return;
      }
    } else {
      const filledSt = qStatements.filter((s) => s.text.trim().length > 0);
      if (filledSt.length < 1) {
        setFormError('Minimal 1 pernyataan wajib diisi untuk soal PGK Kategori.');
        return;
      }
    }

    setSaving(true);
    try {
      const id = editingQuestion?.id || `q_${qSubject === 'bahasa_indonesia' ? 'bindo' : 'mtk'}_${Date.now()}`;
      const questionPayload: Question = {
        id,
        subjectId: qSubject,
        topic: qTopic.trim() || 'Umum',
        competency: qCompetency.trim(),
        indicator: qIndicator.trim(),
        difficulty: qDiff,
        questionType: qType,
        stimulusId: qStimulusId || undefined,
        questionText: qText.trim(),
        imageUrl: qImageUrl.trim() || undefined,
        options:
          qType === 'pg' || qType === 'pgk_mcma'
            ? qOptions.filter((o) => o.text.trim().length > 0)
            : undefined,
        statements:
          qType === 'pgk_kategori'
            ? qStatements.filter((s) => s.text.trim().length > 0)
            : undefined,
        correctOptionId: qType === 'pg' ? qCorrectOptionId : undefined,
        correctOptionIds: qType === 'pgk_mcma' ? qCorrectOptionIds : undefined,
        correctCategories: qType === 'pgk_kategori' ? qCorrectCategories : undefined,
        pgkScoringRule: qPgkRule,
        points: Number(qPoints) || 10,
        explanation: qExplanation.trim(),
        createdBy: editingQuestion?.createdBy || currentUserUid,
        createdAt: editingQuestion?.createdAt,
      };
      await saveQuestion(questionPayload);
      setShowQuestionForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan soal.');
    } finally {
      setSaving(false);
    }
  };

  const openNewStimulus = () => {
    setEditingStimulus(null);
    setSSubject('bahasa_indonesia');
    setSTitle('');
    setSType('text');
    setSReadingText('');
    setSImageUrl('');
    setSTableCsv('Bulan,Jumlah\nJanuari,40\nFebruari,55');
    setSChartTitle('Grafik Data Sekolah');
    setSChartLabels('Data 1,Data 2,Data 3');
    setSChartValues('25,40,35');
    setFormError(null);
    setShowStimulusForm(true);
  };

  const openEditStimulus = (st: Stimulus) => {
    setEditingStimulus(st);
    setSSubject(st.subjectId);
    setSTitle(st.title);
    setSType(st.stimulusType);
    setSReadingText(st.readingText || '');
    setSImageUrl(st.imageUrl || '');
    if (st.tableData) {
      const lines = [
        st.tableData.headers.join(','),
        ...st.tableData.rows.map((r) => r.join(',')),
      ];
      setSTableCsv(lines.join('\n'));
    }
    if (st.chartData) {
      setSChartTitle(st.chartData.title);
      setSChartLabels(st.chartData.labels.join(','));
      setSChartValues(st.chartData.values.join(','));
    }
    setFormError(null);
    setShowStimulusForm(true);
  };

  const handleSaveStimulus = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (sTitle.trim().length < 2) {
      setFormError('Judul stimulus wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      const id = editingStimulus?.id || `stim_${Date.now()}`;
      let tableData: Stimulus['tableData'] | undefined;
      if (sType === 'table' || sType === 'mixed') {
        const rows = sTableCsv
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => l.split(',').map((c) => c.trim()));
        if (rows.length >= 2 && sType === 'table') {
          tableData = { headers: rows[0], rows: rows.slice(1) };
        }
      }

      let chartData: Stimulus['chartData'] | undefined;
      if (sType === 'chart') {
        const labels = sChartLabels.split(',').map((x) => x.trim()).filter(Boolean);
        const values = sChartValues.split(',').map((x) => Number(x.trim()) || 0);
        if (labels.length > 0) {
          chartData = {
            chartType: 'bar',
            title: sChartTitle.trim() || sTitle.trim(),
            xLabel: 'Kategori',
            yLabel: 'Nilai',
            labels,
            values,
          };
        }
      }

      await saveStimulus({
        id,
        subjectId: sSubject,
        title: sTitle.trim(),
        stimulusType: sType,
        readingText: sReadingText.trim() || undefined,
        imageUrl: sImageUrl.trim() || undefined,
        tableData,
        chartData,
        createdBy: editingStimulus?.createdBy || currentUserUid,
        createdAt: editingStimulus?.createdAt,
      });
      setShowStimulusForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan stimulus.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportQuestions = () => {
    downloadJson('tka_smart_bank_soal', {
      exportedAt: new Date().toISOString(),
      stimuli,
      questions,
    });
  };

  const handleImportQuestions = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportNotice(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        stimuli?: Stimulus[];
        questions?: Question[];
      };
      let count = 0;
      for (const st of parsed.stimuli || []) {
        await saveStimulus({ ...st, createdBy: currentUserUid });
      }
      for (const q of parsed.questions || []) {
        await saveQuestion({ ...q, createdBy: currentUserUid });
        count += 1;
      }
      setImportNotice(`Berhasil mengimpor ${count} butir soal ke bank soal terpusat.`);
    } catch {
      setImportNotice('Format file JSON tidak valid untuk impor bank soal.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#1E1B4B]">
            Bank Soal Terpusat (Bahasa Indonesia &amp; Matematika)
          </h2>
          <p className="text-sm text-slate-600">
            Satu bank soal bersama untuk kedua sekolah. Satu stimulus dapat digunakan oleh beberapa soal sekaligus.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportQuestions}
            className="neu-btn-soft inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Ekspor JSON</span>
          </button>
          <label className="neu-btn-soft inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>Impor JSON</span>
            <input type="file" accept=".json" onChange={handleImportQuestions} className="hidden" />
          </label>
          <button
            type="button"
            onClick={() => setActiveTab('template_generator')}
            className="neu-btn-soft inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-indigo-700"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Generator Template</span>
          </button>
          <button
            type="button"
            onClick={openNewStimulus}
            className="neu-btn-soft inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-indigo-700"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tambah Stimulus</span>
          </button>
          <button
            type="button"
            onClick={openNewQuestion}
            className="neu-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Soal</span>
          </button>
        </div>
      </div>

      {importNotice && (
        <div className="neu-surface-sm p-3.5 text-sm font-medium text-[#1E1B4B]">
          {importNotice}
        </div>
      )}

      {/* Segmented Tabs + Filters */}
      <div className="neu-surface p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="neu-inset inline-flex flex-wrap items-center gap-1 p-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('questions')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'questions'
                  ? 'neu-btn-primary shadow-sm'
                  : 'text-slate-600 hover:text-[#1E1B4B]'
              }`}
            >
              Daftar Soal ({questions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stimuli')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'stimuli'
                  ? 'neu-btn-primary shadow-sm'
                  : 'text-slate-600 hover:text-[#1E1B4B]'
              }`}
            >
              Kelompok Stimulus ({stimuli.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('template_generator')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                activeTab === 'template_generator'
                  ? 'neu-btn-primary shadow-sm'
                  : 'text-slate-600 hover:text-[#1E1B4B]'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Generator Template Soal</span>
            </button>
          </div>

          {activeTab !== 'template_generator' && (
            <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Search className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari teks soal, materi, indikator..."
                  className="neu-input w-full pl-9 pr-3 py-1.5 rounded-xl text-sm"
                />
              </div>

              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value as 'ALL' | SubjectId)}
                className="neu-input px-3 py-1.5 rounded-xl text-xs font-medium"
              >
                <option value="ALL">Semua Mapel</option>
                <option value="bahasa_indonesia">Bahasa Indonesia</option>
                <option value="matematika">Matematika</option>
              </select>

              {activeTab === 'questions' && (
                <>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as 'ALL' | QuestionType)}
                    className="neu-input px-3 py-1.5 rounded-xl text-xs font-medium"
                  >
                    <option value="ALL">Semua Jenis</option>
                    <option value="pg">Pilihan Ganda (PG)</option>
                    <option value="pgk_mcma">PGK Pilihan Jamak</option>
                    <option value="pgk_kategori">PGK Kategori (B/S)</option>
                  </select>

                  <select
                    value={diffFilter}
                    onChange={(e) => setDiffFilter(e.target.value as 'ALL' | DifficultyLevel)}
                    className="neu-input px-3 py-1.5 rounded-xl text-xs font-medium"
                  >
                    <option value="ALL">Semua Level</option>
                    <option value="mudah">Mudah</option>
                    <option value="sedang">Sedang</option>
                    <option value="sukar">Sukar</option>
                  </select>

                  <select
                    value={stimulusFilter}
                    onChange={(e) => setStimulusFilter(e.target.value)}
                    className="neu-input px-3 py-1.5 rounded-xl text-xs font-medium max-w-[180px]"
                  >
                    <option value="ALL">Semua Stimulus</option>
                    {stimuli.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Generator Template Soal Tab */}
      {activeTab === 'template_generator' && (
        <TemplateGeneratorTab
          questions={questions}
          stimuli={stimuli}
          currentUserUid={currentUserUid}
          onImportSuccess={(message) => {
            setImportNotice(message);
            setActiveTab('questions');
          }}
        />
      )}

      {/* Questions List */}
      {activeTab === 'questions' && (
        <div className="space-y-3.5">
          {filteredQuestions.length === 0 ? (
            <div className="neu-surface p-10 text-center text-sm text-slate-500">
              Tidak ada soal yang sesuai dengan filter saat ini.
            </div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const stim = q.stimulusId ? stimuliMap[q.stimulusId] : null;
              return (
                <div
                  key={q.id}
                  className="neu-surface p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono-tabular font-bold text-[#1E1B4B]">
                        #{idx + 1}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={`font-bold ${q.subjectId === 'bahasa_indonesia' ? 'text-indigo-700' : 'text-cyan-700'}`}>
                        {q.subjectId === 'bahasa_indonesia' ? 'Bahasa Indonesia' : 'Matematika'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-violet-700">
                        {q.questionType === 'pg'
                          ? 'PG'
                          : q.questionType === 'pgk_mcma'
                            ? 'PGK MCMA'
                            : 'PGK Kategori'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`capitalize font-semibold ${
                          q.difficulty === 'mudah'
                            ? 'text-emerald-600'
                            : q.difficulty === 'sedang'
                              ? 'text-amber-600'
                              : 'text-rose-600'
                        }`}
                      >
                        Level: {q.difficulty}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular font-semibold text-slate-700">
                        Bobot {q.points}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-[#1E1B4B] leading-relaxed">
                      {q.questionText}
                    </p>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                      <span>Materi: {q.topic}</span>
                      <span aria-hidden="true">·</span>
                      <span>Indikator: {q.indicator}</span>
                      {stim && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-indigo-700 font-semibold">
                            Stimulus: {stim.title}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewQuestion(q)}
                      className="neu-btn-soft inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700"
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Pratinjau</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditQuestion(q)}
                      className="neu-btn-soft inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteQuestion(q.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                      title="Hapus soal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Stimuli List */}
      {activeTab === 'stimuli' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredStimuli.map((st) => {
            const usedCount = questions.filter((q) => q.stimulusId === st.id).length;
            return (
              <div
                key={st.id}
                className="neu-surface p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className={`font-bold ${st.subjectId === 'bahasa_indonesia' ? 'text-indigo-700' : 'text-cyan-700'}`}>
                      {st.subjectId === 'bahasa_indonesia' ? 'Bahasa Indonesia' : 'Matematika'}
                    </span>
                    <span className="font-mono-tabular font-semibold text-violet-700">
                      Dipakai oleh {usedCount} soal
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#1E1B4B]">{st.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-3">
                    {st.readingText || `Stimulus bertipe ${st.stimulusType}`}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200/70 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEditStimulus(st)}
                    className="neu-btn-soft inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Edit Stimulus</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteStimulus(st.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Question Preview Modal */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-modal max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
              <div className="flex items-center gap-3 text-[#1E1B4B]">
                <div className="w-9 h-9 rounded-xl neu-well-indigo flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold">Pratinjau Tampilan Siswa &amp; Kunci</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="neu-btn-soft px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700"
              >
                Tutup
              </button>
            </div>

            {previewQuestion.stimulusId && stimuliMap[previewQuestion.stimulusId] && (
              <div className="neu-inset p-4">
                <StimulusRenderer stimulus={stimuliMap[previewQuestion.stimulusId]} compact />
              </div>
            )}

            <div className="space-y-3">
              <p className="text-base font-medium text-[#1E1B4B]">
                {previewQuestion.questionText}
              </p>

              {(previewQuestion.questionType === 'pg' ||
                previewQuestion.questionType === 'pgk_mcma') && (
                <div className="space-y-2.5">
                  {(previewQuestion.options || []).map((o) => {
                    const isKey =
                      previewQuestion.questionType === 'pg'
                        ? previewQuestion.correctOptionId === o.id
                        : previewQuestion.correctOptionIds?.includes(o.id);
                    return (
                      <div
                        key={o.id}
                        className={`p-3 rounded-xl text-sm flex items-center gap-3 ${
                          isKey
                            ? 'bg-emerald-50 border border-emerald-300 text-emerald-900 font-semibold shadow-sm'
                            : 'neu-surface-sm text-slate-700'
                        }`}
                      >
                        <span className="font-mono-tabular font-bold">{o.id}.</span>
                        <span>{o.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {previewQuestion.questionType === 'pgk_kategori' && (
                <div className="neu-surface-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="neu-table-head text-xs font-bold text-[#1E1B4B]">
                      <tr>
                        <th className="text-left px-4 py-2.5">Pernyataan</th>
                        <th className="text-right px-4 py-2.5">Kunci</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60">
                      {(previewQuestion.statements || []).map((st) => (
                        <tr key={st.id}>
                          <td className="px-4 py-2.5">{st.text}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-600">
                            {previewQuestion.correctCategories?.[st.id]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="neu-inset p-4 text-xs text-slate-700 space-y-1">
                <div>
                  <strong className="text-[#1E1B4B]">Pembahasan:</strong> {previewQuestion.explanation || '-'}
                </div>
                <div>
                  <strong className="text-[#1E1B4B]">Kompetensi:</strong> {previewQuestion.competency}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Question Add/Edit Modal */}
      {showQuestionForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-modal max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#1E1B4B]">
              {editingQuestion ? 'Edit Butir Soal' : 'Tambah Butir Soal Baru'}
            </h3>
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mata Pelajaran
                  </label>
                  <select
                    value={qSubject}
                    onChange={(e) => {
                      const nextSub = e.target.value as SubjectId;
                      setQSubject(nextSub);
                      setQTopic(DEFAULT_TOPICS[nextSub][0]);
                    }}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  >
                    <option value="bahasa_indonesia">Bahasa Indonesia</option>
                    <option value="matematika">Matematika</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Soal
                  </label>
                  <select
                    value={qType}
                    onChange={(e) => setQType(e.target.value as QuestionType)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  >
                    <option value="pg">Pilihan Ganda (PG)</option>
                    <option value="pgk_mcma">PGK Pilihan Jamak</option>
                    <option value="pgk_kategori">PGK Kategori (Benar/Salah)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tingkat Kesulitan
                  </label>
                  <select
                    value={qDiff}
                    onChange={(e) => setQDiff(e.target.value as DifficultyLevel)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  >
                    <option value="mudah">Mudah</option>
                    <option value="sedang">Sedang</option>
                    <option value="sukar">Sukar</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Materi / Topik
                  </label>
                  <input
                    type="text"
                    value={qTopic}
                    onChange={(e) => setQTopic(e.target.value)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kelompok Stimulus (Opsional)
                  </label>
                  <select
                    value={qStimulusId}
                    onChange={(e) => setQStimulusId(e.target.value)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  >
                    <option value="">Tanpa Stimulus Khusus</option>
                    {stimuli
                      .filter((s) => s.subjectId === qSubject)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kompetensi
                  </label>
                  <input
                    type="text"
                    value={qCompetency}
                    onChange={(e) => setQCompetency(e.target.value)}
                    placeholder="Contoh: Menemukan informasi tersurat"
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Indikator Pencapaian
                  </label>
                  <input
                    type="text"
                    value={qIndicator}
                    onChange={(e) => setQIndicator(e.target.value)}
                    placeholder="Contoh: Menentukan simpulan bacaan"
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pertanyaan
                </label>
                <textarea
                  rows={3}
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gambar Soal Tambahan (Opsional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={qImageUrl}
                    onChange={(e) => setQImageUrl(e.target.value)}
                    placeholder="URL gambar soal"
                    className="neu-input flex-1 px-3 py-2 rounded-xl text-xs"
                  />
                  <label className="neu-btn-soft px-3 py-2 rounded-xl text-xs font-semibold text-indigo-700 cursor-pointer shrink-0">
                    {qUploading ? 'Mengunggah...' : 'Unggah Gambar'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (ev) => {
                        const file = ev.target.files?.[0];
                        if (!file) return;
                        setQUploading(true);
                        try {
                          const url = await uploadAssetImage(file, 'questions');
                          setQImageUrl(url);
                        } finally {
                          setQUploading(false);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Options for PG & PGK MCMA */}
              {(qType === 'pg' || qType === 'pgk_mcma') && (
                <div className="neu-inset p-3.5 space-y-2">
                  <div className="text-xs font-bold text-[#1E1B4B]">
                    Pilihan Jawaban &amp; Kunci (Centang kunci yang benar)
                  </div>
                  {qOptions.map((opt, idx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      {qType === 'pg' ? (
                        <input
                          type="radio"
                          name="correctPg"
                          checked={qCorrectOptionId === opt.id}
                          onChange={() => setQCorrectOptionId(opt.id)}
                        />
                      ) : (
                        <input
                          type="checkbox"
                          checked={qCorrectOptionIds.includes(opt.id)}
                          onChange={(ev) => {
                            if (ev.target.checked) {
                              setQCorrectOptionIds([...qCorrectOptionIds, opt.id]);
                            } else {
                              setQCorrectOptionIds(qCorrectOptionIds.filter((x) => x !== opt.id));
                            }
                          }}
                        />
                      )}
                      <span className="w-6 text-xs font-mono-tabular font-bold text-indigo-700">
                        {opt.id}.
                      </span>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(ev) => {
                          const copy = [...qOptions];
                          copy[idx] = { ...opt, text: ev.target.value };
                          setQOptions(copy);
                        }}
                        placeholder={`Teks pilihan ${opt.id}`}
                        className="neu-input flex-1 px-3 py-1.5 rounded-xl text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Statements for PGK Kategori */}
              {qType === 'pgk_kategori' && (
                <div className="neu-inset p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1E1B4B]">
                      Pernyataan &amp; Kunci Benar/Salah
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextId = `S${qStatements.length + 1}`;
                        setQStatements([...qStatements, { id: nextId, text: '' }]);
                        setQCorrectCategories({ ...qCorrectCategories, [nextId]: 'Benar' });
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      + Tambah Pernyataan
                    </button>
                  </div>
                  {qStatements.map((st, idx) => (
                    <div key={st.id} className="flex items-center gap-2">
                      <span className="w-7 text-xs font-mono-tabular font-bold text-indigo-700">{st.id}</span>
                      <input
                        type="text"
                        value={st.text}
                        onChange={(ev) => {
                          const copy = [...qStatements];
                          copy[idx] = { ...st, text: ev.target.value };
                          setQStatements(copy);
                        }}
                        placeholder="Isi pernyataan..."
                        className="neu-input flex-1 px-3 py-1.5 rounded-xl text-sm"
                      />
                      <select
                        value={qCorrectCategories[st.id] || 'Benar'}
                        onChange={(ev) =>
                          setQCorrectCategories({
                            ...qCorrectCategories,
                            [st.id]: ev.target.value as 'Benar' | 'Salah',
                          })
                        }
                        className="neu-input px-2.5 py-1.5 rounded-xl text-xs"
                      >
                        <option value="Benar">Benar</option>
                        <option value="Salah">Salah</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bobot Poin
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={qPoints}
                    onChange={(e) => setQPoints(Number(e.target.value))}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular"
                  />
                </div>
                {qType !== 'pg' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Aturan Penilaian PGK Default
                    </label>
                    <select
                      value={qPgkRule}
                      onChange={(e) => setQPgkRule(e.target.value as PgkScoringRule)}
                      className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                    >
                      <option value="partial_proportional">Skor Proporsional (Parsial)</option>
                      <option value="all_or_nothing">Benar Semua Baru Poin Penuh</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pembahasan (Hanya tampil jika diizinkan admin setelah ujian)
                </label>
                <textarea
                  rows={2}
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuestionForm(false)}
                  className="neu-btn-soft px-4 py-2 rounded-xl text-sm font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="neu-btn-primary px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Soal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stimulus Modal */}
      {showStimulusForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-modal max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#1E1B4B]">
              {editingStimulus ? 'Edit Stimulus' : 'Tambah Stimulus Baru'}
            </h3>
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium">
                {formError}
              </div>
            )}
            <form onSubmit={handleSaveStimulus} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mata Pelajaran
                  </label>
                  <select
                    value={sSubject}
                    onChange={(e) => setSSubject(e.target.value as SubjectId)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  >
                    <option value="bahasa_indonesia">Bahasa Indonesia</option>
                    <option value="matematika">Matematika</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Stimulus
                  </label>
                  <select
                    value={sType}
                    onChange={(e) => setSType(e.target.value as StimulusType)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  >
                    <option value="text">Teks Bacaan</option>
                    <option value="image">Gambar / Ilustrasi</option>
                    <option value="table">Tabel Data</option>
                    <option value="chart">Grafik Batang</option>
                    <option value="mixed">Campuran (Teks + Gambar)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Stimulus
                </label>
                <input
                  type="text"
                  value={sTitle}
                  onChange={(e) => setSTitle(e.target.value)}
                  placeholder="Contoh: Kebun Edukasi Sekolah"
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Teks Bacaan / Pengantar
                </label>
                <textarea
                  rows={4}
                  value={sReadingText}
                  onChange={(e) => setSReadingText(e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                />
              </div>

              {(sType === 'image' || sType === 'mixed') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gambar Stimulus
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sImageUrl}
                      onChange={(e) => setSImageUrl(e.target.value)}
                      placeholder="URL gambar"
                      className="neu-input flex-1 px-3 py-2 rounded-xl text-xs"
                    />
                    <label className="neu-btn-soft px-3 py-2 rounded-xl text-xs font-semibold text-indigo-700 cursor-pointer shrink-0">
                      {sUploading ? 'Mengunggah...' : 'Unggah'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (ev) => {
                          const file = ev.target.files?.[0];
                          if (!file) return;
                          setSUploading(true);
                          try {
                            const url = await uploadAssetImage(file, 'stimuli');
                            setSImageUrl(url);
                          } finally {
                            setSUploading(false);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              {sType === 'table' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Data Tabel (Format CSV: baris pertama header)
                  </label>
                  <textarea
                    rows={4}
                    value={sTableCsv}
                    onChange={(e) => setSTableCsv(e.target.value)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-xs font-mono-tabular"
                  />
                </div>
              )}

              {sType === 'chart' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Judul Grafik
                    </label>
                    <input
                      type="text"
                      value={sChartTitle}
                      onChange={(e) => setSChartTitle(e.target.value)}
                      className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Label (pisahkan koma)
                      </label>
                      <input
                        type="text"
                        value={sChartLabels}
                        onChange={(e) => setSChartLabels(e.target.value)}
                        className="neu-input w-full px-3 py-2 rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nilai Angka (pisahkan koma)
                      </label>
                      <input
                        type="text"
                        value={sChartValues}
                        onChange={(e) => setSChartValues(e.target.value)}
                        className="neu-input w-full px-3 py-2 rounded-xl text-xs font-mono-tabular"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStimulusForm(false)}
                  className="neu-btn-soft px-4 py-2 rounded-xl text-sm font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="neu-btn-primary px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Stimulus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
