import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, handleFirestoreError, OperationType, storage } from './firebase';
import type {
  ExamAttempt,
  ExamPackage,
  ExamResult,
  ExamResultReview,
  ExamSession,
  ExamToken,
  Question,
  School,
  SchoolClass,
  Stimulus,
  Student,
  StudentAnswerDoc,
  StudentDirectoryEntry,
  StudentExamItem,
  Subject,
  UserInvite,
  UserProfile,
} from '../types/tka';

export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

export function sanitizeId(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return cleaned || `id_${Date.now().toString().slice(-6)}`;
}

export function formatFirestoreErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(err.message) as { error?: string; path?: string; operationType?: string };
    if (parsed && parsed.error) {
      if (parsed.error.toLowerCase().includes('permission') || parsed.error.includes('PERMISSION_DENIED')) {
        return `Akses ditolak saat menyimpan (${parsed.path || 'database'}). Pastikan sekolah dan kelas sudah terdaftar serta akun Anda memiliki izin pada sekolah tersebut.`;
      }
      return `${parsed.error}${parsed.path ? ` (${parsed.path})` : ''}`;
    }
  } catch {
    // Plain error message
  }
  return err.message || fallback;
}

let storageFallbackActive = false;

// Fast client-side image compression + short-timeout Storage upload with instant DataURL fallback
export async function uploadAssetImage(
  file: File,
  folder: 'schools' | 'questions' | 'stimuli',
): Promise<string> {
  const { blob, dataUrl } = await compressImageToBlobAndDataUrl(file, 900, 0.8);

  if (storageFallbackActive) {
    return dataUrl;
  }

  const baseName = (file.name || `img_${Date.now()}`).replace(/\.[^.]+$/, '');
  const safeName = `${Date.now()}_${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;

  try {
    const storageRef = ref(storage, `tka_smart/${folder}/${safeName}`);
    const uploadPromise = (async () => {
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      return await getDownloadURL(storageRef);
    })();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Storage upload timeout')), 2200);
    });
    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (err) {
    storageFallbackActive = true;
    console.warn('Firebase Storage upload fallback triggered:', err);
    return dataUrl;
  }
}

async function compressImageToBlobAndDataUrl(
  file: File,
  maxWidth: number,
  quality: number,
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const attempts: Array<[number, number]> = [
        [maxWidth, quality],
        [680, 0.72],
        [520, 0.62],
        [380, 0.52],
      ];

      for (const [targetMaxW, targetQ] of attempts) {
        const ratio = Math.min(1, targetMaxW / (img.width || targetMaxW));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * ratio));
        canvas.height = Math.max(1, Math.round(img.height * ratio));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal memproses gambar'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', targetQ);
        if (dataUrl.length <= 190000 || targetMaxW === 380) {
          canvas.toBlob(
            (blob) => {
              resolve({
                blob: blob || file,
                dataUrl,
              });
            },
            'image/jpeg',
            targetQ,
          );
          return;
        }
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Format gambar tidak valid'));
    };
    img.src = objectUrl;
  });
}

// Schools
export async function saveSchool(school: School): Promise<void> {
  const now = new Date().toISOString();
  const payload = stripUndefined({
    id: school.id,
    name: school.name.slice(0, 120),
    npsn: school.npsn.slice(0, 20),
    address: (school.address || '').slice(0, 300),
    logoUrl: (school.logoUrl || '').slice(0, 1000),
    isActive: Boolean(school.isActive),
    createdAt: school.createdAt || now,
    updatedAt: now,
  });
  try {
    await setDoc(doc(db, 'schools', school.id), payload);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `schools/${school.id}`);
  }
}

export async function deleteSchool(schoolId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'schools', schoolId));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `schools/${schoolId}`);
  }
}

// User Invites & Profiles
export async function saveUserInvite(invite: UserInvite): Promise<void> {
  const emailKey = invite.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const payload = stripUndefined({
    email: emailKey,
    name: invite.name.slice(0, 120),
    role: invite.role,
    school_id: invite.role === 'super_admin' ? 'ALL' : invite.school_id,
    isActive: Boolean(invite.isActive),
    createdBy: invite.createdBy,
    createdAt: invite.createdAt || now,
    updatedAt: now,
  });
  try {
    await setDoc(doc(db, 'user_invites', emailKey), payload);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `user_invites/${emailKey}`);
  }
}

export async function deleteUserInvite(email: string): Promise<void> {
  const emailKey = email.trim().toLowerCase();
  try {
    await deleteDoc(doc(db, 'user_invites', emailKey));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `user_invites/${emailKey}`);
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const now = new Date().toISOString();
  const payload = stripUndefined({
    uid: profile.uid,
    email: profile.email.trim().toLowerCase(),
    name: profile.name.slice(0, 120),
    role: profile.role,
    school_id: profile.role === 'super_admin' ? 'ALL' : profile.school_id,
    isActive: Boolean(profile.isActive),
    createdAt: profile.createdAt || now,
    updatedAt: now,
  });
  try {
    await setDoc(doc(db, 'users', profile.uid), payload);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `users/${profile.uid}`);
  }
}

export async function deleteUserProfile(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `users/${uid}`);
  }
}

// Classes
export async function saveSchoolClass(cls: SchoolClass): Promise<void> {
  const now = new Date().toISOString();
  const cleanYear = (cls.academicYear || '').trim();
  const safeYear = (cleanYear.length >= 4 ? cleanYear : '2025/2026').slice(0, 20);
  const payload = stripUndefined({
    id: sanitizeId(cls.id),
    school_id: sanitizeId(cls.school_id),
    name: cls.name.trim().slice(0, 60),
    gradeLevel: (cls.gradeLevel || '6').trim().slice(0, 10) || '6',
    homeroomTeacher: (cls.homeroomTeacher || '').trim().slice(0, 120),
    academicYear: safeYear,
    isActive: Boolean(cls.isActive),
    isDemo: cls.isDemo,
    createdAt: cls.createdAt || now,
    updatedAt: now,
  });
  try {
    await setDoc(doc(db, 'classes', payload.id), payload);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `classes/${payload.id}`);
  }
}

export async function deleteSchoolClass(classId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'classes', classId));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `classes/${classId}`);
  }
}

// Students + Student Directory atomic sync
export async function saveStudent(student: Student): Promise<void> {
  const now = new Date().toISOString();
  const cleanNis = sanitizeId(student.nis).slice(0, 30);
  const cleanSchoolId = sanitizeId(student.school_id);
  const cleanStudentId = sanitizeId(student.id);
  const cleanClassId = sanitizeId(student.classId);
  const cleanName = student.name.trim().slice(0, 120);
  const cleanClassName = student.className.trim().slice(0, 60);

  const payload = stripUndefined({
    id: cleanStudentId,
    school_id: cleanSchoolId,
    classId: cleanClassId,
    className: cleanClassName,
    nis: cleanNis,
    name: cleanName,
    gender: student.gender,
    isActive: Boolean(student.isActive),
    isDemo: student.isDemo,
    createdAt: student.createdAt || now,
    updatedAt: now,
  });

  const dirKey = `${cleanSchoolId}__${cleanNis}`;
  const dirPayload: StudentDirectoryEntry = stripUndefined({
    studentId: cleanStudentId,
    school_id: cleanSchoolId,
    classId: cleanClassId,
    className: cleanClassName,
    nis: cleanNis,
    displayName: cleanName,
    isActive: Boolean(student.isActive),
    isDemo: student.isDemo,
  });

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'students', cleanStudentId), payload);
    batch.set(doc(db, 'student_directory', dirKey), dirPayload);
    await batch.commit();
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `students/${cleanStudentId}`);
  }
}

export async function deleteStudent(student: Student): Promise<void> {
  const dirKey = `${student.school_id}__${sanitizeId(student.nis)}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'students', student.id));
    batch.delete(doc(db, 'student_directory', dirKey));
    await batch.commit();
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `students/${student.id}`);
  }
}

