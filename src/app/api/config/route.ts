import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_BRAND, getSettings } from "@/lib/supabase";

const TRAVEL_TYPES = [
  { id: "전체", label: "전체" },
  { id: "단독패키지", label: "단독패키지" },
  { id: "스기노이호텔", label: "스기노이호텔" },
  { id: "골프여행", label: "골프여행" },
  { id: "일일투어", label: "일일투어" },
];

const QUICK_QUESTIONS: Record<string, string[]> = {
  전체: [
    "오사카 3박4일 4명이면 1인당 얼마예요?",
    "스기노이 호텔 소라관 석식 포함인가요?",
    "패키지 출발 10일 전에 취소하면 수수료가 얼마예요?",
    "항공권도 포함인가요?",
    "가족 10명인데 단체여행 가능해요?",
  ],
  단독패키지: [
    "오사카 3박4일 4명이면 1인당 얼마예요?",
    "후쿠오카 2박3일 4명 요금 알려주세요",
    "오키나와 3박4일 6명 가격 알려주세요",
    "항공권도 포함인가요?",
    "패키지 취소수수료 규정이 어떻게 되나요?",
  ],
  스기노이호텔: [
    "스기노이 호텔 소라관 석식 포함인가요?",
    "스기노이 호시관 2박3일 요금 알려주세요",
    "스기노이 호텔 아이 나이 기준이 어떻게 되나요?",
    "스기노이 취소수수료 규정 알려주세요",
  ],
  골프여행: [
    "벳푸 골프여행 3박4일 4명 요금 얼마예요?",
    "시즈오카 골프 3박4일 가격 알려주세요",
    "나가사키 골프 2박3일 4명 얼마예요?",
  ],
  일일투어: [
    "오사카 일일투어 요금이 얼마예요?",
    "벳푸·유후인 일일투어 가격 알려주세요",
    "삿포로 일일투어 4명이면 얼마인가요?",
  ],
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brand = (searchParams.get("brand") || DEFAULT_BRAND).trim();

  try {
    const settings = await getSettings(brand);
    const handoff = settings.handoff || {};

    return NextResponse.json({
      brand: settings.brand,
      brand_name: settings.brand_name || "일본스토리",
      tone: settings.tone,
      travel_types: TRAVEL_TYPES,
      quick_questions: QUICK_QUESTIONS,
      operating_hours: "평일 09:30~17:30 (점심 12:30~13:30 · 주말/공휴일 휴무)",
      kakao_chat_url: handoff.kakao_chat_url || "https://pf.kakao.com/_VjxbnC/chat",
      homepage: handoff.homepage || "https://japan.onlytour.co.kr",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        brand,
        brand_name: "일본스토리",
        travel_types: TRAVEL_TYPES,
        quick_questions: QUICK_QUESTIONS,
        operating_hours: "평일 09:30~17:30 (점심 12:30~13:30 · 주말/공휴일 휴무)",
        kakao_chat_url: "https://pf.kakao.com/_VjxbnC/chat",
        homepage: "https://japan.onlytour.co.kr",
        error: err?.message,
      },
      { status: 200 }
    );
  }
}
