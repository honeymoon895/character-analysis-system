"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { httpPost } from "@/lib/http";
import { useAuthStore } from "@/store/auth";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await httpPost("/api/auth/login", { username, password });
      setAuth(res.user, res.token);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col justify-center px-5 py-10 max-w-sm mx-auto">
      <div className="mb-10 rise">
        <div
          className="w-12 h-12 rounded-[14px] mb-6 flex items-center justify-center"
          style={{
            background:
              "linear-gradient(145deg, rgba(237,192,122,0.95), rgba(169,124,60,0.9))",
          }}
        >
          <span className="w-4 h-4 rounded-full bg-ink-950" />
        </div>
        <h1 className="font-display text-[28px] leading-tight text-bone-50">
          镜鉴
        </h1>
        <p className="text-[13px] text-bone-500 mt-2 leading-relaxed">
          理解一个人，从承认自己看不透开始。
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
            required
          />
        </div>
        <div>
          <label className="block text-[12px] text-bone-400 mb-2">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
            autoComplete="current-password"
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
          {loading ? "登录中……" : "登录"}
        </button>
      </form>

      <p className="text-center text-[12.5px] text-bone-500 mt-6">
        还没有账号？
        <Link href="/register" className="text-amber/90 ml-1.5">
          注册
        </Link>
      </p>
    </div>
  );
}
