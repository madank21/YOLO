import { successResponse } from "@/lib/api-response";
import { getJsonStore } from "@/lib/json-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) { const search = new URL(request.url).searchParams; const level = search.get("level"); const limit = Number(search.get("limit") || 100); const logs = (await getJsonStore()).auditLogs.filter((log) => !level || log.level === level).slice(-limit).reverse(); return successResponse({ logs }); }
