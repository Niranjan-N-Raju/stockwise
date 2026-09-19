"use client";

import { FormEvent, useEffect, useState } from "react";
import { InventoryDashboard } from "@/components/inventory-dashboard";

type DatabaseStatus = {
  connected: boolean;
  provider: string;
  database?: string;
  host?: string;
};

export default function Home() {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [users, setUsers] = useState<string[]>([]);
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null);

  useEffect(() => {
    fetch("/api/users", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { users: [] })
      .then((data: { users: string[] }) => setUsers(data.users))
      .catch(() => setUsers([]));

    fetch("/api/database-status", { cache: "no-store" })
      .then(async (response) => {
        const data: DatabaseStatus = await response.json();
        return response.ok ? data : { connected: false, provider: "MongoDB" };
      })
      .then(setDatabaseStatus)
      .catch(() => setDatabaseStatus({ connected: false, provider: "MongoDB" }));
  }, []);

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
    <main className="grid min-h-screen bg-[#f3f5f2] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden bg-[#224c35] p-16 text-white lg:flex lg:flex-col lg:justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c3d8c9]">
          Inventory Management
        </p>
        <div>
          <p className="max-w-xl text-5xl font-semibold leading-tight">
            Keep stock clear, current, and under control.
          </p>
          <p className="mt-6 max-w-md text-lg leading-8 text-[#c3d8c9]">
            Sign in to manage products, stock levels, and daily inventory activity.
          </p>
        </div>
        <p className="text-sm text-[#a8c0af]">Internal inventory workspace</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <p className="mb-8 text-sm font-semibold uppercase tracking-[0.16em] text-[#397052] lg:hidden">
            Inventory Management
          </p>
          <h1 className="text-4xl font-semibold text-[#17251d]">Sign in</h1>
          <p className="mt-3 text-[#657168]">Enter your credentials to continue.</p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-semibold text-[#26382d]">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="h-12 w-full border border-[#c8d0c9] bg-white px-4 text-[#17251d] outline-none transition focus:border-[#397052] focus:ring-2 focus:ring-[#397052]/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#26382d]">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-12 w-full border border-[#c8d0c9] bg-white px-4 text-[#17251d] outline-none transition focus:border-[#397052] focus:ring-2 focus:ring-[#397052]/20"
              />
            </div>

            <p aria-live="polite" className="min-h-6 text-sm font-medium text-[#a63232]">
              {error}
            </p>

            <button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full bg-[#224c35] px-4 font-semibold text-white transition-colors hover:bg-[#173b29] focus:outline-none focus:ring-2 focus:ring-[#397052] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {users.length > 0 && (
            <div className="mt-8 border-t border-[#d8ddd5] pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#748078]">Users</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {users.map((username) => (
                  <span key={username} className="border border-[#d8ddd5] bg-white px-3 py-1.5 text-sm font-medium text-[#405248]">
                    {username}
                  </span>
                ))}
              </div>
            </div>
          )}

          {databaseStatus && (
            <div className="mt-6 border border-[#d8ddd5] bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#748078]">Database</p>
                <span className={`flex items-center gap-2 text-xs font-semibold ${databaseStatus.connected ? "text-[#27613e]" : "text-[#a63232]"}`}>
                  <span className={`h-2 w-2 rounded-full ${databaseStatus.connected ? "bg-[#3d8a5d]" : "bg-[#c43d3d]"}`} />
                  {databaseStatus.connected ? "Connected" : "Unavailable"}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-[#748078]">Provider</dt><dd className="font-medium text-[#26382d]">{databaseStatus.provider}</dd></div>
                {databaseStatus.database && <div className="flex justify-between gap-4"><dt className="text-[#748078]">Database</dt><dd className="font-mono text-xs text-[#26382d]">{databaseStatus.database}</dd></div>}
                {databaseStatus.host && <div className="flex justify-between gap-4"><dt className="text-[#748078]">Cluster</dt><dd className="max-w-[15rem] truncate font-mono text-xs text-[#26382d]" title={databaseStatus.host}>{databaseStatus.host}</dd></div>}
              </dl>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
