"use client";

import React, { useState, useEffect } from "react";
import {
  Plane,
  Sparkles,
  MessageCircle,
  Copy,
  Check,
  Smartphone,
  Monitor,
  ExternalLink,
  MapPin,
  ShieldCheck,
  Code2,
  X,
} from "lucide-react";
import ChatWidget from "@/components/ChatWidget";

const CURATED_TOURS = [
  {
    tag: "스기노이호텔 · 큐슈 벳푸",
    title: "벳푸 스기노이 호텔 소라관·호시관",
    desc: "벳푸만을 바라보는 인피니티 노천온천 '타나유'와 프리미엄 월드 다이닝 뷔페가 포함된 큐슈 대표 온천 리조트",
    price: "맞춤 견적 · 조석식 안내",
    question: "스기노이 호텔 소라관 석식 포함인가요?",
    image:
      "https://kkdnirublmowoujklhus.supabase.co/storage/v1/object/public/chatbot-images/japan/b14048631c26e8cf.jpg",
  },
  {
    tag: "단독패키지 · 오사카·교토·고베",
    title: "우리 일행만 떠나는 오사카·교토 프라이빗 투어",
    desc: "4인 이상 가족·지인끼리 전용 차량과 베테랑 가이드가 함께하는 노쇼핑·노옵션 맞춤 단독 패키지",
    price: "3박 4일 · 인원별 요금 안내",
    question: "오사카 3박4일 4명이면 1인당 얼마예요?",
    image:
      "https://kkdnirublmowoujklhus.supabase.co/storage/v1/object/public/chatbot-images/japan/8588c8f2f9b5979d.jpg",
  },
  {
    tag: "골프여행 · 큐슈/시즈오카/나가사키",
    title: "일본 명문 구장 프리미엄 골프 투어",
    desc: "벳푸·시즈오카·나가사키 엄선된 명문 골프장 라운딩과 온천 휴양을 동시에 즐기는 프라이빗 골프 여행",
    price: "2박 3일 / 3박 4일 맞춤 견적",
    question: "벳푸 골프여행 3박4일 4명 요금 얼마예요?",
    image:
      "https://kkdnirublmowoujklhus.supabase.co/storage/v1/object/public/chatbot-images/japan/b14048631c26e8cf.jpg",
  },
];

