"use client";

import React, { useState, useEffect } from "react";
import { X, RefreshCw, Smartphone, KeyRound, ExternalLink, ShieldCheck, Copy, Check } from "lucide-react";

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PairingModal({ isOpen, onClose }: PairingModalProps) {
  const [pairingData, setPairingData] = useState<{
    pairing_token: string;
    numeric_code: string;
    ttl_seconds: number;
    qr_data_url: string;
    qr_payload: any;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchPairingInfo = async () => {
    setIsLoading(true);
    try {
      const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
      const port = typeof window !== "undefined" ? window.location.port || "3000" : "3000";
      const res = await fetch(`/api/devices?host=${encodeURIComponent(host)}&port=${port}`);
      const data = await res.json();
      if (data.pairing) {
        setPairingData(data.pairing);
        setTimeLeft(data.pairing.ttl_seconds || 300);
      }
    } catch (err) {
      console.error("Failed to load pairing info:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPairingInfo();
    }
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          fetchPairingInfo();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, timeLeft]);

  const copyCode = () => {
    if (pairingData?.numeric_code) {
      navigator.clipboard.writeText(pairingData.numeric_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white rounded-lg p-1.5 transition hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Pair Mobile Device</h3>
            <p className="text-xs text-slate-400">Stream camera frames over your local Wi-Fi network</p>
          </div>
        </div>

        {/* QR Code Card */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-5">
          {isLoading || !pairingData ? (
            <div className="flex h-56 w-56 items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-cyan-500" />
            </div>
          ) : (
            <>
              <div className="relative rounded-lg bg-white p-2.5 shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pairingData.qr_data_url}
                  alt="Pairing QR Code"
                  className="h-48 w-48 object-contain"
                />
              </div>

              {/* TTL countdown */}
              <div className="mt-3 flex items-center justify-between w-full text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      timeLeft > 60 ? "bg-emerald-400" : "bg-amber-400 animate-ping"
                    }`}
                  />
                  Token expires in: <strong className="text-slate-200">{timeLeft}s</strong>
                </span>
                <button
                  onClick={fetchPairingInfo}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition text-[11px]"
                >
                  <RefreshCw className="h-3 w-3" /> Regenerate
                </button>
              </div>
            </>
          )}
        </div>

        {/* Manual 6-digit Code Fallback (§9.1) */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-4 w-4 text-cyan-400" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                6-Digit Manual Pairing Code
              </p>
              <p className="text-lg font-mono font-bold tracking-widest text-cyan-300">
                {pairingData?.numeric_code || "------"}
              </p>
            </div>
          </div>
          <button
            onClick={copyCode}
            className="flex items-center gap-1 text-xs rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-slate-300 hover:bg-slate-700 transition"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        {/* Quick Launch Mobile Scanner Link */}
        <div className="mt-4 flex flex-col gap-2">
          <a
            href={`/scanner?code=${pairingData?.numeric_code || ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white py-2.5 text-xs font-semibold shadow-md transition"
          >
            <ExternalLink className="h-4 w-4" /> Open Mobile Companion In New Tab
          </a>

          <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Single-use pairing token protects LAN privacy (§22)
          </p>
        </div>
      </div>
    </div>
  );
}
