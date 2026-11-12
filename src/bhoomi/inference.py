"""Checkpoint loading and prediction helpers."""
from __future__ import annotations
from pathlib import Path
import torch
from PIL import Image
from .data import build_transforms
from .model import build_model

class Predictor:
    def __init__(self, checkpoint_path: str | Path, confidence_threshold: float = 0.65):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        checkpoint = torch.load(checkpoint_path, map_location=self.device, weights_only=True)
        self.classes = checkpoint["classes"]
        self.model = build_model(len(self.classes), pretrained=False)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.to(self.device).eval()
        self.transform = build_transforms(False)
        self.confidence_threshold = confidence_threshold

    @torch.inference_mode()
    def predict(self, image: Image.Image, top_k: int = 3) -> dict:
        tensor = self.transform(image).unsqueeze(0).to(self.device)
        probabilities = torch.softmax(self.model(tensor), dim=1)[0]
        count = min(max(top_k, 1), len(self.classes))
        scores, indices = torch.topk(probabilities, k=count)
        confidence = float(scores[0].item())
        accepted = confidence >= self.confidence_threshold
        return {
            "status": "prediction" if accepted else "uncertain",
            "prediction": self.classes[int(indices[0])] if accepted else None,
            "confidence": confidence,
            "confidence_threshold": self.confidence_threshold,
            "requires_expert_review": not accepted,
            "top_k": [{"class_name": self.classes[int(i)], "probability": float(s)}
                      for s, i in zip(scores.tolist(), indices.tolist())],
            "disclaimer": "Experimental decision support only; not an agricultural diagnosis.",
        }
