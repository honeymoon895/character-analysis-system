"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { IS_OFFLINE } from "@/lib/offline/flag";
import { SubPageHeader } from "@/components/me/SubPageHeader";

/**
 * 问题反馈
 *
 * 单机版没有服务器，反馈没法"提交"到某个后台，
 * 所以这里的交付方式是：把内容和设备信息整理成一段话，
 * 用户复制后发到微信。联系方式也放在最显眼的位置。
 */

const WECHAT = "xy1984287968";
const STORAGE_KEY = "mindscape-feedback-drafts";

interface Draft {
  id: string;
  content: string;
  createdAt: string;
}

export default function FeedbackPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [copied, setCopied] = useState<"wechat" | "feedback" | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDrafts(JSON.parse(raw));
    } catch {}
  }, []);

  async function copy(text: string, which: "wechat" | "feedback") {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // 旧 WebView 没有 clipboard API，退回选中复制
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("复制失败，请长按文字手动选择");
    }
  }

  function buildMessage() {
    const env = [
      `时间：${new Date().toLocaleString("zh-CN")}`,
      `版本：${IS_OFFLINE ? "单机版 APK" : "网页版"}`,
      `系统：${navigator.userAgent}`,
      `屏幕：${window.screen.width}×${window.screen.height}`,
      `窗口：${window.innerWidth}×${window.innerHeight}`,
    ].join("\n");

    return [
      "【读心术 · 问题反馈】",
      content.trim(),
      contact.trim() ? `\n联系方式：${contact.trim()}` : "",
      `\n—— 设备信息 ——\n${env}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function saveDraft() {
    const text = content.trim();
    if (!text) {
      setError("先写一下遇到的问题");
      return;
    }
    setError("");

    const draft: Draft = {
      id: `${Date.now()}`,
      content: text,
      createdAt: new Date().toISOString(),
    };
    const next = [draft, ...drafts].slice(0, 20);
    setDrafts(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}

    await copy(buildMessage(), "feedback");
  }

  return (
    <div className="shell pt-6 md:pt-10 pb-10 max-w-2xl">
      <SubPageHeader
        title="问题反馈"
        en="Feedback"
        desc="哪里不对、想要什么功能，都可以直接说。带上设备信息会更容易定位。"
      />

      <div className="rise space-y-4">
        {/* 微信 */}
        <div
          className="surface-raised p-5"
          style={{
            background:
              "linear-gradient(150deg, color-mix(in srgb, var(--accent) 10%, var(--glass-1)), var(--glass-2))",
          }}
        >
          <div className="text-[11px] tracking-[0.18em] uppercase text-bone-500 mb-2">
            联系我
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display text-[22px] text-bone-50 selection:bg-[var(--accent)]">
              {WECHAT}
            </span>
            <button
              onClick={() => copy(WECHAT, "wechat")}
              className="chip press shrink-0"
            >
              {copied === "wechat" ? "已复制" : "复制微信号"}
            </button>
          </div>
          <p className="text-[12px] text-bone-500 leading-relaxed mt-3">
            微信搜索这个号，备注「读心术」。反馈会按时间倒序处理，
            崩溃和卡死类问题优先。
          </p>
        </div>

        {/* 输入 */}
        <div className="surface p-5 space-y-3">
          <div>
            <label className="text-[11px] tracking-[0.16em] uppercase text-bone-500 block mb-2">
              遇到什么问题
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder={"写清楚三件事就行：\n1. 在哪个页面\n2. 做了什么操作\n3. 看到什么、原本希望是什么"}
              className="field"
            />
          </div>

          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="你的微信号 / 邮箱（可空，方便回复你）"
            className="field"
          />

          {error && <p className="text-[12px] text-rose">{error}</p>}

          <button
            onClick={saveDraft}
            disabled={!content.trim()}
            className="btn-primary w-full"
          >
            {copied === "feedback" ? "已复制，去微信粘贴发送" : "复制反馈内容"}
          </button>
          <p className="text-[11.5px] text-bone-600 text-center leading-relaxed">
            会自动附上版本、系统和屏幕尺寸，方便定位问题。
          </p>
        </div>

        {/* 历史 */}
        {drafts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] tracking-[0.18em] uppercase text-bone-500">
                反馈记录
              </span>
              <button
                onClick={() => {
                  setDrafts([]);
                  try {
                    localStorage.removeItem(STORAGE_KEY);
                  } catch {}
                }}
                className="text-[11.5px] text-bone-600 hover:text-rose px-2 py-1"
              >
                清空
              </button>
            </div>
            <div className="space-y-2">
              {drafts.map((d) => (
                <div key={d.id} className="surface p-4">
                  <div className="text-[10px] text-bone-600 mb-1.5">
                    {new Date(d.createdAt).toLocaleString("zh-CN")}
                  </div>
                  <p className="text-[12.5px] text-bone-200 leading-[1.75] whitespace-pre-wrap">
                    {d.content}
                  </p>
                  <button
                    onClick={() => copy(d.content, "feedback")}
                    className="text-[11.5px] text-bone-400 hover:text-bone-100 mt-2 px-1 py-1"
                  >
                    {copied === "feedback" ? "已复制" : "再次复制"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
