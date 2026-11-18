import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { AdminLayout } from './components/AdminLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PortalAuth } from './components/PortalAuth';
import { ClassesStudentsModule } from './components/modules/ClassesStudentsModule';
import { DashboardModule } from './components/modules/DashboardModule';
import { ExamExecutionModule } from './components/modules/ExamExecutionModule';
import { PackagesModule } from './components/modules/PackagesModule';
import { QuestionBankModule } from './components/modules/QuestionBankModule';
import { ReportsModule } from './components/modules/ReportsModule';
import { ResultsAnalyticsModule } from './components/modules/ResultsAnalyticsModule';
import { SchoolsModule } from './components/modules/SchoolsModule';
import { SettingsModule } from './components/modules/SettingsModule';
import { UsersModule } from './components/modules/UsersModule';
import {
  StudentExamFlow,
  type StudentSessionPayload,
} from './components/student/StudentExamFlow';
import { seedDemoData } from './lib/demoSeed';
import {
  auth,
  authPersistenceReady,
  db,
  formatFirebaseAuthError,
  googleProvider,
  handleFirestoreError,
  isPopupBlockedError,
  OperationType,
  testConnection,
} from './lib/firebase';
import {
  formatFirestoreErrorMessage,
  saveGradedOutcome,
  saveUserProfile,
  subscribeCollection,
  validateStudentExamLogin,
} from './lib/firestoreService';
import { gradeExamAttempt } from './lib/grading';
import {
  BOOTSTRAPPED_SUPER_ADMIN_EMAIL,
  type AdminNavTab,
  type ExamAttempt,
  type ExamPackage,
  type ExamResult,
  type ExamSession,
  type ExamToken,
  type Question,
  type School,
  type SchoolClass,
  type Stimulus,
  type Student,
  type UserInvite,
  type UserProfile,
} from './types/tka';

