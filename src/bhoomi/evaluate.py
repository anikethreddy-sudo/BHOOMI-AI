"""Evaluate a saved checkpoint using only the held-out test manifest."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from sklearn.metrics import classification_report, confusion_matrix
from torch.utils.data import DataLoader

from .data import ManifestDataset
from .inference import Predictor


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path("data/processed/tomato_10class"))
    parser.add_argument(
        "--manifest", type=Path,
        default=Path("data/processed/tomato_10class_manifests/test.csv"),
    )
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("artifacts/test_evaluation.json"))
    parser.add_argument("--batch-size", type=int, default=8)
    args = parser.parse_args()

    predictor = Predictor(args.checkpoint, confidence_threshold=0.0)
    dataset = ManifestDataset(
        args.data_dir, args.manifest, classes=predictor.classes, training=False
    )
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=False, num_workers=0)

    truth, predicted = [], []
    predictor.model.eval()
    with torch.inference_mode():
        for images, labels in loader:
            logits = predictor.model(images.to(predictor.device))
            predicted.extend(logits.argmax(dim=1).cpu().tolist())
            truth.extend(labels.tolist())

    report = classification_report(
        truth, predicted, labels=list(range(len(predictor.classes))),
        target_names=predictor.classes, output_dict=True, zero_division=0,
    )
    result = {
        "sample_count": len(dataset),
        "classes": predictor.classes,
        "classification_report": report,
        "confusion_matrix": confusion_matrix(
            truth, predicted, labels=list(range(len(predictor.classes)))
        ).tolist(),
        "warning": (
            "These are held-out PlantVillage test metrics, not field performance. "
            "External field validation is required before real-world claims."
        ),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