// Subjects
export async function saveSubject(subject: Subject): Promise<void> {
  try {
    await setDoc(doc(db, 'subjects', subject.id), stripUndefined({ ...subject }));
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `subjects/${subject.id}`);
  }
}

// Stimuli
export async function saveStimulus(stimulus: Stimulus): Promise<void> {
  const now = new Date().toISOString();
  const payload = stripUndefined({
    id: stimulus.id,
    subjectId: stimulus.subjectId,
    title: stimulus.title.slice(0, 200),
    stimulusType: stimulus.stimulusType,
    readingText: stimulus.readingText ? stimulus.readingText.slice(0, 15000) : undefined,
    imageUrl: stimulus.imageUrl ? stimulus.imageUrl.slice(0, 250000) : undefined,
    tableData: stimulus.tableData,
    chartData: stimulus.chartData,
    diagramSvg: stimulus.diagramSvg ? stimulus.diagramSvg.slice(0, 10000) : undefined,
    isDemo: stimulus.isDemo,
    createdBy: stimulus.createdBy,
    createdAt: stimulus.createdAt || now,
    updatedAt: now,
  });
  try {
    await setDoc(doc(db, 'stimuli', stimulus.id), payload);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `stimuli/${stimulus.id}`);
  }
}

export async function deleteStimulus(stimulusId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'stimuli', stimulusId));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `stimuli/${stimulusId}`);
  }
}

