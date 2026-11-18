import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  deleteExamSession,
  deleteExamToken,
  resetExamAttempt,
  sanitizeId,
  saveExamSession,
  saveExamToken,
} from '../../lib/firestoreService';
import type {
  ExamAttempt,
  ExamPackage,
  ExamSession,
  ExamToken,
  School,
  UserRole,
} from '../../types/tka';

interface ExamExecutionModuleProps {
  role: UserRole;
  lockedSchoolId: string | null;
  schools: School[];
  packages: ExamPackage[];
  tokens: ExamToken[];
  sessions: ExamSession[];
  attempts: ExamAttempt[];
  currentUserUid: string;
  onGradePending: () => Promise<void>;
  gradingBusy: boolean;
}

export function ExamExecutionModule({
  role,
  lockedSchoolId,
  schools,
  packages,
  tokens,
  sessions,
  attempts,
  currentUserUid,
  onGradePending,
  gradingBusy,
}: ExamExecutionModuleProps) {
  const [schoolFilter, setSchoolFilter] = useState<string>(lockedSchoolId || 'ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const defaultSch = lockedSchoolId || schools[0]?.id || 'sekolah_a';
  const [formSchoolId, setFormSchoolId] = useState<string>(
    role === 'super_admin' && !lockedSchoolId ? 'ALL' : defaultSch,
  );
  const [formPackageId, setFormPackageId] = useState<string>(packages[0]?.id || '');
  const [formSessionName, setFormSessionName] = useState('');
  const [formTokenCode, setFormTokenCode] = useState(
    `TKA${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
  );
  const [formProctor, setFormProctor] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSchoolFilter = lockedSchoolId || schoolFilter;
  const schoolMap = new Map(schools.map((s) => [s.id, s.name]));

  const visibleTokens = useMemo(() => {
    return tokens.filter((t) => {
      if (effectiveSchoolFilter === 'ALL') return true;
      return t.school_id === 'ALL' || t.school_id === effectiveSchoolFilter;
    });
  }, [tokens, effectiveSchoolFilter]);

  const visibleSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (effectiveSchoolFilter === 'ALL') return true;
      return s.school_id === effectiveSchoolFilter;
    });
  }, [sessions, effectiveSchoolFilter]);

  const visibleAttempts = useMemo(() => {
    return attempts
      .filter((a) => {
        if (effectiveSchoolFilter === 'ALL') return true;
        return a.school_id === effectiveSchoolFilter;
      })
      .sort((a, b) => b.lastSavedAtMs - a.lastSavedAtMs);
  }, [attempts, effectiveSchoolFilter]);

  const pendingCount = visibleAttempts.filter((a) => a.status === 'submitted').length;

  const handleCreateSessionAndToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const pkg = packages.find((p) => p.id === formPackageId);
    const cleanToken = sanitizeId(formTokenCode).toUpperCase();
    if (!pkg || cleanToken.length < 4 || !formSessionName.trim()) {
      setError('Paket simulasi, nama sesi, dan token (min. 4 karakter) wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const tokenSchool = lockedSchoolId || formSchoolId;
      await saveExamToken({
        tokenCode: cleanToken,
        packageId: pkg.id,
        packageTitle: pkg.title,
        school_id: tokenSchool,
        sessionName: formSessionName.trim(),
        isActive: true,
        createdBy: currentUserUid,
      });

      const targetSchools =
        tokenSchool === 'ALL' ? schools.map((s) => s.id) : [tokenSchool];
      for (const schId of targetSchools) {
        await saveExamSession({
          id: `sess_${schId}_${cleanToken}_${Date.now().toString().slice(-4)}`,
          school_id: schId,
          packageId: pkg.id,
          packageTitle: pkg.title,
          tokenCode: cleanToken,
          sessionName: formSessionName.trim(),
          scheduledStart: new Date().toISOString().slice(0, 16),
          status: 'active',
          proctorName: formProctor.trim() || undefined,
          createdBy: currentUserUid,
        });
      }

      setShowCreateModal(false);
      setFormSessionName('');
      setFormTokenCode(`TKA${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat sesi dan token.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#1E1B4B]">
            Pelaksanaan Ujian, Token &amp; Pemantauan Peserta
          </h2>
          <p className="text-sm text-slate-600">
            Atur token masuk siswa, aktifkan sesi ujian, dan pantau progres pengerjaan secara langsung.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {!lockedSchoolId && (
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="neu-input px-3 py-2 rounded-xl text-sm"
            >
              <option value="ALL">Semua Sekolah</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="neu-btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Sesi &amp; Token</span>
          </button>
        </div>
      </div>

      {/* Active Tokens */}
      <div className="neu-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg neu-well-indigo flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#1E1B4B]">
              Token Ujian Aktif ({visibleTokens.length})
            </h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="neu-table-head text-xs font-bold text-[#1E1B4B] border-b border-slate-200/70">
                <th className="px-5 py-3">Kode Token</th>
                <th className="px-4 py-3">Nama Sesi</th>
                <th className="px-4 py-3">Paket Simulasi</th>
                <th className="px-4 py-3">Cakupan Sekolah</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {visibleTokens.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Belum ada token ujian yang dibuat.
                  </td>
                </tr>
              ) : (
                visibleTokens.map((tk) => {
                  const canEditToken = role === 'super_admin' || tk.school_id === lockedSchoolId;
                  return (
                    <tr key={tk.tokenCode} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="px-5 py-3 font-mono-tabular font-bold text-indigo-700 tracking-wider">
                        {tk.tokenCode}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1E1B4B]">
                        {tk.sessionName}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate">
                        {tk.packageTitle}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {tk.school_id === 'ALL'
                          ? 'Kedua Sekolah'
                          : schoolMap.get(tk.school_id) || tk.school_id}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold">
                        <span className={tk.isActive ? 'text-emerald-600' : 'text-rose-600'}>
                          {tk.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right space-x-2 whitespace-nowrap">
                        {canEditToken && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                saveExamToken({ ...tk, isActive: !tk.isActive })
                              }
                              className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                              {tk.isActive ? 'Tutup Token' : 'Aktifkan'}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteExamToken(tk.tokenCode)}
                              className="inline-flex items-center p-1 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Participant Monitor */}
      <div className="neu-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#1E1B4B]">
              Pemantauan Peserta Ujian ({visibleAttempts.length})
            </h3>
            <p className="text-xs text-slate-500">
              Data tersinkronisasi otomatis saat siswa menyimpan atau mengirim jawaban.
            </p>
          </div>
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={onGradePending}
              disabled={gradingBusy}
              className="neu-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${gradingBusy ? 'animate-spin' : ''}`} />
              <span>Koreksi {pendingCount} Jawaban Masuk</span>
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="neu-table-head text-xs font-bold text-[#1E1B4B] border-b border-slate-200/70">
                <th className="px-5 py-3">Peserta</th>
                <th className="px-4 py-3">Sekolah &amp; Kelas</th>
                <th className="px-4 py-3">Token</th>
                <th className="px-4 py-3">Progres</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {visibleAttempts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    Belum ada peserta yang memulai sesi ujian.
                  </td>
                </tr>
              ) : (
                visibleAttempts.map((att) => {
                  const answeredCount = Object.keys(att.answers || {}).length;
                  const totalQ = att.questionOrder?.length || 0;
                  const pct = totalQ > 0 ? Math.round((answeredCount / totalQ) * 100) : 0;
                  return (
                    <tr key={att.id} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-[#1E1B4B]">{att.studentName}</div>
                        <div className="text-xs text-slate-500 font-mono-tabular">
                          NIS {att.nis}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>{schoolMap.get(att.school_id) || att.school_id}</div>
                        <div className="text-xs text-slate-500">Kelas {att.className}</div>
                      </td>
                      <td className="px-4 py-3 font-mono-tabular text-xs font-bold text-indigo-700">
                        {att.tokenCode}
                      </td>
                      <td className="px-4 py-3 font-mono-tabular text-xs text-slate-700 min-w-[130px]">
                        <div className="flex items-center justify-between mb-1">
                          <span>{answeredCount}/{totalQ} soal</span>
                          <span className="font-bold text-indigo-700">{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full neu-inset rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-indigo-600 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold">
                        {att.status === 'in_progress' && (
                          <span className="text-cyan-700">Sedang Mengerjakan</span>
                        )}
                        {att.status === 'submitted' && (
                          <span className="text-amber-600">Terkirim · Menunggu Nilai</span>
                        )}
                        {att.status === 'graded' && (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Selesai &amp; Dinilai
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => resetExamAttempt(att.id)}
                          className="neu-btn-soft inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-rose-600"
                          title="Reset sesi peserta"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scheduled Sessions List */}
      <div className="neu-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/70">
          <h3 className="text-sm font-bold text-[#1E1B4B]">
            Jadwal Pelaksanaan Sesi Sekolah ({visibleSessions.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="neu-table-head text-xs font-bold text-[#1E1B4B] border-b border-slate-200/70">
                <th className="px-5 py-3">Sesi</th>
                <th className="px-4 py-3">Sekolah</th>
                <th className="px-4 py-3">Token</th>
                <th className="px-4 py-3">Pengawas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {visibleSessions.map((sess) => (
                <tr key={sess.id} className="hover:bg-indigo-50/40 transition-colors">
                  <td className="px-5 py-3 font-semibold text-[#1E1B4B]">{sess.sessionName}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {schoolMap.get(sess.school_id) || sess.school_id}
                  </td>
                  <td className="px-4 py-3 font-mono-tabular text-xs font-bold text-indigo-700">
                    {sess.tokenCode}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{sess.proctorName || '-'}</td>
                  <td className="px-4 py-3 text-xs font-bold">
                    <span
                      className={
                        sess.status === 'active'
                          ? 'text-emerald-600'
                          : sess.status === 'scheduled'
                            ? 'text-amber-600'
                            : 'text-slate-500'
                      }
                    >
                      {sess.status === 'active'
                        ? 'Aktif'
                        : sess.status === 'scheduled'
                          ? 'Terjadwal'
                          : 'Ditutup'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() =>
                        saveExamSession({
                          ...sess,
                          status: sess.status === 'active' ? 'closed' : 'active',
                        })
                      }
                      className="text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      {sess.status === 'active' ? 'Tutup Sesi' : 'Buka Sesi'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteExamSession(sess.id)}
                      className="inline-flex items-center p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-modal max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#1E1B4B]">
              Buat Sesi &amp; Token Ujian Baru
            </h3>
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium">
                {error}
              </div>
            )}
            <form onSubmit={handleCreateSessionAndToken} className="space-y-4">
              {!lockedSchoolId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Sekolah
                  </label>
                  <select
                    value={formSchoolId}
                    onChange={(e) => setFormSchoolId(e.target.value)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  >
                    <option value="ALL">Kedua Sekolah Sekaligus</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Paket Simulasi
                </label>
                <select
                  value={formPackageId}
                  onChange={(e) => setFormPackageId(e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Sesi Pelaksanaan
                </label>
                <input
                  type="text"
                  value={formSessionName}
                  onChange={(e) => setFormSessionName(e.target.value)}
                  placeholder="Contoh: Simulasi Pagi Kelas 6A"
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode Token Ujian
                  </label>
                  <input
                    type="text"
                    value={formTokenCode}
                    onChange={(e) => setFormTokenCode(e.target.value.toUpperCase())}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Pengawas
                  </label>
                  <input
                    type="text"
                    value={formProctor}
                    onChange={(e) => setFormProctor(e.target.value)}
                    placeholder="Opsional"
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="neu-btn-soft px-4 py-2 rounded-xl text-sm font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="neu-btn-primary px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan & Aktifkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
