import { create } from "zustand";
import { IS_OFFLINE } from "@/lib/offline/flag";

interface User {
  id: number;
  username: string;
  email?: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  setAuth: (user, token) => {
    localStorage.setItem("token", token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem("token");
    set({ user: null, token: null });
  },
  isAuthenticated: () => {
    // 单机版没有登录流程，本机账号天然可用
    if (IS_OFFLINE) return true;
    const token = get().token || localStorage.getItem("token");
    return !!token;
  },
}));
