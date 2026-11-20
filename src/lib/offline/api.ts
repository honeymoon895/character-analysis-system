/**
 * 单机模式的分发器
 *
 * 作用：在没有服务器的情况下，把页面发出的 `/api/...` 请求
 * 交给本地实现处理。页面代码不需要知道自己在联网还是单机。
 *
 * 行为对齐服务端：
 * - 返回结构与服务端同名接口一致（避免前端两套解析）
 * - 部分接口（分析、对话）服务端用 SSE 返回，这里也合成 SSE，
 *   否则页面的流式读取逻辑会走不到
 * - 出错时抛出带 status 的 Error，由 http.ts 统一转成普通异常
 */

import { kvGet, kvSet, kvUpdate } from "./db";
import {
  buildEntry,
  computeCoverage,
  normalizeEntries,
} from "@/lib/knowledge/store";
import {
  computeCalibration,
  type LifeNode,
  type LifeSim,
} from "@/lib/life/types";
import { startLifeSim, advanceLifeSim } from "@/lib/life/engine";
import {
  analyzePublicFigure,
  analyzePerson,
  analyzeSelf,
  readIntent,
  simulateDialogue,
  runCounterfactual,
} from "@/lib/analysis/engine";
import {
  toLegacyTraits,
  toSummary,
  toLegacyValues,
  toLegacyBehaviorPatterns,
} from "@/lib/analysis/legacy";
import type { AnalysisProfile } from "@/lib/analysis/types";
import { createVideoTask, generatePortrait, waitForVideo } from "@/lib/ai";
import {
  AI_PROVIDERS,
  findProvider,
  mediaSupport,
  normalizeEndpoint,
  resolveAIConfig,
  type AIConfig,
} from "@/lib/ai/config";

/* ══════════════════ 存储键 ══════════════════ */

const K = {
  user: "user",
  selfDiary: "selfDiary",
  selfProfile: "selfAnalysisProfile",
  selfTraits: "selfTraits",
  selfComplete: "selfAnalysisComplete",
  selfAvatar: "selfAvatarUrl",
  ai: "aiConfig",
  characters: "characters",
  sessions: "sessions",
  lifeSims: "lifeSims",
} as const;

export const OFFLINE_KEYS = Object.values(K);

export interface LocalUser {
  id: number;
  username: string;
  email: string | null;
  avatar: string | null;
  createdAt: string;
}

