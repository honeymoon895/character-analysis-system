"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "@/store/auth";

/**
 * 应用骨架：移动端底部标签栏 + 桌面端左侧固定导航。
 *
 * 为什么这样设计：原版把入口全部埋进首页的滚动区，用户要翻找、二次点击才会发现功能。
 * 这里把四个主入口（人物库 / 研判 / 自己 / 设置）常驻可见，任何屏幕尺寸下都是零层级可达。
 */

const NAV = [
  { href: "/", label: "人物库", icon: LibraryIcon, match: (p: string) => p === "/" },
  {
    href: "/explore",
    label: "研判",
    icon: CompassIcon,
    match: (p: string) => p.startsWith("/explore") || p.startsWith("/character"),
  },
  {
    href: "/my-profile",
    label: "自己",
    icon: SelfIcon,
    match: (p: string) => p.startsWith("/my-profile"),
  },
  {
    href: "/profile",
    label: "设置",
    icon: SettingsIcon,
    match: (p: string) => p.startsWith("/profile"),
  },
] as const;

const AUTH_ROUTES = ["/login", "/register"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // 登录 / 注册页不显示导航骨架
  if (AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    return <>{children}</>;
  }

  const active = NAV.find((n) => n.match(pathname))?.href ?? "";

  // 对话页需要占满可视高度，且自带顶栏：不叠加移动端头部与标签栏留白
  const fullBleed = pathname.startsWith("/simulate");

  return (
    <div className="min-h-dvh flex">
      {/* ── 桌面端侧边栏 ── */}
      <aside className="hidden md:flex md:w-[228px] lg:w-[252px] shrink-0 flex-col border-r border-white/[0.06] bg-ink-900/60 sticky top-0 h-dvh">
        <div className="px-6 pt-7 pb-6">
          <Link href="/" className="flex items-center gap-3 group">
            <Mark />
            <div className="leading-tight">
              <div className="font-display text-[15px] tracking-wide text-bone-50">
                镜鉴
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-bone-500 mt-0.5">
                Persona
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] transition-colors ${
                  isActive
                    ? "bg-white/[0.06] text-bone-50"
                    : "text-bone-400 hover:text-bone-100 hover:bg-white/[0.03]"
                }`}
              >
                <Icon active={isActive} />
                <span className={isActive ? "font-medium" : ""}>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1 h-1 rounded-full bg-amber" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-4">
          <SidebarFooter user={mounted ? user : null} />
        </div>
      </aside>

      {/* ── 主区域 ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {!fullBleed && <MobileHeader />}
        <main className={`flex-1 ${fullBleed ? "" : "pb-tabbar"}`}>{children}</main>
      </div>

      {/* ── 移动端底部标签栏 ── */}
      {!fullBleed && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.07]"
          style={{
            background: "rgba(11,13,17,0.92)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
            paddingBottom: "var(--safe-bottom)",
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
                  className="flex flex-col items-center justify-center gap-1 py-2.5 tap"
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon active={isActive} />
                  <span
                    className={`text-[10px] tracking-wide ${
                      isActive ? "text-amber-bright" : "text-bone-500"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

function MobileHeader() {
  return (
    <header
      className="md:hidden sticky top-0 z-30 border-b border-white/[0.06]"
      style={{
        background: "rgba(7,8,11,0.86)",
        backdropFilter: "blur(18px) saturate(1.3)",
        WebkitBackdropFilter: "blur(18px) saturate(1.3)",
        paddingTop: "var(--safe-top)",
      }}
    >
      <div className="h-14 flex items-center justify-center">
        <Link href="/" className="flex items-center gap-2">
          <Mark size={22} />
          <span className="font-display text-[15px] tracking-[0.08em] text-bone-50">
            镜鉴
          </span>
        </Link>
      </div>
    </header>
  );
}

function SidebarFooter({ user }: { user: { username?: string; avatar?: string } | null }) {
  const router = useRouter();
  const { logout } = useAuthStore();

  if (!user) {
    return (
      <Link href="/login" className="btn-ghost w-full text-[13px]">
        登录
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-1">
      <div className="w-9 h-9 rounded-full bg-ink-700 flex items-center justify-center text-[13px] text-bone-200 overflow-hidden shrink-0 border border-white/10">
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
      <button
        onClick={() => {
          logout();
          router.push("/login");
        }}
        className="text-[11px] text-bone-500 hover:text-rose transition-colors px-2 py-2 tap"
        aria-label="退出登录"
      >
        退出
      </button>
    </div>
  );
}

/* ── 品牌标记：一个抽象的"镜"与"眼" ── */
function Mark({ size = 28 }: { size?: number }) {
  return (
    <div
      className="relative rounded-[9px] flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(145deg, rgba(237,192,122,0.95) 0%, rgba(169,124,60,0.9) 100%)",
        boxShadow: "0 4px 14px -6px rgba(237,192,122,0.6)",
      }}
    >
      <span
        className="rounded-full bg-ink-950"
        style={{ width: size * 0.34, height: size * 0.34 }}
      />
    </div>
  );
}

/* ── 图标（线性、24px 视框、1.5 描边） ── */
type IconProps = { active?: boolean };

function stroke(active?: boolean) {
  return active ? "var(--color-amber-bright)" : "currentColor";
}

function LibraryIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9a1.5 1.5 0 0 1 1.5 1.5V19a1 1 0 0 1-1.6.8L6.4 18.2A1.5 1.5 0 0 0 5.5 18H5a1 1 0 0 1-1-1V5.5Z"
        stroke={stroke(active)}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 19V5.5A1.5 1.5 0 0 1 12 4h4.5A1.5 1.5 0 0 1 18 5.5V17a1 1 0 0 1-1 1h-1.5c-.6 0-1.1.2-1.6.5l-1.8 1.2a1 1 0 0 1-1.6-.8Z"
        stroke={stroke(active)}
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.65"
      />
    </svg>
  );
}

function CompassIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke={stroke(active)} strokeWidth="1.5" />
      <path
        d="m15 9-2.2 5.4a1 1 0 0 1-.5.5L9 17l1.3-3.3a1 1 0 0 1 .5-.5L15 9Z"
        stroke={stroke(active)}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SelfIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="9" r="3.5" stroke={stroke(active)} strokeWidth="1.5" />
      <path
        d="M5 19.5c.6-3.2 3.4-5 7-5s6.4 1.8 7 5"
        stroke={stroke(active)}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="9" stroke={stroke(active)} strokeWidth="1.2" opacity="0.3" />
    </svg>
  );
}

function SettingsIcon({ active }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke={stroke(active)} strokeWidth="1.5" />
      <path
        d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"
        stroke={stroke(active)}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
