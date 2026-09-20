"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/login")
      .then((response) => response.json())
      .then((data) => setAuthenticated(data.authenticated === true))
      .catch(() => setAuthenticated(false));
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    });
    if (!response.ok) {
      setError("Authentication failed.");
      return;
    }
    setApiKey("");
    setAuthenticated(true);
  }

  if (authenticated === null) return <div className="min-h-screen bg-slate-950" />;
  if (authenticated) return <>{children}</>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <form onSubmit={login} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div>
          <h1 className="text-lg font-semibold">VisionForge Admin</h1>
          <p className="mt-1 text-xs text-slate-400">Authenticate to access datasets, models, and inference.</p>
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Administrator API key"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          autoComplete="current-password"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button type="submit" className="w-full rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold hover:bg-cyan-500">
          Sign in
        </button>
      </form>
    </main>
  );
}
