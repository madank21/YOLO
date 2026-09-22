import { NextResponse } from "next/server";

export type ErrorCode =
  | "MODEL_LOAD_FAILED"
  | "MODEL_VALIDATION_FAILED"
  | "MODEL_NOT_FOUND"
  | "DATASET_NOT_FOUND"
  | "DATASET_VALIDATION_FAILED"
  | "DATASET_EXPORT_FAILED"
  | "INVALID_SPLIT_RATIOS"
  | "DEVICE_NOT_PAIRED"
  | "DEVICE_BUSY"
  | "PAIRING_TOKEN_EXPIRED"
  | "PAIRING_TOKEN_INVALID"
  | "UPLOAD_TOO_LARGE"
  | "UPLOAD_INVALID_TYPE"
  | "PATH_TRAVERSAL_REJECTED"
  | "ANNOTATION_INVALID"
  | "TRAINING_IMPORT_INVALID"
  | "AUTH_REQUIRED"
  | "AUTH_CONFIGURATION_MISSING"
  | "INFERENCE_SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details: details || {},
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}
