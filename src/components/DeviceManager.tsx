"use client";

import React, { useState, useEffect } from "react";
import {
  Smartphone,
  ShieldAlert,
  Radio,
  Trash2,
  RefreshCw,
  KeyRound,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

interface Device {
  id: string;
  name: string;
  firstPairedAt: string;
  lastSeenAt: string;
  status: "paired" | "active" | "disconnected" | "revoked";
  ipAddress?: string | null;
}

export function DeviceManager() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [currentSession, setCurrentSession] = useState<any | null>(null);
  const [pairingInfo, setPairingInfo] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/devices");
      const data = await res.json();
      if (data.devices) {
        setDevices(data.devices);
        setCurrentSession(data.current_streaming_session);
        setPairingInfo(data.pairing);
      }
    } catch (err) {
      console.error("Failed to load devices:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this device? It will be cut off from streaming immediately.")) return;

    try {
      const res = await fetch(`/api/devices/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadDevices();
      }
    } catch (err) {
      console.error("Failed to revoke device:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">Device Management & Pairing Hub</span>
              <span className="rounded bg-cyan-950 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-400 border border-cyan-800">
                §9 & §21 Concurrency Guard
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Secure local-only device pairing, single active mobile streamer guard, and session tokens
            </p>
          </div>
        </div>

        <button
          onClick={loadDevices}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 text-xs font-medium transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Grid: Paired Devices & Active QR Code */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Paired Devices List (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Radio className="h-4 w-4 text-cyan-400" /> Paired Mobile Devices ({devices.length})
              </h3>
              <span className="text-[11px] text-slate-400">
                §21 Constraint: 1 active mobile stream at a time
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Device Name</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Last Seen</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {devices.map((dev) => (
                    <tr key={dev.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 font-semibold text-white flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-slate-400" />
                        <span>{dev.name}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            dev.status === "paired"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : dev.status === "active"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse"
                              : dev.status === "revoked"
                              ? "bg-red-500/20 text-red-300 border border-red-500/40"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {dev.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                        {new Date(dev.lastSeenAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                        {dev.ipAddress || "127.0.0.1"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {dev.status !== "revoked" ? (
                          <button
                            onClick={() => handleRevoke(dev.id)}
                            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 ml-auto rounded px-2 py-1 hover:bg-red-950/40 border border-transparent hover:border-red-900/60 transition"
                            title="Revoke session"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Revoke
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Revoked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Live Pairing QR & Code (1 Col) */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-cyan-400" /> Active Pairing Token (§9.1)
            </h4>

            {pairingInfo && (
              <div className="space-y-3 flex flex-col items-center">
                <div className="rounded-xl bg-white p-2.5 shadow">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pairingInfo.qr_data_url}
                    alt="Pairing QR"
                    className="h-44 w-44 object-contain"
                  />
                </div>

                <div className="w-full rounded-lg bg-slate-950 p-2.5 border border-slate-800 text-center">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                    6-Digit Code Fallback
                  </span>
                  <span className="font-mono text-xl font-bold tracking-widest text-cyan-300">
                    {pairingInfo.numeric_code}
                  </span>
                </div>

                <a
                  href={`/scanner?code=${pairingInfo.numeric_code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white py-2 text-xs font-semibold shadow transition"
                >
                  <ExternalLink className="h-4 w-4" /> Open Mobile Companion
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
