import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type Audience = "freshman" | "transfer" | "all";
export type Category = "requirements" | "review" | "dates" | "programs" | "costs" | "campuses";

export type AdmissionsDoc = {
  slug: string;
  title: string;
  titleZh: string;
  summary: string;
  summaryZh: string;
  category: Category;
  order: number;
  audience: Audience;
  sourceUrl: string;
  supportingSourceUrl: string;
  sourceType: string;
  applicableCycle: string;
  lastReviewed: string;
  body: string;
};

export type DocSection = {
  heading: string;
  content: string;
};

export type Chunk = {
  id: string;
  slug: string;
  title: string;
  titleZh: string;
  heading: string;
  content: string;
  audience: Audience;
  sourceUrl: string;
  sourceType: string;
  applicableCycle: string;
  lastReviewed: string;
};

export type TimelineItem = {
  label: string;
  text: string;
  startDate: string | null;
  endDate: string | null;
};

const CONTENT_DIR = path.join(process.cwd(), "content", "admissions");
const DOCS_DIR = path.join(CONTENT_DIR, "docs");
const GUARDRAILS_HEADING = "Answer guardrails";
const DATES_SLUGS: Record<Exclude<Audience, "all">, string> = {
  freshman: "freshman-dates-and-deadlines",
  transfer: "uc-dates-and-deadlines",
};
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

let docsCache: AdmissionsDoc[] | null = null;
let chunksCache: Chunk[] | null = null;
let versionCache: string | null = null;

export function parseFrontmatter(raw: string): { metadata: Record<string, string>; body: string } {
  if (!raw.startsWith("---")) {
    return { metadata: {}, body: raw.trim() };
  }

  const end = raw.indexOf("\n---", 3);

  if (end === -1) {
    return { metadata: {}, body: raw.trim() };
  }

  const metadata: Record<string, string> = {};

  for (const line of raw.slice(3, end).trim().split(/\r?\n/)) {
    const separator = line.indexOf(":");

    if (separator > 0) {
      metadata[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
  }

  return { metadata, body: raw.slice(end + 4).trim() };
}

export function splitSections(body: string): DocSection[] {
  const sections: DocSection[] = [];
  let heading = "Overview";
  let lines: string[] = [];

  function flush() {
    const content = lines.join("\n").trim();

    if (content) {
      sections.push({ heading, content });
    }
  }

  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^#{1,3}\s+(.+)$/);

    if (match) {
      flush();
      heading = match[1].trim();
      lines = [];
      continue;
    }

    lines.push(line);
  }

  flush();
  return sections;
}

export function loadDocs(): AdmissionsDoc[] {
  if (docsCache) {
    return docsCache;
  }

  docsCache = fs
    .readdirSync(DOCS_DIR)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => {
      const { metadata, body } = parseFrontmatter(fs.readFileSync(path.join(DOCS_DIR, file), "utf8"));
      const slug = path.basename(file, ".md");

      return {
        slug,
        title: metadata.title || slug,
        titleZh: metadata.title_zh || metadata.title || slug,
        summary: metadata.summary || "",
        summaryZh: metadata.summary_zh || metadata.summary || "",
        category: (metadata.category || "requirements") as Category,
        order: Number(metadata.order) || 99,
        audience: (metadata.audience || "all") as Audience,
        sourceUrl: metadata.source_url || "",
        supportingSourceUrl: metadata.supporting_source_url || "",
        sourceType: metadata.source_type || "",
        applicableCycle: metadata.applicable_cycle || "",
        lastReviewed: metadata.last_reviewed || "",
        body,
      };
    });

  return docsCache;
}

export function getDoc(slug: string): AdmissionsDoc | undefined {
  return loadDocs().find((doc) => doc.slug === slug);
}

export function loadChunks(): Chunk[] {
  if (chunksCache) {
    return chunksCache;
  }

  chunksCache = loadDocs().flatMap((doc) =>
    splitSections(doc.body).map((section, index) => ({
      id: `${doc.slug}#${index + 1}`,
      slug: doc.slug,
      title: doc.title,
      titleZh: doc.titleZh,
      heading: section.heading,
      content: section.content,
      audience: doc.audience,
      sourceUrl: doc.sourceUrl,
      sourceType: doc.sourceType,
      applicableCycle: doc.applicableCycle,
      lastReviewed: doc.lastReviewed,
    }))
  );

  return chunksCache;
}

// Public pages hide the leading title (rendered separately) and the guardrails written for the model.
export function publicBody(doc: AdmissionsDoc): string {
  const withoutTitle = doc.body.replace(/^#\s+.+\n+/, "");
  const guardrailsIndex = withoutTitle.search(new RegExp(`^##\\s+${GUARDRAILS_HEADING}`, "m"));

  return (guardrailsIndex === -1 ? withoutTitle : withoutTitle.slice(0, guardrailsIndex)).trim();
}

// Changes whenever a document or the system prompt changes, so cached answers expire with the content.
export function getKnowledgeBaseVersion(): string {
  if (versionCache) {
    return versionCache;
  }

  const hash = createHash("sha256");

  for (const file of fs.readdirSync(DOCS_DIR).filter((name) => name.endsWith(".md")).sort()) {
    hash.update(file).update(fs.readFileSync(path.join(DOCS_DIR, file)));
  }

  hash.update(loadSystemPrompt());
  versionCache = hash.digest("hex").slice(0, 12);
  return versionCache;
}

export function loadSystemPrompt(): string {
  return fs.readFileSync(path.join(CONTENT_DIR, "system-prompt.md"), "utf8");
}

// Timeline bullets are written as "- <date label>: <description>" in the dates documents.
export function getTimeline(audience: Exclude<Audience, "all">): TimelineItem[] {
  const doc = getDoc(DATES_SLUGS[audience]);

  if (!doc) {
    return [];
  }

  return doc.body
    .split(/\r?\n/)
    .map((line) => line.match(/^-\s+([A-Z][a-z]+ \d{1,2}(?:\s*-\s*[A-Za-z]*\s*\d{1,2})?, \d{4}):\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      label: match[1],
      text: match[2].replace(/\.$/, ""),
      ...parseDateRange(match[1]),
    }));
}

function toIsoDate(year: string, monthName: string, day: string): string | null {
  const month = MONTHS.indexOf(monthName.toLowerCase());
  return month === -1 ? null : `${year}-${String(month + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// Handles "August 1, 2026", "March 1 - 31, 2027", and "October 1 - November 30, 2026".
function parseDateRange(label: string): { startDate: string | null; endDate: string | null } {
  const match = label.match(/^([A-Za-z]+) (\d{1,2})(?:\s*-\s*(?:([A-Za-z]+)\s+)?(\d{1,2}))?, (\d{4})$/);

  if (!match) {
    return { startDate: null, endDate: null };
  }

  const [, startMonth, startDay, endMonth, endDay, year] = match;
  const startDate = toIsoDate(year, startMonth, startDay);
  const endDate = endDay ? toIsoDate(year, endMonth ?? startMonth, endDay) : startDate;

  return { startDate, endDate };
}
