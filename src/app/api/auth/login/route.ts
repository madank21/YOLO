import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { errorResponse, successResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { api_key } = await request.json().catch(() => ({}));
  const configured = process.env.ADMIN_API_KEY;
  if (!configured || typeof api_key !== "string" || !safeEqual(api_key, configured)) {
    return errorResponse("AUTH_REQUIRED", "Invalid administrator credentials", 401);
  }
  const signature = createHmac("sha256", configured).update("visionforge-admin").digest("hex");
  const response = successResponse({ authenticated: true });
  response.cookies.set("vf_admin_session", signature, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.delete("vf_admin_session");
  return response;
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "production" && process.env.STORAGE_TYPE === "json") {
    return NextResponse.json({ authenticated: true, mode: "local_json" });
  }
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)vf_admin_session=([^;]+)/)?.[1];
  return NextResponse.json({ authenticated: isValidAdminSession(cookie) });
}

export function isValidAdminSession(value: string | undefined): boolean {
  const configured = process.env.ADMIN_API_KEY;
  if (!configured || !value) return false;
  const expected = createHmac("sha256", configured).update("visionforge-admin").digest("hex");
  return safeEqual(value, expected);
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
