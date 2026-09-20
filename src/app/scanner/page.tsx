"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Smartphone,
  Radio,
  Zap,
  ShieldCheck,
} from "lucide-react";

export default function MobileScannerPage() {
  const [isPaired, setIsPaired] = useState<boolean>(false);
  const [pairingCode, setPairingCode] = useState<string>("");
  const [deviceName, setDeviceName] = useState<string>("Mobile Phone Scanner");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");

  // Streaming status
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [fps, setFps] = useState<number>(0);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<PermissionState | "unknown">("unknown");
  const secureScannerUrl = typeof window !== "undefined"
    ? `https://${window.location.hostname}:${window.location.port || "3000"}/scanner`
    : "";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastSendTimeRef = useRef<number>(0);
  const requestInFlightRef = useRef<boolean>(false);
  const streamLoopRef = useRef<() => void>(() => {});

  // Check URL params for pairing code
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        window.setTimeout(() => setPairingCode(code), 0);
      }
    }
  }, []);

  // Handle pairing (§9.1)
  const handlePair = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pairingCode.trim()) return;

    setErrorMsg(null);
    try {
      const res = await fetch("/api/devices/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairing_token: pairingCode.trim(),
          device_name: deviceName || "Mobile Companion",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSessionToken(data.session_token);
        const sId = `session_${Math.random().toString(36).substring(2, 10)}`;
        setSessionId(sId);
        setIsPaired(true);
      } else {
        const err = await res.json();
        setErrorMsg(err.error?.message || "Invalid or expired pairing code.");
      }
    } catch (err) {
      setErrorMsg("Network connection error to VisionForge host.");
    }
  };

  // Start Camera
  const startCamera = useCallback(async () => {
    setIsStreaming(false);
    setErrorMsg(null);
    try {
      if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        setErrorMsg("Chrome can only request camera permission over HTTPS. Open this page with https:// and then tap Allow Camera.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMsg("This browser does not provide camera access. Use HTTPS and allow camera permission.");
        return;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraPermission("granted");
      setIsStreaming(true);
    } catch (err) {
      console.error("Camera access failed:", err);
      const errorName = err instanceof DOMException ? err.name : "";
      if (errorName === "NotAllowedError" || errorName === "SecurityError") {
        setCameraPermission("denied");
        setErrorMsg("Camera permission was blocked. Tap Allow Camera and approve access in the browser prompt.");
      } else if (errorName === "NotFoundError") {
        setErrorMsg("No camera was found on this device.");
      } else {
        setErrorMsg("Could not start the camera. Use HTTPS and allow camera access.");
      }
    }
  }, [facingMode]);

  useEffect(() => {
    if (isPaired) {
      window.setTimeout(() => void startCamera(), 0);
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isPaired, startCamera]);

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    navigator.permissions.query({ name: "camera" as PermissionName }).then((status) => {
      setCameraPermission(status.state);
      status.onchange = () => setCameraPermission(status.state);
    }).catch(() => {});
  }, []);

  // Frame streaming loop: captures frame, throttles to 30 FPS, sends to /api/inference/frame.
  const streamLoop = useCallback(async () => {
    if (!isStreaming || !videoRef.current) return;

    const now = performance.now();
    // 33ms throttle = 30 FPS target
    if (now - lastSendTimeRef.current >= 33 && !requestInFlightRef.current) {
      lastSendTimeRef.current = now;

      const video = videoRef.current;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        let canvas = offscreenCanvasRef.current;
        if (!canvas) {
          canvas = document.createElement("canvas");
          offscreenCanvasRef.current = canvas;
        }

        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          if (facingMode === "user") {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // JPEG encode with quality 70 per §8
          const jpegData = canvas.toDataURL("image/jpeg", 0.7);

          const tStart = performance.now();
          requestInFlightRef.current = true;
          setFrameCount((prev) => prev + 1);

          fetch("/api/inference/frame", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              type: "frame",
              session_id: sessionId,
              frame_id: frameCount + 1,
              timestamp: Date.now(),
              format: "jpeg",
              width: 1280,
              height: 720,
              orientation: facingMode === "user" ? 2 : 1,
              device_id: sessionToken,
              data: jpegData,
            }),
          })
            .then((res) => res.json())
            .then((data) => {
              const elapsed = Math.round(performance.now() - tStart);
              setLatencyMs(elapsed);
              if (data.stats?.fps) setFps(data.stats.fps);
            })
            .catch(() => {})
            .finally(() => {
              requestInFlightRef.current = false;
            });
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(() => streamLoopRef.current());
  }, [isStreaming, facingMode, sessionId, sessionToken, frameCount]);

  useEffect(() => {
    streamLoopRef.current = streamLoop;
    if (isStreaming) {
      animFrameRef.current = requestAnimationFrame(() => streamLoopRef.current());
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isStreaming, streamLoop]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950 font-sans">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-600 text-white font-bold text-xs">
            VF
          </div>
          <div>
            <h1 className="text-xs font-bold text-white tracking-tight">VisionForge Mobile Scanner</h1>
            <p className="text-[10px] text-slate-400">Wi-Fi Streamer v2</p>
          </div>
        </div>

        {isPaired && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        {!isPaired ? (
          /* Pairing Screen */
          <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Pair with VisionForge Host</h2>
                <p className="text-xs text-slate-400">Enter code from laptop dashboard</p>
              </div>
            </div>

            <form onSubmit={handlePair} className="space-y-3">
              {typeof window !== "undefined" && !window.isSecureContext && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-950/60 p-3 text-xs text-amber-200">
                  <p className="font-semibold">Camera permission is unavailable on this HTTP page.</p>
                  <p className="mt-1">Open the secure mobile URL in Chrome first:</p>
                  <p className="mt-1 break-all font-mono text-amber-100">{secureScannerUrl}</p>
                  <p className="mt-1">Then accept the certificate warning and tap Allow Camera.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  6-Digit Pairing Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. 481920"
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-center font-mono text-xl tracking-widest text-cyan-300 focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Device Name
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {errorMsg && (
                <div className="rounded-lg bg-red-950/60 border border-red-900 p-2 text-xs text-red-300">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white py-2.5 text-xs font-bold shadow-lg transition"
              >
                <Zap className="h-4 w-4" />
                <span>Connect & Start Camera</span>
              </button>
            </form>

            <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> LAN Only: Zero cloud transmission
            </p>
          </div>
        ) : (
          /* Live Streaming Camera View */
          <div className="w-full flex flex-col items-center space-y-3">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />

              {/* Status HUD (§2.2 UX) */}
              <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
                <div className="flex items-center gap-1.5 rounded-md bg-slate-950/80 backdrop-blur-md px-2.5 py-1 text-[11px] font-mono border border-slate-800 text-emerald-400">
                  <Radio className="h-3 w-3 animate-pulse" />
                  <span>Streaming — {fps ? fps.toFixed(1) : "30.0"} fps</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-md bg-slate-950/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-mono border border-slate-800 text-slate-300">
                  <span>Latency: {latencyMs}ms</span>
                </div>
              </div>

              <div className="absolute top-3 right-3 flex gap-1 rounded-xl bg-slate-950/80 p-1 backdrop-blur-md border border-slate-700 shadow">
                <button
                  onClick={() => setFacingMode("user")}
                  className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${facingMode === "user" ? "bg-cyan-600 text-white" : "text-slate-300"}`}
                  title="Use front camera"
                >
                  Front
                </button>
                <button
                  onClick={() => setFacingMode("environment")}
                  className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${facingMode === "environment" ? "bg-cyan-600 text-white" : "text-slate-300"}`}
                  title="Use rear camera"
                >
                  Rear
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="w-full rounded-lg border border-amber-500/40 bg-amber-950/60 p-3 text-xs text-amber-200">
                <p>{errorMsg}</p>
                {(!window.isSecureContext || cameraPermission === "denied") && (
                  <button
                    onClick={startCamera}
                    className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-slate-950"
                  >
                    {!window.isSecureContext ? "Retry Camera" : "Allow Camera"}
                  </button>
                )}
              </div>
            )}

            {!isStreaming && !errorMsg && (
              <button
                onClick={startCamera}
                className="w-full rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Allow Camera Access
              </button>
            )}

            {/* Bottom Stream controls */}
            <div className="flex items-center justify-between w-full px-2 text-xs">
              <span className="text-slate-400 font-mono">Frames sent: {frameCount}</span>
              <button
                onClick={() => setIsStreaming(!isStreaming)}
                className={`rounded-lg px-3 py-1 font-semibold border ${
                  isStreaming
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {isStreaming ? "Pause Feed" : "Resume Feed"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
