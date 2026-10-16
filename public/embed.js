/**
 * 일본스토리 (세상에없는여행) AI 여행 컨시어지 임베드 스크립트 (embed.js)
 *
 * 사용법 (고객사 홈페이지 </body> 직전에 삽입):
 * <script src="https://배포도메인/embed.js" data-brand="japan" data-position="right" data-mobile-bottom="24px" defer></script>
 */
(function () {
  if (typeof window === "undefined" || window.__OSW_CHATBOT_LOADED__) return;
  window.__OSW_CHATBOT_LOADED__ = true;

  var scriptEl =
    document.currentScript ||
    document.querySelector('script[src*="embed.js"]');

  var scriptSrc = scriptEl ? scriptEl.getAttribute("src") || "" : "";
  var baseUrl = "";
  try {
    var parsed = new URL(scriptSrc, window.location.href);
    baseUrl = parsed.origin;
  } catch (e) {
    baseUrl = window.location.origin;
  }

  var brand = (scriptEl && scriptEl.getAttribute("data-brand")) || "japan";
  var position =
    (scriptEl && scriptEl.getAttribute("data-position")) === "left"
      ? "left"
      : "right";
  var mobileBottom =
    (scriptEl && scriptEl.getAttribute("data-mobile-bottom")) || "20px";
  var desktopBottom =
    (scriptEl && scriptEl.getAttribute("data-desktop-bottom")) || "28px";
  var labelText =
    (scriptEl && scriptEl.getAttribute("data-label")) || "AI 여행 상담";

  var isOpen = false;
  var savedBodyOverflow = "";

  // 스타일 주입 (호스트 홈페이지 CSS와 충돌 방지용 고유 클래스)
  var style = document.createElement("style");
  style.id = "osw-chatbot-embed-styles";
  style.textContent = [
    ".osw-cb-launcher-wrap {",
    "  position: fixed;",
    "  z-index: 2147483640;",
    "  " + position + ": 24px;",
    "  bottom: " + desktopBottom + ";",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 10px;",
    "  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Noto Sans KR', sans-serif;",
    "}",
    ".osw-cb-launcher-pill {",
    "  background: #FFFFFF;",
    "  color: #0F2942;",
    "  border: 1px solid rgba(15, 41, 66, 0.12);",
    "  padding: 9px 14px;",
    "  border-radius: 9999px;",
    "  font-size: 13px;",
    "  font-weight: 600;",
    "  box-shadow: 0 8px 24px rgba(15, 41, 66, 0.14);",
    "  cursor: pointer;",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 6px;",
    "  transition: transform 0.2s ease, opacity 0.2s ease;",
    "  white-space: nowrap;",
    "}",
    ".osw-cb-launcher-pill:hover { transform: translateY(-2px); }",
    ".osw-cb-dot {",
    "  width: 8px;",
    "  height: 8px;",
    "  border-radius: 50%;",
    "  background: #10B981;",
    "  display: inline-block;",
    "}",
    ".osw-cb-fab {",
    "  width: 60px;",
    "  height: 60px;",
    "  border-radius: 9999px;",
    "  background: #0F2942;",
    "  color: #FFFFFF;",
    "  border: 2px solid rgba(255, 255, 255, 0.85);",
    "  box-shadow: 0 12px 28px rgba(15, 41, 66, 0.28);",
    "  cursor: pointer;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease;",
    "  padding: 0;",
    "}",
    ".osw-cb-fab:hover { transform: scale(1.05); background: #163859; }",
    ".osw-cb-fab:active { transform: scale(0.96); }",
    ".osw-cb-panel {",
    "  position: fixed;",
    "  z-index: 2147483645;",
    "  " + position + ": 24px;",
    "  bottom: calc(" + desktopBottom + " + 72px);",
    "  width: 410px;",
    "  height: min(680px, calc(100dvh - 120px));",
    "  max-width: calc(100vw - 32px);",
    "  border-radius: 24px;",
    "  overflow: hidden;",
    "  background: #FAF8F5;",
    "  box-shadow: 0 24px 48px -12px rgba(15, 41, 66, 0.25), 0 8px 16px -4px rgba(15, 41, 66, 0.10);",
    "  border: 1px solid rgba(15, 41, 66, 0.12);",
    "  opacity: 0;",
    "  transform: translateY(16px) scale(0.97);",
    "  pointer-events: none;",
    "  transition: opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1), transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);",
    "}",
    ".osw-cb-panel.osw-cb-open {",
    "  opacity: 1;",
    "  transform: translateY(0) scale(1);",
    "  pointer-events: auto;",
    "}",
    ".osw-cb-iframe {",
    "  width: 100%;",
    "  height: 100%;",
    "  border: 0;",
    "  display: block;",
    "  background: #FAF8F5;",
    "}",
    "@media (max-width: 767px) {",
    "  .osw-cb-launcher-wrap {",
    "    " + position + ": 16px;",
    "    bottom: calc(" + mobileBottom + " + env(safe-area-inset-bottom, 0px));",
    "  }",
    "  .osw-cb-launcher-pill {",
    "    padding: 8px 12px;",
    "    font-size: 12px;",
    "  }",
    "  .osw-cb-fab {",
    "    width: 56px;",
    "    height: 56px;",
    "  }",
    "  .osw-cb-panel {",
    "    top: 0 !important;",
    "    left: 0 !important;",
    "    right: 0 !important;",
    "    bottom: 0 !important;",
    "    width: 100vw !important;",
    "    height: 100dvh !important;",
    "    max-width: 100vw !important;",
    "    max-height: 100dvh !important;",
    "    border-radius: 0 !important;",
    "    border: 0 !important;",
    "    transform: translateY(100%);",
    "  }",
    "  .osw-cb-panel.osw-cb-open {",
    "    transform: translateY(0);",
    "  }",
    "}",
  ].join("\n");
  document.head.appendChild(style);

  // 패널 & iframe 생성
  var panel = document.createElement("div");
  panel.className = "osw-cb-panel";
  panel.setAttribute("aria-hidden", "true");

  var iframe = document.createElement("iframe");
  iframe.className = "osw-cb-iframe";
  iframe.title = "일본스토리 AI 여행 컨시어지";
  iframe.allow = "clipboard-write";
  var iframeLoaded = false;

  function ensureIframeLoaded() {
    if (!iframeLoaded) {
      iframe.src =
        baseUrl + "/widget?brand=" + encodeURIComponent(brand);
      iframeLoaded = true;
    }
  }

  panel.appendChild(iframe);

  // 플로팅 런처 생성
  var wrap = document.createElement("div");
  wrap.className = "osw-cb-launcher-wrap";

  var pill = document.createElement("button");
  pill.type = "button";
  pill.className = "osw-cb-launcher-pill";
  // data-label 값은 글자로만 넣는다(HTML로 해석하지 않는다).
  var dot = document.createElement("span");
  dot.className = "osw-cb-dot";
  var labelSpan = document.createElement("span");
  labelSpan.textContent = labelText;
  pill.appendChild(dot);
  pill.appendChild(labelSpan);

  var fab = document.createElement("button");
  fab.type = "button";
  fab.className = "osw-cb-fab";
  fab.setAttribute("aria-label", "일본스토리 AI 여행 컨시어지 열기");

  var chatIconSvg =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M8 10h.01"></path><path d="M12 10h.01"></path><path d="M16 10h.01"></path></svg>';
  var closeIconSvg =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  fab.innerHTML = chatIconSvg;

  if (position === "left") {
    wrap.appendChild(fab);
    wrap.appendChild(pill);
  } else {
    wrap.appendChild(pill);
    wrap.appendChild(fab);
  }

  function setOpen(nextState) {
    isOpen = nextState;
    if (isOpen) {
      ensureIframeLoaded();
      panel.classList.add("osw-cb-open");
      panel.setAttribute("aria-hidden", "false");
      fab.innerHTML = closeIconSvg;
      fab.setAttribute("aria-label", "일본스토리 AI 여행 컨시어지 닫기");
      pill.style.display = "none";

      if (window.innerWidth < 768) {
        savedBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
      }
    } else {
      panel.classList.remove("osw-cb-open");
      panel.setAttribute("aria-hidden", "true");
      fab.innerHTML = chatIconSvg;
      fab.setAttribute("aria-label", "일본스토리 AI 여행 컨시어지 열기");
      pill.style.display = "flex";

      if (window.innerWidth < 768) {
        document.body.style.overflow = savedBodyOverflow || "";
      }
    }
  }

  fab.addEventListener("click", function () {
    setOpen(!isOpen);
  });
  pill.addEventListener("click", function () {
    setOpen(true);
  });

  window.addEventListener("message", function (event) {
    // 챗봇 iframe이 보낸 메시지만 받는다(호스트 페이지의 다른 스크립트·iframe이 열고 닫지 못하게).
    if (event.source !== iframe.contentWindow || event.origin !== baseUrl) return;
    if (event.data && event.data.type === "OSW_CHATBOT_CLOSE") {
      setOpen(false);
    } else if (event.data && event.data.type === "OSW_CHATBOT_OPEN") {
      setOpen(true);
    }
  });

  function mount() {
    document.body.appendChild(panel);
    document.body.appendChild(wrap);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  window.OSWChatbot = {
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: function () {
      setOpen(!isOpen);
    },
  };
})();
