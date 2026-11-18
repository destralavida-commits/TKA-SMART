import React, { useMemo, useState } from 'react';
import { Eye, Search } from 'lucide-react';
import { GroupedComparisonChart, SimpleBarChart, SimpleDonutChart } from '../Charts';
import { buildItemAnalytics, buildScoreDistribution } from '../../lib/grading';
import type {
  ExamPackage,
  ExamResult,
  Question,
  School,
  SchoolClass,
  UserRole,
} from '../../types/tka';

interface ResultsAnalyticsModuleProps {
  mode: 'results' | 'analytics' | 'comparison';
  role: UserRole;
  lockedSchoolId: string | null;
  schools: School[];
  classes: SchoolClass[];
  packages: ExamPackage[];
  questions: Question[];
  results: ExamResult[];
}

export function ResultsAnalyticsModule({
  mode,
  role,
  lockedSchoolId,
  schools,
  classes,
  packages,
  questions,
  results,
}: ResultsAnalyticsModuleProps) {
  const [schoolFilter, setSchoolFilter] = useState<string>(lockedSchoolId || 'ALL');
  const [packageFilter, setPackageFilter] = useState<string>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState<ExamResult | null>(null);
  const [analyticsSubTab, setAnalyticsSubTab] = useState<
    'overview' | 'class' | 'competency' | 'items'
  >('overview');

  const effectiveSchoolFilter = lockedSchoolId || schoolFilter;
  const schoolMap = useMemo(
    () => new Map(schools.map((s) => [s.id, s])),
    [schools],
  );
  const questionsMap = useMemo(
    () => Object.fromEntries(questions.map((q) => [q.id, q])),
    [questions],
  );

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (effectiveSchoolFilter !== 'ALL' && r.school_id !== effectiveSchoolFilter) return false;
      if (packageFilter !== 'ALL' && r.packageId !== packageFilter) return false;
      if (classFilter !== 'ALL' && r.classId !== classFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return r.studentName.toLowerCase().includes(q) || r.nis.toLowerCase().includes(q);
      }
      return true;
    });
  }, [results, effectiveSchoolFilter, packageFilter, classFilter, searchQuery]);

  // Subject averages
  const subjectStats = useMemo(() => {
    const acc: Record<string, { name: string; sum: number; count: number }> = {
      bahasa_indonesia: { name: 'Bahasa Indonesia', sum: 0, count: 0 },
      matematika: { name: 'Matematika', sum: 0, count: 0 },
    };
    for (const r of filteredResults) {
      Object.values(r.subjectBreakdown || {}).forEach((sb) => {
        if (acc[sb.subjectId]) {
          acc[sb.subjectId].sum += sb.score;
          acc[sb.subjectId].count += 1;
        }
      });
    }
    return Object.entries(acc).map(([id, v]) => ({
      id,
      name: v.name,
      avg: v.count > 0 ? Number((v.sum / v.count).toFixed(1)) : 0,
      count: v.count,
    }));
  }, [filteredResults]);

  // Class aggregation
  const classStats = useMemo(() => {
    const map: Record<
      string,
      { classId: string; className: string; schoolName: string; sum: number; count: number; passed: number }
    > = {};
    for (const r of filteredResults) {
      const key = `${r.school_id}__${r.classId}`;
      if (!map[key]) {
        map[key] = {
          classId: r.classId,
          className: r.className,
          schoolName: schoolMap.get(r.school_id)?.name || r.school_id,
          sum: 0,
          count: 0,
          passed: 0,
        };
      }
      map[key].sum += r.finalScore;
      map[key].count += 1;
      if (r.finalScore >= 75) map[key].passed += 1;
    }
    return Object.values(map).map((c) => ({
      ...c,
      avg: c.count > 0 ? Number((c.sum / c.count).toFixed(1)) : 0,
      passRate: c.count > 0 ? Math.round((c.passed / c.count) * 100) : 0,
    }));
  }, [filteredResults, schoolMap]);

  // Competency / Indicator mastery aggregation
  const competencyStats = useMemo(() => {
    const map: Record<
      string,
      {
        subjectId: string;
        competency: string;
        indicator: string;
        sumMastery: number;
        count: number;
      }
    > = {};
    for (const r of filteredResults) {
      for (const c of r.competencyBreakdown || []) {
        const key = `${c.subjectId}::${c.indicator}`;
        if (!map[key]) {
          map[key] = {
            subjectId: c.subjectId,
            competency: c.competency,
            indicator: c.indicator,
            sumMastery: 0,
            count: 0,
          };
        }
        map[key].sumMastery += c.masteryPercent;
        map[key].count += 1;
      }
    }
    return Object.values(map)
      .map((item) => ({
        ...item,
        avgMastery: item.count > 0 ? Number((item.sumMastery / item.count).toFixed(1)) : 0,
      }))
      .sort((a, b) => a.avgMastery - b.avgMastery);
  }, [filteredResults]);

  // Question item difficulty & option distribution
  const itemAnalytics = useMemo(
    () => buildItemAnalytics(filteredResults, questionsMap),
    [filteredResults, questionsMap],
  );

  // School Comparison (Admin Utama)
  const schoolComparison = useMemo(() => {
    const targetSchools = schools.slice(0, 2);
    return targetSchools.map((sch) => {
      const schRes = results.filter(
        (r) =>
          r.school_id === sch.id &&
          (packageFilter === 'ALL' || r.packageId === packageFilter),
      );
      const count = schRes.length;
      const avg =
        count > 0
          ? Number((schRes.reduce((a, b) => a + b.finalScore, 0) / count).toFixed(1))
          : 0;
      const bindoVals = schRes
        .map((r) => r.subjectBreakdown?.bahasa_indonesia?.score)
        .filter((x): x is number => typeof x === 'number');
      const mtkVals = schRes
        .map((r) => r.subjectBreakdown?.matematika?.score)
        .filter((x): x is number => typeof x === 'number');
      const avgBindo =
        bindoVals.length > 0
          ? Number((bindoVals.reduce((a, b) => a + b, 0) / bindoVals.length).toFixed(1))
          : 0;
      const avgMtk =
        mtkVals.length > 0
          ? Number((mtkVals.reduce((a, b) => a + b, 0) / mtkVals.length).toFixed(1))
          : 0;
      const passed = schRes.filter((r) => r.finalScore >= 75).length;
      const passRate = count > 0 ? Math.round((passed / count) * 100) : 0;
      const highest = count > 0 ? Math.max(...schRes.map((r) => r.finalScore)) : 0;
      const lowest = count > 0 ? Math.min(...schRes.map((r) => r.finalScore)) : 0;

      return {
        school: sch,
        count,
        avg,
        avgBindo,
        avgMtk,
        passRate,
        highest,
        lowest,
      };
    });
  }, [schools, results, packageFilter]);

  const distribution = buildScoreDistribution(filteredResults);
  const passedTotal = filteredResults.filter((r) => r.finalScore >= 75).length;
  const needGuidanceTotal = filteredResults.length - passedTotal;

  // COMPARISON MODE VIEW
  if (mode === 'comparison' && role === 'super_admin') {
    const schA = schoolComparison[0];
    const schB = schoolComparison[1];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#1E1B4B]">
              Perbandingan Performa Kedua Sekolah
            </h2>
            <p className="text-sm text-slate-600">
              Komparasi capaian akademik antara kedua sekolah berdasarkan paket yang sama tanpa mencampur data sumber masing-masing sekolah.
            </p>
          </div>
          <select
            value={packageFilter}
            onChange={(e) => setPackageFilter(e.target.value)}
            className="neu-input px-3 py-2 rounded-xl text-sm"
          >
            <option value="ALL">Semua Paket Simulasi</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        {/* Summary Cards Side-by-Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {schoolComparison.map((sc, idx) => (
            <div
              key={sc.school.id}
              className="neu-surface p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                {sc.school.logoUrl && (
                  <div className="neu-surface-sm p-1 shrink-0">
                    <img
                      src={sc.school.logoUrl}
                      alt={sc.school.name}
                      className="w-10 h-10 rounded-lg object-cover bg-white"
                    />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-[#1E1B4B]">{sc.school.name}</h3>
                  <div className="text-xs text-slate-500 font-mono-tabular">
                    NPSN {sc.school.npsn} · {sc.count} peserta dinilai
                  </div>
                </div>
              </div>

              <div className="neu-inset p-3.5 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs text-slate-500">Rata-rata</div>
                  <div className={`text-xl font-bold font-mono-tabular ${idx === 0 ? 'text-indigo-700' : 'text-cyan-700'}`}>
                    {sc.avg}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">B. Indonesia</div>
                  <div className="text-xl font-bold font-mono-tabular text-[#1E1B4B]">
                    {sc.avgBindo}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Matematika</div>
                  <div className="text-xl font-bold font-mono-tabular text-violet-700">
                    {sc.avgMtk}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                <span>Ketuntasan (&ge; 75): <strong className="font-mono-tabular text-emerald-600">{sc.passRate}%</strong></span>
                <span>Tertinggi: <strong className="font-mono-tabular text-[#1E1B4B]">{sc.highest}</strong> · Terendah: <strong className="font-mono-tabular text-rose-600">{sc.lowest}</strong></span>
              </div>
            </div>
          ))}
        </div>

        {schA && schB && (
          <div className="neu-surface p-6">
            <h3 className="text-base font-bold text-[#1E1B4B] mb-1">
              Grafik Perbandingan Capaian Nilai
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Perbandingan rata-rata nilai keseluruhan, Bahasa Indonesia, Matematika, dan tingkat ketuntasan (%)
            </p>
            <GroupedComparisonChart
              labelA={schA.school.name}
              labelB={schB.school.name}
              data={[
                { label: 'Rata-rata Total', valueA: schA.avg, valueB: schB.avg },
                { label: 'B. Indonesia', valueA: schA.avgBindo, valueB: schB.avgBindo },
                { label: 'Matematika', valueA: schA.avgMtk, valueB: schB.avgMtk },
                { label: 'Ketuntasan (%)', valueA: schA.passRate, valueB: schB.passRate },
              ]}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#1E1B4B]">
            {mode === 'results' ? 'Hasil Ujian Peserta' : 'Analisis Nilai, Kompetensi & Butir Soal'}
          </h2>
          <p className="text-sm text-slate-600">
            Pantau perolehan nilai per siswa, per kelas, ketuntasan indikator, serta identifikasi butir soal tersulit.
          </p>
        </div>

        {mode === 'analytics' && (
          <div className="neu-inset inline-flex items-center gap-1 p-1.5">
            {[
              { id: 'overview', label: 'Ringkasan & Mapel' },
              { id: 'class', label: 'Per Kelas' },
              { id: 'competency', label: 'Indikator' },
              { id: 'items', label: 'Analisis Soal' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setAnalyticsSubTab(t.id as typeof analyticsSubTab)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  analyticsSubTab === t.id
                    ? 'neu-btn-primary shadow-sm'
                    : 'text-slate-600 hover:text-[#1E1B4B]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="neu-surface p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau NIS siswa..."
            className="neu-input w-full pl-9 pr-3 py-2 rounded-xl text-sm"
          />
        </div>

        {!lockedSchoolId && (
          <select
            value={schoolFilter}
            onChange={(e) => {
              setSchoolFilter(e.target.value);
              setClassFilter('ALL');
            }}
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

        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="neu-input px-3 py-2 rounded-xl text-sm"
        >
          <option value="ALL">Semua Kelas</option>
          {classes
            .filter((c) => effectiveSchoolFilter === 'ALL' || c.school_id === effectiveSchoolFilter)
            .map((c) => (
              <option key={c.id} value={c.id}>
                Kelas {c.name} ({schoolMap.get(c.school_id)?.name || c.school_id})
              </option>
            ))}
        </select>

        <select
          value={packageFilter}
          onChange={(e) => setPackageFilter(e.target.value)}
          className="neu-input px-3 py-2 rounded-xl text-sm max-w-xs"
        >
          <option value="ALL">Semua Paket Simulasi</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      {/* ANALYTICS CHARTS & SUB-TABS */}
      {(mode === 'analytics' || role === 'super_admin') && analyticsSubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 neu-surface p-6">
            <h3 className="text-base font-bold text-[#1E1B4B] mb-1">
              Distribusi Nilai Peserta
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Jumlah peserta pada setiap rentang nilai akhir
            </p>
            <SimpleBarChart
              data={distribution.map((b, i) => ({
                label: b.label,
                value: b.count,
                color: i >= 3 ? '#4F46E5' : i === 2 ? '#06B6D4' : '#F59E0B',
              }))}
              unit=" siswa"
            />
          </div>

          <div className="lg:col-span-5 neu-surface p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-[#1E1B4B] mb-1">
                Ketuntasan &amp; Rata-rata Mata Pelajaran
              </h3>
              <p className="text-xs text-slate-500">
                Ambang batas ketuntasan simulasi: 75,0
              </p>
            </div>
            <SimpleDonutChart
              centerValue={`${filteredResults.length > 0 ? Math.round((passedTotal / filteredResults.length) * 100) : 0}%`}
              centerLabel="Tuntas"
              slices={[
                { label: 'Tuntas (≥ 75)', value: passedTotal, color: '#10B981' },
                { label: 'Perlu Pembinaan (< 75)', value: needGuidanceTotal, color: '#F43F5E' },
              ]}
            />
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/70">
              {subjectStats.map((st, idx) => (
                <div key={st.id} className="neu-inset p-3.5">
                  <div className="text-xs text-slate-500">{st.name}</div>
                  <div className={`text-lg font-bold font-mono-tabular ${idx === 0 ? 'text-indigo-700' : 'text-cyan-700'}`}>
                    {st.avg}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mode === 'analytics' && analyticsSubTab === 'class' && (
        <div className="neu-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/70">
            <h3 className="text-sm font-bold text-[#1E1B4B]">Analisis Per Kelas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="neu-table-head text-xs font-bold text-[#1E1B4B] border-b border-slate-200/70">
                  <th className="px-5 py-3">Sekolah</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3 text-right">Peserta Dinilai</th>
                  <th className="px-4 py-3 text-right">Rata-rata Nilai</th>
                  <th className="px-5 py-3 text-right">Ketuntasan (&ge; 75)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {classStats.map((c) => (
                  <tr key={`${c.schoolName}_${c.classId}`} className="hover:bg-indigo-50/40 transition-colors">
                    <td className="px-5 py-3 font-semibold text-[#1E1B4B]">{c.schoolName}</td>
                    <td className="px-4 py-3 font-mono-tabular">Kelas {c.className}</td>
                    <td className="px-4 py-3 text-right font-mono-tabular">{c.count}</td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-bold text-indigo-700">
                      {c.avg}
                    </td>
                    <td className="px-5 py-3 text-right font-mono-tabular font-semibold text-emerald-600">{c.passRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === 'analytics' && analyticsSubTab === 'competency' && (
        <div className="neu-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/70">
            <h3 className="text-sm font-bold text-[#1E1B4B]">
              Persentase Ketuntasan Setiap Kompetensi &amp; Indikator
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="neu-table-head text-xs font-bold text-[#1E1B4B] border-b border-slate-200/70">
                  <th className="px-5 py-3">Mata Pelajaran</th>
                  <th className="px-4 py-3">Kompetensi</th>
                  <th className="px-4 py-3">Indikator</th>
                  <th className="px-5 py-3 text-right">Ketuntasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {competencyStats.map((c) => (
                  <tr key={`${c.subjectId}::${c.indicator}`} className="hover:bg-indigo-50/40 transition-colors">
                    <td className={`px-5 py-3 text-xs font-bold whitespace-nowrap ${c.subjectId === 'bahasa_indonesia' ? 'text-indigo-700' : 'text-cyan-700'}`}>
                      {c.subjectId === 'bahasa_indonesia' ? 'Bahasa Indonesia' : 'Matematika'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.competency}</td>
                    <td className="px-4 py-3 text-[#1E1B4B] font-medium">{c.indicator}</td>
                    <td className="px-5 py-3 text-right font-mono-tabular font-bold">
                      <span
                        className={
                          c.avgMastery >= 75
                            ? 'text-emerald-600'
                            : c.avgMastery >= 55
                              ? 'text-amber-600'
                              : 'text-rose-600'
                        }
                      >
                        {c.avgMastery}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === 'analytics' && analyticsSubTab === 'items' && (
        <div className="neu-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/70">
            <h3 className="text-sm font-bold text-[#1E1B4B]">
              Butir Soal dengan Tingkat Kesalahan Tertinggi &amp; Sebaran Pilihan Siswa
            </h3>
          </div>
          <div className="divide-y divide-slate-200/60">
            {itemAnalytics.map((item, idx) => (
              <div key={item.questionId} className="p-5 space-y-2.5 hover:bg-indigo-50/30 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-500">
                    <span className="font-mono-tabular font-bold text-[#1E1B4B]">
                      Peringkat #{idx + 1}
                    </span>
                    {' · '}
                    <span className={`font-bold ${item.subjectId === 'bahasa_indonesia' ? 'text-indigo-700' : 'text-cyan-700'}`}>
                      {item.subjectId === 'bahasa_indonesia' ? 'Bahasa Indonesia' : 'Matematika'}
                    </span>
                    {' · '}
                    <span className="font-semibold text-violet-700">{item.questionType.toUpperCase()}</span>
                  </div>
                  <div className="text-xs font-mono-tabular font-bold text-rose-600">
                    Tingkat Kesalahan: {item.errorRate}% ({item.incorrectCount} salah, {item.blankCount} kosong dari {item.totalAttempts})
                  </div>
                </div>

                <p className="text-sm font-medium text-[#1E1B4B]">{item.questionText}</p>

                <div className="neu-inset flex flex-wrap items-center gap-3 text-xs text-slate-600 p-3">
                  <span className="font-bold text-[#1E1B4B]">Sebaran Pilihan:</span>
                  {Object.entries(item.optionDistribution).length === 0 ? (
                    <span>Belum ada pilihan tercatat</span>
                  ) : (
                    Object.entries(item.optionDistribution).map(([optKey, count]) => (
                      <span key={optKey} className="font-mono-tabular">
                        {optKey}: <strong className="text-indigo-700">{count}</strong>
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Table Per Student */}
      <div className="neu-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/70">
          <h3 className="text-sm font-bold text-[#1E1B4B]">
            Daftar Nilai Per Siswa ({filteredResults.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="neu-table-head text-xs font-bold text-[#1E1B4B] border-b border-slate-200/70">
                <th className="px-5 py-3">Siswa</th>
                <th className="px-4 py-3">Sekolah</th>
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3">Paket</th>
                <th className="px-4 py-3 text-right">B / S / K</th>
                <th className="px-4 py-3 text-right">B. Indo</th>
                <th className="px-4 py-3 text-right">MTK</th>
                <th className="px-4 py-3 text-right">Nilai Akhir</th>
                <th className="px-5 py-3 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-500">
                    Belum ada hasil ujian untuk filter yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredResults.map((r) => (
                  <tr key={r.id} className="hover:bg-indigo-50/40 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-[#1E1B4B]">{r.studentName}</div>
                      <div className="text-xs text-slate-500 font-mono-tabular">NIS {r.nis}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {schoolMap.get(r.school_id)?.name || r.school_id}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular">{r.className}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate">
                      {r.packageTitle}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular text-xs">
                      <span className="text-emerald-600 font-semibold">{r.correctCount}</span> /{' '}
                      <span className="text-rose-600 font-semibold">{r.incorrectCount}</span> /{' '}
                      <span className="text-slate-500">{r.blankCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular">
                      {r.subjectBreakdown?.bahasa_indonesia?.score ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular">
                      {r.subjectBreakdown?.matematika?.score ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-bold text-indigo-700">
                      {r.finalScore}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedResult(r)}
                        className="neu-btn-soft inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#1E1B4B] hover:text-indigo-600"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Rincian</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Detail Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-modal max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-200/70 pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#1E1B4B]">
                  Rincian Nilai: {selectedResult.studentName}
                </h3>
                <p className="text-xs text-slate-500 font-mono-tabular">
                  NIS {selectedResult.nis} · Kelas {selectedResult.className} ·{' '}
                  {schoolMap.get(selectedResult.school_id)?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResult(null)}
                className="neu-btn-soft px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700"
              >
                Tutup
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="neu-inset p-3">
                <div className="text-xs text-slate-500">Nilai Akhir</div>
                <div className="text-xl font-bold font-mono-tabular text-indigo-700">
                  {selectedResult.finalScore}
                </div>
              </div>
              <div className="neu-inset p-3">
                <div className="text-xs text-slate-500">Benar</div>
                <div className="text-xl font-bold font-mono-tabular text-emerald-600">
                  {selectedResult.correctCount}
                </div>
              </div>
              <div className="neu-inset p-3">
                <div className="text-xs text-slate-500">Salah</div>
                <div className="text-xl font-bold font-mono-tabular text-rose-600">
                  {selectedResult.incorrectCount}
                </div>
              </div>
              <div className="neu-inset p-3">
                <div className="text-xs text-slate-500">Kosong</div>
                <div className="text-xl font-bold font-mono-tabular text-slate-700">
                  {selectedResult.blankCount}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#1E1B4B]">Capaian Per Indikator</h4>
              <div className="neu-surface-sm divide-y divide-slate-200/60 overflow-hidden">
                {(selectedResult.competencyBreakdown || []).map((cb, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-[#1E1B4B]">{cb.indicator}</div>
                      <div className="text-slate-500">{cb.competency}</div>
                    </div>
                    <span className="font-mono-tabular font-bold text-indigo-700 shrink-0">
                      {cb.masteryPercent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
