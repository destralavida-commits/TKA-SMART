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
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
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
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from './lib/firebase';
import {
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

  // Resolve Firebase Auth -> UserProfile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setAuthReady(true);
        return;
      }

      setAuthLoading(true);
      setAuthError(null);
      try {
        const email = (user.email || '').trim().toLowerCase();
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const existing = userSnap.data() as UserProfile;
          if (!existing.isActive) {
            setAuthError('Akun Anda sedang dinonaktifkan oleh Admin Utama.');
            await signOut(auth);
            setProfile(null);
            return;
          }
          setProfile(existing);
        } else if (email === BOOTSTRAPPED_SUPER_ADMIN_EMAIL) {
          const newAdmin: UserProfile = {
            uid: user.uid,
            email,
            name: user.displayName || 'Admin Utama TKA SMART',
            role: 'super_admin',
            school_id: 'ALL',
            isActive: true,
          };
          await saveUserProfile(newAdmin);
          setProfile(newAdmin);
        } else {
          // Check invite registry
          const inviteSnap = await getDoc(doc(db, 'user_invites', email));
          if (!inviteSnap.exists()) {
            setAuthError(
              `Email ${email} belum terdaftar. Minta Admin Utama menambahkan akun Anda pada menu Akun Pengguna.`,
            );
            await signOut(auth);
            setProfile(null);
            return;
          }
          const invite = inviteSnap.data() as UserInvite;
          if (!invite.isActive) {
            setAuthError('Undangan akun Anda tidak aktif.');
            await signOut(auth);
            setProfile(null);
            return;
          }
          const createdProfile: UserProfile = {
            uid: user.uid,
            email,
            name: invite.name || user.displayName || email,
            role: invite.role,
            school_id: invite.school_id,
            isActive: true,
          };
          await saveUserProfile(createdProfile);
          setProfile(createdProfile);
        }
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : 'Gagal memuat profil pengguna.',
        );
      } finally {
        setAuthLoading(false);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

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
          (err) => handleFirestoreError(err, OperationType.LIST, 'exam_tokens'),
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
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Login Google dibatalkan atau gagal.',
      );
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setProfile(null);
    setActiveTab('dashboard');
    setPreviewSchoolId(null);
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
      authLoading={authLoading}
      authError={authError}
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
