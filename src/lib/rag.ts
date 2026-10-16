import { embedQuery, generateAnswer } from "./ai";
import { buildHandoffButtons, HandoffButton } from "./handoff";
import {
  BotSettings,
  DEFAULT_BRAND_NAME,
  getApiKey,
  getImages,
  getProviderModel,
  logFallback,
   matchDocuments,
  MatchedDocument,
} from "./supabase";

const VERIFY_PENDING = "확인필요";

// 관리자 앱(osw_chatbot_admin/osw_admin/rag.py TONES)과 글자 하나까지 같아야 한다.
// 말투는 관리자 [챗봇 설정]에서 이 목록 중 하나로만 저장된다.
const TONES: Record<string, string> = {
  "친절한 상담원": "친절하고 공손한 여행 상담원 말투로, 짧은 문단과 줄바꿈을 써서 답하세요.",
  "간결한 안내": "핵심만 간결하게, 필요한 경우 목록으로 답하세요.",
  "따뜻한 가족여행 상담":
    "가족여행을 준비하는 고객에게 공감하는 따뜻한 말투로 답하되, 사실은 정확히 전달하세요.",
};

const GAP_PATTERN = /\[REF_GAP(?::\s*([^\]]*))?\]/g;
const LEAK_PATTERN =
  /\s*\[(?:확인\s*필요|미확정)\]\s*(?:사항|항목|상태)?(?:으로|으로서|이므로|이라)?\s*/g;

const ROMAN: Record<string, string> = {
  osaka: "오사카",
  kyoto: "교토",
  kobe: "고베",
  tokyo: "도쿄",
  fukuoka: "후쿠오카",
  okinawa: "오키나와",
  hokkaido: "홋카이도",
  sapporo: "삿포로",
  kyushu: "큐슈",
  beppu: "벳푸",
  yufuin: "유후인",
  shikoku: "시코쿠",
  nagasaki: "나가사키",
  shizuoka: "시즈오카",
  miyako: "미야코지마",
  ishigaki: "이시가키",
  suginoi: "스기노이",
  kumamoto: "구마모토",
  kitakyushu: "기타큐슈",
};

export const CLARIFY_TEXT =
  "어느 여행지(상품)를 생각하고 계신가요?\n여행지와 박수·인원을 함께 알려 주시면 요금을 안내드립니다. 예) 오사카 3박4일 4명, 스기노이 호텔 소라관";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface RagAnswer {
  text: string;
  status: "answered" | "fallback" | "error";
  failure_type: string | null;
  top_similarity: number;
  search_query: string;
  image: string;
  destination_badge: string;
  buttons: HandoffButton[];
}