// Questions
export async function saveQuestion(question: Question): Promise<void> {
  const now = new Date().toISOString();
  const payload = stripUndefined({
    id: question.id,
    subjectId: question.subjectId,
    topic: question.topic.slice(0, 120),
    competency: question.competency.slice(0, 200),
    indicator: question.indicator.slice(0, 250),
    difficulty: question.difficulty,
    questionType: question.questionType,
    stimulusId: question.stimulusId || undefined,
    questionText: question.questionText.slice(0, 4000),
    imageUrl: question.imageUrl ? question.imageUrl.slice(0, 250000) : undefined,
    options: question.options,
    statements: question.statements,
    correctOptionId: question.correctOptionId,
    correctOptionIds: question.correctOptionIds,
    correctCategories: question.correctCategories,
    pgkScoringRule: question.pgkScoringRule || 'all_or_nothing',
    points: Number(question.points) || 10,
    explanation: (question.explanation || '').slice(0, 4000),
    isDemo: question.isDemo,
    createdBy: question.createdBy,
    createdAt: question.createdAt || now,
    updatedAt: now,
  });
  try {
    await setDoc(doc(db, 'question_bank', question.id), payload);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `question_bank/${question.id}`);
  }
}

export async function deleteQuestion(questionId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'question_bank', questionId));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `question_bank/${questionId}`);
  }
}

