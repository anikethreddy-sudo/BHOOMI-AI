"""Manifest-backed image datasets and deterministic transforms."""
from __future__ import annotations

import csv
from pathlib import Path

from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms

IMAGE_SIZE = 224
MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)


def build_transforms(training: bool = False):
    steps = [transforms.Resize((IMAGE_SIZE, IMAGE_SIZE))]
    if training:
        steps += [
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(12),
            transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.10),
        ]
    steps += [transforms.ToTensor(), transforms.Normalize(MEAN, STD)]
    return transforms.Compose(steps)


class ManifestDataset(Dataset):
    """Load image paths and labels from one generated split CSV."""

    def __init__(self, data_dir: str | Path, manifest_path: str | Path,
                 classes: list[str] | None = None, training: bool = False):
        self.data_dir = Path(data_dir)
        self.manifest_path = Path(manifest_path)
        if not self.data_dir.is_dir():
            raise FileNotFoundError(f"Dataset directory not found: {self.data_dir}")
        if not self.manifest_path.is_file():
            raise FileNotFoundError(f"Manifest not found: {self.manifest_path}")

        with self.manifest_path.open(newline="", encoding="utf-8") as file:
            self.rows = list(csv.DictReader(file))
        if not self.rows:
            raise ValueError(f"Manifest contains no rows: {self.manifest_path}")

        manifest_classes = sorted({row["class_name"] for row in self.rows})
        self.classes = sorted(classes) if classes is not None else manifest_classes
        if manifest_classes != self.classes:
            raise ValueError(
                f"Manifest classes do not match expected classes. "
                f"Expected {self.classes}; found {manifest_classes}"
            )
        self.class_to_idx = {name: index for index, name in enumerate(self.classes)}
        self.transform = build_transforms(training)

        missing = [
            row["image_path"] for row in self.rows
            if not (self.data_dir / row["image_path"]).is_file()
        ]
        if missing:
            raise FileNotFoundError(
                f"{len(missing)} manifest image(s) are missing; first: {missing[0]}"
            )

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int):
        row = self.rows[index]
        image_path = self.data_dir / row["image_path"]
        with Image.open(image_path) as image:
            image = image.convert("RGB")
            tensor = self.transform(image)
        return tensor, self.class_to_idx[row["class_name"]]


def build_manifest_loaders(data_dir: str | Path, manifest_dir: str | Path,
                           batch_size: int = 8, num_workers: int = 0):
    """Build training and validation loaders; the test split is never loaded."""
    manifest_dir = Path(manifest_dir)
    train_manifest = manifest_dir / "train.csv"
    val_manifest = manifest_dir / "validation.csv"
    train_set = ManifestDataset(data_dir, train_manifest, training=True)
    val_set = ManifestDataset(
        data_dir, val_manifest, classes=train_set.classes, training=False
    )
    train_loader = DataLoader(
        train_set, batch_size=batch_size, shuffle=True, num_workers=num_workers
    )
    val_loader = DataLoader(
        val_set, batch_size=batch_size, shuffle=False, num_workers=num_workers
    )
    return train_loader, val_loader, train_set.classes
