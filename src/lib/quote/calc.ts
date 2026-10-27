import type {
  Course,
  HandoffCode,
  HokkaidoCourse,
  QuoteBreakdown,
  QuoteHandoff,
  QuoteInput,
  QuoteOk,
  QuoteResult,
  Ruleset,
  SeasonRange,
  ShizuokaCourse,
} from "./types";

/**
 * 간단견적 계산기 — 순수 함수(네트워크·DB 없음). 같은 입력이면 항상 같은 금액이 나온다.
 * 원가·환율·수익은 Ruleset(데이터)에만 있고, AI에는 결과(1인 금액)만 넘긴다.
 * 관리자 앱 osw_admin/quote.py 와 같은 결과를 내야 한다 (tests/quote_cases.json 공통 케이스).
 */

const DAY_MS = 86400000;

function parseDate(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  // 2026-02-31 같은 없는 날짜 거르기
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return t;
}

function fmt(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

function addDays(t: number, n: number): number {
  return t + n * DAY_MS;
}

function mmdd(t: number): string {
  return fmt(t).slice(5);
}

/** MM-DD 가 [from, to] 안인가 (from > to 이면 해를 넘기는 기간) */
function inSeason(md: string, from: string, to: string): boolean {
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

/** 엑셀 ROUND(x, -n) 과 같은 사사오입 (양수) */
export function roundTo(x: number, unit: number): number {
  return Math.round(x / unit) * unit;
}

function handoff(code: HandoffCode, message: string): QuoteHandoff {
  return { status: "handoff", code, message };
}

const MSG = {
  generic: "입력하신 조건은 자동 견적이 어렵습니다. 담당자가 확인 후 정확히 안내드리겠습니다.",
  pax: "이 인원은 자동 견적 범위를 벗어나 담당자가 확인 후 안내드리겠습니다.",
  peak: "성수기 기간이 포함되어 요금이 달라질 수 있어 담당자가 확인 후 안내드리겠습니다.",
  closed: "선택하신 일정에 호텔 휴관일이 포함되어 담당자가 확인 후 안내드리겠습니다.",
  noRate: "선택하신 날짜의 요금이 아직 등록되지 않아 담당자가 확인 후 안내드리겠습니다.",
  air: "항공은 불포함된 가격이며, 직접 구매하시는 편이 가장 저렴합니다. 상담 요청 시 담당자 확인을 통해 실시간 요금 조회하여 별도 안내드립니다.",
};

function overlapsPeak(dates: number[], seasons: SeasonRange[]): boolean {
  return dates.some((t) => seasons.some((s) => inSeason(mmdd(t), s.from, s.to)));
}

function marginFor(rs: Ruleset, pax: number): number | null {
  const tier = rs.margin.find((m) => pax >= m.minPax && pax <= m.maxPax);
  return tier ? tier.krw : null;
}

function itemTotal(item: { unitJpy: number; per: "day" | "night" | "once"; qty?: number }, days: number, nights: number): number {
  if (item.per === "day") return item.unitJpy * days;
  if (item.per === "night") return item.unitJpy * nights;
  return item.unitJpy * (item.qty ?? 1);
}

interface Computed {
  jpyPerPerson: number;
  surchargeNames: string[];
  parts: Record<string, number>;
}

function calcShizuoka(rs: Ruleset, c: ShizuokaCourse, input: QuoteInput, pax: number, nightDates: number[], tripDates: number[]): Computed | QuoteHandoff {
  const route = c.routes[input.route || ""] || (input.route === undefined ? Object.values(c.routes)[0] : undefined);
  if (!route) return handoff("invalid_input", MSG.generic);
  const vehicle = route.vehicles.find((v) => pax >= v.minPax && pax <= v.maxPax);
  if (!vehicle) return handoff("pax_out_of_range", MSG.pax);

  const days = c.nights + 1;
  const hotelSum = c.hotelsPerNight.reduce((s, code) => s + (rs.hotels[code]?.costPerNightJpy ?? 0), 0);
  const p = c.personal;
  const admissions = c.admissionsPerDayJpy.reduce((a, b) => a + b, 0);
  const personal = hotelSum + (p.mealPerDayJpy + p.snackPerDayJpy + p.waterPerDayJpy) * days + p.handlingOnceJpy + admissions;
  const shared = vehicle.items.reduce((s, it) => s + itemTotal(it, days, c.nights), 0);

  const surchargeNames: string[] = [];
  let surcharge = 0;
  const au = rs.surcharges.autumn;
  if (tripDates.some((t) => inSeason(mmdd(t), au.from, au.to))) {
    surcharge += au.jpyPerPerson;
    surchargeNames.push(au.name);
  }
  const holidays = new Set(rs.holidays);
  const eveNights = nightDates.filter((t) => new Date(t).getUTCDay() === 6 || holidays.has(fmt(addDays(t, 1)))).length;
  if (eveNights > 0) {
    surcharge += rs.surcharges.holidayEve.jpyPerNight * eveNights;
    surchargeNames.push(`${rs.surcharges.holidayEve.name} ${eveNights}박`);
  }

  const jpyPerPerson = personal + shared / pax + surcharge;
  return { jpyPerPerson, surchargeNames, parts: { personal, sharedPerPerson: shared / pax, surcharge } };
}

function calcHokkaido(rs: Ruleset, c: HokkaidoCourse, input: QuoteInput, pax: number, nightDates: number[]): Computed | QuoteHandoff {
  const veh = rs.hokkaidoVehicles.find((v) => pax >= v.minPax && pax <= v.maxPax);
  if (!veh) return handoff("pax_out_of_range", MSG.pax);

  // 호텔: 날짜별 요금. 요금표에 없는 날짜는 담당자 확인, 휴관일은 담당자 확인.
  let hotels = 0;
  for (let i = 0; i < nightDates.length; i++) {
    const hotel = rs.hokkaidoHotels[c.hotelsPerNight[i]];
    if (!hotel) return handoff("invalid_input", MSG.generic);
    const d = fmt(nightDates[i]);
    if (hotel.closures.some((r) => d >= r.from && d <= r.to)) return handoff("hotel_closed", MSG.closed);
    const rate = hotel.ratesJpy[d];
    if (rate === undefined) return handoff("no_rate_for_date", MSG.noRate);
    hotels += rate;
  }

  const days = c.nights + 1;
  const scale = c.nights / rs.hokkaidoBaseNights; // 숙박·식대는 박수에 비례
  const landTotal = veh.carPerDayJpy * days + veh.guidePerDayJpy * days + veh.miscOnceJpy + (veh.guideLodgingMealsJpy + veh.driverLodgingMealsJpy) * scale;
  // 요금표의 1인당 요금과 같은 100엔 단위 올림 (엑셀 ROUNDUP(…, -2))
  const landPerPerson = Math.ceil(landTotal / pax / 100) * 100;

  const pe = c.personal;
  const personal = pe.mode === "fixed" ? pe.jpy : pe.localMeals * rs.simple.mealJpy + pe.spots * rs.simple.spotJpy + pe.specialsJpy;

  return { jpyPerPerson: landPerPerson + personal + hotels, surchargeNames: [], parts: { landPerPerson, personal, hotels } };
}

/** 자동 견적. 범위 밖이면 handoff(담당자 확인)를 돌려준다. breakdown 은 관리자 검수용(원가 포함). */
export function calculateQuote(rs: Ruleset, input: QuoteInput): QuoteResult {
  return calculateQuoteDetailed(rs, input).result;
}

export function calculateQuoteDetailed(rs: Ruleset, input: QuoteInput): { result: QuoteResult; breakdown?: QuoteBreakdown } {
  const course: Course | undefined = rs.courses.find((c) => c.id === input.courseId);
  if (!course) return { result: handoff("course_unknown", MSG.generic) };

  const start = parseDate(input.departDate);
  const adults = Math.trunc(Number(input.adults));
  const children = Math.trunc(Number(input.children || 0));
  const infants = Math.trunc(Number(input.infants || 0));
  if (start === null || !Number.isFinite(adults) || adults < 1 || children < 0 || infants < 0 || !Number.isFinite(children) || !Number.isFinite(infants)) {
    return { result: handoff("invalid_input", MSG.generic) };
  }
  const today = parseDate(input.today || fmt(Date.now()));
  if (today !== null && start < today) return { result: handoff("invalid_input", MSG.generic) };

  const pax = adults + children; // 유료 인원 — 유아(만 2세 미만)는 무료이고 수익 구간에서도 제외
  if (pax < course.minPax || pax > course.maxPax) return { result: handoff("pax_out_of_range", MSG.pax) };

  const nightDates = Array.from({ length: course.nights }, (_, i) => addDays(start, i));
  const tripDates = Array.from({ length: course.nights + 1 }, (_, i) => addDays(start, i));
  if (overlapsPeak(tripDates, rs.peakSeasons)) return { result: handoff("peak_season", MSG.peak) };

  const margin = marginFor(rs, pax);
  if (margin === null) return { result: handoff("no_margin", MSG.pax) };

  const computed = course.region === "shizuoka" ? calcShizuoka(rs, course, input, pax, nightDates, tripDates) : calcHokkaido(rs, course, input, pax, nightDates);
  if ("status" in computed) return { result: computed };

  const krw = roundTo(computed.jpyPerPerson * rs.fx.jpyToKrw * rs.fx.feeMultiplier + margin, rs.fx.roundUnit);
  const notes: string[] = [];
  if (input.withAir) notes.push(MSG.air);

  const ok: QuoteOk = {
    status: "ok",
    courseId: course.id,
    courseName: course.name,
    perPersonKrw: krw,
    chargeablePax: pax,
    itinerary: course.itinerary,
    surchargeNames: computed.surchargeNames,
    reference: Boolean(course.reference),
    notes,
  };
  return { result: ok, breakdown: { jpyPerPerson: computed.jpyPerPerson, marginKrw: margin, parts: computed.parts } };
}

export { MSG as QUOTE_MESSAGES };