export default function HomePage() {
  const [isWidgetOpen, setIsWidgetOpen] = useState<boolean>(true);
  const [activePrompt, setActivePrompt] = useState<string | undefined>(
    undefined
  );
  const [copied, setCopied] = useState<boolean>(false);
  const [origin, setOrigin] = useState<string>("https://osw-chatbot-web.vercel.app");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
      // 모바일 첫 진입 시에는 배경 페이지도 확인할 수 있게 기본 열림 상태를 유연하게 유지
    }
  }, []);

  const embedSnippet = `<!-- 일본스토리 AI 여행 컨시어지 위젯 (</body> 직전에 삽입) -->
<script
  src="${origin}/embed.js"
  data-brand="japan"
  data-position="right"
  data-mobile-bottom="20px"
  defer
></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const triggerQuestionInWidget = (q: string) => {
    setActivePrompt(q);
    setIsWidgetOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-ivory text-navy relative">
      {/* Top Editorial Navigation */}
      <header className="sticky top-0 z-30 bg-ivory/90 backdrop-blur-md border-b border-ivory-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-navy text-white flex items-center justify-center shadow-sm">
              <Plane className="w-5 h-5 text-sky" />
            </div>
            <div>
              <span className="font-serif font-bold text-lg tracking-tight text-navy">
                일본스토리
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs text-slate-500 font-medium">
                세상에없는여행 · 프라이빗 일본 맞춤 여행
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-7 text-sm font-medium text-navy/80">
            <button
              type="button"
              onClick={() =>
                triggerQuestionInWidget("오사카 3박4일 4명이면 1인당 얼마예요?")
              }
              className="hover:text-coral transition-colors"
            >
              단독패키지
            </button>
            <button
              type="button"
              onClick={() =>
                triggerQuestionInWidget("스기노이 호텔 소라관 석식 포함인가요?")
              }
              className="hover:text-coral transition-colors"
            >
              스기노이호텔
            </button>
            <button
              type="button"
              onClick={() =>
                triggerQuestionInWidget("벳푸 골프여행 3박4일 4명 요금 얼마예요?")
              }
              className="hover:text-coral transition-colors"
            >
              골프여행
            </button>
            <button
              type="button"
              onClick={() =>
                triggerQuestionInWidget("오사카 일일투어 요금이 얼마예요?")
              }
              className="hover:text-coral transition-colors"
            >
              일일투어
            </button>
          </nav>

          <div className="flex items-center space-x-2">
            <a
              href="/widget"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-navy/15 bg-white hover:bg-ivory-sand text-xs font-semibold text-navy transition-all"
            >
              <Smartphone className="w-3.5 h-3.5 text-coral" />
              <span>단독 화면 열기</span>
            </a>
            <button
              type="button"
              onClick={() => setIsWidgetOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-coral hover:bg-coral-hover text-white text-xs sm:text-sm font-semibold shadow-sm transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI 컨시어지 상담</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area (Left: Travel Agency Preview & Embed Guide / Right: Live Widget Preview) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left 7 Cols: Editorial Showcase & Customer Website Embed Guide */}
          <div className="lg:col-span-7 space-y-8">
            {/* Hero Section */}
            <section className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-navy/5 border border-navy/10 text-xs font-semibold text-navy">
                <Sparkles className="w-3.5 h-3.5 text-coral" />
                <span>BESPOKE JAPAN TRAVEL CONCIERGE</span>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-navy leading-[1.25] tracking-tight">
                오직 우리 일행만을 위한
                <br />
                <span className="text-coral">일본 프라이빗 맞춤 여행</span>,
                실시간 AI 컨시어지
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                고객사 홈페이지(<code className="text-navy font-semibold">japan.onlytour.co.kr</code>)에 탑재되는 웹 기반 AI 챗봇입니다. 관리자 앱(<code className="text-navy font-semibold">osw_chatbot_admin</code>)에서 등록한 Supabase 지식 베이스·AI 모델·상담 연결 설정과 실시간으로 연동됩니다.
              </p>

              {/* Quick Demo Trigger Buttons */}
              <div className="pt-2 flex flex-wrap gap-2">
                {[
                  "오사카 3박4일 4명이면 1인당 얼마예요?",
                  "스기노이 호텔 소라관 석식 포함인가요?",
                  "출발 10일 전 취소하면 수수료가 얼마예요?",
                  "가족 10명 단체여행 견적 문의",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => triggerQuestionInWidget(q)}
                    className="px-3.5 py-2 rounded-full bg-white hover:bg-navy hover:text-white border border-ivory-border text-xs font-medium text-navy shadow-sm transition-all"
                  >
                    💬 &ldquo;{q}&rdquo;
                  </button>
                ))}
              </div>
            </section>

            {/* Curated Destination Cards */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif font-semibold text-lg text-navy flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-coral" />
                  <span>시그니처 일본 여행 큐레이션 (클릭 시 AI 즉시 답변)</span>
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {CURATED_TOURS.map((tour) => (
                  <div
                    key={tour.title}
                    onClick={() => triggerQuestionInWidget(tour.question)}
                    className="group cursor-pointer bg-white rounded-2xl border border-ivory-border/90 overflow-hidden shadow-card hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-36 bg-ivory-sand overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={tour.image}
                          alt={tour.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-2.5 left-2.5 bg-navy/85 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
                          {tour.tag}
                        </div>
                      </div>
                      <div className="p-3.5 space-y-1.5">
                        <h4 className="font-serif font-semibold text-sm text-navy group-hover:text-coral transition-colors line-clamp-1">
                          {tour.title}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {tour.desc}
                        </p>
                      </div>
                    </div>
                    <div className="px-3.5 pb-3.5 pt-1 flex items-center justify-between text-xs font-semibold text-coral">
                      <span>{tour.price}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">
                        질문하기 →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Customer Homepage Integration Guide Card */}
            <section className="bg-white rounded-2xl border border-ivory-border p-5 sm:p-6 shadow-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Code2 className="w-5 h-5 text-coral" />
                  <h3 className="font-serif font-semibold text-base sm:text-lg text-navy">
                    고객사 홈페이지 1줄 설치 코드 (데스크톱 & 모바일 자동 최적화)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-light transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>복사 완료!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>설치 코드 복사</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                고객사 웹사이트의 <code className="bg-ivory-sand px-1.5 py-0.5 rounded text-navy font-mono">&lt;/body&gt;</code> 태그 바로 위에 아래 스크립트를 붙여넣으면, 데스크톱에서는 우측 하단 플로팅 컨시어지 창으로, 스마트폰(모바일)에서는 터치 친화적인 <strong>풀스크린 모달(100dvh)</strong>로 자동 전환됩니다.
              </p>

              <pre className="bg-navy-dark text-sky-tint p-4 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
                {embedSnippet}
              </pre>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs text-slate-600">
                <div className="bg-ivory rounded-xl p-3 border border-ivory-border/70 flex items-start gap-2">
                  <Monitor className="w-4 h-4 text-navy shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-navy">데스크톱 팝오버</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      우측 하단 플로팅 버튼 및 410×680px 컨시어지 창
                    </p>
                  </div>
                </div>
                <div className="bg-ivory rounded-xl p-3 border border-ivory-border/70 flex items-start gap-2">
                  <Smartphone className="w-4 h-4 text-coral shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-navy">모바일 100dvh 최적화</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      가상 키보드·iOS 노치 Safe-Area 및 스와이프 필터 완벽 대응
                    </p>
                  </div>
                </div>
                <div className="bg-ivory rounded-xl p-3 border border-ivory-border/70 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-navy">Supabase Vault 보안</div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      API 키와 DB는 서버리스 백엔드에서만 안전하게 호출
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right 5 Cols: Live Interactive Chatbot Widget Preview (Desktop Embedded View) */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full max-w-[420px] h-[680px] rounded-3xl overflow-hidden shadow-concierge border border-navy/10 bg-ivory flex flex-col">
              <ChatWidget
                brand="japan"
                isEmbedded={false}
                initialQuestion={activePrompt}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>
                위 챗봇은 실제 Supabase DB(지식 126건)와 실시간으로 연결되어 있습니다.
              </span>
            </p>
          </div>
        </div>
      </main>

      {/* Mobile Floating Launcher Button & Full-Screen Modal (for smartphone visitors on main page) */}
      <div className="lg:hidden fixed bottom-5 right-4 z-40 flex items-center gap-2 pb-safe">
        {!isWidgetOpen && (
          <>
            <button
              type="button"
              onClick={() => setIsWidgetOpen(true)}
              className="bg-white text-navy border border-navy/15 px-3.5 py-2 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>AI 여행 상담</span>
            </button>
            <button
              type="button"
              onClick={() => setIsWidgetOpen(true)}
              aria-label="AI 여행 컨시어지 열기"
              className="w-14 h-14 rounded-full bg-navy text-white shadow-xl border-2 border-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <MessageCircle className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* Mobile Full-screen Drawer Overlay when opened on mobile */}
      {isWidgetOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-ivory w-screen h-[100dvh] flex flex-col">
          <ChatWidget
            brand="japan"
            isEmbedded={true}
            onClose={() => setIsWidgetOpen(false)}
            initialQuestion={activePrompt}
          />
        </div>
      )}

      {/* Footer */}
      <footer className="bg-ivory-sand border-t border-ivory-border py-6 px-4 sm:px-8 text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-serif font-semibold text-navy">일본스토리</span>
            <span>|</span>
            <span>(주)세상에없는여행 · AI 컨시어지 웹 챗봇</span>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://japan.onlytour.co.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-navy inline-flex items-center gap-1"
            >
              <span>공식 홈페이지</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://pf.kakao.com/_VjxbnC/chat"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-navy inline-flex items-center gap-1"
            >
              <span>카카오톡 상담 채널</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
