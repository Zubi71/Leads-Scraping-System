import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(amount: number | null | undefined, currency = "USD"): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export const STATUS_COLORS: Record<string, string> = {
  scraped: "bg-slate-100 text-slate-700",
  queued: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  replied: "bg-orange-100 text-orange-700",
  interested: "bg-emerald-100 text-emerald-700",
  meeting_booked: "bg-purple-100 text-purple-700",
  closed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  opted_out: "bg-gray-100 text-gray-500",
  failed: "bg-red-50 text-red-400",
  // Campaign
  draft: "bg-slate-100 text-slate-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
  // Deal
  confirmed: "bg-blue-100 text-blue-700",
  in_development: "bg-purple-100 text-purple-700",
  delivered: "bg-teal-100 text-teal-700",
  invoiced: "bg-orange-100 text-orange-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export const WEBSITE_QUALITY_LABELS: Record<string, string> = {
  none: "No Website",
  poor: "Poor Website",
  outdated: "Outdated",
  mobile_unfriendly: "Not Mobile-Friendly",
  good: "Good",
};
