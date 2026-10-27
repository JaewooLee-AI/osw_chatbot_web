"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  RotateCcw,
  Send,
  Sparkles,
  X,
  Clock,
  MessageCircle,
  Plane,
  ChevronRight,
  Calculator,
} from "lucide-react";
import MessageBubble, { ChatMessageItem } from "./MessageBubble";
import QuoteCard, { QuoteConfig } from "./QuoteCard";
import {
  DEFAULT_BRAND_CODE,
  DEFAULT_BRAND_LABEL,
  DEFAULT_HOMEPAGE,
  DEFAULT_KAKAO_CHAT_URL,
  OPERATING_HOURS,
  QUICK_QUESTIONS,
  TRAVEL_TYPES,
  TravelTypeItem,
} from "@/lib/widgetConfig";

interface WidgetConfig {
  brand: string;
  brand_name: string;
  travel_types: TravelTypeItem[];
  quick_questions: Record<string, string[]>;
  operating_hours: string;
  kakao_chat_url: string;
  homepage: string;
  quote?: QuoteConfig;
}

// /api/config를 받기 전·실패했을 때 쓰는 값. 서버와 같은 원본(widgetConfig.ts)을 쓴다.
const DEFAULT_CONFIG: WidgetConfig = {
  brand: DEFAULT_BRAND_CODE,
  brand_name: DEFAULT_BRAND_LABEL,
  travel_types: TRAVEL_TYPES,
  quick_questions: QUICK_QUESTIONS,
  operating_hours: OPERATING_HOURS,
  kakao_chat_url: DEFAULT_KAKAO_CHAT_URL,
  homepage: DEFAULT_HOMEPAGE,
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

interface ChatWidgetProps {
  brand?: string;
  isEmbedded?: boolean;
  onClose?: () => void;
  initialQuestion?: string;
}

export default function ChatWidget({
  brand = "japan",
  isEmbedded = false,
  onClose,
  initialQuestion,
}: ChatWidgetProps) {
  const [config, setConfig] = useState<WidgetConfig>(DEFAULT_CONFIG);
  const [selectedType, setSelectedType] = useState<string>("전체");
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [quoteOpen, setQuoteOpen] = useState<boolean>(false);
  const [viewportHeight, setViewportHeight] = useState<string>("100%");

  const scrollEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialSentRef = useRef<boolean>(false);

  // 초기 설정 로드
  useEffect(() => {
    let active = true;
    fetch(`/api/config?brand=${encodeURIComponent(brand)}`)
      .then((res) => res.json())
      .then((data) => {
        if (active && data && data.brand_name) {
          setConfig((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {
        // fallback to default config
      });
    return () => {
      active = false;
    };
  }, [brand]);

  // 모바일 가상 키보드 올라올 때 visualViewport 높이 대응
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewportHeight(`${vv.height}px`);
      } else {
        setViewportHeight("100%");
      }
    };
    handleResize();
    vv.addEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);
    return () => {
      vv.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const sendQuestion = useCallback(
    async (questionText: string) => {
      const q = questionText.trim();
      if (!q || isLoading) return;

      const nowStr = formatTime(new Date());
      const userMsg: ChatMessageItem = {
        id: `user-${Date.now()}`,
        role: "user",
        content: q,
        timestamp: nowStr,
      };

      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand,
            question: q,
            travel_type: selectedType,
            history: historyPayload,
          }),
        });

        const data = await res.json();
        const botMsg: ChatMessageItem = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content:
            data.text ||
            "문의하신 내용은 담당자가 확인 후 빠르게 안내드리겠습니다.",
          timestamp: formatTime(new Date()),
          status: data.status || "answered",
          failure_type: data.failure_type || null,
          search_query: data.search_query || q,
          image: data.image || "",
          destination_badge: data.destination_badge || "",
          buttons: Array.isArray(data.buttons) ? data.buttons : [],
        };
        setMessages((prev) => [...prev, botMsg]);
      } catch {
        const errMsg: ChatMessageItem = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content:
            "네트워크 연결이 원활하지 않습니다. 잠시 후 다시 질문해 주시거나 카카오톡 상담을 이용해 주세요.",
          timestamp: formatTime(new Date()),
          status: "error",
          failure_type: "error",
          buttons: [
            {
              kind: "kakao",
              label: "카카오톡으로 상담하기",
              url: config.kakao_chat_url,
            },
          ],
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [brand, config.kakao_chat_url, isLoading, messages, selectedType]
  );

  // 외부에서 초기 질문이 전달된 경우 1회 자동 실행
  useEffect(() => {
    if (initialQuestion && !initialSentRef.current) {
      initialSentRef.current = true;
      sendQuestion(initialQuestion);
    }
  }, [initialQuestion, sendQuestion]);

  const handleClear = () => {
    setMessages([]);
    setInput("");
    setQuoteOpen(false);
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage({ type: "OSW_CHATBOT_CLOSE" }, "*");
    }
  };

  const currentQuickQuestions =
    config.quick_questions[selectedType] ||
    config.quick_questions["전체"] ||
    DEFAULT_CONFIG.quick_questions["전체"];

  return (
    <div
      style={{ height: isEmbedded ? viewportHeight : "100%" }}
      className="flex flex-col w-full h-full bg-ivory text-navy overflow-hidden"
    >
      {/* 1. Top Header (Deep Ocean Navy #0F2942) */}
      <header className="bg-navy text-white px-4 py-3.5 pt-safe flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 shadow-inner">
            <Plane className="w-5 h-5 text-sky" />
          </div>
          <div className="min-w-0">
            <h1 className="font-serif font-semibold text-base sm:text-[17px] tracking-tight truncate">
              {config.brand_name} AI 여행 컨시어지
            </h1>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[11px] text-white/85 font-medium truncate">
                실시간 맞춤 여행·요금 안내
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              title="대화 지우기"
              className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-medium text-white flex items-center gap-1 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">초기화</span>
            </button>
          )}
          {(isEmbedded || onClose) && (
            <button
              type="button"
              onClick={handleClose}
              aria-label="챗봇 닫기"
              className="min-h-[38px] min-w-[38px] p-2 rounded-lg hover:bg-white/15 active:scale-95 text-white/90 hover:text-white flex items-center justify-center transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* 2. Travel Type Filter Pills (Horizontal Touch Scroll) */}
      <nav
        aria-label="여행유형 범위 선택"
        className="bg-ivory-sand border-b border-ivory-border/80 px-3.5 py-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 z-10"
      >
        {config.travel_types.map((t) => {
          const active = selectedType === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedType(t.id)}
              className={`min-h-[34px] px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                active
                  ? "bg-navy text-white shadow-sm"
                  : "bg-white text-navy/75 border border-ivory-border hover:bg-ivory hover:text-navy"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* 3. Main Chat Stream */}
      <main className="flex-1 overflow-y-auto chat-scroll px-3.5 sm:px-4 py-4 space-y-5">
        {/* Welcome Concierge Card */}
        <div className="bg-white border border-ivory-border/90 rounded-2xl p-4 shadow-card space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase text-coral bg-coral-soft px-2.5 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                PRIVATE JAPAN CONCIERGE
              </span>
              <h2 className="font-serif font-semibold text-[16px] text-navy pt-0.5">
                어느 일본 여행지를 계획하고 계신가요?
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                우리 일행만을 위한 <strong>단독패키지</strong>, <strong>벳푸 스기노이 호텔</strong>,{" "}
                <strong>프리미엄 골프</strong>, <strong>일일투어</strong> 요금과 일정을 실시간으로 안내해 드립니다.{" "}
                <span className="text-navy/80 font-medium">
                  (&ldquo;그럼 6명은요?&rdquo;처럼 이어서 물어보셔도 기억합니다!)
                </span>
              </p>
            </div>
          </div>

          {config.quote?.enabled && !quoteOpen && (
            <button
              type="button"
              onClick={() => setQuoteOpen(true)}
              className="w-full min-h-[46px] rounded-xl bg-coral hover:bg-coral-hover text-white text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.99]"
            >
              <Calculator className="w-4 h-4" /> 간단견적 받아보기
            </button>
          )}

          {/* Suggested Questions List inside Welcome Card when chat is empty */}
          {messages.length === 0 && (
            <div className="pt-1 space-y-2">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>
                  자주 묻는 질문 ({selectedType === "전체" ? "전체" : selectedType})
                </span>
                <span className="text-[10px] text-slate-400">터치하여 바로 질문</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {currentQuickQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={isLoading}
                    onClick={() => sendQuestion(q)}
                    className="w-full min-h-[42px] text-left px-3.5 py-2.5 rounded-xl bg-ivory hover:bg-sky-tint/70 active:scale-[0.99] border border-ivory-border/80 hover:border-sky/40 text-xs sm:text-[13px] font-medium text-navy flex items-center justify-between gap-2 transition-all group"
                  >
                    <span className="line-clamp-1">{q}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-coral group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {quoteOpen && config.quote?.enabled && (
          <QuoteCard brand={brand} config={config.quote} kakaoUrl={config.kakao_chat_url} onClose={() => setQuoteOpen(false)} />
        )}

        {/* Rendered Conversation Messages */}
        {messages.map((msg, index) => {
          const prevUserQuestion =
            msg.role === "assistant" && index > 0 && messages[index - 1]?.role === "user"
              ? messages[index - 1].content
              : undefined;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              originalQuestion={prevUserQuestion}
            />
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start space-x-2.5 animate-fadeIn">
            <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-white shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4 text-sky animate-spin" />
            </div>
            <div className="bg-white border border-ivory-border/80 rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-card flex items-center space-x-2.5">
              <div className="flex space-x-1">
                <span className="w-2 h-2 rounded-full bg-coral animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-coral animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-coral animate-bounce" />
              </div>
              <span className="text-xs font-medium text-slate-600">
                검증된 여행 지식에서 정확한 안내를 찾는 중입니다…
              </span>
            </div>
          </div>
        )}

        <div ref={scrollEndRef} className="h-1" />
      </main>

      {/* 4. Bottom Fixed Input & Quick Chips Bar */}
      <footer className="bg-white border-t border-ivory-border px-3.5 pt-2.5 pb-safe shrink-0 shadow-[0_-4px_20px_-4px_rgba(15,41,66,0.06)] z-20">
        {/* Horizontal Quick Prompt Chips when conversation has started */}
        {messages.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2">
            {currentQuickQuestions.map((q) => (
              <button
                key={q}
                type="button"
                disabled={isLoading}
                onClick={() => sendQuestion(q)}
                className="min-h-[32px] px-3 py-1 rounded-full bg-ivory-sand hover:bg-sky-tint text-navy/85 hover:text-navy border border-ivory-border text-xs font-medium whitespace-nowrap transition-colors shrink-0 active:scale-95"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input Form (16px font on mobile to prevent iOS Safari auto-zoom) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuestion(input);
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="궁금한 여행지·인원·일정을 물어보세요..."
              className="w-full min-h-[46px] bg-ivory border border-ivory-border focus:border-navy focus:bg-white rounded-xl px-3.5 py-2.5 text-[16px] sm:text-sm text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy/15 transition-all disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="질문 보내기"
            className="min-h-[46px] min-w-[46px] px-4 rounded-xl bg-coral hover:bg-coral-hover disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">전송</span>
          </button>
        </form>

        {/* Footer Info & Direct Kakao Link */}
        <div className="mt-2 pb-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1 truncate">
            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{config.operating_hours}</span>
          </div>
          <a
            href={config.kakao_chat_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-navy hover:text-coral shrink-0 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-kakao text-navy" />
            <span>카톡 바로상담</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
