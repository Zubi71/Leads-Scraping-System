"use client";

import { useEffect, useState } from "react";
import { leadsApi, conversationsApi } from "@/lib/api";
import { Lead, Conversation } from "@/types";
import {
  X, Phone, Mail, Globe, MapPin, Star, MessageCircle,
  Bot, User, UserCog, Flame, ExternalLink, Loader2,
} from "lucide-react";
import { cn, STATUS_COLORS, WEBSITE_QUALITY_LABELS, formatDateTime, formatDate } from "@/lib/utils";

interface Props {
  leadId: number;
  onClose: () => void;
}

export default function LeadDetailModal({ leadId, onClose }: Props) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [tab, setTab] = useState<"info" | "conversation" | "messages">("info");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [leadRes] = await Promise.all([leadsApi.get(leadId)]);
      setLead(leadRes.data);

      // Try to load conversation
      try {
        const convList = await conversationsApi.list();
        const match = convList.data.find((c: Conversation) => c.lead_id === leadId);
        if (match) {
          const full = await conversationsApi.get(match.id);
          setConv(full.data);
        }
      } catch { /* no conversation yet */ }

      setLoading(false);
    }
    load();
  }, [leadId]);

  if (loading) {
    return (
      <Overlay onClose={onClose}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Overlay>
    );
  }

  if (!lead) return null;

  return (
    <Overlay onClose={onClose}>
      {/* Header */}
      <div className="flex items-start justify-between p-6 border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          {lead.is_hot_lead && <Flame className="w-5 h-5 text-red-500 flex-shrink-0" />}
          <div>
            <h2 className="text-xl font-bold text-gray-900">{lead.business_name}</h2>
            <p className="text-sm text-gray-500">{lead.category} · {lead.city}, {lead.country}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold", STATUS_COLORS[lead.status])}>
            {lead.status.replace("_", " ")}
          </span>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-6">
        {(["info", "conversation", "messages"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize",
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="p-6 overflow-y-auto max-h-[60vh]">
        {tab === "info" && <InfoTab lead={lead} />}
        {tab === "conversation" && <ConversationTab conv={conv} />}
        {tab === "messages" && <MessagesTab leadId={leadId} />}
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="glass-strong rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function InfoTab({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-5">
      {/* Contact Details */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact</h3>
        <div className="grid grid-cols-2 gap-3">
          {lead.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
              <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>{lead.phone}</span>
            </div>
          )}
          {lead.whatsapp && (
            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
              <MessageCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span>{lead.whatsapp}</span>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.address && (
            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate">{lead.address}</span>
            </div>
          )}
        </div>
      </section>

      {/* Website */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Online Presence</h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                {lead.website_quality ? WEBSITE_QUALITY_LABELS[lead.website_quality] : "Not checked"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", lead.website_score > 70 ? "bg-green-500" : lead.website_score > 40 ? "bg-yellow-500" : "bg-red-500")}
                  style={{ width: `${lead.website_score}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-8 text-right">{lead.website_score}/100</span>
            </div>
          </div>
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
              <ExternalLink className="w-3 h-3" /> {lead.website}
            </a>
          )}
          {lead.website_analysis_notes && (
            <p className="text-xs text-gray-500">{lead.website_analysis_notes}</p>
          )}
        </div>
      </section>

      {/* Rating */}
      {lead.rating && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Google Rating</h3>
          <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-4">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <span className="text-2xl font-bold text-gray-900">{lead.rating}</span>
            <span className="text-sm text-gray-500">({lead.review_count} reviews)</span>
            {lead.google_maps_url && (
              <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer"
                 className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1">
                View on Maps <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </section>
      )}

      {/* Activity */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Outreach Activity</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xl font-bold text-gray-900">{lead.reply_count}</p>
            <p className="text-xs text-gray-500">Replies</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-700 font-medium">{lead.first_contact_at ? formatDate(lead.first_contact_at) : "—"}</p>
            <p className="text-xs text-gray-500">First Contact</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-700 font-medium">{lead.last_contact_at ? formatDate(lead.last_contact_at) : "—"}</p>
            <p className="text-xs text-gray-500">Last Contact</p>
          </div>
        </div>
      </section>

      {lead.notes && (
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</h3>
          <p className="text-sm text-gray-700 bg-yellow-50 border border-yellow-100 rounded-lg p-3">{lead.notes}</p>
        </section>
      )}
    </div>
  );
}

function ConversationTab({ conv }: { conv: Conversation | null }) {
  if (!conv) {
    return <p className="text-center text-sm text-gray-500 py-12">No conversation started yet.</p>;
  }

  const senderIcon = (sender: string) => {
    if (sender === "ai") return <Bot className="w-3.5 h-3.5 text-blue-600" />;
    if (sender === "operator") return <UserCog className="w-3.5 h-3.5 text-purple-600" />;
    return <User className="w-3.5 h-3.5 text-gray-600" />;
  };

  const senderBg = (sender: string) =>
    sender === "ai" ? "bg-blue-600 text-white" : sender === "operator" ? "bg-purple-600 text-white" : "bg-white border border-gray-200 text-gray-800";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-500">Intent score:</span>
        <div className="flex items-center gap-2">
          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${conv.intent_score}%` }} />
          </div>
          <span className="text-sm font-bold text-gray-900">{conv.intent_score}%</span>
        </div>
        <span className={cn("text-xs px-2 py-0.5 rounded-full", conv.is_ai_active ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700")}>
          {conv.is_ai_active ? "AI Active" : "Manual Mode"}
        </span>
      </div>

      {conv.messages.map((msg) => {
        const isAI = msg.sender !== "human";
        return (
          <div key={msg.id} className={cn("flex gap-2", isAI ? "flex-row-reverse" : "")}>
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
              msg.sender === "ai" ? "bg-blue-100" : msg.sender === "operator" ? "bg-purple-100" : "bg-gray-100")}>
              {senderIcon(msg.sender)}
            </div>
            <div className={cn("max-w-[75%]")}>
              <div className={cn("rounded-2xl px-4 py-2.5 text-sm", senderBg(msg.sender))}>
                {msg.content}
              </div>
              <p className="text-xs text-gray-400 mt-1 px-1">{formatDateTime(msg.created_at)}</p>
            </div>
          </div>
        );
      })}

      {conv.messages.length === 0 && (
        <p className="text-center text-sm text-gray-500 py-8">Conversation started but no messages yet.</p>
      )}
    </div>
  );
}

function MessagesTab({ leadId }: { leadId: number }) {
  const [messages, setMessages] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leadsApi.messages(leadId).then((r) => {
      setMessages(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [leadId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>;

  if (messages.length === 0) {
    return <p className="text-center text-sm text-gray-500 py-12">No outreach messages sent yet.</p>;
  }

  return (
    <div className="space-y-3">
      {(messages as Array<{ id: number; message_type: string; channel: string; status: string; sent_at?: string; content: string; subject?: string; failed_reason?: string }>).map((msg) => (
        <div key={msg.id} className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700 capitalize">{msg.message_type?.replace("_", " ")}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{msg.channel}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs px-2 py-0.5 rounded-full", STATUS_COLORS[msg.status] || "bg-gray-100 text-gray-600")}>
                {msg.status}
              </span>
              {msg.sent_at && <span className="text-xs text-gray-400">{formatDateTime(msg.sent_at)}</span>}
            </div>
          </div>
          {msg.subject && <p className="text-xs font-medium text-gray-600 mb-1">Subject: {msg.subject}</p>}
          <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">{msg.content}</p>
          {msg.failed_reason && (
            <p className="text-xs text-red-500 mt-2 bg-red-50 rounded-lg p-2">{msg.failed_reason}</p>
          )}
        </div>
      ))}
    </div>
  );
}
