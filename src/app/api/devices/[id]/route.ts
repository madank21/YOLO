import { successResponse, errorResponse } from "@/lib/api-response";
import { updateJsonStore } from "@/lib/json-store";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const result = await updateJsonStore((store) => { const device = store.devices.find((item) => item.id === id); if (!device) return null; device.status = "revoked"; device.sessionToken = null; device.lastSeenAt = new Date().toISOString(); return true; }); return result ? successResponse({ revoked: true, device_id: id }) : errorResponse("DEVICE_NOT_PAIRED", "Device not found", 404); }
