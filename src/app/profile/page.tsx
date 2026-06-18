"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Header } from "@/components/Header";
import { httpGet } from "@/lib/http";

export default function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState({ characters: 0, simulations: 0 });

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await httpGet("/api/character/list");
      setStats((prev) => ({ ...prev, characters: res.characters?.length || 0 }));
    } catch {}
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (!user) return null;

  return (
    <>
      <Header />
      <main className="flex-1 py-12">
        <div className="page-container max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">👤 个人中心</h1>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#6c63ff] to-[#8b85ff] flex items-center justify-center text-white text-3xl font-bold shadow-md">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{user.username}</h2>
                <p className="text-gray-500">{user.email || "未设置邮箱"}</p>
                <p className="text-xs text-gray-400 mt-1">加入时间：{(user as any).createdAt ? new Date((user as any).createdAt).toLocaleDateString("zh-CN") : "未知"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-[#6c63ff]">{stats.characters}</div>
                <div className="text-sm text-gray-500 mt-1">分析人物</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-[#6c63ff]">{stats.simulations}</div>
                <div className="text-sm text-gray-500 mt-1">模拟会话</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-50">
                <span className="text-gray-600">用户名</span>
                <span className="text-gray-900 font-medium">{user.username}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-50">
                <span className="text-gray-600">邮箱</span>
                <span className="text-gray-900 font-medium">{user.email || "未设置"}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => router.push("/")} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white font-medium hover:shadow-md transition-all">
              返回首页
            </button>
            <button onClick={handleLogout} className="px-8 py-3 rounded-xl border border-red-200 text-red-500 font-medium hover:bg-red-50 transition-all">
              退出登录
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
