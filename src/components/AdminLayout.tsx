import React, { useState } from 'react';
import {
  BarChart3,
  BookOpenCheck,
  Building2,
  ClipboardList,
  FileBarChart2,
  GitCompare,
  GraduationCap,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  PlaySquare,
  Settings,
  Users,
  X,
} from 'lucide-react';
import type { AdminNavTab, School, UserProfile } from '../types/tka';

interface AdminLayoutProps {
  profile: UserProfile;
  schools: School[];
  activeTab: AdminNavTab;
  onSelectTab: (tab: AdminNavTab) => void;
  previewSchoolId: string | null;
  onChangePreviewSchool: (schoolId: string | null) => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

export function AdminLayout({
  profile,
  schools,
  activeTab,
  onSelectTab,
  previewSchoolId,
  onChangePreviewSchool,
  onSignOut,
  children,
}: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isSuperAdmin = profile.role === 'super_admin';

  const superAdminNav: Array<{
    id: AdminNavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, accent: 'text-sky-300' },
    { id: 'schools', label: 'Data Sekolah', icon: Building2, accent: 'text-indigo-300' },
    { id: 'users', label: 'Akun Pengguna', icon: Users, accent: 'text-violet-300' },
    { id: 'classes', label: 'Data Kelas', icon: Layers, accent: 'text-cyan-300' },
    { id: 'students', label: 'Data Siswa', icon: GraduationCap, accent: 'text-emerald-300' },
    { id: 'question_bank', label: 'Bank Soal', icon: BookOpenCheck, accent: 'text-amber-300' },
    { id: 'packages', label: 'Paket Simulasi', icon: ClipboardList, accent: 'text-pink-300' },
    { id: 'execution', label: 'Pelaksanaan Ujian', icon: PlaySquare, accent: 'text-teal-300' },
    { id: 'analytics', label: 'Hasil dan Analisis', icon: BarChart3, accent: 'text-blue-300' },
    { id: 'comparison', label: 'Perbandingan Sekolah', icon: GitCompare, accent: 'text-purple-300' },
    { id: 'reports', label: 'Laporan', icon: FileBarChart2, accent: 'text-lime-300' },
    { id: 'settings', label: 'Pengaturan', icon: Settings, accent: 'text-slate-300' },
  ];

  const schoolStaffNav: Array<{
    id: AdminNavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, accent: 'text-sky-300' },
    { id: 'students', label: 'Data Siswa', icon: GraduationCap, accent: 'text-emerald-300' },
    { id: 'classes', label: 'Data Kelas', icon: Layers, accent: 'text-cyan-300' },
    { id: 'packages', label: 'Paket Simulasi', icon: ClipboardList, accent: 'text-pink-300' },
    { id: 'execution', label: 'Pelaksanaan Ujian', icon: PlaySquare, accent: 'text-teal-300' },
    { id: 'results', label: 'Hasil Ujian', icon: BarChart3, accent: 'text-blue-300' },
    { id: 'analytics', label: 'Analisis Nilai', icon: GitCompare, accent: 'text-violet-300' },
    { id: 'reports', label: 'Laporan', icon: FileBarChart2, accent: 'text-amber-300' },
  ];

  const navItems = isSuperAdmin ? superAdminNav : schoolStaffNav;
  const currentSchoolName = isSuperAdmin
    ? previewSchoolId
      ? schools.find((s) => s.id === previewSchoolId)?.name || previewSchoolId
      : 'Semua Sekolah (Terpusat)'
    : schools.find((s) => s.id === profile.school_id)?.name || profile.school_id;

  const activeNavLabel = navItems.find((n) => n.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="min-h-screen flex">
      {/* Sidebar Desktop */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 neu-sidebar text-white">
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          <img
            src="/assets/aistudio/image_527feef0.png"
            alt="Logo TKA SMART"
            className="w-10 h-10 rounded-xl object-contain bg-white p-0.5 shadow-md shrink-0"
          />
          <div className="min-w-0">
            <div className="text-base font-extrabold tracking-tight text-white">TKA SMART</div>
            <div className="text-[11px] text-cyan-200/90 font-medium truncate">
              {isSuperAdmin ? 'Admin Utama' : profile.role === 'school_admin' ? 'Admin Sekolah' : 'Guru Kelas 6'}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  active
                    ? 'bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#06B6D4] text-white shadow-[0_8px_18px_-4px_rgba(59,130,246,0.55)] font-semibold'
                    : 'text-indigo-100/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : item.accent}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3 bg-black/15">
          <div className="text-xs space-y-0.5">
            <div className="font-semibold text-white truncate">{profile.name}</div>
            <div className="text-indigo-200/80 truncate">{profile.email}</div>
            <div className="text-[11px] text-cyan-200/90 font-medium truncate">
              {isSuperAdmin
                ? 'Peran: Admin Utama (Semua Sekolah)'
                : `Peran: ${profile.role === 'school_admin' ? 'Admin Sekolah' : 'Guru'} · ${profile.school_id}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isSuperAdmin ? 'Keluar Akun' : 'Keluar / Ganti Akun'}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 max-w-full neu-sidebar text-white flex flex-col z-10">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/aistudio/image_527feef0.png"
                  alt="Logo TKA SMART"
                  className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shrink-0"
                />
                <span className="font-bold">TKA SMART</span>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-left ${
                      active
                        ? 'bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white shadow-md'
                        : 'text-indigo-100/80 hover:bg-white/10'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : item.accent}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10">
              <button
                type="button"
                onClick={onSignOut}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 text-xs font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="no-print sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-white/90 shadow-[0_6px_22px_rgba(148,163,184,0.12)] px-4 sm:px-8 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden neu-btn-soft p-2 rounded-xl text-slate-700"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="text-sm text-slate-500 flex items-center gap-2 truncate">
                <span className="font-bold text-[#1E1B4B]">{activeNavLabel}</span>
                <span aria-hidden="true">/</span>
                <span className="truncate text-[#4F46E5] font-medium">{currentSchoolName}</span>
              </div>
            </div>

            {isSuperAdmin && (
              <div className="flex items-center gap-2 shrink-0">
                <select
                  aria-label="Filter konteks sekolah"
                  value={previewSchoolId || 'ALL'}
                  onChange={(e) =>
                    onChangePreviewSchool(e.target.value === 'ALL' ? null : e.target.value)
                  }
                  className="neu-input px-3 py-1.5 rounded-xl text-xs font-semibold text-[#1E1B4B]"
                >
                  <option value="ALL">Konteks: Kedua Sekolah</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      Fokus: {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>

        <footer className="no-print border-t border-white/80 bg-white/75 backdrop-blur-sm px-4 sm:px-8 py-3.5 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>TKA SMART · Simulasi Tes Kompetensi Akademik SD Kelas 6</span>
          <span className="font-semibold text-[#4F46E5]">@destra.studio</span>
        </footer>
      </div>
    </div>
  );
}