export function cleanAnswer(text: string): string {
  return text
    .replace(LEAK_PATTERN, " ")
    .replace(/<\/?자료[^>]*>/g, "")
    .replace(/[ \t]+([,.])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const HISTORY_TURNS = 3;
// 이어 묻기 풀어쓰기는 실패해도 원문으로 계속하므로, 이 단계에는 시간을 조금만 준다.
const REWRITE_BUDGET_MS = 7000;

/**
 * 이전 대화에 기대는 질문("그럼 6명은요?")을 독립된 검색 질문으로 풀어쓴다.
 */
export async function rewriteQuery(
  question: string,
  history: ChatTurn[],
  settings: BotSettings,
  deadline?: number
): Promise<string> {
  const recent = (history || []).slice(-HISTORY_TURNS * 2);
  const lines: string[] = [];
  for (const m of recent) {
    const content = (m.content || "").trim().replace(/\n+/g, " ");
    if (content) {
      lines.push(
        `${m.role === "user" ? "고객" : "챗봇"}: ${content.slice(0, 300)}`
      );
    }
  }
  if (!lines.length) {
    return question;
  }

  const system =
    "당신은 여행사 챗봇의 검색어 정리기입니다. 지시대로 질문 한 문장만 출력합니다.";
  const prompt = `[이전 대화]를 참고해 [현재 질문]을 그 자체로 이해되는 완전한 질문 한 문장으로 바꾸세요.

규칙:
1. "그럼", "그거", "거기", "~은요?", "몇 명이면?"처럼 이전 대화를 봐야 뜻이 통하면, 이전 대화에 나온 여행지·상품·박수·인원·관 이름을 채워 넣으세요.
   예) 이전: "오사카 3박4일 4명이면 얼마예요?" / 현재: "그럼 6명은요?" → "오사카 3박4일 6명이면 1인당 얼마예요?"
   현재 질문이 박수·인원·여행지 중 하나를 바꾸면, 이전 값을 지우고 새 값으로 바꿔 쓰세요(이전 값과 새 값을 함께 쓰지 마세요).
   예) 이전: "후쿠오카 2박3일 2명 얼마예요?" / 현재: "3박4일은요?" → "후쿠오카 3박4일 2명이면 1인당 얼마예요?"
2. 현재 질문이 이전 대화와 상관없는 새 질문이면 원문을 그대로 쓰세요. 이전 대화의 지명이나 상품을 억지로 붙이지 마세요.
   예) 이전: "오사카 3박4일 얼마예요?" / 현재: "카드결제 되나요?" → "카드결제 되나요?"
3. 이전 대화에 없던 정보를 지어내지 마세요. 오탈자는 바로잡아도 됩니다.
4. 설명 없이 바꾼 질문 한 문장만 출력하세요.

[이전 대화]
${lines.join("\n")}

[현재 질문]
${question}`;

  const provider = settings.answer_provider || "gemini";
  try {
    const [model, key] = await Promise.all([
      getProviderModel(provider),
      getApiKey(provider),
    ]);
    const out = await generateAnswer(provider, model, key, system, prompt, deadline);
    const firstLine = out
      .trim()
      .split(/\r?\n/)[0]
      .trim()
      .replace(/^["']+|["']+$/g, "");
    if (firstLine && firstLine.length <= Math.max(120, question.length * 4)) {
      return firstLine;
    }
  } catch {
    // 실패 시 원문 질문으로 계속 진행
  }
  return question;
}

export function buildPrompt(
  settings: BotSettings,
  question: string,
  used: MatchedDocument[],
  rewritten?: string
): { system: string; prompt: string } {
  const brandName = settings.brand_name || DEFAULT_BRAND_NAME;
  const tone = TONES[settings.tone] || TONES["친절한 상담원"];
  const hasPending = used.some((d) => d.verification === VERIFY_PENDING);

  const pendingRule = hasPending
    ? '- 상태="미확정"인 자료는 아직 확정되지 않은 내용입니다. 그 내용을 말할 때는 단정하지 말고 "정확한 내용은 담당자가 확인해 안내드립니다"라고 덧붙이세요. 자료의 상태 표시나 id를 고객에게 그대로 쓰지는 마세요.'
    : "";

  const system = `당신은 일본 여행사 '${brandName}'의 카카오톡 AI 상담 챗봇입니다. ${tone}
[참고 자료]에 있는 내용만 근거로 답하세요. 참고 자료에 없는 내용은 추측하지 말고, 담당자 상담을 안내하세요.
"참고 자료", "자료에 따르면" 같은 내부 표현은 쓰지 마세요.
카카오톡 말풍선에 맞게 질문에 대한 답부터 바로 쓰고, 400자 안쪽으로 짧게 답하세요.
"안녕하세요", "일본스토리입니다" 같은 인사·자기소개와 "편하게 문의해 주세요" 같은 맺음말은 쓰지 마세요.
마크다운 기호(**, #, 표)는 쓰지 말고 줄바꿈과 '·' 정도만 쓰세요.
고객이 관(건물)·객실·박수·인원·상품을 정하지 않고 물었는데 참고 자료에서 그 값에 따라 답이 다르면,
한쪽으로 일반화하지 말고 경우별로 나눠 답하세요(예: "소라관은 미포함, 호시관·니지관은 포함").
"경우별로 안내드렸습니다"처럼 답변 방식을 설명하는 문장은 쓰지 마세요.
상품을 정하지 않은 질문은 경우별로 답하세요(예: 아이 나이 기준·아기 요금은 패키지와 스기노이 기준을 나눠 안내).

[운영 규칙]
${settings.extra_rules || "-"}
${pendingRule}

질문 가운데 참고 자료로 답하지 못한 부분이 있으면, 답변을 다 쓴 뒤 마지막 줄에
"[REF_GAP: 답하지 못한 내용]" 형식으로 짧게 적으세요(예: [REF_GAP: 비자 필요 여부]). 모두 답했다면 붙이지 마세요.`;

  const blocks = used.map((d) => {
    const tag = d.verification === VERIFY_PENDING ? ' 상태="미확정"' : "";
    return `<자료 id="${d.source_id}"${tag}>\n${d.content}\n</자료>`;
  });

  const qBlock =
    rewritten && rewritten.trim() !== question.trim()
      ? `[고객 질문 — 이전 대화에 이어진 질문을 풀어쓴 것]\n${rewritten}`
      : `[고객 질문]\n${question}`;

  const prompt = `[참고 자료]\n${blocks.join("\n\n")}\n\n${qBlock}`;
  return { system, prompt };
}

function toJamo(text: string): string {
  const out: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 0xac00;
    if (code >= 0 && code < 11172) {
      const cho = Math.floor(code / 588);
      const jung = Math.floor((code % 588) / 28);
      const jong = code % 28;
      out.push(
        String.fromCharCode(0x1100 + cho),
        String.fromCharCode(0x1161 + jung)
      );
      if (jong !== 0) {
        out.push(String.fromCharCode(0x11a7 + jong));
      }
    } else {
      out.push(text[i]);
    }
  }
  return out.join("");
}

function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, idx) => idx);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1).fill(0);
    cur[0] = i;
    const ca = a[i - 1];
    for (let j = 1; j <= b.length; j++) {
      const cb = b[j - 1];
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (ca !== cb ? 1 : 0)
      );
    }
    prev = cur;
  }
  return prev[b.length] <= 1;
}

