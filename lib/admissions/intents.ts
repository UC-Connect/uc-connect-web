// Answers narrow, high-confidence questions (dates, TAG campuses, application fees) directly from
// the knowledge base and rules, without a model call. Anything ambiguous returns null and falls
// through to the model.
import { getDoc, getTimeline, type Audience, type TimelineItem } from "./content.ts";
import { AUDIENCE_LABELS, timelineLabel, type ApplicantType, type Lang } from "./presentation.ts";
import { detectAudience, tokenize, type RetrievedSource } from "./retriever.ts";
import { calculateApplicationFee, FEE_RULES, TAG_RULES } from "./rules.ts";

export type RuleAnswer = { intent: "dates" | "tag-campus" | "fees"; answer: string; sources: RetrievedSource[] };

type Event = { key: string; question: RegExp; timeline: RegExp };

const MAX_LENGTH = { zh: 40, en: 120 };
const DATE_CUE = /截止|什么时候|何时|哪天|几号|日期|deadline|\bdue\b|\bwhen\b|what date/i;
// Questions that ask for explanations or requirements need the model.
const COMPLEX_CUE = /怎么|如何|为什么|需要准备|要求|条件|材料|区别|\bhow\b|\bwhy\b|what do i need|requirement|difference|explain/i;

const EVENTS: Event[] = [
  { key: "tag", question: /\bTAG\b/i, timeline: /Transfer Admission Guarantee|\bTAG\b/ },
  { key: "sir", question: /\bSIR\b|确认入学|intent to register/i, timeline: /Statement of Intent to Register/ },
  { key: "decisions", question: /录取结果|放榜|出结果|decision/i, timeline: /decision/i },
  { key: "transcripts", question: /成绩单|transcript/i, timeline: /transcripts/i },
  { key: "tau", question: /\bTAU\b|academic update|成绩更新/i, timeline: /Academic Update/ },
  { key: "fafsa-open", question: /(FAFSA|CADAA|dream act|助学金).*(开放|开始|\bopens?\b)|(开放|\bopens?\b).*(FAFSA|CADAA)/i, timeline: /FAFSA.*\bopen/i },
  { key: "fafsa", question: /FAFSA|CADAA|dream act|GPA verification|助学金/i, timeline: /deadline to submit the FAFSA/i },
  { key: "ap-ib", question: /\bAP\b|\bIB\b/, timeline: /\bAP\b|\bIB\b/ },
  { key: "opens", question: /开放|开始申请|什么时候开始|\bopens?\b/i, timeline: /application opens/i },
  { key: "filing", question: /申请|提交|apply|application|submit/i, timeline: /filing \(submission\) period/i },
];

const CAMPUSES: { name: string; display: string; pattern: RegExp }[] = [
  { name: "Davis", display: "UC Davis", pattern: /davis|戴维斯|\bUCD\b/i },
  { name: "Irvine", display: "UC Irvine", pattern: /irvine|尔湾|\bUCI\b/i },
  { name: "Merced", display: "UC Merced", pattern: /merced|默塞德/i },
  { name: "Riverside", display: "UC Riverside", pattern: /riverside|河滨|\bUCR\b/i },
  { name: "Santa Barbara", display: "UC Santa Barbara", pattern: /santa barbara|圣塔芭芭拉|圣芭芭拉|\bUCSB\b/i },
  { name: "Santa Cruz", display: "UC Santa Cruz", pattern: /santa cruz|圣克鲁兹|圣塔克鲁兹|\bUCSC\b/i },
  { name: "Berkeley", display: "UC Berkeley", pattern: /berkeley|伯克利|伯克莱|\bUCB\b/i },
  { name: "UCLA", display: "UCLA", pattern: /\bUCLA\b|洛杉矶/i },
  { name: "San Diego", display: "UC San Diego", pattern: /san diego|圣地亚哥|\bUCSD\b/i },
];

