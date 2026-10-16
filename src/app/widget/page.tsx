"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ChatWidget from "@/components/ChatWidget";

function WidgetContent() {
  const searchParams = useSearchParams();
  const brand = searchParams.get("brand") || "japan";
  const initialQ = searchParams.get("q") || undefined;

  return (
    <div className="w-screen h-[100dvh] overflow-hidden bg-ivory">
      <ChatWidget
        brand={brand}
        isEmbedded={true}
        initialQuestion={initialQ}
      />
    </div>
  );
}

export default function WidgetPage() {
  return (
    <Suspense
      fallback={
        <div className="w-screen h-[100dvh] flex items-center justify-center bg-ivory text-navy text-sm font-medium">
          일본스토리 AI 여행 컨시어지를 불러오는 중입니다...
        </div>
      }
    >
      <WidgetContent />
    </Suspense>
  );
}