interface LocalCharacter {
  id: number;
  name: string;
  source: string;
  basicInfo: string | null;
  traits: string | null;
  personalitySummary: string | null;
  behaviorPatterns: string | null;
  values: string | null;
  keyEvents: string | null;
  achievements: string | null;
  analysisProfile: string | null;
  portraitUrl: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

interface LocalSession {
  id: number;
  characterId: number;
  sessionTitle: string | null;
  sessionType: string;
  messages: string;
  settings: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ══════════════════ 基础读写 ══════════════════ */

function now() {
  return new Date().toISOString();
}

function nextId(list: { id: number }[]): number {
  return list.reduce((m, x) => Math.max(m, x.id), 0) + 1;
}

export async function getUser(): Promise<LocalUser> {
  return kvUpdate<LocalUser>(K.user, (cur) => {
    if (cur) return cur;
    // 单机版没有注册流程，第一次打开就有一个本机账号
    return {
      id: 1,
      username: "我",
      email: null,
      avatar: null,
      createdAt: now(),
    };
  });
}

export async function setUsername(username: string): Promise<LocalUser> {
  return kvUpdate<LocalUser>(K.user, (cur) => ({
    ...(cur || { id: 1, email: null, avatar: null, createdAt: now() }),
    username: username.trim() || "我",
  }));
}

/** 读取 AI 配置（含用户填的 key） */
export async function getAIConfig(): Promise<AIConfig | null> {
  const stored = await kvGet<any>(K.ai, null);
  return resolveAIConfig(stored);
}

function fail(message: string, status = 400): never {
  const err: any = new Error(message);
  err.status = status;
  throw err;
}

function parseUrl(raw: string): { path: string; query: URLSearchParams } {
  const u = new URL(raw, "http://local");
  return { path: u.pathname, query: u.searchParams };
}

function jsonBody(v: unknown): any {
  if (!v || typeof v !== "object") return {};
  return v;
}

/* ══════════════════ SSE ══════════════════ */

/** 和服务端 sse() 输出一致的流，供页面的流式读取逻辑使用 */
function sse(data: unknown): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}

function safeJson<T = any>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/* ══════════════════ 主入口 ══════════════════ */

export async function localApi(
  method: string,
  rawUrl: string,
  body?: unknown
): Promise<any> {
  const { path, query } = parseUrl(rawUrl);
  const m = method.toUpperCase();
  const b = jsonBody(body);

  /* ── 账号 ── */
  if (path === "/api/auth/me" && m === "GET") {
    return { user: await getUser() };
  }
  if ((path === "/api/auth/login" || path === "/api/auth/register") && m === "POST") {
    return { success: true, token: "offline", user: await getUser() };
  }

  /* ── 自我认知 ── */
  if (path === "/api/user/self" && m === "GET") {
    return { profile: await selfPayload() };
  }
  if (path === "/api/user/self" && m === "POST") {
    return handleSelfPost(b);
  }

  /* ── AI 设置 ── */
  if (path === "/api/user/ai-settings" && m === "GET") {
    return aiSettingsPayload();
  }
  if (path === "/api/user/ai-settings" && m === "POST") {
    return handleAISettingsPost(b);
  }

  /* ── 知识库 ── */
  if (path === "/api/memory" && m === "GET") {
    const entries = await memoryEntries();
    return { entries, coverage: computeCoverage(entries) };
  }
  if (path === "/api/memory" && m === "POST") {
    return handleMemoryCreate(b);
  }
  const memoryId = path.match(/^\/api\/memory\/([^/]+)$/);
  if (memoryId) {
    if (m === "PATCH") return handleMemoryPatch(memoryId[1], b);
    if (m === "DELETE") return handleMemoryDelete(memoryId[1]);
  }

  /* ── 模拟人生 ── */
  if (path === "/api/life" && m === "GET") {
    return lifeListPayload();
  }
  if (path === "/api/life" && m === "POST") {
    return handleLifeCreate(b);
  }
  const lifeId = path.match(/^\/api\/life\/([^/]+)$/);
  if (lifeId) {
    if (m === "GET") return handleLifeGet(lifeId[1]);
    if (m === "POST") return handleLifePost(lifeId[1], b);
    if (m === "PATCH") return handleLifePatch(lifeId[1], b);
    if (m === "DELETE") return handleLifeDelete(lifeId[1]);
  }

  /* ── 人物库 ── */
  if (path === "/api/character/list" && m === "GET") {
    return handleCharacterList();
  }
  if (path === "/api/character/analyze" && m === "POST") {
    return handleAnalyze(b);
  }
  if (path === "/api/character/build" && m === "POST") {
    return handleBuild(b);
  }
  if (path === "/api/character/generate-portrait" && m === "POST") {
    return handlePortrait(b);
  }
  const charId = path.match(/^\/api\/character\/(\d+)$/);
  if (charId) {
    if (m === "GET") return handleCharacterGet(Number(charId[1]));
    if (m === "DELETE") return handleCharacterDelete(Number(charId[1]));
  }
  const readId = path.match(/^\/api\/character\/(\d+)\/read$/);
  if (readId && m === "POST") {
    return handleRead(Number(readId[1]), b);
  }

  /* ── 模拟对话 ── */
  if (path === "/api/simulate" && m === "POST") {
    return handleSimulate(b);
  }
  if (path === "/api/simulate/history" && m === "GET") {
    return handleHistory(query.get("character_id"));
  }
  const sessionId = path.match(/^\/api\/simulate\/(\d+)$/);
  if (sessionId) {
    if (m === "GET") return handleSessionGet(Number(sessionId[1]));
    if (m === "PATCH") return handleSessionArchive(Number(sessionId[1]));
    if (m === "DELETE") return handleSessionDelete(Number(sessionId[1]));
  }
  if (path === "/api/simulate/counterfactual" && m === "POST") {
    return handleCounterfactual(b);
  }

  /* ── 本机头像与导出 ── */
  if (path === "/api/user/self/upload-avatar" && m === "POST") {
    return handleSelfAvatar(b);
  }
  if (path === "/api/user/self/export" && m === "GET") {
    return exportAll();
  }
  if (path === "/api/video/generate" && m === "POST") {
    return handleVideo(b);
  }

  /* ── 杂项 ── */
  if (path === "/api/feedback" && m === "POST") {
    return { success: true }; // 单机版没有反馈收集通道
  }
  if (path === "/api/dimensions" && m === "GET") {
    return { dimensions: [] };
  }

  fail(`单机模式暂不支持该接口：${method} ${path}`, 404);
}

/* ══════════════════ 自我认知 ══════════════════ */

async function memoryEntries() {
  return normalizeEntries(await kvGet<any[]>(K.selfDiary, []));
}

async function selfPayload() {
  const user = await getUser();
  const [entries, traits, profile, complete, avatar] = await Promise.all([
    memoryEntries(),
    kvGet<any[]>(K.selfTraits, []),
    kvGet<AnalysisProfile | null>(K.selfProfile, null),
    kvGet<boolean>(K.selfComplete, false),
    kvGet<string | null>(K.selfAvatar, null),
  ]);

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    selfAvatarUrl: avatar,
    selfDiary: entries,
    selfTraits: traits,
    selfPersonalitySummary: profile?.formulation?.coreThesis || null,
    selfBehaviorPatterns: profile ? toLegacyBehaviorPatterns(profile) : [],
    selfValues: profile ? toLegacyValues(profile) : [],
    selfAnalysisProfile: profile,
    selfAnalysisComplete: complete,
  };
}

