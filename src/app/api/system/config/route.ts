import { successResponse } from "@/lib/api-response";
import crypto from "crypto";
const DEFAULT_CONFIG: Record<string, string> = {
	APP_ENV: "development", HOST: "0.0.0.0", PORT: "3000", MODEL_PATH: "models/room_objects/v2/model.pt",
	CONFIDENCE_THRESHOLD: "0.25", IOU_THRESHOLD: "0.45", IMAGE_SIZE: "640", DEVICE: "cpu",
	STREAM_TARGET_FPS: "30", STREAM_JPEG_QUALITY: "70", STREAM_MAX_FRAME_BYTES: "1048576",
};
import { getJsonStore, nowIso, updateJsonStore } from "@/lib/json-store";

export const dynamic = "force-dynamic";

function mergedConfig(settings: Record<string, string | number>) {
	const config = { ...DEFAULT_CONFIG };
	for (const [key, value] of Object.entries(settings)) {
		const existingKey = Object.keys(config).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
		config[existingKey || key] = String(value);
	}
	return config;
}

export async function GET() { const store = await getJsonStore(); return successResponse({ config: mergedConfig(store.settings) }); }

export async function PATCH(request: Request) { const body = await request.json(); const updates = body.config || body; const result = await updateJsonStore((store) => { const updatedKeys: string[] = []; for (const [key, value] of Object.entries(updates)) { if (typeof value === "string" || typeof value === "number") { const existingKey = Object.keys(store.settings).find((candidate) => candidate.toLowerCase() === key.toLowerCase()); if (existingKey && existingKey !== key) delete store.settings[existingKey]; store.settings[key] = String(value); updatedKeys.push(key); } } store.auditLogs.push({ id: crypto.randomUUID(), timestamp: nowIso(), level: "INFO", event: "CONFIG_UPDATED", code: "CONFIG_CHANGE", details: { keys: updatedKeys } }); return updatedKeys; }); const store = await getJsonStore(); return successResponse({ config: mergedConfig(store.settings), updatedKeys: result }); }
