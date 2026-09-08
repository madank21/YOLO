# VisionForge Inference Service

This service is the only component that loads and runs the YOLO model. The Next.js app forwards JPEG, PNG, or WebP bytes to it.

## Run

```powershell
cd inference_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:YOLO_MODEL_PATH = "..\models\room_objects\v2\model.pt"
$env:YOLO_DEVICE = "cpu"
uvicorn main:app --host 127.0.0.1 --port 8001
```

Set `INFERENCE_SERVICE_URL=http://127.0.0.1:8001` in the Next.js environment. The model file must be a real Ultralytics YOLO detection checkpoint. The service performs a warmup inference at startup and exposes its SHA-256 checksum at `/health` and `/validate`.

## Tests

```powershell
pytest -q
```

Tests skip when no real model or Python dependencies are installed.
