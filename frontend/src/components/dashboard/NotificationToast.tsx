"use client";

import { useEffect, useState } from "react";
import { Flame, Handshake, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

interface Toast { id: number; type: "reply" | "hot" | "deal"; title: string; body: string; }

let _id = 0;
const nextId = () => ++_id;

export default function NotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts(t => t.filter(x => x.id !== id));
  const add = (t: Omit<Toast, "id">) => {
    const id = nextId();
    setToasts(p => [...p.slice(-3), { ...t, id }]);
    setTimeout(() => dismiss(id), 6000);
  };

  useRealtimeNotifications(evt => {
    if (evt.event === "new_reply") add({ type: "reply", title: "New Reply", body: `${evt.data.business_name} replied` });
    else if (evt.event === "hot_lead") add({ type: "hot", title: "Hot Lead!", body: `${evt.data.business_name} — ${evt.data.intent_score}% intent` });
    else if (evt.event === "deal_closed") add({ type: "deal", title: "Deal Closed!", body: `${evt.data.business_name} · $${evt.data.price}` });
  });

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-2.5 w-80">
      {toasts.map(t => (
        <div key={t.id}
             className={cn("glass-strong rounded-2xl p-4 flex items-start gap-3 animate-slide-in border",
               t.type === "deal"  ? "border-emerald-500/30 glow-green" :
               t.type === "hot"   ? "border-orange-500/30" :
               "border-blue-500/30 glow-blue")}>
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
            t.type === "deal" ? "bg-emerald-500/20" : t.type === "hot" ? "bg-orange-500/20" : "bg-blue-500/20")}>
            {t.type === "deal"  && <Handshake className="w-4 h-4 text-emerald-400" />}
            {t.type === "hot"   && <Flame      className="w-4 h-4 text-orange-400" />}
            {t.type === "reply" && <MessageSquare className="w-4 h-4 text-blue-400" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">{t.title}</p>
            <p className="text-xs text-white/50 mt-0.5">{t.body}</p>
          </div>
          <button onClick={() => dismiss(t.id)} className="text-white/25 hover:text-white transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
