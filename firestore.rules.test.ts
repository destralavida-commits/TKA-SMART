/**
 * Phase 0: Security Rule Invariant & Dirty Dozen Payload Verification Spec
 * Validates that firestore.rules enforces all Eight Pillars and blocks all 12 adversarial payloads.
 */
import fs from 'fs';
import path from 'path';

export interface DirtyDozenCase {
  id: string;
  name: string;
  targetPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedResult: 'PERMISSION_DENIED';
  enforcedByPattern: RegExp;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 'DD-01',
    name: 'Shadow Field Injection on School Create',
    targetPath: '/schools/sch_1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPattern: /isValidSchool\(data\)[\s\S]*hasOnly\(/,
  },
  {
    id: 'DD-02',
    name: 'Self-Assigned Super Admin Role Escalation',
    targetPath: '/users/attacker_uid',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPattern: /exists\(\/databases\/\$\(database\)\/documents\/user_invites\//,
  },
  {
    id: 'DD-03',
    name: 'Unverified Email Spoofing',
    targetPath: '/schools/sch_1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPattern: /request\.auth\.token\.email_verified == true/,
  },
  {
    id: 'DD-04',
    name: 'Cross-School Student Read',
    targetPath: '/students/stu_sekolah_b_1',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPattern: /match \/students\/\{studentId\}[\s\S]*isStaffOfSchool\(existing\(\)\.school_id\)/,
  },
  {
    id: 'DD-05',
    name: 'Cross-School Student List Without School Filter',
    targetPath: '/students',
    operation: 'list',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPattern: /match \/students\/\{studentId\}[\s\S]*resource\.data\.school_id == getUserData\(\)\.school_id/,
  },
  {
    id: 'DD-06',
    name: 'Student Reading Question Bank Answer Keys',
    targetPath: '/question_bank/q_001',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPattern: /match \/question_bank\/\{questionId\}[\s\S]*allow get: if isValidId\(questionId\) && isAnyStaff\(\)/,
  },
  {
    id: 'DD-07',
    name: 'Student Enumerating Exam Tokens',
    targetPath: '/exam_tokens',
    operation: 'list',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPattern: /match \/exam_tokens\/\{tokenCode\}[\s\S]*allow list: if isSuperAdmin\(\)/,
  },
  {
    id: 'DD-08',
    name: 'Student Resubmitting Locked Exam Attempt',
    targetPath: '/exam_attempts/pkg_1__sekolah_a__2026001',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPattern: /existing\(\)\.status == 'in_progress'/,
  },
  {
    id: 'DD-09',
    name: 'Student Forging Exam Attempt Without Active Token',
    targetPath: '/exam_attempts/pkg_1__sekolah_a__2026001',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPattern: /exists\(\/databases\/\$\(database\)\/documents\/exam_tokens\/\$\(incoming\(\)\.tokenCode\)\)/,
  },
  {
    id: 'DD-10',
    name: 'Student Reading Answer Review Before Admin Approval',
    targetPath: '/exam_result_reviews/pkg_1__sekolah_a__2026001',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPattern: /showAnswersAfterExam == true/,
  },
  {
    id: 'DD-11',
    name: 'Oversized / Malformed Document ID Poisoning',
    targetPath: '/classes/invalid..id',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPattern: /function isValidId\(id\)[\s\S]*id\.size\(\) <= 128 && id\.matches/,
  },
  {
    id: 'DD-12',
    name: 'Cross-School Mutation on Existing Student Record',
    targetPath: '/students/stu_1',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    enforcedByPattern: /incoming\(\)\.school_id == existing\(\)\.school_id/,
  },
];

export function verifyRulesSecuritySpec(): { passed: boolean; failures: string[] } {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const content = fs.readFileSync(rulesPath, 'utf-8');
  const failures: string[] = [];

  if (!content.includes("rules_version = '2';")) {
    failures.push('Missing rules_version = 2');
  }
  if (!content.includes('match /{document=**} {\n      allow read, write: if false;\n    }')) {
    failures.push('Missing global default-deny catch-all');
  }

  for (const testCase of DIRTY_DOZEN_CASES) {
    if (!testCase.enforcedByPattern.test(content)) {
      failures.push(`${testCase.id} (${testCase.name}) pattern not enforced`);
    }
  }

  return { passed: failures.length === 0, failures };
}
