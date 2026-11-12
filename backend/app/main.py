"""BHOOMI AI inference API."""
from __future__ import annotations
import os
from pathlib import Path
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from src.bhoomi.image_utils import ImageValidationError, load_validated_image
from src.bhoomi.inference import Predictor

app = FastAPI(title="BHOOMI AI API", version="0.1.0",
              description="Experimental crop-image decision-support API. Not a substitute for expert diagnosis.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("BHOOMI_CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
MODEL_PATH = Path(os.getenv("BHOOMI_MODEL_PATH", "models/tomato_efficientnet_b0.pth"))
_predictor = None
_model_error = None
if MODEL_PATH.is_file():
    try:
        _predictor = Predictor(MODEL_PATH)
    except Exception as exc:
        _model_error = type(exc).__name__

@app.get("/")
def root():
    return {"name": "BHOOMI AI", "status": "online",
            "inference_ready": _predictor is not None,
            "message": "Experimental agricultural decision-support API."}

@app.get("/health")
def health():
    return {"status": "ok", "inference_ready": _predictor is not None,
            "model_path_configured": MODEL_PATH.is_file(), "model_load_error": _model_error}

@app.post("/api/v1/predict")
async def predict(file: UploadFile = File(...)):
    if _predictor is None:
        raise HTTPException(status_code=503, detail="No trained model checkpoint is available.")
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, or WEBP image.")
    content = await file.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image exceeds the 10 MB upload limit.")
    try:
        image = load_validated_image(content)
        return _predictor.predict(image)
    except ImageValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
