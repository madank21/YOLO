"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  PencilRuler,
  Save,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Info,
  Check,
  AlertCircle,
  Keyboard,
  Layers,
  MousePointer,
  Square,
} from "lucide-react";
import { yoloToNormalized, normalizedToYolo, YoloCenterBox } from "@/lib/coordinates";

interface AnnotationItem {
  id?: string;
  classId: string;
  className: string;
  colorHex: string;
  xCenter: number;
  yCenter: number;
  width: number;
  height: number;
}

interface AnnotationEditorProps {
  initialDatasetId?: string;
  initialImageId?: string;
}

export function AnnotationEditor({ initialDatasetId, initialImageId }: AnnotationEditorProps) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(initialDatasetId || "");
  const [images, setImages] = useState<any[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  // Annotation state and history stack
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [history, setHistory] = useState<AnnotationItem[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [selectedAnnotationIndex, setSelectedAnnotationIndex] = useState<number | null>(null);

  // Tool mode: "select" vs "box"
  const [mode, setMode] = useState<"select" | "box">("select");
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrawBox, setCurrentDrawBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Zoom & Pan
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Status
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load datasets
  useEffect(() => {
    fetch("/api/datasets")
      .then((res) => res.json())
      .then((data) => {
        if (data.datasets && data.datasets.length > 0) {
          setDatasets(data.datasets);
          if (!selectedDatasetId) {
            setSelectedDatasetId(data.datasets[0].id);
          }
        }
      });
  }, [selectedDatasetId]);

  // Load dataset images & classes
  useEffect(() => {
    if (!selectedDatasetId) return;

    fetch(`/api/datasets/${selectedDatasetId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.classes) {
          setClasses(data.classes);
          if (data.classes.length > 0) {
            setSelectedClassId(data.classes[0].id);
          }
        }
        if (data.images && data.images.length > 0) {
          setImages(data.images);
          if (initialImageId) {
            const idx = data.images.findIndex((img: any) => img.id === initialImageId);
            setCurrentImageIndex(idx >= 0 ? idx : 0);
          } else {
            setCurrentImageIndex(0);
          }
        } else {
          setImages([]);
          setAnnotations([]);
        }
      });
  }, [selectedDatasetId, initialImageId]);

  const currentImage = images[currentImageIndex] || null;

  // Load annotations for current image
  useEffect(() => {
    if (!selectedDatasetId || !currentImage) return;

    fetch(`/api/datasets/${selectedDatasetId}/images/${currentImage.id}/annotations`)
      .then((res) => res.json())
      .then((data) => {
        if (data.annotations) {
          const formatted = data.annotations.map((ann: any) => ({
            id: ann.id,
            classId: ann.classId,
            className: ann.className || "unknown",
            colorHex: ann.colorHex || "#3b82f6",
            xCenter: ann.xCenter,
            yCenter: ann.yCenter,
            width: ann.width,
            height: ann.height,
          }));
          setAnnotations(formatted);
          setHistory([formatted]);
          setHistoryIndex(0);
          setSelectedAnnotationIndex(null);
        }
      });
  }, [selectedDatasetId, currentImage]);

  // Push history snapshot for undo/redo
  const pushHistory = (newAnnotations: AnnotationItem[]) => {
    const updated = history.slice(0, historyIndex + 1);
    updated.push(newAnnotations);
    setHistory(updated);
    setHistoryIndex(updated.length - 1);
    setAnnotations(newAnnotations);
  };

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setAnnotations(history[prevIdx]);
      setSelectedAnnotationIndex(null);
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setAnnotations(history[nextIdx]);
      setSelectedAnnotationIndex(null);
    }
  }, [historyIndex, history]);

  // Save current annotations to backend (§16)
  const handleSave = useCallback(async () => {
    if (!selectedDatasetId || !currentImage) return;

    setSaveStatus("saving");
    setErrorMessage(null);

    // Client-side validation: width/height > 0 and within [0,1]
    const invalidBox = annotations.find(
      (a) => a.width <= 0 || a.height <= 0 || a.xCenter < 0 || a.xCenter > 1 || a.yCenter < 0 || a.yCenter > 1
    );

    if (invalidBox) {
      setSaveStatus("error");
      setErrorMessage("One or more boxes have non-positive or out-of-bounds coordinates.");
      return;
    }

    try {
      const res = await fetch(`/api/datasets/${selectedDatasetId}/images/${currentImage.id}/annotations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annotations: annotations.map((a) => ({
            class_id: a.classId,
            x_center: a.xCenter,
            y_center: a.yCenter,
            width: a.width,
            height: a.height,
          })),
        }),
      });

      if (res.ok) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        const errData = await res.json();
        setSaveStatus("error");
        setErrorMessage(errData.error?.message || "Failed to save annotations.");
      }
    } catch (err) {
      setSaveStatus("error");
      setErrorMessage("Network error while saving.");
    }
  }, [selectedDatasetId, currentImage, annotations]);

  // Delete selected box
  const handleDeleteSelected = useCallback(() => {
    if (selectedAnnotationIndex !== null) {
      const next = annotations.filter((_, i) => i !== selectedAnnotationIndex);
      pushHistory(next);
      setSelectedAnnotationIndex(null);
    }
  }, [selectedAnnotationIndex, annotations, history, historyIndex]);

  // Assign class to selected box using 1-9 keyboard shortcut
  const handleAssignClassByIndex = useCallback((num: number) => {
    const targetClass = classes.find((c) => c.classIndex === num - 1) || classes[num - 1];
    if (targetClass && selectedAnnotationIndex !== null) {
      const next = [...annotations];
      next[selectedAnnotationIndex] = {
        ...next[selectedAnnotationIndex],
        classId: targetClass.id,
        className: targetClass.name,
        colorHex: targetClass.colorHex,
      };
      pushHistory(next);
    }
  }, [classes, selectedAnnotationIndex, annotations, history, historyIndex]);

  // Keyboard shortcut listener (§16)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // 'B': New box mode
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setMode("box");
      }
      // 'Delete' or 'Backspace': Delete selected box
      else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteSelected();
      }
      // 'Ctrl+Z' / 'Ctrl+Shift+Z': Undo / Redo
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      // 'Ctrl+S' or 'S': Save
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleSave();
      }
      // 'ArrowRight' / 'ArrowLeft': Next / Previous image
      else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (currentImageIndex < images.length - 1) {
          setCurrentImageIndex((prev) => prev + 1);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentImageIndex > 0) {
          setCurrentImageIndex((prev) => prev - 1);
        }
      }
      // 'Escape': Deselect / cancel
      else if (e.key === "Escape") {
        e.preventDefault();
        setSelectedAnnotationIndex(null);
        setMode("select");
        setIsDrawing(false);
        setCurrentDrawBox(null);
      }
      // '1'-'9': Assign class by index
      else if (e.key >= "1" && e.key <= "9") {
        const num = parseInt(e.key, 10);
        handleAssignClassByIndex(num);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleDeleteSelected,
    handleUndo,
    handleRedo,
    handleSave,
    handleAssignClassByIndex,
    currentImageIndex,
    images.length,
  ]);

  // Mouse interaction on canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1 || (e.buttons === 4) || e.shiftKey) {
      // Pan mode
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (mode === "box") {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left - pan.x) / scale;
      const y = (e.clientY - rect.top - pan.y) / scale;

      setIsDrawing(true);
      setDrawStart({ x, y });
      setCurrentDrawBox({ x, y, w: 0, h: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (isDrawing && drawStart && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const currentX = (e.clientX - rect.left - pan.x) / scale;
      const currentY = (e.clientY - rect.top - pan.y) / scale;

      const x = Math.min(drawStart.x, currentX);
      const y = Math.min(drawStart.y, currentY);
      const w = Math.abs(currentX - drawStart.x);
      const h = Math.abs(currentY - drawStart.y);

      setCurrentDrawBox({ x, y, w, h });
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDrawing && currentDrawBox && containerRef.current) {
      setIsDrawing(false);

      // Require minimum size (e.g. 10px) to prevent accidental clicks
      if (currentDrawBox.w >= 10 && currentDrawBox.h >= 10) {
        const rect = containerRef.current.getBoundingClientRect();
        const imgWidth = currentImage?.width || rect.width;
        const imgHeight = currentImage?.height || rect.height;

        // Convert canvas coordinates to normalized YOLO [xCenter, yCenter, width, height]
        const normX1 = Math.max(0, currentDrawBox.x / rect.width);
        const normY1 = Math.max(0, currentDrawBox.y / rect.height);
        const normX2 = Math.min(1, (currentDrawBox.x + currentDrawBox.w) / rect.width);
        const normY2 = Math.min(1, (currentDrawBox.y + currentDrawBox.h) / rect.height);

        const yolo = normalizedToYolo({
          x1Norm: normX1,
          y1Norm: normY1,
          x2Norm: normX2,
          y2Norm: normY2,
        });

        const activeCls = classes.find((c) => c.id === selectedClassId) || classes[0];

        const newAnn: AnnotationItem = {
          classId: activeCls.id,
          className: activeCls.name,
          colorHex: activeCls.colorHex,
          xCenter: yolo.xCenter,
          yCenter: yolo.yCenter,
          width: yolo.width,
          height: yolo.height,
        };

        const updated = [...annotations, newAnn];
        pushHistory(updated);
        setSelectedAnnotationIndex(updated.length - 1);
        setMode("select");
      }

      setDrawStart(null);
      setCurrentDrawBox(null);
    }
  };

  // Zoom with scroll wheel
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setScale((prev) => Math.min(4, Math.max(0.5, prev * zoomFactor)));
    }
  };

  const selectedAnnotation = selectedAnnotationIndex !== null ? annotations[selectedAnnotationIndex] : null;

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 shadow-md">
        {/* Navigation & Image info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setCurrentImageIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentImageIndex === 0}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 transition"
              title="Previous Image (←)"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-mono text-slate-300 px-2">
              {images.length > 0 ? `${currentImageIndex + 1} / ${images.length}` : "0 / 0"}
            </span>
            <button
              onClick={() => setCurrentImageIndex((prev) => Math.min(images.length - 1, prev + 1))}
              disabled={currentImageIndex >= images.length - 1}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 transition"
              title="Next Image (→)"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {currentImage && (
            <span className="text-xs font-mono text-slate-300 truncate max-w-xs" title={currentImage.filePath}>
              {currentImage.filePath.split("/").pop()}
            </span>
          )}
        </div>

        {/* Tools: Select vs Draw Box */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setMode("select")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition ${
                mode === "select" ? "bg-slate-800 text-cyan-400" : "text-slate-400 hover:text-slate-200"
              }`}
              title="Select / Move Box"
            >
              <MousePointer className="h-3.5 w-3.5" /> Select
            </button>
            <button
              onClick={() => setMode("box")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition ${
                mode === "box" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
              title="Draw New Bounding Box (Shortcut: B)"
            >
              <Square className="h-3.5 w-3.5" /> Draw Box (B)
            </button>
          </div>

          {/* Undo / Redo */}
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30 transition"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30 transition"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setScale((s) => Math.max(0.5, s * 0.85))}
              className="p-1.5 rounded text-slate-400 hover:text-white transition"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono text-slate-400 px-1 text-[11px]">{(scale * 100).toFixed(0)}%</span>
            <button
              onClick={() => setScale((s) => Math.min(4, s * 1.15))}
              className="p-1.5 rounded text-slate-400 hover:text-white transition"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setScale(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1.5 rounded text-slate-400 hover:text-white transition"
              title="Reset View"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Delete box & Save */}
        <div className="flex items-center gap-2">
          {selectedAnnotationIndex !== null && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 rounded-lg border border-red-500/30 bg-red-950/40 px-2.5 py-1.5 transition"
              title="Delete Box (Del)"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Box
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-1.5 text-xs font-semibold shadow transition"
          >
            {saveStatus === "saved" ? (
              <Check className="h-3.5 w-3.5 text-white" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>{saveStatus === "saved" ? "Saved!" : "Save (S)"}</span>
          </button>
        </div>
      </div>

      {/* Class Palette Selection bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
        <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 mr-1">
          <Layers className="h-3.5 w-3.5 text-cyan-400" /> Active Class:
        </span>
        {classes.map((cls, idx) => {
          const isSelected = cls.id === selectedClassId;
          return (
            <button
              key={cls.id}
              onClick={() => {
                setSelectedClassId(cls.id);
                // If a box is currently selected, reassign its class
                if (selectedAnnotationIndex !== null) {
                  const next = [...annotations];
                  next[selectedAnnotationIndex] = {
                    ...next[selectedAnnotationIndex],
                    classId: cls.id,
                    className: cls.name,
                    colorHex: cls.colorHex,
                  };
                  pushHistory(next);
                }
              }}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border transition ${
                isSelected
                  ? "border-cyan-400 bg-cyan-950/60 text-white shadow"
                  : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cls.colorHex }} />
              <span>{cls.name}</span>
              {idx < 9 && (
                <span className="rounded bg-slate-800 px-1 text-[9px] font-mono text-slate-400">
                  {idx + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Annotation Canvas Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          className="lg:col-span-3 relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl cursor-crosshair select-none"
        >
          {currentImage ? (
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: "0 0",
                width: "100%",
                height: "100%",
                position: "absolute",
              }}
            >
              {/* Background Image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={currentImage.imageData || ""}
                alt={currentImage.filePath}
                className="h-full w-full object-contain pointer-events-none"
                draggable={false}
              />

              {/* Rendered Annotations Overlays */}
              {annotations.map((ann, idx) => {
                const isSelected = idx === selectedAnnotationIndex;
                const norm = yoloToNormalized({
                  xCenter: ann.xCenter,
                  yCenter: ann.yCenter,
                  width: ann.width,
                  height: ann.height,
                });

                const left = `${norm.x1Norm * 100}%`;
                const top = `${norm.y1Norm * 100}%`;
                const w = `${(norm.x2Norm - norm.x1Norm) * 100}%`;
                const h = `${(norm.y2Norm - norm.y1Norm) * 100}%`;

                return (
                  <div
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAnnotationIndex(idx);
                    }}
                    style={{
                      left,
                      top,
                      width: w,
                      height: h,
                      borderColor: ann.colorHex,
                      backgroundColor: isSelected ? `${ann.colorHex}33` : `${ann.colorHex}1a`,
                    }}
                    className={`absolute rounded border-2 cursor-pointer transition-all ${
                      isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950" : ""
                    }`}
                  >
                    {/* Class label pill */}
                    <div
                      style={{ backgroundColor: ann.colorHex }}
                      className="absolute -top-5 left-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white shadow whitespace-nowrap"
                    >
                      {ann.className}
                    </div>

                    {/* 8 resize anchors if selected */}
                    {isSelected && (
                      <>
                        <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-white border border-slate-900" />
                        <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-white border border-slate-900" />
                        <div className="absolute -bottom-1 -left-1 h-2 w-2 rounded-full bg-white border border-slate-900" />
                        <div className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-white border border-slate-900" />
                      </>
                    )}
                  </div>
                );
              })}

              {/* In-progress drawing box */}
              {isDrawing && currentDrawBox && (
                <div
                  style={{
                    left: `${currentDrawBox.x}px`,
                    top: `${currentDrawBox.y}px`,
                    width: `${currentDrawBox.w}px`,
                    height: `${currentDrawBox.h}px`,
                  }}
                  className="absolute rounded border-2 border-cyan-400 border-dashed bg-cyan-500/20 pointer-events-none"
                />
              )}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-500 text-xs">
              No images available in this dataset. Upload images in the Datasets tab.
            </div>
          )}
        </div>

        {/* Sidebar: Selected Box Inspector & Keyboard Shortcuts Reference (§16) */}
        <div className="space-y-4">
          {/* Coordinates Inspector */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
              <Info className="h-4 w-4 text-cyan-400" /> Normalized Inspector (§11)
            </h4>

            {selectedAnnotation ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Class:</span>
                  <span className="font-bold text-white">{selectedAnnotation.className}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">x_center (norm):</span>
                  <span className="font-mono text-cyan-400">{selectedAnnotation.xCenter.toFixed(4)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">y_center (norm):</span>
                  <span className="font-mono text-cyan-400">{selectedAnnotation.yCenter.toFixed(4)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">width (norm):</span>
                  <span className="font-mono text-cyan-400">{selectedAnnotation.width.toFixed(4)}</span>
                </div>
                <div className="flex justify-between pb-1.5">
                  <span className="text-slate-400">height (norm):</span>
                  <span className="font-mono text-cyan-400">{selectedAnnotation.height.toFixed(4)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Select an existing box or press <strong className="text-cyan-300 font-mono">B</strong> to draw a new bounding box.
              </p>
            )}
          </div>

          {/* Keyboard Shortcuts Cheatsheet (§16 Specification) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1.5">
              <Keyboard className="h-4 w-4 text-cyan-400" /> Shortcuts (§16)
            </h4>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">New Box Mode</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">B</kbd>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Delete Box</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">Del / Backspace</kbd>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Assign Class</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">1 – 9</kbd>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Undo / Redo</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">Ctrl+Z / Ctrl+Shift+Z</kbd>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Next / Prev</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">→ / ←</kbd>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Save Annotations</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">S / Ctrl+S</kbd>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Deselect / Cancel</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">Esc</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
