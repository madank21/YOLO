import { successResponse, errorResponse } from "@/lib/api-response";
import { updateJsonStore } from "@/lib/json-store";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) { const { id, imageId } = await params; const result = await updateJsonStore((store) => { const dataset = store.datasets.find((item) => item.id === id); if (!dataset) return false; const index = dataset.images.findIndex((item) => item.id === imageId); if (index < 0) return false; dataset.images.splice(index, 1); dataset.updatedAt = new Date().toISOString(); return true; }); return result ? successResponse({ deleted: true, image_id: imageId }) : errorResponse("DATASET_NOT_FOUND", "Image not found", 404); }
