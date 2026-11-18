import type {
  CompetencyBreakdownItem,
  ExamAttempt,
  ExamPackage,
  ExamResult,
  ExamResultReview,
  ItemResultSummary,
  ItemReviewEntry,
  PgkScoringRule,
  Question,
  StudentAnswerPayload,
  SubjectId,
  SubjectScoreSummary,
} from '../types/tka';

export function isQuestionAnswered(
  questionType: Question['questionType'],
  answer?: StudentAnswerPayload,
): boolean {
  if (!answer) return false;
  if (questionType === 'pg') {
    return Boolean(answer.selectedOptionId && answer.selectedOptionId.trim().length > 0);
  }
  if (questionType === 'pgk_mcma') {
    return Array.isArray(answer.selectedOptionIds) && answer.selectedOptionIds.length > 0;
  }
  if (questionType === 'pgk_kategori') {
    return Boolean(
      answer.categoryChoices && Object.keys(answer.categoryChoices).length > 0,
    );
  }
  return false;
}

export function gradeQuestionItem(
  question: Question,
  answer: StudentAnswerPayload | undefined,
  packageScoringOverride?: PgkScoringRule,
): { earnedPoints: number; maxPoints: number; isCorrect: boolean; isAnswered: boolean } {
  const maxPoints = question.points || 1;
  const isAnswered = isQuestionAnswered(question.questionType, answer);
  if (!isAnswered || !answer) {
    return { earnedPoints: 0, maxPoints, isCorrect: false, isAnswered: false };
  }

  const rule: PgkScoringRule = packageScoringOverride || question.pgkScoringRule || 'all_or_nothing';

  if (question.questionType === 'pg') {
    const isCorrect = answer.selectedOptionId === question.correctOptionId;
    return {
      earnedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
      isCorrect,
      isAnswered: true,
    };
  }

  if (question.questionType === 'pgk_mcma') {
    const expected = new Set(question.correctOptionIds || []);
    const chosen = new Set(answer.selectedOptionIds || []);
    const allMatch =
      expected.size > 0 &&
      expected.size === chosen.size &&
      [...expected].every((id) => chosen.has(id));

    if (rule === 'all_or_nothing') {
      return {
        earnedPoints: allMatch ? maxPoints : 0,
        maxPoints,
        isCorrect: allMatch,
        isAnswered: true,
      };
    }

    // Partial proportional: +1 per true positive, -0.5 penalty per false positive, floored at 0
    if (expected.size === 0) {
      return { earnedPoints: 0, maxPoints, isCorrect: false, isAnswered: true };
    }
    let truePos = 0;
    let falsePos = 0;
    chosen.forEach((id) => {
      if (expected.has(id)) truePos += 1;
      else falsePos += 1;
    });
    const ratio = Math.max(0, (truePos - falsePos * 0.5) / expected.size);
    const earned = Number((ratio * maxPoints).toFixed(2));
    return {
      earnedPoints: earned,
      maxPoints,
      isCorrect: allMatch,
      isAnswered: true,
    };
  }

  // pgk_kategori
  const statements = question.statements || [];
  const expectedMap = question.correctCategories || {};
  const chosenMap = answer.categoryChoices || {};
  if (statements.length === 0) {
    return { earnedPoints: 0, maxPoints, isCorrect: false, isAnswered: true };
  }

  let matchedCount = 0;
  for (const st of statements) {
    if (chosenMap[st.id] && chosenMap[st.id] === expectedMap[st.id]) {
      matchedCount += 1;
    }
  }
  const allCorrect = matchedCount === statements.length;

  if (rule === 'all_or_nothing') {
    return {
      earnedPoints: allCorrect ? maxPoints : 0,
      maxPoints,
      isCorrect: allCorrect,
      isAnswered: true,
    };
  }

  const earned = Number(((matchedCount / statements.length) * maxPoints).toFixed(2));
  return {
    earnedPoints: earned,
    maxPoints,
    isCorrect: allCorrect,
    isAnswered: true,
  };
}

