// AI 服务 - 支持多种 OpenAI 兼容 API（可切换）
// 默认使用模拟数据，设置以下环境变量后启用真实 API：
//   - AI_API_KEY       (必填，API 密钥)
//   - AI_API_URL       (可选，默认 https://apihub.agnes-ai.com/v1/chat/completions)
//   - AI_MODEL         (可选，默认 agnes-2.0-flash)

// 兼容示例：
//   Agnes:     AI_API_URL=https://apihub.agnes-ai.com/v1/chat/completions  AI_MODEL=agnes-2.0-flash
//   DeepSeek:  AI_API_URL=https://api.deepseek.com/v1/chat/completions     AI_MODEL=deepseek-chat
//   OpenAI:    AI_API_URL=https://api.openai.com/v1/chat/completions       AI_MODEL=gpt-4o-mini

const AI_API_KEY = process.env.AI_API_KEY || process.env.AGNES_API_KEY || process.env.DEEPSEEK_API_KEY || "";
const API_URL = process.env.AI_API_URL || "https://apihub.agnes-ai.com/v1/chat/completions";
const AI_MODEL = process.env.AI_MODEL || "agnes-2.0-flash";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callAI(messages: Message[], stream = false): Promise<string> {
  if (!AI_API_KEY) {
    return getMockResponse(messages);
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        stream,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    if (stream) {
      // 流式响应处理
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");
      let result = "";
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            result += parsed.choices?.[0]?.delta?.content || "";
          } catch {}
        }
      }
      return result;
    } else {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    }
  } catch (error) {
    console.error("AI call failed:", error);
    return getMockResponse(messages);
  }
}

// ==================== 模拟数据 ====================
function getMockResponse(messages: Message[]): string {
  const lastMsg = messages[messages.length - 1]?.content || "";
  const allContent = messages.map((m) => m.content).join(" ");

  if (allContent.includes("九维") || allContent.includes("心理特征") || allContent.includes("评分")) {
    return JSON.stringify({
      dimensions: generateMockDimensions(lastMsg),
      summary: "这是一个综合性格分析结果。TA展现出复杂多维的性格特征，既有外向社交的一面，也有内省思考的时刻。",
      behaviorPatterns: [
        { scenario: "工作场景", description: "认真负责，注重细节" },
        { scenario: "社交场合", description: "根据熟悉程度表现不同" },
        { scenario: "压力之下", description: "可能表现出焦虑或回避" },
      ],
      values: ["诚信", "责任感", "个人成长"],
      keyEvents: [],
      contradictions: [],
    });
  }

  if (allContent.includes("模拟") || allContent.includes("反应")) {
    return JSON.stringify({
      reactions: [
        { probability: 70, description: "会认真倾听并给出理性回应" },
        { probability: 20, description: "可能需要时间思考后再回应" },
        { probability: 10, description: "可能回避或转移话题" },
      ],
      psychologicalAnalysis: "基于该人物的性格特征，TA在面对这种情况时，会优先考虑自己的感受和需求。高XX维度得分使TA倾向于理性分析而非情感回应。",
      intentionInference: "表面上TA可能表现得平静，但内心可能在评估这段关系对自己的价值。",
      adviceGiven: [
        "给予TA足够的空间和时间",
        "直接但温和地表达你的需求和感受",
        "避免在TA情绪低落时讨论敏感话题",
      ],
      simulatedResponse: "我明白你的意思。让我想想……我觉得我们可以找个时间好好聊聊这件事。",
    });
  }

  if (allContent.includes("反事实")) {
    return JSON.stringify({
      analysis: "如果当时没有采取那个行动，大概率结果会不同。基于TA的性格特征，原行动触发了TA的防御机制，而替代方案可能避开了这一点。",
      probability: 70,
    });
  }

  if (allContent.includes("内耗") || allContent.includes("缓解")) {
    return JSON.stringify({
      tips: [
        "TA这样反应不一定是你做错了什么，这与TA的性格特质有关",
        "根据分析，TA对冲突的容忍度较低，建议以更温和的方式沟通",
        "你已经在努力理解了，这本身就值得肯定",
      ],
      actionAdvice: {
        do: [
          "小事寻求TA的意见，满足TA的被尊重需求",
          "给TA独处空间，TA的内向特质需要",
        ],
        dont: [
          "避免公开批评，TA的敏感性较高",
          "不要在TA压力大时提出新要求",
        ],
      },
      perspectiveTaking: "如果我是TA，此刻我可能感到有些压力，既想回应你的期待，又需要时间整理自己的感受。我最在意的是被理解和被尊重，而不是被评判。",
    });
  }

  return "好的，已收到您的请求。基于已有信息进行分析……";
}

