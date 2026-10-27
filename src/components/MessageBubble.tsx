"use client";

import React, { useState } from "react";
import {
  Compass,
  FileEdit,
  MessageCircle,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Calculator,
} from "lucide-react";
import type { HandoffButton } from "@/lib/handoff";

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  status?: "answered" | "fallback" | "error";
  failure_type?: string | null;
  search_query?: string;
  image?: string;
  destination_badge?: string;
  buttons?: HandoffButton[];
  /** 가격 질문에 대한 답변 아래에 [내 조건으로 가견적 받기] 버튼을 보일지 */
  showQuote?: boolean;
}

interface MessageBubbleProps {
  message: ChatMessageItem;
  originalQuestion?: string;
  onQuote?: () => void;
}

export default function MessageBubble({
  message,
  originalQuestion,
  onQuote,
}: MessageBubbleProps) {
  const [imgError, setImgError] = useState(false);
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex flex-col items-end space-y-1 animate-fadeIn">
        <div className="bg-navy text-white rounded-2xl rounded-br-sm px-4 py-3 max-w-[85%] sm:max-w-[80%] shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </div>
        <span className="text-[11px] text-slate-400 px-1">
          {message.timestamp}
        </span>
      </div>
    );
  }

  const showRewritten =
    message.search_query &&
    originalQuestion &&
    message.search_query.trim() !== originalQuestion.trim();

  return (
    <div className="flex items-start space-x-2.5 animate-fadeIn">
      {/* Bot Avatar */}
      <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5 border border-navy/10">
        <Sparkles className="w-4 h-4 text-sky" />
      </div>

      <div className="flex flex-col space-y-1.5 max-w-[88%] sm:max-w-[84%] w-full">
        {/* Status / Rewritten Query Pill */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-navy/80">
            일본스토리 AI 컨시어지
          </span>
          {message.failure_type === "clarify" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
              <HelpCircle className="w-3 h-3" />
              여행지 확인
            </span>
          )}
          {message.status === "fallback" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-coral/10 text-coral border border-coral/20">
              <AlertCircle className="w-3 h-3" />
              전문 상담원 연결 안내
            </span>
          )}
          {message.status === "answered" && !message.failure_type && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
              <CheckCircle2 className="w-3 h-3" />
              맞춤 안내
            </span>
          )}
        </div>

        {showRewritten && (
          <div className="text-[11px] text-navy/60 bg-sky-tint/80 border border-sky/20 rounded-lg px-2.5 py-1 inline-block w-fit">
            이어 묻기 검색: <span className="font-medium text-navy">{message.search_query}</span>
          </div>
        )}

        {/* Main Bot Card */}
        <div className="bg-white border border-ivory-border/80 rounded-2xl rounded-tl-sm p-3.5 sm:p-4 shadow-card space-y-3.5">
          {/* Destination Image Card (if provided by pickImage) */}
          {message.image && !imgError && (
            <div className="relative rounded-xl overflow-hidden bg-ivory-sand border border-ivory-border/50 aspect-[16/10] w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.image}
                alt={message.destination_badge || "일본스토리 여행지 이미지"}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                loading="lazy"
                onError={() => setImgError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-dark/75 via-transparent to-transparent flex items-end p-3">
                <span className="bg-white/95 text-navy px-3 py-1 rounded-full text-xs font-semibold shadow-sm backdrop-blur-sm">
                  {message.destination_badge || "일본스토리 추천 여행지"}
                </span>
              </div>
            </div>
          )}

          {/* Answer Text */}
          <div className="text-[15px] leading-[1.65] text-navy whitespace-pre-wrap break-words">
            {message.content}
          </div>

          {message.showQuote && onQuote && (
            <button
              type="button"
              onClick={onQuote}
              className="w-full min-h-[46px] bg-navy hover:bg-navy-dark active:scale-[0.99] text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <Calculator className="w-4 h-4 shrink-0" />
              내 조건으로 가견적 받기
            </button>
          )}

          {/* 3 Action Handoff Buttons (Product / Google Form Prefill / Kakao 1:1) */}
          {message.buttons && message.buttons.length > 0 && (
            <div className="pt-2 border-t border-ivory-border/60 flex flex-col gap-2">
              {message.buttons.map((btn, idx) => {
                if (btn.kind === "product") {
                  return (
                    <a
                      key={`${btn.kind}-${idx}`}
                      href={btn.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full min-h-[46px] bg-coral hover:bg-coral-hover active:scale-[0.99] text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-between group"
                    >
                      <span className="flex items-center gap-2">
                        <Compass className="w-4 h-4 shrink-0" />
                        <span>{btn.label}</span>
                      </span>
                      <ExternalLink className="w-4 h-4 opacity-80 group-hover:translate-x-0.5 transition-transform" />
                    </a>
                  );
                }

                if (btn.kind === "form") {
                  return (
                    <a
                      key={`${btn.kind}-${idx}`}
                      href={btn.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full min-h-[46px] bg-ivory hover:bg-ivory-sand active:scale-[0.99] text-navy border border-navy/20 font-semibold text-sm px-4 py-2.5 rounded-xl transition-all flex items-center justify-between group"
                    >
                      <span className="flex items-center gap-2">
                        <FileEdit className="w-4 h-4 text-navy shrink-0" />
                        <span>{btn.label}</span>
                      </span>
                      <span className="text-xs text-navy/60 font-normal group-hover:text-navy">
                        맞춤 견적 신청 →
                      </span>
                    </a>
                  );
                }

                return (
                  <a
                    key={`${btn.kind}-${idx}`}
                    href={btn.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[46px] bg-kakao hover:brightness-95 active:scale-[0.99] text-kakao-text font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 fill-current shrink-0" />
                      <span>{btn.label}</span>
                    </span>
                    <span className="text-xs opacity-75 font-medium">
                      1:1 실시간 연결
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <span className="text-[11px] text-slate-400 px-1">
          {message.timestamp}
        </span>
      </div>
    </div>
  );
}
