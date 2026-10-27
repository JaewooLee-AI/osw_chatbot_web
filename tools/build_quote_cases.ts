// 웹·관리자 계산기 공통 검증 케이스를 만든다 (가짜 요금표 기준). 웹 계산기가 낸 결과를 기대값으로 저장하고,
// 관리자 앱의 파이썬 계산기가 같은 값을 내는지 pytest 로 확인한다.
//   npx vite-node tools/build_quote_cases.ts && cp tests/quote_cases.json ../osw_chatbot_admin/tests/
import { writeFileSync } from "node:fs";
import { calculateQuote } from "../src/lib/quote/calc";
import { FAKE } from "../tests/quote_fixture";
import type { QuoteInput } from "../src/lib/quote/types";

const today = "2026-10-01";
const dates = ["2026-10-20", "2026-11-06", "2026-11-22", "2026-11-28", "2026-12-01", "2026-12-02", "2026-12-04", "2026-12-22", "2026-12-24", "2027-06-01", "2026-09-30", "2026-09-18"];
const inputs: QuoteInput[] = [];
for (const courseId of ["SZ4D", "HK4D", "HK4M", "HK3D"]) {
  for (const departDate of dates) {
    for (const [adults, children, infants] of [[2, 0, 0], [3, 0, 0], [4, 0, 1], [2, 2, 0], [5, 0, 0], [8, 1, 0], [9, 0, 0], [10, 0, 0], [12, 0, 0], [14, 0, 0], [15, 0, 0], [1, 0, 0]]) {
      inputs.push({ courseId, departDate, adults, children, infants, route: courseId === "SZ4D" ? "SHZ" : undefined, today });
    }
  }
}
inputs.push(
  ...([
  { courseId: "SZ4D", departDate: "2026-12-01", adults: 4, route: "NOPE", today },
  { courseId: "SZ4D", departDate: "2026-12-01", adults: 4, today }, // route 생략
  { courseId: "SZ4D", departDate: "2026-12-01", adults: 4, route: "SHZ", withAir: true, today },
  { courseId: "XX", departDate: "2026-12-01", adults: 4, today },
  { courseId: "SZ4D", departDate: "2026-02-31", adults: 4, today },
  { courseId: "SZ4D", departDate: "2026-12-1", adults: 4, today },
  { courseId: "SZ4D", departDate: "2026-12-01", adults: 0, today },
  { courseId: "SZ4D", departDate: "2026-12-01", adults: 4, children: -1, today },
  { courseId: "SZ4D", departDate: "2026-12-01", adults: 4.9, today },
] as QuoteInput[]),
);
const cases = inputs.map((input) => ({ input, expected: JSON.parse(JSON.stringify(calculateQuote(FAKE, input))) }));
writeFileSync("tests/quote_cases.json", JSON.stringify({ ruleset: FAKE, cases }, null, 1) + "\n");
console.log(`${cases.length} cases, ok=${cases.filter((c) => c.expected.status === "ok").length}`);
