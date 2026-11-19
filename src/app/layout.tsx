import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import {
  ThemeProvider,
  THEME_INIT_SCRIPT,
} from "@/components/theme/ThemeProvider";
import { PWARegister, InstallPrompt } from "@/components/pwa/PWARegister";

export const metadata: Metadata = {
  title: "读心术 · Mindscape",
  description:
    "读懂一个人：基于证据的人格研判、意图解读与对话模拟。理解 TA 的动机、防御与行为规律，而不只是贴标签。",
  manifest: "/manifest.webmanifest",
  applicationName: "读心术",
  appleWebApp: {
    capable: true,
    title: "读心术",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  // 安装 iOS 主屏幕图标时状态栏按主题底色处理
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#04060b" },
    { media: "(prefers-color-scheme: light)", color: "#f7f8fb" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full" suppressHydrationWarning>
      <head>
        {/* 在绘制前定好主题，避免首屏闪一下黑/白 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
            <InstallPrompt />
          </AuthProvider>
        </ThemeProvider>
        <PWARegister />
      </body>
    </html>
  );
}
