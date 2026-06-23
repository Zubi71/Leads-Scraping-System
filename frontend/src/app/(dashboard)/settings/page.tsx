"use client";

import { useEffect, useState } from "react";
import { settingsApi } from "@/lib/api";
import Header from "@/components/layout/Header";
import { Loader2, Save, TestTube, CheckCircle, XCircle } from "lucide-react";

interface Settings {
  whatsapp_api_token?: string; whatsapp_phone_id?: string; my_whatsapp_number?: string;
  smtp_host?: string; smtp_port?: number; smtp_username?: string; smtp_password?: string;
  from_email?: string; from_name?: string;
  ai_system_prompt?: string; whatsapp_prompt_template?: string; email_prompt_template?: string;
  notify_on_reply?: boolean; notify_on_hot_lead?: boolean; notify_on_deal?: boolean;
  notification_whatsapp?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <h2 className="text-sm font-bold text-white border-b border-white/[0.07] pb-3">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

type TestState = "idle" | "loading" | "ok" | "fail";

function TestBtn({ state, onClick, label, errorMsg }: { state: TestState; onClick: () => void; label: string; errorMsg?: string }) {
  return (
    <div className="space-y-2">
      <button onClick={onClick}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                state === "ok"   ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" :
                state === "fail" ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20" :
                "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white border border-white/[0.08]"
              }`}>
        {state === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {state === "ok"      && <CheckCircle className="w-3.5 h-3.5" />}
        {state === "fail"    && <XCircle className="w-3.5 h-3.5" />}
        {state === "idle"    && <TestTube className="w-3.5 h-3.5" />}
        {state === "ok" ? "Sent!" : state === "fail" ? "Not configured" : label}
      </button>
      {state === "fail" && errorMsg && (
        <p className="text-xs text-yellow-400/70 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2">
          ⚠️ {errorMsg}
        </p>
      )}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)}
         className={`relative w-10 h-5 rounded-full transition-all cursor-pointer ${checked ? "bg-blue-600" : "bg-white/[0.1]"}`}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </div>
  );
}

export default function SettingsPage() {
  const [s, setS]         = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [testWA, setTestWA]       = useState<TestState>("idle");
  const [testWAMsg, setTestWAMsg] = useState("");
  const [testEmail, setTestEmail] = useState<TestState>("idle");

  useEffect(() => { settingsApi.get().then(r => { setS(r.data); setLoading(false); }); }, []);

  const upd = (k: keyof Settings, v: unknown) => setS(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setSaved(false);
    await settingsApi.update(s);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const runTestWA = async () => {
    setTestWA("loading");
    try {
      await settingsApi.testWhatsapp();
      setTestWA("ok");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "WhatsApp API not configured";
      setTestWAMsg(msg);
      setTestWA("fail");
    }
  };

  const runTestEmail = async () => {
    setTestEmail("loading");
    try { await settingsApi.testEmail(); setTestEmail("ok"); } catch { setTestEmail("fail"); }
  };

  const ic  = "glass-input w-full px-4 py-2.5 rounded-xl text-sm";
  const ta  = `${ic} resize-none`;

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>;

  return (
    <div>
      <Header title="Settings" subtitle="Configure API keys, messaging, AI prompts & notifications" />
      <div className="p-6 space-y-5 max-w-3xl">

        <Section title="WhatsApp Business API">
          <Field label="API Token (Bearer)">
            <input type="password" value={s.whatsapp_api_token || ""} onChange={e => upd("whatsapp_api_token", e.target.value)} className={ic} placeholder="EAAxxxxx…" />
          </Field>
          <Field label="Phone Number ID">
            <input value={s.whatsapp_phone_id || ""} onChange={e => upd("whatsapp_phone_id", e.target.value)} className={ic} />
          </Field>
          <Field label="Your WhatsApp Number (for notifications)">
            <input value={s.my_whatsapp_number || ""} onChange={e => upd("my_whatsapp_number", e.target.value)} className={ic} placeholder="+601XXXXXXXXX" />
          </Field>
          <TestBtn state={testWA} onClick={runTestWA} label="Send Test Message" errorMsg={testWAMsg} />
        </Section>

        <Section title="Email / SMTP">
          <div className="grid grid-cols-2 gap-4">
            <Field label="SMTP Host"><input value={s.smtp_host || ""} onChange={e => upd("smtp_host", e.target.value)} className={ic} placeholder="smtp.gmail.com" /></Field>
            <Field label="Port"><input type="number" value={s.smtp_port || 587} onChange={e => upd("smtp_port", Number(e.target.value))} className={ic} /></Field>
          </div>
          <Field label="Username / Email"><input value={s.smtp_username || ""} onChange={e => upd("smtp_username", e.target.value)} className={ic} /></Field>
          <Field label="Password / App Password"><input type="password" value={s.smtp_password || ""} onChange={e => upd("smtp_password", e.target.value)} className={ic} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="From Email"><input value={s.from_email || ""} onChange={e => upd("from_email", e.target.value)} className={ic} /></Field>
            <Field label="From Name"><input value={s.from_name || ""} onChange={e => upd("from_name", e.target.value)} className={ic} /></Field>
          </div>
          <TestBtn state={testEmail} onClick={runTestEmail} label="Send Test Email" />
        </Section>

        <Section title="AI Prompt Customization">
          <Field label="AI System Prompt">
            <textarea rows={4} value={s.ai_system_prompt || ""} onChange={e => upd("ai_system_prompt", e.target.value)} className={ta} placeholder="You are a professional sales agent…" />
          </Field>
          <Field label="WhatsApp Proposal Template">
            <textarea rows={5} value={s.whatsapp_prompt_template || ""} onChange={e => upd("whatsapp_prompt_template", e.target.value)} className={ta} placeholder="Leave blank for default. Variables: {business_name}, {niche}, {city}, {price}…" />
          </Field>
          <Field label="Email Proposal Template">
            <textarea rows={5} value={s.email_prompt_template || ""} onChange={e => upd("email_prompt_template", e.target.value)} className={ta} placeholder="Leave blank for default." />
          </Field>
        </Section>

        <Section title="Notifications">
          <div className="space-y-3">
            {[
              { k: "notify_on_reply",    l: "Notify when a lead replies" },
              { k: "notify_on_hot_lead", l: "Notify when a high-intent lead is detected" },
              { k: "notify_on_deal",     l: "Notify when a deal is closed" },
            ].map(({ k, l }) => (
              <div key={k} className="flex items-center justify-between glass rounded-xl px-4 py-3">
                <span className="text-sm text-white/70">{l}</span>
                <Toggle checked={!!s[k as keyof Settings]} onChange={v => upd(k as keyof Settings, v)} />
              </div>
            ))}
          </div>
          <Field label="Notification WhatsApp Number">
            <input value={s.notification_whatsapp || ""} onChange={e => upd("notification_whatsapp", e.target.value)} className={ic} placeholder="+601XXXXXXXXX" />
          </Field>
        </Section>

        <div className="flex justify-end pb-6">
          <button onClick={save} disabled={saving}
                  className={`btn-primary px-8 py-3 rounded-xl text-sm ${saved ? "!bg-emerald-600" : ""}`}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Settings"}</>}
          </button>
        </div>

      </div>
    </div>
  );
}
