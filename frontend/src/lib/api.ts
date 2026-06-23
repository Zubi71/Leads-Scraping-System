import axios from "axios";
import Cookies from "js-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = Cookies.get("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = Cookies.get("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, null, {
            params: { refresh_token_str: refresh },
          });
          Cookies.set("access_token", data.access_token, { expires: 1 });
          Cookies.set("refresh_token", data.refresh_token, { expires: 7 });
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          Cookies.remove("access_token");
          Cookies.remove("refresh_token");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) => {
    const form = new FormData();
    form.append("username", username);
    form.append("password", password);
    return api.post("/auth/login", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  register: (data: { email: string; username: string; password: string; full_name?: string }) =>
    api.post("/auth/register", data),
};

// ── Campaigns ─────────────────────────────────────────────────────────────
export const campaignsApi = {
  list: () => api.get("/campaigns/"),
  get: (id: number) => api.get(`/campaigns/${id}`),
  create: (data: unknown) => api.post("/campaigns/", data),
  update: (id: number, data: unknown) => api.patch(`/campaigns/${id}`, data),
  delete: (id: number) => api.delete(`/campaigns/${id}`),
  start: (id: number) => api.post(`/campaigns/${id}/start`),
  pause: (id: number) => api.post(`/campaigns/${id}/pause`),
};

// ── Leads ─────────────────────────────────────────────────────────────────
export const leadsApi = {
  list: (params?: Record<string, unknown>) => api.get("/leads/", { params }),
  get: (id: number) => api.get(`/leads/${id}`),
  update: (id: number, data: unknown) => api.patch(`/leads/${id}`, data),
  optOut: (id: number) => api.post(`/leads/${id}/opt-out`),
  messages: (id: number) => api.get(`/leads/${id}/messages`),
};

// ── Conversations ─────────────────────────────────────────────────────────
export const conversationsApi = {
  list: () => api.get("/conversations/"),
  get: (id: number) => api.get(`/conversations/${id}`),
  send: (id: number, content: string, channel?: string) =>
    api.post(`/conversations/${id}/send`, { content, channel }),
  takeover: (id: number) => api.post(`/conversations/${id}/takeover`),
  resumeAI: (id: number) => api.post(`/conversations/${id}/resume-ai`),
};

// ── Deals ─────────────────────────────────────────────────────────────────
export const dealsApi = {
  list: (params?: Record<string, unknown>) => api.get("/deals/", { params }),
  get: (id: number) => api.get(`/deals/${id}`),
  update: (id: number, data: unknown) => api.patch(`/deals/${id}`, data),
};

// ── Analytics ─────────────────────────────────────────────────────────────
export const analyticsApi = {
  overview: (campaign_id?: number) =>
    api.get("/analytics/overview", { params: campaign_id ? { campaign_id } : {} }),
  daily: (days?: number) => api.get("/analytics/daily", { params: { days } }),
  byNiche: () => api.get("/analytics/by-niche"),
  revenueProjection: () => api.get("/analytics/revenue-projection"),
};

// ── Settings ──────────────────────────────────────────────────────────────
export const settingsApi = {
  get: () => api.get("/settings/"),
  update: (data: unknown) => api.patch("/settings/", data),
  me: () => api.get("/settings/me"),
  testWhatsapp: () => api.post("/settings/test-whatsapp"),
  testEmail: () => api.post("/settings/test-email"),
};
