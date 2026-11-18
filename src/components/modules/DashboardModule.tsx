import React from 'react';
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  PlayCircle,
  School as SchoolIcon,
  Users,
} from 'lucide-react';
import { SimpleBarChart, SimpleDonutChart } from '../Charts';
import { buildScoreDistribution } from '../../lib/grading';
import type {
  ExamAttempt,
  ExamPackage,
  ExamResult,
  School,
  Student,
  UserInvite,
  UserRole,
} from '../../types/tka';

interface DashboardModuleProps {
  role: UserRole;
  activeSchoolId: string | null;
  schools: School[];
  students: Student[];
  invites: UserInvite[];
  packages: ExamPackage[];
  attempts: ExamAttempt[];
  results: ExamResult[];
  onGradePending: () => Promise<void>;
  gradingBusy: boolean;
}

export function DashboardModule({
  role,
  activeSchoolId,
  schools,
  students,
  invites,
  packages,
  attempts,
  results,
  onGradePending,
  gradingBusy,
}: DashboardModuleProps) {
  const scopedStudents = activeSchoolId
    ? students.filter((s) => s.school_id === activeSchoolId)
    : students;
  const scopedAttempts = activeSchoolId
    ? attempts.filter((a) => a.school_id === activeSchoolId)
    : attempts;
  const scopedResults = activeSchoolId
    ? results.filter((r) => r.school_id === activeSchoolId)
    : results;

  const finishedCount = scopedAttempts.filter(
    (a) => a.status === 'submitted' || a.status === 'graded',
  ).length;
  const inProgressCount = scopedAttempts.filter((a) => a.status === 'in_progress').length;
  const pendingGradeCount = scopedAttempts.filter((a) => a.status === 'submitted').length;
  const notStartedCount = Math.max(0, scopedStudents.length - finishedCount - inProgressCount);

  const avgScore =
    scopedResults.length > 0
      ? Number(
          (
            scopedResults.reduce((acc, r) => acc + r.finalScore, 0) / scopedResults.length
          ).toFixed(1),
        )
      : 0;

  const scoreBuckets = buildScoreDistribution(scopedResults);
  const bucketPalette = ['#F43F5E', '#F59E0B', '#06B6D4', '#3B82F6', '#10B981'];
  const barData = scoreBuckets.map((b, idx) => ({
    label: b.label,
    value: b.count,
    color: bucketPalette[idx] || '#4F46E5',
  }));

  const teacherCount = activeSchoolId
    ? invites.filter((u) => u.school_id === activeSchoolId && u.role !== 'super_admin').length
    : invites.filter((u) => u.role !== 'super_admin').length;

  const kpiCards = [
    ...(role === 'super_admin'
      ? [
          {
            label: 'Sekolah Terdaftar',
            value: schools.filter((s) => s.isActive).length,
            sub: `dari ${schools.length} sekolah`,
            icon: SchoolIcon,
            wellClass: 'neu-well-indigo',
            valueClass: 'text-[#4338CA]',
          },
          {
            label: 'Akun Guru & Admin',
            value: teacherCount,
            sub: 'terdaftar di sistem',
            icon: Users,
            wellClass: 'neu-well-violet',
            valueClass: 'text-[#6D28D9]',
          },
        ]
      : []),
    {
      label: 'Total Siswa Kelas 6',
      value: scopedStudents.length,
      sub: 'peserta aktif',
      icon: GraduationCap,
      wellClass: 'neu-well-blue',
      valueClass: 'text-[#1D4ED8]',
    },
    {
      label: 'Paket Simulasi',
      value: packages.filter((p) => p.isActive).length,
      sub: `${packages.length} total paket`,
      icon: ClipboardList,
      wellClass: 'neu-well-amber',
      valueClass: 'text-[#B45309]',
    },
    {
      label: 'Sudah Mengerjakan',
      value: finishedCount,
      sub: 'ujian selesai',
      icon: CheckCircle2,
      wellClass: 'neu-well-emerald',
      valueClass: 'text-[#047857]',
    },
    {
      label: 'Sedang Mengerjakan',
      value: inProgressCount,
      sub: 'sesi aktif berjalan',
      icon: PlayCircle,
      wellClass: 'neu-well-cyan',
      valueClass: 'text-[#0E7490]',
    },
    {
      label: 'Rata-rata Nilai',
      value: avgScore,
      sub: `${scopedResults.length} hasil dinilai`,
      icon: Activity,
      wellClass: 'neu-well-rose',
      valueClass: 'text-[#BE123C]',
    },
  ];

  const schoolNameMap = new Map(schools.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-6">
      {pendingGradeCount > 0 && (
        <div className="neu-surface bg-gradient-to-r from-sky-50/90 via-indigo-50/90 to-emerald-50/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm text-[#1E1B4B]">
            Terdapat <strong className="font-mono-tabular text-[#4F46E5]">{pendingGradeCount}</strong> lembar jawaban siswa yang baru masuk dan siap dikoreksi otomatis.
          </div>
          <button
            type="button"
            onClick={onGradePending}
            disabled={gradingBusy}
            className="neu-btn-primary px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap disabled:opacity-60"
          >
            {gradingBusy ? 'Memproses Nilai...' : 'Koreksi & Hitung Nilai'}
          </button>
        </div>
      )}

      {/* Colorful Soft-Neumorphic KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="neu-surface p-5 flex items-start justify-between gap-3"
            >
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">
                  {card.label}
                </div>
                <div className={`text-2xl font-extrabold font-mono-tabular ${card.valueClass}`}>
                  {card.value}
                </div>
                <div className="text-xs text-slate-500 mt-1">{card.sub}</div>
              </div>
              <div className={`w-10 h-10 rounded-xl ${card.wellClass} flex items-center justify-center shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 neu-surface p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-bold text-[#1E1B4B]">
                Distribusi Nilai Simulasi TKA
              </h3>
              <p className="text-xs text-slate-500">
                Sebaran perolehan nilai peserta berdasarkan rentang skor (0–100)
              </p>
            </div>
          </div>
          <SimpleBarChart data={barData} unit=" siswa" />
        </div>

        <div className="lg:col-span-5 neu-surface p-6">
          <div className="mb-5">
            <h3 className="text-base font-bold text-[#1E1B4B]">
              Status Partisipasi Peserta
            </h3>
            <p className="text-xs text-slate-500">
              Proporsi peserta selesai, sedang ujian, dan belum mulai
            </p>
          </div>
          <SimpleDonutChart
            centerValue={String(scopedStudents.length)}
            centerLabel="Total Siswa"
            slices={[
              { label: 'Selesai Mengerjakan', value: finishedCount, color: '#10B981' },
              { label: 'Sedang Mengerjakan', value: inProgressCount, color: '#06B6D4' },
              { label: 'Belum Mengerjakan', value: notStartedCount, color: '#94A3B8' },
            ]}
          />
        </div>
      </div>

      {/* Recent Results Table */}
      <div className="neu-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/70 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#1E1B4B]">
              Hasil Penilaian Terbaru
            </h3>
            <p className="text-xs text-slate-500">
              Rekap skor otomatis peserta yang telah menyelesaikan simulasi
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg neu-well-blue flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="neu-table-head text-xs font-bold text-[#1E3A8A] border-b border-slate-200/80">
                <th className="px-5 py-3">Siswa</th>
                <th className="px-4 py-3">Sekolah</th>
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3">Paket Simulasi</th>
                <th className="px-4 py-3 text-right">Benar</th>
                <th className="px-5 py-3 text-right">Nilai Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {scopedResults.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500 text-sm">
                    Belum ada hasil simulasi yang dinilai.
                  </td>
                </tr>
              ) : (
                [...scopedResults]
                  .sort((a, b) => b.gradedAtMs - a.gradedAtMs)
                  .slice(0, 8)
                  .map((r) => (
                    <tr key={r.id} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-[#1E1B4B]">{r.studentName}</div>
                        <div className="text-xs text-slate-500 font-mono-tabular">
                          NIS {r.nis}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {schoolNameMap.get(r.school_id) || r.school_id}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-mono-tabular">
                        {r.className}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate">
                        {r.packageTitle}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-tabular text-slate-700">
                        {r.correctCount}/{r.totalQuestions}
                      </td>
                      <td className="px-5 py-3 text-right font-mono-tabular font-extrabold text-[#4F46E5]">
                        {r.finalScore}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
