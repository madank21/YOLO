import { createHash, randomBytes, randomUUID } from "crypto";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getJsonStore, nowIso, updateJsonStore } from "@/lib/json-store";
import { validateAndConsumeToken } from "../route";

export async function POST(request: Request) { const body = await request.json(); if (!body.pairing_token || !validateAndConsumeToken(body.pairing_token)) return errorResponse("PAIRING_TOKEN_EXPIRED", "Pairing token is invalid or expired", 401); const sessionToken = `sess_${randomBytes(32).toString("base64url")}`; const device = { id: randomUUID(), name: body.device_name || "Mobile Scanner Device", firstPairedAt: nowIso(), lastSeenAt: nowIso(), pairingTokenHash: createHash("sha256").update(body.pairing_token).digest("hex"), sessionToken, status: "paired", ipAddress: body.ip_address || "127.0.0.1" }; await updateJsonStore((store) => { store.devices.push(device); }); return successResponse({ paired: true, device_id: device.id, device_name: device.name, session_token: sessionToken, stream_endpoint: "/api/inference/frame", target_fps: 30 }); }
