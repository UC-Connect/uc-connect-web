"use client";

import Link from "next/link";
import type { Audience, Category } from "@/lib/admissions/content";
import { AUDIENCE_LABELS, CATEGORY_LABELS, type ApplicantType } from "@/lib/admissions/presentation";
import { askHref } from "./AdmissionsHub";
import { useLang } from "./LangProvider";
import { Markdown } from "./Markdown";

type TopicDetailProps = {
  doc: {
    slug: string;
    title: string;
    titleZh: string;
    summary: string;
    summaryZh: string;
    category: Category;
    audience: Audience;
    sourceUrl: string;
    supportingSourceUrl: string;
    applicableCycle: string;
    lastReviewed: string;
  };
  body: string;
  related: { slug: string; title: string; titleZh: string }[];
};

const TOOL_LINKS: Record<string, { hash: string; zh: string; en: string }> = {
  "freshman-gpa-calculation": { hash: "gpa", zh: "用 UC GPA 计算器算一算", en: "Try the UC GPA calculator" },
  "statewide-and-elc-guarantee": { hash: "gpa", zh: "用计算器估算是否在前 9%", en: "Estimate your statewide top-9% status" },
  "nonresident-and-international-applicants": { hash: "gpa", zh: "计算外州学生的 UC GPA", en: "Calculate a nonresident UC GPA" },
  "a-g-subject-requirements": { hash: "ag", zh: "用 A-G 检查工具对照", en: "Check your courses with the A-G checker" },
  "application-fees-and-waivers": { hash: "fees", zh: "算一下申请费", en: "Calculate your application fees" },
};

export function TopicDetail({ doc, body, related }: TopicDetailProps) {
  const { lang, L, pick } = useLang();
  const askAudience: ApplicantType = doc.audience === "transfer" ? "transfer" : "freshman";
  const prompts = [
    L(`用中文解释一下「${doc.titleZh}」的重点`, `Summarize the key points of "${doc.title}"`),
    L(`「${doc.titleZh}」有哪些容易误解的地方？`, `What do students most often misunderstand about ${doc.title}?`),
  ];

  return (
    <div className="adm-wrap adm-detail">
      <nav className="adm-crumbs" aria-label={L("页面路径", "Breadcrumb")}>
        <Link href="/admissions">{L("申请信息", "Admissions")}</Link>
        <span>/</span>
        <span>{pick(CATEGORY_LABELS[doc.category])}</span>
      </nav>

      <div className="adm-detail-grid">
        <article className="adm-article">
          <header>
            <div className="adm-tags-row">
              <span className={`adm-tag ${doc.audience}`}>{pick(AUDIENCE_LABELS[doc.audience])}</span>
              <span className="adm-tag">{pick(CATEGORY_LABELS[doc.category])}</span>
            </div>
            <h1>{L(doc.titleZh, doc.title)}</h1>
            {lang === "zh" && <p className="adm-official-title">{doc.title}</p>}
            <p className="adm-lead">{L(doc.summaryZh, doc.summary)}</p>
            <dl className="adm-facts">
              <div>
                <dt>{L("适用周期", "Applies to")}</dt>
                <dd>{doc.applicableCycle}</dd>
              </div>
              <div>
                <dt>{L("核对日期", "Last reviewed")}</dt>
                <dd>{doc.lastReviewed}</dd>
              </div>
            </dl>
          </header>

          {lang === "zh" && (
            <p className="adm-lang-note">
              正文为英文官方资料的整理，保留原始术语以便对照官网。需要中文解释时，可以直接问 AI。
            </p>
          )}

          <Markdown>{body}</Markdown>

          <footer className="adm-source">
            <span>{L("官方来源", "Official source")}</span>
            <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer">{doc.sourceUrl.replace(/^https?:\/\//, "")}</a>
            {doc.supportingSourceUrl && (
              <a href={doc.supportingSourceUrl} target="_blank" rel="noopener noreferrer">
                {doc.supportingSourceUrl.replace(/^https?:\/\//, "")}
              </a>
            )}
          </footer>
        </article>

        <aside className="adm-aside">
          {TOOL_LINKS[doc.slug] && (
            <Link href={`/admissions/tools#${TOOL_LINKS[doc.slug].hash}`} className="adm-tool-link">
              <strong>{L(TOOL_LINKS[doc.slug].zh, TOOL_LINKS[doc.slug].en)} →</strong>
              <span>{L("按官方规则计算，成绩不会上传", "Computed from official rules; nothing is uploaded")}</span>
            </Link>
          )}
          <div className="adm-aside-card adm-aside-ask">
            <h2>{L("还有疑问？", "Still have questions?")}</h2>
            <p>{L("AI 助手会基于这些官方资料回答，并标出出处。", "The assistant answers from these official sources and cites each claim.")}</p>
            {prompts.map((prompt) => (
              <Link key={prompt} href={askHref(prompt, askAudience)} className="adm-aside-prompt">
                {prompt}
                <span aria-hidden="true">→</span>
              </Link>
            ))}
            <Link href={`/admissions/ask?for=${askAudience}`} className="primary-button small">
              {L("打开 AI 助手", "Open the assistant")}
            </Link>
          </div>

          {related.length > 0 && (
            <div className="adm-aside-card">
              <h2>{L("相关专题", "Related topics")}</h2>
              <ul className="adm-related">
                {related.map((item) => (
                  <li key={item.slug}>
                    <Link href={`/admissions/${item.slug}`}>{L(item.titleZh, item.title)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
