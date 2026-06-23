"use client";

import { useEffect, useState, useCallback } from "react";
import { leadsApi, campaignsApi, api } from "@/lib/api";
import { Lead, Campaign } from "@/types";
import Header from "@/components/layout/Header";
import { Send, Play, RefreshCw, Loader2, MessageCircle, Mail, CheckCircle, AlertCircle, SlidersHorizontal } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

export default function OutreachPage() {
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [campaigns, setCampaigns]   = useState<Campaign[]>([]);
  const [selCampaign, setSelCampaign] = useState("");
  const [loading, setLoading]         = useState(false);
  const [sending, setSending]         = useState<number | null>(null);
  const [sendingAll, setSendingAll]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const p: Record<string, unknown> = { status: "queued", size: 50 };
    if (selCampaign) p.campaign_id = Number(selCampaign);
    const [lr, cr] = await Promise.all([leadsApi.list(p), campaignsApi.list()]);
    setLeads(lr.data.items); setCampaigns(cr.data); setLoading(false);
  }, [selCampaign]);

  useEffect(() => { load(); }, [load]);

  const trigSingle = async (id: number) => {
    setSending(id);
    try { await api.post(`/outreach/send/${id}`); await load(); } finally { setSending(null); }
  };

  const trigAll = async () => {
    setSendingAll(true);
    try { await api.post("/outreach/process-queue"); await load(); } finally { setSendingAll(false); }
  };

  const channel = (l: Lead) => {
    if (l.whatsapp || l.phone) return { icon: <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />, label: "WhatsApp", ok: true };
    if (l.email)               return { icon: <Mail className="w-3.5 h-3.5 text-blue-400" />,            label: "Email",     ok: true };
    return { icon: <AlertCircle className="w-3.5 h-3.5 text-white/25" />, label: "No channel", ok: false };
  };

  return (
    <div>
      <Header title="Outreach Queue" subtitle="Review and trigger outreach to queued leads" />
      <div className="p-6 space-y-4">

        {/* Toolbar */}
        <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <SlidersHorizontal className="w-4 h-4 text-white/30" />
          <select value={selCampaign} onChange={e => setSelCampaign(e.target.value)}
                  className="glass-input px-3 py-2.5 rounded-xl text-sm">
            <option value="" className="bg-[#0d1117]">All Campaigns</option>
            {campaigns.map(c => <option key={c.id} value={c.id} className="bg-[#0d1117]">{c.name}</option>)}
          </select>
          <button onClick={load} className="btn-glass px-3 py-2.5 rounded-xl text-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-white/40">{leads.length} leads queued</span>
            <button onClick={trigAll} disabled={leads.length === 0 || sendingAll}
                    className="btn-primary px-4 py-2.5 rounded-xl text-sm disabled:opacity-40">
              {sendingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Send to All
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="glass rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
          ) : (
            <table className="w-full text-sm glass-table">
              <thead>
                <tr>
                  {["Business", "Channel", "Website", "Added", "Action"].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-[11px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => {
                  const ch = channel(lead);
                  return (
                    <tr key={lead.id}>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-white/90">{lead.business_name}</p>
                        <p className="text-xs text-white/35 mt-0.5">{lead.category} · {lead.city}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">{ch.icon}<span className="text-xs text-white/50">{ch.label}</span></div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn("text-[11px] px-2.5 py-1 rounded-full font-medium border",
                          lead.website_quality === "none" ? "bg-red-500/15 text-red-400 border-red-500/20" :
                          lead.website_quality === "poor" ? "bg-orange-500/15 text-orange-400 border-orange-500/20" :
                          "bg-yellow-500/15 text-yellow-400 border-yellow-500/20")}>
                          {lead.website_quality?.replace("_", " ") || "unknown"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-white/30">{formatDateTime(lead.created_at)}</td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => trigSingle(lead.id)} disabled={sending === lead.id || !ch.ok}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 disabled:opacity-30 text-blue-400 rounded-xl text-xs font-semibold transition-all">
                          {sending === lead.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Send
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {leads.length === 0 && (
                  <tr><td colSpan={5} className="py-16 text-center">
                    <CheckCircle className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
                    <p className="text-sm text-white/25">Queue is empty — all leads have been contacted.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
