"use client";

import { useEffect, useState } from "react";
import { dealsApi } from "@/lib/api";
import { Deal, DealStatus } from "@/types";
import Header from "@/components/layout/Header";
import { Handshake, DollarSign, Phone, Mail, MessageCircle, Loader2, ChevronRight, Trophy } from "lucide-react";
import { cn, formatDate, formatCurrency } from "@/lib/utils";

const STEPS: DealStatus[] = ["confirmed", "in_development", "delivered", "invoiced", "paid"];

const STATUS_STYLE: Record<string, string> = {
  confirmed:      "bg-blue-500/15 text-blue-400 border-blue-500/20",
  in_development: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  delivered:      "bg-teal-500/15 text-teal-400 border-teal-500/20",
  invoiced:       "bg-orange-500/15 text-orange-400 border-orange-500/20",
  paid:           "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  cancelled:      "bg-red-500/15 text-red-400 border-red-500/20",
};

export default function DealsPage() {
  const [deals, setDeals]   = useState<Deal[]>([]);
  const [sel, setSel]       = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { dealsApi.list().then(r => { setDeals(r.data); setLoading(false); }); }, []);

  const advance = async (deal: Deal) => {
    const idx  = STEPS.indexOf(deal.status);
    if (idx < STEPS.length - 1) {
      await dealsApi.update(deal.id, { status: STEPS[idx + 1] });
      const u = await dealsApi.get(deal.id);
      setDeals(p => p.map(d => d.id === deal.id ? u.data : d));
      setSel(u.data);
    }
  };

  const totalRevenue = deals.filter(d => d.status === "paid").reduce((s, d) => s + (d.package_price || 0), 0);
  const pipeline     = deals.filter(d => ["confirmed", "in_development"].includes(d.status)).reduce((s, d) => s + (d.package_price || 0), 0);

  return (
    <div>
      <Header title="Closed Deals" subtitle="Track every confirmed client" />
      <div className="p-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Deals",    value: deals.length,              icon: Handshake,   grad: "from-blue-500 to-indigo-600",   glow: "rgba(99,102,241,0.3)" },
            { label: "Revenue Earned", value: formatCurrency(totalRevenue), icon: Trophy,   grad: "from-emerald-500 to-teal-600",  glow: "rgba(16,185,129,0.3)" },
            { label: "Pipeline Value", value: formatCurrency(pipeline),   icon: DollarSign, grad: "from-yellow-500 to-amber-600",  glow: "rgba(245,158,11,0.3)" },
          ].map(({ label, value, icon: Icon, grad, glow }) => (
            <div key={label} className="glass rounded-2xl p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0`}
                   style={{ boxShadow: `0 4px 16px ${glow}` }}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-white">{value}</p>
                <p className="text-xs text-white/40 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-5">
          {/* List */}
          <div className="flex-1 glass rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.06] text-xs text-white/30 font-medium">
              {deals.length} deals
            </div>
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {deals.map(deal => (
                  <button key={deal.id} onClick={() => setSel(deal)}
                          className={cn("w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors",
                            sel?.id === deal.id ? "bg-blue-600/10 border-l-2 border-blue-500" : "border-l-2 border-transparent")}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white/90">{deal.business_name}</p>
                      <p className="text-xs text-white/35 mt-0.5 truncate">{deal.client_name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-emerald-400">{formatCurrency(deal.package_price, deal.currency)}</p>
                      <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", STATUS_STYLE[deal.status])}>
                        {deal.status.replace("_", " ")}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
                  </button>
                ))}
                {deals.length === 0 && (
                  <div className="flex flex-col items-center py-20">
                    <Handshake className="w-10 h-10 text-white/10 mb-3" />
                    <p className="text-sm text-white/25">No deals yet. They appear here when AI closes one.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {sel && (
            <div className="w-80 glass rounded-2xl p-5 flex-shrink-0 space-y-5 animate-fade-up">
              <div>
                <h3 className="text-lg font-bold text-white">{sel.business_name}</h3>
                <p className="text-sm text-white/40">{sel.client_name}</p>
              </div>

              <div className="space-y-2.5">
                {sel.contact_phone   && <div className="flex items-center gap-2 text-sm text-white/60"><Phone className="w-4 h-4 text-white/25" />{sel.contact_phone}</div>}
                {sel.contact_email   && <div className="flex items-center gap-2 text-sm text-white/60"><Mail className="w-4 h-4 text-white/25" />{sel.contact_email}</div>}
                {sel.contact_whatsapp && <div className="flex items-center gap-2 text-sm text-white/60"><MessageCircle className="w-4 h-4 text-white/25" />{sel.contact_whatsapp}</div>}
              </div>

              <div className="glass-dark rounded-xl p-4">
                <p className="text-xs text-white/35 mb-1">Package</p>
                <p className="font-semibold text-white">{sel.package_name || "Custom"}</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(sel.package_price, sel.currency)}</p>
              </div>

              {/* Progress */}
              <div>
                <p className="text-xs text-white/35 mb-3">Deal Progress</p>
                <div className="space-y-2.5">
                  {STEPS.map((step, i) => {
                    const curIdx  = STEPS.indexOf(sel.status);
                    const done    = i <= curIdx;
                    const current = i === curIdx;
                    return (
                      <div key={step} className="flex items-center gap-2.5">
                        <div className={cn("w-3 h-3 rounded-full flex-shrink-0 transition-all",
                          current ? "bg-blue-400 glow-blue scale-125" : done ? "bg-emerald-500" : "bg-white/[0.08]")} />
                        <span className={cn("text-xs capitalize",
                          current ? "text-blue-300 font-semibold" : done ? "text-white/70 font-medium" : "text-white/25")}>
                          {step.replace("_", " ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs text-white/25">Confirmed {formatDate(sel.confirmed_at)}</p>
              {sel.custom_notes && <p className="text-xs text-white/50 glass rounded-xl p-3">{sel.custom_notes}</p>}

              {sel.status !== "paid" && sel.status !== "cancelled" && (
                <button onClick={() => advance(sel)} className="btn-primary w-full py-2.5 rounded-xl text-sm">
                  Mark as {STEPS[STEPS.indexOf(sel.status) + 1]?.replace("_", " ")}
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
