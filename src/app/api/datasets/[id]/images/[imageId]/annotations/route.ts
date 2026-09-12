import { successResponse, errorResponse } from "@/lib/api-response";
import { getJsonStore, newId, nowIso, updateJsonStore } from "@/lib/json-store";

export const dynamic = "force-dynamic";

function validBox(annotation: any) {
  const x = annotation.x_center ?? annotation.xCenter; const y = annotation.y_center ?? annotation.yCenter; const width = annotation.width; const height = annotation.height;
  return [x, y, width, height].every((value) => typeof value === "number" && Number.isFinite(value)) && x >= 0 && x <= 1 && y >= 0 && y <= 1 && width > 0 && width <= 1 && height > 0 && height <= 1 && x - width / 2 >= 0 && x + width / 2 <= 1 && y - height / 2 >= 0 && y + height / 2 <= 1;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const { id, imageId } = await params; const store = await getJsonStore(); const dataset = store.datasets.find((item) => item.id === id); const image = dataset?.images.find((item) => item.id === imageId);
  if (!dataset || !image) return errorResponse("DATASET_NOT_FOUND", "Image not found", 404);
  return successResponse({ image, annotations: image.annotations.map((annotation) => { const cls = dataset.classes.find((item) => item.id === annotation.classId); return { ...annotation, className: cls?.name, classIndex: cls?.classIndex, colorHex: cls?.colorHex }; }) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const { id, imageId } = await params; const body = await request.json(); const incoming = body.annotations || [];
  const result = await updateJsonStore((store) => {
    const dataset = store.datasets.find((item) => item.id === id); const image = dataset?.images.find((item) => item.id === imageId); if (!dataset || !image) return { error: "missing" as const };
    const annotations = incoming.map((annotation: any, index: number) => { const classId = annotation.class_id || annotation.classId; if (!dataset.classes.some((item) => item.id === classId) || !validBox(annotation)) return null; return { id: annotation.id || newId(), classId, xCenter: annotation.x_center ?? annotation.xCenter, yCenter: annotation.y_center ?? annotation.yCenter, width: annotation.width, height: annotation.height, createdBy: annotation.created_by || "human", createdAt: annotation.createdAt || nowIso(), }; });
    if (annotations.some((annotation: unknown) => annotation === null)) return { error: "invalid" as const }; image.annotations = annotations as typeof image.annotations; dataset.updatedAt = nowIso(); return { annotations: image.annotations };
  });
  if (result.error === "missing") return errorResponse("DATASET_NOT_FOUND", "Image not found", 404); if (result.error === "invalid") return errorResponse("ANNOTATION_INVALID", "Annotations contain an invalid class or coordinate", 400);
  return successResponse({ saved: true, count: result.annotations.length, annotations: result.annotations });
}
