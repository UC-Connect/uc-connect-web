import type { Metadata } from "next";
import { AdmissionsTools } from "../_components/AdmissionsTools";

export const metadata: Metadata = {
  title: "UC 申请计算工具 — UC Connect",
  description: "按 UC 官方规则计算 UC GPA、检查 A-G 课程、估算申请费，所有计算在浏览器中完成。",
};

export default function ToolsPage() {
  return <AdmissionsTools />;
}
