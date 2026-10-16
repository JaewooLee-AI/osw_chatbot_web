# 일본스토리 (세상에없는여행) 웹 기반 AI 여행 컨시어지 (`osw_chatbot_web`)

고객사 홈페이지(`https://japan.onlytour.co.kr` 등)에 1줄 스크립트로 탑재할 수 있고, **데스크톱 팝오버 및 모바일 풀스크린(`100dvh`)** 환경에 완벽히 최적화된 웹 기반 RAG 챗봇입니다.

관리자 프로젝트(`../osw_chatbot_admin`)와 동일한 Supabase 데이터베이스(`rag_documents`, `bot_settings`, `llm_providers`, `fallback_logs`, Storage `chatbot-images`, Vault `get_llm_api_key`) 및 동일한 답변 규칙(`rewrite_query` → `match_documents` → `filter_price_context` → `pick_image` → `handoff.buttons`)으로 동작합니다.

---

## 1. 주요 기능

- **Stitch 기반 에디토리얼 럭셔리 여행 UI**:
  - 딥 오션 네이비(`#0F2942`), 선셋 코랄(`#FF5A36`), 웜 아이보리(`#FAF8F5`), 카카오 옐로우(`#FEE500`) 컬러 시스템과 `Pretendard` / `Noto Serif KR` 타이포그래피 적용
- **모바일 완벽 최적화 (Mobile-First UX)**:
  - **반응형 전환**: 데스크톱(`>= 768px`)에서는 우측 하단 플로팅 팝오버(`410×680px`), 모바일(`< 768px`)에서는 화면 전체를 덮는 풀스크린 시트(`100vw × 100dvh`)로 자동 전환
  - **가상 키보드 및 Safe Area 대응**: `VisualViewport` API 연동으로 모바일 키보드 올라옴 시 레이아웃 깨짐 방지, iOS 노치/홈 인디케이터 `env(safe-area-inset-*)` 적용, 입력창 `16px` 고정(iOS 자동 줌 방지)
  - **터치 스와이프 UI**: 여행유형 필터(`전체`, `단독패키지`, `스기노이호텔`, `골프여행`, `일일투어`) 및 추천 질문 칩 가로 터치 스크롤, 최소 `46px` 터치 타겟 확보
- **검증된 RAG 파이프라인 100% 호환**:
  - 최근 3턴 대화 맥락을 반영하는 **이어 묻기 질문 풀어쓰기(`rewriteQuery`)**
  - `gemini-embedding-001` (1536차원, L2 정규화) + `match_documents` 하이브리드 검색
  - 자모 1타 오타·영문 지명·관 이름을 허용하는 **여행지 가격표 필터링(`filterPriceContext`)** 및 여행지 미지정 시 자동 되묻기(`clarify`)
  - 답변 내용과 일치하는 **여행지 대표 사진 자동 매칭(`pickImage`)**
  - **3종 상담 연결 버튼(`buildHandoffButtons`)**: `상품 보러가기`, 구글 폼 미리채움 `상담 요청서 남기기`, `카카오톡으로 상담하기`

---

## 2. 로컬 실행 방법

```bash
npm install
npm run dev
```

- **쇼케이스 & 데모 페이지**: `http://localhost:3000`
- **임베드 전용 위젯 화면**: `http://localhost:3000/widget`

---

### 테스트

```bash
npm run typecheck   # 타입 검사
npm test            # 답변 규칙 테스트 (관리자 앱과 같은 공통 케이스)
```

- `tests/parity_cases.json`은 관리자 앱(`osw_chatbot_admin`)의 `tools/build_parity_cases.py`가 관리자 규칙으로 만든 기대값입니다. 두 저장소에 **같은 파일**을 두고 양쪽 테스트가 같은 케이스로 검사하므로, 한쪽만 규칙(말투·여행지 판정·가격표 거르기·상담 버튼 등)을 바꾸면 테스트가 실패합니다.
- 규칙을 일부러 바꿀 때: 양쪽 코드를 함께 고치고 → 관리자 저장소에서 `python3 tools/build_parity_cases.py` → 만들어진 파일을 이 저장소 `tests/`에 복사합니다.
- GitHub Actions(`.github/workflows/ci.yml`)가 PR·main push마다 타입 검사·테스트·빌드를 돌립니다.

---

## 3. Vercel 배포 방법

