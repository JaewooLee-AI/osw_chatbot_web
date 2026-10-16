import { NextRequest, NextResponse } from "next/server";
import { isAllowedOrigin, withinRateLimit } from "@/lib/guard";
import { answerQuestion, ChatTurn } from "@/lib/rag";
import { DEFAULT_BRAND, getSettings } from "@/lib/supabase";

const KAKAO_FALLBACK_URL = "https://pf.kakao.com/_VjxbnC/chat";

function blocked(text: string, status: number) {
  return NextResponse.json(
    {
      text,
      status: "error",
      failure_type: "error",
      top_similarity: 0,
      search_query: "",
      image: "",
      destination_badge: "",
      buttons: [
        { kind: "kakao", label: "카카오톡으로 상담하기", url: KAKAO_FALLBACK_URL },
      ],
    },
    { status }
  );
}

// 다른 사이트에서 직접 부르는 것은 허용하지 않는다(위젯은 같은 도메인에서 부른다).
// 허용된 출처라면 그 출처만 돌려준다.
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || !isAllowedOrigin(req)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    },
  });
}

export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) {
    return blocked("허용되지 않은 사이트에서의 요청입니다.", 403);
  }
  if (!(await withinRateLimit(req))) {
    return blocked(
      "짧은 시간에 질문이 많아 잠시 답변을 멈췄습니다. 잠시 후 다시 질문해 주시거나 아래 카카오톡 상담을 이용해 주세요.",
      429
    );
  }

  try {
    const body = await req.json();
    const rawQuestion = typeof body?.question === "string" ? body.question.trim() : "";
    const brand = typeof body?.brand === "string" && body.brand.trim() ? body.brand.trim() : DEFAULT_BRAND;
    const travelType = typeof body?.travel_type === "string" ? body.travel_type.trim() : "";

    if (!rawQuestion) {
      return NextResponse.json(
        { error: "질문을 입력해 주세요." },
        { status: 400 }
      );
    }

    if (rawQuestion.length > 600) {
      return NextResponse.json(
        { error: "질문은 600자 이내로 입력해 주세요." },
        { status: 400 }
      );
    }

    const rawHistory = Array.isArray(body?.history) ? body.history : [];
    const history: ChatTurn[] = rawHistory
      .filter(
        (m: any) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .slice(-6)
      .map((m: any) => ({
        role: m.role,
        content: m.content.slice(0, 800),
      }));

    const travelTypes =
      travelType && travelType !== "전체" ? [travelType] : null;

    const settings = await getSettings(brand);
    const ans = await answerQuestion({
      brand,
      question: rawQuestion,
      settings,
      travelTypes,
      history,
      log: true,
    });

    return NextResponse.json({
      text: ans.text,
      status: ans.status,
      failure_type: ans.failure_type,
      top_similarity: ans.top_similarity,
      search_query: ans.search_query,
      image: ans.image,
      destination_badge: ans.destination_badge,
      buttons: ans.buttons,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        text: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주시거나 아래 카카오톡 상담을 이용해 주세요.",
        status: "error",
        failure_type: "error",
        top_similarity: 0,
        search_query: "",
        image: "",
        destination_badge: "",
        buttons: [
          {
            kind: "kakao",
            label: "카카오톡으로 상담하기",
            url: KAKAO_FALLBACK_URL,
          },
        ],
        error: err?.message || String(err),
      },
      { status: 200 }
    );
  }
}