export function gradeExamAttempt(
  attempt: ExamAttempt,
  examPackage: ExamPackage,
  questionsMap: Record<string, Question>,
  gradedBy: string,
): { result: ExamResult; review: ExamResultReview } {
  const orderedIds =
    attempt.questionOrder && attempt.questionOrder.length > 0
      ? attempt.questionOrder
      : examPackage.questionIds;

  let earnedPoints = 0;
  let maxScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let blankCount = 0;

  const subjectAcc: Record<
    string,
    {
      subjectId: SubjectId;
      subjectName: string;
      totalQuestions: number;
      correctCount: number;
      earnedPoints: number;
      maxPoints: number;
    }
  > = {};

  const competencyAcc: Record<
    string,
    {
      subjectId: SubjectId;
      competency: string;
      indicator: string;
      totalQuestions: number;
      correctCount: number;
      earnedPoints: number;
      maxPoints: number;
    }
  > = {};

  const itemResults: ItemResultSummary[] = [];
  const reviews: ItemReviewEntry[] = [];

  for (const qId of orderedIds) {
    const q = questionsMap[qId];
    if (!q) continue;

    const studentAns = attempt.answers?.[qId] || {};
    const graded = gradeQuestionItem(q, studentAns, examPackage.pgkScoringMode);

    earnedPoints += graded.earnedPoints;
    maxScore += graded.maxPoints;

    if (!graded.isAnswered) {
      blankCount += 1;
    } else if (graded.isCorrect) {
      correctCount += 1;
    } else {
      incorrectCount += 1;
    }

    const subjName = q.subjectId === 'bahasa_indonesia' ? 'Bahasa Indonesia' : 'Matematika';
    if (!subjectAcc[q.subjectId]) {
      subjectAcc[q.subjectId] = {
        subjectId: q.subjectId,
        subjectName: subjName,
        totalQuestions: 0,
        correctCount: 0,
        earnedPoints: 0,
        maxPoints: 0,
      };
    }
    subjectAcc[q.subjectId].totalQuestions += 1;
    if (graded.isCorrect) subjectAcc[q.subjectId].correctCount += 1;
    subjectAcc[q.subjectId].earnedPoints += graded.earnedPoints;
    subjectAcc[q.subjectId].maxPoints += graded.maxPoints;

    const compKey = `${q.subjectId}::${q.indicator}`;
    if (!competencyAcc[compKey]) {
      competencyAcc[compKey] = {
        subjectId: q.subjectId,
        competency: q.competency,
        indicator: q.indicator,
        totalQuestions: 0,
        correctCount: 0,
        earnedPoints: 0,
        maxPoints: 0,
      };
    }
    competencyAcc[compKey].totalQuestions += 1;
    if (graded.isCorrect) competencyAcc[compKey].correctCount += 1;
    competencyAcc[compKey].earnedPoints += graded.earnedPoints;
    competencyAcc[compKey].maxPoints += graded.maxPoints;

    itemResults.push({
      questionId: q.id,
      subjectId: q.subjectId,
      questionType: q.questionType,
      topic: q.topic,
      indicator: q.indicator,
      isAnswered: graded.isAnswered,
      isCorrect: graded.isCorrect,
      earnedPoints: graded.earnedPoints,
      maxPoints: graded.maxPoints,
      studentAnswer: studentAns,
    });

    reviews.push({
      questionId: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      correctOptionId: q.correctOptionId,
      correctOptionIds: q.correctOptionIds,
      correctCategories: q.correctCategories,
      explanation: q.explanation,
    });
  }

  const totalQuestions = itemResults.length;
  const finalScore = maxScore > 0 ? Number(((earnedPoints / maxScore) * 100).toFixed(1)) : 0;
  const percentageCorrect =
    totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 100).toFixed(1)) : 0;

  const subjectBreakdown: Record<string, SubjectScoreSummary> = {};
  Object.entries(subjectAcc).forEach(([k, v]) => {
    subjectBreakdown[k] = {
      ...v,
      earnedPoints: Number(v.earnedPoints.toFixed(2)),
      score: v.maxPoints > 0 ? Number(((v.earnedPoints / v.maxPoints) * 100).toFixed(1)) : 0,
    };
  });

  const competencyBreakdown: CompetencyBreakdownItem[] = Object.values(competencyAcc).map((c) => ({
    ...c,
    earnedPoints: Number(c.earnedPoints.toFixed(2)),
    masteryPercent: c.maxPoints > 0 ? Number(((c.earnedPoints / c.maxPoints) * 100).toFixed(1)) : 0,
  }));

  const now = Date.now();

  const result: ExamResult = {
    id: attempt.id,
    attemptId: attempt.id,
    packageId: attempt.packageId,
    packageTitle: examPackage.title,
    school_id: attempt.school_id,
    studentId: attempt.studentId,
    studentName: attempt.studentName,
    nis: attempt.nis,
    classId: attempt.classId,
    className: attempt.className,
    finalScore,
    maxScore,
    earnedPoints: Number(earnedPoints.toFixed(2)),
    correctCount,
    incorrectCount,
    blankCount,
    totalQuestions,
    percentageCorrect,
    subjectBreakdown,
    competencyBreakdown,
    itemResults,
    gradedAtMs: now,
    gradedBy,
    isDemo: Boolean(attempt.isDemo),
  };

  const review: ExamResultReview = {
    id: attempt.id,
    attemptId: attempt.id,
    packageId: attempt.packageId,
    school_id: attempt.school_id,
    reviews,
    gradedAtMs: now,
    gradedBy,
    isDemo: Boolean(attempt.isDemo),
  };

  return { result, review };
}

