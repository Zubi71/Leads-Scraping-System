"use client";

import { useEffect, useCallback, useRef } from "react";
import Cookies from "js-cookie";

export type NotificationEvent =
  | { event: "new_reply"; data: { business_name: string; lead_id: number } }
  | { event: "hot_lead"; data: { business_name: string; intent_score: number; lead_id: number } }
  | { event: "deal_closed"; data: { business_name: string; deal_id: number; price: number } }
  | { event: "ping"; data: Record<string, never> };

type Handler = (evt: NotificationEvent) => void;

export function useRealtimeNotifications(onEvent: Handler) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const connect = useCallback(() => {
    const token = Cookies.get("access_token");
    if (!token) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const wsUrl = apiUrl.replace(/^http/, "ws") + `/ws/notifications?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as NotificationEvent;
        handlerRef.current(parsed);
      } catch { /* ignore malformed messages */ }
    };

    ws.onclose = () => {
      // Auto-reconnect after 3s
      setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);
}
