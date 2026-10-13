// Client-safe labels and highlights for the admissions pages. Facts here mirror the linked
// knowledge-base documents; update both when UC changes a requirement.
import type { Audience, Category } from "./content.ts";

export type Lang = "zh" | "en";
export type ApplicantType = Exclude<Audience, "all">;
export type Bilingual = { zh: string; en: string };

export type DocCard = {
  slug: string;
  title: string;
  titleZh: string;
  summary: string;
  summaryZh: string;
  category: Category;
  order: number;
  audience: Audience;
  lastReviewed: string;
};

export type Highlight = { value: Bilingual; label: Bilingual; note: Bilingual; slug: string };

export const CATEGORY_ORDER: Category[] = ["requirements", "review", "dates", "programs", "costs", "campuses"];

export const CATEGORY_LABELS: Record<Category, Bilingual> = {
  requirements: { zh: "申请要求", en: "Requirements" },
  review: { zh: "审核与文书", en: "Review & essays" },
  dates: { zh: "时间线", en: "Timelines" },
  programs: { zh: "转学项目与工具", en: "Transfer programs & tools" },
  costs: { zh: "费用与资助", en: "Costs & aid" },
  campuses: { zh: "校区", en: "Campuses" },
};

export const AUDIENCE_LABELS: Record<Audience, Bilingual> = {
  freshman: { zh: "高中生", en: "First-year" },
  transfer: { zh: "转学生", en: "Transfer" },
  all: { zh: "通用", en: "All applicants" },
};

export const HIGHLIGHTS: Record<ApplicantType, Highlight[]> = {
  freshman: [
    {
      value: { zh: "15 门", en: "15" },
      label: { zh: "A-G 预科课程", en: "A-G courses" },
      note: { zh: "其中 11 门须在 12 年级前完成", en: "11 finished before senior year" },
      slug: "a-g-subject-requirements",
    },
    {
      value: { zh: "3.0", en: "3.0" },
      label: { zh: "最低 GPA（加州居民）", en: "Minimum GPA (CA residents)" },
      note: { zh: "外州学生 3.4，不代表有竞争力", en: "3.4 for nonresidents; not a competitive GPA" },
      slug: "freshman-gpa-calculation",
    },
    {
      value: { zh: "8 选 4", en: "4 of 8" },
      label: { zh: "PIQ 个人陈述", en: "Personal insight questions" },
      note: { zh: "每篇最多 350 词，题目权重相同", en: "Up to 350 words each, equally weighted" },
      slug: "freshman-personal-insight-questions",
    },
    {
      value: { zh: "不计入", en: "Not used" },
      label: { zh: "SAT / ACT 成绩", en: "SAT / ACT scores" },
      note: { zh: "UC 录取决定不参考标化成绩", en: "Not considered in admission decisions" },
      slug: "freshman-comprehensive-review",
    },
  ],
  transfer: [
    {
      value: { zh: "60", en: "60" },
      label: { zh: "学期制可转学分", en: "Semester units" },
      note: { zh: "或 90 学季学分", en: "or 90 quarter units" },
      slug: "uc-transfer-basic-requirements",
    },
    {
      value: { zh: "2.4", en: "2.4" },
      label: { zh: "最低 GPA（加州居民）", en: "Minimum GPA (CA residents)" },
      note: { zh: "外州学生 2.8，不代表有竞争力", en: "2.8 for nonresidents; not a competitive GPA" },
      slug: "uc-transfer-basic-requirements",
    },
    {
      value: { zh: "7 门", en: "7" },
      label: { zh: "核心课程（7-course pattern）", en: "Courses in the 7-course pattern" },
      note: { zh: "秋季入学前的春季学期内完成", en: "Done by spring before fall entry" },
      slug: "uc-transfer-basic-requirements",
    },
    {
      value: { zh: "6 个", en: "6" },
      label: { zh: "校区参加 TAG", en: "Campuses offer TAG" },
      note: { zh: "伯克利、UCLA、UCSD 不参加", en: "Not Berkeley, UCLA, or UC San Diego" },
      slug: "uc-tag",
    },
  ],
};

export const SUGGESTED_QUESTIONS: Record<ApplicantType, Bilingual[]> = {
  freshman: [
    { zh: "UC GPA 怎么算？哪些年级计入？", en: "How is the UC GPA calculated?" },
    { zh: "A-G 课程有哪些要求？", en: "What are the A-G requirements?" },
    { zh: "UC 看 SAT 成绩吗？", en: "Does UC consider SAT scores?" },
    { zh: "2027 秋季新生申请什么时候截止？", en: "When is the fall 2027 first-year deadline?" },
  ],
  transfer: [
    { zh: "转学需要多少学分？", en: "How many units do I need to transfer?" },
    { zh: "哪些校区参加 TAG？", en: "Which campuses participate in TAG?" },
    { zh: "IGETC 是必须完成的吗？", en: "Is IGETC required for every transfer student?" },
    { zh: "转学 PIQ 要写几篇？", en: "How many PIQs do transfer applicants write?" },
  ],
};

// Matched against the English timeline text so the labels survive yearly date updates.
const TIMELINE_LABELS: [RegExp, Bilingual][] = [
  [/Transfer Admission Guarantee|\bTAG\b/, { zh: "TAG 申请期", en: "TAG filing period" }],
  [/spring 20\d\d/i, { zh: "春季入学申请期（部分校区）", en: "Spring filing (select campuses)" }],
  [/application opens/i, { zh: "申请系统开放", en: "Application opens" }],
  [/filing \(submission\) period/i, { zh: "提交正式申请", en: "Submit your application" }],
  [/\(TAU\) opens/i, { zh: "TAU 成绩更新开放", en: "Academic Update opens" }],
  [/Academic Update priority deadline/i, { zh: "TAU 优先截止", en: "Academic Update priority deadline" }],
  [/FAFSA.*\bopen/i, { zh: "FAFSA / CADAA 开放", en: "FAFSA / CADAA open" }],
  [/deadline to submit the FAFSA/i, { zh: "FAFSA / CADAA 截止", en: "FAFSA / CADAA deadline" }],
  [/decision/i, { zh: "公布录取结果", en: "Admission decisions" }],
  [/Statement of Intent to Register/i, { zh: "SIR 确认入学截止", en: "SIR deadline" }],
  [/transcripts/i, { zh: "最终成绩单截止", en: "Final transcripts due" }],
  [/\bAP\b|\bIB\b/, { zh: "AP / IB 成绩与证明截止", en: "AP / IB results due" }],
];

export function timelineLabel(text: string): Bilingual {
  return TIMELINE_LABELS.find(([pattern]) => pattern.test(text))?.[1] ?? { zh: text, en: text };
}

export function pick(lang: Lang, value: Bilingual): string {
  return value[lang];
}
