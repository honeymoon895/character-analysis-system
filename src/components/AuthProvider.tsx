"use client";

import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/store/auth";
import { httpGet } from "@/lib/http";
import { IS_OFFLINE } from "@/lib/offline/flag";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setAuth, token } = useAuthStore();

  useEffect(() => {
    // 单机版：本机账号固定存在，不需要 token
    if (IS_OFFLINE) {
      httpGet("/api/auth/me")
        .then((res) => {
          if (res?.user) setAuth(res.user, "offline");
        })
        .catch(() => {});
      return;
    }

    const savedToken = localStorage.getItem("token");
    if (savedToken && !token) {
      httpGet("/api/auth/me")
        .then((res) => {
          if (res.user) {
            setAuth(res.user, savedToken);
          }
        })
        .catch(() => {
          // Token invalid/expired → 清除登录态
          useAuthStore.getState().logout();
        });
    }
  }, []);

  return <>{children}</>;
}
