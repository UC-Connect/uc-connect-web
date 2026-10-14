"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { TimelineItem } from "@/lib/admissions/content";
import {
  AUDIENCE_LABELS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  HIGHLIGHTS,
  SUGGESTED_QUESTIONS,
  timelineLabel,
  type ApplicantType,
  type DocCard,
} from "@/lib/admissions/presentation";
import { AudienceSwitch, useApplicantType } from "./AudienceSwitch";
import { useLang } from "./LangProvider";

type AdmissionsHubProps = {
  docs: DocCard[];
  timelines: Record<ApplicantType, TimelineItem[]>;
};

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function askHref(question: string, audience: ApplicantType) {
  return `/admissions/ask?for=${audience}&q=${encodeURIComponent(question)}`;
}

export function AdmissionsHub({ docs, timelines }: AdmissionsHubProps) {
  const { L, pick } = useLang();
  const router = useRouter();
  const [audience, setAudience] = useApplicantType();
  const [question, setQuestion] = useState("");
  const [today, setToday] = useState<string | null>(null);

  // Date-dependent states are computed after mount so server and client render the same markup.
  useEffect(() => setToday(todayIso()), []);

  const timeline = timelines[audience];
  const nextIndex = today ? timeline.findIndex((item) => item.startDate && item.startDate > today) : -1;
  const visibleDocs = docs.filter((doc) => doc.audience === audience || doc.audience === "all");
  const orderedDocs = [...visibleDocs].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.order - b.order
  );

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (trimmed) router.push(askHref(trimmed, audience));
  }

  return (
    <>
      <section className="adm-hero">
        <div className="adm-wrap adm-hero-grid">
          <div className="adm-hero-copy">
            <span className="adm-eyebrow">{L("UC 申请信息 · 2027 秋季入学", "UC admissions · Fall 2027 entry")}</span>
            <h1>
              {L("UC 申请要求，", "UC admission requirements,")}
              <br />
              <em>{L("一处查清。", "in one place.")}</em>
            </h1>
            <p>
              {L(
                "整理自 UC 官方招生网站，每条信息都标注来源和核对日期。看不懂的地方，直接问 AI。",
                "Summarized from official UC admissions pages, with a source and review date on every topic. Ask the AI when something is unclear."
              )}
            </p>
            <AudienceSwitch value={audience} onChange={setAudience} />
          </div>

          <form className="adm-ask-card" onSubmit={submitQuestion}>
            <label htmlFor="adm-hero-question">{L("问 AI 助手", "Ask the AI assistant")}</label>
            <div className="adm-ask-row">
              <input
                id="adm-hero-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={pick(SUGGESTED_QUESTIONS[audience][0])}
                maxLength={1000}
              />
              <button className="primary-button" type="submit" disabled={!question.trim()}>
                {L("提问", "Ask")}
              </button>
            </div>
            <div className="adm-chips">
              {SUGGESTED_QUESTIONS[audience].map((item) => (
                <Link key={item.en} href={askHref(pick(item), audience)}>
                  {pick(item)}
                </Link>
              ))}
            </div>
            <p className="adm-ask-foot">
              <span className="adm-dot" />
              {L("只根据官方资料回答，并标出每句话的出处", "Answers only from official sources, with a citation for each claim")}
            </p>
          </form>
        </div>
      </section>

      <section className="adm-wrap adm-section">
        <div className="adm-section-head">
          <div>
            <span className="section-kicker">TIMELINE</span>
            <h2>{L("关键日期", "Key dates")}</h2>
          </div>
          <span className="adm-muted">
            {L(`2027 秋季入学 · ${pick(AUDIENCE_LABELS[audience])}`, `Fall 2027 entry · ${pick(AUDIENCE_LABELS[audience])}`)}
          </span>
        </div>
        <ol className="adm-timeline">
          {timeline.map((item, index) => {
            const ongoing = Boolean(today && item.startDate && item.endDate && item.startDate <= today && today <= item.endDate);
            const passed = Boolean(today && item.endDate && item.endDate < today);
            const state = ongoing ? "now" : passed ? "past" : index === nextIndex ? "next" : "";

            return (
              <li key={`${item.label}-${index}`} className={state}>
                <time>{item.label}</time>
                <strong>{pick(timelineLabel(item.text))}</strong>
                <p>{item.text}</p>
                {state === "now" && <span className="adm-badge gold">{L("进行中", "Open now")}</span>}
                {state === "next" && <span className="adm-badge blue">{L("下一个节点", "Up next")}</span>}
                {state === "past" && <span className="adm-badge">{L("已过", "Passed")}</span>}
              </li>
            );
          })}
        </ol>
        <p className="adm-fineprint">
          {L("日期每个申请季都会变化，请以 UC 官网为准。", "Dates change every cycle; the official UC page controls.")}{" "}
          <Link href={`/admissions/${audience === "freshman" ? "freshman-dates-and-deadlines" : "uc-dates-and-deadlines"}`}>
            {L("查看完整时间线 →", "Full timeline →")}
          </Link>
        </p>
      </section>

      <section className="adm-wrap adm-section">
        <div className="adm-section-head">
          <div>
            <span className="section-kicker">AT A GLANCE</span>
            <h2>{L("核心要求速览", "Core requirements")}</h2>
          </div>
          <span className="adm-muted">{L("均为最低要求，不代表录取线", "Minimums only, not admission cutoffs")}</span>
        </div>
        <div className="adm-highlights">
          {HIGHLIGHTS[audience].map((item) => (
            <Link key={item.label.en} href={`/admissions/${item.slug}`} className="adm-highlight">
              <strong>{pick(item.value)}</strong>
              <span>{pick(item.label)}</span>
              <small>{pick(item.note)}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="adm-wrap adm-section">
        <div className="adm-section-head">
          <div>
            <span className="section-kicker">CALCULATORS</span>
            <h2>{L("计算工具", "Calculators")}</h2>
          </div>
          <span className="adm-muted">{L("按官方规则在浏览器里计算，不上传成绩", "Official rules, computed in your browser")}</span>
        </div>
        <div className="adm-tool-links">
          {audience === "freshman" && (
            <>
              <Link href="/admissions/tools#gpa" className="adm-tool-link">
                <strong>{L("UC GPA 计算器", "UC GPA calculator")}</strong>
                <span>{L("按 UC 规则算加权 GPA，并估算是否在加州前 9%。", "Weighted UC GPA plus a statewide top-9% estimate.")}</span>
              </Link>
              <Link href="/admissions/tools#ag" className="adm-tool-link">
                <strong>{L("A-G 课程检查", "A-G checker")}</strong>
                <span>{L("逐科对照要求，检查 15 门和 12 年级前 11 门。", "Check each subject, the 15-course total, and 11 before 12th grade.")}</span>
              </Link>
            </>
          )}
          <Link href="/admissions/tools#fees" className="adm-tool-link">
            <strong>{L("申请费计算", "Application fees")}</strong>
            <span>{L("选校区，算总费用和免申请费能省多少。", "Pick campuses to see the total and fee-waiver savings.")}</span>
          </Link>
        </div>
      </section>

      <section className="adm-wrap adm-section">
        <div className="adm-section-head">
          <div>
            <span className="section-kicker">TOPICS</span>
            <h2>{L("全部专题", "All topics")}</h2>
          </div>
          <span className="adm-muted">{L(`${visibleDocs.length} 个专题`, `${visibleDocs.length} topics`)}</span>
        </div>
        <div className="adm-topic-grid">
          {orderedDocs.map((doc) => (
            <Link key={doc.slug} href={`/admissions/${doc.slug}`} className="adm-topic">
              <div className="adm-tags-row">
                <span className="adm-tag">{pick(CATEGORY_LABELS[doc.category])}</span>
                {doc.audience === "all" && <span className="adm-tag all">{pick(AUDIENCE_LABELS.all)}</span>}
              </div>
              <h4>{L(doc.titleZh, doc.title)}</h4>
              <p>{L(doc.summaryZh, doc.summary)}</p>
              <small>{L(`核对于 ${doc.lastReviewed}`, `Reviewed ${doc.lastReviewed}`)}</small>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
