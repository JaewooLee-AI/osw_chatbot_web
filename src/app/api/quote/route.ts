import { NextRequest, NextResponse } from "next/server";
import { clientKey, isAllowedOrigin, withinRateLimit } from "@/lib/guard";
import { DEFAULT_BRAND } from "@/lib/supabase";
import { calculateQuote } from "@/lib/quote/calc";
import { isEmail, normalizePhone } from "@/lib/quote/format";
import { getActiveRuleset, getQuoteSettings, insertQuote, logQuoteEvent, QUOTE_EVENTS, saveContact, QuoteEventName } from "@/lib/quote/store";
import { notifyQuoteContact } from "@/lib/quote/notify";
import type { QuoteInput } from "@/lib/quote/types";

/**
 * 간단견적 API. 계산은 코드(calc.ts)가 하고, 원가·환율·수익은 응답에 담지 않는다.
 * 설정에서 꺼져 있거나(quote_settings.enabled=false) 활성 견적 기준이 없으면 404.
 *
 *   POST { action: "calculate", brand?, input }        → { quote_id, result }
 *   POST { action: "contact", quote_id, name, phone, email?, consent_privacy, consent_marketing }
 *   POST { action: "event", event }                    → start / consult
 */

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/** 한국 날짜(KST) 기준 오늘 — 서버(UTC)와 날짜가 달라지는 새벽 시간대의 지난 날짜 오판을 막는다. */
function todayKst(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

function count(v: unknown, max: number): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < 0 || n > max) return null;
  return n;
}

export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) return bad("허용되지 않은 사이트에서의 요청입니다.", 403);
  if (!(await withinRateLimit(req, "quote"))) return bad("짧은 시간에 요청이 많아 잠시 멈췄습니다. 잠시 후 다시 시도해 주세요.", 429);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad("요청 형식이 올바르지 않습니다.");
  }
  const brand = typeof body?.brand === "string" && body.brand.trim() ? body.brand.trim() : DEFAULT_BRAND;
  const settings = await getQuoteSettings(brand);
  if (!settings.enabled) return bad("현재 이용할 수 없습니다.", 404);
  const visitor = clientKey(req, "quote");

  try {
    if (body.action === "event") {
      const ev = body.event as QuoteEventName;
      if (!QUOTE_EVENTS.includes(ev) || (ev !== "start" && ev !== "consult")) return bad("알 수 없는 요청입니다.");
      await logQuoteEvent(brand, visitor, ev, typeof body.quote_id === "string" ? body.quote_id : null);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "calculate") {
      const rs = await getActiveRuleset(brand);
      if (!rs) return bad("현재 이용할 수 없습니다.", 404);
      const i = body.input || {};
      const adults = count(i.adults, 50);
      const children = count(i.children ?? 0, 50);
      const infants = count(i.infants ?? 0, 50);
      if (typeof i.courseId !== "string" || typeof i.departDate !== "string" || adults === null || children === null || infants === null) {
        return bad("입력값을 확인해 주세요.");
      }
      const input: QuoteInput = {
        courseId: i.courseId.slice(0, 40),
        departDate: i.departDate.slice(0, 10),
        adults,
        children,
        infants,
        route: typeof i.route === "string" && i.route ? i.route.slice(0, 40) : undefined,
        withAir: Boolean(i.withAir),
        today: todayKst(),
      };
      const result = calculateQuote(rs.data, input);
      const course = rs.data.courses.find((c) => c.id === input.courseId);
      const quoteId = await insertQuote({ brand, visitor_hash: visitor, rs, input, courseName: course?.name || "", result });
      await logQuoteEvent(brand, visitor, result.status === "ok" ? "calculated" : "handoff", quoteId, result.status === "handoff" ? { code: result.code } : {});
      return NextResponse.json({ quote_id: quoteId, result });
    }

    if (body.action === "contact") {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 50) : "";
      const phone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
      const email = typeof body.email === "string" ? body.email.trim().slice(0, 100) : "";
      if (!name) return bad("이름을 입력해 주세요.");
      if (!phone) return bad("연락처를 확인해 주세요.");
      if (email && !isEmail(email)) return bad("이메일 형식을 확인해 주세요.");
      if (body.consent_privacy !== true) return bad("개인정보 수집·이용에 동의해 주세요.");
      if (typeof body.quote_id !== "string") return bad("견적을 먼저 확인해 주세요.");
      const saved = await saveContact(brand, body.quote_id, visitor, { name, phone, email, consentPrivacy: true, consentMarketing: body.consent_marketing === true }, settings.marketing_retention_days);
      if (!saved) return bad("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
      await logQuoteEvent(brand, visitor, "contact", body.quote_id);
      if (settings.notify_enabled && settings.notify_email) await notifyQuoteContact(brand, body.quote_id, settings.notify_email);
      return NextResponse.json({ ok: true });
    }

    return bad("알 수 없는 요청입니다.");
  } catch (err: any) {
    console.error("[api/quote] 처리 실패:", err?.message || err);
    return bad("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
}
