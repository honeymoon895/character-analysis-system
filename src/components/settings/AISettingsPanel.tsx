"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { httpGet, httpPost } from "@/lib/http";
import { cleanSecret, readClipboard } from "@/lib/clipboard";

/**
 * AI 引擎设置
 *
 * 为什么让用户自带 key：部署者的额度有限，而分析质量直接取决于用户选择的模型。
 * 用户填自己的 key，既省钱又能选到更强/更便宜的模型。
 *
 * 安全：密钥只写不读，保存前先做一次最小连通性测试，
 * 避免"看起来存上了其实用不了"。
 */

interface Provider {
  id: string;
  name: string;
  endpoint: string;
  models: string[];
  consoleUrl: string;
  note?: string;
}

interface Current {
  provider: string | null;
  model: string;
  baseUrl: string;
  imageModel?: string;
  videoModel?: string;
  imageUrl?: string;
  videoUrl?: string;
  hasKey: boolean;
  keyHint: string;
}

export function AISettingsPanel() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [current, setCurrent] = useState<Current | null>(null);
  const [envAvailable, setEnvAvailable] = useState(false);
  const [usingEnv, setUsingEnv] = useState(false);
  const [media, setMedia] = useState<{
    image: boolean;
    video: boolean;
    note: string;
  } | null>(null);

  const [providerId, setProviderId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  // 高级设置：图像 / 视频模型与端点，默认折叠
  const [advanced, setAdvanced] = useState(false);
  const [imageModel, setImageModel] = useState("");
  const [videoModel, setVideoModel] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await httpGet<any>("/api/user/ai-settings");
      setProviders(res.providers || []);
      setCurrent(res.current || null);
      setEnvAvailable(Boolean(res.envAvailable));
      setUsingEnv(Boolean(res.usingEnv));
      if (res.mediaSupport) setMedia(res.mediaSupport);

      const p = res.current?.provider;
      if (p && p !== "env") {
        setProviderId(p);
        setModel(res.current.model || "");
        setBaseUrl(res.current.baseUrl || "");
        setImageModel(res.current.imageModel || "");
        setVideoModel(res.current.videoModel || "");
        setImageUrl(res.current.imageUrl || "");
        setVideoUrl(res.current.videoUrl || "");
      }
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = providers.find((p) => p.id === providerId);

  function pick(id: string) {
    setProviderId(id);
    setMessage(null);
    const p = providers.find((x) => x.id === id);
    if (!p) return;
    setModel(p.models[0] || "");
    setBaseUrl(p.id === "custom" ? "" : p.endpoint);
  }

  async function save() {
    if (!providerId || !apiKey.trim() || !model.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await httpPost<any>("/api/user/ai-settings", {
        provider: providerId,
        apiKey: apiKey.trim(),
        model: model.trim(),
        baseUrl: providerId === "custom" ? baseUrl : undefined,
        // 高级设置里的媒体配置（留空即用默认）
        imageModel: imageModel.trim() || undefined,
        videoModel: videoModel.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
      });
      setCurrent(res.current);
      setUsingEnv(false);
      setApiKey("");
      setMessage({ ok: true, text: "已保存，连接测试通过" });
    } catch (e: any) {
      setMessage({ ok: false, text: e.message || "保存失败" });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm("清除你自己的 key，改用服务端提供的模型？")) return;
    try {
      await httpPost("/api/user/ai-settings", { action: "reset" });
      setProviderId("");
      setApiKey("");
      setModel("");
      setBaseUrl("");
      setCurrent(null);
      setUsingEnv(envAvailable);
      setMessage({ ok: true, text: "已清除" });
    } catch (e: any) {
      setMessage({ ok: false, text: e.message });
    }
  }

  return (
    <div className="space-y-4">
      {/* 当前状态 */}
      <div className="surface-raised p-5">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background:
                current?.hasKey || envAvailable ? "#5ef0e0" : "#fb7185",
              boxShadow:
                current?.hasKey || envAvailable
                  ? "0 0 10px #5ef0e0"
                  : "0 0 10px #fb7185",
            }}
          />
          <span className="text-[11px] tracking-[0.16em] uppercase text-bone-400">
            当前引擎
          </span>
        </div>

        {current?.hasKey ? (
          <>
            <div className="font-display text-[18px] text-bone-50">
              {providers.find((p) => p.id === current.provider)?.name ||
                current.provider}
              <span className="text-bone-500 text-[14px] font-normal ml-2">
                {current.model}
              </span>
            </div>
            <p className="text-[11.5px] text-bone-500 mt-1">
              使用你自己的密钥 · {current.keyHint}
            </p>
          </>
        ) : usingEnv ? (
          <>
            <div className="font-display text-[18px] text-bone-50">
              服务端默认模型
            </div>
            <p className="text-[11.5px] text-bone-500 mt-1">
              你也可以填入自己的密钥，选用更强或更便宜的模型
            </p>
          </>
        ) : (
          <>
            <div className="font-display text-[18px] text-rose">
              尚未配置
            </div>
            <p className="text-[11.5px] text-bone-500 mt-1 leading-relaxed">
              分析、对话等功能需要 AI 服务。填入任意兼容 OpenAI 格式的密钥即可启用。
            </p>
          </>
        )}
      </div>

      {/* 图像 / 视频能力提示 —— 用户最容易在这里被误导 */}
      {media && (
        <div className="surface p-4">
          <div className="text-[11px] tracking-[0.16em] uppercase text-bone-500 mb-2.5">
            额外能力
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className={`chip ${media.image ? "chip-jade" : ""}`}>
              {media.image ? "✓" : "×"} 生成画像
            </span>
            <span className={`chip ${media.video ? "chip-jade" : ""}`}>
              {media.video ? "✓" : "×"} 生成视频
            </span>
          </div>
          <p className="text-[11.5px] text-bone-500 leading-relaxed mt-2.5">
            {media.note}
          </p>
          {!media.image && !media.video && (
            <p className="text-[11.5px] text-amber/80 leading-relaxed mt-1.5">
              文字分析、对话、人格研判不受影响，只是无法出图出视频。
            </p>
          )}
        </div>
      )}

      {/* 选择服务商 */}
      <div className="surface p-5">
        <div className="text-[13px] text-bone-200 mb-3">选择服务商</div>
        <div className="grid grid-cols-2 gap-2">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => pick(p.id)}
              className={`p-3 rounded-2xl border text-left transition-all press ${
                providerId === p.id
                  ? "border-[rgba(94,240,224,0.45)]"
                  : "border-[var(--border-1)] hover:border-white/[0.14]"
              }`}
              style={
                providerId === p.id
                  ? {
                      background:
                        "linear-gradient(140deg, rgba(94,240,224,0.12), rgba(139,92,246,0.06))",
                    }
                  : undefined
              }
            >
              <div className="text-[13px] text-bone-50">{p.name}</div>
              {p.note && (
                <div className="text-[10.5px] text-bone-500 mt-0.5 leading-snug">
                  {p.note}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 填写配置 */}
      {selected && (
        <div className="surface p-5 rise">
          {selected.id === "custom" && (
            <div className="mb-3">
              <label className="block text-[11.5px] text-bone-400 mb-2">
                接口地址
              </label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1/chat/completions"
                className="field"
                autoComplete="off"
              />
            </div>
          )}

          <div className="mb-3">
            <label className="block text-[11.5px] text-bone-400 mb-2">
              API Key
            </label>
            <KeyInput
              value={apiKey}
              onChange={setApiKey}
              placeholder={current?.hasKey ? "重新填写以覆盖" : "sk-..."}
            />
            {selected.consoleUrl && (
              <a
                href={selected.consoleUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-[11px] text-[#5ef0e0]/85 mt-2"
              >
                去 {selected.name} 获取密钥 →
              </a>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-[11.5px] text-bone-400 mb-2">
              模型
            </label>
            {selected.models.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selected.models.map((m) => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className={`chip transition-colors ${
                      model === m ? "chip-amber" : ""
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            ) : (
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="模型名称"
                className="field"
                autoComplete="off"
              />
            )}
          </div>

          {/* ── 高级设置：图像 / 视频模型分开配置 ── */}
          <button
            onClick={() => setAdvanced((v) => !v)}
            className="w-full flex items-center justify-between py-2.5 mt-1 mb-1 text-[12px] text-bone-400"
            aria-expanded={advanced}
          >
            <span className="flex items-center gap-1.5">
              高级设置
              <span className="text-[10.5px] text-bone-600">
                图像 / 视频模型
              </span>
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className={`transition-transform ${advanced ? "rotate-180" : ""}`}
            >
              <path
                d="m6 9 6 6 6-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {advanced && (
            <div className="rise space-y-3 mb-4 pt-1 pb-3 border-t border-[var(--hairline)]">
              <p className="text-[11px] text-bone-600 leading-relaxed pt-3">
                对话、图像、视频通常由不同模型负责。留空则使用对应服务商的默认模型。
              </p>

              <div>
                <label className="block text-[11.5px] text-bone-400 mb-1.5">
                  图像模型
                </label>
                <input
                  value={imageModel}
                  onChange={(e) => setImageModel(e.target.value)}
                  placeholder="如 agnes-image-2.1-flash"
                  className="field"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-[11.5px] text-bone-400 mb-1.5">
                  图像接口地址
                  <span className="text-bone-600"> （可选）</span>
                </label>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="留空则由对话端点自动推导"
                  className="field"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-[11.5px] text-bone-400 mb-1.5">
                  视频模型
                </label>
                <input
                  value={videoModel}
                  onChange={(e) => setVideoModel(e.target.value)}
                  placeholder="如 agnes-video-v2.0"
                  className="field"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-[11.5px] text-bone-400 mb-1.5">
                  视频接口地址
                  <span className="text-bone-600"> （可选）</span>
                </label>
                <input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="留空则使用服务商默认路径"
                  className="field"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          <button
            onClick={save}
            disabled={saving || !apiKey.trim() || !model.trim()}
            className="btn-primary w-full"
          >
            {saving ? "测试连接中……" : "保存并测试"}
          </button>

          {message && (
            <p
              className={`text-[12px] mt-3 leading-relaxed ${
                message.ok ? "text-[#5ef0e0]" : "text-rose"
              }`}
            >
              {message.text}
            </p>
          )}
        </div>
      )}

      {(current?.hasKey || usingEnv) && (
        <button onClick={reset} className="btn-ghost w-full text-[13px] text-bone-400">
          {(current?.hasKey ? "清除我的密钥" : "改用服务端默认")}
        </button>
      )}

      <p className="text-[11px] text-bone-600 leading-relaxed text-center">
        密钥只保存在服务端，不会下发到浏览器。连接测试会真实调用一次接口。
      </p>
    </div>
  );
}

/**
 * 密钥输入框
 *
 * 不用 type="password"：安卓上多数输入法（搜狗、百度、Gboard）遇到密码框会切到
 * 安全键盘，禁用剪贴板，长按也不出现粘贴——用户只能一个字符一个字符地敲。
 * 这里用普通文本框 + CSS 圆点遮挡，输入法照常提供粘贴；另加一个显式的「粘贴」按钮。
 */
function KeyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  const [hint, setHint] = useState("");

  async function paste() {
    setHint("");
    const text = await readClipboard();
    if (text === null) {
      setHint("无法读取剪贴板，请长按输入框选择「粘贴」");
      return;
    }
    const cleaned = cleanSecret(text);
    if (!cleaned) {
      setHint("剪贴板是空的");
      return;
    }
    onChange(cleaned);
    setHint(`已粘贴（${cleaned.length} 位）`);
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(cleanSecret(e.target.value))}
          placeholder={placeholder}
          className="field flex-1 min-w-0 font-mono"
          style={
            visible
              ? undefined
              : ({ WebkitTextSecurity: value ? "disc" : "none" } as CSSProperties)
          }
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          data-lpignore="true"
        />
        <button
          type="button"
          onClick={paste}
          className="btn-ghost shrink-0 px-3.5 text-[12.5px]"
        >
          粘贴
        </button>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="btn-ghost shrink-0 px-3 text-[12.5px]"
          aria-label={visible ? "隐藏密钥" : "显示密钥"}
          aria-pressed={visible}
        >
          {visible ? "隐藏" : "显示"}
        </button>
      </div>
      {hint && <p className="text-[11px] text-bone-500 mt-1.5">{hint}</p>}
    </div>
  );
}
