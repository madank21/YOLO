export interface InferenceServiceObject {
  class_id: number;
  class_name: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x1_norm: number;
  y1_norm: number;
  x2_norm: number;
  y2_norm: number;
  track_id?: number;
  is_unknown: boolean;
}

export interface InferenceServiceResult {
  model_version: string;
  device: string;
  width: number;
  height: number;
  objects: InferenceServiceObject[];
  inference_ms: number;
  model_checksum_sha256?: string | null;
}

export class InferenceServiceUnavailableError extends Error {
  constructor(message: string = "Inference service unavailable") {
    super(message);
    this.name = "InferenceServiceUnavailableError";
  }
}

const inferenceServiceUrl = process.env.INFERENCE_SERVICE_URL || "http://127.0.0.1:8001";

export async function inferImage(
  imageData: string | Uint8Array,
  confidenceThreshold: number,
  saveToStorage: boolean = false
): Promise<InferenceServiceResult> {
  const bytes = typeof imageData === "string" ? decodeDataUri(imageData) : imageData;
  const contentType = typeof imageData === "string" ? getDataUriMime(imageData) : "image/jpeg";
  const form = new FormData();
  const imageBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(imageBuffer).set(bytes);
  form.append("frame", new Blob([imageBuffer], { type: contentType }), "frame");
  const params = new URLSearchParams({
    confidence_threshold: String(confidenceThreshold),
    save_to_storage: saveToStorage ? "true" : "false",
  });
  
  try {
    const response = await fetch(`${inferenceServiceUrl}/infer?${params}`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      if (response.status === 503) {
        throw new InferenceServiceUnavailableError(
          `Inference service returned 503: ${await response.text()}`
        );
      }
      throw new Error(`Inference service returned ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as InferenceServiceResult;
  } catch (error) {
    if (error instanceof InferenceServiceUnavailableError) {
      throw error;
    }
    if (
      error instanceof TypeError ||
      (error as any)?.code === "ECONNREFUSED" ||
      (error as any)?.cause?.code === "ECONNREFUSED"
    ) {
      throw new InferenceServiceUnavailableError(
        `Inference service is unreachable at ${inferenceServiceUrl}. Please ensure the python inference server is running ('npm run inference').`
      );
    }
    throw error;
  }
}

function getDataUriMime(dataUri: string): string {
  const match = dataUri.match(/^data:(image\/(?:jpeg|png|webp));base64,/i);
  if (!match) throw new Error("Only JPEG, PNG, and WebP data URIs are supported");
  return match[1].toLowerCase();
}

function decodeDataUri(dataUri: string): Uint8Array {
  getDataUriMime(dataUri);
  const comma = dataUri.indexOf(",");
  if (comma < 0) throw new Error("Invalid image data URI");
  return Uint8Array.from(Buffer.from(dataUri.slice(comma + 1), "base64"));
}
