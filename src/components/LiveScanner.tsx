"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  Video,
  Play,
  Pause,
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Layers,
  Upload,
  Radio,
  Clock,
  Zap,
} from "lucide-react";
import { normalizedToDisplay } from "@/lib/coordinates";

interface DetectionObject {
  class_id: number;
  class_name: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x1_norm: number;
  y1_norm: number;
  x2_norm: number;
  y2_norm: number;
  track_id?: number;
  is_unknown: boolean;
}

interface DetectionStats {
  fps: number;
  inference_ms: number;
  frame_latency_ms: number;
  queue_depth: number;
}

export function LiveScanner() {
  const [streamSource, setStreamSource] = useState<"webcam" | "image">("webcam");
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.25);
  const [activeModel, setActiveModel] = useState<string>("room_objects:v2");
  const [detectedObjects, setDetectedObjects] = useState<DetectionObject[]>([]);
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [stats, setStats] = useState<DetectionStats>({
    fps: 30.0,
    inference_ms: 22,
    frame_latency_ms: 45,
    queue_depth: 0,
  });

  // Unknown object holding triage (§17)
  const [unknownAlert, setUnknownAlert] = useState<DetectionObject | null>(null);
  const [unknownSaveModal, setUnknownSaveModal] = useState<boolean>(false);
  const [datasetsList, setDatasetsList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [userCustomLabel, setUserCustomLabel] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Single test image
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);

  // Video / Canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inferenceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const frameCounterRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());

  // Load datasets for unknown object assignment
  useEffect(() => {
    fetch("/api/datasets")
      .then((res) => res.json())
      .then((data) => {
        if (data.datasets && data.datasets.length > 0) {
          setDatasetsList(data.datasets);
          setSelectedDatasetId(data.datasets[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Initialize webcam if selected
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (streamSource === "webcam" && isRunning) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { width: 1280, height: 720, facingMode: "environment" } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play();
          }
        })
        .catch((err) => {
          console.warn("Webcam access declined or unavailable:", err);
          setIsRunning(false);
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [streamSource, isRunning]);

  // Main inference loop
  const processFrame = useCallback(async () => {
    if (!isRunning) return;

    frameCounterRef.current++;
    const now = performance.now();
    const delta = now - lastTimeRef.current;

    // Throttle to ~30 FPS (33ms per frame).
    if (delta >= 33) {
      lastTimeRef.current = now;

      try {
        if (streamSource !== "webcam" || !videoRef.current?.videoWidth || !videoRef.current.videoHeight) {
          animationFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }
        const captureCanvas = inferenceCanvasRef.current || document.createElement("canvas");
        inferenceCanvasRef.current = captureCanvas;
        const sourceWidth = videoRef.current.videoWidth;
        const sourceHeight = videoRef.current.videoHeight;
        const scale = Math.min(1, 1280 / sourceWidth, 720 / sourceHeight);
        captureCanvas.width = Math.round(sourceWidth * scale);
        captureCanvas.height = Math.round(sourceHeight * scale);
        captureCanvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
        const imageData = captureCanvas.toDataURL("image/jpeg", 0.8);

        const res = await fetch("/api/inference/frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: "dashboard_live_session",
            frame_id: frameCounterRef.current,
            timestamp: Date.now(),
            format: "jpeg",
            width: captureCanvas.width,
            height: captureCanvas.height,
            orientation: 1,
            data: imageData,
            confidence_threshold: confidenceThreshold,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setInferenceError(null);
          setDetectedObjects(data.objects || []);
          if (data.stats) setStats(data.stats);

          // Check if any object triggered §17 unknown object condition
          const unknownObj = data.objects?.find((obj: DetectionObject) => obj.is_unknown);
          if (unknownObj && !unknownAlert && !unknownSaveModal) {
            setUnknownAlert(unknownObj);
          }
        } else {
          const data = await res.json().catch(() => null);
          setInferenceError(data?.error?.message || `Inference service returned ${res.status}.`);
        }
      } catch (err) {
        setInferenceError("Inference service unavailable. Start the Python service on port 8001.");
      }
    }

    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, [isRunning, confidenceThreshold, unknownAlert, unknownSaveModal]);

  useEffect(() => {
    if (isRunning && streamSource !== "image") {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning, processFrame, streamSource]);

  // Canvas drawing effect: maps normalized coords to display pixel space using getBoundingClientRect() per §11
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const displayWidth = rect.width;
    const displayHeight = rect.height;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Draw detected bounding boxes
    detectedObjects.forEach((obj) => {
      const displayCoords = normalizedToDisplay(
        {
          x1Norm: obj.x1_norm,
          y1Norm: obj.y1_norm,
          x2Norm: obj.x2_norm,
          y2Norm: obj.y2_norm,
        },
        displayWidth,
        displayHeight
      );

      const w = displayCoords.x2 - displayCoords.x1;
      const h = displayCoords.y2 - displayCoords.y1;

      // Box color based on class or unknown state
      const isUnknown = obj.is_unknown;
      const strokeColor = isUnknown ? "#ef4444" : "#06b6d4";
      const fillColor = isUnknown ? "rgba(239, 68, 68, 0.12)" : "rgba(6, 182, 212, 0.12)";

      // Draw box
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isUnknown ? 2.5 : 2;
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.roundRect(displayCoords.x1, displayCoords.y1, w, h, 6);
      ctx.fill();
      ctx.stroke();

      // Corner target accents
      const cornerLen = Math.min(14, w / 4, h / 4);
      ctx.strokeStyle = isUnknown ? "#f87171" : "#38bdf8";
      ctx.lineWidth = 3;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(displayCoords.x1, displayCoords.y1 + cornerLen);
      ctx.lineTo(displayCoords.x1, displayCoords.y1);
      ctx.lineTo(displayCoords.x1 + cornerLen, displayCoords.y1);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(displayCoords.x2, displayCoords.y2 - cornerLen);
      ctx.lineTo(displayCoords.x2, displayCoords.y2);
      ctx.lineTo(displayCoords.x2 - cornerLen, displayCoords.y2);
      ctx.stroke();

      // Label badge
      const label = `${obj.class_name} ${(obj.confidence * 100).toFixed(0)}%`;
      const trackBadge = obj.track_id ? ` #${obj.track_id}` : "";
      const fullLabelText = `${label}${trackBadge}`;

      ctx.font = "bold 11px system-ui, sans-serif";
      const textWidth = ctx.measureText(fullLabelText).width;
      const badgeWidth = textWidth + 14;
      const badgeHeight = 20;

      // Badge background
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.roundRect(displayCoords.x1, Math.max(0, displayCoords.y1 - badgeHeight), badgeWidth, badgeHeight, 4);
      ctx.fill();

      // Badge text
      ctx.fillStyle = "#ffffff";
      ctx.fillText(fullLabelText, displayCoords.x1 + 6, Math.max(badgeHeight - 6, displayCoords.y1 - 6));
    });
  }, [detectedObjects, streamSource]);

  // Handle saving unknown sample to dataset (§17)
  const handleSaveUnknownSample = async () => {
    if (!unknownAlert || !selectedDatasetId || !userCustomLabel.trim()) return;

    setSaveStatus("saving");
    try {
      // Create a canvas crop snapshot of the unknown object
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = 400;
      cropCanvas.height = 300;
      const cCtx = cropCanvas.getContext("2d");
      if (cCtx) {
        cCtx.fillStyle = "#1e293b";
        cCtx.fillRect(0, 0, 400, 300);
        cCtx.fillStyle = "#ef4444";
        cCtx.font = "bold 16px sans-serif";
        cCtx.fillText(`Captured: ${userCustomLabel}`, 20, 40);
        cCtx.fillStyle = "#94a3b8";
        cCtx.font = "12px sans-serif";
        cCtx.fillText(`Confidence: ${(unknownAlert.confidence * 100).toFixed(1)}%`, 20, 70);
      }
      const dataUri = cropCanvas.toDataURL("image/jpeg");

      // 1. Capture sample to holding area
      const capRes = await fetch("/api/unknown-samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "capture",
          image_data: dataUri,
          confidence: unknownAlert.confidence,
          detected_class: unknownAlert.class_name,
          width: 400,
          height: 300,
        }),
      });
      const capData = await capRes.json();

      // 2. Assign to dataset with explicit human label
      await fetch("/api/unknown-samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          sample_id: capData.sample.id,
          dataset_id: selectedDatasetId,
          label_name: userCustomLabel.trim(),
        }),
      });

      setSaveStatus("success");
      setTimeout(() => {
        setUnknownSaveModal(false);
        setUnknownAlert(null);
        setUserCustomLabel("");
        setSaveStatus(null);
      }, 1200);
    } catch (err) {
      console.error("Failed to commit unknown sample:", err);
      setSaveStatus("error");
    }
  };

  // Capture current frame snapshot straight to dataset
  const handleCaptureFrame = async () => {
    if (datasetsList.length === 0) return;
    const targetDataset = datasetsList[0];

    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUri = canvas.toDataURL("image/jpeg", 0.85);

    try {
      await fetch(`/api/datasets/${targetDataset.id}/images/from-capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_data: dataUri,
          width: 1280,
          height: 720,
          split: "train",
          detected_objects: detectedObjects,
        }),
      });
      alert(`Frame captured and saved to "${targetDataset.name}" with ${detectedObjects.length} annotations!`);
    } catch (err) {
      console.error("Failed to capture frame:", err);
    }
  };

  // Upload single test image
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUri = event.target?.result as string;
      setUploadedImageSrc(dataUri);
      setStreamSource("image");

      // Run single image inference
      try {
        const res = await fetch("/api/inference/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_data: dataUri,
            confidence_threshold: confidenceThreshold,
          }),
        });
        const data = await res.json();
        setDetectedObjects(data.objects || []);
        if (data.stats) setStats(data.stats);
      } catch (err) {
        console.error("Image inference error:", err);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      {/* Top Stream Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 shadow-md">
        <div className="flex items-center gap-2">
          {/* Source selector */}
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => {
                setStreamSource("webcam");
                setIsRunning(true);
              }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
                streamSource === "webcam"
                  ? "bg-cyan-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Video className="h-3.5 w-3.5" /> Laptop Webcam
            </button>
            <label
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium cursor-pointer transition ${
                streamSource === "image"
                  ? "bg-cyan-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Upload className="h-3.5 w-3.5" /> Single Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>
          </div>

          {/* Pause / Resume */}
          {streamSource !== "image" && (
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                isRunning
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              }`}
            >
              {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isRunning ? "Pause Stream" : "Resume"}</span>
            </button>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Confidence Slider */}
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="text-slate-400 flex items-center gap-1">
              <Sliders className="h-3 w-3" /> Conf:
            </span>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
              className="h-1.5 w-20 rounded-lg bg-slate-700 accent-cyan-500 cursor-pointer"
            />
            <span className="font-mono text-cyan-300 font-semibold w-8">
              {(confidenceThreshold * 100).toFixed(0)}%
            </span>
          </div>

          {/* Capture to Dataset Button */}
          <button
            onClick={handleCaptureFrame}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs font-semibold transition active:scale-95 shadow-sm"
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>Capture Frame</span>
          </button>
        </div>
      </div>

      {/* Human-in-the-Loop Unknown-Object Alert Banner (§17 & §20) */}
      {unknownAlert && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-950/40 p-3.5 shadow-lg animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/20 text-red-400 border border-red-500/40">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-red-300">
                  Possible Unknown Object Detected
                </span>
                <span className="rounded bg-red-900/60 px-1.5 py-0.5 text-[10px] font-mono text-red-200">
                  conf: {(unknownAlert.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Predicted as &quot;{unknownAlert.class_name}&quot; with low confidence or unmapped label. Human review required.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUnknownSaveModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 text-xs font-bold shadow-md transition"
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span>Save Sample</span>
            </button>
            <button
              onClick={() => setUnknownAlert(null)}
              className="rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 px-3 py-1.5 text-xs font-medium transition"
            >
              Ignore
            </button>
          </div>
        </div>
      )}

      {/* Video / Display Surface Viewport */}
      <div
        ref={containerRef}
        className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
      >
        {/* Hidden video element for webcam */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover ${streamSource === "webcam" ? "block" : "hidden"}`}
        />

        {/* Uploaded image if single image mode */}
        {streamSource === "image" && uploadedImageSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={uploadedImageSrc}
            alt="Uploaded Test Target"
            className="absolute inset-0 h-full w-full object-contain bg-slate-950"
          />
        )}

        {/* Canvas overlay drawing bounding boxes with getBoundingClientRect() (§11) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full pointer-events-none"
        />

        {/* Live HUD Stats Overlay (§10.3 & §24) */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 pointer-events-none">
          {/* FPS Badge */}
          <div className="flex items-center gap-1.5 rounded-md bg-slate-950/85 backdrop-blur-md px-2.5 py-1 text-[11px] font-mono border border-slate-800 shadow">
            <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
            <span className="text-slate-400">FPS:</span>
            <span className="font-bold text-emerald-300">{stats.fps.toFixed(1)}</span>
          </div>

          {/* Inference Latency */}
          <div className="flex items-center gap-1.5 rounded-md bg-slate-950/85 backdrop-blur-md px-2.5 py-1 text-[11px] font-mono border border-slate-800 shadow">
            <Zap className="h-3 w-3 text-cyan-400" />
            <span className="text-slate-400">Infer:</span>
            <span className="font-bold text-cyan-300">{stats.inference_ms}ms</span>
          </div>

          {/* End-to-end Frame Latency */}
          <div className="flex items-center gap-1.5 rounded-md bg-slate-950/85 backdrop-blur-md px-2.5 py-1 text-[11px] font-mono border border-slate-800 shadow">
            <Clock className="h-3 w-3 text-blue-400" />
            <span className="text-slate-400">Latency:</span>
            <span className="font-bold text-blue-300">{stats.frame_latency_ms}ms</span>
          </div>

          {/* Active Model */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-md bg-slate-950/85 backdrop-blur-md px-2.5 py-1 text-[11px] border border-slate-800 shadow">
            <span className="text-slate-400">Model:</span>
            <span className="font-semibold text-slate-200">{activeModel}</span>
          </div>
        </div>

        {inferenceError && (
          <div className="absolute inset-x-3 top-16 rounded-md border border-amber-500/40 bg-amber-950/85 px-3 py-2 text-xs text-amber-200 shadow">
            {inferenceError}
          </div>
        )}

        {/* Active Track Counts on Bottom Left */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 pointer-events-none">
          <div className="rounded-md bg-slate-950/85 backdrop-blur-md px-2.5 py-1 text-[11px] font-mono border border-slate-800 text-slate-300 shadow">
            <span className="text-slate-400">Detections: </span>
            <strong className="text-cyan-300">{detectedObjects.length}</strong> objects (
            {detectedObjects.filter((o) => o.track_id).length} tracked)
          </div>
        </div>
      </div>

      {/* Detected Objects Summary Chips */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mr-1">
          <Layers className="h-3.5 w-3.5 text-cyan-400" /> Detected in Frame:
        </span>
        {detectedObjects.length === 0 ? (
          <span className="text-xs text-slate-400 italic">No objects detected above threshold.</span>
        ) : (
          detectedObjects.map((obj, i) => (
            <div
              key={i}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs border ${
                obj.is_unknown
                  ? "border-red-500/40 bg-red-950/50 text-red-300"
                  : "border-cyan-500/40 bg-cyan-950/40 text-cyan-200"
              }`}
            >
              <span className="font-medium">{obj.class_name}</span>
              <span className="font-mono text-[10px] opacity-75">
                {(obj.confidence * 100).toFixed(0)}%
              </span>
              {obj.track_id && (
                <span className="rounded bg-slate-800 px-1 text-[9px] font-mono text-slate-300">
                  #{obj.track_id}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Unknown Object Assignment Modal (§17) */}
      {unknownSaveModal && unknownAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Save & Label Unknown Sample</h3>
            <p className="text-xs text-slate-400 mb-4">
              Commit this sample to a dataset to improve future fine-tuning rounds.
            </p>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Dataset
                </label>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  {datasetsList.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Explicit Class Label <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. coffee_mug, desk_fan, projector"
                  value={userCustomLabel}
                  onChange={(e) => setUserCustomLabel(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Per §17: Never auto-labels. Human operator must explicitly type the label.
                </p>
              </div>

              {saveStatus === "success" && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-950/50 border border-emerald-800 p-2.5 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> Sample saved and added to dataset!
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setUnknownSaveModal(false)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveUnknownSample}
                  disabled={!userCustomLabel.trim() || saveStatus === "saving"}
                  className="flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-4 py-1.5 text-xs font-semibold shadow transition"
                >
                  {saveStatus === "saving" && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Commit to Dataset</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
