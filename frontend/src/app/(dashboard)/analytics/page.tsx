"use client";

import { useEffect, useState } from "react";
import { analyticsApi } from "@/lib/api";
import { AnalyticsOverview } from "@/types";
import Header from "@/components/layout/Header";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";

const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6"];

const GlassTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; fill?: string }>; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="glass rounded-xl px-4 py-3 text-xs space-y-1">
        {label && <p className="text-white/40 mb-1">{label}</p>}
        {payload.map(p => (
          <p key={p.name} className="text-white font-semibold" style={{ color: p.fill || "white" }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [daily, setDaily]       = useState<{ date: string; contacted: number }[]>([]);
  const [byNiche, setByNiche]   = useState<{ niche: string; leads: number; closed: number }[]>([]);
  const [revenue, setRevenue]   = useState<{ pipeline_value: number; earned_revenue: number; avg_deal_value: number; deals_in_pipeline: number } | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([analyticsApi.overview(), analyticsApi.daily(30), analyticsApi.byNiche(), analyticsApi.revenueProjection()])
      .then(([ov, d, n, r]) => { setOverview(ov.data); setDaily(d.data); setByNiche(n.data); setRevenue(r.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>;

  const funnel = overview ? [
    { name: "Scraped",    value: overview.total_leads  },
    { name: "Contacted",  value: overview.contacted    },
    { name: "Replied",    value: overview.replied      },
    { name: "Interested", value: overview.interested   },
    { name: "Closed",     value: overview.closed_deals },
  ] : [];

  const kpis = [
    { label: "Reply Rate",       value: `${overview?.reply_rate ?? 0}%`,         sub: "of contacted leads"    },
    { label: "Conversion Rate",  value: `${overview?.conversion_rate ?? 0}%`,    sub: "leads → deals"         },
    { label: "Revenue Earned",   value: formatCurrency(revenue?.earned_revenue), sub: "paid deals"            },
    { label: "Pipeline Value",   value: formatCurrency(revenue?.pipeline_value), sub: `${revenue?.deals_in_pipeline} deals` },
  ];

  const axisProps = { fill: "rgba(255,255,255,0.3)", fontSize: 11 };
  const gridProps = { stroke: "rgba(255,255,255,0.04)", strokeDasharray: "3 3" };

  return (
    <div>
      <Header title="Analytics" subtitle="Performance insights and revenue projections" />
      <div className="p-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          {kpis.map(k => (
            <div key={k.label} className="glass rounded-2xl p-5">
              <p className="text-xs text-white/40 mb-2">{k.label}</p>
              <p className="text-2xl font-bold text-white">{k.value}</p>
              <p className="text-xs text-white/25 mt-1">{k.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Daily area chart */}
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-5">Daily Outreach (30 days)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" tick={axisProps} tickLine={false} axisLine={false} />
                <YAxis tick={axisProps} tickLine={false} axisLine={false} />
                <Tooltip content={<GlassTooltip />} />
                <Area type="monotone" dataKey="contacted" stroke="#3b82f6" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Funnel */}
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-5">Conversion Funnel</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={funnel} layout="vertical">
                <CartesianGrid {...gridProps} />
                <XAxis type="number" tick={axisProps} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={axisProps} tickLine={false} axisLine={false} width={70} />
                <Tooltip content={<GlassTooltip />} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]}>
                  {funnel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By niche */}
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-5">Performance by Niche</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byNiche}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="niche" tick={axisProps} tickLine={false} axisLine={false} />
                <YAxis tick={axisProps} tickLine={false} axisLine={false} />
                <Tooltip content={<GlassTooltip />} />
                <Bar dataKey="leads"  name="Leads"  fill="rgba(255,255,255,0.08)" radius={[4,4,0,0]} />
                <Bar dataKey="closed" name="Closed" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie */}
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-5">Lead Status Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={funnel.slice(1)} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {funnel.slice(1).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<GlassTooltip />} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