function generateMockDimensions(name: string) {
  // 基于输入名称生成一些有变化的模拟数据
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const seed = (n: number) => ((hash * (n + 1) * 7) % 100);

  return [
    { code: "OPENNESS", name: "开放性", score: seed(1), confidence: 75, evidence: ["基于公开信息和用户描述的综合判断"] },
    { code: "CONSCIENTIOUSNESS", name: "尽责性", score: seed(2), confidence: 70, evidence: ["从行为模式中推断"] },
    { code: "EXTRAVERSION", name: "外向性", score: seed(3), confidence: 80, evidence: ["社交表现分析"] },
    { code: "AGREEABLENESS", name: "宜人性", score: seed(4), confidence: 65, evidence: ["人际互动观察"] },
    { code: "NEUROTICISM", name: "情绪稳定性", score: seed(5), confidence: 70, evidence: ["情绪反应模式分析"] },
    { code: "DECISIVENESS", name: "决断力", score: seed(6), confidence: 60, evidence: ["决策行为推断"] },
    { code: "RISK_TENDENCY", name: "风险偏好", score: seed(7), confidence: 55, evidence: ["风险选择分析"] },
    { code: "EMPATHY", name: "共情能力", score: seed(8), confidence: 65, evidence: ["情感回应模式"] },
    { code: "LEADERSHIP", name: "领导力", score: seed(9), confidence: 60, evidence: ["组织行为推断"] },
  ];
}

// ==================== 公开 API ====================

export async function analyzeCharacter(name: string, source: "web" | "user", descriptions?: string[]): Promise<string> {
  let prompt = "";
  if (source === "web") {
    prompt = `你是一个专业的心理学人格分析师。请分析公众人物"${name}"的性格特征。

请以JSON格式输出以下内容：
1. dimensions：九维心理特征评分（每个维度包含 code, name, score(0-100), confidence(0-100), evidence[]）
   - OPENNESS（开放性）, CONSCIENTIOUSNESS（尽责性）, EXTRAVERSION（外向性）
   - AGREEABLENESS（宜人性）, NEUROTICISM（情绪稳定性）
   - DECISIVENESS（决断力）, RISK_TENDENCY（风险偏好）
   - EMPATHY（共情能力）, LEADERSHIP（领导力）
2. summary：一句话性格总结
3. behaviorPatterns：行为模式数组 [{scenario, description}]
4. values：核心价值观数组
5. contradictions：性格矛盾点数组

请确保分析客观、基于已知事实。`;
  } else {
    const descText = descriptions?.join("\n") || "";
    prompt = `你是一个专业的心理学人格分析师。用户正在描述一位身边的人物，请基于以下描述分析TA的性格特征。

用户描述：
${descText}

请以JSON格式输出以下内容：
1. dimensions：九维心理特征评分（每个维度包含 code, name, score(0-100), confidence(0-100), evidence[]）
   九维度：OPENNESS, CONSCIENTIOUSNESS, EXTRAVERSION, AGREEABLENESS, NEUROTICISM, DECISIVENESS, RISK_TENDENCY, EMPATHY, LEADERSHIP
2. summary：一句话性格总结
3. behaviorPatterns：行为模式数组 [{scenario, description}]
4. values：核心价值观数组
5. contradictions：性格矛盾点数组

请确保分析基于描述文本，不要过度推断。如果信息不足，请在confidence中体现。`;
  }

  const messages: Message[] = [
    { role: "system", content: "你是一个专业的心理学人格分析师，擅长基于大五人格模型进行性格分析。请始终以JSON格式输出。" },
    { role: "user", content: prompt },
  ];

  return callAI(messages, false);
}

export async function simulateReaction(
  characterTraits: any,
  userAction: string,
  mode: "analysis" | "dialogue" | "preview"
): Promise<string> {
  const traitsStr = JSON.stringify(characterTraits, null, 2);
  const modeDesc = {
    analysis: "以心理学专家视角，理性分析该人物的心理状态和行为动机",
    dialogue: "直接以该人物的语气、思维方式进行对话回应",
    preview: "预演该人物在给定情景下的反应，输出可能反应的概率分布",
  };

  const prompt = `基于以下人物性格特征：
${traitsStr}

用户的行为/描述：${userAction}

请以${modeDesc[mode]}的方式回应。

请以JSON格式输出：
1. reactions：可能反应与概率分布（数组，每个含 probability 和 description）
2. psychologicalAnalysis：心理机制分析
3. intentionInference：真实意图推测
4. adviceGiven：行动建议（数组）
5. simulatedResponse：模拟话语气泡（以该人物口吻）`;

  const messages: Message[] = [
    { role: "system", content: "你是一个专业的心理模拟系统，擅长基于人格特征模拟人物反应。" },
    { role: "user", content: prompt },
  ];

  return callAI(messages, false);
}