export interface ScoreBucket {
  label: string;
  count: number;
}

export function buildScoreDistribution(results: ExamResult[]): ScoreBucket[] {
  const buckets: ScoreBucket[] = [
    { label: '< 50', count: 0 },
    { label: '50 - 64', count: 0 },
    { label: '65 - 74', count: 0 },
    { label: '75 - 84', count: 0 },
    { label: '85 - 100', count: 0 },
  ];
  for (const r of results) {
    if (r.finalScore < 50) buckets[0].count += 1;
    else if (r.finalScore < 65) buckets[1].count += 1;
    else if (r.finalScore < 75) buckets[2].count += 1;
    else if (r.finalScore < 85) buckets[3].count += 1;
    else buckets[4].count += 1;
  }
  return buckets;
}

export interface QuestionErrorAnalytics {
  questionId: string;
  questionText: string;
  subjectId: SubjectId;
  questionType: Question['questionType'];
  indicator: string;
  totalAttempts: number;
  correctCount: number;
  incorrectCount: number;
  blankCount: number;
  errorRate: number;
  optionDistribution: Record<string, number>;
}

export function buildItemAnalytics(
  results: ExamResult[],
  questionsMap: Record<string, Question>,
): QuestionErrorAnalytics[] {
  const acc: Record<string, QuestionErrorAnalytics> = {};

  for (const res of results) {
    for (const item of res.itemResults || []) {
      const q = questionsMap[item.questionId];
      if (!acc[item.questionId]) {
        acc[item.questionId] = {
          questionId: item.questionId,
          questionText: q?.questionText || item.indicator,
          subjectId: item.subjectId,
          questionType: item.questionType,
          indicator: item.indicator,
          totalAttempts: 0,
          correctCount: 0,
          incorrectCount: 0,
          blankCount: 0,
          errorRate: 0,
          optionDistribution: {},
        };
      }
      const entry = acc[item.questionId];
      entry.totalAttempts += 1;
      if (!item.isAnswered) {
        entry.blankCount += 1;
      } else if (item.isCorrect) {
        entry.correctCount += 1;
      } else {
        entry.incorrectCount += 1;
      }

      if (item.questionType === 'pg' && item.studentAnswer?.selectedOptionId) {
        const key = item.studentAnswer.selectedOptionId;
        entry.optionDistribution[key] = (entry.optionDistribution[key] || 0) + 1;
      } else if (item.questionType === 'pgk_mcma' && item.studentAnswer?.selectedOptionIds) {
        for (const optId of item.studentAnswer.selectedOptionIds) {
          entry.optionDistribution[optId] = (entry.optionDistribution[optId] || 0) + 1;
        }
      } else if (item.questionType === 'pgk_kategori' && item.studentAnswer?.categoryChoices) {
        Object.entries(item.studentAnswer.categoryChoices).forEach(([stId, val]) => {
          const key = `${stId}:${val}`;
          entry.optionDistribution[key] = (entry.optionDistribution[key] || 0) + 1;
        });
      }
    }
  }

  return Object.values(acc)
    .map((entry) => ({
      ...entry,
      errorRate:
        entry.totalAttempts > 0
          ? Number((((entry.incorrectCount + entry.blankCount) / entry.totalAttempts) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.errorRate - a.errorRate);
}
