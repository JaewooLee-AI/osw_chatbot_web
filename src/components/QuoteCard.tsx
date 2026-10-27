"use client";

import React, { useEffect, useState } from "react";
import { Calculator, Minus, Plus, X, CheckCircle2, MessageCircle } from "lucide-react";
import { formatApproxKrw } from "@/lib/quote/format";
import type { QuoteResult } from "@/lib/quote/types";

export interface QuoteCourse {
  id: string;
  name: string;
  nights: number;
  minPax: number;
  maxPax: number;
  itinerary: string[];
  reference: boolean;
  routes: { id: string; name: string }[];
}

export interface QuoteConfig {
  enabled: boolean;
  disclaimer?: string;
  privacy_text?: string;
  marketing_text?: string;
  courses?: QuoteCourse[];
}

interface Props {
  brand: string;
  config: QuoteConfig;
  kakaoUrl: string;
  onClose: () => void;
}

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function Stepper({ label, hint, value, min, onChange }: { label: string; hint?: string; value: number; min: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-navy">{label}</div>
        {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button type="button" aria-label={`${label} 줄이기`} disabled={value <= min} onClick={() => onChange(value - 1)} className="w-9 h-9 rounded-lg border border-ivory-border bg-ivory disabled:opacity-40 flex items-center justify-center active:scale-95">
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums">{value}</span>
        <button type="button" aria-label={`${label} 늘리기`} disabled={value >= 20} onClick={() => onChange(value + 1)} className="w-9 h-9 rounded-lg border border-ivory-border bg-ivory disabled:opacity-40 flex items-center justify-center active:scale-95">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/** 동의 체크 + 전문 보기. 전문은 관리자 앱 [견적 기준] 사용 설정의 문구 그대로 보여 준다. */
function ConsentBox({ checked, onChange, label, text }: { checked: boolean; onChange: (v: boolean) => void; label: string; text: string }) {
  return (
    <div className="text-[12px] text-slate-700 space-y-1">
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 mt-0.5" />
        <span>{label}</span>
      </label>
      <details className="pl-6">
        <summary className="cursor-pointer text-slate-500">전문 보기</summary>
        <div className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-ivory p-2 text-[11px] leading-relaxed text-slate-600">{text}</div>
      </details>
    </div>
  );
}

export default function QuoteCard({ brand, config, kakaoUrl, onClose }: Props) {
  const courses = config.courses || [];
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const course = courses.find((c) => c.id === courseId) || courses[0];
  const [route, setRoute] = useState("");
  const [departDate, setDepartDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [withAir, setWithAir] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);

  const [contactOpen, setContactOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [agreeMkt, setAgreeMkt] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    post({ action: "event", brand, event: "start" });
  }, [brand]);

  useEffect(() => {
    setRoute(course?.routes[0]?.id || "");
  }, [course?.id]);

  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

  async function calculate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!course) return;
    if (!departDate) return setError("출발 희망일을 선택해 주세요.");
    setBusy(true);
    try {
      const { ok, data } = await post({ action: "calculate", brand, input: { courseId, route: route || undefined, departDate, adults, children, infants, withAir } });
      if (!ok) setError(data?.error || "견적을 계산하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      else {
        setResult(data.result);
        setQuoteId(data.quote_id || null);
        setContactOpen(false);
        setSent(false);
      }
    } catch {
      setError("네트워크 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("이름을 입력해 주세요.");
    if (!phone.trim()) return setError("연락처를 입력해 주세요.");
    if (!agree) return setError("개인정보 수집·이용에 동의해 주세요.");
    setBusy(true);
    try {
      const { ok, data } = await post({ action: "contact", brand, quote_id: quoteId, name, phone, email, consent_privacy: agree, consent_marketing: agreeMkt });
      if (!ok) setError(data?.error || "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      else setSent(true);
    } catch {
      setError("네트워크 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full min-h-[44px] bg-ivory border border-ivory-border focus:border-navy rounded-xl px-3 py-2 text-[16px] sm:text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/15";
  const label = "block text-[12px] font-semibold text-slate-600 mb-1";

  return (
    <section aria-label="간단견적" className="bg-white border border-ivory-border/90 rounded-2xl p-4 shadow-card space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif font-semibold text-[16px] text-navy flex items-center gap-1.5">
          <Calculator className="w-4 h-4 text-coral" /> 간단견적
        </h2>
        <button type="button" onClick={onClose} aria-label="간단견적 닫기" className="p-1.5 rounded-lg hover:bg-ivory text-slate-500">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={calculate} className="space-y-3">
        <div>
          <label className={label} htmlFor="q-course">코스</label>
          <select id="q-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} className={input}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {course && course.routes.length > 1 && (
          <div>
            <label className={label} htmlFor="q-route">출발·도착 공항</label>
            <select id="q-route" value={route} onChange={(e) => setRoute(e.target.value)} className={input}>
              {course.routes.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className={label} htmlFor="q-date">출발 희망일</label>
          <input id="q-date" type="date" min={today} value={departDate} onChange={(e) => setDepartDate(e.target.value)} className={input} />
        </div>
        <div className="space-y-2.5 rounded-xl bg-ivory p-3">
          <Stepper label="성인" value={adults} min={1} onChange={setAdults} />
          <Stepper label="아동" hint="만 2세 이상" value={children} min={0} onChange={setChildren} />
          <Stepper label="유아" hint="만 2세 미만 · 무료(견적 제외)" value={infants} min={0} onChange={setInfants} />
          {course && <div className="text-[11px] text-slate-500">성인·아동 합계 {course.minPax}~{course.maxPax}명까지 자동 견적이 가능합니다.</div>}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-navy">
          <input type="checkbox" checked={withAir} onChange={(e) => setWithAir(e.target.checked)} className="w-4 h-4" />
          항공권도 함께 알아보고 싶어요
        </label>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="w-full min-h-[46px] rounded-xl bg-coral hover:bg-coral-hover disabled:bg-slate-200 text-white font-semibold text-sm active:scale-[0.99]">
          {busy && !result ? "계산 중…" : "견적 확인하기"}
        </button>
      </form>

      {result && result.status === "ok" && (
        <div className="rounded-xl border border-sky/40 bg-sky-tint/50 p-3.5 space-y-2.5">
          <div className="text-xs text-slate-600">{result.courseName} · 유료 인원 {result.chargeablePax}명 기준</div>
          <div className="text-2xl font-serif font-semibold text-navy">1인 {formatApproxKrw(result.perPersonKrw)}</div>
          {result.reference && <p className="text-[12px] text-slate-600">이 일정은 참고용 견적입니다. 담당자 확인 후 확정됩니다.</p>}
          {result.surchargeNames.length > 0 && <p className="text-[12px] text-slate-600">포함된 할증: {result.surchargeNames.join(", ")}</p>}
          <ol className="text-[12px] text-slate-700 space-y-0.5 list-decimal list-inside">
            {result.itinerary.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ol>
          {result.notes.map((n, i) => (
            <p key={i} className="text-[12px] text-slate-700">{n}</p>
          ))}
          {config.disclaimer && <p className="text-[11px] text-slate-500">{config.disclaimer}</p>}

          {sent ? (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="w-4 h-4" /> 접수되었습니다. 담당자가 확인 후 연락드립니다.</p>
          ) : !contactOpen ? (
            <button type="button" onClick={() => setContactOpen(true)} disabled={!quoteId} className="w-full min-h-[44px] rounded-xl bg-navy text-white text-sm font-semibold disabled:opacity-50">
              견적서 받기 / 상담 요청
            </button>
          ) : (
            <form onSubmit={submitContact} className="space-y-2.5 pt-1">
              <input aria-label="이름" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="name" />
              <input aria-label="연락처" placeholder="연락처 (예: 010-1234-5678)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} autoComplete="tel" />
              <input aria-label="이메일(선택)" placeholder="이메일 (선택)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} autoComplete="email" />
              <ConsentBox
                checked={agree}
                onChange={setAgree}
                label="[필수] 개인정보 수집·이용에 동의합니다."
                text={config.privacy_text || "견적 안내를 위해 이름·연락처·이메일을 수집·이용하는 것에 동의합니다."}
              />
              <ConsentBox
                checked={agreeMkt}
                onChange={setAgreeMkt}
                label="[선택] 마케팅 정보 수신에 동의합니다."
                text={config.marketing_text || "여행 상품·이벤트 안내 수신에 동의합니다."}
              />
              <button type="submit" disabled={busy} className="w-full min-h-[44px] rounded-xl bg-navy text-white text-sm font-semibold disabled:opacity-50">
                {busy ? "보내는 중…" : "보내기"}
              </button>
            </form>
          )}
        </div>
      )}

      {result && result.status === "handoff" && (
        <div className="rounded-xl border border-ivory-border bg-ivory p-3.5 space-y-2.5">
          <p className="text-sm text-navy leading-relaxed">{result.message}</p>
          <a
            href={kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => post({ action: "event", brand, event: "consult", quote_id: quoteId })}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-kakao text-navy text-sm font-semibold"
          >
            <MessageCircle className="w-4 h-4" /> 카카오톡으로 상담하기
          </a>
        </div>
      )}
    </section>
  );
}
