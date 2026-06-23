"use client";

import { useEffect, useState } from "react";
import { campaignsApi } from "@/lib/api";
import { Campaign } from "@/types";
import Header from "@/components/layout/Header";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Play, Pause, Trash2, X, Loader2, Megaphone } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1),
  niche: z.string().min(1),
  country: z.string().min(1),
  city: z.string().min(1),
  area: z.string().optional(),
  language: z.string().default("English"),
  package_name: z.string().optional(),
  package_price: z.coerce.number().optional(),
  package_description: z.string().optional(),
  max_leads: z.coerce.number().min(1).default(100),
  max_messages_per_day: z.coerce.number().min(1).default(20),
  target_no_website: z.boolean().default(true),
  target_poor_website: z.boolean().default(true),
  target_outdated_website: z.boolean().default(false),
  target_mobile_unfriendly: z.boolean().default(false),
});
type FormData = z.infer<typeof schema>;

const STATUS_STYLE: Record<string, string> = {
  draft:     "bg-white/[0.06] text-white/40",
  active:    "bg-emerald-500/15 text-emerald-400",
  paused:    "bg-yellow-500/15 text-yellow-400",
  completed: "bg-blue-500/15 text-blue-400",
};

function InputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [loading, setLoading]     = useState(true);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const reload = async () => { const r = await campaignsApi.list(); setCampaigns(r.data); setLoading(false); };
  useEffect(() => { reload(); }, []);

  const onCreate = async (data: FormData) => { await campaignsApi.create(data); reset(); setShowForm(false); await reload(); };
  const toggle   = async (c: Campaign) => { if (c.status === "active") await campaignsApi.pause(c.id); else await campaignsApi.start(c.id); await reload(); };
  const del      = async (id: number) => { if (!confirm("Delete this campaign and all its leads?")) return; await campaignsApi.delete(id); await reload(); };

  const ic = "glass-input w-full px-3 py-2.5 rounded-xl text-sm";

  return (
    <div>
      <Header title="Campaigns" subtitle="Manage your lead generation campaigns" />
      <div className="p-6 space-y-5">

        <div className="flex justify-end">
          <button onClick={() => setShowForm(true)} className="btn-primary px-5 py-2.5 rounded-xl text-sm">
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map(c => (
              <div key={c.id} className="glass rounded-2xl p-5 space-y-4 hover:border-white/[0.12] transition-all duration-200 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate">{c.name}</h3>
                    <p className="text-xs text-white/40 mt-0.5">{c.niche} · {c.city}, {c.country}</p>
                  </div>
                  <span className={cn("text-[11px] px-2.5 py-1 rounded-full font-medium flex-shrink-0", STATUS_STYLE[c.status])}>
                    {c.status}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Leads",    v: c.total_leads      },
                    { label: "Sent",     v: c.leads_contacted  },
                    { label: "Replied",  v: c.leads_replied    },
                    { label: "Deals",    v: c.deals_closed     },
                  ].map(({ label, v }) => (
                    <div key={label} className="glass-dark rounded-xl p-2 text-center">
                      <p className="text-base font-bold text-white">{v}</p>
                      <p className="text-[10px] text-white/30">{label}</p>
                    </div>
                  ))}
                </div>

                {c.package_price && (
                  <p className="text-xs text-white/40">
                    Package: <span className="text-white/70 font-medium">{c.package_name}</span>
                    {" · "}
                    <span className="text-emerald-400 font-semibold">${c.package_price}</span>
                  </p>
                )}
                <p className="text-[11px] text-white/25">Created {formatDate(c.created_at)}</p>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => toggle(c)}
                          className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all",
                            c.status === "active"
                              ? "bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25"
                              : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25")}>
                    {c.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {c.status === "active" ? "Pause" : "Start"}
                  </button>
                  <button onClick={() => del(c.id)}
                          className="p-2 text-white/25 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {campaigns.length === 0 && (
              <div className="col-span-full glass rounded-2xl p-16 text-center">
                <Megaphone className="w-10 h-10 text-white/15 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No campaigns yet. Click &quot;New Campaign&quot; to get started.</p>
              </div>
            )}
          </div>
        )}

        {/* Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-strong rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-fade-up">
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
                <h2 className="text-lg font-bold text-white">Create Campaign</h2>
                <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSubmit(onCreate)} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Campaign Name"><input {...register("name")} className={cn(ic, "col-span-2")} /></InputField>
                  <InputField label="Business Niche"><input {...register("niche")} placeholder="salons, restaurants…" className={ic} /></InputField>
                  <InputField label="Language"><input {...register("language")} defaultValue="English" className={ic} /></InputField>
                  <InputField label="Country"><input {...register("country")} className={ic} /></InputField>
                  <InputField label="City"><input {...register("city")} className={ic} /></InputField>
                  <InputField label="Package Name"><input {...register("package_name")} placeholder="Starter Website" className={ic} /></InputField>
                  <InputField label="Package Price ($)"><input {...register("package_price")} type="number" className={ic} /></InputField>
                  <InputField label="Max Leads"><input {...register("max_leads")} type="number" defaultValue={100} className={ic} /></InputField>
                  <InputField label="Max Msg/Day"><input {...register("max_messages_per_day")} type="number" defaultValue={20} className={ic} /></InputField>
                </div>
                <div>
                  <p className="text-xs font-medium text-white/50 mb-2">Target businesses with:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { f: "target_no_website",        l: "No website" },
                      { f: "target_poor_website",       l: "Poor website" },
                      { f: "target_outdated_website",   l: "Outdated website" },
                      { f: "target_mobile_unfriendly",  l: "Not mobile-friendly" },
                    ].map(({ f, l }) => (
                      <label key={f} className="flex items-center gap-2.5 cursor-pointer glass rounded-xl px-3 py-2.5 hover:bg-white/[0.05] transition-colors">
                        <input {...register(f as keyof FormData)} type="checkbox" className="accent-blue-500" />
                        <span className="text-xs text-white/60">{l}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 btn-glass rounded-xl text-sm">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 btn-primary py-3 rounded-xl text-sm">
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
