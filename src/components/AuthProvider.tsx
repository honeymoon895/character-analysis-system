"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { httpGet } from "@/lib/http";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, token } = useAuthStore();
  const [loading, setLoading] = useState(true);

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
          localStorage.removeItem("token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6c63ff]" />
      </div>
    );
  }

  return <>{children}</>;
}
