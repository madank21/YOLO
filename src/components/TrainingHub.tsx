"use client";

import React, { useState, useEffect } from "react";
import {
  Flame,
  Download,
  Upload,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  ShieldCheck,
  FileCode,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from "lucide-react";

export function TrainingHub() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [importResultStatus, setImportResultStatus] = useState<any | null>(null);

  // Hyperparameter configurations
  const [epochs, setEpochs] = useState<number>(100);
  const [batch, setBatch] = useState<string>("16");
  const [imgsz, setImgsz] = useState<number>(640);
  const [lr0, setLr0] = useState<number>(0.01);
  const [baseModel, setBaseModel] = useState<string>("yolo11n.pt");

  useEffect(() => {
    fetch("/api/datasets")
      .then((res) => res.json())
      .then((data) => {
        if (data.datasets && data.datasets.length > 0) {
          setDatasets(data.datasets);
          setSelectedDatasetId(data.datasets[0].id);
        }
      });
  }, []);

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0];

  // Export Training Package (§19.1)
  const handleExportPackage = async () => {
    if (!selectedDatasetId) return;
    setIsExporting(true);
    try {
      const res = await fetch(`/api/training/export-package/${selectedDatasetId}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `training_package_${selectedDataset.name}_v${selectedDataset.version}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert("Failed to build training package.");
      }
    } catch (err) {
      console.error("Export package error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Import Result Bundle (§19.2 & §20)
  const handleImportResultBundle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResultStatus(null);

    try {
      const formData = new FormData();
      formData.append("bundle", file);
      const res = await fetch("/api/training/import-result", {
        method: "POST",
        body: formData,
      });
      setImportResultStatus(await res.json());
    } catch (err) {
      console.error("Failed to import result bundle:", err);
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const copyCode = (text: string, stepNum: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepNum);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const colabCommands = [
    {
      title: "1. Unzip Training Package",
      cmd: `!unzip training_package_${selectedDataset?.name || "room_objects"}_v${selectedDataset?.version || 1}.zip`,
    },
    {
      title: "2. Install Ultralytics & PyTorch",
      cmd: "!pip install -r requirements.txt",
    },
    {
      title: "3. Train YOLO Model (GPU)",
      cmd: `!python train.py --data dataset/data.yaml --model ${baseModel} --epochs ${epochs} --imgsz ${imgsz} --lr0 ${lr0}`,
    },
    {
      title: "4. Evaluate on Untouched Test Split",
      cmd: "!python evaluate.py --weights runs/train/experiment/weights/best.pt --data dataset/data.yaml",
    },
    {
      title: "5. Assemble Result Bundle",
      cmd: "!python build_result_bundle.py",
    },
    {
      title: "6. Download training_result.zip",
      cmd: `from google.colab import files\nfiles.download('training_result.zip')`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/30">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">Remote GPU Training Hub</span>
              <span className="rounded bg-orange-950 px-2 py-0.5 text-[10px] font-mono font-bold text-orange-400 border border-orange-800">
                §19 & §20 Specification
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Zero laptop compute load: export portable bundle → train on free Colab/Kaggle GPU → import result bundle
            </p>
          </div>
        </div>

        {/* Data boundary notice (§23) */}
        <div className="flex items-center gap-2 rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Local Data Boundary (§23): Manual export only, no cloud telemetry</span>
        </div>
      </div>

      {/* Two Column Layout: Export / Import & Colab Sequence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Config & Export / Import Actions */}
        <div className="space-y-4">
          {/* Step 1: Package Export Box */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Download className="h-4 w-4 text-cyan-400" /> Step 1: Build Package
              </span>
              <span className="text-[10px] font-mono text-cyan-400">Self-Contained .zip</span>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Source Dataset</label>
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none font-semibold"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} (v{d.version})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Base Checkpoint (§3 & §4)</label>
              <select
                value={baseModel}
                onChange={(e) => setBaseModel(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="yolo11n.pt">yolo11n.pt (Nano - Recommended default)</option>
                <option value="yolo11s.pt">yolo11s.pt (Small)</option>
                <option value="yolo26n.pt">yolo26n.pt (NMS-free end-to-end)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-400">Epochs</label>
                <input
                  type="number"
                  value={epochs}
                  onChange={(e) => setEpochs(parseInt(e.target.value) || 50)}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 mt-0.5"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Image Size</label>
                <input
                  type="number"
                  value={imgsz}
                  onChange={(e) => setImgsz(parseInt(e.target.value) || 640)}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 mt-0.5"
                />
              </div>
            </div>

            <button
              onClick={handleExportPackage}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white py-2 text-xs font-semibold shadow transition"
            >
              {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span>Export Training Package (.zip)</span>
            </button>
          </div>

          {/* Step 2: Import Result Bundle Box */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Upload className="h-4 w-4 text-emerald-400" /> Step 2: Import Result
              </span>
              <span className="text-[10px] font-mono text-emerald-400">§20 Reproducibility</span>
            </div>

            <p className="text-xs text-slate-400">
              Upload <code className="font-mono text-cyan-300">training_result.zip</code> downloaded from Colab or remote GPU box.
            </p>

            <label className="w-full flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/70 p-4 hover:border-cyan-500 cursor-pointer transition">
              <Upload className="h-6 w-6 text-slate-400 mb-1" />
              <span className="text-xs font-semibold text-slate-200">
                {isImporting ? "Validating checklist..." : "Select training_result.zip"}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">Validates model.pt, metrics.json, metadata.json</span>
              <input
                type="file"
                accept=".zip,.pt"
                className="hidden"
                disabled={isImporting}
                onChange={handleImportResultBundle}
              />
            </label>

            {importResultStatus && (
              <div className="rounded-lg bg-emerald-950/50 border border-emerald-800 p-3 text-xs text-emerald-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="h-4 w-4" /> Result Bundle Validated & Imported!
                </div>
                <p className="text-[11px] text-emerald-400/90 font-mono">
                  State: {importResultStatus.validation?.state} • Checksum verified
                </p>
                <p className="text-[11px] text-slate-300">
                  Model is now in <strong className="text-white">READY</strong> state. You can activate it in the Model Registry.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Copy-Pasteable Colab Guide (docs/training-colab.md) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-orange-400" /> Google Colab & Linux GPU Instructions (§19.3)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Follow these exact steps in Google Colab (Set Runtime: GPU T4)
                </p>
              </div>
              <a
                href="https://colab.research.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 font-semibold"
              >
                Open Colab <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Sequence of copyable commands */}
            <div className="space-y-3">
              {colabCommands.map((item, idx) => (
                <div key={idx} className="rounded-lg bg-slate-950 border border-slate-800 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-300">{item.title}</span>
                    <button
                      onClick={() => copyCode(item.cmd, idx)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white rounded bg-slate-800 px-2 py-0.5 transition"
                    >
                      {copiedStep === idx ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedStep === idx ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-cyan-300 bg-slate-900/90 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                    {item.cmd}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
