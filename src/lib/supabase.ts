import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SUPABASE_SERVICE_KEY = (
  process.env.SUPABASE_service_role ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ""
).trim();

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

export async function getSettings(brand: string = DEFAULT_BRAND): Promise<BotSettings> {
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

export async function getProviderModel(vendor: string): Promise<string> {
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

export async function getApiKey(vendor: string): Promise<string> {
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

export async function logFallback(record: {
  brand: string;
  channel?: string;
  user_query: string;
  bot_answer?: string;
  top_similarity?: number;
  top_source_id?: string | null;
  failure_type?: string | null;
}): Promise<void> {
  const sb = getSupabaseClient();
  // DB check 제약조건 호환: ('kakao', 'simulator')
  const safeChannel =
    record.channel === "kakao" || record.channel === "simulator"
      ? record.channel
      : "simulator";

  try {
    await sb.from("fallback_logs").insert({
      brand: record.brand,
      channel: safeChannel,
      user_query: record.user_query,
      bot_answer: record.bot_answer || "",
      top_similarity: record.top_similarity ?? 0,
      top_source_id: record.top_source_id ?? null,
      failure_type: record.failure_type ?? null,
    });
  } catch {
    // 로깅 실패가 사용자 응답을 막지 않도록 무시
  }
}
