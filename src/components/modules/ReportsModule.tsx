import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { downloadCsv, downloadExcelHtml, printReportPdf } from '../../lib/exportUtils';
import type {
  ExamPackage,
  ExamResult,
  School,
  SchoolClass,
  UserRole,
} from '../../types/tka';

type ReportKind =
  | 'rekap_sekolah'
  | 'rekap_kelas'
  | 'hasil_siswa'
  | 'analisis_kompetensi'
  | 'perbandingan_sekolah';

interface ReportsModuleProps {
  role: UserRole;
  lockedSchoolId: string | null;
  schools: School[];
  classes: SchoolClass[];
  packages: ExamPackage[];
  results: ExamResult[];
}

export function ReportsModule({
  role,
  lockedSchoolId,
  schools,
  classes,
  packages,
  results,
}: ReportsModuleProps) {
  const [reportKind, setReportKind] = useState<ReportKind>('rekap_sekolah');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(
    lockedSchoolId || schools[0]?.id || 'sekolah_a',
  );
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedPackageId, setSelectedPackageId] = useState<string>('ALL');
  const [selectedStudentResultId, setSelectedStudentResultId] = useState<string>('');

  const effectiveSchoolId = lockedSchoolId || selectedSchoolId;
  const activeSchool = schools.find((s) => s.id === effectiveSchoolId) || schools[0];
  const activePackage = packages.find((p) => p.id === selectedPackageId);

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (reportKind !== 'perbandingan_sekolah' && r.school_id !== effectiveSchoolId) {
        return false;
      }
      if (selectedPackageId !== 'ALL' && r.packageId !== selectedPackageId) return false;
      if (
        (reportKind === 'rekap_kelas' || reportKind === 'hasil_siswa') &&
        selectedClassId !== 'ALL' &&
        r.classId !== selectedClassId
      ) {
        return false;
      }
      return true;
    });
  }, [results, reportKind, effectiveSchoolId, selectedPackageId, selectedClassId]);

  const studentResult =
    filteredResults.find((r) => r.id === selectedStudentResultId) || filteredResults[0];

  const reportSubjectLabel = activePackage
    ? activePackage.subjectMode === 'gabungan'
      ? 'Bahasa Indonesia & Matematika'
      : activePackage.subjectMode === 'bahasa_indonesia'
        ? 'Bahasa Indonesia'
        : 'Matematika'
    : 'Semua Mata Pelajaran (B. Indonesia & Matematika)';

  const reportDateLabel = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Build tabular dataset for CSV / Excel export
  const buildExportData = (): {
    title: string;
    headers: string[];
    rows: (string | number)[][];
  } => {
    if (reportKind === 'perbandingan_sekolah') {
      const headers = [
        'Nama Sekolah',
        'NPSN',
        'Jumlah Peserta',
        'Rata-rata Nilai',
        'Rata-rata B. Indonesia',
        'Rata-rata Matematika',
        'Ketuntasan (%)',
      ];
      const rows = schools.map((sch) => {
        const list = results.filter(
          (r) =>
            r.school_id === sch.id &&
            (selectedPackageId === 'ALL' || r.packageId === selectedPackageId),
        );
        const count = list.length;
        const avg = count
          ? Number((list.reduce((a, b) => a + b.finalScore, 0) / count).toFixed(1))
          : 0;
        const bindo = list
          .map((r) => r.subjectBreakdown?.bahasa_indonesia?.score)
          .filter((x): x is number => typeof x === 'number');
        const mtk = list
          .map((r) => r.subjectBreakdown?.matematika?.score)
          .filter((x): x is number => typeof x === 'number');
        const avgB = bindo.length
          ? Number((bindo.reduce((a, b) => a + b, 0) / bindo.length).toFixed(1))
          : 0;
        const avgM = mtk.length
          ? Number((mtk.reduce((a, b) => a + b, 0) / mtk.length).toFixed(1))
          : 0;
        const pass = count
          ? Math.round((list.filter((r) => r.finalScore >= 75).length / count) * 100)
          : 0;
        return [sch.name, sch.npsn, count, avg, avgB, avgM, `${pass}%`];
      });
      return { title: 'Perbandingan Kedua Sekolah', headers, rows };
    }

    if (reportKind === 'analisis_kompetensi') {
      const map: Record<
        string,
        { subj: string; comp: string; ind: string; sum: number; count: number }
      > = {};
      for (const r of filteredResults) {
        for (const c of r.competencyBreakdown || []) {
          const k = `${c.subjectId}::${c.indicator}`;
          if (!map[k]) {
            map[k] = {
              subj: c.subjectId === 'bahasa_indonesia' ? 'Bahasa Indonesia' : 'Matematika',
              comp: c.competency,
              ind: c.indicator,
              sum: 0,
              count: 0,
            };
          }
          map[k].sum += c.masteryPercent;
          map[k].count += 1;
        }
      }
      const rows = Object.values(map).map((x) => [
        x.subj,
        x.comp,
        x.ind,
        x.count,
        `${x.count ? Number((x.sum / x.count).toFixed(1)) : 0}%`,
      ]);
      return {
        title: 'Analisis Kompetensi & Indikator',
        headers: ['Mata Pelajaran', 'Kompetensi', 'Indikator', 'Sampel', 'Ketuntasan (%)'],
        rows,
      };
    }

    if (reportKind === 'hasil_siswa' && studentResult) {
      return {
        title: `Laporan Individu - ${studentResult.studentName}`,
        headers: ['No', 'Mata Pelajaran', 'Topik', 'Indikator', 'Status', 'Poin', 'Maks'],
        rows: (studentResult.itemResults || []).map((ir, idx) => [
          idx + 1,
          ir.subjectId === 'bahasa_indonesia' ? 'Bahasa Indonesia' : 'Matematika',
          ir.topic,
          ir.indicator,
          !ir.isAnswered ? 'Kosong' : ir.isCorrect ? 'Benar' : 'Salah',
          ir.earnedPoints,
          ir.maxPoints,
        ]),
      };
    }

    return {
      title:
        reportKind === 'rekap_kelas'
          ? 'Rekap Nilai Per Kelas'
          : 'Rekap Hasil Simulasi Sekolah',
      headers: [
        'No',
        'NIS',
        'Nama Siswa',
        'Kelas',
        'Paket Simulasi',
        'Benar',
        'Salah',
        'Kosong',
        'B. Indonesia',
        'Matematika',
        'Nilai Akhir',
      ],
      rows: filteredResults.map((r, i) => [
        i + 1,
        r.nis,
        r.studentName,
        r.className,
        r.packageTitle,
        r.correctCount,
        r.incorrectCount,
        r.blankCount,
        r.subjectBreakdown?.bahasa_indonesia?.score ?? '-',
        r.subjectBreakdown?.matematika?.score ?? '-',
        r.finalScore,
      ]),
    };
  };

  const handleDownloadCsv = () => {
    const exp = buildExportData();
    downloadCsv(`tka_smart_${reportKind}`, exp.headers, exp.rows);
  };

  const handleDownloadExcel = () => {
    const exp = buildExportData();
    const subtitle = `${
      reportKind === 'perbandingan_sekolah'
        ? 'Gabungan Kedua Sekolah'
        : activeSchool?.name || ''
    } · ${reportSubjectLabel} · ${reportDateLabel}`;
    downloadExcelHtml(`tka_smart_${reportKind}`, exp.title, subtitle, exp.headers, exp.rows);
  };

  const exportTable = buildExportData();

  return (
    <div className="space-y-6">
      {/* Controls (Hidden on Print) */}
      <div className="no-print space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#1E1B4B]">
              Pusat Laporan Resmi TKA SMART
            </h2>
            <p className="text-sm text-slate-600">
              Cetak laporan ke PDF atau ekspor ke Excel/CSV lengkap dengan identitas sekolah dan rekap nilai.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="neu-btn-soft inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700"
            >
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Unduh CSV</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="neu-btn-soft inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Unduh Excel (.xls)</span>
            </button>
            <button
              type="button"
              onClick={() => printReportPdf(exportTable.title)}
              className="neu-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Laporan PDF</span>
            </button>
          </div>
        </div>

        {/* Report Selector Bar */}
        <div className="neu-surface p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Jenis Laporan
            </label>
            <select
              value={reportKind}
              onChange={(e) => setReportKind(e.target.value as ReportKind)}
              className="neu-input w-full px-3 py-2 rounded-xl text-sm"
            >
              <option value="rekap_sekolah">Rekap Per Sekolah</option>
              <option value="rekap_kelas">Rekap Per Kelas</option>
              <option value="hasil_siswa">Hasil Per Siswa</option>
              <option value="analisis_kompetensi">Analisis Kompetensi</option>
              {role === 'super_admin' && (
                <option value="perbandingan_sekolah">Perbandingan Kedua Sekolah</option>
              )}
            </select>
          </div>

          {!lockedSchoolId && reportKind !== 'perbandingan_sekolah' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Sekolah
              </label>
              <select
                value={selectedSchoolId}
                onChange={(e) => {
                  setSelectedSchoolId(e.target.value);
                  setSelectedClassId('ALL');
                }}
                className="neu-input w-full px-3 py-2 rounded-xl text-sm"
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(reportKind === 'rekap_kelas' || reportKind === 'hasil_siswa') && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Kelas
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="neu-input w-full px-3 py-2 rounded-xl text-sm"
              >
                <option value="ALL">Semua Kelas 6</option>
                {classes
                  .filter((c) => c.school_id === effectiveSchoolId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      Kelas {c.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Paket Simulasi
            </label>
            <select
              value={selectedPackageId}
              onChange={(e) => setSelectedPackageId(e.target.value)}
              className="neu-input w-full px-3 py-2 rounded-xl text-sm"
            >
              <option value="ALL">Semua Paket Simulasi</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          {reportKind === 'hasil_siswa' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Pilih Siswa
              </label>
              <select
                value={studentResult?.id || ''}
                onChange={(e) => setSelectedStudentResultId(e.target.value)}
                className="neu-input w-full px-3 py-2 rounded-xl text-sm"
              >
                {filteredResults.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.studentName} (NIS {r.nis})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* PRINTABLE REPORT SHEET */}
      <div className="print-container neu-surface p-6 sm:p-10 space-y-6">
        {/* Official Header */}
        <div className="border-b-2 border-[#1E1B4B] pb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={
                reportKind !== 'perbandingan_sekolah' && activeSchool?.logoUrl
                  ? activeSchool.logoUrl
                  : '/assets/aistudio/image_527feef0.png'
              }
              alt={
                reportKind !== 'perbandingan_sekolah' && activeSchool?.name
                  ? activeSchool.name
                  : 'Logo TKA SMART'
              }
              className="w-14 h-14 rounded-xl object-contain border border-slate-200 bg-white p-0.5 shrink-0"
            />
            <div>
              <div className="text-xs font-bold tracking-wider text-indigo-600 uppercase">
                TKA SMART — Tes Kompetensi Akademik Digital SD Kelas 6
              </div>
              <h1 className="text-xl font-bold text-[#1E1B4B] mt-0.5">
                {exportTable.title}
              </h1>
              <div className="text-xs text-slate-600 mt-1">
                {reportKind === 'perbandingan_sekolah'
                  ? 'Laporan Gabungan Dua Sekolah Peserta Simulasi'
                  : `${activeSchool?.name || ''} · NPSN ${activeSchool?.npsn || '-'} · ${activeSchool?.address || ''}`}
              </div>
            </div>
          </div>

          <div className="text-right text-xs text-slate-600 shrink-0">
            <div>
              <strong>Mata Pelajaran:</strong> {reportSubjectLabel}
            </div>
            <div>
              <strong>Tanggal Cetak:</strong> {reportDateLabel}
            </div>
          </div>
        </div>

        {/* Individual Student Meta if hasil_siswa */}
        {reportKind === 'hasil_siswa' && studentResult && (
          <div className="neu-inset grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 text-xs">
            <div>
              <div className="text-slate-500">Nama Peserta</div>
              <div className="font-bold text-[#1E1B4B] text-sm">{studentResult.studentName}</div>
            </div>
            <div>
              <div className="text-slate-500">NIS / Kelas</div>
              <div className="font-mono-tabular font-semibold text-slate-800 text-sm">
                {studentResult.nis} / {studentResult.className}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Benar / Salah / Kosong</div>
              <div className="font-mono-tabular font-semibold text-slate-800 text-sm">
                {studentResult.correctCount} / {studentResult.incorrectCount} /{' '}
                {studentResult.blankCount}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Nilai Akhir</div>
              <div className="font-mono-tabular font-bold text-indigo-700 text-lg">
                {studentResult.finalScore}
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-300">
          <table className="w-full text-xs sm:text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-[#1E1B4B] via-[#1E3A8A] to-[#312E81] text-white">
                {exportTable.headers.map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 border border-slate-300/40 font-semibold whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exportTable.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={exportTable.headers.length}
                    className="px-4 py-8 text-center text-slate-500 border border-slate-300"
                  >
                    Belum ada data hasil simulasi untuk dicetak pada laporan ini.
                  </td>
                </tr>
              ) : (
                exportTable.rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className={rIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}
                  >
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`px-3 py-2 border border-slate-300 ${
                          typeof cell === 'number' || /^\d+([.,]\d+)?%?$/.test(String(cell))
                            ? 'font-mono-tabular'
                            : ''
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Print Signature Block */}
        <div className="pt-8 grid grid-cols-2 gap-8 text-xs text-slate-700 print-break-inside-avoid">
          <div>
            <div>Mengetahui,</div>
            <div className="font-semibold">
              {reportKind === 'perbandingan_sekolah'
                ? 'Koordinator Admin Utama TKA SMART'
                : `Kepala ${activeSchool?.name || 'Sekolah'}`}
            </div>
            <div className="h-16" />
            <div className="font-semibold border-t border-slate-400 inline-block pt-1 min-w-[180px]">
              ( ........................................ )
            </div>
          </div>
          <div className="text-right">
            <div>{reportDateLabel}</div>
            <div className="font-semibold">Guru / Pengawas Kelas 6</div>
            <div className="h-16" />
            <div className="font-semibold border-t border-slate-400 inline-block pt-1 min-w-[180px] text-left">
              ( ........................................ )
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
          <span>Dicetak melalui TKA SMART · Tes Kompetensi Akademik Digital SD Kelas 6</span>
          <span>@destra.studio</span>
        </div>
      </div>
    </div>
  );
}
