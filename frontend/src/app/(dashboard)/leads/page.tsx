"use client";

import { useEffect, useState, useCallback } from "react";
import { leadsApi, campaignsApi } from "@/lib/api";
import { Lead, Campaign, LeadStatus } from "@/types";
import Header from "@/components/layout/Header";
import LeadDetailModal from "@/components/dashboard/LeadDetailModal";
import { Flame, Globe, Phone, Mail, Star, ChevronLeft, ChevronRight, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { cn, WEBSITE_QUALITY_LABELS, formatDate } from "@/lib/utils";

const STATUS_GLASS: Record<string, string> = {
  scraped:       "bg-slate-500/15 text-slate-300 border-slate-500/20",
  queued:        "bg-blue-500/15 text-blue-300 border-blue-500/20",
  contacted:     "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
  replied:       "bg-orange-500/15 text-orange-300 border-orange-500/20",
  interested:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  meeting_booked:"bg-purple-500/15 text-purple-300 border-purple-500/20",
  closed:        "bg-green-500/15 text-green-300 border-green-500/20",
  rejected:      "bg-red-500/15 text-red-300 border-red-500/20",
  opted_out:     "bg-white/[0.04] text-white/30 border-white/10",
  failed:        "bg-red-500/10 text-red-400 border-red-500/10",
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "scraped", label: "Scraped" }, { value: "queued", label: "Queued" },
  { value: "contacted", label: "Contacted" }, { value: "replied", label: "Replied" },
  { value: "interested", label: "Interested" }, { value: "closed", label: "Closed" },
  { value: "rejected", label: "Rejected" },
];

export default function LeadsPage() {
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [campaigns, setCampaigns]   = useState<Campaign[]>([]);
  const [total, setTotal]           = useState(0);
  const [pages, setPages]           = useState(1);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [filters, setFilters]       = useState({ status: "", campaign_id: "", is_hot: "", search: "" });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params: Record<string, unknown> = { page, size: 25 };
    if (filters.status) params.status = filters.status;
    if (filters.campaign_id) params.campaign_id = Number(filters.campaign_id);
    if (filters.is_hot === "true") params.is_hot = true;
    if (filters.search) params.search = filters.search;
    const res = await leadsApi.list(params);
    setLeads(res.data.items); setTotal(res.data.total); setPages(res.data.pages);
    setLoading(false);
  }, [page, filters]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { campaignsApi.list().then(r => setCampaigns(r.data)); }, []);

  const setFilter = (key: string, val: string) => { setFilters(f => ({ ...f, [key]: val })); setPage(1); };

  return (
    <div>
      <Header title="Leads" subtitle={`${total.toLocaleString()} leads found`} />
      <div className="p-6 space-y-4">

        {/* Filters */}
        <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              value={filters.search}
              onChange={e => setFilter("search", e.target.value)}
              placeholder="Search business name…"
              className="glass-input w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
            />
          </div>
          <SlidersHorizontal className="w-4 h-4 text-white/30" />
          {[
            { key: "campaign_id", opts: [{ value: "", label: "All Campaigns" }, ...campaigns.map(c => ({ value: String(c.id), label: c.name }))] },
            { key: "status",      opts: STATUS_OPTIONS },
            { key: "is_hot",      opts: [{ value: "", label: "All Leads" }, { value: "true", label: "🔥 Hot Leads" }] },
          ].map(({ key, opts }) => (
            <select key={key} value={filters[key as keyof typeof filters]}
                    onChange={e => setFilter(key, e.target.value)}
                    className="glass-input px-3 py-2.5 rounded-xl text-sm">
              {opts.map(o => <option key={o.value} value={o.value} className="bg-[#0d1117]">{o.label}</option>)}
            </select>
          ))}
        </div>

        {/* Table */}
        <div className="glass rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : (
            <table className="w-full text-sm glass-table">
              <thead>
                <tr>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Business</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Contact</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Website</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Rating</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Added</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)} className="cursor-pointer">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {lead.is_hot_lead && <Flame className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                        <div>
                          <p className="font-semibold text-white/90">{lead.business_name}</p>
                          <p className="text-xs text-white/35 mt-0.5">{lead.category} · {lead.city}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        {lead.phone && <div className="flex items-center gap-1.5 text-xs text-white/50"><Phone className="w-3 h-3" />{lead.phone}</div>}
                        {lead.email && <div className="flex items-center gap-1.5 text-xs text-white/50"><Mail className="w-3 h-3" /><span className="truncate max-w-[140px]">{lead.email}</span></div>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Globe className={cn("w-3.5 h-3.5", lead.website_quality === "none" ? "text-red-400" : "text-white/30")} />
                        <span className="text-xs text-white/50">{lead.website_quality ? WEBSITE_QUALITY_LABELS[lead.website_quality] : "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {lead.rating
                        ? <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" /><span className="text-xs text-white/60">{lead.rating}</span></div>
                        : <span className="text-xs text-white/25">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-medium border", STATUS_GLASS[lead.status] || STATUS_GLASS.scraped)}>
                        {lead.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-white/30">{formatDate(lead.created_at)}</td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-sm text-white/30">No leads found. Start a campaign to begin scraping.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          <div className="px-5 py-3.5 border-t border-white/[0.05] flex items-center justify-between">
            <span className="text-xs text-white/30">Page {page} of {pages} · {total} total</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                      className="p-1.5 rounded-lg btn-glass disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page === pages}
                      className="p-1.5 rounded-lg btn-glass disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>

      {selectedLeadId && <LeadDetailModal leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />}
    </div>
  );
}
