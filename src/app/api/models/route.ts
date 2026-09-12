import { successResponse, errorResponse } from "@/lib/api-response";
import { checksum, getJsonStore, newId, nowIso, updateJsonStore } from "@/lib/json-store";

export const dynamic = "force-dynamic";

export async function GET() { const store = await getJsonStore(); return successResponse({ models: store.models.map((model) => ({ ...model, versions: [...model.versions].sort((a, b) => b.version - a.version), activeVersion: model.versions.find((version) => version.state === "ACTIVE") || null })) }); }

export async function POST(request: Request) {
  const body = await request.json(); const result = await updateJsonStore((store) => { const name = body.model_name || "room_objects"; let model = store.models.find((item) => item.id === body.model_id || item.name === name); if (!model) { model = { id: newId(), name, taskType: "detection", description: `Model profile for ${name}`, createdAt: nowIso(), versions: [] }; store.models.push(model); } const version = body.version || (model.versions.length ? Math.max(...model.versions.map((item) => item.version)) + 1 : 1); const created = { id: newId(), modelId: model.id, version, filePath: body.file_path || `models/${name}/v${version}/model.pt`, checksumSha256: body.checksum_sha256 || checksum(`${name}:${version}`), state: "READY", classes: body.classes || [], metrics: body.metrics || {}, trainingRunId: null, errorDetail: null, createdAt: nowIso(), activatedAt: null }; model.versions.push(created); return created; }); return successResponse({ version: result }, 201);
}
