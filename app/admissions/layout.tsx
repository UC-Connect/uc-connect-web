import type { Metadata } from "next";
import { AdmissionsFooter, AdmissionsHeader } from "./_components/AdmissionsHeader";
import { LangProvider } from "./_components/LangProvider";
import "./admissions.css";

export const metadata: Metadata = {
  title: "UC 申请信息 — UC Connect",
  description: "UC 高中生与转学申请要求、时间线和 AI 问答，整理自 UC 官方招生网站。",
};

export default function AdmissionsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <LangProvider>
      <div className="adm-shell">
        <AdmissionsHeader />
        <main className="adm-main">{children}</main>
        <AdmissionsFooter />
      </div>
    </LangProvider>
  );
}
