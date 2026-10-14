// Deterministic UC admission rules used by the calculators and rule-based chat answers.
// Every value mirrors a knowledge-base document (see `doc` fields); tests/admissions/rules.test.ts
// checks that each value still appears in that document, so update both together.

export type Letter = "A" | "B" | "C" | "D" | "F";
export type HonorsType = "none" | "uc" | "school";
export type GradeLevel = 10 | 11;

export const GRADE_POINTS: Record<Letter, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

export const GPA_RULES = {
  doc: "freshman-gpa-calculation",
  residentMinimum: 3.0,
  nonresidentMinimum: 3.4,
  honorsCapTotal: 8,
  honorsCapTenthGrade: 4,
} as const;

export const A_G_RULES = {
  doc: "a-g-subject-requirements",
  totalCourses: 15,
  beforeSeniorYear: 11,
  subjects: [
    { key: "a", name: { zh: "A 历史", en: "A History" }, required: 2, recommended: 2 },
    { key: "b", name: { zh: "B 英语", en: "B English" }, required: 4, recommended: 4 },
    { key: "c", name: { zh: "C 数学", en: "C Mathematics" }, required: 3, recommended: 4 },
    { key: "d", name: { zh: "D 科学", en: "D Science" }, required: 2, recommended: 3 },
    { key: "e", name: { zh: "E 英语以外的语言", en: "E Language other than English" }, required: 2, recommended: 3 },
    { key: "f", name: { zh: "F 视觉与表演艺术", en: "F Visual and performing arts" }, required: 1, recommended: 1 },
    { key: "g", name: { zh: "G 大学预科选修", en: "G College-preparatory elective" }, required: 1, recommended: 1 },
  ],
} as const;

export const FEE_RULES = {
  doc: "application-fees-and-waivers",
  domesticPerCampus: 80,
  internationalPerCampus: 95,
  waiverCampuses: 4,
  campusCount: 9,
} as const;

export const TAG_RULES = {
  doc: "uc-tag",
  participating: ["Davis", "Irvine", "Merced", "Riverside", "Santa Barbara", "Santa Cruz"],
  notParticipating: ["Berkeley", "UCLA", "San Diego"],
} as const;

// UC's statewide admissions index chart: minimum A-G semester courses for each GPA floor.
export const STATEWIDE_INDEX = {
  doc: "statewide-and-elc-guarantee",
  chart: [
    { minGpa: 4.25, label: "4.25 or above", courses: 30 },
    { minGpa: 4.2, label: "4.20-4.24", courses: 32 },
    { minGpa: 4.15, label: "4.15-4.19", courses: 34 },
    { minGpa: 4.1, label: "4.10-4.14", courses: 37 },
    { minGpa: 4.05, label: "4.05-4.09", courses: 41 },
    { minGpa: 4.0, label: "4.00-4.04", courses: 46 },
    { minGpa: 3.95, label: "3.95-3.99", courses: 50 },
    { minGpa: 3.9, label: "3.90-3.94", courses: 54 },
    { minGpa: 3.85, label: "3.85-3.89", courses: 58 },
    { minGpa: 3.8, label: "3.80-3.84", courses: 63 },
    { minGpa: 3.75, label: "3.75-3.79", courses: 66 },
    { minGpa: 3.7, label: "3.70-3.74", courses: 70 },
    { minGpa: 3.65, label: "3.65-3.69", courses: 74 },
    { minGpa: 3.6, label: "3.60-3.64", courses: 76 },
  ],
} as const;

// ---- UC GPA -------------------------------------------------------------------------------

export type SemesterGrade = { level: GradeLevel; letter: Letter; honors: HonorsType; apOrIb?: boolean };

export type GpaResult = {
  letterGrades: number;
  basePoints: number;
  unweighted: number | null;
  resident: { honorsPoints: number; tenthGradeHonors: number; gpa: number | null };
  nonresident: { honorsPoints: number; gpa: number | null };
};

// UC says not to round; results are truncated to two decimals for display.
export function truncate2(value: number): number {
  return Math.floor(value * 100 + 1e-9) / 100;
}

/**
 * Computes the UC GPA from 10th- and 11th-grade A-G semester grades (summers already assigned to
 * the grade level UC counts them in). Residents earn one honors point per semester of a
 * UC-recognized honors course graded A-C, capped at 8 total and 4 in 10th grade. For nonresidents,
 * only AP/IB courses graded A-C are weighted; UC does not state a separate cap, so the same caps
 * are applied as an estimate.
 */
