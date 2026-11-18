import React, { useState } from 'react';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import {
  deleteUserInvite,
  deleteUserProfile,
  saveUserInvite,
  saveUserProfile,
} from '../../lib/firestoreService';
import type { School, UserInvite, UserProfile, UserRole } from '../../types/tka';

interface UsersModuleProps {
  invites: UserInvite[];
  users: UserProfile[];
  schools: School[];
  currentUserUid: string;
}

export function UsersModule({
  invites,
  users,
  schools,
  currentUserUid,
}: UsersModuleProps) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('school_admin');
  const [schoolId, setSchoolId] = useState<string>(schools[0]?.id || 'sekolah_a');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schoolMap = new Map(schools.map((s) => [s.id, s.name]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@') || name.trim().length < 2) {
      setError('Email Google dan nama lengkap wajib diisi dengan benar.');
      return;
    }
    setSaving(true);
    try {
      await saveUserInvite({
        email: cleanEmail,
        name: name.trim(),
        role,
        school_id: role === 'super_admin' ? 'ALL' : schoolId,
        isActive: true,
        createdBy: currentUserUid,
      });

      // Also sync if user profile already exists
      const existingUser = users.find((u) => u.email.toLowerCase() === cleanEmail);
      if (existingUser) {
        await saveUserProfile({
          ...existingUser,
          name: name.trim(),
          role,
          school_id: role === 'super_admin' ? 'ALL' : schoolId,
        });
      }

      setEmail('');
      setName('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan akun pengguna.');
    } finally {
      setSaving(false);
    }
  };

  const toggleInviteActive = async (inv: UserInvite) => {
    await saveUserInvite({ ...inv, isActive: !inv.isActive });
    const existingUser = users.find((u) => u.email.toLowerCase() === inv.email.toLowerCase());
    if (existingUser) {
      await saveUserProfile({ ...existingUser, isActive: !inv.isActive });
    }
  };

  const handleDeleteInvite = async (inv: UserInvite) => {
    await deleteUserInvite(inv.email);
    const existingUser = users.find((u) => u.email.toLowerCase() === inv.email.toLowerCase());
    if (existingUser) {
      await deleteUserProfile(existingUser.uid);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#1E1B4B]">
            Manajemen Akun Admin Sekolah &amp; Guru
          </h2>
          <p className="text-sm text-slate-600">
            Daftarkan akun Google admin sekolah dan guru agar otomatis terikat pada hak akses sekolah masing-masing saat login.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="neu-btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Akun Staf</span>
        </button>
      </div>

      {/* Invited / Registered Staff Table */}
      <div className="neu-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/70">
          <h3 className="text-sm font-bold text-[#1E1B4B]">
            Daftar Akses Terotorisasi ({invites.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="neu-table-head text-xs font-bold text-[#1E1B4B] border-b border-slate-200/70">
                <th className="px-5 py-3">Nama</th>
                <th className="px-4 py-3">Email Google</th>
                <th className="px-4 py-3">Peran</th>
                <th className="px-4 py-3">Sekolah</th>
                <th className="px-4 py-3">Status Login</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {invites.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                    Belum ada akun admin sekolah atau guru tambahan yang didaftarkan.
                  </td>
                </tr>
              ) : (
                invites.map((inv) => {
                  const joined = users.some(
                    (u) => u.email.toLowerCase() === inv.email.toLowerCase(),
                  );
                  return (
                    <tr key={inv.email} className="hover:bg-indigo-50/40 transition-colors">
                      <td className="px-5 py-3 font-semibold text-[#1E1B4B]">
                        {inv.name}
                      </td>
                      <td className="px-4 py-3 font-mono-tabular text-xs text-slate-700">
                        {inv.email}
                      </td>
                      <td className="px-4 py-3 font-medium text-indigo-700">
                        {inv.role === 'super_admin'
                          ? 'Admin Utama'
                          : inv.role === 'school_admin'
                            ? 'Admin Sekolah'
                            : 'Guru'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {inv.school_id === 'ALL'
                          ? 'Semua Sekolah'
                          : schoolMap.get(inv.school_id) || inv.school_id}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={inv.isActive ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                          {inv.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                        {' · '}
                        <span className="text-slate-500">
                          {joined ? 'Sudah Login' : 'Menunggu Login'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleInviteActive(inv)}
                          className="text-xs font-semibold text-indigo-600 hover:underline"
                        >
                          {inv.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteInvite(inv)}
                          className="inline-flex items-center p-1.5 text-slate-400 hover:text-rose-600"
                          title="Hapus akun"
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
        </div>
      </div>

      {/* Active Signed-In Profiles */}
      <div className="neu-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/70">
          <h3 className="text-sm font-bold text-[#1E1B4B]">
            Profil Akun Aktif di Sistem ({users.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="neu-table-head text-xs font-bold text-[#1E1B4B] border-b border-slate-200/70">
                <th className="px-5 py-3">Nama</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Peran</th>
                <th className="px-4 py-3">Sekolah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {users.map((u) => (
                <tr key={u.uid} className="hover:bg-indigo-50/40 transition-colors">
                  <td className="px-5 py-3 font-semibold text-[#1E1B4B]">{u.name}</td>
                  <td className="px-4 py-3 text-xs font-mono-tabular text-slate-600">
                    {u.email}
                  </td>
                  <td className="px-4 py-3 font-medium text-indigo-700">
                    {u.role === 'super_admin'
                      ? 'Admin Utama'
                      : u.role === 'school_admin'
                        ? 'Admin Sekolah'
                        : 'Guru'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {u.school_id === 'ALL'
                      ? 'Semua Sekolah'
                      : schoolMap.get(u.school_id) || u.school_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neu-modal max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#1E1B4B]">Tambah Akun Staf</h3>
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap &amp; Gelar
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Ratna Sari, S.Pd."
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Email Akun Google
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="guru@sekolah.sch.id"
                  className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tingkat Akses
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="neu-input w-full px-3 py-2 rounded-xl text-sm"
                  >
                    <option value="school_admin">Admin Sekolah</option>
                    <option value="teacher">Guru</option>
                    <option value="super_admin">Admin Utama</option>
                  </select>
                </div>
                {role !== 'super_admin' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sekolah
                    </label>
                    <select
                      value={schoolId}
                      onChange={(e) => setSchoolId(e.target.value)}
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
                  className="neu-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Akun'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
