import { NextRequest, NextResponse } from "next/server";
import { answerQuestion, ChatTurn } from "@/lib/rag";
import { DEFAULT_BRAND, getSettings } from "@/lib/supabase";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: NextRequest) {
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
            url: "https://pf.kakao.com/_VjxbnC/chat",
          },
        ],
        error: err?.message || String(err),
      },
      { status: 200 }
    );
  }
}
