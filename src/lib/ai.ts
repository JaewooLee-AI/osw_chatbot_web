import {
  EMBED_DIM,
  EMBED_MODEL,
  EMBED_TASK_QUERY,
} from "./supabase";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIError";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 남은 시간이 이보다 적으면 새로 시도하지 않는다(시작해도 끝내지 못한다).
const MIN_ATTEMPT_MS = 1500;

/**
 * 이번 시도에 쓸 시간: 호출별 상한과 요청 마감(deadline, Date.now() 기준 ms) 중 짧은 쪽.
 * 마감이 없으면 상한 그대로. 남은 시간이 너무 적으면 0.
 */
function attemptBudget(timeoutMs: number, deadline?: number): number {
  if (!deadline) return timeoutMs;
  const left = deadline - Date.now();
  return left < MIN_ATTEMPT_MS ? 0 : Math.min(timeoutMs, left);
}

async function geminiPost(
  path: string,
  key: string,
  payload: Record<string, unknown>,
  timeoutMs: number = 25000,
  deadline?: number
): Promise<Record<string, any>> {
  const url = `${GEMINI_BASE}/${path}`;
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    const budget = attemptBudget(timeoutMs, deadline);
    if (budget === 0) {
      lastError = lastError || "응답 시간 초과";
      break;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), budget);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (resp.ok) {
        return await resp.json();
      }
      const errText = await resp.text();
      lastError = `HTTP ${resp.status}: ${errText.slice(0, 300)}`;
      if (!RETRYABLE_STATUS.has(resp.status)) {
        break;
      }
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err?.name === "AbortError" ? `응답 시간 초과 (${budget}ms)` : err?.message || String(err);
    }
    const wait = 1000 * (attempt + 1);
    if (attempt === 2 || (deadline && deadline - Date.now() - wait < MIN_ATTEMPT_MS)) {
      break;
    }
    await sleep(wait);
  }

  throw new AIError(`Gemini 호출 실패 — ${lastError}`);
}

/**
 * gemini-embedding-001은 3072가 아닌 차원에서 정규화되지 않은 벡터를 반환하므로 직접 L2 정규화한다.
 */
function normalizeVector(vec: number[]): number[] {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq) || 1.0;
  return vec.map((x) => x / norm);
}

export async function embedQuery(
  text: string,
  key: string,
  deadline?: number
): Promise<number[]> {
  if (!key) {
    throw new AIError(
      "Gemini API 키가 없습니다. 관리자 앱 [AI API 키] 화면에서 먼저 등록하세요."
    );
  }
  const model = `models/${EMBED_MODEL}`;
  const data = await geminiPost(
    `${model}:batchEmbedContents`,
    key,
    {
      requests: [
        {
          model,
          content: { parts: [{ text }] },
          taskType: EMBED_TASK_QUERY,
          outputDimensionality: EMBED_DIM,
        },
      ],
    },
    20000,
    deadline
  );

  const embs = data?.embeddings || [];
  if (!embs.length) {
    throw new AIError("임베딩 응답이 비어 있습니다.");
  }
  const vec: number[] = embs[0]?.values || [];
  if (vec.length !== EMBED_DIM) {
    throw new AIError(
      `임베딩 차원이 ${EMBED_DIM}이 아닙니다 (${vec.length}).`
    );
  }
  return normalizeVector(vec);
}

export async function generateAnswer(
  provider: string,
  model: string,
  key: string,
  system: string,
  prompt: string,
  deadline?: number
): Promise<string> {
  if (!key) {
    throw new AIError(
      `${provider} API 키가 없습니다. 관리자 앱 [AI API 키] 화면에서 먼저 등록하세요.`
    );
  }

  if (provider === "claude") {
    return generateClaude(model, key, system, prompt, deadline);
  }

  const data = await geminiPost(
    `models/${model}:generateContent`,
    key,
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0 },
    },
    25000,
    deadline
  );

  const cands = data?.candidates || [];
  const parts = cands[0]?.content?.parts || [];
  const text = parts
    .map((p: any) => p?.text || "")
    .join("")
    .trim();

  if (!text) {
    const reason = cands[0]?.finishReason || JSON.stringify(data?.promptFeedback || {});
    throw new AIError(`Gemini가 빈 답변을 돌려줬습니다 (${reason}).`);
  }
  return text;
}

async function generateClaude(
  model: string,
  key: string,
  system: string,
  prompt: string,
  deadline?: number
): Promise<string> {
  const budget = attemptBudget(25000, deadline);
  if (budget === 0) {
    throw new AIError("Claude 호출 전 응답 시간 초과");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budget);
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const errText = await resp.text();
      throw new AIError(`Claude 호출 실패 (HTTP ${resp.status}): ${errText.slice(0, 200)}`);
    }
    const data = await resp.json();
    const text = (data?.content || [])
      .filter((b: any) => b?.type === "text")
      .map((b: any) => b?.text || "")
      .join("")
      .trim();

    if (!text) {
      throw new AIError("Claude가 빈 답변을 돌려줬습니다.");
    }
    return text;
  } catch (err: any) {
    clearTimeout(timer);
    if (err instanceof AIError) throw err;
    throw new AIError(`Claude 연결 오류: ${err?.message || String(err)}`);
  }
}
