"use client";

import { useState, useRef } from "react";
import { httpPost } from "@/lib/http";

interface BuildCharacterModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (characterId: number) => void;
}

const RELATIONSHIPS = ["同事", "朋友", "家人", "恋人", "暧昧对象", "偶像", "其他"];
const SCENES = ["工作", "私下相处", "冲突时", "开心时", "压力下", "日常"];

const TOTAL_STEPS = 5;

export function BuildCharacterModal({ visible, onClose, onComplete }: BuildCharacterModalProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [scenes, setScenes] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [loading, setLoading] = useState(false);

  // ── 第5步：导入已有数据 ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importedData, setImportedData] = useState<any>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importError, setImportError] = useState("");

  // Generate questions based on relationship + scenes
  const questionBank: Record<string, string[]> = {
    "同事": ["TA最近做了什么让你印象深刻的事？", "TA在工作中的风格是合作还是独立？", "团队遇到困难时TA通常是什么反应？"],
    "朋友": ["你们私下相处时TA是什么状态？", "TA最让你欣赏的一点是什么？", "你们之间发生过最大的分歧是什么？"],
    "家人": ["TA在家里的角色是什么？", "TA处理家庭事务的方式是什么？", "你觉得TA最在意家庭中的什么？"],
    "恋人": ["TA表达感情的方式是什么样的？", "你们之间最难忘的经历是什么？", "TA处理矛盾的方式是？"],
    "暧昧对象": ["TA让你心动的瞬间是什么？", "你感觉TA对你的态度是什么样的？", "你们之间最有默契的一件事？"],
    "偶像": ["TA最吸引你的特质是什么？", "你觉得TA背后不为人知的一面会是什么？", "TA对你产生了什么影响？"],
    "其他": ["描述一次TA让你意外或困惑的行为", "你觉得TA最在意的是什么？", "你记忆中TA最打动你的一件事是什么？"],
  };

  const defaultQuestions = ["描述一次TA让你印象深刻的行为", "你觉得TA最在意的三件事是什么？", "TA在压力下通常是什么反应？"];

  const getQuestions = () => {
    if (relationship && questionBank[relationship]) {
      return questionBank[relationship];
    }
    if (scenes.length > 0) {
      const sceneQuestions: Record<string, string[]> = {
        "工作": ["TA在工作中表现出什么样的态度？", "TA如何处理工作压力？", "TA与同事的相处模式是什么？"],
        "私下相处": ["TA私下是什么状态？", "TA放松时喜欢做什么？", "TA独处时和与人相处时有什么区别？"],
        "冲突时": ["TA在冲突中通常怎么表现？", "TA生气时会有什么反应？", "冲突后TA会主动修复关系吗？"],
        "开心时": ["TA开心时是什么样子？", "TA会怎样分享开心的事？", "什么最容易让TA开心？"],
        "压力下": ["TA在压力下会有什么反应？", "TA会向别人寻求帮助吗？", "TA的应对机制是什么？"],
        "日常": ["TA日常生活中的小习惯是什么？", "TA对待日常琐事的态度是什么？", "TA最享受的日常时刻是什么？"],
      };
      const qs: string[] = [];
      for (const s of scenes) {
        if (sceneQuestions[s]) qs.push(...sceneQuestions[s]);
      }
      return qs.slice(0, 3);
    }
    return defaultQuestions;
  };

  const questions = getQuestions();

  // ── 导入文件处理 ──
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        // 验证格式
        if (!json.version || !json.data) {
          setImportError("无效的数据库文件格式，请确认是自我认知导出的 JSON 文件");
          return;
        }
        if (json.exportType !== "self-cognition") {
          setImportError("该文件不是自我认知数据，请选择正确的导出文件");
          return;
        }
        setImportedData(json);
        setImportPreview({
          username: json.username,
          summary: json.data?.selfPersonalitySummary,
          traits: json.data?.selfTraits,
          diaryCount: json.data?.selfDiary?.length || 0,
          values: json.data?.selfValues,
        });
      } catch {
        setImportError("文件解析失败，请选择有效的 JSON 文件");
      }
    };
    reader.readAsText(file);
  };

  const handleRemoveImport = () => {
    setImportedData(null);
    setImportPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const description = `关系：${relationship}。场景：${scenes.join("、")}。\n${questions.map((q, i) => `Q: ${q}\nA: ${answers[i]}`).join("\n")}`;
      const body: any = {
        name,
        relationship,
        scene: scenes.join(","),
        description,
      };
      // 如果有导入数据，一并发送
      if (importedData?.data) {
        body.importedData = importedData.data;
      }
      const result = await httpPost("/api/character/build", body);
      onComplete(result.characterId);
    } catch (err: any) {
      alert(err.message || "提交失败");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setName("");
    setRelationship("");
    setScenes([]);
    setAnswers(["", "", ""]);
    setImportedData(null);
    setImportPreview(null);
    setImportError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-gray-900">✍️ 自定义人物构建</h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
              <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? "bg-[#6c63ff]" : "bg-gray-200"}`} />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1 text-center">第 {step} 步，共 {TOTAL_STEPS} 步</p>
        </div>

        <div className="p-6">
          {/* Step 1: Name */}
          {step === 1 && (
            <div className="animate-fade-in-up">
              <label className="block text-lg font-medium text-gray-800 mb-4">
                请输入你想分析的人怎么称呼？
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入代号或真名..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/20 outline-none transition-all text-lg"
                autoFocus
              />
            </div>
          )}

          {/* Step 2: Relationship */}
          {step === 2 && (
            <div className="animate-fade-in-up">
              <label className="block text-lg font-medium text-gray-800 mb-4">
                TA和你的关系是？
              </label>
              <div className="grid grid-cols-2 gap-3">
                {RELATIONSHIPS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRelationship(r)}
                    className={`px-4 py-3 rounded-xl border-2 text-center transition-all ${
                      relationship === r
                        ? "border-[#6c63ff] bg-[#6c63ff]/5 text-[#6c63ff] font-medium"
                        : "border-gray-100 hover:border-gray-200 text-gray-600"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Scenes */}
          {step === 3 && (
            <div className="animate-fade-in-up">
              <label className="block text-lg font-medium text-gray-800 mb-4">
                你通常在什么场景下和TA相处？（可多选）
              </label>
              <div className="flex flex-wrap gap-3">
                {SCENES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setScenes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}
                    className={`px-4 py-2.5 rounded-xl border-2 transition-all ${
                      scenes.includes(s)
                        ? "border-[#6c63ff] bg-[#6c63ff]/5 text-[#6c63ff] font-medium"
                        : "border-gray-100 hover:border-gray-200 text-gray-600"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Questions */}
          {step === 4 && (
            <div className="animate-fade-in-up space-y-5">
              <p className="text-lg font-medium text-gray-800">请回答几个问题，帮助AI更好地了解TA</p>
              {questions.map((q, i) => (
                <div key={i}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{q}</label>
                  <textarea
                    value={answers[i]}
                    onChange={(e) => setAnswers((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
                    placeholder="请描述你的观察..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#6c63ff] focus:ring-2 focus:ring-[#6c63ff]/20 outline-none transition-all resize-none"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Step 5: Import database (optional) */}
          {step === 5 && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-2">
                <div className="text-3xl mb-2">📦</div>
                <h3 className="text-lg font-medium text-gray-800 mb-1">导入他人已有的认知数据</h3>
                <p className="text-sm text-gray-400">
                  如果 TA 本人或其他人已导出了自我认知档案，你可以导入它，<br />
                  让构建的人物整合他人对 TA 的印象，更立体全面。
                </p>
              </div>

              {/* 文件上传 */}
              {!importPreview && (
                <div className="mt-6">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-[#6c63ff]/40 hover:bg-[#6c63ff]/5 transition-all"
                  >
                    <div className="text-4xl mb-2">📁</div>
                    <p className="text-sm text-gray-500">点击选择导出的 JSON 文件</p>
                    <p className="text-xs text-gray-400 mt-1">
                      支持从"自我认知"页面导出的 .json 文件
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {importError && (
                    <p className="text-sm text-red-500 mt-2 text-center">{importError}</p>
                  )}
                </div>
              )}

              {/* 导入预览 */}
              {importPreview && (
                <div className="mt-6 bg-gradient-to-br from-[#f0edff] to-[#faf9ff] rounded-xl p-5 border border-[#6c63ff]/10">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-[#6c63ff]">📋 导入预览</h4>
                    <button
                      onClick={handleRemoveImport}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      移除
                    </button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-400">来源：</span><span className="text-gray-700 font-medium">{importPreview.username}</span></p>
                    {importPreview.summary && (
                      <p><span className="text-gray-400">性格总结：</span><span className="text-gray-600">{importPreview.summary}</span></p>
                    )}
                    {importPreview.traits && importPreview.traits.length > 0 && (
                      <div>
                        <span className="text-gray-400">特征评分：</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {importPreview.traits.slice(0, 5).map((t: any, i: number) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-white border border-[#6c63ff]/20 text-gray-600">
                              {t.name}: {t.score}
                            </span>
                          ))}
                          {importPreview.traits.length > 5 && (
                            <span className="text-xs text-gray-400">+{importPreview.traits.length - 5} 项</span>
                          )}
                        </div>
                      </div>
                    )}
                    {importPreview.values && importPreview.values.length > 0 && (
                      <p><span className="text-gray-400">价值观：</span><span className="text-gray-600">{importPreview.values.join("、")}</span></p>
                    )}
                    {importPreview.diaryCount > 0 && (
                      <p><span className="text-gray-400">日记条目：</span><span className="text-gray-600">{importPreview.diaryCount} 条</span></p>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#6c63ff]/10">
                    <p className="text-xs text-gray-400">
                      ✅ 数据已加载，提交后 AI 会将其作为参考，整合到对目标人物的分析中
                    </p>
                  </div>
                </div>
              )}

              {/* 跳过说明 */}
              {!importPreview && (
                <p className="text-xs text-gray-400 text-center mt-4">
                  如果没有数据，可以直接点击"开始分析"跳过此步骤
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
            >
              上一步
            </button>
          ) : (
            <div />
          )}
          {step < TOTAL_STEPS ? (
            <button
              onClick={() => {
                if (step === 1 && !name.trim()) { alert("请输入称呼"); return; }
                if (step === 2 && !relationship) { alert("请选择关系"); return; }
                if (step === 3 && scenes.length === 0) { alert("请至少选择一个场景"); return; }
                setStep(step + 1);
              }}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white font-medium hover:shadow-lg transition-all"
            >
              {step === TOTAL_STEPS - 1 ? "下一步" : "下一步"}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || answers.some((a) => !a.trim())}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6c63ff] to-[#8b85ff] text-white font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "分析中..." : importedData ? "📦 导入数据并开始分析" : "开始分析"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
