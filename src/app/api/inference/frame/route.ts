import { successResponse, errorResponse } from "@/lib/api-response";
import { inferImage, InferenceServiceUnavailableError } from "@/lib/inference-service";
import { requireInferenceAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Active streaming session guard (§21: single active streaming device in v1)
let currentStreamingSessionId: string | null = null;
let lastFrameReceivedAt: number = Date.now();

export async function POST(request: Request) {
  try {
    const auth = await requireInferenceAuth(request);
    if ("response" in auth) return auth.response;
    const body = await request.json();
    const {
      type = "frame",
      session_id,
      frame_id = 1,
      timestamp = Date.now(),
      format = "jpeg",
      width = 1280,
      height = 720,
      orientation = 1,
      data,
      device_id,
      confidence_threshold = 0.25,
    } = body;

    if (!session_id) {
      return errorResponse("DEVICE_NOT_PAIRED", "session_id is required", 400);
    }

    if (typeof data !== "string" || !data.startsWith("data:image/")) {
      return errorResponse("UPLOAD_INVALID_TYPE", "A JPEG, PNG, or WebP frame data URI is required", 400);
    }

    // §21 Concurrency Guard: Ensure active stream control (allow mobile client takeover)
    const now = Date.now();
    const isMobileSession = session_id.startsWith("expo_") || session_id.startsWith("device_");
    if (
      currentStreamingSessionId &&
      currentStreamingSessionId !== session_id &&
      now - lastFrameReceivedAt < 4000 &&
      !isMobileSession
    ) {
      return errorResponse(
        "DEVICE_BUSY",
        "Another device is currently actively streaming to the inference queue. VisionForge v1 permits one active stream at a time.",
        409,
        { currentStreamingSessionId }
      );
    }

    currentStreamingSessionId = session_id;
    lastFrameReceivedAt = now;

    // Check frame byte size cap (§8 STREAM_MAX_FRAME_BYTES: 2MB cap for mobile high-DPI frames)
    if (data && typeof data === "string" && data.length > 2500000) {
      return errorResponse("UPLOAD_TOO_LARGE", "Frame size exceeds 2 MB limit", 413);
    }

    const result = await inferImage(data, confidence_threshold);
    return successResponse({
      type: "detections",
      sessionId: session_id,
      frameId: frame_id,
      ...result,
      captureTimestamp: timestamp,
      orientation,
      format,
    });
  } catch (error) {
    if (error instanceof InferenceServiceUnavailableError) {
      return errorResponse("INFERENCE_SERVICE_UNAVAILABLE", error.message, 503);
    }
    console.error("Frame inference error:", error);
    return errorResponse("INTERNAL_ERROR", "Frame processing failed", 500);
  }
}
