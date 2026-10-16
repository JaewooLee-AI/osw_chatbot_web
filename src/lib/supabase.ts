import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_BRAND = (process.env.BRAND || "japan").trim();
export const DEFAULT_BRAND_NAME = (process.env.BRAND_NAME || "일본스토리").trim();

export const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_DIM = 1536;
export const EMBED_TASK_DOCUMENT = "RETRIEVAL_DOCUMENT";
export const EMBED_TASK_QUERY = "RETRIEVAL_QUERY";
export const IMAGE_BUCKET = "chatbot-images";

const DEFAULT_MODELS: Record<string, string> = {
  gemini: "gemini-3.5-flash-lite",
  claude: "claude-opus-5-5",
};

let _client: SupabaseClient | null = null;

/**
 * 질문마다 반복되는 설정·모델·키 조회를 서버 메모리에 잠깐 기억한다(서버리스 인스턴스마다 따로).
 * 관리자 앱에서 바꾼 값은 최대 CACHE_TTL_MS 뒤에 반영된다. 실패한 조회는 기억하지 않는다.
 */
const CACHE_TTL_MS = 60_000;
const _cache = new Map<string, { at: number; value: Promise<unknown> }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.value as Promise<T>;
  }
  const value = load();
  _cache.set(key, { at: Date.now(), value });
  value.catch(() => {
    if (_cache.get(key)?.value === value) _cache.delete(key);
  });
  return value;
}

export function getSupabaseClient(): SupabaseClient {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = (
    process.env.SUPABASE_service_role ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL 또는 SUPABASE_service_role 환경변수가 설정되지 않았습니다."
    );
  }
  if (!_client) {
    _client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return _client;
}

export interface HandoffFormConfig {
  url?: string;
  ready?: boolean;
  account?: string;
  prefill?: Record<string, [string, string]>;
  entry_region?: string;
  entry_travel_type?: string;
}

export interface HandoffConfig {
  form?: HandoffFormConfig;
  kakao_chat_url?: string;
  homepage?: string;
  product_links?: Record<string, string>;
  imported_at?: string;
  source?: string;
}

export interface BotSettings {
  brand: string;
  brand_name: string;
  tone: string;
  answer_provider: "gemini" | "claude";
  answer_model: string;
  answer_threshold: number;
  context_threshold: number;
  top_k: number;
  fallback_message: string;
  extra_rules: string;
  handoff?: HandoffConfig;
  updated_at?: string;
}

export interface MatchedDocument {
  id: string;
  source_id: string;
  category: string;
  travel_type: string;
  destination: string;
  title: string;
  content: string;
  verification: string;
  similarity: number;
  match_source: "vector" | "keyword";
}

export function getSettings(brand: string = DEFAULT_BRAND): Promise<BotSettings> {
  return cached(`settings:${brand}`, () => loadSettings(brand));
}

async function loadSettings(brand: string): Promise<BotSettings> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("bot_settings")
    .select("*")
    .eq("brand", brand)
    .limit(1);

  if (error) {
    throw new Error(`bot_settings 조회 실패: ${error.message}`);
  }
  if (data && data.length > 0) {
    return data[0] as BotSettings;
  }

  // 기본 행이 없을 경우 기본값 반환
  return {
    brand,
    brand_name: DEFAULT_BRAND_NAME,
    tone: "친절한 상담원",
    answer_provider: "gemini",
    answer_model: "gemini-3.5-flash-lite",
    answer_threshold: 0.65,
    context_threshold: 0.55,
    top_k: 5,
    fallback_message:
      "문의하신 내용은 담당자가 정확히 안내드리겠습니다.\n상담시간: 평일 09:30~17:30 (점심 12:30~13:30, 주말·공휴일 휴무)\n아래 버튼으로 담당자에게 문의해 주세요. 출발일·박수·인원·지역·항공 예약 여부를 함께 남겨 주시면 더 빨리 안내드립니다.",
    extra_rules: "",
    handoff: {},
  };
}

