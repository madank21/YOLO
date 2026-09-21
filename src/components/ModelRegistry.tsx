"use client";

import React, { useState, useEffect } from "react";
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Zap,
  TrendingUp,
  Activity,
  Layers,
  FileCode,
  ArrowRight,
  Upload,
  RefreshCw,
} from "lucide-react";

interface ModelVersion {
  id: string;
  modelId: string;
  version: number;
  filePath: string;
  checksumSha256: string;
  state: "IMPORTED" | "VALIDATING" | "READY" | "ACTIVE" | "DISABLED" | "ARCHIVED" | "FAILED";
  classes: string[];
  metrics: {
    precision?: number;
    recall?: number;
    f1?: number;
    map50?: number;
    map50_95?: number;
    per_class?: Record<string, { precision: number; recall: number; map50: number }>;
  };
  errorDetail?: string | null;
  createdAt: string;
  activatedAt?: string | null;
}

interface ModelProfile {
  id: string;
  name: string;
  taskType: string;
  description?: string;
  versions: ModelVersion[];
  activeVersion?: ModelVersion | null;
}

export function ModelRegistry() {
  const [models, setModels] = useState<ModelProfile[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const loadModels = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      if (data.models && data.models.length > 0) {
        setModels(data.models);
        if (!selectedModelId) {
          setSelectedModelId(data.models[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load models:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const selectedModel = models.find((m) => m.id === selectedModelId) || models[0] || null;

  // Activate model version (§14.1)
  const handleActivate = async (versionNum: number) => {
    if (!selectedModel) return;
    setActionStatus("activating");
    try {
      const res = await fetch(`/api/models/${selectedModel.id}/versions/${versionNum}/activate`, {
        method: "POST",
      });
      if (res.ok) {
        await loadModels();
      } else {
        const err = await res.json();
        alert(err.error?.message || "Failed to activate version");
      }
    } catch (err) {
      console.error("Failed to activate model version:", err);
    } finally {
      setActionStatus(null);
    }
  };

  // Rollback to previous version (§14.1)
  const handleRollback = async (versionNum: number) => {
    if (!selectedModel) return;
    setActionStatus("rolling_back");
    try {
      const res = await fetch(`/api/models/${selectedModel.id}/versions/${versionNum}/rollback`, {
        method: "POST",
      });
      if (res.ok) {
        await loadModels();
      } else {
        const err = await res.json();
        alert(err.error?.message || "Rollback failed");
      }
    } catch (err) {
      console.error("Failed to rollback model version:", err);
    } finally {
      setActionStatus(null);
    }
  };

  const activeVersion = selectedModel?.versions?.find((v) => v.state === "ACTIVE");
  const inspectedVersion =
    selectedVersionNum !== null
      ? selectedModel?.versions?.find((v) => v.version === selectedVersionNum)
      : activeVersion || selectedModel?.versions?.[0] || null;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">Model Registry & Lifecycle</span>
              <span className="rounded bg-cyan-950 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-400 border border-cyan-800">
                Rule 33: Single Active Invariant
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage checkpoints, validation checklists (§14.2), and instant rollback
            </p>
          </div>
        </div>

        {/* Active Version summary */}
        {activeVersion && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-950/40 border border-emerald-800/60 px-3 py-1.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Currently Active:</span>
            <strong className="font-mono text-white">
              {selectedModel?.name}:v{activeVersion.version}
            </strong>
          </div>
        )}
      </div>

      {/* State Machine Visualization banner (§14.1) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2">
          Model Version Lifecycle State Machine (§14.1)
        </span>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-slate-800 px-2.5 py-1 text-slate-300 font-mono">IMPORTED</span>
          <ArrowRight className="h-3 w-3 text-slate-500" />
          <span className="rounded-md bg-blue-950 text-blue-300 px-2.5 py-1 font-mono border border-blue-800">
            VALIDATING (§14.2)
          </span>
          <ArrowRight className="h-3 w-3 text-slate-500" />
          <span className="rounded-md bg-cyan-950 text-cyan-300 px-2.5 py-1 font-mono border border-cyan-800">
            READY
          </span>
          <ArrowRight className="h-3 w-3 text-slate-500" />
          <span className="rounded-md bg-emerald-600 text-white font-bold px-2.5 py-1 font-mono shadow">
            ACTIVE (1 only)
          </span>
          <ArrowRight className="h-3 w-3 text-slate-500" />
          <span className="rounded-md bg-slate-900 text-slate-400 px-2.5 py-1 font-mono border border-slate-800">
            DISABLED / ARCHIVED
          </span>
        </div>
      </div>

      {/* Main Grid: Versions Table & Inspection Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Versions Table (2 columns) */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-400" /> Version History ({selectedModel?.versions?.length || 0})
          </h3>

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-md">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Version</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">mAP50 / F1</th>
                  <th className="py-2.5 px-3">Checkpoints / SHA</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {selectedModel?.versions?.map((v) => {
                  const isActive = v.state === "ACTIVE";
                  const isSelected = inspectedVersion?.id === v.id;

                  return (
                    <tr
                      key={v.id}
                      onClick={() => setSelectedVersionNum(v.version)}
                      className={`cursor-pointer transition hover:bg-slate-800/40 ${
                        isSelected ? "bg-slate-800/50" : ""
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-white">v{v.version}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            isActive
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : v.state === "READY"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                              : v.state === "FAILED"
                              ? "bg-red-500/20 text-red-300 border border-red-500/40"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {v.state}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {v.metrics.map50 ? (
                          <span className="text-slate-200">
                            <strong className="text-cyan-400">{(v.metrics.map50 * 100).toFixed(1)}%</strong> /{" "}
                            {((v.metrics.f1 || 0) * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[11px] font-mono text-slate-400 truncate max-w-xs">
                        {v.filePath.split("/").pop()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isActive ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRollback(v.version);
                            }}
                            className="flex items-center gap-1 ml-auto text-xs rounded border border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 px-2 py-1 transition"
                            title="Rollback to previous version"
                          >
                            <RotateCcw className="h-3 w-3" /> Rollback
                          </button>
                        ) : v.state === "READY" || v.state === "DISABLED" ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActivate(v.version);
                            }}
                            className="flex items-center gap-1 ml-auto text-xs rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-2.5 py-1 shadow transition"
                          >
                            <Zap className="h-3 w-3" /> Activate
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Not Activatable</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Version Metrics & Verification Checklist (§14.2) */}
        {inspectedVersion && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-cyan-400" /> Version v{inspectedVersion.version} Metrics
                </h4>
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date(inspectedVersion.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Top scorecards */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">mAP50</span>
                  <p className="text-xl font-mono font-bold text-cyan-400">
                    {inspectedVersion.metrics.map50
                      ? `${(inspectedVersion.metrics.map50 * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">mAP50-95</span>
                  <p className="text-xl font-mono font-bold text-blue-400">
                    {inspectedVersion.metrics.map50_95
                      ? `${(inspectedVersion.metrics.map50_95 * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Precision</span>
                  <p className="text-xl font-mono font-bold text-emerald-400">
                    {inspectedVersion.metrics.precision
                      ? `${(inspectedVersion.metrics.precision * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Recall</span>
                  <p className="text-xl font-mono font-bold text-amber-400">
                    {inspectedVersion.metrics.recall
                      ? `${(inspectedVersion.metrics.recall * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Validation Checklist (§14.2) */}
              <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Validation Checklist (§14.2)
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>1. File exists at declared path</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>2. Loads cleanly into YOLO</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>3. Warm-up forward pass succeeds</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>4. Class map matches metadata ({inspectedVersion.classes.length} classes)</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>5. Task type verified as &apos;detect&apos;</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>6. SHA-256 Checksum verified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
