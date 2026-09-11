import { successResponse, errorResponse } from "@/lib/api-response";
import { checksum, getJsonStore, newId, nowIso, updateJsonStore } from "@/lib/json-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const store = await getJsonStore(); const dataset = store.datasets.find((item) => item.id === id);
  if (!dataset) return errorResponse("DATASET_NOT_FOUND", "Dataset not found", 404);
  const search = new URL(request.url).searchParams; const split = search.get("split"); const limit = Number(search.get("limit") || 100); const offset = Number(search.get("offset") || 0);
  const filtered = dataset.images.filter((image) => !split || image.split === split); const images = filtered.slice(offset, offset + limit).map(({ annotations, ...image }) => ({ ...image, annotationCount: annotations.length }));
  return successResponse({ images, total: filtered.length, limit, offset });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const body = await request.json(); const { image_data, file_name, width = 1280, height = 720, split = "unassigned", source = "upload" } = body;
  if (!image_data) return errorResponse("UPLOAD_INVALID_TYPE", "Image data is required (data URL or base64)", 400);
  const result = await updateJsonStore((store) => {
    const dataset = store.datasets.find((item) => item.id === id); if (!dataset) return { error: "missing" as const };
    const imageChecksum = checksum(image_data); if (dataset.images.some((image) => image.checksumSha256 === imageChecksum)) return { error: "duplicate" as const };
    const cleanName = file_name?.replace(/[^a-zA-Z0-9_.-]/g, "_") || `img_${Date.now()}.jpg`;
    const image = { id: newId(), filePath: `datasets/${id}/images/${cleanName}`, imageData: image_data, width, height, checksumSha256: imageChecksum, source, capturedAt: nowIso(), split, annotations: [] };
    dataset.images.push(image); dataset.updatedAt = nowIso(); return { image };
  });
  if (result.error === "missing") return errorResponse("DATASET_NOT_FOUND", "Dataset not found", 404);
  if (result.error === "duplicate") return errorResponse("UPLOAD_INVALID_TYPE", "An identical image already exists in this dataset", 409);
  return successResponse({ image: result.image }, 201);
}
