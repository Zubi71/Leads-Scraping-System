"use client";

import { useEffect, useState } from "react";
import { conversationsApi } from "@/lib/api";
import { Conversation, ConversationMessage } from "@/types";
import Header from "@/components/layout/Header";
import { Bot, User, UserCog, Send, Loader2, BrainCircuit, UserCheck, MessageSquare } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

export default function ConversationsPage() {
  const [convs, setConvs]       = useState<Conversation[]>([]);
  const [sel, setSel]           = useState<Conversation | null>(null);
  const [reply, setReply]       = useState("");
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => { conversationsApi.list().then(r => { setConvs(r.data); setLoading(false); }); }, []);

  const selectConv = async (c: Conversation) => { const r = await conversationsApi.get(c.id); setSel(r.data); };

  const sendMsg = async () => {
    if (!reply.trim() || !sel) return;
    setSending(true);
    await conversationsApi.send(sel.id, reply);
    setReply("");
    const r = await conversationsApi.get(sel.id);
    setSel(r.data);
    setSending(false);
  };

  const takeover = async () => {
    if (!sel) return;
    await conversationsApi.takeover(sel.id);
    const r = await conversationsApi.get(sel.id);
    setSel(r.data);
    setConvs(p => p.map(c => c.id === sel.id ? r.data : c));
  };

  const resumeAI = async () => {
    if (!sel) return;
    await conversationsApi.resumeAI(sel.id);
    const r = await conversationsApi.get(sel.id);
    setSel(r.data);
    setConvs(p => p.map(c => c.id === sel.id ? r.data : c));
  };

  const intentColor = (s: number) => s >= 75 ? "text-emerald-400" : s >= 50 ? "text-yellow-400" : "text-white/30";
  const intentBg    = (s: number) => s >= 75 ? "bg-emerald-500/15" : s >= 50 ? "bg-yellow-500/15" : "bg-white/[0.05]";

  const MsgBubble = ({ msg }: { msg: ConversationMessage }) => {
    const isOut = msg.sender !== "human";
    return (
      <div className={cn("flex gap-2 max-w-[82%]", isOut ? "flex-row-reverse ml-auto" : "")}>
        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
          msg.sender === "ai" ? "bg-blue-500/20" : msg.sender === "operator" ? "bg-violet-500/20" : "bg-white/[0.07]")}>
          {msg.sender === "ai" && <Bot className="w-3.5 h-3.5 text-blue-400" />}
          {msg.sender === "operator" && <UserCog className="w-3.5 h-3.5 text-violet-400" />}
          {msg.sender === "human" && <User className="w-3.5 h-3.5 text-white/50" />}
        </div>
        <div>
          <div className={cn("rounded-2xl px-4 py-2.5 text-sm",
            isOut
              ? msg.sender === "operator" ? "bg-violet-600/80 text-white" : "bg-blue-600/80 text-white"
              : "glass text-white/80"
          )}>
            {msg.content}
          </div>
          <p className="text-[11px] text-white/20 mt-1 px-1">{formatDateTime(msg.created_at)}</p>
        </div>
      </div>
    );
  };

  return (
    <div>
      <Header title="Conversations" subtitle="Monitor and control AI conversations" />
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">

        {/* List */}
        <div className="w-72 glass-sidebar border-r-0 flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-white/[0.05] text-xs text-white/30 font-medium">
            {convs.length} conversations
          </div>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
              {convs.map(c => (
                <button key={c.id} onClick={() => selectConv(c)}
                        className={cn("w-full text-left px-4 py-3.5 hover:bg-white/[0.03] transition-colors",
                          sel?.id === c.id ? "bg-blue-600/10 border-l-2 border-blue-500" : "border-l-2 border-transparent")}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-white/80">Lead #{c.lead_id}</p>
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", intentBg(c.intent_score), intentColor(c.intent_score))}>
                      {c.intent_score}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", c.is_ai_active ? "bg-blue-400 animate-pulse-glow" : "bg-violet-400")} />
                    <p className="text-[11px] text-white/30 truncate">
                      {c.is_ai_active ? "AI Active" : "Manual"} · {c.stage.replace("_", " ")}
                    </p>
                  </div>
                </button>
              ))}
              {convs.length === 0 && (
                <div className="flex flex-col items-center py-16 px-4">
                  <MessageSquare className="w-8 h-8 text-white/10 mb-2" />
                  <p className="text-xs text-white/25 text-center">No conversations yet</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col">
          {sel ? (
            <>
              {/* Chat header */}
              <div className="glass border-b border-white/[0.06] px-6 py-3.5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">Conversation #{sel.id}</p>
                  <p className="text-xs text-white/35 mt-0.5">
                    Intent: <span className={cn("font-bold", intentColor(sel.intent_score))}>{sel.intent_score}%</span>
                    {" · "}Stage: {sel.stage.replace("_", " ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {sel.is_ai_active ? (
                    <button onClick={takeover} className="flex items-center gap-1.5 px-3 py-2 bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 rounded-xl text-xs font-semibold transition-all">
                      <UserCheck className="w-3.5 h-3.5" /> Take Over
                    </button>
                  ) : (
                    <button onClick={resumeAI} className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 rounded-xl text-xs font-semibold transition-all">
                      <BrainCircuit className="w-3.5 h-3.5" /> Resume AI
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {sel.messages.map(msg => <MsgBubble key={msg.id} msg={msg} />)}
                {sel.messages.length === 0 && (
                  <p className="text-center text-sm text-white/25 py-10">No messages yet</p>
                )}
              </div>

              {/* Reply */}
              <div className="glass border-t border-white/[0.06] p-4 flex gap-3">
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                  placeholder="Type a manual reply… (Enter to send)"
                  rows={2}
                  className="glass-input flex-1 px-4 py-3 rounded-xl text-sm resize-none"
                />
                <button onClick={sendMsg} disabled={sending || !reply.trim()}
                        className="btn-primary px-4 py-2 rounded-xl self-end disabled:opacity-40">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <MessageSquare className="w-12 h-12 text-white/10" />
              <p className="text-white/25 text-sm">Select a conversation to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
