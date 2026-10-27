import { getSupabaseClient, DEFAULT_BRAND } from "../supabase";
import type { Course, QuoteInput, QuoteResult, Ruleset } from "./types";

/**
 * 간단견적 설정·기준·기록(Supabase). 008_quote.sql 을 실행하기 전이거나 오류가 나면 "꺼짐"으로 본다 —
 * 견적 기능이 챗봇 본래 기능(지식 답변)을 멈추게 하지 않는다.
 */

export interface QuoteSettings {
  brand: string;
  enabled: boolean;
  notify_enabled: boolean;
  notify_email: string;
  disclaimer: string;
  privacy_text: string;
  marketing_text: string;
  marketing_retention_days: number;
}

const OFF: QuoteSettings = {
  brand: DEFAULT_BRAND,
  enabled: false,
  notify_enabled: false,
  notify_email: "",
  disclaimer: "",
  privacy_text: "",
  marketing_text: "",
  marketing_retention_days: 365,
};

const TTL_MS = 60_000;
const memo = new Map<string, { at: number; value: Promise<unknown> }>();
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>;
  const value = load();
  memo.set(key, { at: Date.now(), value });
  return value;
}

export function getQuoteSettings(brand: string): Promise<QuoteSettings> {
  return cached(`qs:${brand}`, async () => {
    try {
      const { data, error } = await getSupabaseClient().from("quote_settings").select("*").eq("brand", brand).limit(1);
      if (error || !data || data.length === 0) return { ...OFF, brand };
      return { ...OFF, ...data[0], brand } as QuoteSettings;
    } catch {
      return { ...OFF, brand };
    }
  });
}

export interface ActiveRuleset {
  id: string;
  version: number;
  data: Ruleset;
}

export function getActiveRuleset(brand: string): Promise<ActiveRuleset | null> {
  return cached(`qr:${brand}`, async () => {
    try {
      const { data, error } = await getSupabaseClient()
        .from("quote_rulesets")
        .select("id, version, data")
        .eq("brand", brand)
        .eq("status", "active")
        .limit(1);
      // data_encrypted 만 있는 기준은 아직 복호화 키를 다루지 않으므로 쓰지 않는다.
      if (error || !data || data.length === 0 || !data[0].data) return null;
      return { id: data[0].id, version: data[0].version, data: data[0].data as Ruleset };
    } catch {
      return null;
    }
  });
}

/** 방문자 화면에 내려보내는 코스 목록 — 원가·요금표는 넣지 않는다. */
export interface PublicCourse {
  id: string;
  region: string;
  name: string;
  nights: number;
  minPax: number;
  maxPax: number;
  itinerary: string[];
  reference: boolean;
  routes: { id: string; name: string }[];
}

export function publicCourses(rs: Ruleset): PublicCourse[] {
  return rs.courses.map((c: Course) => ({
    id: c.id,
    region: c.region,
    name: c.name,
    nights: c.nights,
    minPax: c.minPax,
    maxPax: c.maxPax,
    itinerary: c.itinerary,
    reference: Boolean(c.reference),
    routes: c.region === "shizuoka" ? Object.entries(c.routes).map(([id, r]) => ({ id, name: r.name })) : [],
  }));
}

export async function insertQuote(row: {
  brand: string;
  visitor_hash: string;
  rs: ActiveRuleset;
  input: QuoteInput;
  courseName: string;
  result: QuoteResult;
}): Promise<string | null> {
  const { input, result } = row;
  try {
    const ok = result.status === "ok" ? result : null;
    const { data, error } = await getSupabaseClient()
      .from("quotes")
      .insert({
        brand: row.brand,
        visitor_hash: row.visitor_hash,
        ruleset_id: row.rs.id,
        ruleset_version: row.rs.version,
        course_id: input.courseId,
        course_name: row.courseName,
        route: input.route || null,
        depart_date: input.departDate,
        adults: input.adults,
        children: input.children,
        infants: input.infants,
        with_air: Boolean(input.withAir),
        result_status: result.status,
        handoff_code: result.status === "handoff" ? result.code : null,
        per_person_krw: ok ? ok.perPersonKrw : null,
        chargeable_pax: ok ? ok.chargeablePax : null,
        reference: ok ? ok.reference : false,
        surcharge_names: ok ? ok.surchargeNames : [],
        input,
        result,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  } catch (err: any) {
    console.error("[quote] 견적 기록 실패:", err?.message || err);
    return null;
  }
}

export const QUOTE_EVENTS = ["start", "calculated", "handoff", "contact", "consult"] as const;
export type QuoteEventName = (typeof QUOTE_EVENTS)[number];

export async function logQuoteEvent(brand: string, visitor_hash: string, event: QuoteEventName, quote_id?: string | null, meta: Record<string, unknown> = {}) {
  try {
    const { error } = await getSupabaseClient().from("quote_events").insert({ brand, visitor_hash, event, quote_id: quote_id || null, meta });
    if (error) throw error;
  } catch (err: any) {
    console.error("[quote] 이벤트 기록 실패:", err?.message || err);
  }
}

export interface ContactInput {
  name: string;
  phone: string;
  email: string;
  consentPrivacy: boolean;
  consentMarketing: boolean;
}

/** 같은 방문자가 만든 견적에만 연락처를 붙인다. 성공하면 true. */
export async function saveContact(brand: string, quoteId: string, visitor_hash: string, c: ContactInput, retentionDays: number): Promise<boolean> {
  try {
    const now = new Date();
    const until = new Date(now.getTime() + retentionDays * 86400000).toISOString().slice(0, 10);
    const { data, error } = await getSupabaseClient()
      .from("quotes")
      .update({
        contact_name: c.name,
        contact_phone: c.phone,
        contact_email: c.email || null,
        consent_privacy: c.consentPrivacy,
        consent_marketing: c.consentMarketing,
        consent_at: now.toISOString(),
        marketing_until: c.consentMarketing ? until : null,
      })
      .eq("id", quoteId)
      .eq("brand", brand)
      .eq("visitor_hash", visitor_hash)
      .select("id");
    if (error) throw error;
    return Boolean(data && data.length > 0);
  } catch (err: any) {
    console.error("[quote] 연락처 저장 실패:", err?.message || err);
    return false;
  }
}
