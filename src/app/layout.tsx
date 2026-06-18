import type { Metadata } from "next";
import "./globals.css";
import { SelfPromptModal } from "@/components/SelfPromptModal";

export const metadata: Metadata = {
  title: "角色人物多维分析系统",
  description: "利用AI深度理解他人性格特征与行为逻辑，减少人际交往中的心理内耗",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f8f9fc] text-[#1a1a2e]" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
        {children}
        <SelfPromptModal />
      </body>
    </html>
  );
}
