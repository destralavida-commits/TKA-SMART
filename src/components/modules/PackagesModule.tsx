import React, { useMemo, useState } from 'react';
import { CalendarClock, Edit3, Plus, Shuffle, Trash2 } from 'lucide-react';
import { deleteExamPackage, saveExamPackageWithItems } from '../../lib/firestoreService';
import type {
  ExamPackage,
  PackageSubjectMode,
  PgkScoringRule,
  Question,
  School,
  Stimulus,
  UserRole,
} from '../../types/tka';

interface PackagesModuleProps {
  role: UserRole;
  lockedSchoolId: string | null;
  packages: ExamPackage[];
  questions: Question[];
  stimuli: Stimulus[];
  schools: School[];
  currentUserUid: string;
  onGoToExecution: () => void;
}

export function PackagesModule({
  role,
  lockedSchoolId,
  packages,
  questions,
  stimuli,
  schools,
  currentUserUid,
  onGoToExecution,
}: PackagesModuleProps) {
  const canManage = role === 'super_admin';
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExamPackage | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [subjectMode, setSubjectMode] = useState<PackageSubjectMode>('gabungan');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [schoolScope, setSchoolScope] = useState<'both' | 'selected'>('both');
  const [allowedSchoolIds, setAllowedSchoolIds] = useState<string[]>(schools.map((s) => s.id));
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [randomizeOptions, setRandomizeOptions] = useState(false);
  const [showResultsToStudent, setShowResultsToStudent] = useState(true);
  const [showAnswersAfterExam, setShowAnswersAfterExam] = useState(false);
  const [pgkScoringMode, setPgkScoringMode] = useState<PgkScoringRule>('partial_proportional');
  const [isActive, setIsActive] = useState(true);

  const questionsMap = useMemo(
    () => Object.fromEntries(questions.map((q) => [q.id, q])),
    [questions],
  );
  const stimuliMap = useMemo(
    () => Object.fromEntries(stimuli.map((s) => [s.id, s])),
    [stimuli],
  );

  const visiblePackages = useMemo(() => {
    if (!lockedSchoolId) return packages;
    return packages.filter(
      (p) => p.schoolScope === 'both' || p.allowedSchoolIds.includes(lockedSchoolId),
    );
  }, [packages, lockedSchoolId]);

  const availableQuestionsForMode = useMemo(() => {
    if (subjectMode === 'gabungan') return questions;
    return questions.filter((q) => q.subjectId === subjectMode);
  }, [questions, subjectMode]);

  const openNew = () => {
    setEditing(null);
    setTitle('');
    setSubjectMode('gabungan');
    setDescription('');
    setDurationMinutes(45);
    setStartTime(new Date().toISOString().slice(0, 16));
    setEndTime(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16));
    setSchoolScope('both');
    setAllowedSchoolIds(schools.map((s) => s.id));
    setSelectedQuestionIds(questions.map((q) => q.id));
    setRandomizeQuestions(false);
    setRandomizeOptions(false);
    setShowResultsToStudent(true);
    setShowAnswersAfterExam(false);
    setPgkScoringMode('partial_proportional');
    setIsActive(true);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (pkg: ExamPackage) => {
    setEditing(pkg);
    setTitle(pkg.title);
    setSubjectMode(pkg.subjectMode);
    setDescription(pkg.description || '');
    setDurationMinutes(pkg.durationMinutes);
    setStartTime(pkg.startTime || '');
    setEndTime(pkg.endTime || '');
    setSchoolScope(pkg.schoolScope);
    setAllowedSchoolIds(pkg.allowedSchoolIds || []);
    setSelectedQuestionIds(pkg.questionIds || []);
    setRandomizeQuestions(pkg.randomizeQuestions);
    setRandomizeOptions(pkg.randomizeOptions);
    setShowResultsToStudent(pkg.showResultsToStudent);
    setShowAnswersAfterExam(pkg.showAnswersAfterExam);
    setPgkScoringMode(pkg.pgkScoringMode);
    setIsActive(pkg.isActive);
    setError(null);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (title.trim().length < 3 || selectedQuestionIds.length === 0) {
      setError('Judul paket dan minimal 1 butir soal wajib dipilih.');
      return;
    }
    setSaving(true);
    try {
      const id = editing?.id || `pkg_${subjectMode}_${Date.now()}`;
      const pkg: ExamPackage = {
        id,
        title: title.trim(),
        subjectMode,
        description: description.trim(),
        questionIds: selectedQuestionIds,
        questionCount: selectedQuestionIds.length,
        durationMinutes: Number(durationMinutes) || 45,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        isActive,
        schoolScope,
        allowedSchoolIds:
          schoolScope === 'both' ? schools.map((s) => s.id) : allowedSchoolIds,
        randomizeQuestions,
        randomizeOptions,
        showResultsToStudent,
        showAnswersAfterExam,
        pgkScoringMode,
        createdBy: editing?.createdBy || currentUserUid,
        createdAt: editing?.createdAt,
      };
      await saveExamPackageWithItems(pkg, questionsMap, stimuliMap);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan paket simulasi.');
    } finally {
      setSaving(false);
    }
  };

  const togglePackageActive = async (pkg: ExamPackage) => {
    await saveExamPackageWithItems(
      { ...pkg, isActive: !pkg.isActive },
      questionsMap,
      stimuliMap,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#1E1B4B]">
            Paket Simulasi TKA
          </h2>
          <p className="text-sm text-slate-600">
            {canManage
              ? 'Susun paket simulasi Bahasa Indonesia, Matematika, atau Gabungan dari bank soal bersama untuk digunakan oleh kedua sekolah.'
              : 'Daftar paket simulasi terpusat yang tersedia untuk dijadwalkan pada pelaksanaan ujian sekolah Anda.'}
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={openNew}
            className="neu-btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Paket Simulasi</span>
          </button>
        )}
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {visiblePackages.length === 0 ? (
          <div className="lg:col-span-2 neu-surface p-10 text-center text-sm text-slate-500">
            Belum ada paket simulasi yang tersedia.
          </div>
        ) : (
          visiblePackages.map((pkg) => {
            const subjectColor =
              pkg.subjectMode === 'gabungan'
                ? 'text-violet-700'
                : pkg.subjectMode === 'bahasa_indonesia'
                  ? 'text-indigo-700'
                  : 'text-cyan-700';
            return (
              <div
                key={pkg.id}
                className="neu-surface p-6 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={`font-bold ${subjectColor}`}>
                      {pkg.subjectMode === 'gabungan'
                        ? 'Simulasi Gabungan (B. Indonesia & Matematika)'
                        : pkg.subjectMode === 'bahasa_indonesia'
                          ? 'Simulasi Bahasa Indonesia'
                          : 'Simulasi Matematika'}
                    </span>
                    <span
                      className={`font-bold ${
                        pkg.isActive ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {pkg.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#1E1B4B]">{pkg.title}</h3>
                  {pkg.description && (
                    <p className="text-sm text-slate-600">{pkg.description}</p>
                  )}

                  <div className="neu-inset px-3.5 py-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span className="font-mono-tabular font-bold text-indigo-700">
                      {pkg.questionCount} soal
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-mono-tabular font-semibold text-[#1E1B4B]">
                      <CalendarClock className="w-3.5 h-3.5 text-cyan-600" />
                      {pkg.durationMinutes} menit
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700">
                      {pkg.schoolScope === 'both'
                        ? 'Digunakan Kedua Sekolah'
                        : 'Sekolah Terpilih'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Shuffle className="w-3.5 h-3.5 text-indigo-400" />
                      Acak Soal: {pkg.randomizeQuestions ? 'Ya' : 'Tidak'} · Acak Opsi:{' '}
                      {pkg.randomizeOptions ? 'Ya' : 'Tidak'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Tampil Nilai: {pkg.showResultsToStudent ? 'Ya' : 'Ditahan'} · Pembahasan:{' '}
                      {pkg.showAnswersAfterExam ? 'Terbuka' : 'Terkunci'}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200/70 flex items-center justify-between gap-3">
                  {canManage ? (
                    <>
                      <button
                        type="button"
                        onClick={() => togglePackageActive(pkg)}
                        className="text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        {pkg.isActive ? 'Nonaktifkan Paket' : 'Aktifkan Paket'}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(pkg)}
                          className="neu-btn-soft inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteExamPackage(pkg.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={onGoToExecution}
                      className="neu-btn-primary w-full px-4 py-2.5 rounded-xl text-xs font-semibold"
                    >
                      Jadwalkan &amp; Buat Token Sesi
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create/Edit Package Modal */}
      {showForm && canManage && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-modal max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#1E1B4B]">
              {editing ? 'Edit Paket Simulasi' : 'Buat Paket Simulasi Baru'}
            </h3>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Paket Simulasi
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Try Out TKA Gabungan Tahap 1"
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pilihan Paket
                  </label>
                  <select
                    value={subjectMode}
                    onChange={(e) => {
                      const nextMode = e.target.value as PackageSubjectMode;
                      setSubjectMode(nextMode);
                      const autoIds =
                        nextMode === 'gabungan'
                          ? questions.map((q) => q.id)
                          : questions.filter((q) => q.subjectId === nextMode).map((q) => q.id);
                      setSelectedQuestionIds(autoIds);
                    }}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  >
                    <option value="gabungan">Simulasi Gabungan</option>
                    <option value="bahasa_indonesia">Simulasi Bahasa Indonesia</option>
                    <option value="matematika">Simulasi Matematika</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi Singkat
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Durasi Ujian (menit)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jadwal Mulai
                  </label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-xs font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jadwal Selesai
                  </label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-xs font-mono-tabular"
                  />
                </div>
              </div>

              {/* School Scope & PGK Rule */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cakupan Sekolah
                  </label>
                  <select
                    value={schoolScope}
                    onChange={(e) => setSchoolScope(e.target.value as 'both' | 'selected')}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  >
                    <option value="both">Digunakan Kedua Sekolah</option>
                    <option value="selected">Sekolah Tertentu Saja</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Aturan Penilaian Soal PGK
                  </label>
                  <select
                    value={pgkScoringMode}
                    onChange={(e) => setPgkScoringMode(e.target.value as PgkScoringRule)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  >
                    <option value="partial_proportional">Skor Proporsional (Parsial)</option>
                    <option value="all_or_nothing">Benar Semua Baru Poin Penuh</option>
                  </select>
                </div>
              </div>

              {schoolScope === 'selected' && (
                <div className="neu-inset flex flex-wrap gap-3 p-3 text-sm">
                  {schools.map((s) => (
                    <label key={s.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allowedSchoolIds.includes(s.id)}
                        onChange={(ev) => {
                          if (ev.target.checked) {
                            setAllowedSchoolIds([...allowedSchoolIds, s.id]);
                          } else {
                            setAllowedSchoolIds(allowedSchoolIds.filter((x) => x !== s.id));
                          }
                        }}
                      />
                      <span>{s.name}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Question Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Pilih Soal dari Bank Soal ({selectedQuestionIds.length} terpilih)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedQuestionIds(availableQuestionsForMode.map((q) => q.id))
                      }
                      className="text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      Pilih Semua ({availableQuestionsForMode.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedQuestionIds([])}
                      className="text-xs font-semibold text-slate-500 hover:underline"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>
                <div className="neu-surface-sm max-h-48 overflow-y-auto divide-y divide-slate-200/60">
                  {availableQuestionsForMode.map((q) => {
                    const checked = selectedQuestionIds.includes(q.id);
                    return (
                      <label
                        key={q.id}
                        className="flex items-start gap-2.5 p-2.5 text-xs hover:bg-indigo-50/40 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(ev) => {
                            if (ev.target.checked) {
                              setSelectedQuestionIds([...selectedQuestionIds, q.id]);
                            } else {
                              setSelectedQuestionIds(
                                selectedQuestionIds.filter((id) => id !== q.id),
                              );
                            }
                          }}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-[#1E1B4B] line-clamp-1">
                            {q.questionText}
                          </div>
                          <div className="text-slate-500">
                            {q.subjectId === 'bahasa_indonesia' ? 'B. Indo' : 'Matematika'} ·{' '}
                            {q.questionType.toUpperCase()} · {q.difficulty}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Toggles */}
              <div className="neu-inset grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 text-xs text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={randomizeQuestions}
                    onChange={(e) => setRandomizeQuestions(e.target.checked)}
                  />
                  <span>Acak urutan soal per siswa</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={randomizeOptions}
                    onChange={(e) => setRandomizeOptions(e.target.checked)}
                  />
                  <span>Acak pilihan jawaban PG/PGK</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showResultsToStudent}
                    onChange={(e) => setShowResultsToStudent(e.target.checked)}
                  />
                  <span>Izinkan siswa melihat nilai akhir setelah selesai</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showAnswersAfterExam}
                    onChange={(e) => setShowAnswersAfterExam(e.target.checked)}
                  />
                  <span>Izinkan tampil kunci jawaban &amp; pembahasan setelah selesai</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span className="font-bold text-[#1E1B4B]">Aktifkan paket sekarang</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="neu-btn-soft px-4 py-2 rounded-xl text-sm font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="neu-btn-primary px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Paket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
