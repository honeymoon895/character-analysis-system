"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { httpPost } from "@/lib/http";
import { useAuthStore } from "@/store/auth";

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await httpPost("/api/auth/register", {
        username,
        password,
        email: email || undefined,
      });
      if (res.token && res.user) {
        setAuth(res.user, res.token);
        router.push("/");
      } else {
        router.push("/login");
      }
    } catch (err: any) {
      setError(err.message || "注册失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col justify-center px-5 py-10 max-w-sm mx-auto">
      <div className="mb-8 rise">
        <div
          className="relative w-14 h-14 rounded-[16px] mb-6 flex items-center justify-center overflow-hidden"
          style={{
            background: "conic-gradient(from 210deg, #5ef0e0, #8b5cf6, #5ef0e0)",
            boxShadow: "0 0 34px -6px rgba(94,240,224,0.85)",
          }}
        >
          <span className="w-8 h-8 rounded-full" style={{ background: "var(--bg-base)" }} />
          <span
            className="absolute w-3 h-3 rounded-full"
            style={{ background: "#5ef0e0", boxShadow: "0 0 12px #5ef0e0" }}
          />
        </div>
        <h1 className="font-display text-[28px] leading-tight text-bone-50 tracking-tight">
          创建账号
        </h1>
        <p className="text-[13px] text-bone-500 mt-2 leading-relaxed">
          你的档案只属于你。
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3 rise" style={{ animationDelay: "80ms" }}>
        <div>
          <label className="block text-[12px] text-bone-400 mb-2">用户名</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="field"
            autoComplete="username"
            minLength={2}
            required
          />
        </div>
        <div>
          <label className="block text-[12px] text-bone-400 mb-2">
            邮箱 <span className="text-bone-600">（可选）</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-[12px] text-bone-400 mb-2">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>

        {error && (
          <div className="text-[12px] text-rose bg-rose/[0.08] border border-rose/20 rounded-lg px-3 py-2.5">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full mt-2"
        >
          {loading ? "创建中……" : "创建账号"}
        </button>
      </form>

      <p className="text-center text-[12.5px] text-bone-500 mt-6">
        已有账号？
        <Link href="/login" className="text-amber/90 ml-1.5">
          登录
        </Link>
      </p>
    </div>
  );
}
