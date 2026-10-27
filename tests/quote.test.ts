// 간단견적 계산기: 규칙별 손 검산 값으로 확인한다 (가짜 요금표, 실제 가격 아님).
import { describe, expect, it } from "vitest";
import { calculateQuote, calculateQuoteDetailed, roundTo } from "../src/lib/quote/calc";
import { FAKE } from "./quote_fixture";
import type { QuoteInput, QuoteOk } from "../src/lib/quote/types";

const base = (o: Partial<QuoteInput>): QuoteInput => ({
  courseId: "SZ4D",
  route: "SHZ",
  departDate: "2026-12-01",
  adults: 4,
  children: 0,
  infants: 0,
  today: "2026-10-01",
  ...o,
});
const krw = (jpy: number, margin: number) => roundTo(jpy * 9.0 * 1.03 + margin, 1000);
const ok = (r: ReturnType<typeof calculateQuote>) => {
  expect(r.status).toBe("ok");
  return r as QuoteOk;
};

describe("roundTo (엑셀 ROUND 와 같은 사사오입)", () => {
  it("천원 단위", () => {
    expect(roundTo(1499499, 1000)).toBe(1499000);
    expect(roundTo(1499500, 1000)).toBe(1500000);
    expect(roundTo(2500, 1000)).toBe(3000);
  });
});

describe("시즈오카", () => {
  it("평일 출발 4명 (할증 없음): 개인경비 + 공동경비/인원 + 수익", () => {
    // 개인: 호텔 14000+14000+19000, (식사4500+간식400+물100)×4일, 수배 9000, 입장료 5600 = 81600
    // 공동(7~8인승 차감 포함) 261000/4 = 65250 → 146850엔
    const r = ok(calculateQuote(FAKE, base({})));
    expect(r.perPersonKrw).toBe(krw(146850, 150000));
    expect(r.perPersonKrw).toBe(1511000);
    expect(r.surchargeNames).toEqual([]);
    expect(r.reference).toBe(false);
  });

  it("단풍 시즌 + 토요일 숙박 할증이 겹쳐 더해진다", () => {
    // 11/6(금) 출발: 숙박 11/6 금, 11/7 토(할증 1박), 11/8 일. 6명 → 10인승 319000/6
    const r = ok(calculateQuote(FAKE, base({ departDate: "2026-11-06", adults: 6 })));
    const jpy = 81600 + 277000 / 6 + 12000 + 6000;
    expect(r.perPersonKrw).toBe(krw(jpy, 100000));
    expect(r.surchargeNames).toEqual(["단풍시즌 할증", "휴전일 숙박 할증 1박"]);
  });

  it("일본 공휴일 전날 숙박도 할증 (11/22 숙박 → 다음 날 11/23 공휴일)", () => {
    const r = ok(calculateQuote(FAKE, base({ departDate: "2026-11-22", adults: 4 })));
    expect(r.surchargeNames).toContain("휴전일 숙박 할증 1박");
  });

  it("유료 인원: 성인+아동은 같은 요금, 유아는 무료이고 수익 구간에서도 제외", () => {
    const four = ok(calculateQuote(FAKE, base({ adults: 4 })));
    const withKids = ok(calculateQuote(FAKE, base({ adults: 2, children: 2 })));
    const withInfant = ok(calculateQuote(FAKE, base({ adults: 4, infants: 1 })));
    expect(withKids.perPersonKrw).toBe(four.perPersonKrw);
    expect(withInfant.perPersonKrw).toBe(four.perPersonKrw);
    expect(withInfant.chargeablePax).toBe(4);
  });

  it("차량은 유료 인원으로 정한다 (2~4 / 5~8 / 9~12)", () => {
    const a = ok(calculateQuote(FAKE, base({ adults: 5 })));
    const b = ok(calculateQuote(FAKE, base({ adults: 9 })));
    expect(a.perPersonKrw).toBe(krw(81600 + 277000 / 5, 100000));
    expect(b.perPersonKrw).toBe(krw(81600 + 578000 / 9, 80000));
  });

  it("방문자에게 줄 결과에 원가·환율·수익이 들어 있지 않다", () => {
    const r = ok(calculateQuote(FAKE, base({})));
    expect(Object.keys(r).sort()).toEqual(["chargeablePax", "courseId", "courseName", "itinerary", "notes", "perPersonKrw", "reference", "status", "surchargeNames"]);
    const d = calculateQuoteDetailed(FAKE, base({}));
    expect(d.breakdown?.marginKrw).toBe(150000);
  });

  it("항공 포함 요청: 항공 제외 금액에 안내 문구를 붙인다", () => {
    const r = ok(calculateQuote(FAKE, base({ withAir: true })));
    expect(r.notes[0]).toContain("항공은 불포함");
    expect(r.perPersonKrw).toBe(1511000);
  });
});

