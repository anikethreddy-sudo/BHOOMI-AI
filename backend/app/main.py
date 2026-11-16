"""BHOOMI AI prediction and Grad-CAM API."""
from __future__ import annotations

import json
import os
import threading
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
from starlette.concurrency import run_in_threadpool

from src.bhoomi.gradcam import GradCAM
from src.bhoomi.image_utils import (
    ImageValidationError,
    load_validated_image,
)

app = FastAPI(
    title="BHOOMI AI API",
    version="0.2.0",
    description=(
        "Experimental tomato leaf disease classification "
        "with Grad-CAM visual explanations."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "BHOOMI_CORS_ORIGINS",
        "http://localhost:5173",
    ).split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

BASE_DIR = Path(__file__).resolve().parents[2]

MODEL_PATH = Path(
    os.getenv(
        "BHOOMI_MODEL_PATH",
        str(BASE_DIR / "models" / "tomato_efficientnet_b0.pth"),
    )
)

ARTIFACTS_DIR = BASE_DIR / "artifacts"
API_OUTPUT_DIR = ARTIFACTS_DIR / "api"

API_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app.mount(
    "/artifacts",
    StaticFiles(directory=str(ARTIFACTS_DIR)),
    name="artifacts",
)

CONFIDENCE_THRESHOLD = float(
    os.getenv("BHOOMI_CONFIDENCE_THRESHOLD", "0.65")
)

_explainer = None
_model_error = None
_explainer_lock = threading.Lock()

if MODEL_PATH.is_file():
    try:
        _explainer = GradCAM(MODEL_PATH)
    except Exception as exc:
        _model_error = type(exc).__name__
else:
    _model_error = "CheckpointNotFound"


def process_image(image: Image.Image, request_id: str) -> dict:
    """Generate prediction and visual explanation."""
    if _explainer is None:
        raise RuntimeError("The trained model is unavailable.")

    # Protect shared model hooks from concurrent requests.
    with _explainer_lock:
        result = _explainer.explain(image)

    confidence = result["confidence"]
    accepted = confidence >= CONFIDENCE_THRESHOLD

    heatmap_name = f"{request_id}_heatmap.png"
    overlay_name = f"{request_id}_overlay.png"
    report_name = f"{request_id}_result.json"

    heatmap_path = API_OUTPUT_DIR / heatmap_name
    overlay_path = API_OUTPUT_DIR / overlay_name
    report_path = API_OUTPUT_DIR / report_name

    result["heatmap"].save(heatmap_path)
    result["overlay"].save(overlay_path)

    report = {
        "request_id": request_id,
        "model": "EfficientNet-B0",
        "status": "prediction" if accepted else "uncertain",
        "prediction": result["prediction"] if accepted else None,
        "candidate_prediction": result["prediction"],
        "confidence": confidence,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "requires_expert_review": not accepted,
        "top_k": result["top_predictions"],
        "heatmap_url": f"/artifacts/api/{heatmap_name}",
        "overlay_url": f"/artifacts/api/{overlay_name}",
        "disclaimer": (
            "Experimental decision support only. "
            "Not a substitute for expert agricultural diagnosis. "
            "Grad-CAM is a visual explanation, not proof of model reasoning."
        ),
    }

    with report_path.open("w", encoding="utf-8") as file:
        json.dump(report, file, indent=4)

    return report


@app.get("/")
def root():
    return {
        "name": "BHOOMI AI",
        "status": "online",
        "inference_ready": _explainer is not None,
        "features": [
            "Tomato leaf disease classification",
            "Top 3 predictions",
            "Grad-CAM heatmap",
            "Grad-CAM overlay",
            "Confidence-based expert review",
        ],
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "inference_ready": _explainer is not None,
        "model_path_configured": MODEL_PATH.is_file(),
        "model_load_error": _model_error,
        "architecture": "EfficientNet-B0",
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "explainability": _explainer is not None,
    }


@app.post("/api/v1/predict")
async def predict(file: UploadFile = File(...)):
    if _explainer is None:
        raise HTTPException(
            status_code=503,
            detail="The trained model is unavailable.",
        )

    if file.content_type not in {
        "image/jpeg",
        "image/png",
        "image/webp",
    }:
        raise HTTPException(
            status_code=415,
            detail="Upload a JPEG, PNG, or WEBP image.",
        )

    content = await file.read(10 * 1024 * 1024 + 1)

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image exceeds the 10 MB upload limit.",
        )

    try:
        image = load_validated_image(content)
        request_id = uuid.uuid4().hex

        return await run_in_threadpool(
            process_image,
            image,
            request_id,
        )

    except ImageValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Image processing failed. Check the API server logs.",
        ) from exc
