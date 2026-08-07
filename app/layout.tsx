import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UC Connect — 让需求找到回应",
  description: "面向 UC 系学生的校园需求与互助平台。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