describe("담당자 확인 (자동 견적 범위 밖)", () => {
  const code = (o: Partial<QuoteInput>) => {
    const r = calculateQuote(FAKE, base(o));
    return r.status === "handoff" ? r.code : "ok";
  };
  it("인원 범위", () => {
    expect(code({ adults: 1 })).toBe("pax_out_of_range");
    expect(code({ adults: 12 })).toBe("ok");
    expect(code({ adults: 13 })).toBe("pax_out_of_range");
    expect(code({ adults: 1, infants: 2 })).toBe("pax_out_of_range"); // 유아는 인원에 안 셈
  });
  it("성수기(실버위크·연말연시)가 일정에 걸림", () => {
    expect(code({ departDate: "2026-09-18", today: "2026-08-01" })).toBe("peak_season"); // 9/19 포함
    expect(code({ departDate: "2026-12-24" })).toBe("peak_season"); // 12/26 포함
    expect(code({ departDate: "2026-12-23" })).toBe("peak_season"); // 12/23~12/26 → 4일째가 12/26
    expect(code({ departDate: "2026-12-22" })).toBe("ok"); // 12/22~12/25
  });
  it("잘못된 입력·지난 날짜·없는 코스", () => {
    expect(code({ departDate: "2026-02-30" })).toBe("invalid_input");
    expect(code({ departDate: "2026-09-30" , today: "2026-10-01" })).toBe("invalid_input");
    expect(code({ adults: 0 })).toBe("invalid_input");
    expect(code({ courseId: "NOPE" })).toBe("course_unknown");
    expect(code({ route: "XXX" })).toBe("invalid_input");
  });
});

describe("홋카이도", () => {
  const hk = (o: Partial<QuoteInput>) => base({ courseId: "HK4D", route: undefined, ...o });

  it("3박4일 4명: 차량·가이드 1인당(100엔 올림) + 개인 비용 + 날짜별 호텔", () => {
    // (22000×4+19000×4+16000+25000)/4 = 51250 → 51300, 개인 20000, 호텔 14000+12500+8000 = 34500 → 105800엔
    const r = ok(calculateQuote(FAKE, hk({ departDate: "2026-12-04" })));
    expect(r.perPersonKrw).toBe(krw(105800, 150000));
    expect(r.perPersonKrw).toBe(1131000);
  });

  it("1인당 차량·가이드 요금은 100엔 단위 올림 (3명 68,333 → 68,400)", () => {
    const r = ok(calculateQuote(FAKE, hk({ departDate: "2026-12-04", adults: 3 })));
    expect(r.perPersonKrw).toBe(krw(68400 + 20000 + 34500, 200000));
  });

  it("9명은 하이에스(5~9), 10명부터 마이크로 — 마이크로는 운전수 숙박·식대가 더해진다", () => {
    const nine = ok(calculateQuote(FAKE, hk({ departDate: "2026-12-04", adults: 9 })));
    const ten = ok(calculateQuote(FAKE, hk({ departDate: "2026-12-04", adults: 10 })));
    expect(nine.perPersonKrw).toBe(krw(22800 + 20000 + 34500, 80000)); // 205000/9 = 22,778 → 22,800
    expect(ten.perPersonKrw).toBe(krw(52000 + 20000 + 34500, 80000)); // 520000/10
  });

  it("2박3일: 숙박·식대는 박수에 비례, 식사·관광지는 단가로 단순 계산, 참고 견적", () => {
    // 랜드 (22000×3+19000×3+16000+25000×2/3)/4 = 38,916.67 → 39,000 / 개인 2×1800+5×900+1200 = 9300 / 호텔 8000×2
    const r = ok(calculateQuote(FAKE, base({ courseId: "HK3D", route: undefined, departDate: "2026-12-04" })));
    expect(r.perPersonKrw).toBe(krw(39000 + 9300 + 16000, 150000));
    expect(r.reference).toBe(true);
  });

  it("호텔 휴관일에 걸리면 담당자 확인", () => {
    const r = calculateQuote(FAKE, hk({ departDate: "2026-12-02" })); // 1일차 숙박 노보리베츠 휴관(12/2~12/3)
    expect(r.status === "handoff" && r.code).toBe("hotel_closed");
  });

  it("요금표에 없는 날짜는 담당자 확인", () => {
    const r = calculateQuote(FAKE, hk({ departDate: "2027-06-01" }));
    expect(r.status === "handoff" && r.code).toBe("no_rate_for_date");
  });

  it("홋카이도 최대 14명, 그 이상은 담당자 확인", () => {
    expect(calculateQuote(FAKE, hk({ departDate: "2026-12-04", adults: 14 })).status).toBe("ok");
    expect(calculateQuote(FAKE, hk({ departDate: "2026-12-04", adults: 15 })).status).toBe("handoff");
  });
});

describe("관리자 앱(파이썬)과 공통 케이스", () => {
  const shared = require("./quote_cases.json") as { ruleset: typeof FAKE; cases: { input: QuoteInput; expected: unknown }[] };
  it("quote_cases.json 의 기대값과 같다", () => {
    expect(shared.ruleset).toEqual(JSON.parse(JSON.stringify(FAKE)));
    for (const c of shared.cases) expect(JSON.parse(JSON.stringify(calculateQuote(shared.ruleset, c.input)))).toEqual(c.expected);
  });
});

describe("화면 표시·입력 확인 도우미", () => {
  it("1인 금액을 약 ○○만원으로", async () => {
    const { formatApproxKrw, normalizePhone, isEmail } = await import("../src/lib/quote/format");
    expect(formatApproxKrw(1511000)).toBe("약 151만원");
    expect(formatApproxKrw(1515000)).toBe("약 152만원");
    expect(normalizePhone("010-1234-5678")).toBe("01012345678");
    expect(normalizePhone("1234")).toBeNull();
    expect(isEmail("a@b.co")).toBe(true);
    expect(isEmail("a@b")).toBe(false);
  });
});
