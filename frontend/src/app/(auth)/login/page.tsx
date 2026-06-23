"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Cookies from "js-cookie";
import { authApi } from "@/lib/api";
import { Bot, Loader2, Zap, Shield, TrendingUp } from "lucide-react";

const schema = z.object({
  username: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});
type FormData = z.infer<typeof schema>;

const FEATURES = [
  { icon: Zap,        text: "AI-powered outreach automation"  },
  { icon: Shield,     text: "Smart conversation handling"     },
  { icon: TrendingUp, text: "Real-time deal notifications"    },
];

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setError("");
    try {
      const res = await authApi.login(data.username, data.password);
      Cookies.set("access_token",  res.data.access_token,  { expires: 1 });
      Cookies.set("refresh_token", res.data.refresh_token, { expires: 7 });
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Invalid credentials. Please try again.");
    }
  }

  return (
    <div className="app-bg min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 relative">
        {/* Floating orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-blue-600/10 blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-violet-600/10 blur-3xl animate-float" style={{ animationDelay: "2s" }} />

        <div className="relative z-10 max-w-md text-center">
          <div className="inline-flex w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-violet-600 items-center justify-center mb-8 glow-blue">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            Turn leads into<br />
            <span className="gradient-text">paying clients</span><br />
            automatically
          </h2>
          <p className="text-white/50 text-lg mb-10">
            AI finds businesses without websites, contacts them, handles objections,
            and closes deals — while you sleep.
          </p>
          <div className="space-y-3 text-left">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 glass rounded-xl px-4 py-3">
                <Icon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-white/70 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 lg:max-w-lg flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-up">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 items-center justify-center mb-3 glow-blue">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">AI Leads System</h1>
          </div>

          <div className="glass-strong rounded-3xl p-8">
            <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
            <p className="text-white/40 text-sm mb-7">Sign in to your dashboard</p>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">Email or Username</label>
                <input
                  {...register("username")}
                  className="glass-input w-full px-4 py-3 rounded-xl text-sm"
                  placeholder="you@example.com"
                />
                {errors.username && <p className="text-red-400 text-xs mt-1.5">{errors.username.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">Password</label>
                <input
                  {...register("password")}
                  type="password"
                  className="glass-input w-full px-4 py-3 rounded-xl text-sm"
                  placeholder="••••••••"
                />
                {errors.password && <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>}
              </div>

              <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 rounded-xl mt-2">
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : "Sign in"}
              </button>
            </form>

            <p className="text-center text-sm text-white/30 mt-6">
              Don&apos;t have an account?{" "}
              <a href="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">Create one</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
