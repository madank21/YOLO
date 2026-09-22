"use client";

import React, { useState, useEffect } from "react";
import {
  Sliders,
  Save,
  Check,
  FileText,
  Shield,
  Activity,
  Layers,
  HelpCircle,
  Clock,
  RefreshCw,
} from "lucide-react";

export function SystemSettings() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedLogLevel, setSelectedLogLevel] = useState<string>("ALL");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Load config & logs
  const loadData = async () => {
    try {
      const confRes = await fetch("/api/system/config");
      const confData = await confRes.json();
      if (confData.config) setConfig(confData.config);

      const logsRes = await fetch("/api/system/logs?limit=50");
      const logsData = await logsRes.json();
      if (logsData.logs) setLogs(logsData.logs);
    } catch (err) {
      console.error("Failed to load system settings:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/system/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save config:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLogs =
    selectedLogLevel === "ALL" ? logs : logs.filter((l) => l.level === selectedLogLevel);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">System Configuration & Audit Logs</span>
              <span className="rounded bg-cyan-950 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-400 border border-cyan-800">
                §8 & §25 Structured Logging
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Runtime tunable parameters that persist across restarts without editing .env
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 text-xs font-medium transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Grid: Config Form + Coordinate Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Runtime Configuration Form (§8) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2 mb-3">
            <Sliders className="h-4 w-4 text-cyan-400" /> Runtime Tunable Parameters (§8)
          </h3>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Confidence Threshold: <strong className="text-cyan-300 font-mono">{config.CONFIDENCE_THRESHOLD || "0.40"}</strong>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={config.CONFIDENCE_THRESHOLD || "0.25"}
                  onChange={(e) => setConfig({ ...config, CONFIDENCE_THRESHOLD: e.target.value })}
                  className="w-full h-1.5 bg-slate-800 accent-cyan-500 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  IoU Threshold: <strong className="text-cyan-300 font-mono">{config.IOU_THRESHOLD || "0.45"}</strong>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={config.IOU_THRESHOLD || "0.45"}
                  onChange={(e) => setConfig({ ...config, IOU_THRESHOLD: e.target.value })}
                  className="w-full h-1.5 bg-slate-800 accent-cyan-500 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Stream Target FPS</label>
                <input
                  type="number"
                  value={config.STREAM_TARGET_FPS || "30"}
                  onChange={(e) => setConfig({ ...config, STREAM_TARGET_FPS: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Stream JPEG Quality</label>
                <input
                  type="number"
                  value={config.STREAM_JPEG_QUALITY || "70"}
                  onChange={(e) => setConfig({ ...config, STREAM_JPEG_QUALITY: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Retention (Days)</label>
                <input
                  type="number"
                  value={config.DETECTION_EVENT_RETENTION_DAYS || "30"}
                  onChange={(e) => setConfig({ ...config, DETECTION_EVENT_RETENTION_DAYS: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Pairing Token TTL (s)</label>
                <input
                  type="number"
                  value={config.PAIRING_TOKEN_TTL_SECONDS || "300"}
                  onChange={(e) => setConfig({ ...config, PAIRING_TOKEN_TTL_SECONDS: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">Changes take effect immediately on next frame.</span>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 text-xs font-semibold shadow transition"
              >
                {saveSuccess ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                <span>{saveSuccess ? "Saved!" : "Save Config"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Interactive Coordinate Pipeline Docs (§11) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-400" /> Coordinate Transform Pipeline (§11)
          </h3>
          <p className="text-xs text-slate-400">
            Named transform functions with non-square 1280×720 worked numeric example:
          </p>

          <div className="space-y-2 text-[11px] font-mono">
            <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
              <span className="text-cyan-400 font-bold">(A) CAMERA SPACE:</span> 1280 × 720 px raw capture
            </div>
            <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
              <span className="text-blue-400 font-bold">(B) UPRIGHT SPACE:</span> Orientation 1 (no EXIF rotation needed)
            </div>
            <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
              <span className="text-purple-400 font-bold">(C) MODEL INPUT (640×640):</span>
              <br />
              <span className="text-slate-400">scale = 640/1280 = 0.5 • padX = 0, padY = (640 - 360)/2 = 140</span>
            </div>
            <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
              <span className="text-emerald-400 font-bold">(D) NORMALIZED SPACE:</span> [xCenter, yCenter, w, h] in [0,1]
            </div>
            <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
              <span className="text-amber-400 font-bold">(E) DISPLAY CANVAS:</span> multiplied by{" "}
              <code>getBoundingClientRect()</code>
            </div>
          </div>
        </div>
      </div>

      {/* Structured Audit Logs Viewer (§25) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-400" /> Structured System Logs ({filteredLogs.length})
          </h3>

          <div className="flex items-center gap-1 rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            {["ALL", "INFO", "WARNING", "ERROR"].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLogLevel(lvl)}
                className={`rounded px-2.5 py-0.5 font-medium transition ${
                  selectedLogLevel === lvl ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 text-[11px]">
              <tr>
                <th className="py-2 px-3">Time</th>
                <th className="py-2 px-3">Level</th>
                <th className="py-2 px-3">Event</th>
                <th className="py-2 px-3">Code</th>
                <th className="py-2 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {filteredLogs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-900/40">
                  <td className="py-2 px-3 text-[10px] text-slate-400 whitespace-nowrap">
                    {new Date(l.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        l.level === "INFO"
                          ? "bg-blue-950 text-blue-300"
                          : l.level === "WARNING"
                          ? "bg-amber-950 text-amber-300"
                          : "bg-red-950 text-red-300"
                      }`}
                    >
                      {l.level}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-200">{l.event}</td>
                  <td className="py-2 px-3 text-cyan-400 text-[11px]">{l.code}</td>
                  <td className="py-2 px-3 text-slate-400 truncate max-w-xs text-[11px]">
                    {JSON.stringify(l.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
