"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Megaphone, MessageSquare,
  Handshake, BarChart3, Settings, Bot, LogOut, Upload, Send,
} from "lucide-react";
import Cookies from "js-cookie";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard",     label: "Overview",       icon: LayoutDashboard },
  { href: "/leads",         label: "Leads",           icon: Users },
  { href: "/campaigns",     label: "Campaigns",       icon: Megaphone },
  { href: "/outreach",      label: "Outreach Queue",  icon: Send },
  { href: "/conversations", label: "Conversations",   icon: MessageSquare },
  { href: "/deals",         label: "Closed Deals",    icon: Handshake },
  { href: "/analytics",     label: "Analytics",       icon: BarChart3 },
  { href: "/import",        label: "Import CSV",      icon: Upload },
  { href: "/settings",      label: "Settings",        icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  function logout() {
    Cookies.remove("access_token");
    Cookies.remove("refresh_token");
    router.push("/login");
  }

  return (
    <aside className="w-64 min-h-screen glass-sidebar flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.06]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 glow-blue">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">AI Leads</p>
          <p className="text-white/40 text-[11px]">Website Acquisition</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                active
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 glow-blue"
                  : "text-white/50 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              <Icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-blue-400" : "text-white/40")} />
              {label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse-glow" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/[0.06]">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
