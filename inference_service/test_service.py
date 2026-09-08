import os
from pathlib import Path

import pytest
from PIL import Image
from fastapi.testclient import TestClient

# Resolve model path
MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "")

# If no env variable, search for the model
if not MODEL_PATH:
    candidates = [
        Path("../models/room_objects/v2/model.pt"),
        Path("../../models/room_objects/v2/model.pt"),
        Path("models/room_objects/v2/model.pt"),
        Path("C:/Users/mehun/OneDrive/Desktop/Project/YOLO/models/room_objects/v2/model.pt"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            MODEL_PATH = str(candidate)
            break

print(f"Using model path: {MODEL_PATH}")
print(f"Model exists: {Path(MODEL_PATH).is_file()}")

# Set environment variable for the app
os.environ["YOLO_MODEL_PATH"] = MODEL_PATH

from main import app  # noqa: E402


def test_health_reports_loaded_model():
    if not Path(MODEL_PATH).is_file():
        pytest.skip("Model not found")
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["ok"] is True
        assert response.json()["model_checksum_sha256"]


def test_infer_returns_bounded_boxes(tmp_path):
    if not Path(MODEL_PATH).is_file():
        pytest.skip("Model not found")
    image_path = tmp_path / "fixture.jpg"
    Image.new("RGB", (640, 480), (120, 120, 120)).save(image_path, format="JPEG")
    with TestClient(app) as client, image_path.open("rb") as image:
        response = client.post(
            "/infer",
            files={"frame": ("fixture.jpg", image, "image/jpeg")},
            data={"confidence_threshold": "0.1"},
        )
    assert response.status_code == 200
    payload = response.json()
    assert payload["width"] == 640
    assert payload["height"] == 480
    for obj in payload["objects"]:
        assert 0 <= obj["x1_norm"] <= obj["x2_norm"] <= 1
        assert 0 <= obj["y1_norm"] <= obj["y2_norm"] <= 1
