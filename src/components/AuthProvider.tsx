"use client";

import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/store/auth";
import { httpGet } from "@/lib/http";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setAuth, token } = useAuthStore();

  useEffect(() => {
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