// 항목의 '○○관'(소라관·호시관·니지관)을 낱말 단위로 뽑는다. 앞뒤가 글자가 아니어야 하므로
// "(소라관"·"·호시관"처럼 문장부호가 붙거나 "일일관광"·"박물관견학"의 일부를 잡지 않는다.
// JS의 \W는 한글을 '글자 아님'으로 보므로 쓰지 않는다. (rag.py PLACE_SUFFIX와 같은 규칙)
const PLACE_SUFFIX = /(?<![가-힣A-Za-z0-9])([가-힣A-Za-z0-9]{1,3}관)(?![가-힣A-Za-z0-9])/g;

export function placeTokens(doc: Pick<MatchedDocument, "destination" | "title">): string[] {
  const words = (doc.destination || "")
    .split(/[\s·,()/]+/)
    .filter((w) => w.length >= 2 && w !== "호텔");
  const titleMatches = Array.from((doc.title || "").matchAll(PLACE_SUFFIX)).map(
    (m) => m[1]
  );
  return [...words, ...titleMatches];
}

export function mentionsDestination(
  query: string,
  destination: string,
  extra?: string[]
): boolean {
  const normQuery = (query || "").normalize("NFC");
  let q = normQuery.replace(/\s+/g, "");
  const low = normQuery.toLowerCase();
  for (const [en, ko] of Object.entries(ROMAN)) {
    if (low.includes(en)) {
      q += ko;
    }
  }

  const tokens = [
    ...(destination || "")
      .split(/[\s·,()/]+/)
      .filter((w) => w.length >= 2 && w !== "호텔"),
    ...(extra || []),
  ];

  for (const t of tokens) {
    if (q.includes(t)) return true;
    const tj = toJamo(t);
    for (let i = 0; i <= q.length - t.length; i++) {
      const sub = q.slice(i, i + t.length);
      if (withinOneEdit(toJamo(sub), tj)) {
        return true;
      }
    }
  }
  return false;
}

