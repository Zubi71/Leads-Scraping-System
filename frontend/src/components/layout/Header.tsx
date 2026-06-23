"use client";

import { Bell, Search } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="h-16 glass border-b border-white/[0.06] flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-30">
      <div>
        <h1 className="text-base font-bold text-white">{title}</h1>
        {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            placeholder="Search..."
            className="glass-input pl-9 pr-4 py-2 text-sm rounded-xl w-52 text-sm"
          />
        </div>
        <button className="relative p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse-glow" />
        </button>
      </div>
    </header>
  );
}
