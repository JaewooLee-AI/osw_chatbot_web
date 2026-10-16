import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { getSupabaseClient } from "./supabase";

/**
 * /api/chat 보호: 허용되지 않은 사이트에서 부르는 것을 막고, 방문자별 호출 횟수를 제한한다.
 * 위젯은 이 배포 도메인의 /widget(iframe)에서 같은 도메인 /api/chat을 부르므로 다른 출처를 열어 둘 필요가 없다.
 */

function intEnv(name: string, fallback: number): number {
  const n = parseInt(process.env[name] || "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// 한 방문자(IP)당 한도. 실제 고객 상담은 이보다 훨씬 적다. Vercel 환경변수로 바꿀 수 있다.
const PER_MINUTE = intEnv("CHAT_RATE_PER_MINUTE", 10);
const PER_DAY = intEnv("CHAT_RATE_PER_DAY", 150);

// 다른 도메인에서 API를 직접 불러야 할 때만 쉼표로 적는다 (예: https://japan.onlytour.co.kr).
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

/**
 * 브라우저가 보낸 Origin이 이 배포 도메인이거나 ALLOWED_ORIGINS에 있으면 true.
 * Origin이 없는 요청(서버·curl)은 출처로 막을 수 없으므로 통과시키고 횟수 제한에 맡긴다.
 */
export function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  // host는 브라우저 스크립트가 바꿀 수 없는 헤더라 이것만 쓴다.
  const host = req.headers.get("host") || "";
  return originHost === host || EXTRA_ORIGINS.includes(origin.replace(/\/+$/, ""));
}

function clientKey(req: NextRequest): string {
  // Vercel은 x-real-ip·x-forwarded-for를 실제 접속 IP로 덮어써서 보낸다.
  const ip =
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown";
  // IP 원문은 DB에 남기지 않는다.
  return "chat:" + createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

let warned = false;

/**
 * 한도 안이면 true. Supabase 함수(hit_rate_limit)가 아직 없거나 오류면 챗봇을 멈추지 않도록 통과시킨다
 * (osw_chatbot_admin/supabase/005_rate_limit.sql 실행 전에도 배포할 수 있게).
 */
export async function withinRateLimit(req: NextRequest): Promise<boolean> {
  try {
    const { data, error } = await getSupabaseClient().rpc("hit_rate_limit", {
      p_key: clientKey(req),
      p_per_minute: PER_MINUTE,
      p_per_day: PER_DAY,
    });
    if (error) throw error;
    return data !== false;
  } catch (err: any) {
    if (!warned) {
      warned = true;
      console.error(
        "[rate-limit] hit_rate_limit 호출 실패 — 제한 없이 통과시킵니다. 005_rate_limit.sql 실행 여부를 확인하세요:",
        err?.message || err
      );
    }
    return true;
  }
}
