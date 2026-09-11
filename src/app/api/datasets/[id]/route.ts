import { successResponse, errorResponse } from "@/lib/api-response";
import { getJsonStore, nowIso, updateJsonStore } from "@/lib/json-store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const store = await getJsonStore(); const dataset = store.datasets.find((item) => item.id === id);
  if (!dataset) return errorResponse("DATASET_NOT_FOUND", "Dataset not found", 404);
  const classDistribution: Record<string, number> = Object.fromEntries(dataset.classes.map((item) => [item.name, 0]));
  for (const image of dataset.images) for (const annotation of image.annotations) { const cls = dataset.classes.find((item) => item.id === annotation.classId); if (cls) classDistribution[cls.name] = (classDistribution[cls.name] || 0) + 1; }
  return successResponse({ dataset, classes: dataset.classes, images: dataset.images.map(({ annotations: _annotations, ...image }) => image), stats: {
    totalImages: dataset.images.length, totalAnnotations: dataset.images.reduce((sum, image) => sum + image.annotations.length, 0),
    splits: { train: dataset.images.filter((image) => image.split === "train").length, val: dataset.images.filter((image) => image.split === "val").length, test: dataset.images.filter((image) => image.split === "test").length, unassigned: dataset.images.filter((image) => !["train", "val", "test"].includes(image.split)).length }, classDistribution,
  } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const body = await request.json();
  const result = await updateJsonStore((store) => { const dataset = store.datasets.find((item) => item.id === id); if (!dataset) return null; if (body.name) dataset.name = body.name.trim().toLowerCase().replace(/\s+/g, "_"); if (body.description !== undefined) dataset.description = body.description; dataset.updatedAt = nowIso(); return dataset; });
  return result ? successResponse({ dataset: result }) : errorResponse("DATASET_NOT_FOUND", "Dataset not found", 404);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const result = await updateJsonStore((store) => { const index = store.datasets.findIndex((item) => item.id === id); if (index < 0) return false; store.datasets.splice(index, 1); return true; });
  return result ? successResponse({ deleted: true, id }) : errorResponse("DATASET_NOT_FOUND", "Dataset not found", 404);
}
