/** 1인 견적 금액을 "약 ○○만원" 으로 보여준다 (천원 단위 반올림 금액 → 만원 단위 반올림). */
export function formatApproxKrw(krw: number): string {
  return `약 ${Math.round(krw / 10000).toLocaleString("ko-KR")}만원`;
}

export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

/** 숫자만 남겨 한국 전화번호 형태인지 확인. 맞으면 숫자만 돌려주고, 아니면 null. */
export function normalizePhone(s: string): string | null {
  const d = (s || "").replace(/[^\d]/g, "");
  return /^0\d{8,10}$/.test(d) ? d : null;
}
