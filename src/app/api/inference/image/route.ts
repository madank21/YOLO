import { successResponse, errorResponse } from "@/lib/api-response";
import { inferImage, InferenceServiceUnavailableError } from "@/lib/inference-service";
import { requireInferenceAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireInferenceAuth(request);
    if ("response" in auth) return auth.response;
    const body = await request.json();
    const { image_data, width = 1280, height = 720, confidence_threshold } = body;

    if (!image_data) {
      return errorResponse("UPLOAD_INVALID_TYPE", "image_data is required", 400);
    }

    const threshold = confidence_threshold ?? 0.25;

    const result = await inferImage(image_data, threshold);

    return successResponse({
      ...result,
      stats: {
        fps: 0,
        inference_ms: result.inference_ms,
        frame_latency_ms: result.inference_ms,
        queue_depth: 0,
      },
    });
  } catch (error) {
    if (error instanceof InferenceServiceUnavailableError) {
      return errorResponse("INFERENCE_SERVICE_UNAVAILABLE", error.message, 503);
    }
    console.error("Image inference error:", error);
    return errorResponse("INTERNAL_ERROR", "Inference failed", 500);
  }
}
