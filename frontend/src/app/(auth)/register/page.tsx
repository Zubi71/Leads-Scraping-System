"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Cookies from "js-cookie";
import { authApi } from "@/lib/api";
import { Bot, Loader2, ArrowRight } from "lucide-react";

const schema = z.object({
  full_name: z.string().min(1, "Required"),
  email:     z.string().email("Invalid email"),
  username:  z.string().min(3, "Min 3 chars").regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers & underscore only"),
  password:  z.string().min(8, "Min 8 characters"),
  confirm:   z.string(),
}).refine(d => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setError("");
    try {
      await authApi.register({ email: data.email, username: data.username, password: data.password, full_name: data.full_name });
      const res = await authApi.login(data.username, data.password);
      Cookies.set("access_token",  res.data.access_token,  { expires: 1 });
      Cookies.set("refresh_token", res.data.refresh_token, { expires: 7 });
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Registration failed. Please try again.");
    }
  }

  const fields = [
    { name: "full_name" as const, label: "Full Name",        type: "text",     placeholder: "John Smith" },
    { name: "email"     as const, label: "Email Address",    type: "email",    placeholder: "you@example.com" },
    { name: "username"  as const, label: "Username",         type: "text",     placeholder: "johnsmith" },
    { name: "password"  as const, label: "Password",         type: "password", placeholder: "Min 8 characters" },
    { name: "confirm"   as const, label: "Confirm Password", type: "password", placeholder: "Repeat password" },
  ];

  return (
    <div className="app-bg min-h-screen flex items-center justify-center p-6">
      {/* Background orbs */}
      <div className="fixed top-1/3 left-1/4 w-72 h-72 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-56 h-56 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 items-center justify-center mb-4 glow-blue">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-white/40 text-sm mt-1">Start automating your lead generation</p>
        </div>

        <div className="glass-strong rounded-3xl p-8">
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {fields.map(({ name, label, type, placeholder }) => (
              <div key={name}>
                <label className="block text-sm font-medium text-white/60 mb-1.5">{label}</label>
                <input
                  {...register(name)}
                  type={type}
                  placeholder={placeholder}
                  className="glass-input w-full px-4 py-3 rounded-xl text-sm"
                />
                {errors[name] && <p className="text-red-400 text-xs mt-1.5">{errors[name]?.message}</p>}
              </div>
            ))}

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 rounded-xl mt-1">
              {isSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>
                : <><span>Create Account</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-sm text-white/30 mt-6">
            Already have an account?{" "}
            <a href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
