/** 입력 카드의 지역 → 박수 → 코스 선택을 돕는 순수 함수 (브라우저·서버 공용). 확정본 2장 ②: 지역, 코스, 박수, 인아웃 선택. */

export const REGION_LABEL: Record<string, string> = { shizuoka: "시즈오카", hokkaido: "홋카이도" };

interface CourseLike {
  id: string;
  region: string;
  nights: number;
}

export function regionsOf<T extends CourseLike>(courses: T[]): string[] {
  return [...new Set(courses.map((c) => c.region))];
}

export function nightsOf<T extends CourseLike>(courses: T[], region: string): number[] {
  return [...new Set(courses.filter((c) => c.region === region).map((c) => c.nights))].sort((a, b) => a - b);
}

export function coursesOf<T extends CourseLike>(courses: T[], region: string, nights: number): T[] {
  return courses.filter((c) => c.region === region && c.nights === nights);
}

/** "3박 4일" */
export function nightsLabel(nights: number): string {
  return `${nights}박 ${nights + 1}일`;
}

/** 지역이 바뀌면 박수·코스를, 박수가 바뀌면 코스를 첫 항목으로 맞춘다. 3박4일을 먼저 보여 준다(가장 많이 묻는 일정). */
export function pickDefaults<T extends CourseLike>(courses: T[], region: string, nights?: number): { nights: number; courseId: string } {
  const list = nightsOf(courses, region);
  const n = nights !== undefined && list.includes(nights) ? nights : list.includes(3) ? 3 : list[0];
  return { nights: n, courseId: coursesOf(courses, region, n)[0]?.id || "" };
}
