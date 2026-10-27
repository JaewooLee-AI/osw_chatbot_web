/**
 * 간단견적(가견적) 계산기 타입.
 *
 * 견적 기준(요금·호텔·수익·환율)은 코드가 아니라 데이터(Ruleset JSON)다. 관리자 앱 [견적 기준]에서 엑셀로 등록하고
 * Supabase quote_rulesets 에 저장한다. 이 저장소에는 실제 가격을 두지 않는다 (공개 저장소).
 * 관리자 앱(Python)의 계산기와 같은 결과를 내야 하므로 tests/quote_cases.json 의 공통 케이스로 양쪽을 검사한다.
 */

export type Region = "shizuoka" | "hokkaido";

/** 환율·수수료·반올림. 판매가 = round((엔화 원가 × jpyToKrw × feeMultiplier) + 인원별 수익, roundUnit) */
export interface FxRules {
  jpyToKrw: number;
  feeMultiplier: number;
  roundUnit: number;
}

/** 출발 인원(유료 인원) 구간별 1인당 수익(원). */
export interface MarginTier {
  minPax: number;
  maxPax: number;
  krw: number;
}

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
}

/** 월-일 기간(해마다 반복). from > to 이면 해를 넘기는 기간(예: 12-26 ~ 01-03). */
export interface SeasonRange {
  from: string; // MM-DD
  to: string;
  name: string;
}

export interface ChargeItem {
  name: string;
  unitJpy: number;
  /** day: 일수만큼, night: 박수만큼, once: qty 회(기본 1) */
  per: "day" | "night" | "once";
  qty?: number;
}

export interface CourseBase {
  id: string;
  region: Region;
  name: string;
  nights: number;
  /** 일차별 일정 요약 (고객에게 보여 줌) */
  itinerary: string[];
  /** 자동 견적 인원 범위 */
  minPax: number;
  maxPax: number;
  /** 참고 견적(담당자 확인 필요) 표시 여부 — 2박3일·4박5일 */
  reference?: boolean;
  /** 코스 소개 지식에 일정 앞에 붙는 소개 문구 (선택, 계산에는 쓰이지 않음) */
  intro?: string;
}

/** 시즈오카형: 호텔이 코스별로 고정, 공동경비는 인아웃·차종별 */
export interface ShizuokaCourse extends CourseBase {
  region: "shizuoka";
  hotelsPerNight: string[]; // ruleset.hotels 의 코드
  /** 일차별 입장료(엔), 길이 = nights + 1 */
  admissionsPerDayJpy: number[];
  personal: { mealPerDayJpy: number; snackPerDayJpy: number; waterPerDayJpy: number; handlingOnceJpy: number };
  routes: Record<string, { name: string; vehicles: ShizuokaVehicle[] }>;
}

export interface ShizuokaVehicle {
  id: string;
  minPax: number;
  maxPax: number;
  items: ChargeItem[]; // 차량·실비·가이드 등 공동경비 항목 (인원으로 나눔)
}

/** 홋카이도형: 호텔 요금이 날짜별, 차량·가이드는 차종별 1인당 요금 */
export interface HokkaidoCourse extends CourseBase {
  region: "hokkaido";
  hotelsPerNight: string[]; // ruleset.hokkaidoHotels 의 코드
  /** 이 코스 전용 차량·가이드 요금 (노멀·믹스처럼 제반 비용이 다른 코스). 없으면 ruleset.hokkaidoVehicles 를 쓴다 */
  vehicles?: HokkaidoVehicle[];
  personal:
    | { mode: "fixed"; jpy: number } // 3박4일: 요금표의 개인 비용 합계
    | { mode: "counted"; localMeals: number; spots: number; specialsJpy: number }; // 2박3일·4박5일: spots = 요금표에 비용이 없는 방문지 수(× 단가), specialsJpy = 요금표에 비용이 있는 관광지·특전 합계
}

export type Course = ShizuokaCourse | HokkaidoCourse;

export interface HokkaidoVehicle {
  id: string;
  minPax: number;
  maxPax: number;
  carPerDayJpy: number;
  guidePerDayJpy: number;
  miscOnceJpy: number; // 제반 비용 (전 일정, 한 번)
  guideLodgingMealsJpy: number; // 3박 기준 금액 — 박수에 비례
  driverLodgingMealsJpy: number; // 3박 기준 금액 — 박수에 비례
}

export interface HokkaidoHotel {
  name: string;
  /** 날짜별 트윈 기준 1인 요금(엔). 아동은 성인과 같은 요금으로 계산한다. */
  ratesJpy: Record<string, number>;
  closures: DateRange[]; // 휴관일 — 숙박일이 걸리면 담당자 확인
}

export interface Ruleset {
  version: number;
  fx: FxRules;
  margin: MarginTier[];
  /** 일본 공휴일 (YYYY-MM-DD) — 시즈오카 휴전일 숙박 할증에 쓴다 */
  holidays: string[];
  /** 이 기간에 걸리면 자동 견적 없이 담당자 확인 (실버위크·연말연시) */
  peakSeasons: SeasonRange[];
  /** 시즈오카 할증 */
  surcharges: {
    autumn: { from: string; to: string; jpyPerPerson: number; name: string }; // MM-DD
    holidayEve: { jpyPerNight: number; name: string };
  };
  hotels: Record<string, { name: string; costPerNightJpy: number }>;
  hokkaidoHotels: Record<string, HokkaidoHotel>;
  hokkaidoVehicles: HokkaidoVehicle[];
  /** 홋카이도 차량 공동경비의 기준 박수(3박4일). 2박3일·4박5일은 숙박·식대를 박수에 비례시킨다 */
  hokkaidoBaseNights: number;
  /** 2박3일·4박5일 단순 계산 단가 */
  simple: { mealJpy: number; spotJpy: number };
  courses: Course[];
}

export interface QuoteInput {
  courseId: string;
  departDate: string; // YYYY-MM-DD
  adults: number;
  children: number; // 만 2세 이상 — 성인과 같은 요금
  infants: number; // 만 2세 미만 — 무료
  /** 시즈오카 인아웃 (routes 의 키) */
  route?: string;
  /** 항공 포함 요청 — 항공료는 제외하고 계산하고 안내 문구를 붙인다 */
  withAir?: boolean;
  today?: string; // 시험용: 오늘 날짜
}

export type HandoffCode =
  | "course_unknown"
  | "invalid_input"
  | "pax_out_of_range"
  | "peak_season"
  | "hotel_closed"
  | "no_rate_for_date"
  | "no_margin";

export interface QuoteHandoff {
  status: "handoff";
  code: HandoffCode;
  /** 방문자에게 보여 줄 안내 */
  message: string;
}

export interface QuoteOk {
  status: "ok";
  courseId: string;
  courseName: string;
  /** 1인 판매가(원, roundUnit 단위) */
  perPersonKrw: number;
  chargeablePax: number;
  itinerary: string[];
  /** 적용된 할증 이름 (금액은 숨김) */
  surchargeNames: string[];
  /** 참고 견적(담당자 확인 필요) */
  reference: boolean;
  /** 결과 화면에 붙일 추가 안내 */
  notes: string[];
}

export type QuoteResult = QuoteOk | QuoteHandoff;

/** 관리자 검수·정확도 확인용 — 방문자에게 절대 보내지 않는다 (원가 포함). */
export interface QuoteBreakdown {
  jpyPerPerson: number;
  marginKrw: number;
  parts: Record<string, number>;
}
