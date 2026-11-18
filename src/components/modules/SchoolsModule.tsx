import React, { useState } from 'react';
import { Building2, Edit3, Plus, Trash2, Upload } from 'lucide-react';
import { deleteSchool, sanitizeId, saveSchool, uploadAssetImage } from '../../lib/firestoreService';
import type { School } from '../../types/tka';

export function SchoolsModule({ schools }: { schools: School[] }) {
  const [editing, setEditing] = useState<School | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [npsn, setNpsn] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  const openNew = () => {
    setEditing(null);
    setId(`sekolah_${Date.now().toString().slice(-4)}`);
    setName('');
    setNpsn('');
    setAddress('');
    setLogoUrl('/src/assets/images/logo_sdn_nusantara_1794999853387.jpg');
    setIsActive(true);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (sch: School) => {
    setEditing(sch);
    setId(sch.id);
    setName(sch.name);
    setNpsn(sch.npsn);
    setAddress(sch.address);
    setLogoUrl(sch.logoUrl);
    setIsActive(sch.isActive);
    setError(null);
    setShowForm(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAssetImage(file, 'schools');
      setLogoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah logo sekolah.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanId = sanitizeId(id);
    if (!cleanId || name.trim().length < 2 || npsn.trim().length < 4) {
      setError('ID Sekolah, Nama Sekolah, dan NPSN (min. 4 karakter) wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      await saveSchool({
        id: cleanId,
        name: name.trim(),
        npsn: npsn.trim(),
        address: address.trim(),
        logoUrl: logoUrl.trim(),
        isActive,
        createdAt: editing?.createdAt,
      });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data sekolah.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (sch: School) => {
    await saveSchool({ ...sch, isActive: !sch.isActive });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#1E1B4B]">
            Manajemen Identitas Sekolah
          </h2>
          <p className="text-sm text-slate-600">
            Kelola data sekolah peserta simulasi TKA SMART. Setiap sekolah terisolasi menggunakan <span className="font-mono-tabular text-indigo-700 font-semibold">school_id</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="neu-btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Sekolah</span>
        </button>
      </div>

      {/* Schools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {schools.map((sch, idx) => (
          <div
            key={sch.id}
            className="neu-surface p-6 flex flex-col justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              {sch.logoUrl ? (
                <div className="neu-surface-sm p-1 shrink-0">
                  <img
                    src={sch.logoUrl}
                    alt={sch.name}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-lg object-cover bg-white"
                  />
                </div>
              ) : (
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${
                    idx % 2 === 0 ? 'neu-well-indigo' : 'neu-well-cyan'
                  }`}
                >
                  <Building2 className="w-7 h-7" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono-tabular text-slate-500">
                    ID: {sch.id} · NPSN: {sch.npsn}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      sch.isActive ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {sch.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#1E1B4B] mt-1 truncate">
                  {sch.name}
                </h3>
                <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                  {sch.address || 'Alamat belum diisi'}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200/70 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => toggleStatus(sch)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                {sch.isActive ? 'Nonaktifkan Sekolah' : 'Aktifkan Sekolah'}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(sch)}
                  className="neu-btn-soft inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Edit</span>
                </button>
                {schools.length > 2 && (
                  <button
                    type="button"
                    onClick={() => deleteSchool(sch.id)}
                    className="neu-btn-soft inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-modal max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#1E1B4B]">
              {editing ? 'Edit Identitas Sekolah' : 'Tambah Sekolah Baru'}
            </h3>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ID Sekolah (school_id)
                  </label>
                  <input
                    type="text"
                    value={id}
                    disabled={Boolean(editing)}
                    onChange={(e) => setId(e.target.value)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    NPSN
                  </label>
                  <input
                    type="text"
                    value={npsn}
                    onChange={(e) => setNpsn(e.target.value)}
                    placeholder="20104511"
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Sekolah
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: SDN Nusantara 01"
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Lengkap
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Logo Sekolah (Unggah atau URL)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="URL logo sekolah"
                    className="neu-input flex-1 px-3 py-2 rounded-xl text-xs"
                  />
                  <label className="neu-btn-soft inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-700 cursor-pointer shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploading ? 'Mengunggah...' : 'Unggah'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Sekolah berstatus Aktif</span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
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
                  {saving ? 'Menyimpan...' : 'Simpan Sekolah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
