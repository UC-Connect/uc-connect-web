"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "./LangProvider";

export function AdmissionsHeader() {
  const pathname = usePathname();
  const { lang, setLang, L } = useLang();
  const onAsk = pathname.startsWith("/admissions/ask");
  const links = [
    { href: "/", label: L("任务广场", "Tasks"), active: false },
    { href: "/admissions", label: L("申请信息", "Admissions"), active: !onAsk },
    { href: "/admissions/ask", label: L("AI 助手", "Ask AI"), active: onAsk },
  ];

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/" aria-label={L("返回首页", "Back to home")}>
          <span className="brand-mark"><i /><i /><i /></span>
          <span>UC Connect</span>
        </Link>
        <nav className="adm-nav" aria-label={L("申请信息导航", "Admissions navigation")}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={link.active ? "active" : ""} aria-current={link.active ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <button className="lang-toggle" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
            {lang === "zh" ? "中文 / EN" : "EN / 中文"}
          </button>
        </div>
      </div>
    </header>
  );
}

export function AdmissionsFooter() {
  const { L } = useLang();

  return (
    <footer className="adm-footer">
      <div className="adm-wrap">
        <p>
          {L(
            "UC Connect 是学生项目，与加州大学（University of California）无官方关联。所有信息整理自 UC 官方网站，如有出入，以官方页面为准。",
            "UC Connect is a student project and is not affiliated with the University of California. Information is summarized from official UC pages; official pages always take precedence."
          )}
        </p>
      </div>
    </footer>
  );
}
