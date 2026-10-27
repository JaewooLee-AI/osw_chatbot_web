// AI 토큰 사용량: 제공사별 응답에서 읽는 값과 기록 모으기를 확인한다.
import { describe, expect, it } from "vitest";
import { estimateTokens, newUsageContext, parseUsage, reportUsage, runWithUsage } from "../src/lib/usage";

describe("제공사 응답에서 토큰 수 읽기", () => {
  it("Gemini: 생각 토큰은 출력에 더한다", () => {
    const u = parseUsage("gemini", { usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 80, thoughtsTokenCount: 20, cachedContentTokenCount: 300 } });
    expect(u).toEqual({ inputTokens: 1200, outputTokens: 100, cachedTokens: 300 });
  });
  it("Claude: 캐시 읽기·쓰기 토큰도 입력에 포함", () => {
    const u = parseUsage("claude", { usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 400, cache_creation_input_tokens: 25 } });
    expect(u).toEqual({ inputTokens: 525, outputTokens: 50, cachedTokens: 400 });
  });
  it("OpenAI Responses: 캐시된 입력", () => {
    const u = parseUsage("openai", { usage: { input_tokens: 900, output_tokens: 120, input_tokens_details: { cached_tokens: 512 } } });
    expect(u).toEqual({ inputTokens: 900, outputTokens: 120, cachedTokens: 512 });
  });
  it("사용량이 없으면 null (호출한 쪽이 글자 수로 추정)", () => {
    expect(parseUsage("gemini", {})).toBeNull();
    expect(parseUsage("claude", { content: [] })).toBeNull();
    expect(parseUsage("openai", null)).toBeNull();
  });
  it("이상한 값은 0으로", () => {
    expect(parseUsage("gemini", { usageMetadata: { promptTokenCount: "x", candidatesTokenCount: -5 } })).toEqual({ inputTokens: 0, outputTokens: 0, cachedTokens: 0 });
  });
  it("한국어 추정: 두 글자에 1토큰", () => {
    expect(estimateTokens("가나다라")).toBe(2);
    expect(estimateTokens("")).toBe(0);
  });
});

describe("요청 안에서 사용량 모으기", () => {
  it("요청마다 따로 모이고, 기록 중이 아닐 때는 조용히 무시한다", async () => {
    const rec = (kind: "answer" | "embed") => ({ kind, provider: "gemini", model: "m", inputTokens: 10, outputTokens: 5, cachedTokens: 0, estimated: false });
    reportUsage(rec("answer")); // 컨텍스트 밖 — 오류 없이 무시
    const a = newUsageContext("japan", "web");
    const b = newUsageContext("japan", "web");
    await Promise.all([
      runWithUsage(a, async () => {
        await new Promise((r) => setTimeout(r, 5));
        reportUsage(rec("embed"));
        reportUsage(rec("answer"));
      }),
      runWithUsage(b, async () => {
        reportUsage(rec("answer"));
      }),
    ]);
    expect(a.records.map((r) => r.kind)).toEqual(["embed", "answer"]);
    expect(b.records).toHaveLength(1);
  });
});
