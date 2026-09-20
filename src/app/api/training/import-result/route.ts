import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";
import { getJsonStore, newId, nowIso, updateJsonStore } from "@/lib/json-store";

export async function POST(request: Request) {
  const authError = requireAdmin(request); if (authError) return authError;
  try {
    const form = await request.formData();
    const bundle = (form as any).get("bundle");
    if (!(bundle instanceof File)) return errorResponse("TRAINING_IMPORT_INVALID", "A multipart field named bundle is required", 400);
    const archive = await JSZip.loadAsync(await bundle.arrayBuffer()); const modelEntry = archive.file(/(^|\/)model\.pt$/i)[0]; const metadataEntry = archive.file(/(^|\/)metadata\.json$/i)[0]; const metricsEntry = archive.file(/(^|\/)metrics\.json$/i)[0]; if (!modelEntry || !metadataEntry || !metricsEntry) return errorResponse("TRAINING_IMPORT_INVALID", "Bundle must contain model.pt, metadata.json, and metrics.json", 422);
    const metadata = JSON.parse(await metadataEntry.async("text")); const metrics = JSON.parse(await metricsEntry.async("text")); const required = ["precision", "recall", "f1", "map50", "map50_95"]; if (!required.every((key) => typeof metrics[key] === "number" && Number.isFinite(metrics[key]) && metrics[key] >= 0 && metrics[key] <= 1)) return errorResponse("TRAINING_IMPORT_INVALID", "metrics.json must contain valid real evaluation metrics", 422);
    if (!Array.isArray(metadata.classes) || !metadata.classes.length) return errorResponse("TRAINING_IMPORT_INVALID", "metadata.json must define classes", 422);
    const modelBytes = await modelEntry.async("nodebuffer"); const checksum = crypto.createHash("sha256").update(modelBytes).digest("hex"); const name = metadata.model_profile_name || metadata.dataset_name || "imported_model";
    const result = await updateJsonStore(async (store) => { let model = store.models.find((item) => item.name === name); if (!model) { model = { id: newId(), name, taskType: "detection", description: `Imported YOLO model for ${name}`, createdAt: nowIso(), versions: [] }; store.models.push(model); } const version = model.versions.length ? Math.max(...model.versions.map((item) => item.version)) + 1 : 1; const modelPath = path.join(process.env.MODEL_STORAGE_DIR || "storage/models", name, `v${version}`, "model.pt"); await fs.mkdir(path.dirname(modelPath), { recursive: true }); await fs.writeFile(modelPath, modelBytes); const record = { id: newId(), modelId: model.id, version, filePath: modelPath, checksumSha256: checksum, state: "READY", classes: metadata.classes, metrics, trainingRunId: null, errorDetail: null, createdAt: nowIso(), activatedAt: null }; model.versions.push(record); store.trainingRuns.push({ id: newId(), datasetId: null, datasetVersion: metadata.dataset_version || 1, baseCheckpoint: metadata.base_checkpoint || "yolo11n.pt", hyperparameters: metadata.hyperparameters || {}, environment: metadata.environment || {}, importedAt: nowIso(), status: "validated" }); return record; });
    return successResponse({ imported: true, model_version: result, validation: { all_checks_passed: true, state: result.state, error: null } }, 201);
  } catch (error) { console.error("Import training result error:", error); return errorResponse("INTERNAL_ERROR", "Failed to import training result bundle", 500); }
}
