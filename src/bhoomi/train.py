"""Train EfficientNet-B0 using the saved train/validation manifests."""
from __future__ import annotations

import argparse
from pathlib import Path

import torch
from torch import nn
from tqdm import tqdm

from .data import build_manifest_loaders
from .model import build_model


def run_training(data_dir: Path, manifest_dir: Path, output: Path,
                 epochs: int, batch_size: int, seed: int, pretrained: bool = False):
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

    train_loader, val_loader, classes = build_manifest_loaders(
        data_dir, manifest_dir, batch_size=batch_size, num_workers=0
    )
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    print(f"Classes: {len(classes)}")
    print(f"Training images: {len(train_loader.dataset)}")
    print(f"Validation images: {len(val_loader.dataset)}")
    print("Test images are not loaded during training.")

    print(f"ImageNet pretrained weights: {pretrained}")
    model = build_model(len(classes), pretrained=pretrained).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4, weight_decay=1e-4)

    class_counts = torch.tensor(
        [
            sum(row["class_name"] == class_name for row in train_loader.dataset.rows)
            for class_name in classes
        ],
        dtype=torch.float32,
    )
    class_weights = (class_counts.sum() / (len(classes) * class_counts)).sqrt()
    class_weights = class_weights / class_weights.mean()
    criterion = nn.CrossEntropyLoss(weight=class_weights.to(device))

    best_accuracy = -1.0
    output.parent.mkdir(parents=True, exist_ok=True)

    for epoch in range(epochs):
        model.train()
        loss_sum = 0.0
        seen = 0
        progress = tqdm(train_loader, desc=f"Epoch {epoch + 1}/{epochs}")
        for images, labels in progress:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(images), labels)
            loss.backward()
            optimizer.step()
            loss_sum += loss.item() * labels.size(0)
            seen += labels.size(0)
            progress.set_postfix(loss=f"{loss.item():.4f}")

        model.eval()
        correct = total = 0
        with torch.inference_mode():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                predictions = model(images).argmax(dim=1)
                correct += int((predictions == labels).sum().item())
                total += labels.size(0)

        accuracy = correct / total if total else 0.0
        average_loss = loss_sum / max(seen, 1)
        print(
            f"epoch={epoch + 1} train_loss={average_loss:.4f} "
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
                },
                output,
            )
            print(f"Saved best checkpoint: {output}")

    print("Training complete. Validation metrics are development metrics only.")
    print("Do not report validation accuracy as final test performance.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path("data/processed/tomato_10class"))
    parser.add_argument(
        "--manifest-dir", type=Path,
        default=Path("data/processed/tomato_10class_manifests"),
    )
    parser.add_argument("--output", type=Path, default=Path("models/tomato_efficientnet_b0.pth"))
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--pretrained", action="store_true", help="Initialize EfficientNet-B0 with ImageNet weights")
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1:
        parser.error("--epochs and --batch-size must be positive")
    run_training(
        args.data_dir, args.manifest_dir, args.output,
        args.epochs, args.batch_size, args.seed, args.pretrained,
    )


if __name__ == "__main__":
    main()