1. GitHub 저장소에 프로젝트를 푸시하거나 Vercel CLI(`npx vercel`)를 실행합니다.
2. Vercel 프로젝트 **Settings → Environment Variables**에 `.env`의 환경변수를 등록합니다:
   - `SUPABASE_URL`: `https://kkdnirublmowoujklhus.supabase.co`
   - `SUPABASE_service_role`: `(service_role 키 값)`
   - `SUPABASE_annon`: `(anon 키 값 - 선택)`
3. 배포가 완료되면 서울 리전(`icn1`, `vercel.json` 설정됨)에서 서버리스 API가 즉시 동작합니다.

### API 보호 (`/api/chat`)

- **출처 확인**: 위젯(`/widget`)은 같은 배포 도메인의 `/api/chat`을 부르므로 다른 사이트에서의 브라우저 호출은 403으로 막습니다. 다른 도메인에서 API를 직접 불러야 할 때만 `ALLOWED_ORIGINS`(쉼표 구분, 예: `https://japan.onlytour.co.kr`)를 설정합니다.
- **호출 횟수 제한**: 방문자(IP 해시)마다 분당 `CHAT_RATE_PER_MINUTE`(기본 10), 하루 `CHAT_RATE_PER_DAY`(기본 150)회. 초과하면 429와 카카오톡 상담 안내를 돌려줍니다.
  - Supabase SQL Editor에서 `osw_chatbot_admin/supabase/005_rate_limit.sql`을 **먼저 한 번 실행**해야 동작합니다. 실행 전에는 제한 없이 통과하며 Vercel 로그에 `[rate-limit]` 경고가 남습니다.

### 응답 시간·캐시·기록

- **응답 시간 한도**: Vercel 함수 제한(30초) 안에 반드시 답하도록, AI 호출(질문 풀어쓰기 → 임베딩 → 답변)은 요청 시작 후 24초 안에 끝냅니다. 질문 풀어쓰기에는 최대 7초만 씁니다. 넘기면 상담 연결 안내와 버튼으로 끝납니다.
- **설정 캐시**: 챗봇 설정·답변 모델·AI 키를 서버 메모리에 60초 기억합니다. 관리자 앱에서 바꾼 값은 최대 1분 뒤 반영됩니다.
- **미해결 질문 기록**: 홈페이지 질문은 채널 `web`으로 남습니다. Supabase에서 `osw_chatbot_admin/supabase/006_web_channel.sql`을 실행해야 하며, 실행 전에는 예전처럼 `simulator`로 남습니다.
- 오류 내용은 방문자에게 보내지 않고 Vercel 로그(`[api/chat]`, `[fallback_logs]`)에만 남깁니다.

### 상담 요청서(구글 폼) 버튼

폼 주소·항목 ID는 코드에 두지 않고 DB `bot_settings.handoff.form`을 따릅니다(관리자 앱 [챗봇 테스트]와 같은 규칙). 운영 폼으로 바꾸려면 `osw_chatbot`의 `폼정의.xlsx` '폼설정'에 운영 폼 응답 주소·항목 ID를 적고, 관리자 앱 **[챗봇 설정 → 폼정의·운영정보에서 가져오기]**를 누릅니다. 폼이 준비되지 않았으면(ready=false) 버튼을 숨깁니다.

---

## 4. 고객사 홈페이지 탑재 코드 (`embed.js`)

고객사 홈페이지 HTML의 `</body>` 직전에 아래 한 줄만 추가하면 데스크톱과 모바일 모두 자동으로 챗봇이 표시됩니다.

```html
<script
  src="https://배포된-도메인.vercel.app/embed.js"
  data-brand="japan"
  data-position="right"
  data-mobile-bottom="20px"
  defer
></script>
```

### 선택 속성 (`data-*`)
- `data-brand`: 브랜드 코드 (기본값: `"japan"`)
- `data-position`: `"right"` (기본값) 또는 `"left"`
- `data-mobile-bottom`: 모바일 하단 여백 (기본값: `"20px"`, 고객사 하단 네비게이션 바가 있을 경우 `"76px"` 등으로 조절 가능)
- `data-desktop-bottom`: 데스크톱 하단 여백 (기본값: `"28px"`)
- `data-label`: 런처 옆 안내 문구 (기본값: `"AI 여행 상담"`)
