import { loadChunks, type Audience, type Chunk } from "./content.ts";

export type RetrievedChunk = Chunk & { score: number };

export type RetrievedSource = {
  number: number;
  slug: string;
  title: string;
  titleZh: string;
  url: string;
  lastReviewed: string;
  audience: Audience;
};

export type Retrieval = {
  chunks: RetrievedChunk[];
  sources: RetrievedSource[];
  queryTokens: string[];
  audience: Exclude<Audience, "all"> | null;
};

type RetrieveOptions = {
  topK?: number;
  minScore?: number;
  audience?: Exclude<Audience, "all"> | null;
  // "filter" drops the other applicant type entirely (the user chose it); "boost" only re-ranks (detected from the question).
  audienceMode?: "boost" | "filter";
  chunks?: Chunk[];
};

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = 4;
const AUDIENCE_BOOST = 4;

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "can", "do", "does", "for", "from", "how", "i", "in", "is", "it",
  "me", "my", "of", "on", "or", "the", "to", "uc", "what", "when", "which", "with", "you",
]);

const QUERY_EXPANSIONS: Record<string, string[]> = {
  act: ["standardized", "test"],
  articulate: ["articulation", "articulated", "equivalency", "assist"],
  articulates: ["articulation", "articulated", "equivalency", "assist"],
  articulated: ["articulation", "equivalency", "assist"],
  course: ["courses"],
  deadline: ["dates", "deadlines"],
  essay: ["personal", "insight"],
  essays: ["personal", "insight"],
  fee: ["fees"],
  freshman: ["first-year"],
  freshmen: ["freshman", "first-year"],
  "first-year": ["freshman"],
  guarantee: ["guaranteed", "eligibility", "eligible"],
  guaranteed: ["guarantee", "eligibility", "eligible"],
  piq: ["personal", "insight", "questions"],
  piqs: ["personal", "insight", "questions"],
  qualify: ["eligibility", "eligible", "requirements"],
  sat: ["standardized", "test"],
  transfer: ["transferable", "transferability"],
  transfers: ["transferable", "transferability"],
};

// Chinese questions are mapped to the English terms used in the knowledge base.
const CHINESE_TERMS: [string, string][] = [
  ["高中", "freshman first-year high school"],
  ["新生", "freshman first-year"],
  ["大一", "freshman first-year"],
  ["转学", "transfer"],
  ["社区大学", "community college transfer"],
  ["社区学院", "community college transfer"],
  ["截止", "deadline dates"],
  ["日期", "dates"],
  ["时间线", "dates deadlines timeline"],
  ["什么时候", "dates"],
  ["申请费", "application fee fees"],
  ["免申请费", "fee waiver"],
  ["减免", "waiver"],
  ["文书", "personal insight questions"],
  ["个人陈述", "personal insight questions"],
  ["绩点", "gpa"],
  ["平均分", "gpa"],
  ["外州", "nonresident out-of-state"],
  ["非加州", "nonresident out-of-state"],
  ["国际生", "international english proficiency"],
  ["留学生", "international english proficiency"],
  ["托福", "toefl english proficiency"],
  ["雅思", "ielts english proficiency"],
  ["多邻国", "duolingo english proficiency"],
  ["英语", "english proficiency"],
  ["校区", "campuses"],
  ["专业", "major"],
  ["录取", "admission"],
  ["保证", "guarantee"],
  ["保录", "guarantee"],
  ["学分", "units transferable"],
  ["课程", "courses"],
  ["审核", "review factors"],
  ["评估", "review factors"],
  ["标化", "sat act standardized test"],
  ["考试", "test exam"],
  ["学费", "tuition financial aid"],
  ["助学金", "financial aid grants"],
  ["奖学金", "scholarships financial aid"],
  ["前9%", "top 9 percent elc statewide guarantee"],
  ["前百分之九", "top 9 percent elc statewide guarantee"],
  ["要求", "requirements"],
  ["条件", "requirements eligibility"],
  ["荣誉课", "honors"],
  ["加分", "honors points"],
  ["对等", "articulation assist"],
  ["抵", "satisfy"],
  ["通识", "general education igetc cal-getc"],
  ["规划", "planner"],
  ["开放", "opens"],
  ["提交", "submit filing period"],
  ["放榜", "admission decisions"],
  ["录取结果", "admission decisions"],
  ["确认入学", "statement intent register sir"],
  ["成绩单", "transcripts"],
  ["加州居民", "california residents"],
  ["推荐信", "letters recommendation"],
  ["特殊录取", "admission exception"],
];

