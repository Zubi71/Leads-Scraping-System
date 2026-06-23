export type UserRole = "admin" | "user";

export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export type CampaignStatus = "draft" | "active" | "paused" | "completed";

export interface Campaign {
  id: number;
  owner_id: number;
  name: string;
  niche: string;
  country: string;
  city: string;
  area: string | null;
  language: string;
  target_no_website: boolean;
  target_poor_website: boolean;
  target_outdated_website: boolean;
  target_mobile_unfriendly: boolean;
  package_name: string | null;
  package_price: number | null;
  package_description: string | null;
  max_leads: number;
  max_messages_per_day: number;
  status: CampaignStatus;
  total_leads: number;
  leads_contacted: number;
  leads_replied: number;
  leads_interested: number;
  deals_closed: number;
  created_at: string;
  updated_at: string | null;
  last_run_at: string | null;
}

export type LeadStatus =
  | "scraped"
  | "queued"
  | "contacted"
  | "replied"
  | "interested"
  | "meeting_booked"
  | "closed"
  | "rejected"
  | "opted_out"
  | "failed";

export type WebsiteQuality = "none" | "poor" | "outdated" | "mobile_unfriendly" | "good";
export type OutreachChannel = "whatsapp" | "email" | "both";

export interface Lead {
  id: number;
  campaign_id: number;
  business_name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  google_maps_url: string | null;
  rating: number | null;
  review_count: number;
  website_quality: WebsiteQuality | null;
  website_score: number;
  website_analysis_notes: string | null;
  status: LeadStatus;
  outreach_channel: OutreachChannel | null;
  first_contact_at: string | null;
  last_contact_at: string | null;
  reply_count: number;
  is_hot_lead: boolean;
  opted_out: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export type MessageSender = "ai" | "human" | "operator";
export type ConversationStage =
  | "initial_outreach"
  | "engaged"
  | "objection_handling"
  | "pricing_discussion"
  | "booking"
  | "closed_won"
  | "closed_lost";

export interface ConversationMessage {
  id: number;
  conversation_id: number;
  sender: MessageSender;
  content: string;
  channel: string | null;
  ai_model: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: number;
  lead_id: number;
  stage: ConversationStage;
  is_ai_active: boolean;
  is_resolved: boolean;
  intent_score: number;
  started_at: string;
  last_message_at: string | null;
  messages: ConversationMessage[];
}

export type DealStatus =
  | "confirmed"
  | "in_development"
  | "delivered"
  | "invoiced"
  | "paid"
  | "cancelled";

export interface Deal {
  id: number;
  lead_id: number;
  campaign_id: number;
  client_name: string;
  business_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  contact_whatsapp: string | null;
  package_name: string | null;
  package_price: number | null;
  currency: string;
  custom_notes: string | null;
  status: DealStatus;
  confirmed_at: string;
  development_started_at: string | null;
  delivered_at: string | null;
  paid_at: string | null;
  notification_sent: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface AnalyticsOverview {
  total_leads: number;
  contacted: number;
  replied: number;
  interested: number;
  closed_deals: number;
  rejected: number;
  hot_leads: number;
  today_contacted: number;
  total_revenue: number;
  reply_rate: number;
  conversion_rate: number;
}