export function filterPriceContext(
  query: string,
  used: MatchedDocument[]
): { keep: MatchedDocument[]; dropped: boolean } {
  const keep: MatchedDocument[] = [];
  let dropped = false;
  for (const d of used) {
    if (
      (d.category || "").startsWith("가격_") &&
      d.destination &&
      !mentionsDestination(query, d.destination, placeTokens(d))
    ) {
      dropped = true;
      continue;
    }
    keep.push(d);
  }
  return { keep, dropped };
}

export async function pickImage(
  brand: string,
  used: MatchedDocument[],
  text: string
): Promise<{ imageUrl: string; badge: string }> {
  if (!used.length) return { imageUrl: "", badge: "" };
  const images = await getImages(
    brand,
    used.map((d) => d.source_id)
  );

  for (let i = 0; i < used.length; i++) {
    const d = used[i];
    const url = images[d.source_id];
    if (!url) continue;

    const words = (d.destination || "")
      .split(/[\s·,()/]+/)
      .filter((w) => w.length >= 2 && w !== "호텔");

    const badge =
      d.destination && d.travel_type && d.travel_type !== "공통"
        ? `${d.destination} · ${d.travel_type}`
        : d.destination || d.title || "일본스토리 추천";

    if (!words.length) {
      if (i === 0) return { imageUrl: url, badge };
      continue;
    }
    if (words.some((w) => text.includes(w))) {
      return { imageUrl: url, badge };
    }
  }
  return { imageUrl: "", badge: "" };
}

export async function searchDocuments(
  brand: string,
  question: string,
  travelTypes?: string[] | null,
  matchCount: number = 10,
  deadline?: number
): Promise<MatchedDocument[]> {
  const geminiKey = await getApiKey("gemini");
  const vec = await embedQuery(question, geminiKey, deadline);
  const hits = await matchDocuments(brand, vec, question, matchCount, travelTypes);
  const vectorHits = hits
    .filter((h) => h.match_source === "vector")
    .sort((a, b) => b.similarity - a.similarity);
  const keywordHits = hits.filter((h) => h.match_source === "keyword");
  return [...vectorHits, ...keywordHits];
}

