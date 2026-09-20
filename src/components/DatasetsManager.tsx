"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  Plus,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Download,
  Upload,
  Split,
  Tag,
  Pencil,
  Trash2,
  RefreshCw,
  Layers,
  Filter,
  Check,
  Eye,
  FileCheck,
} from "lucide-react";
import { ValidationReport } from "@/lib/validator";

interface DatasetClass {
  id: string;
  name: string;
  classIndex: number;
  colorHex: string;
  source: string;
  cocoAlias?: string | null;
}

interface DatasetImage {
  id: string;
  filePath: string;
  imageData?: string | null;
  width: number;
  height: number;
  checksumSha256: string;
  source: string;
  capturedAt: string;
  split: string;
  annotationCount?: number;
}

interface DatasetDetail {
  id: string;
  name: string;
  description?: string | null;
  version: number;
  stats?: {
    totalImages: number;
    totalAnnotations: number;
    splits: { train: number; val: number; test: number; unassigned: number };
    classDistribution: Record<string, number>;
  };
}

interface DatasetsManagerProps {
  onSelectImageForAnnotation?: (datasetId: string, imageId: string) => void;
}

export function DatasetsManager({ onSelectImageForAnnotation }: DatasetsManagerProps) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [datasetDetail, setDatasetDetail] = useState<DatasetDetail | null>(null);
  const [classes, setClasses] = useState<DatasetClass[]>([]);
  const [images, setImages] = useState<DatasetImage[]>([]);
  const [selectedSplit, setSelectedSplit] = useState<string>("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // New Dataset Modal
  const [isNewDatasetModalOpen, setIsNewDatasetModalOpen] = useState<boolean>(false);
  const [newDatasetName, setNewDatasetName] = useState<string>("");
  const [newDatasetDesc, setNewDatasetDesc] = useState<string>("");

  // New Class Modal
  const [isNewClassModalOpen, setIsNewClassModalOpen] = useState<boolean>(false);
  const [newClassName, setNewClassName] = useState<string>("");
  const [newClassColor, setNewClassColor] = useState<string>("#8B5CF6");

  // Validation Report state
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Load datasets
  const loadDatasets = async () => {
    try {
      const res = await fetch("/api/datasets");
      const data = await res.json();
      if (data.datasets && data.datasets.length > 0) {
        setDatasets(data.datasets);
        if (!selectedDatasetId) {
          setSelectedDatasetId(data.datasets[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load datasets:", err);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  // Load selected dataset detail
  const loadDatasetDetail = async (id: string) => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/datasets/${id}`);
      const data = await res.json();
      if (data.dataset) {
        setDatasetDetail({ ...data.dataset, stats: data.stats });
        setClasses(data.classes || []);
        setImages(data.images || []);
      }
    } catch (err) {
      console.error("Failed to load dataset detail:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDatasetId) {
      loadDatasetDetail(selectedDatasetId);
      setValidationReport(null);
    }
  }, [selectedDatasetId]);

  // Create dataset
  const handleCreateDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDatasetName.trim()) return;

    try {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDatasetName.trim(),
          description: newDatasetDesc.trim(),
          copy_default_classes: true,
        }),
      });
      const data = await res.json();
      if (data.dataset) {
        setIsNewDatasetModalOpen(false);
        setNewDatasetName("");
        setNewDatasetDesc("");
        await loadDatasets();
        setSelectedDatasetId(data.dataset.id);
      }
    } catch (err) {
      console.error("Failed to create dataset:", err);
    }
  };

  // Add class
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || !selectedDatasetId) return;

    try {
      const res = await fetch(`/api/datasets/${selectedDatasetId}/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClassName.trim(),
          color_hex: newClassColor,
          source: "custom",
        }),
      });
      if (res.ok) {
        setIsNewClassModalOpen(false);
        setNewClassName("");
        loadDatasetDetail(selectedDatasetId);
      }
    } catch (err) {
      console.error("Failed to add class:", err);
    }
  };

  // Auto Stratify 80/10/10 Split (§15.2)
  const handleAutoSplit = async () => {
    if (!selectedDatasetId) return;
    try {
      const res = await fetch(`/api/datasets/${selectedDatasetId}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ train_ratio: 0.8, val_ratio: 0.1, test_ratio: 0.1 }),
      });
      if (res.ok) {
        await loadDatasetDetail(selectedDatasetId);
      }
    } catch (err) {
      console.error("Failed to split dataset:", err);
    }
  };

  // Run 10-check validation (§15.3)
  const handleValidate = async () => {
    if (!selectedDatasetId) return;
    setIsValidating(true);
    try {
      const res = await fetch(`/api/datasets/${selectedDatasetId}/validate`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.report) {
        setValidationReport(data.report);
      }
    } catch (err) {
      console.error("Failed to validate:", err);
    } finally {
      setIsValidating(false);
    }
  };

  // Export YOLO zip (§15.1)
  const handleExportYolo = async (force: boolean = false) => {
    if (!selectedDatasetId || !datasetDetail) return;
    setIsExporting(true);
    try {
      const res = await fetch(`/api/datasets/${selectedDatasetId}/export${force ? "?force=true" : ""}`, {
        method: "POST",
      });

      if (res.status === 422) {
        const errData = await res.json();
        alert(`Export blocked by validation errors! Run validator to resolve.`);
        if (errData.error?.details) {
          setValidationReport({
            valid: false,
            errors: errData.error.details.errors || [],
            warnings: errData.error.details.warnings || [],
            totalImages: images.length,
            totalAnnotations: datasetDetail.stats?.totalAnnotations || 0,
            checkedAt: new Date().toISOString(),
            splitSummary: datasetDetail.stats?.splits || { train: 0, val: 0, test: 0, unassigned: 0 },
            classDistribution: datasetDetail.stats?.classDistribution || {},
          });
        }
        return;
      }

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `export_${datasetDetail.name}_v${datasetDetail.version}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      console.error("Failed to export YOLO zip:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Upload image
  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDatasetId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUri = event.target?.result as string;
      try {
        await fetch(`/api/datasets/${selectedDatasetId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_data: dataUri,
            file_name: file.name,
            split: selectedSplit === "all" ? "train" : selectedSplit,
          }),
        });
        loadDatasetDetail(selectedDatasetId);
      } catch (err) {
        console.error("Failed to upload image:", err);
      }
    };
    reader.readAsDataURL(file);
  };

  const filteredImages = selectedSplit === "all" ? images : images.filter((img) => img.split === selectedSplit);

  return (
    <div className="space-y-6">
      {/* Dataset Selection & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm font-bold text-white focus:border-cyan-500 focus:outline-none"
              >
                {datasets.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} (v{ds.version})
                  </option>
                ))}
              </select>
              <button
                onClick={() => setIsNewDatasetModalOpen(true)}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition"
              >
                <Plus className="h-3.5 w-3.5" /> New Dataset
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {datasetDetail?.description || "Curated computer-vision dataset for object detection"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Stratify Split */}
          <button
            onClick={handleAutoSplit}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 text-xs font-semibold transition"
          >
            <Split className="h-3.5 w-3.5 text-cyan-400" />
            <span>Stratify 80/10/10</span>
          </button>

          {/* Run Validator (§15.3) */}
          <button
            onClick={handleValidate}
            disabled={isValidating}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 px-3 py-1.5 text-xs font-semibold transition"
          >
            {isValidating ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileCheck className="h-3.5 w-3.5" />
            )}
            <span>Run 10-Check Validator</span>
          </button>

          {/* Export YOLO Zip (§15.1) */}
          <button
            onClick={() => handleExportYolo(false)}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 text-xs font-semibold shadow transition"
          >
            {isExporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span>Export YOLO .zip</span>
          </button>
        </div>
      </div>

      {/* Dataset Summary Cards */}
      {datasetDetail?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Images</span>
            <p className="text-2xl font-mono font-bold text-white mt-0.5">{datasetDetail.stats.totalImages}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Annotations</span>
            <p className="text-2xl font-mono font-bold text-cyan-400 mt-0.5">{datasetDetail.stats.totalAnnotations}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Classes</span>
            <p className="text-2xl font-mono font-bold text-emerald-400 mt-0.5">{classes.length}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Splits (T / V / T)</span>
            <p className="text-sm font-mono font-bold text-slate-200 mt-1.5">
              <span className="text-blue-400">{datasetDetail.stats.splits.train}</span> /{" "}
              <span className="text-amber-400">{datasetDetail.stats.splits.val}</span> /{" "}
              <span className="text-purple-400">{datasetDetail.stats.splits.test}</span>
            </p>
          </div>
        </div>
      )}

      {/* Validation Report Banner / Details (§15.3) */}
      {validationReport && (
        <div
          className={`rounded-xl border p-4 shadow-lg animate-in fade-in duration-200 ${
            validationReport.valid
              ? "border-emerald-500/40 bg-emerald-950/20"
              : "border-red-500/40 bg-red-950/20"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {validationReport.valid ? (
                <CheckCircle className="h-5 w-5 text-emerald-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-400" />
              )}
              <h4 className="text-sm font-bold text-white">
                {validationReport.valid ? "Dataset Passed Validation" : "Validation Errors Found (Export Blocked)"}
              </h4>
            </div>
            <span className="text-xs text-slate-400">
              Checked {validationReport.totalImages} images & {validationReport.totalAnnotations} annotations
            </span>
          </div>

          {/* Errors list */}
          {validationReport.errors.length > 0 && (
            <div className="mt-3 space-y-2">
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                Errors ({validationReport.errors.length}):
              </span>
              {validationReport.errors.map((err, i) => (
                <div key={i} className="rounded-lg bg-red-950/50 border border-red-900/60 p-2.5 text-xs text-red-200">
                  <span className="font-mono font-bold text-red-400 mr-2">[{err.code}]</span>
                  <span>{err.message}</span>
                  {err.examples.length > 0 && (
                    <p className="mt-1 text-[11px] text-red-300/80 font-mono">
                      Examples: {err.examples.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Warnings list */}
          {validationReport.warnings.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Warnings ({validationReport.warnings.length}):
              </span>
              {validationReport.warnings.map((warn, i) => (
                <div key={i} className="rounded-lg bg-amber-950/40 border border-amber-900/50 p-2 text-xs text-amber-200">
                  <span className="font-mono font-bold text-amber-400 mr-2">[{warn.code}]</span>
                  <span>{warn.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Classes Palette Section with Provenance Tags (§5) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-cyan-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Authoritative Class Registry ({classes.length})
            </h4>
          </div>
          <button
            onClick={() => setIsNewClassModalOpen(true)}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> Add Class
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {classes.map((cls) => {
            const count = datasetDetail?.stats?.classDistribution?.[cls.name] || 0;
            return (
              <div
                key={cls.id}
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 shadow-sm"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cls.colorHex }} />
                <span className="font-mono text-slate-400 text-[10px]">#{cls.classIndex}</span>
                <span className="font-semibold text-white">{cls.name}</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                  {count}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                    cls.source === "pretrained"
                      ? "bg-blue-950 text-blue-300 border border-blue-800"
                      : "bg-purple-950 text-purple-300 border border-purple-800"
                  }`}
                >
                  {cls.source}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Images Grid & Split Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Split filter tabs */}
          <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-800 text-xs">
            {["all", "train", "val", "test", "unassigned"].map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSplit(s)}
                className={`rounded-md px-3 py-1 font-medium capitalize transition ${
                  selectedSplit === s ? "bg-cyan-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {s} ({s === "all" ? images.length : images.filter((img) => img.split === s).length})
              </button>
            ))}
          </div>

          {/* Upload Image Button */}
          <label className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 text-xs font-semibold cursor-pointer transition">
            <Upload className="h-3.5 w-3.5 text-cyan-400" />
            <span>Upload Image</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadImage} />
          </label>
        </div>

        {/* Images Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredImages.map((img) => (
            <div
              key={img.id}
              className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-md hover:border-slate-700 transition"
            >
              <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                {img.imageData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.imageData}
                    alt={img.filePath}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-600">No Preview</div>
                )}

                {/* Split badge */}
                <span
                  className={`absolute top-2 left-2 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow ${
                    img.split === "train"
                      ? "bg-blue-600 text-white"
                      : img.split === "val"
                      ? "bg-amber-600 text-white"
                      : img.split === "test"
                      ? "bg-purple-600 text-white"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {img.split}
                </span>

                {/* Annotation count badge */}
                <span className="absolute bottom-2 right-2 rounded bg-slate-950/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-800">
                  {img.annotationCount || 0} boxes
                </span>
              </div>

              <div className="p-3">
                <p className="text-xs font-mono text-slate-300 truncate" title={img.filePath}>
                  {img.filePath.split("/").pop()}
                </p>
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {img.width} × {img.height}
                  </span>
                  <button
                    onClick={() => onSelectImageForAnnotation?.(selectedDatasetId, img.id)}
                    className="flex items-center gap-1 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 px-2 py-1 text-[11px] font-semibold transition"
                  >
                    <Eye className="h-3 w-3" /> Annotate
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Dataset Modal */}
      {isNewDatasetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateDataset}
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white">Create New Dataset</h3>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Dataset Name</label>
              <input
                type="text"
                placeholder="e.g. factory_tools, warehouse_boxes"
                value={newDatasetName}
                onChange={(e) => setNewDatasetName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Description (optional)</label>
              <textarea
                placeholder="Description of target domain, classes, and environment"
                value={newDatasetDesc}
                onChange={(e) => setNewDatasetDesc(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                rows={3}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewDatasetModalOpen(false)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-1.5 text-xs font-semibold shadow"
              >
                Create Dataset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Class Modal */}
      {isNewClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleAddClass}
            className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white">Add Custom Class</h3>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Class Name</label>
              <input
                type="text"
                placeholder="e.g. coffee_mug, safety_helmet"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Color Accent</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={newClassColor}
                  onChange={(e) => setNewClassColor(e.target.value)}
                  className="h-9 w-14 rounded border border-slate-700 bg-slate-950 cursor-pointer"
                />
                <span className="font-mono text-xs text-slate-400">{newClassColor}</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewClassModalOpen(false)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-1.5 text-xs font-semibold shadow"
              >
                Add Class
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