// Exam Packages + sanitized student_items sync (zero answer keys in student_items!)
export async function saveExamPackageWithItems(
  pkg: ExamPackage,
  questionsMap: Record<string, Question>,
  stimuliMap: Record<string, Stimulus>,
): Promise<void> {
  const now = new Date().toISOString();
  const pkgPayload = stripUndefined({
    id: pkg.id,
    title: pkg.title.slice(0, 180),
    subjectMode: pkg.subjectMode,
    description: (pkg.description || '').slice(0, 1000),
    questionIds: pkg.questionIds,
    questionCount: pkg.questionIds.length,
    durationMinutes: Number(pkg.durationMinutes) || 45,
    startTime: pkg.startTime || undefined,
    endTime: pkg.endTime || undefined,
    isActive: Boolean(pkg.isActive),
    schoolScope: pkg.schoolScope,
    allowedSchoolIds: pkg.allowedSchoolIds || [],
    randomizeQuestions: Boolean(pkg.randomizeQuestions),
    randomizeOptions: Boolean(pkg.randomizeOptions),
    showResultsToStudent: Boolean(pkg.showResultsToStudent),
    showAnswersAfterExam: Boolean(pkg.showAnswersAfterExam),
    pgkScoringMode: pkg.pgkScoringMode || 'all_or_nothing',
    isDemo: pkg.isDemo,
    createdBy: pkg.createdBy,
    createdAt: pkg.createdAt || now,
    updatedAt: now,
  });

  try {
    // Commit parent exam_packages document first so subcollection rules can verify existence cleanly
    await setDoc(doc(db, 'exam_packages', pkg.id), pkgPayload);

    // First remove stale student_items if editing
    const existingItemsSnap = await getDocs(collection(db, 'exam_packages', pkg.id, 'student_items'));
    const batch = writeBatch(db);

    const newSet = new Set(pkg.questionIds);
    existingItemsSnap.forEach((d) => {
      if (!newSet.has(d.id)) {
        batch.delete(d.ref);
      }
    });

    pkg.questionIds.forEach((qId, idx) => {
      const q = questionsMap[qId];
      if (!q) return;
      const stim = q.stimulusId ? stimuliMap[q.stimulusId] : undefined;
      const studentItem: StudentExamItem = stripUndefined({
        id: q.id,
        orderIndex: idx,
        subjectId: q.subjectId,
        questionType: q.questionType,
        questionText: q.questionText,
        imageUrl: q.imageUrl,
        options: q.options,
        statements: q.statements,
        stimulusId: q.stimulusId,
        stimulusSnapshot: stim
          ? stripUndefined({
              title: stim.title,
              stimulusType: stim.stimulusType,
              readingText: stim.readingText,
              imageUrl: stim.imageUrl,
              tableData: stim.tableData,
              chartData: stim.chartData,
              diagramSvg: stim.diagramSvg,
            })
          : undefined,
        packageActive: Boolean(pkg.isActive),
      });
      batch.set(doc(db, 'exam_packages', pkg.id, 'student_items', q.id), studentItem);
    });

    await batch.commit();
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `exam_packages/${pkg.id}`);
  }
}

export async function deleteExamPackage(packageId: string): Promise<void> {
  try {
    const itemsSnap = await getDocs(collection(db, 'exam_packages', packageId, 'student_items'));
    const batch = writeBatch(db);
    itemsSnap.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'exam_packages', packageId));
    await batch.commit();
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `exam_packages/${packageId}`);
  }
}

// Tokens & Sessions
export async function saveExamToken(token: ExamToken): Promise<void> {
  const cleanCode = sanitizeId(token.tokenCode).toUpperCase().slice(0, 32);
  const now = new Date().toISOString();
  const payload = stripUndefined({
    tokenCode: cleanCode,
    packageId: token.packageId,
    packageTitle: token.packageTitle.slice(0, 180),
    school_id: token.school_id,
    sessionName: token.sessionName.slice(0, 120),
    isActive: Boolean(token.isActive),
    expiresAt: token.expiresAt || undefined,
    isDemo: token.isDemo,
    createdBy: token.createdBy,
    createdAt: token.createdAt || now,
  });
  try {
    await setDoc(doc(db, 'exam_tokens', cleanCode), payload);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `exam_tokens/${cleanCode}`);
  }
}

export async function deleteExamToken(tokenCode: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'exam_tokens', tokenCode));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `exam_tokens/${tokenCode}`);
  }
}

