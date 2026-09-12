import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { successResponse } from "@/lib/api-response";
import { getJsonStore, nowIso, updateJsonStore } from "@/lib/json-store";

export const dynamic = "force-dynamic";
let activePairing: { token: string; numericCode: string; expiresAt: number } | null = null;
export function getOrGeneratePairingToken() { const now = Math.floor(Date.now() / 1000); if (!activePairing || activePairing.expiresAt <= now) activePairing = { token: randomBytes(24).toString("base64url"), numericCode: String(Math.floor(100000 + Math.random() * 900000)), expiresAt: now + 300 }; return activePairing; }
export function validateAndConsumeToken(value: string) { const pairing = getOrGeneratePairingToken(); const valid = pairing.token === value || pairing.numericCode === value; if (valid) activePairing = null; return valid; }

export async function GET(request: Request) { const search = new URL(request.url).searchParams; const host = search.get("host") || "localhost"; const port = Number(search.get("port") || 3000); const pairing = getOrGeneratePairingToken(); const payload = { v: 1, host, port, pairing_token: pairing.token, issued_at: pairing.expiresAt - 300, ttl_seconds: pairing.expiresAt - Math.floor(Date.now() / 1000) }; const devices = (await getJsonStore()).devices.map(({ pairingTokenHash: _hash, sessionToken: _token, ...device }) => device); return successResponse({ devices, current_streaming_session: null, pairing: { pairing_token: pairing.token, numeric_code: pairing.numericCode, ttl_seconds: payload.ttl_seconds, qr_payload: payload, qr_data_url: await QRCode.toDataURL(JSON.stringify(payload)) } }); }