const CHINESE_NUMBERS: Record<string, number> = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function languageOf(question: string): Lang {
  return /[㐀-鿿]/.test(question) ? "zh" : "en";
}

function isShort(question: string, lang: Lang) {
  return question.length <= MAX_LENGTH[lang];
}

function source(slug: string, number: number): RetrievedSource {
  const doc = getDoc(slug);

  if (!doc) {
    throw new Error(`Unknown admissions document: ${slug}`);
  }

  return {
    number,
    slug,
    title: doc.title,
    titleZh: doc.titleZh,
    url: doc.sourceUrl,
    lastReviewed: doc.lastReviewed,
    audience: doc.audience,
  };
}

function formatDate(item: TimelineItem, lang: Lang): string {
  if (lang === "en" || !item.startDate) {
    return item.label;
  }

  const [year, month, day] = item.startDate.split("-").map(Number);
  const start = `${year} 年 ${month} 月 ${day} 日`;

  if (!item.endDate || item.endDate === item.startDate) {
    return start;
  }

  const [endYear, endMonth, endDay] = item.endDate.split("-").map(Number);
  return endYear === year ? `${start}至 ${endMonth} 月 ${endDay} 日` : `${start}至 ${endYear} 年 ${endMonth} 月 ${endDay} 日`;
}

function entryTerm(slug: string, lang: Lang): string {
  const year = getDoc(slug)?.applicableCycle.match(/fall (\d{4})/i)?.[1];
  if (!year) return "";
  return lang === "zh" ? `${year} 秋季入学` : `fall ${year} entry`;
}

const DATES_DOC: Record<ApplicantType, string> = {
  freshman: "freshman-dates-and-deadlines",
  transfer: "uc-dates-and-deadlines",
};

function answerDates(question: string, lang: Lang, audience: ApplicantType | null): RuleAnswer | null {
  if (!DATE_CUE.test(question) || COMPLEX_CUE.test(question) || !isShort(question, lang)) {
    return null;
  }

  const event = EVENTS.find((candidate) => candidate.question.test(question));

  if (!event) {
    return null;
  }

  const audiences: ApplicantType[] = audience ? [audience] : ["freshman", "transfer"];
  const sections = audiences
    .map((type) => ({ type, items: getTimeline(type).filter((item) => event.timeline.test(item.text)) }))
    .filter((section) => section.items.length > 0);

  if (sections.length === 0) {
    return null;
  }

  const sources = sections.map((section, index) => source(DATES_DOC[section.type], index + 1));
  const blocks = sections.map((section, index) => {
    const heading = `**${AUDIENCE_LABELS[section.type][lang]} · ${entryTerm(DATES_DOC[section.type], lang)}**`;
    const lines = section.items.map(
      (item) => `- ${timelineLabel(item.text)[lang]}${lang === "zh" ? "：" : ": "}**${formatDate(item, lang)}** [${index + 1}]`
    );
    return [heading, ...lines].join("\n");
  });
  const footer =
    lang === "zh"
      ? "日期每个申请季都会变化，请以 UC 官网为准。"
      : "Dates change every cycle; the official UC page controls.";

  return { intent: "dates", answer: `${blocks.join("\n\n")}\n\n${footer}`, sources };
}