export async function saveExamSession(session: ExamSession): Promise<void> {
  const now = new Date().toISOString();
  const payload = stripUndefined({
    id: session.id,
    school_id: session.school_id,
    packageId: session.packageId,
    packageTitle: session.packageTitle.slice(0, 180),
    tokenCode: sanitizeId(session.tokenCode).toUpperCase(),
    sessionName: session.sessionName.slice(0, 120),
    scheduledStart: session.scheduledStart || undefined,
    scheduledEnd: session.scheduledEnd || undefined,
    status: session.status,
    proctorName: session.proctorName || undefined,
    isDemo: session.isDemo,
    createdBy: session.createdBy,
    createdAt: session.createdAt || now,
    updatedAt: now,
  });
  try {
    await setDoc(doc(db, 'exam_sessions', session.id), payload);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `exam_sessions/${session.id}`);
  }
}

export async function deleteExamSession(sessionId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'exam_sessions', sessionId));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `exam_sessions/${sessionId}`);
  }
}

// Student Exam Login Validation (No blanket listing of PII!)
export async function validateStudentExamLogin(
  nisInput: string,
  tokenInput: string,
  preferredSchoolId?: string,
): Promise<{
  token: ExamToken;
  examPackage: ExamPackage;
  school: School;
  studentDir: StudentDirectoryEntry;
  items: StudentExamItem[];
  existingAttempt: ExamAttempt | null;
}> {
  const tokenCode = sanitizeId(tokenInput).toUpperCase();
  const nis = sanitizeId(nisInput);
  if (!tokenCode || !nis) {
    throw new Error('NIS dan Token Ujian wajib diisi.');
  }

  let tokenSnap;
  try {
    tokenSnap = await getDoc(doc(db, 'exam_tokens', tokenCode));
  } catch (e) {
    throw new Error('Token ujian tidak ditemukan atau sudah tidak aktif.');
  }

  if (!tokenSnap.exists()) {
    throw new Error('Token ujian tidak ditemukan. Periksa kembali kode token dari pengawas.');
  }
  const token = tokenSnap.data() as ExamToken;
  if (!token.isActive) {
    throw new Error('Token ujian saat ini dinonaktifkan oleh pengawas.');
  }
  if (token.expiresAt && new Date(token.expiresAt).getTime() < Date.now()) {
    throw new Error('Masa berlaku token ujian sudah berakhir.');
  }

  // Load ExamPackage
  const pkgSnap = await getDoc(doc(db, 'exam_packages', token.packageId));
  if (!pkgSnap.exists()) {
    throw new Error('Paket simulasi untuk token ini tidak ditemukan.');
  }
  const examPackage = pkgSnap.data() as ExamPackage;
  if (!examPackage.isActive) {
    throw new Error('Paket simulasi belum diaktifkan.');
  }

  // Find student directory entry without listing students collection
  const candidateSchools: string[] = [];
  if (preferredSchoolId) {
    candidateSchools.push(preferredSchoolId);
  } else if (token.school_id !== 'ALL') {
    candidateSchools.push(token.school_id);
  } else if (examPackage.schoolScope === 'selected' && examPackage.allowedSchoolIds.length > 0) {
    candidateSchools.push(...examPackage.allowedSchoolIds);
  } else {
    candidateSchools.push('sekolah_a', 'sekolah_b');
  }

  let matchedDir: StudentDirectoryEntry | null = null;
  for (const schId of candidateSchools) {
    try {
      const dirSnap = await getDoc(doc(db, 'student_directory', `${schId}__${nis}`));
      if (dirSnap.exists()) {
        matchedDir = dirSnap.data() as StudentDirectoryEntry;
        break;
      }
    } catch {
      // Continue checking next school candidate
    }
  }

  if (!matchedDir) {
    throw new Error('NIS tidak ditemukan pada sekolah yang diizinkan untuk token ini.');
  }
  if (!matchedDir.isActive) {
    throw new Error('Akun peserta didik tidak aktif. Hubungi pengawas ujian.');
  }
  if (token.school_id !== 'ALL' && token.school_id !== matchedDir.school_id) {
    throw new Error('Token ini khusus untuk sekolah lain.');
  }
  if (
    examPackage.schoolScope === 'selected' &&
    !examPackage.allowedSchoolIds.includes(matchedDir.school_id)
  ) {
    throw new Error('Sekolah Anda tidak terdaftar dalam paket simulasi ini.');
  }

  const schoolSnap = await getDoc(doc(db, 'schools', matchedDir.school_id));
  if (!schoolSnap.exists()) {
    throw new Error('Data sekolah peserta tidak ditemukan.');
  }
  const school = schoolSnap.data() as School;

  // Load sanitized student_items (NO answer keys or explanations!)
  const itemsSnap = await getDocs(
    query(
      collection(db, 'exam_packages', examPackage.id, 'student_items'),
      where('packageActive', '==', true),
    ),
  );
  const items = itemsSnap.docs
    .map((d) => d.data() as StudentExamItem)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  if (items.length === 0) {
    throw new Error('Paket simulasi belum memiliki butir soal yang siap dikerjakan.');
  }

  // Check if student already has an attempt for this package
  const attemptId = `${examPackage.id}__${matchedDir.school_id}__${matchedDir.nis}`;
  let existingAttempt: ExamAttempt | null = null;
  try {
    const attemptSnap = await getDoc(doc(db, 'exam_attempts', attemptId));
    if (attemptSnap.exists()) {
      existingAttempt = attemptSnap.data() as ExamAttempt;
    }
  } catch {
    existingAttempt = null;
  }

  return { token, examPackage, school, studentDir: matchedDir, items, existingAttempt };
}

