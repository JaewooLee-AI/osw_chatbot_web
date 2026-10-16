import { HandoffConfig, MatchedDocument } from "./supabase";

export const FORM_LABEL = "상담 요청서 남기기";
export const KAKAO_LABEL = "카카오톡으로 상담하기";
export const PRODUCT_LABEL = "상품 보러가기";

const PRODUCT_TYPES = new Set(["단독패키지", "골프여행", "일일투어"]);
const HANDOFF_WORDS = /담당자|견적|상담/;

export interface HandoffButton {
  kind: "product" | "form" | "kakao";
  label: string;
  url: string;
}

export const DEFAULT_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdY4J8dEgdM0MII9pRBVEb0GXUZKbC8x3pCYcwASBE-ZUQwtw/viewform";

export function docKey(doc: MatchedDocument): string | null {
  const t = doc.travel_type || "";
  const d = doc.destination || "";
  if (t === "스기노이호텔") {
    return "스기노이호텔";
  }
  if (PRODUCT_TYPES.has(t) && d) {
    return `${t}/${d}`;
  }
  return null;
}

export function formUrl(
  handoff: HandoffConfig | undefined,
  key: string | null
): string {
  const form = handoff?.form;
  const baseUrl = form?.url || DEFAULT_FORM_URL;
  if (!baseUrl) {
    return "";
  }
  const prefillMap = form?.prefill || {};
  const pair =
    (key ? prefillMap[key] : undefined) ||
    prefillMap["기본"] || [
      "",
      "",
    ];
  const [ftype, fregion] = pair;

  const params: Array<[string | undefined, string]> = [
    [form?.entry_travel_type, ftype],
    [form?.entry_region, fregion],
  ];

  const query = params
    .filter(([id, val]) => Boolean(id && val))
    .map(([id, val]) => `&entry.${id}=${encodeURIComponent(val)}`)
    .join("");

  return baseUrl + (query ? `?usp=pp_url${query}` : "");
}

/**
 * 답변 아래 상담 연결 버튼 생성 규칙 (osw_chatbot_admin/osw_admin/handoff.py 와 100% 동일)
 */
export function buildHandoffButtons(
  handoff: HandoffConfig | undefined,
  status: "answered" | "fallback" | "error",
  failureType: string | null,
  used: MatchedDocument[],
  text: string
): HandoffButton[] {
  if (!handoff) return [];

  let key: string | null = null;
  for (const d of used) {
    const k = docKey(d);
    if (k) {
      key = k;
      break;
    }
  }

  // 상품 답변인지는 근거 1순위로만 판단한다.
  const firstCat = used[0]?.category || "";
  const isProduct =
    used.length > 0 &&
    (firstCat.startsWith("가격_") || firstCat.startsWith("상품목록"));

  const out: HandoffButton[] = [];

  if (
    status === "answered" &&
    key &&
    isProduct &&
    handoff.product_links &&
    handoff.product_links[key]
  ) {
    out.push({
      kind: "product",
      label: PRODUCT_LABEL,
      url: handoff.product_links[key],
    });
  }

  const wantsHandoff =
    status !== "answered" ||
    failureType === "ref_gap" ||
    failureType === "clarify" ||
    isProduct ||
    HANDOFF_WORDS.test(text || "");

  if (wantsHandoff) {
    const fUrl = formUrl(handoff, status === "answered" ? key : null);
    if (fUrl) {
      out.push({
        kind: "form",
        label: FORM_LABEL,
        url: fUrl,
      });
    }
    if (handoff.kakao_chat_url) {
      out.push({
        kind: "kakao",
        label: KAKAO_LABEL,
        url: handoff.kakao_chat_url,
      });
    }
  }

  return out;
}
