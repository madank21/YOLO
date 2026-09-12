import { successResponse, errorResponse } from "@/lib/api-response";
import { getJsonStore, updateJsonStore } from "@/lib/json-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const body = await request.json().catch(() => ({})); const train = body.train_ratio ?? 0.8; const val = body.val_ratio ?? 0.1; const test = body.test_ratio ?? 0.1;
  if (![train, val, test].every((ratio) => typeof ratio === "number" && Number.isFinite(ratio) && ratio >= 0) || Math.abs(train + val + test - 1) > 0.0001 || train === 0) return errorResponse("INVALID_SPLIT_RATIOS", "Split ratios must be non-negative numbers that sum to 1", 400);
  const result = await updateJsonStore((store) => { const dataset = store.datasets.find((item) => item.id === id); if (!dataset) return { error: "missing" as const }; if (!dataset.images.length) return { error: "empty" as const }; const images = [...dataset.images].sort((a, b) => a.checksumSha256.localeCompare(b.checksumSha256)); const trainCount = Math.max(1, Math.round(images.length * train)); const valCount = Math.round(images.length * val); images.forEach((image, index) => { image.split = index < trainCount ? "train" : index < trainCount + valCount ? "val" : "test"; }); dataset.updatedAt = new Date().toISOString(); return { splits: { train: trainCount, val: valCount, test: images.length - trainCount - valCount }, total: images.length }; });
  if (result.error === "missing") return errorResponse("DATASET_NOT_FOUND", "Dataset not found", 404); if (result.error === "empty") return errorResponse("DATASET_NOT_FOUND", "No images in this dataset to split", 400); return successResponse({ updated: true, ...result });
}
