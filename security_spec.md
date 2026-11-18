# TKA SMART Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Multi-School Isolation (`school_id`)**: Every `class`, `student`, `exam_session`, `exam_attempt`, `student_answer`, and `exam_result` belongs to a single `school_id` existing in `/schools/{schoolId}`. A `school_admin` or `teacher` of School A can NEVER read, list, create, update, or delete records belonging to School B.
2. **Role Integrity & No Self-Escalation**: Users cannot self-assign `super_admin`, `school_admin`, or `teacher` roles unless their verified email matches the bootstrapped super admin (`nurwijayanti24@guru.sd.belajar.id`) or matches an active document in `/user_invites/{email}`.
3. **Answer Key Confidentiality**: `/question_bank` and `/exam_result_reviews` are strictly off-limits to unauthenticated student sessions. Students can ONLY read sanitized `/exam_packages/{packageId}/student_items` while testing. `/exam_result_reviews` can ONLY be read by a student after `status == 'graded'` AND the package has `showAnswersAfterExam == true`.
4. **No Duplicate Exam Submission (Terminal State Locking)**: Once an `exam_attempts/{attemptId}` transitions to `status == 'submitted'` or `'graded'`, non-staff clients are strictly blocked from modifying answers or re-submitting.
5. **Token & Student Existence Verification**: Creating an `exam_attempts/{attemptId}` requires an active token in `/exam_tokens/{tokenCode}` matching the `packageId` and valid student in `/student_directory/{schoolId}__{nis}`.
6. **No Blanket Listing of PII or Tokens**: Unauthenticated clients cannot `list` `/students`, `/student_directory`, `/exam_tokens`, `/users`, or `/user_invites`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Shadow Field Injection on School Create**: Super Admin sends `{ id: "sch_1", name: "SD Test", npsn: "1234", isActive: true, hackedFlag: true }` to `/schools/sch_1` -> **DENIED** by `hasOnly(...)`.
2. **Self-Assigned Super Admin**: Signed-in uninvited user sends `{ uid: auth.uid, email: "attacker@gmail.com", name: "Evil", role: "super_admin", school_id: "ALL", isActive: true }` to `/users/{uid}` -> **DENIED** by invite/email gate.
3. **Unverified Email Spoofing**: Token has `email: "nurwijayanti24@guru.sd.belajar.id"` with `email_verified: false` -> **DENIED** by `request.auth.token.email_verified == true`.
4. **Cross-School Student Read**: Teacher of `sekolah_a` tries `get(/students/stu_sekolah_b_1)` -> **DENIED** by `school_id` isolation.
5. **Cross-School Student List Query Without Filter**: Teacher of `sekolah_a` tries `list(/students)` without `where('school_id', '==', 'sekolah_a')` -> **DENIED** by `resource.data.school_id == getUserSchoolId()`.
6. **Student Reading Question Bank Keys**: Student (`request.auth == null`) tries `get(/question_bank/q_001)` or `list(/question_bank)` -> **DENIED** by `isAnyStaff()`.
7. **Student Enumerating Tokens**: Student tries `list(/exam_tokens)` -> **DENIED** by `allow list: if isAnyStaff()`.
8. **Student Resubmitting Locked Attempt**: Student updates `/exam_attempts/{attemptId}` where `existing().status == 'submitted'` to change `answers` -> **DENIED** by terminal state lock.
9. **Student Forging Attempt Without Active Token**: Student creates `/exam_attempts/{attemptId}` with fake `tokenCode: "FAKE999"` -> **DENIED** by `exists(/exam_tokens/FAKE999)` and `isActive == true`.
10. **Student Reading Answer Review Before Permission**: Student tries `get(/exam_result_reviews/{attemptId})` when `showAnswersAfterExam == false` -> **DENIED**.
11. **Oversized ID Poisoning**: Client writes to `/classes/aaaa... (200 chars)` or invalid characters `../hack` -> **DENIED** by `isValidId(id)`.
12. **Teacher Mutating Shared Question Bank Points/Correctness As Student or Changing School ID on Existing Student**: Teacher updates `/students/{id}` changing `school_id` from `sekolah_a` to `sekolah_b` -> **DENIED** by `incoming().school_id == existing().school_id`.
