"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import Sidebar from "@/components/layout/Sidebar";
import NotificationToast from "@/components/dashboard/NotificationToast";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!Cookies.get("access_token")) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="app-bg flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <NotificationToast />
    </div>
  );
}
