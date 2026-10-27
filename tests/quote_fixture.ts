// 시험용 가짜 견적 기준. 실제 가격이 아니다 (이 저장소는 공개). 값은 계산 규칙을 손으로 검산하기 쉽게 정했다.
import type { Ruleset } from "../src/lib/quote/types";

const rates = (base: number): Record<string, number> => {
  const out: Record<string, number> = {};
  for (let d = 1; d <= 10; d++) out[`2026-12-${String(d).padStart(2, "0")}`] = base;
  return out;
};

export const FAKE: Ruleset = {
  version: 1,
  fx: { jpyToKrw: 9.0, feeMultiplier: 1.03, roundUnit: 1000 },
  margin: [
    { minPax: 2, maxPax: 2, krw: 300000 },
    { minPax: 3, maxPax: 3, krw: 200000 },
    { minPax: 4, maxPax: 4, krw: 150000 },
    { minPax: 5, maxPax: 7, krw: 100000 },
    { minPax: 8, maxPax: 15, krw: 80000 },
  ],
  holidays: ["2026-11-23", "2026-12-23"],
  peakSeasons: [
    { from: "09-19", to: "09-23", name: "실버위크" },
    { from: "12-26", to: "01-03", name: "연말연시" },
  ],
  surcharges: {
    autumn: { from: "10-15", to: "11-30", jpyPerPerson: 12000, name: "단풍시즌 할증" },
    holidayEve: { jpyPerNight: 6000, name: "휴전일 숙박 할증" },
  },
  hotels: { S: { name: "시내 호텔", costPerNightJpy: 14000 }, A: { name: "온천 호텔", costPerNightJpy: 19000 } },
  hokkaidoHotels: {
    NB: { name: "노보리베츠 호텔", ratesJpy: rates(14000), closures: [{ from: "2026-12-02", to: "2026-12-03" }] },
    TY: { name: "도야 호텔", ratesJpy: rates(12500), closures: [] },
    ST: { name: "삿포로 호텔", ratesJpy: rates(8000), closures: [] },
  },
  hokkaidoVehicles: [
    { id: "alphard", minPax: 2, maxPax: 4, carPerDayJpy: 22000, guidePerDayJpy: 19000, miscOnceJpy: 16000, guideLodgingMealsJpy: 25000, driverLodgingMealsJpy: 0 },
    { id: "hiace", minPax: 5, maxPax: 9, carPerDayJpy: 22000, guidePerDayJpy: 19000, miscOnceJpy: 16000, guideLodgingMealsJpy: 25000, driverLodgingMealsJpy: 0 },
    { id: "micro", minPax: 10, maxPax: 14, carPerDayJpy: 90000, guidePerDayJpy: 19000, miscOnceJpy: 17000, guideLodgingMealsJpy: 25000, driverLodgingMealsJpy: 42000 },
  ],
  hokkaidoBaseNights: 3,
  simple: { mealJpy: 1800, spotJpy: 900 },
  courses: [
    {
      id: "SZ4D",
      region: "shizuoka",
      name: "시즈오카 3박 4일",
      nights: 3,
      itinerary: ["1일차 공항-호텔", "2일차 관광", "3일차 관광", "4일차 공항"],
      minPax: 2,
      maxPax: 12,
      hotelsPerNight: ["S", "S", "A"],
      admissionsPerDayJpy: [0, 900, 3500, 1200],
      personal: { mealPerDayJpy: 4500, snackPerDayJpy: 400, waterPerDayJpy: 100, handlingOnceJpy: 9000 },
      routes: {
        SHZ: {
          name: "시즈오카 인아웃",
          vehicles: [
            {
              id: "v78",
              minPax: 2,
              maxPax: 4,
              items: [
                { name: "차량", unitJpy: 18000, per: "day" },
                { name: "실비", unitJpy: 9000, per: "day" },
                { name: "회송", unitJpy: 8000, per: "once", qty: 2 },
                { name: "가이드 일비", unitJpy: 26000, per: "day" },
                { name: "가이드 식사", unitJpy: 4000, per: "day" },
                { name: "가이드 숙박", unitJpy: 11000, per: "night" },
                { name: "7~8인승 차감", unitJpy: -4000, per: "day" },
              ],
            },
            {
              id: "v10",
              minPax: 5,
              maxPax: 8,
              items: [
                { name: "차량", unitJpy: 18000, per: "day" },
                { name: "실비", unitJpy: 9000, per: "day" },
                { name: "회송", unitJpy: 8000, per: "once", qty: 2 },
                { name: "가이드 일비", unitJpy: 26000, per: "day" },
                { name: "가이드 식사", unitJpy: 4000, per: "day" },
                { name: "가이드 숙박", unitJpy: 11000, per: "night" },
              ],
            },
            {
              id: "v18",
              minPax: 9,
              maxPax: 12,
              items: [
                { name: "마이크로", unitJpy: 80000, per: "day" },
                { name: "실비", unitJpy: 13000, per: "day" },
                { name: "기사 팁", unitJpy: 5000, per: "day" },
                { name: "기사 숙박", unitJpy: 11000, per: "night" },
                { name: "가이드 일비", unitJpy: 26000, per: "day" },
                { name: "가이드 식사", unitJpy: 4000, per: "day" },
                { name: "가이드 숙박", unitJpy: 11000, per: "night" },
              ],
            },
          ],
        },
      },
    },
    {
      id: "HK4D",
      region: "hokkaido",
      name: "홋카이도 3박 4일 노멀",
      nights: 3,
      itinerary: ["1일차", "2일차", "3일차", "4일차"],
      minPax: 2,
      maxPax: 14,
      hotelsPerNight: ["NB", "TY", "ST"],
      personal: { mode: "fixed", jpy: 20000 },
    },
    {
      id: "HK4M",
      region: "hokkaido",
      name: "홋카이도 3박 4일 믹스",
      nights: 3,
      itinerary: ["1일차", "2일차", "3일차", "4일차"],
      minPax: 2,
      maxPax: 14,
      hotelsPerNight: ["NB", "ST", "ST"],
      personal: { mode: "fixed", jpy: 18000 },
      // 노멀과 제반 비용·숙박 식대가 다른 코스 전용 차량 요금
      vehicles: [
        { id: "alphard", minPax: 2, maxPax: 4, carPerDayJpy: 22000, guidePerDayJpy: 19000, miscOnceJpy: 30000, guideLodgingMealsJpy: 23000, driverLodgingMealsJpy: 0 },
        { id: "hiace", minPax: 5, maxPax: 9, carPerDayJpy: 22000, guidePerDayJpy: 19000, miscOnceJpy: 30000, guideLodgingMealsJpy: 23000, driverLodgingMealsJpy: 0 },
        { id: "micro", minPax: 10, maxPax: 14, carPerDayJpy: 95000, guidePerDayJpy: 19000, miscOnceJpy: 28000, guideLodgingMealsJpy: 26000, driverLodgingMealsJpy: 44000 },
      ],
    },
    {
      id: "HK3D",
      region: "hokkaido",
      name: "홋카이도 2박 3일",
      nights: 2,
      itinerary: ["1일차", "2일차", "3일차"],
      minPax: 2,
      maxPax: 14,
      reference: true,
      hotelsPerNight: ["ST", "ST"],
      personal: { mode: "counted", localMeals: 2, spots: 5, specialsJpy: 1200 },
    },
  ],
};
