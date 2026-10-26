"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { RetrievedSource } from "@/lib/admissions/retriever";
import { AUDIENCE_LABELS, SUGGESTED_QUESTIONS, type ApplicantType } from "@/lib/admissions/presentation";
import { supabase } from "@/lib/supabase";
import { readAudienceParam } from "./AudienceSwitch";
import { useLang } from "./LangProvider";
import { Markdown } from "./Markdown";

type Status = "searching" | "streaming" | "done" | "stopped" | "error";
type AuthState = "checking" | "signed-in" | "signed-out";

// The assistant requires a login; the session lives in the browser, and its access token is sent
// with each question.
async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: RetrievedSource[];
  status?: Status;
  error?: string;
  startedAt?: number;
  cached?: boolean;
  rule?: string;
  // Server signature for a finished answer; required for the answer to count as follow-up context.
  signature?: string;
};

type StreamEvent =
  | { type: "meta"; sources: RetrievedSource[]; cached?: boolean; rule?: string }
  | { type: "delta"; text: string }
  | { type: "done"; signature?: string }
  | { type: "error"; message: string };

const STORAGE_KEY = "uc-connect-admissions-chat";
const SLOW_NOTICE_MS = 8000;
// Mirrors the server limits in lib/admissions/guards.ts.
const MAX_QUESTION_LENGTH = 500;
const HISTORY_TURNS = 4;

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function citedNumbers(text: string): number[] {
  const numbers = new Set<number>();

  for (const match of text.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
    match[1].split(",").forEach((value) => numbers.add(Number(value.trim())));
  }

  return [...numbers];
}

