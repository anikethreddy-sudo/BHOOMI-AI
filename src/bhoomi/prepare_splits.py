"""Create reproducible, stratified train/validation/test manifests for an ImageFolder dataset.

Run from the repository root:
    python -m src.bhoomi.prepare_splits --data-dir data/processed/tomato_10class
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path

from PIL import Image
from sklearn.model_selection import train_test_split

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def collect_images(data_dir: Path) -> tuple[list[dict[str, str]], list[str]]:
    if not data_dir.is_dir():
        raise FileNotFoundError(f"Dataset directory not found: {data_dir}")

    class_dirs = sorted(\n        path for path in data_dir.iterdir()\n        if path.is_dir() and any(\n            child.is_file() and child.suffix.lower() in IMAGE_EXTENSIONS\n            for child in path.rglob("*")\n        )\n    )
    if len(class_dirs) < 2:
        raise ValueError(f"Expected at least two class folders in {data_dir}")

    rows: list[dict[str, str]] = []
    invalid: list[str] = []

    for class_dir in class_dirs:
        for image_path in sorted(class_dir.rglob("*")):
            if not image_path.is_file() or image_path.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            try:
                with Image.open(image_path) as image:
                    image.verify()
            except Exception:
                invalid.append(str(image_path))
                continue

            rows.append({
                "image_path": image_path.relative_to(data_dir).as_posix(),
                "class_name": class_dir.name,
            })

    if not rows:
        raise ValueError(f"No valid images found in {data_dir}")

    classes_with_images = {row["class_name"] for row in rows}
    empty_classes = [path.name for path in class_dirs if path.name not in classes_with_images]
    if empty_classes:
        raise ValueError(f"Class folders contain no valid images: {empty_classes}")

    return rows, invalid


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=["image_path", "class_name"])
        writer.writeheader()
        writer.writerows(rows)


def create_splits(data_dir: Path, output_dir: Path, seed: int) -> dict:
    rows, invalid = collect_images(data_dir)
    labels = [row["class_name"] for row in rows]
    indices = list(range(len(rows)))

    # Hold out test first, then split the remaining 85% into 70% train / 15% validation.
    train_val_ids, test_ids = train_test_split(
        indices, test_size=0.15, random_state=seed, stratify=labels
    )
    train_val_labels = [labels[index] for index in train_val_ids]
    train_ids, val_ids = train_test_split(
        train_val_ids,
        test_size=(0.15 / 0.85),
        random_state=seed,
        stratify=train_val_labels,
    )

    splits = {
        "train": [rows[index] for index in train_ids],
        "validation": [rows[index] for index in val_ids],
        "test": [rows[index] for index in test_ids],
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    for split_name, split_rows in splits.items():
        write_csv(output_dir / f"{split_name}.csv", split_rows)

    all_rows = []
    for split_name, split_rows in splits.items():
        all_rows.extend({**row, "split": split_name} for row in split_rows)

    with (output_dir / "all_splits.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(
            file, fieldnames=["image_path", "class_name", "split"]
        )
        writer.writeheader()
        writer.writerows(all_rows)

    class_names = sorted(set(labels))
    counts = {
        split_name: dict(sorted(Counter(row["class_name"] for row in split_rows).items()))
        for split_name, split_rows in splits.items()
    }

    summary = {
        "dataset_directory": str(data_dir),
        "manifest_directory": str(output_dir),
        "seed": seed,
        "total_valid_images": len(rows),
        "invalid_images_skipped": len(invalid),
        "class_count": len(class_names),
        "classes": class_names,
        "split_counts": {name: len(value) for name, value in splits.items()},
        "class_counts_by_split": counts,
        "split_percentages": {
            name: round(len(value) / len(rows) * 100, 2)
            for name, value in splits.items()
        },
        "path_note": "image_path values are relative to dataset_directory",
        "limitations": [
            "Random stratified image-level split; not a field validation result.",
            "Near-duplicate or source-group leakage has not yet been ruled out.",
            "Keep the test manifest untouched until final evaluation."
        ],
    }

    with (output_dir / "split_summary.json").open("w", encoding="utf-8") as file:
        json.dump(summary, file, indent=2)

    print("\nBHOOMI AI - STRATIFIED DATASET SPLIT")
    print("=" * 58)
    print(f"Valid images: {len(rows)}")
    print(f"Classes: {len(class_names)}")
    print(f"Invalid images skipped: {len(invalid)}")
    for name, split_rows in splits.items():
        print(f"{name:10s}: {len(split_rows):5d} ({len(split_rows) / len(rows) * 100:5.2f}%)")
    print("\nPer-class split counts:")
    for class_name in class_names:
        print(
            f"{class_name}: "
            f"train={counts['train'].get(class_name, 0)}, "
            f"validation={counts['validation'].get(class_name, 0)}, "
            f"test={counts['test'].get(class_name, 0)}"
        )
    print(f"\nManifests saved to: {output_dir.resolve()}")
    print("Files: train.csv, validation.csv, test.csv, all_splits.csv, split_summary.json")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("data/processed/tomato_10class"),
        help="ImageFolder dataset directory",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/processed/tomato_10class_manifests"),
        help="Directory for CSV manifests and split summary",
    )
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    if args.seed < 0:
        parser.error("--seed must be non-negative")
    create_splits(args.data_dir, args.output_dir, args.seed)


if __name__ == "__main__":
    main()
