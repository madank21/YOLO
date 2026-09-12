import { globalDetector } from "@/lib/detector";

export const dynamic = "force-dynamic";

export async function GET() {
  const inferenceUrl = process.env.INFERENCE_SERVICE_URL || "http://127.0.0.1:8001";

  try {
    const response = await fetch(`${inferenceUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const serviceHealth = await response.json();

    return Response.json({
      ...serviceHealth,
      status: serviceHealth.ok ? "healthy" : "unhealthy",
      database_connected: false,
      storage: "json",
      device: serviceHealth.device || globalDetector.device,
    }, { status: response.ok ? 200 : 503 });
  } catch (error) {
    return Response.json({
      ok: false,
      status: "inference_service_unavailable",
      model_loaded: false,
      inference_ready: false,
      database_connected: false,
      storage: "json",
      message: error instanceof Error ? error.message : "Inference service unavailable",
    }, { status: 503 });
  }
}
