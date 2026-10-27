import nodemailer from "nodemailer";
import { getSupabaseClient } from "../supabase";
import { formatApproxKrw } from "./format";

/**
 * 연락처가 남겨진 견적을 담당자 메일로 알린다. 발송 실패는 견적 접수에 영향을 주지 않는다(기록만 남김).
 * 구글(Gmail) SMTP 로 보낸다. 받는 주소는 Supabase quote_settings.notify_email 에서 읽는다.
 *   GMAIL_USER          보내는 구글 계정 (회사 공용 메일 계정)
 *   GMAIL_APP_PASSWORD  그 계정의 '앱 비밀번호' 16자리 (2단계 인증을 켠 뒤 구글 계정에서 만든다 — 로그인 비밀번호가 아니다)
 *   QUOTE_MAIL_FROM     (선택) 보내는 이름 표시. 없으면 GMAIL_USER
 */

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function notifyQuoteContact(brand: string, quoteId: string, to: string): Promise<boolean> {
  const user = (process.env.GMAIL_USER || "").trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!user || !pass || !to) return false;
  try {
    const sb = getSupabaseClient();
    const { data, error } = await sb.from("quotes").select("*").eq("id", quoteId).eq("brand", brand).single();
    if (error || !data) throw error || new Error("견적 없음");
    const q = data as Record<string, any>;
    const amount = q.per_person_krw ? `${formatApproxKrw(q.per_person_krw)} (${Number(q.per_person_krw).toLocaleString("ko-KR")}원)` : "담당자 확인 필요";
    const rows: [string, string][] = [
      ["이름", q.contact_name],
      ["연락처", q.contact_phone],
      ["이메일", q.contact_email || "-"],
      ["코스", q.course_name],
      ["출발 희망일", q.depart_date],
      ["인원", `성인 ${q.adults} · 아동 ${q.children} · 유아 ${q.infants}`],
      ["항공 문의", q.with_air ? "예" : "아니오"],
      ["프로그램 견적(1인)", amount],
      ["마케팅 수신 동의", q.consent_marketing ? "동의" : "미동의"],
    ];
    const html = `<h3>간단견적 상담 요청이 접수되었습니다</h3><table cellpadding="6" style="border-collapse:collapse">${rows
      .map(([k, v]) => `<tr><td style="border:1px solid #ddd;background:#f7f7f7">${esc(k)}</td><td style="border:1px solid #ddd">${esc(v)}</td></tr>`)
      .join("")}</table><p style="color:#777">관리자 앱 [견적 목록]에서 업무 상태를 처리해 주세요.</p>`;

    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
      connectionTimeout: 6000,
      socketTimeout: 8000,
    });
    await transport.sendMail({
      from: process.env.QUOTE_MAIL_FROM || user,
      to,
      subject: `[간단견적] ${q.contact_name} · ${q.course_name} · ${q.depart_date}`,
      html,
    });
    await sb.from("quotes").update({ notified_at: new Date().toISOString() }).eq("id", quoteId);
    return true;
  } catch (err: any) {
    console.error("[quote] 담당자 메일 알림 실패:", err?.message || err);
    return false;
  }
}
