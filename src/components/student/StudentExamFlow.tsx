import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Flag,
  LogOut,
  Send,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  createExamAttempt,
  updateExamAttemptProgress,
  upsertStudentAnswerDoc,
} from '../../lib/firestoreService';
import { isQuestionAnswered } from '../../lib/grading';
import { StimulusRenderer } from '../StimulusRenderer';
import type {
  ExamAttempt,
  ExamPackage,
  ExamResult,
  ExamResultReview,
  ExamToken,
  QuestionOption,
  School,
  StudentAnswerPayload,
  StudentDirectoryEntry,
  StudentExamItem,
} from '../../types/tka';

export interface StudentSessionPayload {
  token: ExamToken;
  examPackage: ExamPackage;
  school: School;
  studentDir: StudentDirectoryEntry;
  items: StudentExamItem[];
  existingAttempt: ExamAttempt | null;
}

function deterministicShuffle<T>(arr: T[], seedStr: string): T[] {
  const copy = [...arr];
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function StudentExamFlow({
  session,
  onExit,
}: {
  session: StudentSessionPayload;
  onExit: () => void;
}) {
  const { token, examPackage, school, studentDir, items, existingAttempt } = session;
  const attemptId = `${examPackage.id}__${studentDir.school_id}__${studentDir.nis}`;
  const storageKey = `tka_smart_attempt_${attemptId}`;

  // Determine ordered questions & option order
  const orderedItems = useMemo(() => {
    let base = [...items];
    if (existingAttempt?.questionOrder?.length) {
      const map = new Map(base.map((i) => [i.id, i]));
      const fromExisting = existingAttempt.questionOrder
        .map((id) => map.get(id))
        .filter((x): x is StudentExamItem => Boolean(x));
      if (fromExisting.length === base.length) {
        base = fromExisting;
      }
    } else if (examPackage.randomizeQuestions) {
      base = deterministicShuffle(base, attemptId);
    }

    if (examPackage.randomizeOptions) {
      return base.map((q) => {
        if (!q.options) return q;
        const shuffledOpts: QuestionOption[] = deterministicShuffle(
          q.options,
          `${attemptId}_${q.id}`,
        );
        return { ...q, options: shuffledOpts };
      });
    }
    return base;
  }, [items, existingAttempt, examPackage.randomizeQuestions, examPackage.randomizeOptions, attemptId]);

  const initialStage = (): 'instructions' | 'active' | 'finished' => {
    if (existingAttempt && (existingAttempt.status === 'submitted' || existingAttempt.status === 'graded')) {
      return 'finished';
    }
    return 'instructions';
  };

  const [stage, setStage] = useState<'instructions' | 'active' | 'finished'>(initialStage);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(existingAttempt);
  const [answers, setAnswers] = useState<Record<string, StudentAnswerPayload>>(() => {
    try {
      const localRaw = localStorage.getItem(storageKey);
      if (localRaw) {
        const parsed = JSON.parse(localRaw) as Partial<ExamAttempt>;
        if (parsed.answers && (!existingAttempt || (parsed.lastSavedAtMs || 0) >= existingAttempt.lastSavedAtMs)) {
          return parsed.answers;
        }
      }
    } catch {
      // ignore local parse error
    }
    return existingAttempt?.answers || {};
  });
  const [flaggedIds, setFlaggedIds] = useState<string[]>(() => {
    try {
      const localRaw = localStorage.getItem(storageKey);
      if (localRaw) {
        const parsed = JSON.parse(localRaw) as Partial<ExamAttempt>;
        if (parsed.flaggedQuestionIds) return parsed.flaggedQuestionIds;
      }
    } catch {
      // ignore
    }
    return existingAttempt?.flaggedQuestionIds || [];
  });
  const [currentIdx, setCurrentIdx] = useState<number>(existingAttempt?.currentQuestionIndex || 0);
  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    try {
      const localRaw = localStorage.getItem(storageKey);
      if (localRaw) {
        const parsed = JSON.parse(localRaw) as Partial<ExamAttempt>;
        if (typeof parsed.timeRemainingSeconds === 'number' && parsed.timeRemainingSeconds > 0) {
          return Math.min(
            existingAttempt?.timeRemainingSeconds ?? examPackage.durationMinutes * 60,
            parsed.timeRemainingSeconds,
          );
        }
      }
    } catch {
      // ignore
    }
    return existingAttempt?.timeRemainingSeconds ?? examPackage.durationMinutes * 60;
  });

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncState, setSyncState] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showNavMobile, setShowNavMobile] = useState(false);

  // Result & Review state after exam completion
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [examReview, setExamReview] = useState<ExamResultReview | null>(null);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const flaggedRef = useRef(flaggedIds);
  flaggedRef.current = flaggedIds;
  const currentIdxRef = useRef(currentIdx);
  currentIdxRef.current = currentIdx;
  const timeRef = useRef(timeRemaining);
  timeRef.current = timeRemaining;

  const persistLocalSnapshot = useCallback(
    (patch?: Partial<ExamAttempt>) => {
      try {
        const snap = {
          id: attemptId,
          answers: patch?.answers ?? answersRef.current,
          flaggedQuestionIds: patch?.flaggedQuestionIds ?? flaggedRef.current,
          currentQuestionIndex: patch?.currentQuestionIndex ?? currentIdxRef.current,
          timeRemainingSeconds: patch?.timeRemainingSeconds ?? timeRef.current,
          lastSavedAtMs: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(snap));
      } catch {
        // storage quota fallback
      }
    },
    [attemptId, storageKey],
  );

  const syncToFirestore = useCallback(
    async (
      nextAnswers: Record<string, StudentAnswerPayload>,
      nextFlagged: string[],
      nextIdx: number,
      nextTime: number,
      changedQuestionId?: string,
    ) => {
      persistLocalSnapshot({
        answers: nextAnswers,
        flaggedQuestionIds: nextFlagged,
        currentQuestionIndex: nextIdx,
        timeRemainingSeconds: nextTime,
      });

      if (!navigator.onLine) {
        setSyncState('offline');
        return;
      }

      setSyncState('saving');
      const nowMs = Date.now();
      try {
        await updateExamAttemptProgress(attemptId, {
          answers: nextAnswers,
          flaggedQuestionIds: nextFlagged,
          currentQuestionIndex: nextIdx,
          lastSavedAtMs: nowMs,
          timeRemainingSeconds: nextTime,
          status: 'in_progress',
        });

        if (changedQuestionId) {
          const ans = nextAnswers[changedQuestionId] || {};
          await upsertStudentAnswerDoc({
            id: `${attemptId}__${changedQuestionId}`,
            attemptId,
            packageId: examPackage.id,
            school_id: studentDir.school_id,
            studentId: studentDir.studentId,
            questionId: changedQuestionId,
            selectedOptionId: ans.selectedOptionId,
            selectedOptionIds: ans.selectedOptionIds,
            categoryChoices: ans.categoryChoices,
            isFlagged: nextFlagged.includes(changedQuestionId),
            updatedAtMs: nowMs,
          });
        }
        setSyncState('saved');
      } catch (err) {
        console.warn('Autosave pending reconnect:', err);
        setSyncState('offline');
      }
    },
    [attemptId, examPackage.id, persistLocalSnapshot, studentDir.school_id, studentDir.studentId],
  );

  // Track online/offline status & auto-flush on reconnect
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      if (stage === 'active') {
        void syncToFirestore(
          answersRef.current,
          flaggedRef.current,
          currentIdxRef.current,
          timeRef.current,
        );
      }
    };
    const onOffline = () => {
      setIsOnline(false);
      setSyncState('offline');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [stage, syncToFirestore]);

  const handleStartOrResume = async () => {
    if (existingAttempt) {
      if (existingAttempt.status === 'submitted' || existingAttempt.status === 'graded') {
        setStage('finished');
        return;
      }
      setAttempt(existingAttempt);
      setStage('active');
      void syncToFirestore(answers, flaggedIds, currentIdx, timeRemaining);
      return;
    }

    const nowMs = Date.now();
    const newAttempt: ExamAttempt = {
      id: attemptId,
      packageId: examPackage.id,
      tokenCode: token.tokenCode,
      school_id: studentDir.school_id,
      studentId: studentDir.studentId,
      studentName: studentDir.displayName,
      nis: studentDir.nis,
      classId: studentDir.classId,
      className: studentDir.className,
      status: 'in_progress',
      questionOrder: orderedItems.map((q) => q.id),
      flaggedQuestionIds: flaggedIds,
      currentQuestionIndex: 0,
      answers,
      startedAtMs: nowMs,
      lastSavedAtMs: nowMs,
      timeRemainingSeconds: examPackage.durationMinutes * 60,
      isDemo: Boolean(examPackage.isDemo),
    };

    await createExamAttempt(newAttempt);
    setAttempt(newAttempt);
    setStage('active');
  };

  const handleFinalSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    const nowMs = Date.now();
    try {
      await updateExamAttemptProgress(attemptId, {
        answers: answersRef.current,
        flaggedQuestionIds: flaggedRef.current,
        currentQuestionIndex: currentIdxRef.current,
        lastSavedAtMs: nowMs,
        submittedAtMs: nowMs,
        timeRemainingSeconds: timeRef.current,
        status: 'submitted',
      });
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
      setAttempt((prev) =>
        prev
          ? { ...prev, status: 'submitted', submittedAtMs: nowMs }
          : null,
      );
      setShowConfirmSubmit(false);
      setStage('finished');
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Gagal mengirim jawaban. Periksa koneksi internet Anda lalu coba kirim lagi.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [attemptId, isSubmitting, storageKey]);

  // Countdown Timer & Periodic Save
  useEffect(() => {
    if (stage !== 'active') return;
    const interval = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          void handleFinalSubmit();
          return 0;
        }
        const next = prev - 1;
        if (next % 15 === 0) {
          void syncToFirestore(
            answersRef.current,
            flaggedRef.current,
            currentIdxRef.current,
            next,
          );
        } else {
          persistLocalSnapshot({ timeRemainingSeconds: next });
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [stage, handleFinalSubmit, persistLocalSnapshot, syncToFirestore]);

  // Listen to result once finished (only if showResultsToStudent is true)
  useEffect(() => {
    if (stage !== 'finished') return;

    const unsubAttempt = onSnapshot(
      doc(db, 'exam_attempts', attemptId),
      (snap) => {
        if (snap.exists()) {
          setAttempt(snap.data() as ExamAttempt);
        }
      },
      (err) => console.warn('Attempt listener:', err),
    );

    let unsubResult: (() => void) | null = null;
    if (examPackage.showResultsToStudent) {
      unsubResult = onSnapshot(
        doc(db, 'exam_results', attemptId),
        async (snap) => {
          if (snap.exists()) {
            const res = snap.data() as ExamResult;
            setExamResult(res);
            if (examPackage.showAnswersAfterExam) {
              try {
                const revSnap = await getDoc(doc(db, 'exam_result_reviews', attemptId));
                if (revSnap.exists()) {
                  setExamReview(revSnap.data() as ExamResultReview);
                }
              } catch {
                // ignore if admin hasn't enabled review yet
              }
            }
          }
        },
        (err) => console.warn('Result listener:', err),
      );
    }

    return () => {
      unsubAttempt();
      if (unsubResult) unsubResult();
    };
  }, [stage, attemptId, examPackage.showResultsToStudent, examPackage.showAnswersAfterExam]);

  const currentQuestion = orderedItems[currentIdx];

  const updateAnswer = (qId: string, payload: StudentAnswerPayload) => {
    const nextAnswers = { ...answers, [qId]: payload };
    setAnswers(nextAnswers);
    void syncToFirestore(nextAnswers, flaggedIds, currentIdx, timeRemaining, qId);
  };

  const toggleFlag = (qId: string) => {
    const nextFlagged = flaggedIds.includes(qId)
      ? flaggedIds.filter((id) => id !== qId)
      : [...flaggedIds, qId];
    setFlaggedIds(nextFlagged);
    void syncToFirestore(answers, nextFlagged, currentIdx, timeRemaining, qId);
  };

  const navigateTo = (idx: number) => {
    if (idx < 0 || idx >= orderedItems.length) return;
    setCurrentIdx(idx);
    setShowNavMobile(false);
    void syncToFirestore(answers, flaggedIds, idx, timeRemaining);
  };

  const answeredCount = orderedItems.filter((q) =>
    isQuestionAnswered(q.questionType, answers[q.id]),
  ).length;
  const unansweredCount = orderedItems.length - answeredCount;

  // STAGE 1: PETUNJUK UJIAN
  if (stage === 'instructions') {
    const isResuming = Boolean(existingAttempt && existingAttempt.status === 'in_progress');
    return (
      <div className="min-h-screen flex flex-col">
        <header className="bg-white/80 backdrop-blur-md border-b border-white/80 shadow-[0_6px_22px_rgba(148,163,184,0.12)] px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/assets/aistudio/image_527feef0.png"
                alt="Logo TKA SMART"
                className="w-10 h-10 rounded-xl object-contain bg-white border border-slate-200/80 shadow-sm p-0.5 shrink-0"
              />
              <div>
                <div className="text-sm font-extrabold text-[#1E1B4B]">TKA SMART</div>
                <div className="text-xs text-[#4F46E5] font-medium">{school.name}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onExit}
              className="neu-btn-soft inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-[#1E1B4B]"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
          <div className="neu-surface p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-200/70 pb-5">
              <div className="text-xs font-bold text-[#4F46E5] mb-1">
                Petunjuk Pengerjaan Ujian
              </div>
              <h1 className="text-2xl font-extrabold text-[#1E1B4B] tracking-tight">
                {examPackage.title}
              </h1>
              {examPackage.description && (
                <p className="text-sm text-slate-600 mt-1">{examPackage.description}</p>
              )}
            </div>

            {/* Student & Exam Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 neu-inset p-5">
              <div className="space-y-1.5 text-sm">
                <div className="text-xs font-bold text-[#4F46E5]">Data Peserta</div>
                <div className="font-extrabold text-[#1E1B4B] text-base">{studentDir.displayName}</div>
                <div className="text-slate-600 font-mono-tabular">
                  NIS: {studentDir.nis} · Kelas {studentDir.className}
                </div>
                <div className="text-slate-600">{school.name}</div>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="text-xs font-bold text-[#0E7490]">Informasi Paket</div>
                <div className="text-slate-800 font-semibold">
                  Mata Pelajaran:{' '}
                  {examPackage.subjectMode === 'gabungan'
                    ? 'Bahasa Indonesia & Matematika'
                    : examPackage.subjectMode === 'bahasa_indonesia'
                      ? 'Bahasa Indonesia'
                      : 'Matematika'}
                </div>
                <div className="text-slate-700 font-mono-tabular">
                  Jumlah Soal: {orderedItems.length} butir · Durasi: {examPackage.durationMinutes} menit
                </div>
                <div className="text-slate-600 font-mono-tabular">
                  Token Sesi: {token.tokenCode}
                </div>
              </div>
            </div>

            {/* Instructions List */}
            <div className="space-y-3">
              <h2 className="text-base font-bold text-[#172554]">
                Perhatikan Petunjuk Berikut Sebelum Memulai:
              </h2>
              <ol className="space-y-2.5 text-sm text-slate-700 list-decimal pl-5 leading-relaxed">
                <li>
                  Berdoalah terlebih dahulu sebelum mengerjakan soal simulasi TKA.
                </li>
                <li>
                  Pada soal <strong>Pilihan Ganda</strong>, pilihlah <strong>satu</strong> jawaban yang paling tepat.
                </li>
                <li>
                  Pada soal <strong>Pilihan Ganda Kompleks</strong>, kamu dapat memilih <strong>lebih dari satu</strong> jawaban yang benar, atau menentukan <strong>Benar / Salah</strong> pada setiap pernyataan.
                </li>
                <li>
                  Gunakan tombol <strong>Tandai Ragu-Ragu</strong> jika kamu ingin memeriksa ulang jawaban sebelum ujian selesai.
                </li>
                <li>
                  Semua jawabanmu <strong>tersimpan otomatis</strong>. Jika jaringan terputus, tetap tenang karena jawaban tersimpan di perangkat dan akan tersinkronisasi saat koneksi kembali.
                </li>
                <li>
                  Jika waktu hitung mundur habis, sistem akan otomatis mengirimkan jawabanmu.
                </li>
              </ol>
            </div>

            {isResuming && (
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-sm text-[#172554]">
                Sesi ujianmu sebelumnya ditemukan. Kamu dapat langsung melanjutkan dari soal terakhir dengan jawaban yang sudah tersimpan.
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={onExit}
                className="neu-btn-soft w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleStartOrResume}
                className="neu-btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
              >
                <span>{isResuming ? 'Lanjutkan Kerjakan Ujian' : 'Mulai Kerjakan Ujian'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>

        <footer className="border-t border-white/80 bg-white/75 backdrop-blur-sm px-6 py-3.5 text-xs text-slate-500">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>TKA SMART · Tes Kompetensi Akademik Digital SD Kelas 6</span>
            <span className="font-semibold text-[#4F46E5]">@destra.studio</span>
          </div>
        </footer>
      </div>
    );
  }

  // STAGE 3: FINISHED & RESULTS
  if (stage === 'finished') {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="bg-white/80 backdrop-blur-md border-b border-white/80 shadow-[0_6px_22px_rgba(148,163,184,0.12)] px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/assets/aistudio/image_527feef0.png"
                alt="Logo TKA SMART"
                className="w-9 h-9 rounded-xl object-contain bg-white border border-slate-200/80 shadow-sm p-0.5 shrink-0"
              />
              <div>
                <div className="text-sm font-extrabold text-[#1E1B4B]">TKA SMART</div>
                <div className="text-xs text-slate-500">
                  {studentDir.displayName} · NIS {studentDir.nis}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onExit}
              className="neu-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 space-y-6">
          <div className="neu-surface p-6 sm:p-8 text-center">
            <div className="w-14 h-14 rounded-2xl neu-well-emerald flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#1E1B4B] mb-2">
              Ujian Selesai &amp; Jawaban Tersimpan
            </h1>
            <p className="text-sm text-slate-600 max-w-lg mx-auto">
              Terima kasih, <strong>{studentDir.displayName}</strong>. Jawabanmu untuk{' '}
              <strong>{examPackage.title}</strong> telah dikirim dan terkunci agar tidak terjadi pengiriman ganda.
            </p>
          </div>

          {!examPackage.showResultsToStudent && (
            <div className="neu-surface p-6 text-center text-sm text-slate-600">
              Nilai akhir dan pembahasan belum dibuka oleh admin atau guru. Silakan tunggu pengumuman hasil resmi dari sekolahmu.
            </div>
          )}

          {examPackage.showResultsToStudent && !examResult && (
            <div className="neu-surface p-6 text-center text-sm text-slate-600">
              Status saat ini: <strong>Menunggu proses penilaian otomatis pengawas/admin</strong>. Halaman ini akan otomatis menampilkan nilaimu begitu nilai diterbitkan.
            </div>
          )}

          {examPackage.showResultsToStudent && examResult && (
            <div className="neu-surface p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/70 pb-5">
                <div>
                  <div className="text-xs font-bold text-[#4F46E5]">
                    Hasil Simulasi TKA
                  </div>
                  <h2 className="text-xl font-extrabold text-[#1E1B4B]">
                    Rekap Nilai {examResult.studentName}
                  </h2>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-xs text-slate-500">Nilai Akhir</div>
                  <div className="text-3xl font-extrabold font-mono-tabular bg-gradient-to-r from-[#2563EB] to-[#7C3AED] bg-clip-text text-transparent">
                    {examResult.finalScore}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl neu-inset">
                  <div className="text-xs font-semibold text-emerald-700">Benar</div>
                  <div className="text-xl font-extrabold font-mono-tabular text-emerald-700">
                    {examResult.correctCount}
                  </div>
                </div>
                <div className="p-4 rounded-2xl neu-inset">
                  <div className="text-xs font-semibold text-rose-600">Salah</div>
                  <div className="text-xl font-extrabold font-mono-tabular text-rose-600">
                    {examResult.incorrectCount}
                  </div>
                </div>
                <div className="p-4 rounded-2xl neu-inset">
                  <div className="text-xs font-semibold text-slate-500">Kosong</div>
                  <div className="text-xl font-extrabold font-mono-tabular text-slate-700">
                    {examResult.blankCount}
                  </div>
                </div>
                <div className="p-4 rounded-2xl neu-inset">
                  <div className="text-xs font-semibold text-[#4F46E5]">Ketuntasan</div>
                  <div className="text-xl font-extrabold font-mono-tabular text-[#4F46E5]">
                    {examResult.percentageCorrect}%
                  </div>
                </div>
              </div>

              {/* Subject Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#172554]">Nilai Per Mata Pelajaran</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.values(examResult.subjectBreakdown).map((sb) => (
                    <div
                      key={sb.subjectId}
                      className="p-4 rounded-lg border border-slate-200 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#172554]">
                          {sb.subjectName}
                        </div>
                        <div className="text-xs text-slate-500 font-mono-tabular">
                          {sb.correctCount} dari {sb.totalQuestions} soal benar
                        </div>
                      </div>
                      <div className="text-xl font-bold font-mono-tabular text-[#2563EB]">
                        {sb.score}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Answer Review ONLY if Admin enabled showAnswersAfterExam */}
              {examPackage.showAnswersAfterExam && examReview && (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <h3 className="text-base font-bold text-[#172554]">
                    Kunci Jawaban &amp; Pembahasan
                  </h3>
                  <div className="space-y-3">
                    {examReview.reviews.map((rev, idx) => {
                      const itemRes = examResult.itemResults.find(
                        (ir) => ir.questionId === rev.questionId,
                      );
                      return (
                        <div
                          key={rev.questionId}
                          className="p-4 rounded-lg border border-slate-200 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-500 font-mono-tabular">
                              Soal {idx + 1}
                            </span>
                            <span
                              className={`text-xs font-semibold ${
                                itemRes?.isCorrect ? 'text-emerald-700' : 'text-[#EF4444]'
                              }`}
                            >
                              {itemRes?.isCorrect ? 'Benar' : 'Perlu Perbaikan'}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-900">
                            {rev.questionText}
                          </p>
                          <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded border border-slate-200 space-y-1">
                            <div>
                              <strong>Kunci:</strong>{' '}
                              {rev.questionType === 'pg' && rev.correctOptionId}
                              {rev.questionType === 'pgk_mcma' &&
                                (rev.correctOptionIds || []).join(', ')}
                              {rev.questionType === 'pgk_kategori' &&
                                Object.entries(rev.correctCategories || {})
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(' | ')}
                            </div>
                            {rev.explanation && (
                              <div>
                                <strong>Pembahasan:</strong> {rev.explanation}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="border-t border-slate-200 bg-white px-6 py-3.5 text-xs text-slate-500">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>TKA SMART · Tes Kompetensi Akademik Digital SD Kelas 6</span>
            <span className="font-semibold text-slate-600">@destra.studio</span>
          </div>
        </footer>
      </div>
    );
  }

  // STAGE 2: ACTIVE EXAM WORKSPACE
  const isFlagged = currentQuestion ? flaggedIds.includes(currentQuestion.id) : false;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] || {} : {};
  const isLowTime = timeRemaining <= 300;
  const hasStimulus = Boolean(currentQuestion?.stimulusSnapshot);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Exam Bar */}
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-white/90 shadow-[0_6px_22px_rgba(148,163,184,0.12)] px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/image_527feef0.png"
              alt="Logo TKA SMART"
              className="w-9 h-9 rounded-xl object-contain bg-white border border-slate-200/80 shadow-sm p-0.5 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-[#1E1B4B] truncate">
                {currentQuestion?.subjectId === 'bahasa_indonesia'
                  ? 'Bahasa Indonesia'
                  : 'Matematika'}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {studentDir.displayName} · Kelas {studentDir.className}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-600"
              title="Status penyimpanan jawaban"
            >
              {isOnline && syncState !== 'offline' ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{syncState === 'saving' ? 'Menyimpan...' : 'Tersimpan otomatis'}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-amber-700">Offline (tersimpan lokal)</span>
                </>
              )}
            </div>

            <div
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-mono-tabular font-bold ${
                isLowTime
                  ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-[0_6px_16px_rgba(244,63,94,0.35)]'
                  : 'bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white shadow-[0_6px_16px_rgba(79,70,229,0.32)]'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{formatTimer(timeRemaining)}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowNavMobile(!showNavMobile)}
              className="lg:hidden neu-btn-soft px-3 py-1.5 rounded-xl text-xs font-bold text-[#1E1B4B]"
            >
              Soal {currentIdx + 1}/{orderedItems.length}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Question + Stimulus Workspace */}
        <div className="lg:col-span-9 space-y-5">
          {currentQuestion && (
            <div
              className={`grid grid-cols-1 ${
                hasStimulus ? 'xl:grid-cols-12' : ''
              } gap-5 items-start`}
            >
              {/* Stimulus Panel */}
              {hasStimulus && (
                <div className="xl:col-span-6 neu-surface p-5 sm:p-6 xl:max-h-[calc(100vh-180px)] xl:overflow-y-auto">
                  <StimulusRenderer stimulus={currentQuestion.stimulusSnapshot} />
                </div>
              )}

              {/* Question & Options Panel */}
              <div
                className={`${
                  hasStimulus ? 'xl:col-span-6' : 'max-w-3xl mx-auto w-full'
                } neu-surface p-5 sm:p-6 space-y-5`}
              >
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/70">
                  <div>
                    <div className="text-xs font-bold text-[#4F46E5] font-mono-tabular">
                      Soal Nomor {currentIdx + 1} dari {orderedItems.length}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {currentQuestion.questionType === 'pg' && 'Pilihan Ganda · Pilih 1 jawaban'}
                      {currentQuestion.questionType === 'pgk_mcma' &&
                        'Pilihan Ganda Kompleks · Pilih lebih dari 1 jawaban'}
                      {currentQuestion.questionType === 'pgk_kategori' &&
                        'Pilihan Ganda Kategori · Pilih Benar atau Salah'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFlag(currentQuestion.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      isFlagged
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/25'
                        : 'neu-btn-soft text-slate-600 hover:text-[#1E1B4B]'
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>{isFlagged ? 'Ditandai Ragu' : 'Tandai Ragu'}</span>
                  </button>
                </div>

                {currentQuestion.imageUrl && (
                  <div className="neu-surface-sm overflow-hidden p-2">
                    <img
                      src={currentQuestion.imageUrl}
                      alt={`Gambar soal ${currentIdx + 1}`}
                      referrerPolicy="no-referrer"
                      className="max-h-64 w-full object-contain rounded-lg"
                    />
                  </div>
                )}

                <div className="text-base sm:text-[17px] font-medium text-slate-900 leading-relaxed whitespace-pre-line">
                  {currentQuestion.questionText}
                </div>

                {/* PG (Single Choice) */}
                {currentQuestion.questionType === 'pg' && (
                  <div className="space-y-3">
                    {(currentQuestion.options || []).map((opt, oIdx) => {
                      const letter = String.fromCharCode(65 + oIdx);
                      const selected = currentAnswer.selectedOptionId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            updateAnswer(currentQuestion.id, { selectedOptionId: opt.id })
                          }
                          className={`w-full text-left p-3.5 rounded-xl transition-all flex items-start gap-3.5 ${
                            selected
                              ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 border-2 border-[#4F46E5] text-[#1E1B4B] shadow-md shadow-indigo-500/15'
                              : 'neu-surface-sm hover:brightness-[1.01] text-slate-800'
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                              selected
                                ? 'bg-gradient-to-br from-[#2563EB] to-[#6366F1] text-white shadow-sm'
                                : 'neu-inset text-indigo-700'
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="text-sm sm:text-[15px] leading-snug pt-0.5 font-medium">
                            {opt.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* PGK MCMA (Multiple Choice Multiple Answer) */}
                {currentQuestion.questionType === 'pgk_mcma' && (
                  <div className="space-y-3">
                    {(currentQuestion.options || []).map((opt) => {
                      const selectedList = currentAnswer.selectedOptionIds || [];
                      const checked = selectedList.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            const next = checked
                              ? selectedList.filter((x) => x !== opt.id)
                              : [...selectedList, opt.id];
                            updateAnswer(currentQuestion.id, { selectedOptionIds: next });
                          }}
                          className={`w-full text-left p-3.5 rounded-xl transition-all flex items-start gap-3.5 ${
                            checked
                              ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-cyan-50 border-2 border-[#4F46E5] text-[#1E1B4B] shadow-md shadow-indigo-500/15'
                              : 'neu-surface-sm hover:brightness-[1.01] text-slate-800'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 mt-0.5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                              checked
                                ? 'bg-gradient-to-br from-[#2563EB] to-[#6366F1] text-white shadow-sm'
                                : 'neu-input'
                            }`}
                          >
                            {checked ? '✓' : ''}
                          </span>
                          <span className="text-sm sm:text-[15px] leading-snug font-medium">
                            {opt.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* PGK Kategori (Benar / Salah) */}
                {currentQuestion.questionType === 'pgk_kategori' && (
                  <div className="neu-surface-sm overflow-hidden">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="neu-table-head text-[#1E1B4B] text-xs font-bold">
                          <th className="text-left px-4 py-3">Pernyataan</th>
                          <th className="text-center px-3 py-3 w-24">Benar</th>
                          <th className="text-center px-3 py-3 w-24">Salah</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70">
                        {(currentQuestion.statements || []).map((st) => {
                          const choice = currentAnswer.categoryChoices?.[st.id];
                          const setChoice = (val: 'Benar' | 'Salah') => {
                            updateAnswer(currentQuestion.id, {
                              categoryChoices: {
                                ...(currentAnswer.categoryChoices || {}),
                                [st.id]: val,
                              },
                            });
                          };
                          return (
                            <tr key={st.id} className="bg-white/75">
                              <td className="px-4 py-3 text-slate-800 leading-snug">
                                {st.text}
                              </td>
                              <td className="px-2 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setChoice('Benar')}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    choice === 'Benar'
                                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-500/30'
                                      : 'neu-btn-soft text-slate-700'
                                  }`}
                                >
                                  Benar
                                </button>
                              </td>
                              <td className="px-2 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setChoice('Salah')}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    choice === 'Salah'
                                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/30'
                                      : 'neu-btn-soft text-slate-700'
                                  }`}
                                >
                                  Salah
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Navigation Footer Buttons */}
                <div className="pt-4 border-t border-slate-200/70 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => navigateTo(currentIdx - 1)}
                    disabled={currentIdx === 0}
                    className="neu-btn-soft inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 disabled:opacity-40"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Sebelumnya</span>
                  </button>

                  {currentIdx < orderedItems.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => navigateTo(currentIdx + 1)}
                      className="neu-btn-primary inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold"
                    >
                      <span>Berikutnya</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowConfirmSubmit(true)}
                      className="neu-btn-primary inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold"
                    >
                      <Send className="w-4 h-4" />
                      <span>Selesai &amp; Kirim</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Question Number Grid Navigation */}
        <aside
          className={`lg:col-span-3 neu-surface p-5 space-y-4 ${
            showNavMobile ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1E1B4B]">Navigasi Nomor Soal</h2>
            <span className="text-xs font-mono-tabular font-bold text-[#4F46E5]">
              {answeredCount}/{orderedItems.length}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {orderedItems.map((q, idx) => {
              const answered = isQuestionAnswered(q.questionType, answers[q.id]);
              const flagged = flaggedIds.includes(q.id);
              const active = idx === currentIdx;

              let styleClass = 'neu-btn-soft text-slate-700';
              if (flagged) {
                styleClass = 'bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-400 text-amber-900 shadow-sm';
              } else if (answered) {
                styleClass = 'bg-gradient-to-br from-[#3B82F6] to-[#4F46E5] border border-indigo-400/50 text-white shadow-[0_4px_10px_rgba(79,70,229,0.35)]';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => navigateTo(idx)}
                  className={`h-10 rounded-xl text-xs font-mono-tabular font-bold relative transition-all ${styleClass} ${
                    active ? 'ring-2 ring-[#06B6D4] ring-offset-2' : ''
                  }`}
                >
                  {idx + 1}
                  {flagged && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-white" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5 pt-3 border-t border-slate-200/70 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-gradient-to-br from-[#3B82F6] to-[#4F46E5] inline-block" />
              <span>Sudah dijawab ({answeredCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-amber-200 border border-amber-400 inline-block" />
              <span>Ditandai ragu ({flaggedIds.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-white border border-slate-300 inline-block" />
              <span>Belum dijawab ({unansweredCount})</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowConfirmSubmit(true)}
            className="neu-btn-primary w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          >
            <BookmarkCheck className="w-4 h-4" />
            <span>Selesai &amp; Kirim Jawaban</span>
          </button>
        </aside>
      </main>

      <footer className="border-t border-white/80 bg-white/75 backdrop-blur-sm px-4 sm:px-6 py-3 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>TKA SMART · Simulasi Tes Kompetensi Akademik SD Kelas 6</span>
          <span className="font-semibold text-[#4F46E5]">@destra.studio</span>
        </div>
      </footer>

      {/* Confirm Submit Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="neu-modal max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#172554]">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
              <h3 className="text-lg font-bold">Konfirmasi Selesai Ujian</h3>
            </div>

            <p className="text-sm text-slate-600">
              Setelah dikirim, jawaban tidak dapat diubah lagi. Pastikan kamu sudah memeriksa semua soal.
            </p>

            <div className="grid grid-cols-3 gap-2 text-center bg-[#F5F7FB] p-3 rounded-lg border border-slate-200 text-xs">
              <div>
                <div className="font-mono-tabular text-lg font-bold text-[#2563EB]">
                  {answeredCount}
                </div>
                <div className="text-slate-600">Dijawab</div>
              </div>
              <div>
                <div className="font-mono-tabular text-lg font-bold text-amber-600">
                  {flaggedIds.length}
                </div>
                <div className="text-slate-600">Ragu-ragu</div>
              </div>
              <div>
                <div className="font-mono-tabular text-lg font-bold text-[#EF4444]">
                  {unansweredCount}
                </div>
                <div className="text-slate-600">Kosong</div>
              </div>
            </div>

            {submitError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#EF4444]">
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmSubmit(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Kembali Mengerjakan
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-60"
              >
                {isSubmitting ? 'Mengirim...' : 'Ya, Kirim Jawaban'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