function AppShell() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);

  const [studentSession, setStudentSession] = useState<StudentSessionPayload | null>(null);

  const [activeTab, setActiveTab] = useState<AdminNavTab>('dashboard');
  const [previewSchoolId, setPreviewSchoolId] = useState<string | null>(null);

  // Domain State
  const [publicSchools, setPublicSchools] = useState<School[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [stimuli, setStimuli] = useState<Stimulus[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [packages, setPackages] = useState<ExamPackage[]>([]);
  const [tokens, setTokens] = useState<ExamToken[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [gradingBusy, setGradingBusy] = useState(false);

  const autoSeededRef = useRef(false);
  const gradingLockRef = useRef(false);
  const authSeqRef = useRef(0);
  const resolvingUidRef = useRef<string | null>(null);

  // Initial Firestore connectivity check + public active school lookup for login dropdown
  useEffect(() => {
    void testConnection();
    const loadPublicSchools = async () => {
      const candidateIds = ['sekolah_a', 'sekolah_b'];
      const found: School[] = [];
      for (const id of candidateIds) {
        try {
          const snap = await getDoc(doc(db, 'schools', id));
          if (snap.exists()) {
            found.push(snap.data() as School);
          }
        } catch {
          // ignore if not seeded yet
        }
      }
      setPublicSchools(found);
    };
    void loadPublicSchools();
  }, []);

  const resolveAuthenticatedUser = useCallback(async (user: User) => {
    if (resolvingUidRef.current === user.uid) return;
    const seq = ++authSeqRef.current;
    resolvingUidRef.current = user.uid;
    setAuthLoading(true);
    setAuthError(null);
    setPopupBlocked(false);

    try {
      const email = (user.email || '').trim().toLowerCase();
      if (!email) {
        setAuthError('Akun Google tidak memiliki alamat email yang valid.');
        await signOut(auth);
        if (authSeqRef.current === seq) setProfile(null);
        return;
      }

      if (!user.emailVerified) {
        setAuthError(
          `Email ${email} belum terverifikasi oleh Google. Gunakan akun Google terverifikasi.`,
        );
        await signOut(auth);
        if (authSeqRef.current === seq) setProfile(null);
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (authSeqRef.current !== seq) return;

      const validRoles = ['super_admin', 'school_admin', 'teacher'] as const;

      if (userSnap.exists()) {
        const existing = userSnap.data() as UserProfile;
        if (!existing.isActive) {
          setAuthError('Akun Anda sedang dinonaktifkan oleh Admin Utama.');
          await signOut(auth);
          if (authSeqRef.current === seq) setProfile(null);
          return;
        }

        if (!validRoles.includes(existing.role)) {
          setAuthError(
            'Role akun Anda pada database tidak valid. Hubungi Admin Utama untuk memperbarui hak akses.',
          );
          await signOut(auth);
          if (authSeqRef.current === seq) setProfile(null);
          return;
        }

        if (
          existing.role !== 'super_admin' &&
          (!existing.school_id || existing.school_id === 'ALL')
        ) {
          setAuthError(
            'Data school_id akun Anda belum ditetapkan ke sekolah tertentu. Hubungi Admin Utama.',
          );
          await signOut(auth);
          if (authSeqRef.current === seq) setProfile(null);
          return;
        }

        // Cross-check invite status if non-bootstrapped user has an invite record
        if (email !== BOOTSTRAPPED_SUPER_ADMIN_EMAIL) {
          try {
            const inviteSnap = await getDoc(doc(db, 'user_invites', email));
            if (authSeqRef.current !== seq) return;
            if (inviteSnap.exists()) {
              const invite = inviteSnap.data() as UserInvite;
              if (!invite.isActive) {
                setAuthError('Akses akun Anda telah dinonaktifkan oleh Admin Utama.');
                await signOut(auth);
                if (authSeqRef.current === seq) setProfile(null);
                return;
              }
            }
          } catch {
            // If invite lookup fails transiently while valid profile exists, continue with profile
          }
        }

        if (authSeqRef.current === seq) {
          setProfile(existing);
        }
      } else if (email === BOOTSTRAPPED_SUPER_ADMIN_EMAIL) {
        const rawName = (user.displayName || 'Admin Utama TKA SMART').trim();
        const newAdmin: UserProfile = {
          uid: user.uid,
          email,
          name: rawName.length >= 2 ? rawName : 'Admin Utama TKA SMART',
          role: 'super_admin',
          school_id: 'ALL',
          isActive: true,
        };
        await saveUserProfile(newAdmin);
        if (authSeqRef.current === seq) {
          setProfile(newAdmin);
        }
      } else {
        // Strict: do NOT grant admin/staff access automatically; verify pre-registered invite in Firestore
        const inviteSnap = await getDoc(doc(db, 'user_invites', email));
        if (authSeqRef.current !== seq) return;

        if (!inviteSnap.exists()) {
          setAuthError(
            `Akun Google ${email} belum terdaftar. Akses admin/guru tidak diberikan otomatis — minta Admin Utama mendaftarkan email, role, dan school_id Anda pada menu Akun Pengguna.`,
          );
          await signOut(auth);
          if (authSeqRef.current === seq) setProfile(null);
          return;
        }

        const invite = inviteSnap.data() as UserInvite;
        if (!invite.isActive) {
          setAuthError('Undangan akun Anda sedang dinonaktifkan oleh Admin Utama.');
          await signOut(auth);
          if (authSeqRef.current === seq) setProfile(null);
          return;
        }

        if (!validRoles.includes(invite.role)) {
          setAuthError('Role pada undangan akun Anda tidak valid. Hubungi Admin Utama.');
          await signOut(auth);
          if (authSeqRef.current === seq) setProfile(null);
          return;
        }

        if (
          invite.role !== 'super_admin' &&
          (!invite.school_id || invite.school_id === 'ALL')
        ) {
          setAuthError(
            'Sekolah (school_id) untuk akun Anda belum ditentukan oleh Admin Utama.',
          );
          await signOut(auth);
          if (authSeqRef.current === seq) setProfile(null);
          return;
        }

        const candidateName = (invite.name || user.displayName || email).trim();
        const safeName = candidateName.length >= 2 ? candidateName : email;
        const createdProfile: UserProfile = {
          uid: user.uid,
          email,
          name: safeName,
          role: invite.role,
          school_id: invite.role === 'super_admin' ? 'ALL' : invite.school_id,
          isActive: true,
        };
        await saveUserProfile(createdProfile);
        if (authSeqRef.current === seq) {
          setProfile(createdProfile);
        }
      }
    } catch (err) {
      if (authSeqRef.current === seq) {
        const msg = formatFirestoreErrorMessage(
          err,
          'Gagal memeriksa profil dan hak akses pengguna di Firestore.',
        );
        setAuthError(msg);
        setProfile(null);
      }
    } finally {
      if (resolvingUidRef.current === user.uid) {
        resolvingUidRef.current = null;
      }
      if (authSeqRef.current === seq) {
        setAuthLoading(false);
        setAuthReady(true);
      }
    }
  }, []);

  // Resolve Firebase Auth persistence, redirect results, & session restoration on reload
  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | undefined;

    const initAuth = async () => {
      await authPersistenceReady;
      try {
        const redirectResult = await getRedirectResult(auth);
        if (mounted && redirectResult?.user) {
          setFirebaseUser(redirectResult.user);
          await resolveAuthenticatedUser(redirectResult.user);
        }
      } catch (err) {
        if (mounted) {
          setAuthError(formatFirebaseAuthError(err));
          setPopupBlocked(isPopupBlockedError(err));
        }
      }

      if (!mounted) return;
      unsub = onAuthStateChanged(auth, async (user) => {
        if (!mounted) return;
        setFirebaseUser(user);
        if (!user) {
          authSeqRef.current += 1;
          resolvingUidRef.current = null;
          setProfile(null);
          setAuthLoading(false);
          setAuthReady(true);
          return;
        }
        await resolveAuthenticatedUser(user);
      });
    };

    void initAuth();
    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, [resolveAuthenticatedUser]);

  // Auto-seed demo data once when super_admin signs in on an empty database
  useEffect(() => {
    if (!profile || profile.role !== 'super_admin' || autoSeededRef.current) return;
    autoSeededRef.current = true;
    const ensureInitialData = async () => {
      try {
        const schSnap = await getDocs(collection(db, 'schools'));
        if (schSnap.empty) {
          await seedDemoData(profile.uid);
        }
      } catch (err) {
        console.warn('Auto-seed skipped:', err);
      }
    };
    void ensureInitialData();
  }, [profile]);

  // Subscribe to Firestore collections strictly scoped by user role and school_id
  useEffect(() => {
    if (!profile) return;

    const isSuper = profile.role === 'super_admin';
    const scopeSchoolId = isSuper ? null : profile.school_id;

    const unsubs: Array<() => void> = [];

    unsubs.push(subscribeCollection<School>('schools', null, setSchools));
    unsubs.push(subscribeCollection<Stimulus>('stimuli', null, setStimuli));
    unsubs.push(subscribeCollection<Question>('question_bank', null, setQuestions));
    unsubs.push(subscribeCollection<ExamPackage>('exam_packages', null, setPackages));
    unsubs.push(subscribeCollection<SchoolClass>('classes', scopeSchoolId, setClasses));
    unsubs.push(subscribeCollection<Student>('students', scopeSchoolId, setStudents));
    unsubs.push(subscribeCollection<ExamSession>('exam_sessions', scopeSchoolId, setSessions));
    unsubs.push(subscribeCollection<ExamAttempt>('exam_attempts', scopeSchoolId, setAttempts));
    unsubs.push(subscribeCollection<ExamResult>('exam_results', scopeSchoolId, setResults));

    // Tokens: Super admin sees all; school staff queries ['ALL', school_id]
    if (isSuper) {
      unsubs.push(subscribeCollection<ExamToken>('exam_tokens', null, setTokens));
      unsubs.push(subscribeCollection<UserInvite>('user_invites', null, setInvites));
      unsubs.push(subscribeCollection<UserProfile>('users', null, setUsers));
    } else {
      const tokenQ = query(
        collection(db, 'exam_tokens'),
        where('school_id', 'in', [profile.school_id, 'ALL']),
      );
      unsubs.push(
        onSnapshot(
          tokenQ,
          (snap) => setTokens(snap.docs.map((d) => d.data() as ExamToken)),
          (err) => {
            if (!auth.currentUser) return;
            handleFirestoreError(err, OperationType.LIST, 'exam_tokens');
          },
        ),
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [profile]);

  const packagesMap = useMemo(
    () => Object.fromEntries(packages.map((p) => [p.id, p])),
    [packages],
  );
  const questionsMap = useMemo(
    () => Object.fromEntries(questions.map((q) => [q.id, q])),
    [questions],
  );

  const handleGradePending = useCallback(async () => {
    if (!profile || gradingLockRef.current) return;
    const pending = attempts.filter((a) => a.status === 'submitted');
    if (pending.length === 0) return;

    gradingLockRef.current = true;
    setGradingBusy(true);
    try {
      for (const att of pending) {
        const pkg = packagesMap[att.packageId];
        if (!pkg) continue;
        const { result, review } = gradeExamAttempt(
          att,
          pkg,
          questionsMap,
          profile.uid,
        );
        await saveGradedOutcome(result, review);
      }
    } finally {
      gradingLockRef.current = false;
      setGradingBusy(false);
    }
  }, [profile, attempts, packagesMap, questionsMap]);

  // Automatic real-time grading whenever submitted attempts arrive while staff is signed in
  useEffect(() => {
    if (!profile || questions.length === 0 || packages.length === 0) return;
    const hasPending = attempts.some((a) => a.status === 'submitted');
    if (hasPending) {
      void handleGradePending();
    }
  }, [profile, attempts, questions.length, packages.length, handleGradePending]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setPopupBlocked(false);
    setAuthLoading(true);
    try {
      await authPersistenceReady;
      const prevUid = auth.currentUser?.uid ?? null;
      const credential = await signInWithPopup(auth, googleProvider);
      if (credential?.user && prevUid === credential.user.uid && !profile) {
        await resolveAuthenticatedUser(credential.user);
      } else if (credential?.user && prevUid === credential.user.uid && profile) {
        setAuthLoading(false);
      }
    } catch (err) {
      setPopupBlocked(isPopupBlockedError(err));
      setAuthError(formatFirebaseAuthError(err));
      setAuthLoading(false);
    }
  };

  const handleGoogleRedirectLogin = async () => {
    setAuthError(null);
    setPopupBlocked(false);
    setAuthLoading(true);
    try {
      await authPersistenceReady;
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    authSeqRef.current += 1;
    resolvingUidRef.current = null;
    autoSeededRef.current = false;

    // Detach staff subscriptions & clear local state before revoking auth token
    setProfile(null);
    setFirebaseUser(null);
    setAuthError(null);
    setPopupBlocked(false);
    setActiveTab('dashboard');
    setPreviewSchoolId(null);
    setSchools([]);
    setInvites([]);
    setUsers([]);
    setClasses([]);
    setStudents([]);
    setStimuli([]);
    setQuestions([]);
    setPackages([]);
    setTokens([]);
    setSessions([]);
    setAttempts([]);
    setResults([]);

    try {
      await signOut(auth);
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
    }
  };

  const handleStudentLogin = async (
    nis: string,
    token: string,
    schoolId?: string,
  ) => {
    const payload = await validateStudentExamLogin(nis, token, schoolId);
    setStudentSession(payload);
  };

  const demoCount = useMemo(() => {
    return (
      students.filter((s) => s.isDemo).length +
      classes.filter((c) => c.isDemo).length +
      questions.filter((q) => q.isDemo).length +
      packages.filter((p) => p.isDemo).length +
      results.filter((r) => r.isDemo).length
    );
  }, [students, classes, questions, packages, results]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="neu-surface px-8 py-6 flex items-center gap-4">
          <img
            src="/assets/aistudio/image_527feef0.png"
            alt="Logo TKA SMART"
            className="w-11 h-11 rounded-xl object-contain bg-white p-1 shadow-sm"
          />
          <div>
            <div className="text-sm font-bold text-[#1E1B4B]">TKA SMART</div>
            <div className="text-xs font-medium text-indigo-600">
              Memuat sistem simulasi akademik...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Student Exam Flow
  if (studentSession) {
    return (
      <StudentExamFlow
        session={studentSession}
        onExit={() => setStudentSession(null)}
      />
    );
  }

  // Staff Admin / Teacher Workspace
  if (firebaseUser && profile) {
    const lockedSchoolId =
      profile.role === 'super_admin' ? previewSchoolId : profile.school_id;
    const effectiveSchools = schools.length > 0 ? schools : publicSchools;

    return (
      <AdminLayout
        profile={profile}
        schools={effectiveSchools}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        previewSchoolId={previewSchoolId}
        onChangePreviewSchool={setPreviewSchoolId}
        onSignOut={handleSignOut}
      >
        {activeTab === 'dashboard' && (
          <DashboardModule
            role={profile.role}
            activeSchoolId={lockedSchoolId}
            schools={effectiveSchools}
            students={students}
            invites={invites}
            packages={packages}
            attempts={attempts}
            results={results}
            onGradePending={handleGradePending}
            gradingBusy={gradingBusy}
          />
        )}

        {activeTab === 'schools' && profile.role === 'super_admin' && (
          <SchoolsModule schools={effectiveSchools} />
        )}

        {activeTab === 'users' && profile.role === 'super_admin' && (
          <UsersModule
            invites={invites}
            users={users}
            schools={effectiveSchools}
            currentUserUid={profile.uid}
          />
        )}

        {(activeTab === 'classes' || activeTab === 'students') && (
          <ClassesStudentsModule
            mode={activeTab}
            schools={effectiveSchools}
            classes={classes}
            students={students}
            lockedSchoolId={lockedSchoolId}
          />
        )}

        {activeTab === 'question_bank' && profile.role === 'super_admin' && (
          <QuestionBankModule
            questions={questions}
            stimuli={stimuli}
            currentUserUid={profile.uid}
          />
        )}

        {activeTab === 'packages' && (
          <PackagesModule
            role={profile.role}
            lockedSchoolId={lockedSchoolId}
            packages={packages}
            questions={questions}
            stimuli={stimuli}
            schools={effectiveSchools}
            currentUserUid={profile.uid}
            onGoToExecution={() => setActiveTab('execution')}
          />
        )}

        {activeTab === 'execution' && (
          <ExamExecutionModule
            role={profile.role}
            lockedSchoolId={lockedSchoolId}
            schools={effectiveSchools}
            packages={packages}
            tokens={tokens}
            sessions={sessions}
            attempts={attempts}
            currentUserUid={profile.uid}
            onGradePending={handleGradePending}
            gradingBusy={gradingBusy}
          />
        )}

        {(activeTab === 'results' ||
          activeTab === 'analytics' ||
          activeTab === 'comparison') && (
          <ResultsAnalyticsModule
            mode={activeTab}
            role={profile.role}
            lockedSchoolId={lockedSchoolId}
            schools={effectiveSchools}
            classes={classes}
            packages={packages}
            questions={questions}
            results={results}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsModule
            role={profile.role}
            lockedSchoolId={lockedSchoolId}
            schools={effectiveSchools}
            classes={classes}
            packages={packages}
            results={results}
          />
        )}

        {activeTab === 'settings' && profile.role === 'super_admin' && (
          <SettingsModule currentUserUid={profile.uid} demoCount={demoCount} />
        )}
      </AdminLayout>
    );
  }

  // Entry Portal (Student NIS+Token + Staff Google Login)
  return (
    <PortalAuth
      onStudentLogin={handleStudentLogin}
      onGoogleLogin={handleGoogleLogin}
      onGoogleRedirectLogin={handleGoogleRedirectLogin}
      authLoading={authLoading}
      authError={authError}
      popupBlocked={popupBlocked}
      schools={publicSchools}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
