import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_BRAND, getSettings } from "@/lib/supabase";
import {
  DEFAULT_BRAND_LABEL,
  DEFAULT_HOMEPAGE,
  DEFAULT_KAKAO_CHAT_URL,
  OPERATING_HOURS,
  QUICK_QUESTIONS,
  TRAVEL_TYPES,
} from "@/lib/widgetConfig";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brand = (searchParams.get("brand") || DEFAULT_BRAND).trim();

  try {
    const settings = await getSettings(brand);
    const handoff = settings.handoff || {};

    return NextResponse.json({
      brand: settings.brand,
      brand_name: settings.brand_name || DEFAULT_BRAND_LABEL,
      tone: settings.tone,
      travel_types: TRAVEL_TYPES,
      quick_questions: QUICK_QUESTIONS,
      operating_hours: OPERATING_HOURS,
      kakao_chat_url: handoff.kakao_chat_url || DEFAULT_KAKAO_CHAT_URL,
      homepage: handoff.homepage || DEFAULT_HOMEPAGE,
    });
  } catch (err: any) {
    console.error("[api/config] 설정 조회 실패:", err?.message || err);
    return NextResponse.json(
      {
        brand,
        brand_name: DEFAULT_BRAND_LABEL,
        travel_types: TRAVEL_TYPES,
        quick_questions: QUICK_QUESTIONS,
        operating_hours: OPERATING_HOURS,
        kakao_chat_url: DEFAULT_KAKAO_CHAT_URL,
        homepage: DEFAULT_HOMEPAGE,
      },
      { status: 200 }
    );
  }
}