export function calculateUcGpa(grades: SemesterGrade[]): GpaResult {
  const basePoints = grades.reduce((sum, grade) => sum + GRADE_POINTS[grade.letter], 0);
  const passesHonors = (grade: SemesterGrade) => ["A", "B", "C"].includes(grade.letter);

  function cappedHonors(eligible: (grade: SemesterGrade) => boolean) {
    const tenth = Math.min(
      grades.filter((grade) => grade.level === 10 && eligible(grade)).length,
      GPA_RULES.honorsCapTenthGrade
    );
    const eleventh = grades.filter((grade) => grade.level === 11 && eligible(grade)).length;
    return { total: Math.min(tenth + eleventh, GPA_RULES.honorsCapTotal), tenth };
  }

  const resident = cappedHonors((grade) => grade.honors === "uc" && passesHonors(grade));
  const nonresident = cappedHonors((grade) => grade.honors === "uc" && grade.apOrIb === true && passesHonors(grade));
  const count = grades.length;
  const gpa = (honors: number) => (count ? truncate2((basePoints + honors) / count) : null);

  return {
    letterGrades: count,
    basePoints,
    unweighted: gpa(0),
    resident: { honorsPoints: resident.total, tenthGradeHonors: resident.tenth, gpa: gpa(resident.total) },
    nonresident: { honorsPoints: nonresident.total, gpa: gpa(nonresident.total) },
  };
}

export type StatewideEstimate =
  | { status: "below-chart" }
  | { status: "meets" | "short"; row: (typeof STATEWIDE_INDEX.chart)[number]; shortBy: number };

export function estimateStatewideIndex(gpa: number, semesterCourses: number): StatewideEstimate {
  const row = STATEWIDE_INDEX.chart.find((entry) => gpa >= entry.minGpa);

  if (!row) {
    return { status: "below-chart" };
  }

  const shortBy = Math.max(0, Math.ceil(row.courses - semesterCourses));
  return { status: shortBy === 0 ? "meets" : "short", row, shortBy };
}

// ---- A-G ----------------------------------------------------------------------------------

export type AgInput = Record<string, { beforeSenior: number; senior: number }>;

export function checkAg(input: AgInput) {
  const totals = A_G_RULES.subjects.map((subject) => {
    const entry = input[subject.key] ?? { beforeSenior: 0, senior: 0 };
    return { ...subject, beforeSenior: entry.beforeSenior, total: entry.beforeSenior + entry.senior };
  });
  // The G elective can also be met by A-F years beyond what those subjects require.
  const surplusForElective = totals
    .filter((subject) => subject.key !== "g")
    .reduce((sum, subject) => sum + Math.max(0, subject.total - subject.required), 0);
  const subjects = totals.map((subject) => {
    const counted = subject.key === "g" ? subject.total + surplusForElective : subject.total;
    return { ...subject, met: counted >= subject.required, meetsRecommended: subject.total >= subject.recommended };
  });
  const totalYears = totals.reduce((sum, subject) => sum + subject.total, 0);
  const beforeSeniorYears = totals.reduce((sum, subject) => sum + subject.beforeSenior, 0);
  const totalMet = totalYears >= A_G_RULES.totalCourses;
  const beforeSeniorMet = beforeSeniorYears >= A_G_RULES.beforeSeniorYear;

  return {
    subjects,
    totalYears,
    beforeSeniorYears,
    totalMet,
    beforeSeniorMet,
    allMet: subjects.every((subject) => subject.met) && totalMet && beforeSeniorMet,
  };
}

// ---- Fees ---------------------------------------------------------------------------------

export function calculateApplicationFee(campuses: number, options: { international: boolean; waiverEligible: boolean }) {
  const count = Math.max(0, Math.min(FEE_RULES.campusCount, Math.floor(campuses)));

  if (options.international) {
    return { campuses: count, perCampus: FEE_RULES.internationalPerCampus, waived: 0, total: count * FEE_RULES.internationalPerCampus };
  }

  const waived = options.waiverEligible ? Math.min(count, FEE_RULES.waiverCampuses) : 0;
  return { campuses: count, perCampus: FEE_RULES.domesticPerCampus, waived, total: (count - waived) * FEE_RULES.domesticPerCampus };
}
