/**
 * 웹 챗봇 답변 규칙이 관리자 앱(osw_chatbot_admin)과 같은지 공통 테스트 케이스로 확인한다.
 *
 * parity_cases.json 은 관리자 앱의 tools/build_parity_cases.py 가 관리자 규칙으로 만든 기대값이다.
 * 두 저장소에 같은 파일을 두고 양쪽(pytest · vitest)이 같은 케이스로 검사하므로, 한쪽만 규칙이 바뀌면 실패한다.
 * 규칙을 일부러 바꿨다면 양쪽 코드를 고치고 관리자 저장소에서 파일을 다시 만들어 여기에 복사한다.
 *
 *   npm test
 */
import { describe, expect, it } from "vitest";
import { buildHandoffButtons } from "../src/lib/handoff";
import {
  CLARIFY_TEXT,
  TONES,
  cleanAnswer,
  filterPriceContext,
  mentionsDestination,
  placeTokens,
} from "../src/lib/rag";
import cases from "./parity_cases.json";

type Doc = { destination: string; title: string; category: string; travel_type: string };
const asDocs = (docs: Doc[]) => docs as any[];

describe("관리자 앱과 같은 답변 규칙", () => {
  it("말투 지시문과 되묻기 문구", () => {
    expect(TONES).toEqual(cases.tones);
    expect(CLARIFY_TEXT).toBe(cases.clarify_text);
  });

  it.each(cases.place_tokens)("장소 이름 뽑기: $doc.title", (c) => {
    expect(placeTokens(c.doc)).toEqual(c.expected);
  });

  it.each(cases.mentions_destination)("여행지 언급 판정: $query / $doc.title", (c) => {
    expect(mentionsDestination(c.query, c.doc.destination, placeTokens(c.doc))).toBe(c.expected);
  });

  it.each(cases.filter_price_context)("가격표 거르기: $query", (c) => {
    const { keep, dropped } = filterPriceContext(c.query, asDocs(c.used));
    expect(keep.map((d) => d.title)).toEqual(c.expected_kept_titles);
    expect(dropped).toBe(c.expected_dropped);
  });

  it.each(cases.clean_answer)("답변 다듬기: $input", (c) => {
    expect(cleanAnswer(c.input)).toBe(c.expected);
  });

  it("상담 연결 버튼", () => {
    for (const c of cases.handoff_buttons) {
      const got = buildHandoffButtons(
        c.handoff as any,
        c.status as any,
        c.failure_type,
        asDocs(c.used),
        c.text
      );
      expect(got, JSON.stringify(c)).toEqual(c.expected);
    }
  });

  it("회귀: '스기노이' 없이 관 이름만 물어도 관별 비교 지식이 남는다", () => {
    const doc = cases.place_tokens[0].doc;
    expect(placeTokens(doc).slice(-3)).toEqual(["소라관", "호시관", "니지관"]);
    expect(mentionsDestination("호시관 석식 포함인가요?", doc.destination, placeTokens(doc))).toBe(true);
  });
});
