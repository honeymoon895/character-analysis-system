"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { httpGet, httpPost } from "@/lib/http";
import { IS_OFFLINE } from "@/lib/offline/flag";

/**
 * 「我的」—— 入口页
 *
 * 只做导航，不放内容：每一项竖排成一行，点进去是独立页面。
 * 每行右侧带一句实时状态（几条记录、推演到哪、用的什么模型），
 * 让用户不点进去也知道哪里需要处理。
 */

interface HubState {
  characters: number;
  measured: number;
  memoryCount: number;
  coverage: number;
  sims: number;
  calibration: number | null;
  selfDone: boolean;
  hasProfile: boolean;
  aiLabel: string;
  aiReady: boolean;
}

const EMPTY: HubState = {
  characters: 0,
  measured: 0,
  memoryCount: 0,
  coverage: 0,
  sims: 0,
  calibration: null,
  selfDone: false,
  hasProfile: false,
  aiLabel: "",
  aiReady: false,
};

export default function MePage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [s, setS] = useState<HubState>(EMPTY);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    load();
  }, []);

  async function load() {
    try {
      // 各项状态互不依赖，任一失败都不影响其他项显示
      const [self, list, memory, life, ai] = await Promise.all([
        httpGet<any>("/api/user/self").catch(() => null),
        httpGet<any>("/api/character/list").catch(() => null),
        httpGet<any>("/api/memory").catch(() => null),
        httpGet<any>("/api/life").catch(() => null),
        httpGet<any>("/api/user/ai-settings").catch(() => null),
      ]);

      const p = self?.profile || {};
      setAvatarUrl(p.selfAvatarUrl || null);

      const chars = list?.characters || [];
      const measured = chars.filter((c: any) => {
        let arr: any[] = [];
        try {
          arr = typeof c.traits === "string" ? JSON.parse(c.traits) : c.traits || [];
        } catch {}
        return arr.some((t: any) => t.measured !== false && (t.confidence ?? 0) >= 30);
      }).length;

      const cur = ai?.current || {};
      const aiReady = Boolean(cur.hasKey || ai?.usingEnv);
      const providerName =
        (ai?.providers || []).find((x: any) => x.id === cur.provider)?.name || "";

      setS({
        characters: chars.length,
        measured,
        memoryCount: memory?.entries?.length || 0,
        coverage: memory?.coverage?.score || 0,
        sims: life?.sims?.length || 0,
        calibration: life?.calibration?.score ?? null,
        selfDone: Boolean(p.selfAnalysisComplete),
        hasProfile: Boolean(p.selfAnalysisProfile),
        aiLabel: cur.hasKey
          ? cur.model || providerName || "已配置"
          : ai?.usingEnv
          ? "使用默认服务"
          : "",
        aiReady,
      });
    } finally {
      setLoading(false);
    }
  }

  async function uploadAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (IS_OFFLINE) {
        // 单机版没有上传接口，直接转成 dataURL 存在本机
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("读取图片失败"));
          reader.readAsDataURL(file);
        });
        const data = await httpPost<any>("/api/user/self/upload-avatar", { dataUrl });
        if (data.avatarUrl) {
          setAvatarUrl(data.avatarUrl);
          if (data.user) useAuthStore.getState().setAuth(data.user, "offline");
        }
        return;
      }

      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/user/self/upload-avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: fd,
      });
      const data = await res.json();
      if (data.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
        if (data.user) {
          useAuthStore.getState().setAuth(data.user, localStorage.getItem("token") || "");
        }
      }
    } catch (e: any) {
      alert("上传失败：" + e.message);
    }
  }

  return (
    <div className="shell pt-6 md:pt-10 pb-10 max-w-2xl">
      {/* ═══ 身份 ═══ */}
      <header className="flex items-center gap-4 mb-7 rise">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative w-16 h-16 rounded-[20px] overflow-hidden shrink-0 border border-[var(--border-2)] flex items-center justify-center"
          style={{
            background:
              "linear-gradient(150deg, color-mix(in srgb, var(--accent) 14%, var(--bg-base)), var(--bg-base))",
          }}
          aria-label="更换头像"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-[24px] text-bone-200">
              {(user?.username || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[22px] text-bone-50 truncate">{user?.username}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="chip">
              <span className="numeral text-bone-100">{s.characters}</span> 档案
            </span>
            <span className="chip">
              <span className="numeral text-bone-100">{s.measured}</span> 已研判
            </span>
          </div>
        </div>
      </header>

      {/* ═══ 关于我 ═══ */}
      <Group label="关于我">
        <MenuRow
          href="/me/self"
          icon={<SelfIcon />}
          title="自我认知"
          desc="用你的记录做人格研判"
          status={loading ? "" : s.hasProfile ? (s.selfDone ? "已研判" : "初步结论") : "未研判"}
          dim={!loading && !s.hasProfile}
        />
        <MenuRow
          href="/me/knowledge"
          icon={<MemoryIcon />}
          title="知识库"
          desc="日记、想法、关系与决定"
          status={loading ? "" : s.memoryCount ? `${s.memoryCount} 条 · 依据 ${s.coverage}` : "空"}
          dim={!loading && s.memoryCount === 0}
        />
        <MenuRow
          href="/life"
          icon={<LifeIcon />}
          title="模拟人生"
          desc="推演一个选择之后的几条路"
          status={
            loading
              ? ""
              : s.sims
              ? `${s.sims} 次推演${s.calibration !== null ? ` · 校准 ${s.calibration}` : ""}`
              : "未开始"
          }
          dim={!loading && s.sims === 0}
          last
        />
      </Group>

      {/* ═══ 设置 ═══ */}
      <Group label="设置">
        <MenuRow
          href="/me/ai"
          icon={<EngineIcon />}
          title="AI 引擎"
          desc="服务商、密钥与模型"
          status={loading ? "" : s.aiReady ? s.aiLabel : "未配置"}
          warn={!loading && !s.aiReady}
        />
        <MenuRow
          href="/me/account"
          icon={<AccountIcon />}
          title="账号与外观"
          desc="主题、账号信息、退出登录"
          last
        />
      </Group>
    </div>
  );
}

/* ── 分组 ── */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mb-6 rise">
      <div className="text-[10.5px] tracking-[0.22em] uppercase text-bone-600 px-1 mb-2">
        {label}
      </div>
      <div className="surface overflow-hidden">{children}</div>
    </section>
  );
}