export function getProviderModel(vendor: string): Promise<string> {
  return cached(`model:${vendor}`, () => loadProviderModel(vendor));
}

async function loadProviderModel(vendor: string): Promise<string> {
  const sb = getSupabaseClient();
  try {
    const { data, error } = await sb
      .from("llm_providers")
      .select("vendor_id, model_name")
      .eq("vendor_id", vendor)
      .limit(1);
    if (!error && data && data.length > 0 && data[0].model_name) {
      return data[0].model_name;
    }
  } catch {
    // ignore and fallback
  }
  return DEFAULT_MODELS[vendor] || "gemini-3.5-flash-lite";
}

export function getApiKey(vendor: string): Promise<string> {
  return cached(`key:${vendor}`, () => loadApiKey(vendor));
}

async function loadApiKey(vendor: string): Promise<string> {
  const sb = getSupabaseClient();
  try {
    const { data, error } = await sb.rpc("get_llm_api_key", {
      p_vendor_id: vendor,
    });
    if (!error && typeof data === "string" && data.trim()) {
      return data.trim();
    }
  } catch {
    // ignore and fallback to env
  }
  if (vendor === "gemini") {
    return (process.env.GEMINI_API_KEY || "").trim();
  }
  if (vendor === "claude") {
    return (process.env.ANTHROPIC_API_KEY || "").trim();
  }
  return "";
}

export async function matchDocuments(
  brand: string,
  embedding: number[],
  queryText: string,
  matchCount: number = 10,
  travelTypes?: string[] | null
): Promise<MatchedDocument[]> {
  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc("match_documents", {
    query_embedding: embedding,
    query_text: queryText,
    match_count: matchCount,
    filter_brand: brand,
    filter_travel_types: travelTypes && travelTypes.length > 0 ? travelTypes : null,
  });

  if (error) {
    throw new Error(`match_documents 검색 오류: ${error.message}`);
  }
  return (data || []) as MatchedDocument[];
}

export async function getImages(
  brand: string,
  sourceIds: string[]
): Promise<Record<string, string>> {
  if (!sourceIds || sourceIds.length === 0) return {};
  const sb = getSupabaseClient();
  try {
    const { data, error } = await sb
      .from("rag_documents")
      .select("source_id, image")
      .eq("brand", brand)
      .in("source_id", sourceIds);
    if (error || !data) return {};
    const out: Record<string, string> = {};
    for (const row of data) {
      if (row.source_id && row.image) {
        out[row.source_id] = row.image;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export type FallbackChannel = "web" | "kakao" | "simulator";

export async function logFallback(record: {
  brand: string;
  channel?: FallbackChannel;
  user_query: string;
  bot_answer?: string;
  top_similarity?: number;
  top_source_id?: string | null;
  failure_type?: string | null;
}): Promise<void> {
  const row = {
    brand: record.brand,
    channel: record.channel || "web",
    user_query: record.user_query,
    bot_answer: record.bot_answer || "",
    top_similarity: record.top_similarity ?? 0,
    top_source_id: record.top_source_id ?? null,
    failure_type: record.failure_type ?? null,
  };
  try {
    const sb = getSupabaseClient();
    const { error } = await sb.from("fallback_logs").insert(row);
    // 006_web_channel.sql 실행 전에는 'web'이 채널 제약(23514)에 걸린다 → 예전처럼 'simulator'로 남겨 기록을 잃지 않는다.
    if (error?.code === "23514" && row.channel === "web") {
      await sb.from("fallback_logs").insert({ ...row, channel: "simulator" });
    } else if (error) {
      console.error("[fallback_logs] 기록 실패:", error.message);
    }
  } catch (err: any) {
    // 로깅 실패가 사용자 응답을 막지 않도록 무시
    console.error("[fallback_logs] 기록 실패:", err?.message || err);
  }
}
