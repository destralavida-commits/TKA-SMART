import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  GraduationCap,
  KeyRound,
  LogIn,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type { School } from '../types/tka';

interface PortalAuthProps {
  onStudentLogin: (nis: string, token: string, schoolId?: string) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
  onGoogleRedirectLogin?: () => Promise<void>;
  authLoading: boolean;
  authError: string | null;
  popupBlocked?: boolean;
  schools: School[];
}

export function PortalAuth({
  onStudentLogin,
  onGoogleLogin,
  onGoogleRedirectLogin,
  authLoading,
  authError,
  popupBlocked = false,
  schools,
}: PortalAuthProps) {
  const [nis, setNis] = useState('');
  const [token, setToken] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError(null);
    if (!nis.trim() || !token.trim()) {
      setStudentError('Masukkan NIS dan Token Ujian terlebih dahulu.');
      return;
    }
    setStudentLoading(true);
    try {
      await onStudentLogin(nis.trim(), token.trim().toUpperCase(), selectedSchoolId || undefined);
    } catch (err) {
      setStudentError(err instanceof Error ? err.message : 'Gagal memvalidasi data ujian.');
    } finally {
      setStudentLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Clean 3-zone Soft Neumorphic Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-white/80 shadow-[0_6px_24px_rgba(148,163,184,0.12)] px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <img
              src="/assets/aistudio/image_527feef0.png"
              alt="Logo TKA SMART"
              className="w-10 h-10 rounded-xl object-contain bg-white border border-slate-200/80 shadow-sm p-0.5 shrink-0"
            />
            <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-[#1E3A8A] via-[#4F46E5] to-[#0EA5E9] bg-clip-text text-transparent">
              TKA SMART
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-sm font-medium text-slate-600">
            <span>Simulasi Tes Kompetensi Akademik</span>
            <span aria-hidden="true">·</span>
            <span className="text-indigo-700 font-semibold">SD Kelas 6</span>
          </div>

          <button
            type="button"
            onClick={() => {
              document
                .getElementById('staff-auth-panel')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              void onGoogleLogin();
            }}
            disabled={authLoading}
            className="neu-btn-soft inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#1E3A8A] whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <LogIn className="w-4 h-4 text-[#4F46E5]" />
            <span>{authLoading ? 'Memproses...' : 'Portal Admin & Guru'}</span>
          </button>
        </div>
      </header>

      {/* Main 2-column Soft Neumorphism Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-stretch">
          {/* Left: Student Exam Entry */}
          <section className="lg:col-span-7 neu-surface p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-[#4F46E5] mb-3">
                <span className="w-7 h-7 rounded-lg neu-well-indigo flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </span>
                <span>Masuk Peserta Didik Kelas 6</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E1B4B] tracking-tight mb-2 [text-wrap:balance]">
                Masuk Ruang Simulasi Ujian
              </h1>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Masukkan NIS dan Token Ujian yang diberikan oleh guru atau pengawas sekolahmu. Tidak perlu email atau kata sandi.
              </p>

              {studentError && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-sm text-rose-700 shadow-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{studentError}</span>
                </div>
              )}

              <form onSubmit={handleStudentSubmit} className="space-y-4">
                {schools.length > 0 && (
                  <div>
                    <label
                      htmlFor="student-school"
                      className="block text-sm font-semibold text-slate-700 mb-1.5"
                    >
                      Asal Sekolah (Opsional)
                    </label>
                    <select
                      id="student-school"
                      value={selectedSchoolId}
                      onChange={(e) => setSelectedSchoolId(e.target.value)}
                      className="neu-input w-full px-3.5 py-2.5 rounded-xl text-sm text-slate-900"
                    >
                      <option value="">Deteksi otomatis dari NIS &amp; Token</option>
                      {schools
                        .filter((s) => s.isActive)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} (NPSN: {s.npsn})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="student-nis"
                    className="block text-sm font-semibold text-slate-700 mb-1.5"
                  >
                    Nomor Induk Siswa (NIS)
                  </label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-indigo-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="student-nis"
                      type="text"
                      value={nis}
                      onChange={(e) => setNis(e.target.value)}
                      placeholder="Contoh: 260101"
                      autoComplete="off"
                      className="neu-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-mono-tabular text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="student-token"
                    className="block text-sm font-semibold text-slate-700 mb-1.5"
                  >
                    Token Ujian
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-cyan-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="student-token"
                      type="text"
                      value={token}
                      onChange={(e) => setToken(e.target.value.toUpperCase())}
                      placeholder="Contoh: TKASMART26"
                      autoComplete="off"
                      className="neu-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-mono-tabular uppercase tracking-wider text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={studentLoading}
                  className="neu-btn-primary w-full mt-2 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
                >
                  <span>{studentLoading ? 'Memeriksa NIS & Token...' : 'Lanjut ke Petunjuk Ujian'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            <div className="mt-6 neu-inset px-4 py-3 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
              <span>Simpan jawaban otomatis setiap saat · Aman jika koneksi terputus</span>
              <span className="font-mono-tabular font-semibold text-[#4F46E5]">
                Uji coba: NIS 260101 · Token TKASMART26
              </span>
            </div>
          </section>

          {/* Right: Admin & Teacher Colorful Gradient Soft-Neumorphism Card */}
          <aside
            id="staff-auth-panel"
            className="lg:col-span-5 rounded-[1.125rem] bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#0284C7] text-white p-6 sm:p-8 flex flex-col justify-between shadow-[12px_12px_28px_rgba(30,27,75,0.24),-6px_-6px_18px_rgba(255,255,255,0.75)] border border-white/20"
          >
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 mb-3">
                <ShieldCheck className="w-4 h-4" />
                <span>Akses Pengelola &amp; Guru</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
                Dasbor Terpadu Dua Sekolah
              </h2>
              <p className="text-sm text-indigo-100/90 leading-relaxed mb-6">
                Masuk menggunakan akun Google terdaftar untuk mengelola bank soal bersama, paket simulasi, pemantauan peserta langsung, analisis indikator, dan cetak laporan PDF/Excel.
              </p>

              <div className="space-y-3 text-sm text-white/95 mb-8">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15">
                  <span className="text-cyan-300 font-bold font-mono-tabular">01.</span>
                  <span>Admin Utama mengelola 2 sekolah, akun guru, bank soal, dan perbandingan hasil.</span>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15">
                  <span className="text-emerald-300 font-bold font-mono-tabular">02.</span>
                  <span>Admin Sekolah &amp; Guru mengelola siswa, kelas, token sesi, dan hasil sekolahnya sendiri.</span>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15">
                  <span className="text-amber-300 font-bold font-mono-tabular">03.</span>
                  <span>Pembatasan data per sekolah dijaga langsung oleh aturan keamanan Firestore.</span>
                </div>
              </div>
            </div>

            <div>
              {authError && (
                <div className="mb-4 p-3.5 rounded-xl bg-rose-950/75 border border-rose-300/50 text-xs text-rose-100 flex items-start gap-2.5 leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-300" />
                  <div className="space-y-2 flex-1">
                    <p>{authError}</p>
                    {popupBlocked && onGoogleRedirectLogin && (
                      <button
                        type="button"
                        onClick={onGoogleRedirectLogin}
                        disabled={authLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold border border-white/25 transition-colors disabled:opacity-60"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Masuk via Pengalihan (Redirect)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={onGoogleLogin}
                disabled={authLoading}
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-white text-[#1E1B4B] text-sm font-bold shadow-[0_10px_24px_rgba(15,23,42,0.25)] hover:bg-indigo-50 transition-all disabled:opacity-60"
              >
                <LogIn className="w-4 h-4 text-[#4F46E5]" />
                <span>{authLoading ? 'Menghubungkan Akun...' : 'Masuk dengan Google'}</span>
              </button>
              <div className="mt-3 text-xs text-indigo-100/90 text-center space-y-1">
                <p>Khusus Admin Utama, Admin Sekolah, dan Guru yang telah terdaftar.</p>
                <p className="text-[11px] text-cyan-200/95">
                  Login Super Admin (Admin Utama): klik tombol di atas lalu pilih akun Google{' '}
                  <span className="font-mono-tabular font-semibold text-white">
                    nurwijayanti24@guru.sd.belajar.id
                  </span>
                  .
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-white/80 bg-white/75 backdrop-blur-sm px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>TKA SMART · Tes Kompetensi Akademik Digital SD Kelas 6</span>
          <span className="font-semibold text-[#4F46E5]">@destra.studio</span>
        </div>
      </footer>
    </div>
  );
}
