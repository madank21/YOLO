"use client";

import React, { useState, useEffect } from "react";
import { Navbar, NavTab } from "@/components/Navbar";
import { LiveScanner } from "@/components/LiveScanner";
import { DatasetsManager } from "@/components/DatasetsManager";
import { AnnotationEditor } from "@/components/AnnotationEditor";
import { ModelRegistry } from "@/components/ModelRegistry";
import { TrainingHub } from "@/components/TrainingHub";
import { DeviceManager } from "@/components/DeviceManager";
import { SystemSettings } from "@/components/SystemSettings";
import { PairingModal } from "@/components/PairingModal";
import { AdminAuthGate } from "@/components/AdminAuthGate";

export default function VisionForgeDashboard() {
  const [activeTab, setActiveTab] = useState<NavTab>("scanner");
  const [isPairingModalOpen, setIsPairingModalOpen] = useState<boolean>(false);
  const [activeModelName, setActiveModelName] = useState<string>("room_objects:v2");
  const [pairedDeviceCount, setPairedDeviceCount] = useState<number>(1);

  // Selected image for direct transition into Annotation Editor
  const [annotationTarget, setAnnotationTarget] = useState<{
    datasetId?: string;
    imageId?: string;
  }>({});

  // Fetch initial health & device count
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (data.active_model) {
          setActiveModelName(data.active_model);
        }
      })
      .catch(() => {});

    fetch("/api/devices")
      .then((res) => res.json())
      .then((data) => {
        if (data.devices) {
          setPairedDeviceCount(data.devices.length);
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectImageForAnnotation = (datasetId: string, imageId: string) => {
    setAnnotationTarget({ datasetId, imageId });
    setActiveTab("annotation");
  };

  return (
    <AdminAuthGate>
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950 font-sans">
      {/* Top Navigation & Status Bar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenPairing={() => setIsPairingModalOpen(true)}
        activeModelName={activeModelName}
        isStreaming={activeTab === "scanner"}
        pairedDeviceCount={pairedDeviceCount}
      />

      {/* Main Workspace Surface */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === "scanner" && <LiveScanner />}

        {activeTab === "datasets" && (
          <DatasetsManager onSelectImageForAnnotation={handleSelectImageForAnnotation} />
        )}

        {activeTab === "annotation" && (
          <AnnotationEditor
            initialDatasetId={annotationTarget.datasetId}
            initialImageId={annotationTarget.imageId}
          />
        )}

        {activeTab === "models" && <ModelRegistry />}

        {activeTab === "training" && <TrainingHub />}

        {activeTab === "devices" && <DeviceManager />}

        {activeTab === "settings" && <SystemSettings />}
      </main>

      {/* Device Pairing Modal (§9.1 QR & Numeric Code) */}
      <PairingModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
      />

      {/* Minimal Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-400">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">
          <p>VisionForge AI Object Detection & Remote GPU Training Platform • v2 Enhanced</p>
          <div className="flex items-center gap-3">
            <span className="text-emerald-400">● Local-First</span>
            <span>FastAPI Wire Compatible</span>
            <span>Ultralytics YOLO Architecture</span>
          </div>
        </div>
      </footer>
    </div>
    </AdminAuthGate>
  );
}