// Create or update student ExamAttempt + granular StudentAnswerDoc
export async function createExamAttempt(attempt: ExamAttempt): Promise<void> {
  try {
    await setDoc(doc(db, 'exam_attempts', attempt.id), stripUndefined({ ...attempt }));
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, `exam_attempts/${attempt.id}`);
  }
}

export async function updateExamAttemptProgress(
  attemptId: string,
  patch: Pick<
    ExamAttempt,
    | 'answers'
    | 'flaggedQuestionIds'
    | 'currentQuestionIndex'
    | 'lastSavedAtMs'
    | 'timeRemainingSeconds'
    | 'status'
    | 'submittedAtMs'
  >,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'exam_attempts', attemptId), stripUndefined({ ...patch }));
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `exam_attempts/${attemptId}`);
  }
}

export async function upsertStudentAnswerDoc(answerDoc: StudentAnswerDoc): Promise<void> {
  try {
    await setDoc(doc(db, 'student_answers', answerDoc.id), stripUndefined({ ...answerDoc }));
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `student_answers/${answerDoc.id}`);
  }
}

// Save graded ExamResult + ExamResultReview and mark attempt graded atomically
export async function saveGradedOutcome(
  result: ExamResult,
  review: ExamResultReview,
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'exam_results', result.id), stripUndefined({ ...result }));
    batch.set(doc(db, 'exam_result_reviews', review.id), stripUndefined({ ...review }));
    batch.update(doc(db, 'exam_attempts', result.attemptId), { status: 'graded' });
    await batch.commit();
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `exam_results/${result.id}`);
  }
}

export async function resetExamAttempt(attemptId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'exam_attempts', attemptId));
    batch.delete(doc(db, 'exam_results', attemptId));
    batch.delete(doc(db, 'exam_result_reviews', attemptId));
    await batch.commit();
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `exam_attempts/${attemptId}`);
  }
}

// Subscription helpers with mandatory structured error handler
export function subscribeCollection<T>(
  collectionName: string,
  schoolFilterId: string | null,
  onData: (items: T[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const refCol = collection(db, collectionName);
  const q = schoolFilterId ? query(refCol, where('school_id', '==', schoolFilterId)) : refCol;
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as T));
    },
    (err) => {
      if (!auth.currentUser) return;
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, collectionName);
    },
  );
}