export async function answerQuestion(params: {
  brand: string;
  question: string;
  settings: BotSettings;
  travelTypes?: string[] | null;
  history?: ChatTurn[];
  log?: boolean;
  /** 이 시각(Date.now() 기준 ms)까지 답을 끝낸다. 넘기면 상담 연결 안내로 끝낸다. */
  deadline?: number;
}): Promise<RagAnswer> {
  const brand = params.brand;
  const question = (params.question || "").normalize("NFC").trim();
  const history = (params.history || []).map((m) => ({
    role: m.role,
    content: (m.content || "").normalize("NFC"),
  }));
  const settings = params.settings;
  const log = params.log ?? true;

  const searchQ =
    history.length > 0
      ? await rewriteQuery(
          question,
          history,
          settings,
          Math.min(params.deadline ?? Infinity, Date.now() + REWRITE_BUDGET_MS)
        )
      : question;

  let hits: MatchedDocument[] = [];
  try {
    hits = await searchDocuments(brand, searchQ, params.travelTypes, 10, params.deadline);
  } catch (err: any) {
    return {
      text: `잠시 검색 중 오류가 발생했습니다. 아래 상담 버튼으로 문의해 주시면 빠르게 안내드리겠습니다.`,
      status: "error",
      failure_type: "error",
      top_similarity: 0,
      search_query: searchQ,
      image: "",
      destination_badge: "",
      buttons: buildHandoffButtons(
        settings.handoff,
        "error",
        "error",
        [],
        ""
      ),
    };
  }

  const logQuery = searchQ;
  const logPrefix = searchQ !== question ? `(고객 원문: ${question})\n` : "";
  const vectorHits = hits.filter((h) => h.match_source === "vector");
  const top = vectorHits.length > 0 ? vectorHits[0].similarity : 0.0;
  const gate = settings.answer_threshold ?? 0.65;
  const ctxMin = settings.context_threshold ?? 0.55;
  const k = settings.top_k ?? 5;
  const fallbackText =
    settings.fallback_message || "담당자가 확인 후 안내드리겠습니다.";

  const makeFallback = async (
    ftype: string,
    text: string = fallbackText,
    used: MatchedDocument[] = [],
    raw: string = ""
  ): Promise<RagAnswer> => {
    if (log) {
      await logFallback({
        brand,
        channel: "web",
        user_query: logQuery,
        bot_answer: logPrefix + (raw || text),
        top_similarity: Number(top.toFixed(4)),
        top_source_id: vectorHits[0]?.source_id || null,
        failure_type: ftype,
      });
    }
    const buttons = buildHandoffButtons(
      settings.handoff,
      "fallback",
      ftype,
      used,
      text
    );
    return {
      text,
      status: "fallback",
      failure_type: ftype,
      top_similarity: top,
      search_query: searchQ,
      image: "",
      destination_badge: "",
      buttons,
    };
  };

  if (vectorHits.length === 0) {
    return makeFallback("no_match");
  }
  if (top < gate) {
    return makeFallback("low_confidence");
  }

  let used = vectorHits.filter((h) => h.similarity >= ctxMin).slice(0, k);
  const usedIds = new Set(used.map((h) => h.id));
  const extraKeyword = hits
    .filter((h) => h.match_source === "keyword" && !usedIds.has(h.id))
    .slice(0, 2);
  used = [...used, ...extraKeyword];

  const { keep, dropped } = filterPriceContext(searchQ, used);
  used = keep;

  if (used.length === 0 && dropped) {
    const buttons = buildHandoffButtons(
      settings.handoff,
      "answered",
      "clarify",
      [],
      CLARIFY_TEXT
    );
    return {
      text: CLARIFY_TEXT,
      status: "answered",
      failure_type: "clarify",
      top_similarity: top,
      search_query: searchQ,
      image: "",
      destination_badge: "",
      buttons,
    };
  }

  const { system, prompt } = buildPrompt(settings, question, used, searchQ);
  const provider = settings.answer_provider || "gemini";

  let raw = "";
  try {
    const [model, key] = await Promise.all([
      getProviderModel(provider),
      getApiKey(provider),
    ]);
    raw = await generateAnswer(provider, model, key, system, prompt, params.deadline);
  } catch (err: any) {
    return makeFallback("error", fallbackText, used, String(err));
  }

  let gap: string | null = null;
  for (const match of raw.matchAll(GAP_PATTERN)) {
    if (match[1] && match[1].trim()) {
      gap = match[1].trim();
    }
  }

  let text = cleanAnswer(raw.replace(GAP_PATTERN, ""));
  if (gap) {
    if (log) {
      await logFallback({
        brand,
        channel: "web",
        user_query: logQuery,
        bot_answer: logPrefix + text,
        top_similarity: Number(top.toFixed(4)),
        top_source_id: used[0]?.source_id || null,
        failure_type: "ref_gap",
      });
    }
    text += "\n\n" + fallbackText;
  }

  let imageUrl = "";
  let badge = "";
  try {
    const picked = await pickImage(brand, used, text);
    imageUrl = picked.imageUrl;
    badge = picked.badge;
  } catch {
    // ignore image errors
  }

  const failureType = gap ? "ref_gap" : null;
  const buttons = buildHandoffButtons(
    settings.handoff,
    "answered",
    failureType,
    used,
    text
  );

  return {
    text,
    status: "answered",
    failure_type: failureType,
    top_similarity: top,
    search_query: searchQ,
    image: imageUrl,
    destination_badge: badge,
    buttons,
  };
}
