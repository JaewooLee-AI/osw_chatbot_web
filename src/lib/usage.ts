import { AsyncLocalStorage } from "node:async_hooks";
import { getSupabaseClient } from "./supabase";

/**
 * AI 토큰 사용량 기록. 호출마다 제공사(Gemini·Claude·OpenAI)가 응답에 실어 보낸 실제 토큰 수를 모아 두었다가
 * 응답을 보낸 뒤 Supabase llm_usage 에 한 번에 넣는다. 질문·답변 내용은 저장하지 않는다(토큰 수와 종류만).
 * 단가·환율·예산은 관리자 앱 [AI 사용량]에서 계산한다. 테이블(010_llm_usage.sql)이 없거나 기록이 실패해도 챗봇 답변에는 영향이 없다.
 */

export type UsageKind = "answer" | "rewrite" | "embed";

export interface UsageRecord {
  kind: UsageKind;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  /** 제공사 응답에 사용량이 없어 글자 수로 추정한 값 */
  estimated: boolean;
}

export interface UsageContext {
  brand: string;
  channel: string;
  records: UsageRecord[];
}

const store = new AsyncLocalStorage<UsageContext>();

export function newUsageContext(brand: string, channel: string = "web"): UsageContext {
  return { brand, channel, records: [] };
}

/** fn 안에서 일어난 AI 호출의 사용량을 ctx 에 모은다. */
export function runWithUsage<T>(ctx: UsageContext, fn: () => Promise<T>): Promise<T> {
  return store.run(ctx, fn);
}

/** ai.ts 가 호출 직후 부른다. 기록 중이 아니면(예: 시험 스크립트) 아무 일도 하지 않는다. */
export function reportUsage(rec: UsageRecord): void {
  store.getStore()?.records.push(rec);
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

/** 한국어는 대략 한 토큰에 두 글자 — 제공사가 사용량을 주지 않을 때만 쓴다. */
export function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 2);
}

/** 제공사별 응답에서 (입력, 출력, 캐시된 입력) 토큰 수를 읽는다. 사용량이 없으면 null. */
export function parseUsage(
  provider: string,
  data: any
): { inputTokens: number; outputTokens: number; cachedTokens: number } | null {
  if (provider === "claude") {
    const u = data?.usage;
    if (!u) return null;
    const cached = num(u.cache_read_input_tokens);
    return {
      inputTokens: num(u.input_tokens) + cached + num(u.cache_creation_input_tokens),
      outputTokens: num(u.output_tokens),
      cachedTokens: cached,
    };
  }
  if (provider === "openai") {
    const u = data?.usage;
    if (!u) return null;
    return {
      inputTokens: num(u.input_tokens),
      outputTokens: num(u.output_tokens),
      cachedTokens: num(u?.input_tokens_details?.cached_tokens),
    };
  }
  const m = data?.usageMetadata; // gemini
  if (!m) return null;
  return {
    inputTokens: num(m.promptTokenCount),
    // 생각(thinking) 토큰도 출력으로 과금된다
    outputTokens: num(m.candidatesTokenCount) + num(m.thoughtsTokenCount),
    cachedTokens: num(m.cachedContentTokenCount),
  };
}

let warned = false;

/** 모은 기록을 llm_usage 에 넣는다. 실패해도 던지지 않는다. */
export async function flushUsage(ctx: UsageContext): Promise<void> {
  if (!ctx.records.length) return;
  try {
    const { error } = await getSupabaseClient()
      .from("llm_usage")
      .insert(
        ctx.records.map((r) => ({
          brand: ctx.brand,
          channel: ctx.channel,
          kind: r.kind,
          provider: r.provider,
          model: r.model,
          input_tokens: r.inputTokens,
          output_tokens: r.outputTokens,
          cached_tokens: r.cachedTokens,
          estimated: r.estimated,
        }))
      );
    if (error) throw error;
  } catch (err: any) {
    if (!warned) {
      warned = true;
      console.error("[usage] 사용량 기록 실패 — 010_llm_usage.sql 실행 여부를 확인하세요:", err?.message || err);
    }
  }
}