function answerTagCampus(question: string, lang: Lang): RuleAnswer | null {
  const participationCue = /参加|参与|有没有|有吗|能不能|可以|可不可以|支持|participat|offer|accept|\bhave\b|\bdoes\b|\bcan\b|\bis\b/i;

  if (!/\bTAG\b/i.test(question) || !participationCue.test(question) || COMPLEX_CUE.test(question) || !isShort(question, lang)) {
    return null;
  }

  if (/GPA|专业|major|截止|deadline|日期/i.test(question)) {
    return null;
  }

  const mentioned = CAMPUSES.filter((campus) => campus.pattern.test(question));

  if (mentioned.length === 0) {
    return null;
  }

  const participating = new Set<string>(TAG_RULES.participating);
  const lines = mentioned.map((campus) => {
    const yes = participating.has(campus.name);
    return lang === "zh"
      ? `- **${campus.display}**：${yes ? "参加 TAG" : "不参加 TAG"} [1]`
      : `- **${campus.display}**: ${yes ? "participates in TAG" : "does not participate in TAG"} [1]`;
  });
  const note =
    lang === "zh"
      ? "参加 TAG 的校区也不是所有专业都开放；每人只能向一个校区提交 TAG，而且仍需提交正式的 UC 申请 [1]。具体 GPA 和课程要求请查看当年的 TAG matrix。"
      : "Not every major at a participating campus is eligible; you can submit TAG to only one campus, and you still need the regular UC application [1]. Check the current TAG matrix for GPA and course requirements.";

  return { intent: "tag-campus", answer: `${lines.join("\n")}\n\n${note}`, sources: [source(TAG_RULES.doc, 1)] };
}

function campusCount(question: string): number | null {
  if (/全部|所有|all (nine|9|the|uc)\b|all campuses|every (uc )?campus|九个校区都/i.test(question)) {
    return FEE_RULES.campusCount;
  }

  const digits = question.match(/(\d+)\s*(个)?\s*(校区|学校|campus)/i);
  if (digits) return Number(digits[1]);

  const chinese = question.match(/([一两二三四五六七八九])\s*个?\s*(校区|学校)/);
  if (chinese) return CHINESE_NUMBERS[chinese[1]];

  const english = question.match(/\b(one|two|three|four|five|six|seven|eight|nine)\s+(UC\s+)?campus/i);
  const words = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  return english ? words.indexOf(english[1].toLowerCase()) + 1 : null;
}

function answerFees(question: string, lang: Lang): RuleAnswer | null {
  if (!/申请费|多少钱|费用|花多少|application fee|\bcost\b|how much|\bfees?\b/i.test(question) || !isShort(question, lang)) {
    return null;
  }

  const count = campusCount(question);

  if (!count || count < 1 || count > FEE_RULES.campusCount) {
    return null;
  }

  const international = /国际生|留学生|international|non-?immigrant|\bF-?1\b/i.test(question);
  const full = calculateApplicationFee(count, { international, waiverEligible: false });
  const waived = calculateApplicationFee(count, { international, waiverEligible: true });
  let answer: string;

  if (lang === "zh") {
    answer = international
      ? `国际生申请 ${count} 个校区：${count} × $${full.perCampus} = **$${full.total}** [1]。免申请费只适用于美国公民、永久居民和符合 AB 540 条件的申请人，国际生不适用 [1]。`
      : `申请 ${count} 个校区：${count} × $${full.perCampus} = **$${full.total}** [1]。\n\n如果申请系统显示你符合免申请费条件，最多可免 ${FEE_RULES.waiverCampuses} 个校区的费用，需支付 **$${waived.total}** [1]。申请费提交后不退 [1]。`;
  } else {
    answer = international
      ? `For an international applicant, ${count} campuses cost ${count} × $${full.perCampus} = **$${full.total}** [1]. Fee waivers are only for U.S. citizens, permanent residents, and AB 540-eligible applicants [1].`
      : `Applying to ${count} campuses costs ${count} × $${full.perCampus} = **$${full.total}** [1].\n\nIf the application shows you qualify for a fee waiver, up to ${FEE_RULES.waiverCampuses} campuses are free, so you would pay **$${waived.total}** [1]. Fees are non-refundable [1].`;
  }

  return { intent: "fees", answer, sources: [source(FEE_RULES.doc, 1)] };
}

export function answerWithRules(question: string, audience: Exclude<Audience, "all"> | null = null): RuleAnswer | null {
  const trimmed = question.trim();
  const lang = languageOf(trimmed);
  const detected = audience ?? detectAudience(tokenize(trimmed));

  return answerTagCampus(trimmed, lang) ?? answerFees(trimmed, lang) ?? answerDates(trimmed, lang, detected);
}
