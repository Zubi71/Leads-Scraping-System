"use client";

import { useEffect, useState, useRef } from "react";
import { campaignsApi, api } from "@/lib/api";
import { Campaign } from "@/types";
import Header from "@/components/layout/Header";
import { Upload, Download, CheckCircle, AlertCircle, Loader2, FileText, Info } from "lucide-react";

export default function ImportPage() {
  const [campaigns, setCampaigns]   = useState<Campaign[]>([]);
  const [selCampaign, setSelCampaign] = useState("");
  const [file, setFile]             = useState<File | null>(null);
  const [result, setResult]         = useState<{ imported: number; skipped: number; message: string } | null>(null);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { campaignsApi.list().then(r => setCampaigns(r.data)); }, []);

  const handleUpload = async () => {
    if (!file || !selCampaign) return;
    setLoading(true); setResult(null); setError("");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post(`/import/csv/${selCampaign}`, form, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(res.data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Import failed.");
    } finally { setLoading(false); }
  };

  return (
    <div>
      <Header title="Import CSV" subtitle="Bulk-import leads from a spreadsheet" />
      <div className="p-6 max-w-2xl space-y-5">

        {/* Info */}
        <div className="glass rounded-2xl p-5 flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">CSV Format</p>
            <p className="text-xs text-white/50 mb-3">
              Required column: <code className="bg-white/[0.08] px-1.5 py-0.5 rounded-md text-blue-300">business_name</code>.
              Optional: phone, whatsapp, email, website, address, city, country, category, rating, review_count.
            </p>
            <button
              onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/import/template`, "_blank")}
              className="btn-glass px-4 py-2 rounded-xl text-xs font-semibold gap-2">
              <Download className="w-3.5 h-3.5" /> Download Template
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="glass rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Target Campaign</label>
            <select value={selCampaign} onChange={e => setSelCampaign(e.target.value)}
                    className="glass-input w-full px-4 py-3 rounded-xl text-sm">
              <option value="" className="bg-[#0d1117]">Choose a campaign…</option>
              {campaigns.map(c => <option key={c.id} value={c.id} className="bg-[#0d1117]">{c.name} — {c.niche}, {c.city}</option>)}
            </select>
          </div>

          {/* Drop zone */}
          <div onClick={() => fileRef.current?.click()}
               className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                 file ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/[0.08] hover:border-blue-500/40 hover:bg-blue-500/5"
               }`}>
            {file ? (
              <div className="flex items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white">{file.name}</p>
                  <p className="text-sm text-emerald-400">{(file.size / 1024).toFixed(1)} KB · Ready to import</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-6 h-6 text-white/25" />
                </div>
                <p className="text-sm font-semibold text-white/70">Click to select a CSV file</p>
                <p className="text-xs text-white/25 mt-1">or drag and drop here</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>

          {result && (
            <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-300 text-sm">{result.message}</p>
                <p className="text-xs text-emerald-400/70 mt-1">{result.imported} imported · {result.skipped} skipped (duplicates)</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button onClick={handleUpload} disabled={!file || !selCampaign || loading}
                  className="btn-primary w-full py-3.5 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : <><Upload className="w-4 h-4" /> Import Leads</>}
          </button>
        </div>

      </div>
    </div>
  );
}