export function AskChat() {
  const { L, pick } = useLang();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [audience, setAudience] = useState<ApplicantType | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const startedRef = useRef(false);
  const pendingQuestionRef = useRef<{ question: string; audience: ApplicantType | null } | null>(null);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [returnPath, setReturnPath] = useState("/admissions/ask");

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let saved: Message[] = [];

    try {
      saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    } catch {
      saved = [];
    }

    // Unfinished answers from an interrupted session are shown as stopped.
    const restored = saved.map((message) =>
      message.status === "searching" || message.status === "streaming" ? { ...message, status: "stopped" as const } : message
    );
    const params = new URLSearchParams(window.location.search);
    const initialAudience = readAudienceParam();
    const question = params.get("q")?.trim();

    setMessages(restored);
    setReturnPath(`${window.location.pathname}${window.location.search}`);
    if (initialAudience) setAudience(initialAudience);
    if (question) pendingQuestionRef.current = { question: question.slice(0, MAX_QUESTION_LENGTH), audience: initialAudience };

    if (!supabase) {
      setAuthState("signed-out");
      return;
    }

    void accessToken().then((token) => setAuthState(token ? "signed-in" : "signed-out"));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setAuthState(session ? "signed-in" : "signed-out"));
    return () => listener.subscription.unsubscribe();
  }, []);

  // A question passed in the URL (from the hub) is asked once the user is signed in.
  useEffect(() => {
    const pending = pendingQuestionRef.current;

    if (authState !== "signed-in" || !pending) return;

    pendingQuestionRef.current = null;
    window.history.replaceState(null, "", `/admissions/ask${pending.audience ? `?for=${pending.audience}` : ""}`);
    void send(pending.question, messages, pending.audience);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // The conversation simply won't survive a reload.
    }

    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function updateMessage(id: string, update: (message: Message) => Message) {
    setMessages((current) => current.map((message) => (message.id === id ? update(message) : message)));
  }

  async function send(question: string, base: Message[] = messages, audienceOverride = audience) {
    const history = base
      .filter((message) => message.status === undefined || message.status === "done")
      .slice(-HISTORY_TURNS)
      .map(({ role, content, signature }) => (role === "assistant" ? { role, content, signature } : { role, content }));
    const assistantId = newId();
    const controller = new AbortController();

    abortRef.current = controller;
    setBusy(true);
    setInput("");
    setMessages([
      ...base,
      { id: newId(), role: "user", content: question },
      { id: assistantId, role: "assistant", content: "", status: "searching", startedAt: Date.now() },
    ]);

    try {
      const token = await accessToken();

      if (!token) {
        setAuthState("signed-out");
        throw new Error(L("请先登录后再使用 AI 助手。", "Please log in to use the assistant."));
      }

      const response = await fetch("/api/admissions/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, history, audience: audienceOverride }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) setAuthState("signed-out");
        throw new Error(payload.error || L("暂时无法回答，请稍后再试。", "Unable to answer right now."));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as StreamEvent;

          if (event.type === "meta") {
            updateMessage(assistantId, (message) => ({ ...message, sources: event.sources, cached: event.cached, rule: event.rule, status: "streaming" }));
          } else if (event.type === "delta") {
            updateMessage(assistantId, (message) => ({ ...message, content: message.content + event.text, status: "streaming" }));
          } else if (event.type === "done") {
            updateMessage(assistantId, (message) => ({ ...message, status: "done", signature: event.signature }));
          } else if (event.type === "error") {
            updateMessage(assistantId, (message) => ({ ...message, status: "error", error: event.message }));
          }
        }
      }

      updateMessage(assistantId, (message) =>
        message.status === "streaming" || message.status === "searching" ? { ...message, status: "done" } : message
      );
    } catch (error) {
      if (controller.signal.aborted) {
        updateMessage(assistantId, (message) => ({ ...message, status: "stopped" }));
      } else {
        const text = error instanceof Error ? error.message : String(error);
        updateMessage(assistantId, (message) => ({ ...message, status: "error", error: text }));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      textareaRef.current?.focus();
    }
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const question = input.trim();
    if (question && !busy) void send(question);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Ignore Enter while an IME (e.g. Chinese pinyin input) is composing.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  function resetConversation() {
    abortRef.current?.abort();
    setMessages([]);
  }

  const suggestionGroups: ApplicantType[] = audience ? [audience] : ["freshman", "transfer"];

  return (
    <div className="adm-chat">
      <div className="adm-chat-head">
        <div>
          <h1>{L("UC 申请 AI 助手", "UC admissions assistant")}</h1>
          <p>{L("只根据 UC Connect 整理的官方资料回答，并标出每条信息的出处。", "Answers only from UC Connect's official-source library, with a citation for each claim.")}</p>
        </div>
        <div className="adm-chat-controls">
          <div className="adm-pills" role="radiogroup" aria-label={L("我的申请类型", "I am applying as")}>
            <span>{L("我是", "I am")}</span>
            {([null, "freshman", "transfer"] as const).map((value) => (
              <button
                key={value ?? "auto"}
                type="button"
                role="radio"
                aria-checked={audience === value}
                className={audience === value ? "active" : ""}
                onClick={() => setAudience(value)}
              >
                {value ? pick(AUDIENCE_LABELS[value]) : L("不确定", "Not sure")}
              </button>
            ))}
          </div>
          {messages.length > 0 && (
            <button type="button" className="adm-link-button" onClick={resetConversation}>
              {L("新对话", "New chat")}
            </button>
          )}
        </div>
      </div>

      {authState === "signed-out" && (
        <div className="adm-login-gate">
          <span className="brand-mark"><i /><i /><i /></span>
          <h2>{L("登录后使用 AI 助手", "Log in to use the assistant")}</h2>
          <p>
            {L(
              "AI 助手只对登录用户开放，注册免费，任意邮箱都可以。申请信息专题和计算工具无需登录。",
              "The assistant is available to signed-in users. Signing up is free with any email. Topic pages and calculators work without an account."
            )}
          </p>
          <div className="adm-login-actions">
            <a className="primary-button" href={`/?login=1&next=${encodeURIComponent(returnPath)}`}>{L("登录 / 注册", "Log in / Sign up")}</a>
            <Link href="/admissions/tools" className="adm-link-button">{L("先用计算工具", "Use the calculators")}</Link>
          </div>
        </div>
      )}

      {authState === "signed-in" && (
        <>
      <div className="adm-chat-log" aria-live="polite">
          {messages.length === 0 && (
            <div className="adm-empty">
              <span className="brand-mark"><i /><i /><i /></span>
              <h2>{L("想了解 UC 申请的什么？", "What would you like to know about applying to UC?")}</h2>
              <p>{L("可以用中文或英文提问。涉及个人录取机会、课程对等的具体判断，我会提示你去查官方渠道。", "Ask in English or Chinese. For personal admission chances or course-by-course articulation, I'll point you to official tools.")}</p>
              <div className="adm-suggest-grid">
                {suggestionGroups.map((group) => (
                  <div key={group}>
                    <h3>{pick(AUDIENCE_LABELS[group])}</h3>
                    {SUGGESTED_QUESTIONS[group].map((item) => (
                      <button key={item.en} type="button" onClick={() => void send(pick(item), messages, audience ?? group)}>
                        {pick(item)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
  
          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="adm-msg user">
                <p>{message.content}</p>
              </div>
            ) : (
              <AssistantMessage key={message.id} message={message} />
            )
          )}
          <div ref={logEndRef} />
        </div>
  
        <form className="adm-composer" onSubmit={submit}>
          <div className="adm-composer-box">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={L("输入你的问题…", "Ask a question…")}
              maxLength={MAX_QUESTION_LENGTH}
              rows={1}
              aria-label={L("你的问题", "Your question")}
            />
            {busy ? (
              <button type="button" className="adm-stop" onClick={() => abortRef.current?.abort()}>
                {L("停止", "Stop")}
              </button>
            ) : (
              <button type="submit" className="primary-button small" disabled={!input.trim()}>
                {L("发送", "Send")}
              </button>
            )}
          </div>
          <p className="adm-composer-note">
            {L("AI 可能出错，重要信息请点开来源核对。UC Connect 与加州大学无官方关联。", "AI can make mistakes; check the cited sources for anything important. UC Connect is not affiliated with the University of California.")}
            {input.length > MAX_QUESTION_LENGTH * 0.8 && <span> {input.length}/{MAX_QUESTION_LENGTH}</span>}
          </p>
        </form>
        </>
      )}
    </div>
  );
}

function useIsSlow(waiting: boolean, startedAt?: number) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!waiting || !startedAt) {
      setSlow(false);
      return;
    }

    const timer = window.setTimeout(() => setSlow(true), Math.max(0, startedAt + SLOW_NOTICE_MS - Date.now()));
    return () => window.clearTimeout(timer);
  }, [waiting, startedAt]);

  return slow;
}

function AssistantMessage({ message }: { message: Message }) {
  const { L } = useLang();
  const waiting = (message.status === "searching" || message.status === "streaming") && !message.content;
  const slow = useIsSlow(waiting, message.startedAt);
  const sources = message.sources ?? [];
  const cited = citedNumbers(message.content);
  const primary = cited.length ? sources.filter((source) => cited.includes(source.number)) : sources;
  const others = sources.filter((source) => !primary.includes(source));
  const anchorPrefix = `src-${message.id}`;

  return (
    <div className="adm-msg assistant">
      <span className="adm-avatar brand-mark" aria-hidden="true"><i /><i /><i /></span>
      <div className="adm-msg-body">
        {message.status === "searching" && <p className="adm-status">{L("正在查找相关资料…", "Searching the source library…")}</p>}
        {message.status === "streaming" && !message.content && (
          <p className="adm-status">
            {sources.length
              ? L(`找到 ${sources.length} 份资料，正在整理回答…`, `Found ${sources.length} sources, writing the answer…`)
              : L("没有找到直接相关的资料，正在组织回答…", "No closely matching sources; composing a reply…")}
          </p>
        )}

        {message.content && (
          <div className={message.status === "streaming" ? "adm-streaming" : ""}>
            <Markdown citations={{ anchorPrefix, available: sources.map((source) => source.number) }}>{message.content}</Markdown>
          </div>
        )}

        {slow && (
          <p className="adm-status-note">
            {L("免费版 AI 模型排队中，通常需要 10–20 秒，请稍等。", "The free AI model is queued; this usually takes 10–20 seconds.")}
          </p>
        )}

        {message.status === "stopped" && <p className="adm-status">{L("已停止生成。", "Stopped.")}</p>}
        {message.status === "error" && <p className="adm-error">{message.error}</p>}

        {message.rule && message.status === "done" && (
          <p className="adm-cached">{L("按官方规则计算 · 即时回答", "Computed from official rules · instant answer")}</p>
        )}
        {message.cached && !message.rule && message.status === "done" && (
          <p className="adm-cached">{L("常见问题 · 即时回答", "Common question · instant answer")}</p>
        )}

        {primary.length > 0 && message.status !== "searching" && (
          <div className="adm-sources">
            <h4>{message.status === "error" ? L("相关专题", "Related topics") : L("参考资料", "Sources")}</h4>
            {primary.map((source) => <SourceCard key={source.number} source={source} anchorPrefix={anchorPrefix} />)}
            {others.length > 0 && (
              <details>
                <summary>{L(`另外检索到 ${others.length} 份资料`, `${others.length} more retrieved`)}</summary>
                {others.map((source) => <SourceCard key={source.number} source={source} anchorPrefix={anchorPrefix} />)}
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SourceCard({ source, anchorPrefix }: { source: RetrievedSource; anchorPrefix: string }) {
  const { L, pick } = useLang();

  return (
    <div className="adm-source-card" id={`${anchorPrefix}-${source.number}`}>
      <span className="adm-source-num">{source.number}</span>
      <div>
        <Link href={`/admissions/${source.slug}`}>{L(source.titleZh, source.title)}</Link>
        <small>
          {pick(AUDIENCE_LABELS[source.audience])} · {L(`核对于 ${source.lastReviewed}`, `Reviewed ${source.lastReviewed}`)}
        </small>
      </div>
      {source.url && (
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="adm-source-ext">
          {L("官网", "Official")} ↗
        </a>
      )}
    </div>
  );
}
