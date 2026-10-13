import type { Metadata } from "next";
import { AskChat } from "../_components/AskChat";

export const metadata: Metadata = {
  title: "UC 申请 AI 助手 — UC Connect",
  description: "基于 UC 官方招生资料回答高中生与转学申请问题，并标注来源。",
};

export default function AskPage() {
  return <AskChat />;
}
