import crypto from "crypto";
import { errorResponse } from "@/lib/api-response";
import { isValidAdminSession } from "@/app/api/auth/login/route";
import { getJsonStore, updateJsonStore } from "@/lib/json-store";

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export function requireAdmin(request: Request): Response | null {
  if (process.env.NODE_ENV !== "production" && process.env.STORAGE_TYPE === "json") {
    return null;
  }
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return errorResponse("AUTH_CONFIGURATION_MISSING", "ADMIN_API_KEY is not configured", 503);
  }
  const supplied = request.headers.get("x-admin-api-key");
  const session = request.headers.get("cookie")?.match(/(?:^|;\s*)vf_admin_session=([^;]+)/)?.[1];
  if ((!supplied || !safeEqual(supplied, expected)) && !isValidAdminSession(session)) {
    return errorResponse("AUTH_REQUIRED", "Administrator authentication is required", 401);
  }
  return null;
}

export async function requireDevice(request: Request) {
  const token = getBearerToken(request);
  if (!token) return { response: errorResponse("AUTH_REQUIRED", "Device bearer token is required", 401) };
  const store = await getJsonStore();
  const device = store.devices.find((item) => item.sessionToken === token);
  if (!device || device.status === "revoked") {
    return { response: errorResponse("AUTH_REQUIRED", "Device token is invalid or revoked", 401) };
  }
  await updateJsonStore((current) => {
    const currentDevice = current.devices.find((item) => item.id === device.id);
    if (currentDevice) {
      currentDevice.status = "active";
      currentDevice.lastSeenAt = new Date().toISOString();
    }
  });
  return { device };
}

export async function requireInferenceAuth(request: Request) {
  if (process.env.NODE_ENV !== "production" && process.env.STORAGE_TYPE === "json") {
    return { device: null };
  }
  const expectedAdmin = process.env.ADMIN_API_KEY;
  const suppliedAdmin = request.headers.get("x-admin-api-key");
  const session = request.headers.get("cookie")?.match(/(?:^|;\s*)vf_admin_session=([^;]+)/)?.[1];
  if (expectedAdmin && suppliedAdmin && safeEqual(suppliedAdmin, expectedAdmin) || isValidAdminSession(session)) {
    return { device: null };
  }
  return requireDevice(request);
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
