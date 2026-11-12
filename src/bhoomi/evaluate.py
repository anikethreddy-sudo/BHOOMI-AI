"""Evaluate a saved checkpoint on an ImageFolder dataset."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import torch
from sklearn.metrics import classification_report, confusion_matrix
from torch.utils.data import DataLoader
from torchvision import datasets
from .data import build_transforms
from .inference import Predictor

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("artifacts/evaluation.json"))
    args = parser.parse_args()
    predictor = Predictor(args.checkpoint, confidence_threshold=0.0)
    dataset = datasets.ImageFolder(args.data_dir, transform=build_transforms(False))
    if dataset.classes != predictor.classes:
        raise ValueError("Dataset class order does not match checkpoint class order.")
    loader = DataLoader(dataset, batch_size=16, shuffle=False, num_workers=0)
    truth, predicted = [], []
    with torch.inference_mode():
        for images, labels in loader:
            logits = predictor.model(images.to(predictor.device))
            predicted.extend(logits.argmax(dim=1).cpu().tolist())
            truth.extend(labels.tolist())
    report = classification_report(truth, predicted, target_names=dataset.classes,
                                   output_dict=True, zero_division=0)
    result = {"sample_count": len(dataset), "classes": dataset.classes,
              "classification_report": report,
              "confusion_matrix": confusion_matrix(truth, predicted).tolist(),
              "warning": "Metrics are only as representative as this dataset; field validation is separate."}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
