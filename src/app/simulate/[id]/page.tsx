"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { httpPatch } from "@/lib/http";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Header } from "@/components/Header";
import { httpGet, httpPost } from "@/lib/http";

// ─── 类型定义 ───────────────────────────────────────────────
interface AiMessage {
  simulatedResponse: string;
  reactions: Array<{ probability: number; description: string }>;
  psychologicalAnalysis: string;
  intentionInference: string;
  adviceGiven: string[];
  timestamp: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string | AiMessage;
  timestamp?: string;
}

// ─── 工具函数 ───────────────────────────────────────────────
function formatTime(ts?: string): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

// 判断是否为新式数据（assistant 的 content 是完整 AiMessage 对象）
function isAiMessage(c: any): c is AiMessage {
  return typeof c === "object" && c !== null && typeof c.simulatedResponse === "string";
}

// ─── 组件 ───────────────────────────────────────────────────
export default function SimulationPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [character, setCharacter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const { user } = useAuthStore();

  // 自动滚底
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // ─ 加载角色 & 历史会话 ──────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    const init = async () => {
      try {
        // 1) 加载角色信息
        const charRes = await httpGet(`/api/character/${params.id}`);
        const char = charRes.character;
        setCharacter(char);

        // 2) 加载该角色的历史会话
        try {
          const histRes = await httpGet(`/api/simulate/history?character_id=${params.id}`);
          const sessions = histRes.sessions || [];
          if (sessions.length > 0) {
            const latest = sessions[0];
            setSessionId(latest.id);
            // 将 messages 转型为标准格式（兼容新旧两种存储格式）
            const loaded = (latest.messages || []).map((m: any, i: number) => {
              // 旧版数据：content 是字符串 → 保留原样
              // 新版数据：assistant 的 content 是 AiMessage 对象
              if (m.role === "assistant" && typeof m.content === "object" && m.content !== null) {
                return {
                  role: "assistant" as const,
                  content: {
                    simulatedResponse: m.content.simulatedResponse || m.content.generatedResponse || "",
                    reactions: m.content.reactions || [],
                    psychologicalAnalysis: m.content.psychologicalAnalysis || "",
                    intentionInference: m.content.intentionInference || "",
                    adviceGiven: m.content.adviceGiven || [],
                    timestamp: m.content.timestamp || m.timestamp,
                  } as AiMessage,
                  timestamp: m.timestamp,
                };
              }
              // 用户消息 / 旧版助理消息（纯文本）
              return {
                role: m.role,
                content: m.content || "",
                timestamp: m.timestamp,
              } as ChatMessage;
            });
            setMessages(loaded);
          }
        } catch {
          // 没有历史会话也无所谓，空白开始
        }
      } catch {
        router.push("/");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // ─ 发送消息 ───────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");

    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await httpPost("/api/simulate", {
        characterId: character.id,
        sessionId: sessionId,
        userAction: text,
        mode: "dialogue",
      });

      if (res instanceof Response) {
        const reader = res.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let result: any = null;
          let done = false;
          while (!done) {
            const { done: d, value } = await reader.read();
            done = d;
            if (value) {
              const chunk = decoder.decode(value);
              const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
              for (const line of lines) {
                const data = line.slice(6);
                if (data === "[DONE]") break;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.sessionId) {
                    setSessionId(parsed.sessionId);
                  }
                  result = parsed;
                } catch {}
              }
            }
          }

          if (result) {
            const aiMsg: ChatMessage = {
              role: "assistant",
              content: {
                simulatedResponse: result.simulatedResponse || "",
                reactions: result.reactions || [],
                psychologicalAnalysis: result.psychologicalAnalysis || "",
                intentionInference: result.intentionInference || "",
                adviceGiven: result.adviceGiven || [],
                timestamp: new Date().toISOString(),
              },
            };
            setMessages((prev) => [...prev, aiMsg]);
          }
        }
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  }, [input, sending, character, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─ 新对话 ─────────────────────────────────────────────
  const handleNewChat = async () => {
    // 归档当前会话
    if (sessionId) {
      try {
        await httpPatch(`/api/simulate/${sessionId}`);
      } catch {
        // 归档失败也无所谓
      }
    }
    setSessionId(null);
    setMessages([]);
  };

  // ── 加载中 ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6c63ff]" />
      </div>
    );
  }
  if (!character) return null;

  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col bg-[#ededed]" style={{ height: "calc(100vh - 64px)" }}>
        {/* ═══════ 顶栏 — 微信风格 ═══════ */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/character/${character.id}`)}
              className="text-gray-400 hover:text-gray-600 text-lg w-8 h-8 flex items-center justify-center"
            >
              ‹
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#8b85ff] flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
              {character.portraitUrl && !character.portraitUrl.includes("dicebear.com") ? (
                <img src={character.portraitUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                character.name.charAt(0)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-gray-800 text-sm truncate">{character.name}</h1>
              <p className="text-xs text-gray-400">
                {sending ? "正在输入..." : messages.length > 0 ? "在线" : "在线"}
              </p>
            </div>
          </div>
        </div>

        {/* ═══════ 聊天区域 ═══════ */}
        <div className="flex-1 overflow-y-auto px-3 py-4" id="chat-scroll">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* ── 空状态提示 ── */}
            {messages.length === 0 && (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#6c63ff]/10 to-[#8b85ff]/10 flex items-center justify-center text-4xl">
                  💬
                </div>
                <h2 className="text-lg font-semibold text-gray-700 mb-2">
                  开始和 {character.name} 对话
                </h2>
                <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
                  输入你想说的话，TA 会根据性格特征做出回应。<br />
                  试试打个招呼吧 👋
                </p>
              </div>
            )}

            {/* ── 消息列表 ── */}
            {messages.map((msg, i) => (
              <div key={i}>
                {/* 用户消息 — 右气泡带头像 */}
                {msg.role === "user" && (
                  <div className="flex justify-end mb-2">
                    <div className="max-w-[75%] flex items-end gap-2 flex-row-reverse">
                      {/* 用户头像 */}
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#4a90d9] to-[#6cb4ee] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                        {user?.avatar ? (
                          <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>我</span>
                        )}
                      </div>
                      <div>
                        <div className="bg-[#95ec69] text-gray-800 rounded-2xl rounded-tr-sm px-3.5 py-2.5 shadow-sm break-words">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content as string}</p>
                        </div>
                        <div className="text-[10px] text-gray-300 text-right mt-0.5 px-1">
                          {formatTime(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 助手消息 — 左气泡 */}
                {msg.role === "assistant" && (
                  <div className="flex justify-start mb-2">
                    <div className="max-w-[75%] flex items-end gap-2">
                      {/* 头像 */}
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#8b85ff] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                        {character.portraitUrl && !character.portraitUrl.includes("dicebear.com") ? (
                          <img src={character.portraitUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          character.name.charAt(0)
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        {/* 对话气泡 */}
                        <div>
                          <div className="bg-white text-gray-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm border border-gray-100 break-words">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {isAiMessage(msg.content)
                                ? msg.content.simulatedResponse
                                : (msg.content as string)}
                            </p>
                          </div>
                        </div>

                        {/* 时间 + 分析按钮 */}
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-[10px] text-gray-300">
                            {formatTime(msg.timestamp || (isAiMessage(msg.content) ? msg.content.timestamp : undefined))}
                          </span>

                          {/* 展开分析按钮 */}
                          {isAiMessage(msg.content) &&
                            (msg.content.reactions?.length > 0 ||
                              msg.content.psychologicalAnalysis ||
                              msg.content.adviceGiven?.length > 0) && (
                              <button
                                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                                className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors"
                              >
                                {expandedIdx === i ? "收起分析 ▲" : "心理分析 ▼"}
                              </button>
                            )}
                        </div>

                        {/* 折叠的分析详情 */}
                        {isAiMessage(msg.content) && expandedIdx === i && (
                          <div className="mt-1 space-y-2">
                            {msg.content.reactions?.length > 0 && (
                              <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                                <p className="text-xs font-medium text-gray-400 mb-2">📊 反应概率</p>
                                {msg.content.reactions.map((r, ri) => (
                                  <div key={ri} className="flex items-center gap-2 text-xs mb-1 last:mb-0">
                                    <span className="text-[#6c63ff] font-bold w-8 text-right">{r.probability}%</span>
                                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-[#6c63ff] to-[#8b85ff]"
                                        style={{ width: `${r.probability}%` }}
                                      />
                                    </div>
                                    <span className="text-gray-500 flex-1">{r.description}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {msg.content.psychologicalAnalysis && (
                              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <p className="text-xs font-medium text-gray-400 mb-1">🧪 心理机制分析</p>
                                <p className="text-xs text-gray-600 leading-relaxed">{msg.content.psychologicalAnalysis}</p>
                              </div>
                            )}

                            {msg.content.intentionInference && (
                              <div className="bg-[#e8e6ff]/50 rounded-xl p-3 border border-[#6c63ff]/10">
                                <p className="text-xs font-medium text-[#6c63ff] mb-1">🎯 真实意图</p>
                                <p className="text-xs text-gray-600 leading-relaxed">{msg.content.intentionInference}</p>
                              </div>
                            )}

                            {msg.content.adviceGiven?.length > 0 && (
                              <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                                <p className="text-xs font-medium text-green-600 mb-1">💡 建议</p>
                                <ul className="space-y-0.5">
                                  {msg.content.adviceGiven.map((a, ai) => (
                                    <li key={ai} className="text-xs text-gray-600 flex items-start gap-1">
                                      <span>•</span> {a}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* ── 输入中指示器 ── */}
            {sending && (
              <div className="flex justify-start mb-2">
                <div className="max-w-[75%] flex items-end gap-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6c63ff] to-[#8b85ff] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {character.name.charAt(0)}
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* ═══════ 底部输入栏 — 微信风格 ═══════ */}
        <div className="bg-white border-t border-gray-200 px-3 py-3 flex-shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <button
              onClick={handleNewChat}
              title="新对话"
              className="w-9 h-9 rounded-full bg-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-200 flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`对 ${character.name} 说点什么...`}
              disabled={sending}
              className="flex-1 px-4 py-2.5 rounded-full bg-gray-100 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#6c63ff]/20 focus:bg-white transition-all"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white flex items-center justify-center hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
