"""Higher-resolution Grad-CAM for BHOOMI EfficientNet-B0."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image, ImageFilter

from .data import build_transforms
from .model import build_model


def make_jet_heatmap(values: np.ndarray) -> np.ndarray:
    """Convert a normalized grayscale heatmap into RGB JET colors."""
    values = np.clip(values, 0.0, 1.0)

    red = np.clip(1.5 - np.abs(4.0 * values - 3.0), 0.0, 1.0)
    green = np.clip(1.5 - np.abs(4.0 * values - 2.0), 0.0, 1.0)
    blue = np.clip(1.5 - np.abs(4.0 * values - 1.0), 0.0, 1.0)

    return (np.stack([red, green, blue], axis=-1) * 255).astype(np.uint8)


def normalize_heatmap(cam: np.ndarray) -> np.ndarray:
    """Robustly normalize CAM values without exaggerating extreme noise."""
    cam = np.maximum(cam, 0).astype(np.float32)

    upper = float(np.percentile(cam, 99.0))

    if upper <= 1e-8:
        return np.zeros_like(cam, dtype=np.float32)

    cam = np.clip(cam / upper, 0.0, 1.0)

    # Mild gamma adjustment preserves weaker meaningful activations.
    return np.power(cam, 1.15)


def find_default_image(
    data_dir: Path,
    manifest: Path,
    sample_index: int,
) -> Path:
    """Choose an image from the held-out test manifest."""
    with manifest.open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))

    if not rows:
        raise ValueError("The test manifest is empty.")

    if sample_index < 0 or sample_index >= len(rows):
        raise IndexError(
            f"Sample index must be between 0 and {len(rows) - 1}."
        )

    image_path = data_dir / rows[sample_index]["image_path"]

    if not image_path.is_file():
        raise FileNotFoundError(f"Test image not found: {image_path}")

    return image_path


class GradCAM:
    """Generate higher-resolution Grad-CAM explanations."""

    def __init__(self, checkpoint_path: Path):
        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

        checkpoint = torch.load(
            checkpoint_path,
            map_location=self.device,
            weights_only=True,
        )

        self.classes = checkpoint["classes"]

        self.model = build_model(
            num_classes=len(self.classes),
            pretrained=False,
        )

        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.to(self.device)
        self.model.eval()

        self.activations = None

        # EfficientNet-B0 feature stage 5 retains a 14x14 map
        # for a 224x224 input, instead of the final 7x7 map.
        self.target_layer_name = "model.features[5]"
        target_layer = self.model.features[5]

        def capture_activation(module, inputs, output):
            self.activations = output

        self.hook = target_layer.register_forward_hook(
            capture_activation
        )

        self.transform = build_transforms(training=False)

    def explain(self, image: Image.Image) -> dict:
        """Predict a class and calculate its higher-resolution CAM."""
        image = image.convert("RGB")
        original_size = image.size

        tensor = (
            self.transform(image)
            .unsqueeze(0)
            .to(self.device)
        )

        self.activations = None
        self.model.zero_grad(set_to_none=True)

        # Gradients must remain enabled for Grad-CAM.
        with torch.enable_grad():
            logits = self.model(tensor)

            probabilities = torch.softmax(logits, dim=1)[0]

            confidence, predicted_index = torch.max(
                probabilities,
                dim=0,
            )

            predicted_index = int(predicted_index.item())

            if self.activations is None:
                raise RuntimeError(
                    "Grad-CAM failed to capture feature activations."
                )

            if self.activations.shape[-2:] != (14, 14):
                raise RuntimeError(
                    "Unexpected target feature-map size: "
                    f"{tuple(self.activations.shape[-2:])}"
                )

            gradients = torch.autograd.grad(
                outputs=logits[0, predicted_index],
                inputs=self.activations,
                retain_graph=False,
                create_graph=False,
            )[0]

            # Standard Grad-CAM channel weights.
            weights = gradients.mean(
                dim=(2, 3),
                keepdim=True,
            )

            cam = torch.relu(
                (weights * self.activations).sum(dim=1, keepdim=True)
            )

            # Upscale the activation map to model input dimensions.
            cam = F.interpolate(
                cam,
                size=(224, 224),
                mode="bilinear",
                align_corners=False,
            )

        cam_array = cam[0, 0].detach().cpu().numpy()
        cam_array = normalize_heatmap(cam_array)

        # Smooth isolated activation noise before visualization.
        cam_gray = Image.fromarray(
            np.uint8(np.clip(cam_array, 0, 1) * 255)
        )

        cam_gray = cam_gray.filter(
            ImageFilter.GaussianBlur(radius=3.0)
        )

        cam_array = np.asarray(cam_gray).astype(np.float32) / 255.0

        heatmap = make_jet_heatmap(cam_array)

        heatmap_image = Image.fromarray(heatmap).resize(
            original_size,
            Image.Resampling.BILINEAR,
        )

        # Preserve more of the original leaf texture.
        original_array = (
            np.asarray(image).astype(np.float32) / 255.0
        )

        heatmap_array = (
            np.asarray(heatmap_image).astype(np.float32) / 255.0
        )

        overlay_array = (
            original_array * 0.65
            + heatmap_array * 0.35
        )

        overlay_array = np.clip(
            overlay_array * 255.0,
            0,
            255,
        ).astype(np.uint8)

        overlay = Image.fromarray(overlay_array)

        top_count = min(3, len(self.classes))

        top_scores, top_indices = torch.topk(
            probabilities.detach(),
            k=top_count,
        )

        top_predictions = [
            {
                "class_name": self.classes[int(index)],
                "probability": float(score.item()),
            }
            for score, index in zip(top_scores, top_indices)
        ]

        return {
            "prediction": self.classes[predicted_index],
            "confidence": float(confidence.item()),
            "top_predictions": top_predictions,
            "heatmap": heatmap_image,
            "overlay": overlay,
            "target_layer": self.target_layer_name,
            "feature_map_size": "14x14",
            "disclaimer": (
                "Experimental decision support only. Grad-CAM "
                "visualizes model sensitivity and does not prove "
                "disease location or agricultural diagnosis."
            ),
        }

    def close(self):
        self.hook.remove()


def main():
    parser = argparse.ArgumentParser(
        description="Generate BHOOMI AI Grad-CAM explanations."
    )

    parser.add_argument("--image", type=Path, default=None)

    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("data/processed/tomato_10class"),
    )

    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path(
            "data/processed/tomato_10class_manifests/test.csv"
        ),
    )

    parser.add_argument("--sample-index", type=int, default=0)

    parser.add_argument(
        "--checkpoint",
        type=Path,
        default=Path("models/tomato_efficientnet_b0.pth"),
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("artifacts/gradcam"),
    )

    args = parser.parse_args()

    if not args.checkpoint.is_file():
        raise FileNotFoundError(
            f"Checkpoint not found: {args.checkpoint}"
        )

    image_path = args.image

    if image_path is None:
        image_path = find_default_image(
            args.data_dir,
            args.manifest,
            args.sample_index,
        )

    if not image_path.is_file():
        raise FileNotFoundError(f"Image not found: {image_path}")

    args.output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 58)
    print("       BHOOMI AI - IMPROVED GRAD-CAM")
    print("=" * 58)
    print(f"Device: {torch.device('cuda' if torch.cuda.is_available() else 'cpu')}")
    print(f"Image: {image_path}")
    print("Loading trained checkpoint...")

    explainer = GradCAM(args.checkpoint)

    try:
        with Image.open(image_path) as source:
            image = source.convert("RGB")

        result = explainer.explain(image)

        stem = image_path.stem

        heatmap_path = args.output_dir / f"{stem}_heatmap.png"
        overlay_path = args.output_dir / f"{stem}_gradcam_overlay.png"
        original_path = args.output_dir / f"{stem}_original.png"
        json_path = args.output_dir / f"{stem}_gradcam_result.json"

        image.save(original_path)
        result["heatmap"].save(heatmap_path)
        result["overlay"].save(overlay_path)

        report = {
            "image": str(image_path),
            "model": "EfficientNet-B0",
            "prediction": result["prediction"],
            "confidence": result["confidence"],
            "top_predictions": result["top_predictions"],
            "target_layer": result["target_layer"],
            "feature_map_size": result["feature_map_size"],
            "original_image": str(original_path),
            "heatmap": str(heatmap_path),
            "overlay": str(overlay_path),
            "disclaimer": result["disclaimer"],
        }

        with json_path.open("w", encoding="utf-8") as file:
            json.dump(report, file, indent=4)

        print("\nIMPROVED GRAD-CAM RESULTS")
        print("-" * 58)
        print(f"Prediction: {result['prediction']}")
        print(f"Confidence: {result['confidence']:.2%}")
        print(f"Target layer: {result['target_layer']}")
        print(f"Feature map: {result['feature_map_size']}")

        print("\nTop predictions:")
        for item in result["top_predictions"]:
            print(
                f"  {item['class_name']}: "
                f"{item['probability']:.2%}"
            )

        print("\nFILES SAVED")
        print(f"Original: {original_path}")
        print(f"Heatmap:  {heatmap_path}")
        print(f"Overlay:  {overlay_path}")
        print(f"Report:   {json_path}")

        print("\nImproved Grad-CAM completed successfully.")

    finally:
        explainer.close()


if __name__ == "__main__":
    main()



