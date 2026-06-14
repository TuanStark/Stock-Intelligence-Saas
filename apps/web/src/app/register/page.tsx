"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslation } from "@/lib/i18n/i18n-context";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { authApi } from "@/lib/api/auth.api";

export default function RegisterPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) return;

    if (password !== confirmPassword) {
      setErrorMsg(t("auth.passwordsMismatch"));
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      // Call NestJS registration endpoint using central Axios helper
      const registerResult = await authApi.register(email, password);

      if (!registerResult.success) {
        setErrorMsg(
          registerResult.error?.message || t("auth.registrationFailed"),
        );
        setLoading(false);
        return;
      }

      // Auto login after registration
      const loginResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/",
      });

      if (loginResult?.error) {
        setErrorMsg(t("auth.invalidCredentials"));
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.error?.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container flex items-center justify-center min-h-screen p-6 relative">
      {/* Floating language selector */}
      <div className="absolute top-6 right-6 flex gap-2">
        <button
          onClick={() => setLocale("vi")}
          className={`py-1 px-2.5 rounded-[6px] text-xs font-semibold cursor-pointer border transition-colors ${
            locale === "vi"
              ? "border-accent bg-accent/15 text-accent"
              : "border-board-border bg-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          VI
        </button>
        <button
          onClick={() => setLocale("en")}
          className={`py-1 px-2.5 rounded-[6px] text-xs font-semibold cursor-pointer border transition-colors ${
            locale === "en"
              ? "border-accent bg-accent/15 text-accent"
              : "border-board-border bg-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          EN
        </button>
      </div>

      <div className="glass-panel font-inter w-full max-w-[420px] p-10 rounded-2xl border border-board-border shadow-2xl">
        {/* LOGO */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <img
            src="/logo-new.png"
            alt="StockIntel Logo"
            className="w-9 h-9 rounded-lg object-cover shrink-0"
          />
          <h2 className="font-outfit text-[22px] font-extrabold tracking-tight">
            STOCK<span className="text-accent">INTEL</span>
          </h2>
        </div>

        <h3 className="font-outfit text-2xl font-extrabold text-center mb-2 text-text-primary">
          {t("auth.registerTitle")}
        </h3>
        <p className="text-text-secondary text-xs text-center leading-relaxed mb-8">
          {t("auth.registerSub")}
        </p>

        {errorMsg && (
          <div className="py-3 px-4 bg-bearish/10 border border-bearish/20 rounded-lg text-bearish text-xs font-medium mb-5">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
              {t("auth.email")}
            </label>
            <div className="flex items-center gap-3 bg-surface border border-board-border rounded-lg py-2.5 px-4 focus-within:border-accent transition-all duration-200">
              <Mail size={16} className="text-text-muted" />
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent border-0 outline-none text-text-primary text-sm w-full"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
              {t("auth.password")}
            </label>
            <div className="flex items-center gap-3 bg-surface border border-board-border rounded-lg py-2.5 px-4 focus-within:border-accent transition-all duration-200">
              <Lock size={16} className="text-text-muted" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-transparent border-0 outline-none text-text-primary text-sm w-full"
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
              {t("auth.confirmPassword")}
            </label>
            <div className="flex items-center gap-3 bg-surface border border-board-border rounded-lg py-2.5 px-4 focus-within:border-accent transition-all duration-200">
              <Lock size={16} className="text-text-muted" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-transparent border-0 outline-none text-text-primary text-sm w-full"
              />
            </div>
          </div>

          {/* Register Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary py-3.5 text-sm font-semibold w-full flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="pulse text-white" />
                {t("common.loading")}
              </>
            ) : (
              <>
                {t("auth.registerBtn")}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 text-xs text-text-secondary">
          {t("auth.hasAccount")}{" "}
          <Link
            href="/login"
            className="text-accent font-semibold no-underline hover:underline"
          >
            {t("auth.loginPrompt")}
          </Link>
        </div>
      </div>
    </div>
  );
}
