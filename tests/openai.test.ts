// OpenAI 응답(Responses API)에서 답변 글자만 뽑는 규칙 — 관리자 앱(ai.py _openai)과 같은 처리.
import { describe, expect, it } from "vitest";
import { extractOpenAIText } from "../src/lib/ai";

describe("extractOpenAIText", () => {
  it("message 항목의 output_text만 이어 붙인다 (추론 항목은 무시)", () => {
    const data = {
      output: [
        { type: "reasoning", summary: [] },
        { type: "message", content: [{ type: "output_text", text: "1인 133~168만원" }, { type: "output_text", text: "입니다." }] },
      ],
    };
    expect(extractOpenAIText(data)).toBe("1인 133~168만원입니다.");
  });

  it("답이 없으면 빈 문자열", () => {
    expect(extractOpenAIText({ status: "incomplete", output: [] })).toBe("");
    expect(extractOpenAIText(null)).toBe("");
  });
});
