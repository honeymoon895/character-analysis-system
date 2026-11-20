"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuthStore } from "@/store/auth";
import { useTheme } from "@/components/theme/ThemeProvider";

/**
 * 应用骨架
 *
 * 导航结构（四项，与产品主线一致）：
 *   人物库 → 新建研判 → 对话 → 我的
 * 「设置」并入「我的」，不再单独占一个底部入口——
 * 底部栏位置是稀缺资源，应该留给高频动作。
 */

const NAV = [
  { href: "/", label: "人物库", icon: LibraryIcon, match: (p: string) => p === "/" },
  {
    href: "/explore",
    label: "新建",
    icon: SparkIcon,
    match: (p: string) => p.startsWith("/explore"),
  },
  {
    href: "/chat",
    label: "对话",
    icon: ChatIcon,
    match: (p: string) =>
      p.startsWith("/chat") ||
      p.startsWith("/character") ||
      p.startsWith("/simulate"),
  },
  {
    href: "/me",
    label: "我的",
    icon: MeIcon,
    // 模拟人生从「我的」进入，底部高亮也归到「我的」
    match: (p: string) => p.startsWith("/me") || p.startsWith("/life"),
  },
] as const;

const BARE_ROUTES = ["/login", "/register"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const { user } = useAuthStore();

  if (BARE_ROUTES.some((r) => pathname.startsWith(r))) {
    return <div id="app-root">{children}</div>;
  }

  const active = NAV.find((n) => n.match(pathname))?.href ?? "";
  // 对话页需要占满视口高度且自带顶栏，但**保留底部标签栏**——
  // 之前整条隐藏，从对话列表进入时导航会突然消失，看起来像页面坏了。
  const immersive = pathname.startsWith("/chat/") || pathname.startsWith("/simulate");

  return (
    <div id="app-root" className="min-h-dvh flex">
      {/* ── 桌面端侧边栏 ── */}
      <aside className="hidden md:flex md:w-[236px] lg:w-[258px] shrink-0 flex-col sticky top-0 h-dvh border-r border-[var(--hairline)]">
        <div className="px-6 pt-8 pb-7">
          <Link href="/" className="flex items-center gap-3 group">
            <Logo />
            <div className="leading-none">
              <div className="font-display text-[17px] tracking-tight text-bone-50">
                读心术
              </div>
              <div className="text-[9px] uppercase tracking-[0.26em] text-bone-500 mt-1.5">
                Mindscape
              </div>
            </div>
          </Link>
        </div>

        <nav className="px-3 flex flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[14px] press ${
                  isActive
                    ? "text-bone-50"
                    : "text-bone-400 hover:text-bone-100"
                }`}
              >
                {isActive && (
                  <>
                    <span
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        background:
                          "linear-gradient(100deg, rgba(94,240,224,0.14), rgba(139,92,246,0.08))",
                        border: "1px solid rgba(94,240,224,0.18)",
                      }}
                    />
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-[#5ef0e0] shadow-[0_0_12px_#5ef0e0]" />
                  </>
                )}
                <span className="relative">
                  <Icon active={isActive} />
                </span>
                <span className={`relative ${isActive ? "font-medium" : ""}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-4 space-y-2">
          <ThemeToggleRow />
          <SidebarUser user={user} />
        </div>
      </aside>

      {/* ── 主区域 ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {!immersive && <MobileTopBar />}
        <main className={`flex-1 ${immersive ? "" : "pb-tabbar"}`}>
          {children}
        </main>
      </div>

      <MobileTabBar active={active} />
    </div>
  );
}

/* ── 移动端顶栏 ── */
function MobileTopBar() {
  return (
    <header
      className="md:hidden sticky top-0 z-30"
      style={{
        background:
          "color-mix(in srgb, var(--bg-base) 78%, transparent)",
        backdropFilter: "blur(22px) saturate(1.5)",
        WebkitBackdropFilter: "blur(22px) saturate(1.5)",
        paddingTop: "var(--safe-top)",
      }}
    >
      <div className="h-14 flex items-center justify-center relative px-4">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={22} />
          <span className="font-display text-[15px] tracking-tight text-bone-50">
            读心术
          </span>
        </Link>
        {/* 常驻的主题切换：白天随手就能切，不必翻设置 */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <ThemeToggleButton />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />
      </div>
    </header>
  );
}

/** 图标式主题切换：点击在明/暗之间即时切换 */
function ThemeToggleButton() {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === "dark";

  return (
    <button
      onClick={toggle}
      className="w-10 h-10 rounded-full flex items-center justify-center press"
      style={{
        background: "var(--chip-bg)",
        border: "1px solid var(--border-2)",
        color: "var(--fg-3)",
      }}
      aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
      title={isDark ? "切换到浅色模式" : "切换到深色模式"}
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.5 5.5l1.6 1.6M16.9 16.9l1.6 1.6M18.5 5.5l-1.6 1.6M7.1 16.9l-1.6 1.6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.7 8.7 0 1 0 10.7 10.7Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

/* ── 移动端底部标签栏 ── */
function MobileTabBar({ active }: { active: string }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <div
        className="mx-3 mb-2 rounded-[22px] border border-[var(--border-2)] overflow-hidden"
        style={{
          background: "color-mix(in srgb, var(--bg-base) 86%, transparent)",
          backdropFilter: "blur(26px) saturate(1.6)",
          WebkitBackdropFilter: "blur(26px) saturate(1.6)",
          boxShadow: "0 18px 44px -18px rgba(0,0,0,0.95)",
        }}
      >
        <div className="grid grid-cols-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center justify-center gap-1 py-2.5 tap press"
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-[#5ef0e0] shadow-[0_0_10px_#5ef0e0]" />
                )}
                <Icon active={isActive} />
                <span
                  className={`text-[10px] tracking-wide ${
                    isActive ? "text-[#5ef0e0]" : "text-bone-500"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/** 侧边栏主题切换行 */
function ThemeToggleRow() {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === "dark";

  return (
    <button
      onClick={toggle}
      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-2xl press"
      style={{
        background: "var(--chip-bg)",
        border: "1px solid var(--border-1)",
        color: "var(--fg-3)",
      }}
      aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
    >
      <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0">
        {isDark ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.5 5.5l1.6 1.6M16.9 16.9l1.6 1.6M18.5 5.5l-1.6 1.6M7.1 16.9l-1.6 1.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.7 8.7 0 1 0 10.7 10.7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="text-[12.5px] flex-1 text-left">
        {isDark ? "深色模式" : "浅色模式"}
      </span>
      <span className="text-[10.5px] opacity-60">切换</span>
    </button>
  );
}

function SidebarUser({ user }: { user: { username?: string; avatar?: string } | null }) {
  if (!user) {
    return (
      <Link href="/login" className="btn-ghost w-full text-[13px]">
        登录
      </Link>
    );
  }
  return (
    <Link
      href="/me"
      className="flex items-center gap-2.5 px-2 py-2 rounded-2xl hover:bg-[var(--chip-bg)] transition-colors"
    >
      <div className="w-9 h-9 rounded-full bg-void-750 border border-[var(--border-2)] flex items-center justify-center text-[13px] text-bone-200 overflow-hidden shrink-0">
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          (user.username || "?").charAt(0).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-bone-100 truncate">{user.username}</div>
      </div>
    </Link>
  );
}

/* ── 品牌标记：同心圆 + 光环，呼应"读心" ── */
function Logo({ size = 30 }: { size?: number }) {
  return (
    <div
      className="relative rounded-[11px] flex items-center justify-center shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        background:
          "conic-gradient(from 210deg, #5ef0e0, #8b5cf6, #5ef0e0)",
        boxShadow: "0 0 22px -6px rgba(94,240,224,0.75)",
      }}
    >
      <span
        className="rounded-full"
        style={{
          width: size * 0.56,
          height: size * 0.56,
          background: "var(--bg-base)",
        }}
      />
      <span
        className="absolute rounded-full"
        style={{
          width: size * 0.2,
          height: size * 0.2,
          background: "#5ef0e0",
          boxShadow: "0 0 10px #5ef0e0",
        }}
      />
    </div>
  );
}

/* ── 图标 ── */
type IconProps = { active?: boolean };

function stroke(active?: boolean) {
  return active ? "#5ef0e0" : "currentColor";
}

function LibraryIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="4.5" width="7" height="15" rx="2" stroke={stroke(active)} strokeWidth="1.5" />
      <rect x="13.5" y="4.5" width="7" height="15" rx="2" stroke={stroke(active)} strokeWidth="1.5" opacity="0.55" />
      <path d="M6 8h2M16 8h2M6 11.5h2M16 11.5h2" stroke={stroke(active)} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function SparkIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9L12 3.5Z"
        stroke={stroke(active)}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M18.5 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" fill={stroke(active)} opacity="0.6" />
    </svg>
  );
}

function ChatIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 12.5c0 3.6-3.6 6.5-8 6.5-.9 0-1.8-.1-2.6-.3L5 20.5l1.3-3.2C4.9 16.1 4 14.4 4 12.5 4 8.9 7.6 6 12 6s8 2.9 8 6.5Z"
        stroke={stroke(active)}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="12.5" r="1" fill={stroke(active)} />
      <circle cx="12" cy="12.5" r="1" fill={stroke(active)} />
      <circle cx="15" cy="12.5" r="1" fill={stroke(active)} />
    </svg>
  );
}



function MeIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke={stroke(active)} strokeWidth="1.5" opacity="0.45" />
      <circle cx="12" cy="9.5" r="3" stroke={stroke(active)} strokeWidth="1.5" />
      <path d="M6.5 18.6c.9-2.6 3-4 5.5-4s4.6 1.4 5.5 4" stroke={stroke(active)} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
