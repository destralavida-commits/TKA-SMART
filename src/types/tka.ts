export type UserRole = 'super_admin' | 'school_admin' | 'teacher';

export type SubjectId = 'bahasa_indonesia' | 'matematika';
export type PackageSubjectMode = SubjectId | 'gabungan';
export type DifficultyLevel = 'mudah' | 'sedang' | 'sukar';
export type QuestionType = 'pg' | 'pgk_mcma' | 'pgk_kategori';
export type PgkScoringRule = 'all_or_nothing' | 'partial_proportional';
export type StimulusType = 'text' | 'image' | 'table' | 'chart' | 'diagram' | 'mixed';

export const BOOTSTRAPPED_SUPER_ADMIN_EMAIL = 'nurwijayanti24@guru.sd.belajar.id';

export interface School {
  id: string;
  name: string;
  npsn: string;
  address: string;
  logoUrl: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserInvite {
  email: string;
  name: string;
  role: UserRole;
  school_id: string;
  isActive: boolean;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  school_id: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SchoolClass {
  id: string;
  school_id: string;
  name: string;
  gradeLevel: string;
  homeroomTeacher: string;
  academicYear: string;
  isActive: boolean;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Student {
  id: string;
  school_id: string;
  classId: string;
  className: string;
  nis: string;
  name: string;
  gender: 'L' | 'P';
  isActive: boolean;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentDirectoryEntry {
  studentId: string;
  school_id: string;
  classId: string;
  className: string;
  nis: string;
  displayName: string;
  isActive: boolean;
  isDemo?: boolean;
}

export interface Subject {
  id: SubjectId;
  name: string;
  code: string;
  topics: string[];
}

export interface StimulusTableData {
  headers: string[];
  rows: string[][];
}

export interface StimulusChartData {
  chartType: 'bar' | 'line';
  title: string;
  xLabel: string;
  yLabel: string;
  labels: string[];
  values: number[];
}

export interface Stimulus {
  id: string;
  subjectId: SubjectId;
  title: string;
  stimulusType: StimulusType;
  readingText?: string;
  imageUrl?: string;
  tableData?: StimulusTableData;
  chartData?: StimulusChartData;
  diagramSvg?: string;
  isDemo?: boolean;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
}

export interface QuestionStatement {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  subjectId: SubjectId;
  topic: string;
  competency: string;
  indicator: string;
  difficulty: DifficultyLevel;
  questionType: QuestionType;
  stimulusId?: string;
  questionText: string;
  imageUrl?: string;
  options?: QuestionOption[];
  statements?: QuestionStatement[];
  correctOptionId?: string;
  correctOptionIds?: string[];
  correctCategories?: Record<string, 'Benar' | 'Salah'>;
  pgkScoringRule: PgkScoringRule;
  points: number;
  explanation: string;
  isDemo?: boolean;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentExamItem {
  id: string;
  orderIndex: number;
  subjectId: SubjectId;
  questionType: QuestionType;
  questionText: string;
  imageUrl?: string;
  options?: QuestionOption[];
  statements?: QuestionStatement[];
  stimulusId?: string;
  stimulusSnapshot?: {
    title: string;
    stimulusType: StimulusType;
    readingText?: string;
    imageUrl?: string;
    tableData?: StimulusTableData;
    chartData?: StimulusChartData;
    diagramSvg?: string;
  };
  packageActive: boolean;
}

export interface ExamPackage {
  id: string;
  title: string;
  subjectMode: PackageSubjectMode;
  description?: string;
  questionIds: string[];
  questionCount: number;
  durationMinutes: number;
  startTime?: string;
  endTime?: string;
  isActive: boolean;
  schoolScope: 'both' | 'selected';
  allowedSchoolIds: string[];
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showResultsToStudent: boolean;
  showAnswersAfterExam: boolean;
  pgkScoringMode: PgkScoringRule;
  isDemo?: boolean;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExamToken {
  tokenCode: string;
  packageId: string;
  packageTitle: string;
  school_id: string;
  sessionName: string;
  isActive: boolean;
  expiresAt?: string;
  isDemo?: boolean;
  createdBy: string;
  createdAt?: string;
}

export interface ExamSession {
  id: string;
  school_id: string;
  packageId: string;
  packageTitle: string;
  tokenCode: string;
  sessionName: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  status: 'scheduled' | 'active' | 'closed';
  proctorName?: string;
  isDemo?: boolean;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentAnswerPayload {
  selectedOptionId?: string;
  selectedOptionIds?: string[];
  categoryChoices?: Record<string, 'Benar' | 'Salah'>;
}

export interface ExamAttempt {
  id: string;
  packageId: string;
  tokenCode: string;
  school_id: string;
  studentId: string;
  studentName: string;
  nis: string;
  classId: string;
  className: string;
  status: 'in_progress' | 'submitted' | 'graded';
  questionOrder: string[];
  flaggedQuestionIds: string[];
  currentQuestionIndex: number;
  answers: Record<string, StudentAnswerPayload>;
  startedAtMs: number;
  lastSavedAtMs: number;
  submittedAtMs?: number;
  timeRemainingSeconds: number;
  isDemo?: boolean;
}

export interface StudentAnswerDoc {
  id: string;
  attemptId: string;
  packageId: string;
  school_id: string;
  studentId: string;
  questionId: string;
  selectedOptionId?: string;
  selectedOptionIds?: string[];
  categoryChoices?: Record<string, 'Benar' | 'Salah'>;
  isFlagged: boolean;
  updatedAtMs: number;
}

export interface SubjectScoreSummary {
  subjectId: SubjectId;
  subjectName: string;
  totalQuestions: number;
  correctCount: number;
  earnedPoints: number;
  maxPoints: number;
  score: number;
}

export interface CompetencyBreakdownItem {
  subjectId: SubjectId;
  competency: string;
  indicator: string;
  totalQuestions: number;
  correctCount: number;
  earnedPoints: number;
  maxPoints: number;
  masteryPercent: number;
}

export interface ItemResultSummary {
  questionId: string;
  subjectId: SubjectId;
  questionType: QuestionType;
  topic: string;
  indicator: string;
  isAnswered: boolean;
  isCorrect: boolean;
  earnedPoints: number;
  maxPoints: number;
  studentAnswer: StudentAnswerPayload;
}

export interface ExamResult {
  id: string;
  attemptId: string;
  packageId: string;
  packageTitle: string;
  school_id: string;
  studentId: string;
  studentName: string;
  nis: string;
  classId: string;
  className: string;
  finalScore: number;
  maxScore: number;
  earnedPoints: number;
  correctCount: number;
  incorrectCount: number;
  blankCount: number;
  totalQuestions: number;
  percentageCorrect: number;
  subjectBreakdown: Record<string, SubjectScoreSummary>;
  competencyBreakdown: CompetencyBreakdownItem[];
  itemResults: ItemResultSummary[];
  gradedAtMs: number;
  gradedBy: string;
  isDemo?: boolean;
}

export interface ItemReviewEntry {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  correctOptionId?: string;
  correctOptionIds?: string[];
  correctCategories?: Record<string, 'Benar' | 'Salah'>;
  explanation: string;
}

export interface ExamResultReview {
  id: string;
  attemptId: string;
  packageId: string;
  school_id: string;
  reviews: ItemReviewEntry[];
  gradedAtMs: number;
  gradedBy: string;
  isDemo?: boolean;
}

export type AdminNavTab =
  | 'dashboard'
  | 'schools'
  | 'users'
  | 'students'
  | 'classes'
  | 'question_bank'
  | 'packages'
  | 'execution'
  | 'results'
  | 'analytics'
  | 'comparison'
  | 'reports'
  | 'settings';
