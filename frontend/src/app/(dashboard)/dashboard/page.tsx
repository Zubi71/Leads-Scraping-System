"use client";

import { useEffect, useState } from "react";
import { analyticsApi, campaignsApi } from "@/lib/api";
import { AnalyticsOverview, Campaign } from "@/types";
import Header from "@/components/layout/Header";
import {
  Users, Send, MessageSquare, TrendingUp, Handshake,
  XCircle, Flame, DollarSign, Loader2, Play, Pause,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const STATS = (o: AnalyticsOverview) => [
  { title: "Total Leads",      value: o.total_leads,                icon: Users,        color: "from-blue-500 to-blue-600",    accent: "rgba(59,130,246,0.3)" },
  { title: "Contacted Today",  value: o.today_contacted,            icon: Send,         color: "from-indigo-500 to-indigo-600",accent: "rgba(99,102,241,0.3)" },
  { title: "Replied",          value: o.replied,                    icon: MessageSquare,color: "from-orange-500 to-orange-600",accent: "rgba(249,115,22,0.3)" },
  { title: "Hot Leads",        value: o.hot_leads,                  icon: Flame,        color: "from-red-500 to-pink-600",     accent: "rgba(239,68,68,0.3)"  },
  { title: "Interested",       value: o.interested,                 icon: TrendingUp,   color: "from-emerald-500 to-teal-600", accent: "rgba(16,185,129,0.3)" },
  { title: "Deals Closed",     value: o.closed_deals,               icon: Handshake,    color: "from-green-500 to-green-600",  accent: "rgba(34,197,94,0.3)"  },
  { title: "Rejected",         value: o.rejected,                   icon: XCircle,      color: "from-slate-500 to-slate-600",  accent: "rgba(100,116,139,0.3)"},
  { title: "Revenue",          value: formatCurrency(o.total_revenue), icon: DollarSign, color: "from-yellow-500 to-amber-500",accent: "rgba(245,158,11,0.3)" },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="glass rounded-xl px-4 py-3 text-sm">
        <p className="text-white/50 mb-1">{label}</p>
        <p className="text-white font-bold">{payload[0].value} contacted</p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const [overview, setOverview]   = useState<AnalyticsOverview | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [daily, setDaily]         = useState<{ date: string; contacted: number }[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([analyticsApi.overview(), campaignsApi.list(), analyticsApi.daily(30)])
      .then(([ov, c, d]) => { setOverview(ov.data); setCampaigns(c.data); setDaily(d.data); })
      .finally(() => setLoading(false));
  }, []);

  async function toggle(c: Campaign) {
    if (c.status === "active") await campaignsApi.pause(c.id);
    else await campaignsApi.start(c.id);
    campaignsApi.list().then(r => setCampaigns(r.data));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-white/40 text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const stats = overview ? STATS(overview) : [];

  return (
    <div>
      <Header title="Overview" subtitle="Your lead generation performance" />
      <div className="p-6 space-y-6">

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ title, value, icon: Icon, color, accent }) => (
            <div key={title} className="glass rounded-2xl p-5 stat-card group hover:scale-[1.02] transition-transform duration-200"
                 style={{ "--accent-color": `linear-gradient(90deg, ${accent}, transparent)` } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-white/50 text-xs font-medium">{title}</span>
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}
                     style={{ boxShadow: `0 4px 15px ${accent}` }}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-white">Leads Contacted — Last 30 Days</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs text-white/40">Contacted</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={daily}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="contacted" stroke="#3b82f6" fill="url(#areaGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Campaigns */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Campaigns</h2>
            <a href="/campaigns" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">View all →</a>
          </div>
          <div>
            {campaigns.length === 0 && (
              <p className="text-sm text-white/30 text-center px-6 py-8">
                No campaigns yet.{" "}
                <a href="/campaigns" className="text-blue-400 hover:underline">Create one →</a>
              </p>
            )}
            {campaigns.map((c, i) => (
              <div key={c.id}
                   className={`px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors ${i !== campaigns.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                  <p className="text-xs text-white/40 mt-0.5">{c.niche} · {c.city}, {c.country}</p>
                </div>
                {[{ label: "Leads", v: c.total_leads }, { label: "Sent", v: c.leads_contacted }, { label: "Deals", v: c.deals_closed }].map(({ label, v }) => (
                  <div key={label} className="text-center min-w-[48px]">
                    <p className="text-sm font-bold text-white">{v}</p>
                    <p className="text-[10px] text-white/30">{label}</p>
                  </div>
                ))}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.07] text-white/40"}`}>
                  {c.status}
                </span>
                <button onClick={() => toggle(c)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          c.status === "active"
                            ? "bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25"
                            : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                        }`}>
                  {c.status === "active" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {c.status === "active" ? "Pause" : "Start"}
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
