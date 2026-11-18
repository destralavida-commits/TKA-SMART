import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, Plus, Search, Trash2, Upload } from 'lucide-react';
import {
  deleteSchoolClass,
  deleteStudent,
  formatFirestoreErrorMessage,
  sanitizeId,
  saveSchoolClass,
  saveStudent,
} from '../../lib/firestoreService';
import type { School, SchoolClass, Student } from '../../types/tka';

interface ClassesStudentsModuleProps {
  mode: 'classes' | 'students';
  schools: School[];
  classes: SchoolClass[];
  students: Student[];
  lockedSchoolId: string | null;
}

export function ClassesStudentsModule({
  mode,
  schools,
  classes,
  students,
  lockedSchoolId,
}: ClassesStudentsModuleProps) {
  const [schoolFilter, setSchoolFilter] = useState<string>(lockedSchoolId || 'ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Class form state
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [clsSchoolId, setClsSchoolId] = useState(lockedSchoolId || schools[0]?.id || '');
  const [clsName, setClsName] = useState('');
  const [clsTeacher, setClsTeacher] = useState('');
  const [clsYear, setClsYear] = useState('2025/2026');

  // Student form state
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [stuSchoolId, setStuSchoolId] = useState(lockedSchoolId || schools[0]?.id || '');
  const [stuClassId, setStuClassId] = useState('');
  const [stuNis, setStuNis] = useState('');
  const [stuName, setStuName] = useState('');
  const [stuGender, setStuGender] = useState<'L' | 'P'>('L');
  const [stuActive, setStuActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importNotice, setImportNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const effectiveSchoolFilter = lockedSchoolId || schoolFilter;
  const schoolMap = useMemo(() => new Map(schools.map((s) => [s.id, s.name])), [schools]);

  const defaultValidSchoolId = useMemo(() => {
    if (lockedSchoolId) return lockedSchoolId;
    if (effectiveSchoolFilter !== 'ALL' && schools.some((s) => s.id === effectiveSchoolFilter)) {
      return effectiveSchoolFilter;
    }
    return schools[0]?.id || '';
  }, [lockedSchoolId, effectiveSchoolFilter, schools]);

  useEffect(() => {
    if (lockedSchoolId) {
      setSchoolFilter(lockedSchoolId);
      setClassFilter('ALL');
    }
  }, [lockedSchoolId]);

  useEffect(() => {
    if (!clsSchoolId && defaultValidSchoolId) {
      setClsSchoolId(defaultValidSchoolId);
    }
    if (!stuSchoolId && defaultValidSchoolId) {
      setStuSchoolId(defaultValidSchoolId);
    }
  }, [clsSchoolId, stuSchoolId, defaultValidSchoolId]);

  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      if (effectiveSchoolFilter !== 'ALL' && c.school_id !== effectiveSchoolFilter) {
        return false;
      }
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [classes, effectiveSchoolFilter, searchQuery]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (effectiveSchoolFilter !== 'ALL' && s.school_id !== effectiveSchoolFilter) {
        return false;
      }
      if (classFilter !== 'ALL' && s.classId !== classFilter) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q);
      }
      return true;
    });
  }, [students, effectiveSchoolFilter, classFilter, searchQuery]);

  const openNewClass = () => {
    setEditingClass(null);
    setClsSchoolId(defaultValidSchoolId);
    setClsName('');
    setClsTeacher('');
    setClsYear('2025/2026');
    const targetExists = schools.some((s) => s.id === defaultValidSchoolId);
    setFormError(
      defaultValidSchoolId && targetExists
        ? null
        : defaultValidSchoolId
          ? `Sekolah "${defaultValidSchoolId}" belum terdaftar di database Data Sekolah. Masuk sebagai Super Admin untuk menginisialisasi data sekolah terlebih dahulu.`
          : 'Belum ada data sekolah yang tersedia. Tambahkan sekolah terlebih dahulu di menu Data Sekolah.',
    );
    setShowClassModal(true);
  };

  const openEditClass = (cls: SchoolClass) => {
    setEditingClass(cls);
    setClsSchoolId(cls.school_id);
    setClsName(cls.name);
    setClsTeacher(cls.homeroomTeacher);
    setClsYear(cls.academicYear);
    setFormError(null);
    setShowClassModal(true);
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!clsSchoolId || !schools.some((s) => s.id === clsSchoolId)) {
      setFormError(
        `Sekolah "${clsSchoolId || '-'}" belum terdaftar di database Data Sekolah. Pastikan Super Admin telah masuk dan menambahkan sekolah tersebut.`,
      );
      return;
    }
    if (!clsName.trim()) {
      setFormError('Nama kelas wajib diisi (misalnya: 6A).');
      return;
    }
    const cleanYear = clsYear.trim() || '2025/2026';
    if (cleanYear.length < 4 || cleanYear.length > 20) {
      setFormError('Tahun ajaran harus antara 4 hingga 20 karakter (misalnya: 2025/2026).');
      return;
    }
    setSaving(true);
    try {
      const id =
        editingClass?.id ||
        sanitizeId(`cls_${clsSchoolId}_${sanitizeId(clsName).toLowerCase()}_${Date.now().toString().slice(-4)}`);
      await saveSchoolClass({
        id,
        school_id: clsSchoolId,
        name: clsName.trim(),
        gradeLevel: '6',
        homeroomTeacher: clsTeacher.trim(),
        academicYear: cleanYear,
        isActive: editingClass?.isActive ?? true,
        createdAt: editingClass?.createdAt,
      });
      setShowClassModal(false);
    } catch (err) {
      setFormError(formatFirestoreErrorMessage(err, 'Gagal menyimpan data kelas.'));
    } finally {
      setSaving(false);
    }
  };

  const openNewStudent = () => {
    const defaultSch = defaultValidSchoolId;
    const firstCls = classes.find((c) => c.school_id === defaultSch);
    const targetExists = schools.some((s) => s.id === defaultSch);
    setEditingStudent(null);
    setStuSchoolId(defaultSch);
    setStuClassId(firstCls?.id || '');
    setStuNis('');
    setStuName('');
    setStuGender('L');
    setStuActive(true);
    setFormError(
      defaultSch && targetExists
        ? null
        : defaultSch
          ? `Sekolah "${defaultSch}" belum terdaftar di database Data Sekolah. Masuk sebagai Super Admin untuk menginisialisasi data sekolah terlebih dahulu.`
          : 'Belum ada data sekolah yang tersedia. Tambahkan sekolah terlebih dahulu di menu Data Sekolah.',
    );
    setShowStudentModal(true);
  };

  const openEditStudent = (st: Student) => {
    setEditingStudent(st);
    setStuSchoolId(st.school_id);
    setStuClassId(st.classId);
    setStuNis(st.nis);
    setStuName(st.name);
    setStuGender(st.gender);
    setStuActive(st.isActive);
    setFormError(null);
    setShowStudentModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!stuSchoolId || !schools.some((s) => s.id === stuSchoolId)) {
      setFormError(
        `Sekolah "${stuSchoolId || '-'}" belum terdaftar di database Data Sekolah. Pastikan Super Admin telah menambahkan sekolah tersebut.`,
      );
      return;
    }
    const cleanNis = sanitizeId(stuNis).slice(0, 30);
    const cls = classes.find((c) => c.id === stuClassId && c.school_id === stuSchoolId);
    if (!cls) {
      setFormError('Pilih kelas terlebih dahulu. Buat kelas di menu Data Kelas jika belum tersedia.');
      return;
    }
    if (cleanNis.length < 3 || stuName.trim().length < 2) {
      setFormError('NIS (min. 3 huruf/angka) dan Nama Lengkap (min. 2 huruf) wajib diisi.');
      return;
    }
    if (!editingStudent && students.some((s) => s.school_id === stuSchoolId && s.nis === cleanNis)) {
      setFormError(`NIS ${cleanNis} sudah terdaftar pada sekolah ini. Gunakan tombol Edit pada baris siswa jika ingin mengubah data.`);
      return;
    }
    setSaving(true);
    try {
      const id = editingStudent?.id || sanitizeId(`stu_${stuSchoolId}_${cleanNis}`);
      await saveStudent({
        id,
        school_id: stuSchoolId,
        classId: cls.id,
        className: cls.name,
        nis: cleanNis,
        name: stuName.trim(),
        gender: stuGender,
        isActive: stuActive,
        createdAt: editingStudent?.createdAt,
      });
      setShowStudentModal(false);
    } catch (err) {
      setFormError(formatFirestoreErrorMessage(err, 'Gagal menyimpan data siswa.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClass = async (cls: SchoolClass) => {
    try {
      await deleteSchoolClass(cls.id);
    } catch (err) {
      setImportNotice({
        type: 'error',
        text: formatFirestoreErrorMessage(err, 'Gagal menghapus kelas.'),
      });
    }
  };

  const handleDeleteStudent = async (st: Student) => {
    try {
      await deleteStudent(st);
    } catch (err) {
      setImportNotice({
        type: 'error',
        text: formatFirestoreErrorMessage(err, 'Gagal menghapus data siswa.'),
      });
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportNotice(null);
    const targetSchool = defaultValidSchoolId;
    if (!targetSchool) {
      setImportNotice({
        type: 'error',
        text: 'Belum ada sekolah tujuan untuk impor CSV. Tambahkan sekolah terlebih dahulu.',
      });
      e.target.value = '';
      return;
    }
    const schoolClasses = classes.filter((c) => c.school_id === targetSchool);
    if (schoolClasses.length === 0) {
      setImportNotice({
        type: 'error',
        text: `Belum ada kelas di ${schoolMap.get(targetSchool) || targetSchool}. Buat minimal 1 kelas terlebih dahulu sebelum mengimpor siswa.`,
      });
      e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      let imported = 0;
      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(/[;,]/).map((p) => p.trim());
        if (parts.length < 3) continue;
        if (i === 0 && parts[0].toLowerCase().includes('nis')) continue;
        const [nisRaw, nameRaw, classNameRaw, genderRaw] = parts;
        const cleanNis = sanitizeId(nisRaw).slice(0, 30);
        if (cleanNis.length < 3 || nameRaw.length < 2) continue;
        const matchedCls =
          schoolClasses.find((c) => c.name.toLowerCase() === classNameRaw.toLowerCase()) ||
          schoolClasses[0];

        await saveStudent({
          id: sanitizeId(`stu_${targetSchool}_${cleanNis}`),
          school_id: targetSchool,
          classId: matchedCls.id,
          className: matchedCls.name,
          nis: cleanNis,
          name: nameRaw,
          gender: genderRaw?.toUpperCase() === 'P' ? 'P' : 'L',
          isActive: true,
        });
        imported += 1;
      }
      setImportNotice({
        type: 'success',
        text: `Berhasil mengimpor ${imported} data siswa ke ${schoolMap.get(targetSchool) || targetSchool}.`,
      });
    } catch (err) {
      setImportNotice({
        type: 'error',
        text: formatFirestoreErrorMessage(err, 'Gagal mengimpor file CSV siswa.'),
      });
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#1E1B4B]">
            {mode === 'classes' ? 'Manajemen Data Kelas 6' : 'Manajemen Data Siswa Kelas 6'}
          </h2>
          <p className="text-sm text-slate-600">
            {mode === 'classes'
              ? 'Kelola rombongan belajar kelas 6 per sekolah.'
              : 'Kelola peserta simulasi TKA. Setiap siswa terhubung dengan sekolah, kelas, dan NIS.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {mode === 'students' && (
            <label className="neu-btn-soft inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer">
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>Impor CSV (NIS,Nama,Kelas,L/P)</span>
              <input type="file" accept=".csv,.txt" onChange={handleCsvImport} className="hidden" />
            </label>
          )}
          <button
            type="button"
            onClick={mode === 'classes' ? openNewClass : openNewStudent}
            className="neu-btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{mode === 'classes' ? 'Tambah Kelas' : 'Tambah Siswa'}</span>
          </button>
        </div>
      </div>

      {importNotice && (
        <div
          className={`neu-surface-sm p-3.5 text-sm font-medium ${
            importNotice.type === 'error'
              ? 'bg-rose-50/90 text-rose-600 border-rose-200'
              : 'bg-emerald-50/90 text-emerald-700 border-emerald-200'
          }`}
        >
          {importNotice.text}
        </div>
      )}

      {/* Filter Bar */}
      <div className="neu-surface p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={mode === 'classes' ? 'Cari nama kelas...' : 'Cari nama atau NIS siswa...'}
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

        {mode === 'students' && (
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="neu-input px-3 py-2 rounded-xl text-sm"
          >
            <option value="ALL">Semua Kelas</option>
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {schoolMap.get(c.school_id) ? `${c.name} — ${schoolMap.get(c.school_id)}` : c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="neu-surface overflow-hidden">
        <div className="overflow-x-auto">
          {mode === 'classes' ? (
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="neu-table-head text-xs font-bold text-[#1E1B4B] border-b border-slate-200/70">
                  <th className="px-5 py-3.5">Nama Kelas</th>
                  <th className="px-4 py-3.5">Sekolah</th>
                  <th className="px-4 py-3.5">Wali Kelas</th>
                  <th className="px-4 py-3.5">Tahun Ajaran</th>
                  <th className="px-4 py-3.5 text-right">Jumlah Siswa</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {filteredClasses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                      Belum ada data kelas.
                    </td>
                  </tr>
                ) : (
                  filteredClasses.map((cls) => {
                    const count = students.filter((s) => s.classId === cls.id).length;
                    return (
                      <tr key={cls.id} className="hover:bg-indigo-50/40 transition-colors">
                        <td className="px-5 py-3 font-bold text-[#1E1B4B]">Kelas {cls.name}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {schoolMap.get(cls.school_id) || cls.school_id}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {cls.homeroomTeacher || '-'}
                        </td>
                        <td className="px-4 py-3 font-mono-tabular text-slate-600">
                          {cls.academicYear}
                        </td>
                        <td className="px-4 py-3 text-right font-mono-tabular font-bold text-indigo-700">
                          {count} siswa
                        </td>
                        <td className="px-5 py-3 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditClass(cls)}
                            className="inline-flex items-center p-1.5 text-slate-600 hover:text-indigo-600"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClass(cls)}
                            className="inline-flex items-center p-1.5 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="neu-table-head text-xs font-bold text-[#1E1B4B] border-b border-slate-200/70">
                  <th className="px-5 py-3.5">NIS</th>
                  <th className="px-4 py-3.5">Nama Siswa</th>
                  <th className="px-4 py-3.5">L/P</th>
                  <th className="px-4 py-3.5">Kelas</th>
                  <th className="px-4 py-3.5">Sekolah</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                      Belum ada data siswa yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => (
                    <tr key={st.id} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="px-5 py-3 font-mono-tabular font-bold text-indigo-700">
                        {st.nis}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1E1B4B]">{st.name}</td>
                      <td className="px-4 py-3 text-slate-600">{st.gender}</td>
                      <td className="px-4 py-3 font-mono-tabular text-slate-700">{st.className}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {schoolMap.get(st.school_id) || st.school_id}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold">
                        <span className={st.isActive ? 'text-emerald-600' : 'text-rose-600'}>
                          {st.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditStudent(st)}
                          className="inline-flex items-center p-1.5 text-slate-600 hover:text-indigo-600"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(st)}
                          className="inline-flex items-center p-1.5 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Class Modal */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-modal max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#1E1B4B]">
              {editingClass ? 'Edit Data Kelas' : 'Tambah Kelas Baru'}
            </h3>
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium">
                {formError}
              </div>
            )}
            <form onSubmit={handleSaveClass} className="space-y-4">
              {!lockedSchoolId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sekolah</label>
                  <select
                    value={clsSchoolId}
                    disabled={Boolean(editingClass)}
                    onChange={(e) => setClsSchoolId(e.target.value)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm disabled:opacity-60"
                  >
                    {schools.length === 0 && (
                      <option value="">-- Belum ada data sekolah --</option>
                    )}
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Kelas
                  </label>
                  <input
                    type="text"
                    value={clsName}
                    onChange={(e) => setClsName(e.target.value)}
                    placeholder="Contoh: 6A"
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tahun Ajaran
                  </label>
                  <input
                    type="text"
                    value={clsYear}
                    onChange={(e) => setClsYear(e.target.value)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Wali Kelas
                </label>
                <input
                  type="text"
                  value={clsTeacher}
                  onChange={(e) => setClsTeacher(e.target.value)}
                  placeholder="Contoh: Ibu Ratna Sari, S.Pd."
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="neu-btn-soft px-4 py-2 rounded-xl text-sm font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="neu-btn-primary px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Kelas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-modal max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#1E1B4B]">
              {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
            </h3>
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium">
                {formError}
              </div>
            )}
            <form onSubmit={handleSaveStudent} className="space-y-4">
              {!lockedSchoolId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sekolah</label>
                  <select
                    value={stuSchoolId}
                    disabled={Boolean(editingStudent)}
                    onChange={(e) => {
                      const nextSch = e.target.value;
                      setStuSchoolId(nextSch);
                      const firstCls = classes.find((c) => c.school_id === nextSch);
                      setStuClassId(firstCls?.id || '');
                    }}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm disabled:opacity-60"
                  >
                    {schools.length === 0 && (
                      <option value="">-- Belum ada data sekolah --</option>
                    )}
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NIS</label>
                  <input
                    type="text"
                    value={stuNis}
                    disabled={Boolean(editingStudent)}
                    onChange={(e) => setStuNis(e.target.value)}
                    placeholder="260109"
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kelas</label>
                  <select
                    value={stuClassId}
                    onChange={(e) => setStuClassId(e.target.value)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  >
                    {classes.filter((c) => c.school_id === stuSchoolId).length === 0 && (
                      <option value="">-- Belum ada kelas --</option>
                    )}
                    {classes
                      .filter((c) => c.school_id === stuSchoolId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          Kelas {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              {stuSchoolId && classes.filter((c) => c.school_id === stuSchoolId).length === 0 && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Sekolah ini belum memiliki kelas. Buat kelas terlebih dahulu di menu Data Kelas.
                </p>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Siswa
                </label>
                <input
                  type="text"
                  value={stuName}
                  onChange={(e) => setStuName(e.target.value)}
                  placeholder="Nama lengkap siswa"
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={stuGender === 'L'}
                      onChange={() => setStuGender('L')}
                    />
                    <span>Laki-laki</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={stuGender === 'P'}
                      onChange={() => setStuGender('P')}
                    />
                    <span>Perempuan</span>
                  </label>
                </div>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={stuActive}
                    onChange={(e) => setStuActive(e.target.checked)}
                  />
                  <span>Aktif</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="neu-btn-soft px-4 py-2 rounded-xl text-sm font-semibold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="neu-btn-primary px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