const AUDIENCE_SIGNALS: Record<Exclude<Audience, "all">, string[]> = {
  freshman: ["freshman", "first-year", "high", "a-g", "elc", "senior", "junior"],
  transfer: ["transfer", "community", "ccc", "tag", "assist", "igetc", "cal-getc", "tap", "units"],
};

function translateChineseTerms(text: string): string {
  const terms = CHINESE_TERMS.filter(([chinese]) => text.includes(chinese)).map(([, english]) => english);
  return terms.length ? `${text} ${terms.join(" ")}` : text;
}

export function tokenize(text: string): string[] {
  const tokens =
    translateChineseTerms(String(text))
      .toLowerCase()
      .match(/[a-z0-9]+(?:-[a-z0-9]+)?/g)
      ?.filter((token) => token.length > 1 && !STOPWORDS.has(token)) ?? [];
  const expanded = new Set<string>();

  for (const token of tokens) {
    expanded.add(token);

    if (token.endsWith("s") && token.length > 3) {
      expanded.add(token.slice(0, -1));
    }

    for (const related of QUERY_EXPANSIONS[token] ?? []) {
      expanded.add(related);
    }
  }

  return [...expanded];
}

export function detectAudience(queryTokens: string[]): Exclude<Audience, "all"> | null {
  const matches = (Object.keys(AUDIENCE_SIGNALS) as Exclude<Audience, "all">[]).filter((audience) =>
    AUDIENCE_SIGNALS[audience].some((signal) => queryTokens.includes(signal))
  );

  return matches.length === 1 ? matches[0] : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreChunk(queryTokens: string[], chunk: Chunk): number {
  const title = chunk.title.toLowerCase();
  const heading = chunk.heading.toLowerCase();
  const haystack = [chunk.title, chunk.heading, chunk.content, chunk.applicableCycle, chunk.sourceType]
    .join(" ")
    .toLowerCase();
  let score = 0;

  for (const token of queryTokens) {
    if (title.includes(token)) {
      score += 5;
    }

    if (heading.includes(token)) {
      score += 3;
    }

    score += haystack.match(new RegExp(`\\b${escapeRegExp(token)}\\b`, "g"))?.length ?? 0;
  }

  return score;
}

function applyAudienceBoost(score: number, audience: Retrieval["audience"], chunk: Chunk): number {
  if (!audience || score === 0 || chunk.audience === "all") {
    return score;
  }

  return chunk.audience === audience ? score + AUDIENCE_BOOST : score - AUDIENCE_BOOST;
}

// Sources are numbered per document so the model can cite [n] and the UI can show matching cards.
function numberSources(chunks: RetrievedChunk[]): RetrievedSource[] {
  const sources: RetrievedSource[] = [];

  for (const chunk of chunks) {
    if (!sources.some((source) => source.slug === chunk.slug)) {
      sources.push({
        number: sources.length + 1,
        slug: chunk.slug,
        title: chunk.title,
        titleZh: chunk.titleZh,
        url: chunk.sourceUrl,
        lastReviewed: chunk.lastReviewed,
        audience: chunk.audience,
      });
    }
  }

  return sources;
}

export function retrieve(question: string, options: RetrieveOptions = {}): Retrieval {
  const topK = options.topK ?? DEFAULT_TOP_K;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const queryTokens = tokenize(question);
  const audience = options.audience ?? detectAudience(queryTokens);

  if (queryTokens.length === 0) {
    return { chunks: [], sources: [], queryTokens, audience };
  }

  const filterAudience = options.audienceMode === "filter" && audience;
  const chunks = (options.chunks ?? loadChunks())
    .filter((chunk) => !filterAudience || chunk.audience === audience || chunk.audience === "all")
    .map((chunk) => ({ ...chunk, score: applyAudienceBoost(scoreChunk(queryTokens, chunk), audience, chunk) }))
    .filter((chunk) => chunk.score >= minScore)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, topK);

  return { chunks, sources: numberSources(chunks), queryTokens, audience };
}
