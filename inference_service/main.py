import hashlib
import io
import os
import time
from contextlib import asynccontextmanager
from typing import Annotated

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image, ImageOps
from ultralytics import YOLO

MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "models/room_objects/v2/model.pt")
MODEL_VERSION = os.getenv("YOLO_MODEL_VERSION", "room_objects:v2")
DEVICE = os.getenv("YOLO_DEVICE", "cpu")
MAX_FRAME_BYTES = int(os.getenv("STREAM_MAX_FRAME_BYTES", "1048576"))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.4"))

model: YOLO | None = None
model_checksum: str | None = None


def sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_model() -> None:
    global model, model_checksum
    if not os.path.isfile(MODEL_PATH):
        raise RuntimeError(f"YOLO model not found: {MODEL_PATH}")
    model = YOLO(MODEL_PATH)
    model.to(DEVICE)
    model.predict(np.zeros((640, 640, 3), dtype=np.uint8), imgsz=640, device=DEVICE, verbose=False)
    model_checksum = sha256_file(MODEL_PATH)


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_model()
    yield


app = FastAPI(title="VisionForge Inference Service", version="1.0.0", lifespan=lifespan)


def get_model() -> YOLO:
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")
    return model


@app.get("/health")
def health() -> dict:
    return {
        "ok": model is not None,
        "model_version": MODEL_VERSION,
        "model_path": MODEL_PATH,
        "model_checksum_sha256": model_checksum,
        "device": DEVICE,
    }


@app.post("/validate")
def validate(expected_checksum_sha256: str | None = None) -> dict:
    active_model = get_model()
    checksum = model_checksum or sha256_file(MODEL_PATH)
    if expected_checksum_sha256 and checksum.lower() != expected_checksum_sha256.lower():
        raise HTTPException(status_code=422, detail="Model checksum does not match expected checksum")
    return {
        "valid": True,
        "model_version": MODEL_VERSION,
        "checksum_sha256": checksum,
        "classes": {str(key): value for key, value in active_model.names.items()},
        "device": DEVICE,
    }

@app.post("/infer")
async def infer(
    frame: Annotated[UploadFile, File(...)],
    confidence_threshold: float = Form(CONFIDENCE_THRESHOLD),
) -> dict:
    payload = await frame.read()
    if not payload or len(payload) > MAX_FRAME_BYTES:
        raise HTTPException(status_code=413, detail="Frame is empty or exceeds the configured size limit")
    if frame.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG, and WebP frames are supported")

    try:
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(payload))).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Frame is not a valid image") from exc

    active_model = get_model()
    started = time.perf_counter()
    results = active_model.predict(image, conf=confidence_threshold, device=DEVICE, verbose=False)
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    result = results[0]
    width, height = image.size
    objects = []

    if result.boxes is not None:
        names = active_model.names
        for box in result.boxes:
            xyxy = box.xyxy[0].tolist()
            confidence = float(box.conf[0].item())
            class_id = int(box.cls[0].item())
            x1, y1, x2, y2 = xyxy
            objects.append({
                "class_id": class_id,
                "class_name": str(names[class_id]),
                "confidence": round(confidence, 4),
                "x1": round(max(0, min(width, x1))),
                "y1": round(max(0, min(height, y1))),
                "x2": round(max(0, min(width, x2))),
                "y2": round(max(0, min(height, y2))),
                "x1_norm": round(max(0, min(1, x1 / width)), 6),
                "y1_norm": round(max(0, min(1, y1 / height)), 6),
                "x2_norm": round(max(0, min(1, x2 / width)), 6),
                "y2_norm": round(max(0, min(1, y2 / height)), 6),
                "is_unknown": False,
            })

    return {
        "model_version": MODEL_VERSION,
        "device": DEVICE,
        "width": width,
        "height": height,
        "objects": objects,
        "inference_ms": elapsed_ms,
        "model_checksum_sha256": model_checksum,
    }
