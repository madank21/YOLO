import { successResponse, errorResponse } from "@/lib/api-response";
import { getJsonStore, newId, updateJsonStore } from "@/lib/json-store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const dataset = (await getJsonStore()).datasets.find((item) => item.id === id); if (!dataset) return errorResponse("DATASET_NOT_FOUND", "Dataset not found", 404); return successResponse({ classes: dataset.classes });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const body = await request.json(); if (!body.name?.trim()) return errorResponse("ANNOTATION_INVALID", "Class name is required", 400);
  const result = await updateJsonStore((store) => { const dataset = store.datasets.find((item) => item.id === id); if (!dataset) return { error: "missing" as const }; const name = body.name.trim().toLowerCase().replace(/\s+/g, "_"); if (dataset.classes.some((item) => item.name === name)) return { error: "duplicate" as const }; const cls = { id: newId(), name, classIndex: dataset.classes.length ? Math.max(...dataset.classes.map((item) => item.classIndex)) + 1 : 0, colorHex: body.color_hex || "#3B82F6", source: body.source || "custom", cocoAlias: body.coco_alias || null }; dataset.classes.push(cls); dataset.updatedAt = new Date().toISOString(); return { cls }; });
  if (result.error === "missing") return errorResponse("DATASET_NOT_FOUND", "Dataset not found", 404); if (result.error === "duplicate") return errorResponse("ANNOTATION_INVALID", "Class already exists", 409); return successResponse({ class: result.cls }, 201);
}