async function handleSelfPost(b: any) {
  if (b.action === "reset") {
    await Promise.all([
      kvSet(K.selfDiary, []),
      kvSet(K.selfTraits, []),
      kvSet(K.selfProfile, null),
      kvSet(K.selfComplete, false),
    ]);
    return { success: true, message: "已重置" };
  }

  const entries = await memoryEntries();
  let list = entries;
  let entry = null;

  if (b.action !== "reanalyze") {
    const text = typeof b.content === "string" ? b.content.trim() : "";
    if (!text) fail("请输入内容");
    entry = buildEntry({ kind: b.kind, title: b.title, content: text, tags: b.tags });
    list = [...entries, entry];
  }

  if (list.length === 0) fail("知识库还是空的，先记几条再研判");

  const profile = await analyzeSelf(
    list.map((e) => ({
      content: e.title ? `【${e.title}】${e.content}` : e.content,
      timestamp: e.createdAt,
    })),
    await kvGet<AnalysisProfile | null>(K.selfProfile, null),
    await getAIConfig()
  );

  const legacy = toLegacyTraits(profile);
  const measured = profile.traits.filter(
    (t) => t.score !== null && t.confidence >= 50
  ).length;
  const complete = profile.meta.isAnalyzed && measured >= 4;

  await Promise.all([
    kvSet(K.selfDiary, list),
    kvSet(K.selfProfile, profile),
    kvSet(K.selfTraits, legacy),
    kvSet(K.selfComplete, complete),
  ]);

  return {
    success: true,
    entry,
    diaryCount: list.length,
    analysisComplete: complete,
    aiConfigured: Boolean(await getAIConfig()),
    isAnalyzed: profile.meta.isAnalyzed,
    sufficiency: profile.meta.sufficiency,
    unknowns: profile.meta.unknowns,
    traits: legacy,
    summary: toSummary(profile),
    behaviorPatterns: toLegacyBehaviorPatterns(profile),
    values: toLegacyValues(profile),
  };
}

/* ══════════════════ AI 设置 ══════════════════ */

async function aiSettingsPayload() {
  const stored = await kvGet<any>(K.ai, null);
  const cfg = resolveAIConfig(stored);

  return {
    providers: AI_PROVIDERS,
    mediaSupport: mediaSupport(cfg),
    current: {
      provider: stored?.aiProvider || null,
      model: stored?.aiModel || "",
      baseUrl: stored?.aiBaseUrl || "",
      imageModel: stored?.aiImageModel || "",
      videoModel: stored?.aiVideoModel || "",
      imageUrl: stored?.aiImageUrl || "",
      videoUrl: stored?.aiVideoUrl || "",
      hasKey: Boolean(stored?.aiApiKey),
      keyHint: stored?.aiApiKey ? `••••${String(stored.aiApiKey).slice(-4)}` : "",
    },
    envAvailable: false,
    usingEnv: false,
  };
}

async function handleAISettingsPost(b: any) {
  if (b.action === "reset") {
    await kvSet(K.ai, null);
    return { success: true };
  }

  const providerId = String(b.provider || "");
  const provider = findProvider(providerId);
  if (!provider) fail("未知的服务商");

  const apiKey = String(b.apiKey || "").trim();
  const model = String(b.model || "").trim();
  if (!apiKey) fail("请填写 API Key");
  if (!model) fail("请填写模型名称");

  const baseUrl =
    providerId === "custom"
      ? normalizeEndpoint(String(b.baseUrl || ""))
      : provider.endpoint;

  if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
    fail("接口地址无效，需以 http:// 或 https:// 开头");
  }

  const next = {
    aiProvider: providerId,
    aiApiKey: apiKey,
    aiBaseUrl: baseUrl,
    aiModel: model,
    aiImageModel: String(b.imageModel || "").trim() || null,
    aiVideoModel: String(b.videoModel || "").trim() || null,
    aiImageUrl: String(b.imageUrl || "").trim() || null,
    aiVideoUrl: String(b.videoUrl || "").trim() || null,
  };

  // 保存前实测一次：手机直连服务商，能通过的基本就是真能用
  if (b.test !== false) {
    const check = await testConnection({ apiKey, baseUrl, model });
    if (!check.ok) fail(check.message || "连接测试失败", 502);
  }

  await kvSet(K.ai, next);
  return { success: true };
}

