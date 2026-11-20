"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 「我的」二级页面的统一顶栏：返回 + 标题 + 一句话说明。
 * 二级页面都从「我的」进入，返回目标固定，避免依赖浏览器历史
 * （PWA 独立窗口里没有浏览器返回键）。
 */
export function SubPageHeader({
  title,
  en,
  desc,
  back = "/me",
  backLabel = "我的",
  right,
}: {
  title: string;
  en?: string;
  desc?: string;
  back?: string;
  backLabel?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-6 rise">
      <Link
        href={back}
        className="inline-flex items-center gap-1 -ml-1.5 mb-3 px-1.5 py-1 rounded-lg text-[12.5px] text-bone-500 hover:text-bone-100 press"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path
            d="m15 6-6 6 6 6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {backLabel}
      </Link>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="font-display text-[23px] text-bone-50 leading-tight">
              {title}
            </h1>
            {en && (
              <span className="text-[10px] uppercase tracking-[0.24em] text-bone-600">
                {en}
              </span>
            )}
          </div>
          {desc && (
            <p className="text-[12.5px] text-bone-400 leading-relaxed mt-2">
              {desc}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </header>
  );
}

