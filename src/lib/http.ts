/**
 * HTTP 客户端
 *
 * 注意 baseURL 的处理方式：
 * 旧版把默认值写死为 http://localhost:3000，在手机上通过局域网 IP 访问时，
 * 所有请求都会打到手机自己的 localhost 上并失败——这是移动端必须避免的问题。
 *
 * 因此这里默认使用相对路径（空 base），让请求跟随当前页面来源。
 * 只有当部署在独立 API 域名下时才需要设置 NEXT_PUBLIC_BASE_URL。
 */

import { IS_OFFLINE } from "@/lib/offline/flag";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";

/**
 * 单机模式：不走网络，直接交给本地实现。
 * 用动态 import 是为了云端构建时不把分析引擎打进首屏包。
 */
async function localCall(method: string, url: string, body?: any): Promise<any> {
  const { localApi } = await import("@/lib/offline/api");
  try {
    return await localApi(method, url, body);
  } catch (e: any) {
    // 本地实现抛出的错误带 status，对页面来说和服务端报错等价
    throw new Error(e?.message || "操作失败");
  }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => null);
  throw new Error(body?.error || fallback);
}

export async function httpGet<T = any>(url: string): Promise<T> {
  if (IS_OFFLINE) return localCall("GET", url);
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) await parseError(res, "请求失败");
  return res.json();
}

export async function httpPost<T = any>(url: string, body?: any): Promise<T> {
  if (IS_OFFLINE) return localCall("POST", url, body);
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "POST",
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  // SSE 流式响应直接交给调用方处理
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    return res as unknown as T;
  }

  if (!res.ok) await parseError(res, "请求失败");
  return res.json();
}

export async function httpDelete<T = any>(url: string): Promise<T> {
  if (IS_OFFLINE) return localCall("DELETE", url);
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res, "删除失败");
  return res.json();
}

export async function httpPatch<T = any>(url: string, body?: any): Promise<T> {
  if (IS_OFFLINE) return localCall("PATCH", url, body);
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await parseError(res, "请求失败");
  return res.json();
}