async function testConnection(cfg: {
  apiKey: string;
  baseUrl: string;
  model: string;
}): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(cfg.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: "回复 ok" }],
        max_tokens: 8,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, message: `连接失败（${res.status}）：${detail.slice(0, 160)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return {
      ok: false,
      message: `连接失败：${e?.message || "网络不可达"}`,
    };
  }
}

/* ══════════════════ 知识库 ══════════════════ */

async function handleMemoryCreate(b: any) {
  const content = typeof b.content === "string" ? b.content.trim() : "";
  if (!content) fail("内容不能为空");
  if (content.length > 4000) fail("单条最多 4000 字");

  const entry = buildEntry({
    kind: b.kind,
    title: b.title,
    content,
    tags: Array.isArray(b.tags)
      ? b.tags
      : typeof b.tags === "string"
      ? b.tags.split(/[\s,，]+/)
      : [],
    importance: b.importance,
    occurredAt: b.occurredAt,
  });

  const list = await kvUpdate<any[]>(K.selfDiary, (cur) => [
    ...normalizeEntries(cur || []),
    entry,
  ]);

  return { success: true, entry, entries: list, coverage: computeCoverage(list) };
}

async function handleMemoryPatch(id: string, b: any) {
  const entries = await memoryEntries();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) fail("记录不存在", 404);

  const target = entries[idx];
  const updated = [...entries];
  updated[idx] = {
    ...target,
    kind: typeof b.kind === "string" && b.kind ? b.kind : target.kind,
    title: typeof b.title === "string" ? b.title.trim() || undefined : target.title,
    content:
      typeof b.content === "string" && b.content.trim()
        ? b.content.trim()
        : target.content,
    tags: Array.isArray(b.tags)
      ? b.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 8)
      : target.tags,
    updatedAt: now(),
  };

  await kvSet(K.selfDiary, updated);
  return { success: true, entry: updated[idx], entries: updated, coverage: computeCoverage(updated) };
}

async function handleMemoryDelete(id: string) {
  const entries = await memoryEntries();
  const remaining = entries.filter((e) => e.id !== id);
  if (remaining.length === entries.length) fail("记录不存在", 404);
  await kvSet(K.selfDiary, remaining);
  return { success: true, entries: remaining, coverage: computeCoverage(remaining) };
}

/* ══════════════════ 模拟人生 ══════════════════ */

async function sims(): Promise<LifeSim[]> {
  return kvGet<LifeSim[]>(K.lifeSims, []);
}

async function lifeListPayload() {
  const [list, entries] = await Promise.all([sims(), memoryEntries()]);
  return {
    sims: [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    coverage: computeCoverage(entries),
    calibration: computeCalibration(list),
  };
}

async function handleLifeCreate(b: any) {
  const premise = typeof b.premise === "string" ? b.premise.trim() : "";
  if (premise.length < 8) fail("再多写一点处境：现在在哪、正在纠结什么");
  if (premise.length > 2000) fail("处境描述最多 2000 字");

  const cfg = await getAIConfig();
  if (!cfg) fail("未配置 AI 服务，请先到「我的 → AI 引擎」填写密钥", 503);

  const entries = await memoryEntries();
  const coverage = computeCoverage(entries);
  const focus = b.focus || "综合";
  const horizon = b.horizon || "1年";
  const title = (b.title || "").trim() || `${focus}：${premise.slice(0, 18)}…`;

  const node = await startLifeSim(
    { title, premise, focus, horizon },
    { entries, coverage },
    cfg
  );
  if (!node) fail("推演没有成功返回结果，请稍后重试或换一个模型", 502);

  const sim: LifeSim = {
    id: 0,
    title,
    premise,
    focus,
    horizon,
    status: "active",
    nodes: [node],
    coverage: coverage.score,
    createdAt: now(),
    updatedAt: now(),
  };

  const saved = await kvUpdate<LifeSim[]>(K.lifeSims, (cur) => {
    const list = cur || [];
    sim.id = nextId(list);
    return [...list, sim];
  });

  const created = saved.find((s) => s.id === sim.id)!;
  return { success: true, sim: created, coverage };
}

async function findSim(id: string): Promise<LifeSim> {
  const list = await sims();
  const sim = list.find((s) => s.id === Number(id));
  if (!sim) fail("推演不存在", 404);
  return sim;
}

async function saveSim(next: LifeSim) {
  await kvUpdate<LifeSim[]>(K.lifeSims, (cur) =>
    (cur || []).map((s) => (s.id === next.id ? next : s))
  );
}

async function handleLifeGet(id: string) {
  const sim = await findSim(id);
  return { sim, calibration: computeCalibration([sim]) };
}

async function handleLifePost(id: string, b: any) {
  const sim = await findSim(id);
  const nodes = [...sim.nodes];
  const action = b.action || "choose";

  if (action === "choose") {
    const last = nodes[nodes.length - 1];
    if (!last) fail("这个推演还没有开始");
    if (last.choice) fail("这一步已经选过了，请继续下一步", 409);

    const branch = last.branches.find((x) => x.id === b.branchId);
    if (!branch) fail("选项不存在");

    const cfg = await getAIConfig();
    if (!cfg) fail("未配置 AI 服务，请先到「我的 → AI 引擎」填写密钥", 503);

    const entries = await memoryEntries();
    const coverage = computeCoverage(entries);
    const actual =
      typeof b.actual === "string" && b.actual.trim()
        ? b.actual.trim().slice(0, 1500)
        : undefined;

    const next = await advanceLifeSim(
      {
        sim: { title: sim.title, premise: sim.premise, focus: sim.focus, horizon: sim.horizon },
        nodes,
        choice: { branchId: b.branchId, actual },
        ctx: { entries, coverage },
      },
      cfg
    );
    if (!next) fail("推演没有成功返回结果，请稍后重试", 502);

    nodes[nodes.length - 1] = {
      ...last,
      choice: { branchId: b.branchId, chosenAt: now(), actual },
    };
    nodes.push(next);

    const updated: LifeSim = {
      ...sim,
      nodes,
      coverage: coverage.score,
      updatedAt: now(),
    };
    await saveSim(updated);
    return { success: true, sim: updated, calibration: computeCalibration([updated]), coverage };
  }

  if (action === "resolve") {
    const idx = nodes.findIndex((n) => n.id === b.nodeId);
    if (idx === -1) fail("节点不存在");
    const node = nodes[idx];
    const branchId = String(b.branchId || node.choice?.branchId || "");
    if (!branchId) fail("缺少分支");
    if (typeof b.hit !== "boolean") fail("缺少结果判定");

    nodes[idx] = {
      ...node,
      choice: {
        branchId,
        chosenAt: node.choice?.chosenAt || now(),
        actual:
          typeof b.actual === "string" && b.actual.trim()
            ? b.actual.trim().slice(0, 1500)
            : node.choice?.actual,
        hit: b.hit,
        resolvedAt: now(),
      },
    };

    const updated: LifeSim = { ...sim, nodes, updatedAt: now() };
    await saveSim(updated);
    return { success: true, sim: updated, calibration: computeCalibration([updated]) };
  }

  fail("未知操作");
}

async function handleLifePatch(id: string, b: any) {
  const sim = await findSim(id);
  const updated: LifeSim = {
    ...sim,
    title: typeof b.title === "string" && b.title.trim() ? b.title.trim().slice(0, 80) : sim.title,
    status: b.status === "done" || b.status === "active" ? b.status : sim.status,
    updatedAt: now(),
  };
  await saveSim(updated);
  return { success: true, sim: updated };
}

async function handleLifeDelete(id: string) {
  const sim = await findSim(id);
  await kvUpdate<LifeSim[]>(K.lifeSims, (cur) => (cur || []).filter((s) => s.id !== sim.id));
  return { success: true };
}

/* ══════════════════ 人物库 ══════════════════ */

async function characters(): Promise<LocalCharacter[]> {
  return kvGet<LocalCharacter[]>(K.characters, []);
}

async function saveCharacters(list: LocalCharacter[]) {
  await kvSet(K.characters, list);
}

async function handleCharacterList() {
  const list = await characters();
  return {
    characters: [...list]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((c) => ({
        id: c.id,
        name: c.name,
        source: c.source,
        traits: c.traits,
        personalitySummary: c.personalitySummary,
        portraitUrl: c.portraitUrl,
        basicInfo: c.basicInfo,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        viewCount: c.viewCount,
      })),
  };
}

async function findCharacter(id: number): Promise<LocalCharacter | null> {
  return (await characters()).find((c) => c.id === id) || null;
}

async function handleCharacterGet(id: number) {
  const c = await findCharacter(id);
  if (!c) fail("人物不存在", 404);
  return {
    character: {
      ...c,
      basicInfo: safeJson(c.basicInfo, null),
      traits: safeJson(c.traits, []),
      behaviorPatterns: safeJson(c.behaviorPatterns, []),
      values: safeJson(c.values, []),
      keyEvents: safeJson(c.keyEvents, []),
      achievements: safeJson(c.achievements, []),
      confidenceScores: null,
      analysisProfile: safeJson(c.analysisProfile, null),
      buildSession: null,
    },
  };
}

async function handleCharacterDelete(id: number) {
  const list = await characters();
  if (!list.some((c) => c.id === id)) fail("人物不存在", 404);
  await saveCharacters(list.filter((c) => c.id !== id));
  return { success: true, message: "删除成功" };
}

/** 分析结果写入人物记录（新字段 + 旧字段同时写） */
function applyProfile(c: LocalCharacter, profile: AnalysisProfile): LocalCharacter {
  return {
    ...c,
    analysisProfile: JSON.stringify(profile),
    traits: JSON.stringify(toLegacyTraits(profile)),
    personalitySummary: toSummary(profile),
    behaviorPatterns: JSON.stringify(toLegacyBehaviorPatterns(profile)),
    values: JSON.stringify(toLegacyValues(profile)),
    keyEvents: JSON.stringify(profile.keyEvents || []),
    achievements: JSON.stringify(profile.achievements || []),
    updatedAt: now(),
  };
}

async function handleAnalyze(b: any) {
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) fail("请输入人物姓名");

  const cfg = await getAIConfig();
  const base: LocalCharacter = {
    id: 0,
    name,
    source: "WEB",
    basicInfo: JSON.stringify({ name, hint: b.hint || null }),
    traits: null,
    personalitySummary: null,
    behaviorPatterns: null,
    values: null,
    keyEvents: null,
    achievements: null,
    analysisProfile: null,
    portraitUrl: null,
    viewCount: 0,
    createdAt: now(),
    updatedAt: now(),
  };

  // 先落库：分析失败也能在人物库里重试
  const list = await kvUpdate<LocalCharacter[]>(K.characters, (cur) => {
    const arr = cur || [];
    base.id = nextId(arr);
    return [...arr, base];
  });
  const created = list.find((c) => c.id === base.id)!;

  const profile = await analyzePublicFigure(
    name,
    cfg,
    typeof b.hint === "string" ? b.hint : undefined
  );

  const updated = applyProfile(created, profile);
  await saveCharacters(list.map((c) => (c.id === updated.id ? updated : c)));

  return sse({
    characterId: updated.id,
    isAnalyzed: profile.meta.isAnalyzed,
    aiConfigured: Boolean(cfg),
    sufficiency: profile.meta.sufficiency,
    unknowns: profile.meta.unknowns,
  });
}

async function handleBuild(b: any) {
  const cfg = await getAIConfig();
  const list = await characters();

  // 追加一轮观察
  if (b.characterId) {
    const c = list.find((x) => x.id === Number(b.characterId));
    if (!c) fail("人物不存在", 404);

    const description = String(b.description || "").trim();
    if (!description) fail("请描述这一轮的观察");

    // analyzePerson(name, descriptions[], relationship?, scene?, config?)
    const profile = await analyzePerson(b.name || c.name, [description], undefined, undefined, cfg);

    const updated = applyProfile(c, profile);
    await saveCharacters(list.map((x) => (x.id === updated.id ? updated : x)));

    return {
      characterId: updated.id,
      roundNumber: 1,
      isComplete: profile.meta.isAnalyzed,
      aiConfigured: Boolean(cfg),
      sufficiency: profile.meta.sufficiency,
      measuredDimensions: profile.traits.filter((t) => t.score !== null).length,
      totalDimensions: profile.traits.length || 9,
      unknowns: profile.meta.unknowns,
      traits: toLegacyTraits(profile),
      summary: toSummary(profile),
      behaviorPatterns: toLegacyBehaviorPatterns(profile),
      values: toLegacyValues(profile),
      buildSession: null,
    };
  }

  // 新建
  const name = String(b.name || "").trim();
  if (!name) fail("请填写人物姓名");

  const draft =
    [b.relationship && `关系：${b.relationship}`, b.scene && `场景：${b.scene}`, b.description]
      .filter(Boolean)
      .join("\n") || "暂无描述";

  const profile = await analyzePerson(
    name,
    [draft],
    b.relationship || undefined,
    b.scene || undefined,
    cfg
  );

  const c: LocalCharacter = applyProfile(
    {
      id: nextId(list),
      name,
      source: "USER_BUILT",
      basicInfo: JSON.stringify({
        name,
        relationship: b.relationship || null,
        scene: b.scene || null,
      }),
      traits: null,
      personalitySummary: null,
      behaviorPatterns: null,
      values: null,
      keyEvents: null,
      achievements: null,
      analysisProfile: null,
      portraitUrl: null,
      viewCount: 0,
      createdAt: now(),
      updatedAt: now(),
    },
    profile
  );

  await saveCharacters([...list, c]);

  return {
    characterId: c.id,
    roundNumber: 1,
    isComplete: profile.meta.isAnalyzed,
    aiConfigured: Boolean(cfg),
    sufficiency: profile.meta.sufficiency,
    measuredDimensions: profile.traits.filter((t) => t.score !== null).length,
    totalDimensions: profile.traits.length || 9,
    unknowns: profile.meta.unknowns,
    traits: toLegacyTraits(profile),
    summary: toSummary(profile),
    behaviorPatterns: toLegacyBehaviorPatterns(profile),
    values: toLegacyValues(profile),
    buildSession: null,
  };
}

async function handleRead(id: number, b: any) {
  const c = await findCharacter(id);
  if (!c) fail("人物不存在", 404);
  const situation = String(b.situation || "").trim();
  if (!situation) fail("请描述具体情境");

  const cfg = await getAIConfig();
  const profile = safeJson<AnalysisProfile | null>(c.analysisProfile, null);
  if (!profile) fail("该人物还没有完成研判");

  const result = await readIntent(profile, situation, cfg);
  if (!result) fail("分析失败，请检查 AI 配置", 503);
  return result;
}

async function handlePortrait(b: any) {
  const c = await findCharacter(Number(b.characterId));
  if (!c) fail("人物不存在", 404);

  if (!b.force && c.portraitUrl && !c.portraitUrl.includes("dicebear.com")) {
    return { portraitUrl: c.portraitUrl, cached: true };
  }

  const profile = safeJson<AnalysisProfile | null>(c.analysisProfile, null);
  const basicInfo = safeJson<any>(c.basicInfo, {});

  const result = await generatePortrait(
    c.name,
    c.personalitySummary || "",
    safeJson<any[]>(c.traits, []),
    safeJson<any[]>(c.behaviorPatterns, []),
    safeJson<any[]>(c.values, []),
    await getAIConfig(),
    {
      domain: profile?.meta?.domain || null,
      source: c.source,
      hint: basicInfo?.hint || null,
    }
  );

  if (result.error) fail(result.error, 502);

  const list = await characters();
  await saveCharacters(
    list.map((x) => (x.id === c.id ? { ...x, portraitUrl: result.url, updatedAt: now() } : x))
  );

  return { portraitUrl: result.url, cached: false };
}

/* ══════════════════ 模拟对话 ══════════════════ */

async function sessions(): Promise<LocalSession[]> {
  return kvGet<LocalSession[]>(K.sessions, []);
}

async function handleSimulate(b: any) {
  const characterId = Number(b.characterId);
  if (!characterId || !b.userAction) fail("参数不完整");

  const c = await findCharacter(characterId);
  if (!c) fail("人物不存在", 404);

  const cfg = await getAIConfig();
  const profile =
    safeJson<AnalysisProfile | null>(c.analysisProfile, null) ||
    ({
      meta: { sources: [], sufficiency: 0, unknowns: ["该人物尚未完成研判"], isAnalyzed: false, modelVersion: "", generatedAt: now() },
      traits: [],
      motivation: { needs: [], values: [], avoidanceGoals: [] },
      regulation: { defenses: [], attributionStyle: "", emotionRegulation: [], stressCoping: "" },
      relational: {
        attachment: { anxiety: null, avoidance: null, style: "", confidence: 0, reasoning: "" },
        interpersonal: { dominance: null, affiliation: null, note: "" },
        underThreat: "",
        repeatingPattern: "",
      },
      narrative: { coreBeliefs: [], identityConflict: "", selfStory: "", blindSpots: [] },
      formulation: { coreThesis: "", coreConflict: "", triggers: [], viciousCycle: "", developmentalHypothesis: "" },
      hypotheses: [],
      predictions: [],
      guidance: { effective: [], counterproductive: [], whatTheyWant: "", whatTheyFear: "" },
    } as AnalysisProfile);

  const list = await sessions();
  let session =
    (b.sessionId && list.find((s) => s.id === Number(b.sessionId))) ||
    [...list]
      .filter((s) => s.characterId === characterId && !s.isArchived)
      .sort((a, z) => z.createdAt.localeCompare(a.createdAt))[0] ||
    null;

  let all = list;
  if (!session) {
    session = {
      id: nextId(list),
      characterId,
      sessionTitle: `与${c.name}的模拟对话`,
      sessionType: String(b.mode || "dialogue").toUpperCase(),
      messages: "[]",
      settings: JSON.stringify({ mode: b.mode || "dialogue" }),
      isArchived: false,
      createdAt: now(),
      updatedAt: now(),
    };
    all = [...list, session];
  }

  const history = safeJson<any[]>(session.messages, [])
    .map((x: any) => ({
      role: x.role as "user" | "assistant",
      content:
        typeof x.content === "string"
          ? x.content
          : x.content?.simulatedResponse || x.content?.response || "",
    }))
    .filter((x: any) => x.content);

  const result = await simulateDialogue(
    profile,
    String(b.userAction),
    history,
    b.mode === "analysis" ? "analysis" : "dialogue",
    cfg
  );

  if (!result) fail(cfg ? "模拟失败，请稍后重试" : "未配置 AI 服务，模拟对话不可用", 503);

  const assistant = {
    role: "assistant",
    content: {
      simulatedResponse: result.response,
      reactions: result.reactions,
      psychologicalAnalysis: result.mechanism,
      intentionInference: result.intention,
      adviceGiven: result.advice,
      trigger: result.trigger,
      timestamp: now(),
    },
  };

  const persisted = [
    ...safeJson<any[]>(session.messages, []),
    { role: "user", content: String(b.userAction), timestamp: now() },
    assistant,
  ];

  const updatedSession: LocalSession = {
    ...session,
    messages: JSON.stringify(persisted),
    updatedAt: now(),
  };
  await kvSet(
    K.sessions,
    all.map((s) => (s.id === updatedSession.id ? updatedSession : s))
  );

  return sse({
    sessionId: updatedSession.id,
    sessionTitle: updatedSession.sessionTitle,
    ...assistant.content,
  });
}

async function handleHistory(characterId: string | null) {
  const list = await sessions();
  const filtered = characterId
    ? list.filter((s) => s.characterId === Number(characterId))
    : list;

  return {
    sessions: [...filtered]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((s) => ({
        ...s,
        messages: safeJson<any[]>(s.messages, []),
        feedbacks: [],
      })),
  };
}

async function handleSessionGet(id: number) {
  const s = (await sessions()).find((x) => x.id === id);
  if (!s) fail("会话不存在", 404);
  return {
    session: {
      id: s.id,
      characterId: s.characterId,
      sessionTitle: s.sessionTitle,
      sessionType: s.sessionType,
      messages: safeJson<any[]>(s.messages, []),
      isArchived: s.isArchived,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    },
  };
}

async function handleSessionArchive(id: number) {
  const list = await sessions();
  if (!list.some((s) => s.id === id)) fail("无权操作", 403);
  await kvSet(
    K.sessions,
    list.map((s) => (s.id === id ? { ...s, isArchived: true } : s))
  );
  return { success: true };
}

async function handleSessionDelete(id: number) {
  const list = await sessions();
  if (!list.some((s) => s.id === id)) fail("无权删除", 403);
  await kvSet(K.sessions, list.filter((s) => s.id !== id));
  return { success: true };
}

async function handleCounterfactual(b: any) {
  const c = await findCharacter(Number(b.characterId));
  if (!c) fail("人物不存在", 404);
  const profile = safeJson<AnalysisProfile | null>(c.analysisProfile, null);
  if (!profile) fail("该人物还没有完成研判");

  const result = await runCounterfactual(
    profile,
    String(b.situation || ""),
    String(b.differentAction || ""),
    await getAIConfig()
  );
  if (!result) fail("推演失败，请检查 AI 配置", 503);
  return result;
}

/* ══════════════════ 头像 / 视频 ══════════════════ */

async function handleSelfAvatar(b: any) {
  const dataUrl = String(b.dataUrl || "");
  if (!dataUrl.startsWith("data:image/")) fail("图片格式不支持");
  // 本地存 base64，限制 2MB，避免把数据库撑爆
  if (dataUrl.length > 2.8 * 1024 * 1024) fail("图片太大，请换一张小于 2MB 的");

  await kvSet(K.selfAvatar, dataUrl);
  const user = await kvUpdate<LocalUser>(K.user, (cur) => ({
    ...(cur || { id: 1, username: "我", email: null, createdAt: now() }),
    avatar: dataUrl,
  }));
  return { avatarUrl: dataUrl, user };
}

/**
 * 视频：单机版直接把任务发给服务商并等结果。
 * 没有服务端 ffmpeg，长视频无法分段拼接，因此只生成单个片段。
 */
async function handleVideo(b: any) {
  const cfg = await getAIConfig();
  if (!cfg) fail("未配置 AI 服务，请先到「我的 → AI 引擎」填写密钥", 503);

  const prompt = String(b.prompt || "").trim();
  if (!prompt) fail("请填写视频描述");

  const seconds = Math.max(4, Math.min(12, Number(b.duration) || 5));
  const images = [b.characterImageUrl, b.imageUrl].filter(
    (u: unknown): u is string => typeof u === "string" && /^https?:\/\//.test(u)
  );

  const task = await createVideoTask(prompt, {
    seconds,
    images,
    config: cfg,
  });

  if (!task?.taskId) fail("视频任务创建失败", 502);

  const url = await waitForVideo(task.taskId, 300000, cfg);
  return { videoUrl: url, stitched: false, segments: 1, seconds };
}

/* ══════════════════ 导出 ══════════════════ */

export async function exportAll() {
  const [user, entries, profile, characters_, sessions_, sims_] = await Promise.all([
    getUser(),
    memoryEntries(),
    kvGet<AnalysisProfile | null>(K.selfProfile, null),
    characters(),
    sessions(),
    sims(),
  ]);

  return {
    exportedAt: now(),
    version: "offline-1",
    user,
    knowledge: entries,
    selfProfile: profile,
    characters: characters_,
    sessions: sessions_.map((s) => ({ ...s, messages: safeJson<any[]>(s.messages, []) })),
    lifeSims: sims_,
  };
}
