"use client";

import React from "react";
import {
  Scan,
  Database,
  PencilRuler,
  Cpu,
  Flame,
  Smartphone,
  Sliders,
  ExternalLink,
  ShieldCheck,
  Radio,
} from "lucide-react";

export type NavTab =
  | "scanner"
  | "datasets"
  | "annotation"
  | "models"
  | "training"
  | "devices"
  | "settings";

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenPairing: () => void;
  activeModelName: string;
  isStreaming: boolean;
  pairedDeviceCount: number;
}

export function Navbar({
  activeTab,
  onSelectTab,
  onOpenPairing,
  activeModelName,
  isStreaming,
  pairedDeviceCount,
}: NavbarProps) {
  const tabs = [
    { id: "scanner" as NavTab, label: "Live Scanner", icon: Scan },
    { id: "datasets" as NavTab, label: "Datasets", icon: Database },
    { id: "annotation" as NavTab, label: "Annotation Studio", icon: PencilRuler },
    { id: "models" as NavTab, label: "Model Registry", icon: Cpu },
    { id: "training" as NavTab, label: "Remote GPU Training", icon: Flame },
    { id: "devices" as NavTab, label: "Devices & Pairing", icon: Smartphone },
    { id: "settings" as NavTab, label: "System & Logs", icon: Sliders },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Brand & Engine Badge */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-md shadow-cyan-500/20">
            <Scan className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white">VisionForge</span>
              <span className="rounded bg-cyan-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-800/60">
                v2 ENHANCED
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AI Engine ● Online (CPU / WebGPU)
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Active Model */}
          <div
            onClick={() => onSelectTab("models")}
            className="cursor-pointer flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-700 transition"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-slate-400">Model:</span>
            <span className="font-semibold text-white">{activeModelName || "room_objects:v2"}</span>
          </div>

          {/* Stream Status */}
          <div className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-300">
            <Radio className={`h-3.5 w-3.5 ${isStreaming ? "text-emerald-400 animate-pulse" : "text-amber-400"}`} />
            <span className="text-slate-400">Feed:</span>
            <span className="font-medium text-slate-200">
              {isStreaming ? "Streaming (30 FPS)" : `${pairedDeviceCount} Paired`}
            </span>
          </div>

          {/* Open Mobile Scanner button */}
          <a
            href="/scanner"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-medium px-2 py-1 transition"
          >
            Mobile Companion <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Pair Phone Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPairing}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition active:scale-95"
          >
            <Smartphone className="h-4 w-4" />
            <span>Pair Phone</span>
          </button>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="border-t border-slate-800/80 bg-slate-900/50">
        <div className="mx-auto flex max-w-7xl overflow-x-auto px-4 sm:px-6 no-scrollbar">
          <nav className="flex space-x-1 py-1.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "bg-slate-800 text-cyan-400 shadow-sm border border-slate-700"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
