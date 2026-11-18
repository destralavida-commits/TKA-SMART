import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Trash2 } from 'lucide-react';
import { clearDemoData, seedDemoData } from '../../lib/demoSeed';
import { formatFirestoreErrorMessage } from '../../lib/firestoreService';

interface SettingsModuleProps {
  currentUserUid: string;
  demoCount: number;
}

export function SettingsModule({ currentUserUid, demoCount }: SettingsModuleProps) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleSeed = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await seedDemoData(currentUserUid);
      setNotice(
        'Data demonstrasi lengkap (2 sekolah, 4 kelas, 12 siswa, 4 stimulus, 10 soal, 3 paket simulasi, dan contoh hasil) berhasil ditambahkan.',
      );
    } catch (err) {
      setNotice(formatFirestoreErrorMessage(err, 'Gagal memuat data demonstrasi.'));
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const removed = await clearDemoData();
      setConfirmClear(false);
      setNotice(
        `Berhasil menghapus ${removed} data demonstrasi. Identitas kedua sekolah tetap dipertahankan agar siap diisi data resmi.`,
      );
    } catch (err) {
      setNotice(formatFirestoreErrorMessage(err, 'Gagal menghapus data demonstrasi.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-[#1E1B4B]">Pengaturan Sistem &amp; Data Demonstrasi</h2>
        <p className="text-sm text-slate-600">
          Kelola data contoh demonstrasi sebelum TKA SMART digunakan secara resmi oleh kedua sekolah.
        </p>
      </div>

      {notice && (
        <div className="neu-surface-sm p-4 text-sm text-[#1E1B4B] flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg neu-well-emerald flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="pt-1">{notice}</span>
        </div>
      )}

      <div className="neu-surface p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 pb-4">
          <div>
            <h3 className="text-base font-bold text-[#1E1B4B]">
              Data Demonstrasi Awal
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Saat ini terdapat <strong className="font-mono-tabular text-indigo-700">{demoCount}</strong> data bertanda demonstrasi di database. Anda dapat memuat ulang contoh untuk uji coba atau membersihkannya sebelum ujian resmi.
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl neu-well-indigo flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSeed}
            disabled={busy}
            className="neu-btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
          >
            <Database className="w-4 h-4" />
            <span>{busy ? 'Memproses...' : 'Muat / Reset Data Demonstrasi'}</span>
          </button>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={busy || demoCount === 0}
              className="neu-btn-soft inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-rose-600 text-sm font-semibold disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus Semua Data Demonstrasi</span>
            </button>
          ) : (
            <div className="neu-inset flex flex-wrap items-center gap-2.5 px-3.5 py-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span className="text-xs font-semibold text-rose-700">
                Yakin hapus semua data demo?
              </span>
              <button
                type="button"
                onClick={handleClear}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-red-600 text-white text-xs font-semibold shadow-sm"
              >
                Ya, Hapus
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="neu-btn-soft px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700"
              >
                Batal
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="neu-surface p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl neu-well-emerald flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-[#1E1B4B]">
            Ringkasan Keamanan &amp; Isolasi Multi-Sekolah
          </h3>
        </div>
        <ul className="space-y-2.5 text-sm text-slate-700 list-disc pl-5">
          <li>
            Setiap data kelas, siswa, sesi ujian, lembar jawaban, dan hasil ujian terikat dengan <span className="font-mono-tabular font-semibold text-indigo-700">school_id</span> dan dijaga oleh aturan Firestore Security Rules.
          </li>
          <li>
            Kunci jawaban dan pembahasan hanya tersimpan pada koleksi <span className="font-mono-tabular font-semibold text-indigo-700">question_bank</span> dan <span className="font-mono-tabular font-semibold text-indigo-700">exam_result_reviews</span>, sehingga tidak pernah terkirim ke perangkat siswa selama ujian berlangsung.
          </li>
          <li>
            Pengiriman jawaban ganda dicegah melalui penguncian status terminal pada dokumen <span className="font-mono-tabular font-semibold text-indigo-700">exam_attempts</span>.
          </li>
        </ul>
      </div>
    </div>
  );
}
