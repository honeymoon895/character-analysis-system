"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { httpGet } from "@/lib/http";

/**
 * 对话入口
 *
 * 这里解决一个具体问题：旧版必须先建人物才能对话，入口藏在详情页里。
 * 对话本身是高频场景，应该是一级入口——进来就能选人开聊，
 * 没有人物时直接引导新建。
 */

interface CharacterItem {
  id: number;
  name: string;
  source: string;
  portraitUrl: string | null;
  personalitySummary: string | null;
  basicInfo: any;
  updatedAt: string;
}

interface SessionItem {
  id: number;
  characterId: number;
  sessionTitle: string;
  messages: any[];
  updatedAt: string;
}

export default function ChatHomePage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await httpGet<any>("/api/character/list");
      const list: CharacterItem[] = res.characters || [];
      setCharacters(list);

      // 并行拉取每个人的最近会话（数量通常很少）
      const results = await Promise.all(
        list.slice(0, 12).map((c) =>
          httpGet<any>(`/api/simulate/history?character_id=${c.id}`).catch(
            () => ({ sessions: [] })
          )
        )
      );

      const flat: SessionItem[] = [];
      results.forEach((r, i) => {
        const char = list[i];
        (r.sessions || []).forEach((s: any) => {
          if (s.messages?.length > 0) {
            flat.push({
              id: s.id,
              characterId: char.id,
              sessionTitle: s.sessionTitle || char.name,
              messages: s.messages,
              updatedAt: s.updatedAt,
            });
          }
        });
      });
      flat.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setSessions(flat);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="shell pt-10 space-y-3">
        <div className="h-8 w-40 rounded-xl bg-[var(--chip-bg)] animate-pulse" />
        <div className="h-24 rounded-3xl bg-[var(--glass-2)] animate-pulse" />
      </div>
    );
  }

  const recent = sessions.slice(0, 3);

  return (
    <div className="shell pt-6 md:pt-10 pb-4 md:pb-10">
      <header className="mb-7 rise">
        <div className="text-[11px] tracking-[0.24em] uppercase text-bone-500 mb-2">
          对话
        </div>
        <h1 className="font-display text-[27px] md:text-[34px] leading-tight text-bone-50">
          和谁说话
        </h1>
        <p className="text-[13px] text-bone-400 mt-2 leading-relaxed max-w-md">
          以对方的思维方式回应你。每条回复都能翻开看：为什么会这样说。
        </p>
      </header>

      {characters.length === 0 ? (
        <div className="surface-raised p-8 text-center rise">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full border border-[var(--border-2)] flex items-center justify-center breathe">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5ef0e0]" />
          </div>
          <h2 className="font-display text-[18px] text-bone-50 mb-2">
            还没有可对话的人物
          </h2>
          <p className="text-[12.5px] text-bone-500 leading-relaxed mb-5 max-w-xs mx-auto">
            对话基于人格档案。先建立一份研判，AI 才能按 TA 的方式回应你。
          </p>
          <Link href="/explore" className="btn-primary w-full max-w-xs mx-auto flex">
            新建研判
          </Link>
        </div>
      ) : (
        <>
          {/* 最近对话 */}
          {recent.length > 0 && (
            <section className="mb-8">
              <Label text="继续对话" />
              <div className="space-y-2">
                {recent.map((s) => {
                  const c = characters.find((x) => x.id === s.characterId);
                  if (!c) return null;
                  return (
                    <Link
                      key={s.id}
                      href={`/chat/session?id=${c.id}`}
                      className="surface p-4 flex items-center gap-3.5 press block hover:border-white/[0.14]"
                    >
                      <Avatar char={c} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] text-bone-50 truncate">
                          {c.name}
                        </div>
                        <div className="text-[12px] text-bone-500 truncate mt-0.5">
                          {preview(s.messages)}
                        </div>
                      </div>
                      <span className="text-[10px] text-bone-600 shrink-0">
                        {relative(s.updatedAt)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* 全部人物 */}
          <section>
            <Label text={`选择人物 · ${characters.length}`} />
            <div className="grid gap-2 sm:grid-cols-2">
              {characters.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/chat/session?id=${c.id}`}
                  className="surface p-4 flex items-center gap-3 press rise hover:border-white/[0.14]"
                  style={{ animationDelay: `${Math.min(i * 35, 300)}ms` }}
                >
                  <Avatar char={c} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] text-bone-50 truncate">
                      {c.name}
                    </div>
                    <div className="text-[11px] text-bone-500 truncate">
                      {c.personalitySummary || "尚无结论"}
                    </div>
                  </div>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-bone-600 shrink-0">
                    <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Label({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="text-[11px] tracking-[0.2em] uppercase text-bone-500">
        {text}
      </span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

function Avatar({ char, size }: { char: CharacterItem; size: number }) {
  const valid = char.portraitUrl && !char.portraitUrl.includes("dicebear.com");
  if (valid) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={char.portraitUrl!}
        alt=""
        className="rounded-full object-cover shrink-0 border border-[var(--border-2)]"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full shrink-0 border border-[var(--border-2)] flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(150deg, color-mix(in srgb, var(--accent) 14%, var(--bg-base)), var(--bg-base))",
      }}
    >
      <span className="font-display text-bone-200" style={{ fontSize: size * 0.4 }}>
        {char.name.charAt(0)}
      </span>
    </div>
  );
}

function preview(messages: any[]): string {
  const last = [...messages].reverse().find((m) => m.role === "assistant");
  if (!last) {
    const u = [...messages].reverse().find((m) => m.role === "user");
    return u?.content || "开始对话";
  }
  const c = last.content;
  return typeof c === "string" ? c : c?.simulatedResponse || "…";
}

function relative(iso: string): string {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (diff < 1) return "今天";
  if (diff < 2) return "昨天";
  if (diff < 30) return `${Math.floor(diff)} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}
