"""EfficientNet-B0 training with cached frozen-backbone features."""
from __future__ import annotations

import argparse
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset
from tqdm import tqdm

from .data import build_manifest_loaders
from .model import build_model


def extract_features(model, loader, device, description):
    """Extract frozen EfficientNet features once and cache them in memory."""
    all_features = []
    all_labels = []

    model.eval()

    with torch.inference_mode():
        for images, labels in tqdm(loader, desc=description):
            images = images.to(device)
            features = model.features(images)
            features = model.avgpool(features)
            features = torch.flatten(features, 1)

            all_features.append(features.cpu())
            all_labels.append(labels.cpu())

    return torch.cat(all_features), torch.cat(all_labels)


def run_training(
    data_dir: Path,
    manifest_dir: Path,
    output: Path,
    epochs: int,
    batch_size: int,
    seed: int,
    pretrained: bool = False,
):
    torch.manual_seed(seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    train_loader, val_loader, classes = build_manifest_loaders(
        data_dir,
        manifest_dir,
        batch_size=batch_size,
        num_workers=0,
    )

    print(f"Device: {device}")
    print(f"Classes: {len(classes)}")
    print(f"Training images: {len(train_loader.dataset)}")
    print(f"Validation images: {len(val_loader.dataset)}")
    print("Test images are not loaded during training.")
    print(f"ImageNet pretrained weights: {pretrained}")

    model = build_model(len(classes), pretrained=pretrained).to(device)

    # Freeze the entire EfficientNet feature extractor.
    for parameter in model.features.parameters():
        parameter.requires_grad = False

    for parameter in model.avgpool.parameters():
        parameter.requires_grad = False

    print("\n========== FEATURE EXTRACTION ==========")

    train_features, train_labels = extract_features(
        model, train_loader, device, "Training feature extraction"
    )

    val_features, val_labels = extract_features(
        model, val_loader, device, "Validation feature extraction"
    )

    print("\nFeature extraction completed.")
    print(f"Training feature shape: {tuple(train_features.shape)}")
    print(f"Validation feature shape: {tuple(val_features.shape)}")

    # Only the final classifier is trainable.
    model.eval()
    model.classifier.train()

    optimizer = torch.optim.AdamW(
        model.classifier.parameters(),
        lr=1e-3,
        weight_decay=1e-4,
    )

    class_counts = torch.tensor(
        [
            sum(
                row["class_name"] == class_name
                for row in train_loader.dataset.rows
            )
            for class_name in classes
        ],
        dtype=torch.float32,
    )

    class_weights = (
        class_counts.sum() / (len(classes) * class_counts)
    ).sqrt()

    class_weights = class_weights / class_weights.mean()
    criterion = nn.CrossEntropyLoss(weight=class_weights.to(device))

    feature_dataset = TensorDataset(train_features, train_labels)
    feature_loader = DataLoader(
        feature_dataset,
        batch_size=256,
        shuffle=True,
        num_workers=0,
    )

    best_accuracy = -1.0
    output.parent.mkdir(parents=True, exist_ok=True)

    print("\n========== CLASSIFIER TRAINING ==========")

    for epoch in range(epochs):
        model.classifier.train()

        loss_sum = 0.0
        seen = 0

        progress = tqdm(
            feature_loader,
            desc=f"Classifier epoch {epoch + 1}/{epochs}",
        )

        for features, labels in progress:
            features = features.to(device)
            labels = labels.to(device)

            optimizer.zero_grad(set_to_none=True)

            predictions = model.classifier(features)
            loss = criterion(predictions, labels)

            loss.backward()
            optimizer.step()

            loss_sum += loss.item() * labels.size(0)
            seen += labels.size(0)

            progress.set_postfix(loss=f"{loss.item():.4f}")

        model.classifier.eval()

        correct = 0
        total = 0

        with torch.inference_mode():
            for start in range(0, len(val_features), 256):
                features = val_features[start:start + 256].to(device)
                labels = val_labels[start:start + 256].to(device)

                predictions = model.classifier(features).argmax(dim=1)

                correct += int((predictions == labels).sum().item())
                total += labels.size(0)

        accuracy = correct / total if total else 0.0
        average_loss = loss_sum / max(seen, 1)

        print(
            f"epoch={epoch + 1} "
            f"train_loss={average_loss:.4f} "
            f"validation_accuracy={accuracy:.4f}"
        )

        if accuracy > best_accuracy:
            best_accuracy = accuracy

            torch.save(
                {
                    "architecture": "efficientnet_b0",
                    "classes": classes,
                    "model_state_dict": model.state_dict(),
                    "validation_accuracy": best_accuracy,
                    "seed": seed,
                    "pretrained": pretrained,
                    "training_manifest": str(manifest_dir / "train.csv"),
                    "validation_manifest": str(manifest_dir / "validation.csv"),
                    "training_method": "frozen_backbone_cached_features",
                },
                output,
            )

            print(f"Saved best checkpoint: {output}")

    print("\nTraining complete.")
    print(f"Best validation accuracy: {best_accuracy:.4f}")
    print("Validation accuracy is not final test performance.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)

    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("data/processed/tomato_10class"),
    )
    parser.add_argument(
        "--manifest-dir",
        type=Path,
        default=Path("data/processed/tomato_10class_manifests"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("models/tomato_efficientnet_b0.pth"),
    )
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--pretrained",
        action="store_true",
        help="Initialize EfficientNet-B0 with ImageNet weights",
    )

    args = parser.parse_args()

    if args.epochs < 1 or args.batch_size < 1:
        parser.error("--epochs and --batch-size must be positive")

    run_training(
        args.data_dir,
        args.manifest_dir,
        args.output,
        args.epochs,
        args.batch_size,
        args.seed,
        args.pretrained,
    )


if __name__ == "__main__":
    main()