export async function counterfactualSimulation(
  characterTraits: any,
  originalAction: string,
  alternativeAction: string
): Promise<string> {
  const traitsStr = JSON.stringify(characterTraits, null, 2);

  const prompt = `基于以下人物性格特征：
${traitsStr}

原始行为：${originalAction}
替代行为：${alternativeAction}

请分析如果采取替代行为，该人物可能的反应会有何不同。

请以JSON格式输出：
1. analysis：对比分析
2. probability：替代行为下预期结果改善的概率（0-100）`;

  const messages: Message[] = [
    { role: "system", content: "你是一个专业的心理模拟系统，擅长反事实推演。" },
    { role: "user", content: prompt },
  ];

  return callAI(messages, false);
}

// ==================== 人物画像生成 ====================

const IMAGE_API_URL = process.env.AI_API_URL
  ? process.env.AI_API_URL.replace("/chat/completions", "/images/generations")
  : "https://apihub.agnes-ai.com/v1/images/generations";

const IMAGE_MODEL = process.env.AI_IMAGE_MODEL || "agnes-image-2.1-flash";

export async function generatePortrait(
  characterName: string,
  personalitySummary: string,
  traits: Array<{ code: string; name: string; score: number }>,
  behaviorPatterns?: Array<{ scenario: string; description: string }>,
  values?: string[]
): Promise<string> {
  // 构建 prompt —— 用中英文混合提示以获得最佳效果
  const topTraits = [...(traits || [])]
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((t) => `${t.name}(${t.score}分)`)
    .join("、");

  const styleDesc = buildStyleDescription(traits || []);

  const prompt = `Professional character portrait of "${characterName}". ${personalitySummary}. Personality traits: ${topTraits}. ${styleDesc}. Clean background, soft studio lighting, shot from chest up, photorealistic style, high detail facial features, 8K quality, cinematic lighting. The subject looks directly at camera with a natural expression reflecting their personality.`;

  const negativePrompt = "cartoon, anime, illustration, painting, overexposed, blurry, low quality, distorted face, extra limbs, bad anatomy";

  if (!AI_API_KEY) {
    // 无 API Key 时返回模拟数据
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(characterName)}&backgroundColor=6c63ff&textColor=ffffff`;
  }

  try {
    const response = await fetch(IMAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        size: "1024x1024",
        n: 1,
        // Agnes 2.1-flash 不支持 extra_body
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Image API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("Image API returned no URL");
    }
    return imageUrl;
  } catch (error) {
    console.error("Portrait generation failed:", error);
    // 失败时退回首字母头像
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(characterName)}&backgroundColor=6c63ff&textColor=ffffff`;
  }
}

function buildStyleDescription(traits: Array<{ code: string; name: string; score: number }>): string {
  const map: Record<string, [number, string][]> = {
    OPENNESS: [[70, "creative, artistic style, expressive eyes"]],
    CONSCIENTIOUSNESS: [[70, "neat appearance, organized look, formal"]],
    EXTRAVERSION: [[70, "confident posture, warm smile, outgoing energy"]],
    AGREEABLENESS: [[70, "gentle expression, approachable, warm eyes"]],
    NEUROTICISM: [[60, "sensitive expression, thoughtful gaze"]],
    DECISIVENESS: [[70, "strong jaw, determined look, confident"]],
    RISK_TENDENCY: [[70, "adventurous look, daring expression"]],
    EMPATHY: [[70, "compassionate eyes, kind expression"]],
    LEADERSHIP: [[70, "commanding presence, authoritative look"]],
  };

  const descriptions: string[] = [];
  for (const t of traits || []) {
    const styleMap = map[t.code];
    if (styleMap) {
      for (const [threshold, desc] of styleMap) {
        if (t.score >= threshold) {
          descriptions.push(desc);
          break;
        }
      }
    }
  }
  return descriptions.length > 0 ? descriptions.slice(0, 3).join(". ") + "." : "Neutral expression.";
}

export async function generateBurnoutRelief(
  characterTraits: any
): Promise<string> {
  const traitsStr = JSON.stringify(characterTraits, null, 2);

  const prompt = `基于以下人物性格特征：
${traitsStr}

请生成内耗缓解内容，以JSON格式输出：
1. tips：3条反内耗提示（数组）
2. actionAdvice：行动建议，包含 do（建议做的）和 dont（避免做的）
3. perspectiveTaking：以该人物视角生成一段内心独白`;

  const messages: Message[] = [
    { role: "system", content: "你是一个专业的心理疏导助手。" },
    { role: "user", content: prompt },
  ];

  return callAI(messages, false);
}