/* ── 一行菜单 ── */
function MenuRow({
  href,
  icon,
  title,
  desc,
  status,
  dim,
  warn,
  last,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  desc: string;
  status?: string;
  dim?: boolean;
  warn?: boolean;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      className="relative flex items-center gap-3.5 px-4 py-3.5 min-h-[64px] press hover:bg-[var(--chip-bg)] transition-colors"
    >
      <span
        className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0"
        style={{
          background:
            "linear-gradient(140deg, color-mix(in srgb, var(--accent) 16%, transparent), color-mix(in srgb, var(--accent-2) 12%, transparent))",
          border: "1px solid var(--border-1)",
          color: "var(--accent)",
        }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] text-bone-50">{title}</span>
        <span className="block text-[11.5px] text-bone-500 mt-0.5 truncate">{desc}</span>
      </span>
      {status !== undefined && status !== "" && (
        <span
          className={`text-[11.5px] shrink-0 max-w-[42%] truncate ${
            warn ? "text-rose" : dim ? "text-bone-600" : "text-bone-300"
          }`}
        >
          {status}
        </span>
      )}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-bone-600 shrink-0">
        <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!last && (
        <span className="absolute bottom-0 left-[70px] right-0 h-px bg-[var(--hairline)]" />
      )}
    </Link>
  );
}

/* ── 图标 ── */
const ic = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none" } as const;
const st = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function SelfIcon() {
  return (
    <svg {...ic}>
      <circle cx="12" cy="8.5" r="3.6" {...st} />
      <path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" {...st} />
    </svg>
  );
}
function MemoryIcon() {
  return (
    <svg {...ic}>
      <path d="M5 4.5h10.5L19 8v11.5H5z" {...st} />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 7.5h4" {...st} />
    </svg>
  );
}
function LifeIcon() {
  return (
    <svg {...ic}>
      <path d="M6 3.5v6a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v5" {...st} />
      <path d="M6 12.5v8" {...st} opacity="0.5" />
      <circle cx="6" cy="3.5" r="1.3" {...st} />
    </svg>
  );
}
function EngineIcon() {
  return (
    <svg {...ic}>
      <rect x="6" y="6" width="12" height="12" rx="2.5" {...st} />
      <path d="M9.5 2.8v3.2M14.5 2.8v3.2M9.5 18v3.2M14.5 18v3.2M2.8 9.5h3.2M2.8 14.5h3.2M18 9.5h3.2M18 14.5h3.2" {...st} />
    </svg>
  );
}
function AccountIcon() {
  return (
    <svg {...ic}>
      <circle cx="12" cy="12" r="3" {...st} />
      <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.4.9a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5a7.5 7.5 0 0 0-2.6 1.5l-2.4-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.4-.9c.8.7 1.6 1.2 2.6 1.5l.4 2.5h4l.4-2.5c1-.3 1.8-.8 2.6-1.5l2.4.9 2-3.4z" {...st} />
    </svg>
  );
}
