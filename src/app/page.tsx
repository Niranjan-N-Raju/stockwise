"use client";

import { FormEvent, useState } from "react";
import { InventoryDashboard } from "@/components/inventory-dashboard";

export default function Home() {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password"),
        }),
      });

      if (!response.ok) {
        const data: { message?: string } = await response.json().catch(() => ({}));
        setError(
          response.status === 401
            ? "Invalid username or password."
            : data.message ?? "Unable to sign in. Please try again.",
        );
        return;
      }

      setIsLoggedIn(true);
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoggedIn) {
    return <InventoryDashboard onSignOut={() => setIsLoggedIn(false)} />;
  }

  return (
    <main className="grid min-h-screen bg-[#f8f7f1] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden bg-[var(--pb-cyan)] p-16 text-white lg:flex lg:flex-col lg:justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">
          Inventory Management
        </p>
        <div>
          <p className="max-w-xl text-5xl font-semibold leading-tight">
            Keep stock clear, current, and under control.
          </p>
          <p className="mt-6 max-w-md text-lg leading-8 text-white/85">
            Sign in to manage products, stock levels, and daily inventory activity.
          </p>
        </div>
        <p className="text-sm text-white/75">Internal inventory workspace</p>
      </section>

      <section className="relative flex items-start justify-center overflow-hidden px-4 pb-8 pt-36 sm:px-8 sm:pt-40 lg:items-center lg:px-12 lg:py-12">
        <div className="absolute inset-x-0 top-0 h-48 bg-[var(--pb-cyan)] lg:hidden">
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-[var(--pb-yellow)]" />
          <div className="px-5 pt-8 sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">Polar Bear</p>
            <p className="mt-2 text-2xl font-semibold text-white">Inventory Management</p>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-md border border-[var(--pb-stone)] bg-white p-6 shadow-[0_18px_50px_rgba(31,41,43,0.14)] sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="mb-7 flex items-center gap-2 lg:hidden">
            <span className="h-1 w-10 bg-[var(--pb-orange)]" />
            <span className="h-1 w-5 bg-[var(--pb-yellow)]" />
          </div>
          <h1 className="text-3xl font-semibold text-[#1f292b] sm:text-4xl">Sign in</h1>
          <p className="mt-2 text-sm text-[#667174] sm:mt-3 sm:text-base">Enter your credentials to continue.</p>

          <form onSubmit={handleSubmit} autoComplete="off" className="mt-7 space-y-5 sm:mt-10 sm:space-y-6">
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-semibold text-[#1f292b]">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="off"
                required
                className="h-12 w-full border border-[var(--pb-stone)] bg-[#fffefa] px-4 text-base text-[#1f292b] outline-none transition focus:border-[var(--pb-cyan)] focus:bg-white focus:ring-2 focus:ring-[var(--pb-cyan)]/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#1f292b]">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="off"
                required
                className="h-12 w-full border border-[var(--pb-stone)] bg-[#fffefa] px-4 text-base text-[#1f292b] outline-none transition focus:border-[var(--pb-cyan)] focus:bg-white focus:ring-2 focus:ring-[var(--pb-cyan)]/20"
              />
            </div>

            <p aria-live="polite" className="min-h-6 text-sm font-medium text-[#b44700]">
              {error}
            </p>

            <button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full bg-[var(--pb-orange)] px-4 text-base font-semibold text-white shadow-[0_6px_18px_rgba(244,117,33,0.22)] transition hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-[var(--pb-orange)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

        </div>
      </section>
    </main>
  );
}
