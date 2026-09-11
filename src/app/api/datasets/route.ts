import { successResponse, errorResponse } from "@/lib/api-response";
import { datasetStats, DEFAULT_JSON_CLASSES, getJsonStore, newId, nowIso, updateJsonStore } from "@/lib/json-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = await getJsonStore();
    return successResponse({ datasets: store.datasets.map((dataset) => ({ ...dataset, stats: { ...datasetStats(dataset), splits: {
      train: dataset.images.filter((image) => image.split === "train").length,
      val: dataset.images.filter((image) => image.split === "val").length,
      test: dataset.images.filter((image) => image.split === "test").length,
      unassigned: dataset.images.filter((image) => !["train", "val", "test"].includes(image.split)).length,
    } } })) });
  } catch (error) { console.error("List datasets error:", error); return errorResponse("INTERNAL_ERROR", "Failed to retrieve datasets", 500); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json(); const { name, description, copy_default_classes = true } = body;
    if (!name?.trim()) return errorResponse("DATASET_NOT_FOUND", "Dataset name is required", 400);
    const now = nowIso();
    const dataset = { id: newId(), name: name.trim().toLowerCase().replace(/\s+/g, "_"), description: description || null, version: 1, createdAt: now, updatedAt: now,
      classes: copy_default_classes ? DEFAULT_JSON_CLASSES.map((item) => ({ id: newId(), name: item.name, classIndex: item.index, colorHex: item.color, source: item.source, cocoAlias: item.cocoAlias })) : [], images: [] };
    await updateJsonStore((store) => { store.datasets.push(dataset); });
    return successResponse({ dataset }, 201);
  } catch (error) { console.error("Create dataset error:", error); return errorResponse("INTERNAL_ERROR", "Failed to create dataset", 500); }
}
