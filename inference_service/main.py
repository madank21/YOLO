from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import sys
import json
from datetime import datetime

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ultralytics import YOLO
import numpy as np
from PIL import Image
import io
import time

# Import storage
try:
    from storage import storage
except ImportError:
    storage = None

app = FastAPI(title="VisionForge Inference Service", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model variable
model = None
model_info = {
    "loaded": False,
    "model_path": None,
    "model_version": None,
    "device": "cpu"
}

@app.on_event("startup")
async def load_model():
    global model, model_info
    
    # Get model path from environment
    configured_model_path = os.getenv("YOLO_MODEL_PATH", "models/room_objects/v2/model.pt")
    if os.path.isabs(configured_model_path):
        model_path = configured_model_path
    else:
        project_root = os.path.dirname(os.path.dirname(__file__))
        candidates = [
            os.path.abspath(configured_model_path),
            os.path.abspath(os.path.join(project_root, configured_model_path)),
        ]
        model_path = next((candidate for candidate in candidates if os.path.exists(candidate)), candidates[-1])
    device = os.getenv("YOLO_DEVICE", "cpu")
    
    if not os.path.exists(model_path):
        model_info["error"] = f"Model not found at {model_path}"
        return
    
    try:
        # Load YOLO model
        model = YOLO(model_path)
        model_info.update({
            "loaded": True,
            "model_path": model_path,
            "model_version": "room_objects:v2",
            "device": device,
            "classes": list(model.names.values()) if hasattr(model, 'names') else []
        })
        
        # Warmup inference
        warmup_img = np.zeros((640, 640, 3), dtype=np.uint8)
        model.predict(warmup_img, device=device, verbose=False)
        print(f"✅ Model loaded: {model_path}")
        
    except Exception as e:
        model_info["error"] = str(e)
        print(f"❌ Failed to load model: {e}")

class Detection(BaseModel):
    class_name: str
    confidence: float
    bbox: List[float]
    bbox_normalized: List[float]

class InferenceResponse(BaseModel):
    success: bool
    detections: List[Detection]
    objects: List[dict] = []
    width: Optional[int] = None
    height: Optional[int] = None
    model_version: Optional[str] = None
    inference_ms: Optional[float] = None
    image_info: Optional[dict] = None
    saved_to_storage: bool = False

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    import hashlib
    
    response = {
        "ok": model_info.get("loaded", False),
        "model_version": model_info.get("model_version"),
        "model_path": model_info.get("model_path"),
        "device": model_info.get("device", "cpu"),
        "classes": model_info.get("classes", []),
    }
    
    # Add model checksum if model exists
    if model_info.get("model_path") and os.path.exists(model_info["model_path"]):
        with open(model_info["model_path"], "rb") as f:
            model_bytes = f.read()
            response["model_checksum_sha256"] = hashlib.sha256(model_bytes).hexdigest()[:16]
    
    # Add storage info
    if storage:
        stats = storage.get_stats()
        response["storage"] = {
            "total_detections": stats.get("total_detections", 0)
        }
    
    return response

@app.post("/validate")
async def validate_model():
    """Validate model is loaded"""
    if not model_info.get("loaded", False):
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {"valid": True, "model_version": model_info.get("model_version")}

@app.post("/infer", response_model=InferenceResponse)
async def infer(
    frame: UploadFile = File(...),
    confidence_threshold: float = 0.5,
    save_to_storage: bool = True
):
    """Run inference on an image"""
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        inference_started = time.perf_counter()
        # Read image
        image_data = await frame.read()
        image = Image.open(io.BytesIO(image_data))
        image_array = np.array(image)
        
        # Get image info
        height, width = image_array.shape[:2]
        image_info = {
            "filename": frame.filename,
            "width": width,
            "height": height,
            "content_type": frame.content_type
        }
        
        # Run inference
        results = model.predict(image_array, conf=confidence_threshold, verbose=False)
        
        # Parse results
        detections = []
        if results and len(results) > 0:
            result = results[0]
            boxes = result.boxes
            
            if boxes is not None and len(boxes) > 0:
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    confidence = float(box.conf[0])
                    class_id = int(box.cls[0])
                    class_name = model.names[class_id] if hasattr(model, 'names') else f"class_{class_id}"
                    
                    # Calculate normalized coordinates
                    x1_norm = max(0.0, min(1.0, x1 / width))
                    y1_norm = max(0.0, min(1.0, y1 / height))
                    x2_norm = max(0.0, min(1.0, x2 / width))
                    y2_norm = max(0.0, min(1.0, y2 / height))
                    
                    detection = Detection(
                        class_name=class_name,
                        confidence=confidence,
                        bbox=[x1, y1, x2, y2],
                        bbox_normalized=[x1_norm, y1_norm, x2_norm, y2_norm]
                    )
                    detections.append(detection)
        
        objects = []
        for det in detections:
            class_id = next(
                (index for index, name in model.names.items() if name == det.class_name),
                -1,
            )
            objects.append({
                "class_id": class_id,
                "class_name": det.class_name,
                "confidence": det.confidence,
                "x1": det.bbox[0],
                "y1": det.bbox[1],
                "x2": det.bbox[2],
                "y2": det.bbox[3],
                "x1_norm": det.bbox_normalized[0],
                "y1_norm": det.bbox_normalized[1],
                "x2_norm": det.bbox_normalized[2],
                "y2_norm": det.bbox_normalized[3],
                "is_unknown": det.confidence < confidence_threshold,
            })

        # Save to storage
        saved = False
        if save_to_storage and storage and detections:
            storage.add_detection({
                "image_info": image_info,
                "confidence_threshold": confidence_threshold,
                "objects": [
                    {
                        "class": det.class_name,
                        "confidence": det.confidence,
                        "bbox": det.bbox,
                        "bbox_normalized": det.bbox_normalized
                    }
                    for det in detections
                ]
            })
            saved = True
        
        return InferenceResponse(
            success=True,
            detections=detections,
            objects=objects,
            width=width,
            height=height,
            model_version=model_info.get("model_version"),
            inference_ms=round((time.perf_counter() - inference_started) * 1000, 2),
            image_info=image_info,
            saved_to_storage=saved
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/storage/stats")
async def get_storage_stats():
    """Get detection statistics"""
    if not storage:
        raise HTTPException(status_code=503, detail="Storage not available")
    return storage.get_stats()

@app.get("/storage/detections")
async def get_stored_detections(limit: int = 100):
    """Get stored detections"""
    if not storage:
        raise HTTPException(status_code=503, detail="Storage not available")
    return {"detections": storage.get_detections(limit=limit)}

@app.delete("/storage/detections")
async def clear_stored_detections():
    """Clear all stored detections"""
    if not storage:
        raise HTTPException(status_code=503, detail="Storage not available")
    storage.clear_detections()
    return {"cleared": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
