"""Create reproducible, stratified train/validation/test manifests.

Run from the repository root:
    python -m src.bhoomi.prepare_splits
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image
from sklearn.model_selection import train_test_split

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_csv(path: Path, rows: list[dict[str, str]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def collect_images(data_dir: Path) -> tuple[list[dict[str, str]], list[dict[str, str]], int]:
    if not data_dir.is_dir():
        raise FileNotFoundError(f"Dataset directory not found: {data_dir}")

    class_dirs = sorted(
        path for path in data_dir.iterdir()
        if path.is_dir() and any(
            child.is_file() and child.suffix.lower() in IMAGE_EXTENSIONS
            for child in path.rglob("*")
        )
    )
    if len(class_dirs) < 2:
        raise ValueError(f"Expected at least two class folders in {data_dir}")

    by_hash: dict[str, list[dict[str, str]]] = defaultdict(list)
    invalid: list[dict[str, str]] = []

    for class_dir in class_dirs:
        for image_path in sorted(class_dir.rglob("*")):
            if not image_path.is_file() or image_path.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            try:
                with Image.open(image_path) as image:
                    image.verify()
                image_hash = sha256_file(image_path)
            except Exception as exc:
                invalid.append({
                    "image_path": image_path.relative_to(data_dir).as_posix(),
                    "reason": str(exc)[:200],
                })
                continue

            by_hash[image_hash].append({
                "image_path": image_path.relative_to(data_dir).as_posix(),
                "class_name": class_dir.name,
                "sha256": image_hash,
            })

    unique_rows: list[dict[str, str]] = []
    duplicate_rows: list[dict[str, str]] = []
    for image_hash, copies in sorted(by_hash.items()):
        labels = {row["class_name"] for row in copies}
        if len(labels) > 1:
            for row in copies:
                duplicate_rows.append({
                    "sha256": image_hash,
                    "class_name": row["class_name"],
                    "image_path": row["image_path"],
                    "action": "excluded_conflicting_labels",
                })
            continue

        unique_rows.append(copies[0])
        for row in copies[1:]:
            duplicate_rows.append({
                "sha256": image_hash,
                "class_name": row["class_name"],
                "image_path": row["image_path"],
                "action": "duplicate_not_included",
            })

    return unique_rows, duplicate_rows, len(invalid), invalid


def create_splits(data_dir: Path, output_dir: Path, seed: int) -> dict:
    rows, duplicates, invalid_count, invalid_rows = collect_images(data_dir)
    if not rows:
        raise ValueError("No usable, unique images remain after validation.")

    labels = [row["class_name"] for row in rows]
    per_class = Counter(labels)
    too_small = {name: count for name, count in per_class.items() if count < 3}
    if too_small:
        raise ValueError(f"Each class needs at least 3 unique images: {too_small}")

    indices = list(range(len(rows)))
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
    fields = ["image_path", "class_name", "sha256"]
    for name, split_rows in splits.items():
        write_csv(output_dir / f"{name}.csv", split_rows, fields)

    combined = [
        {**row, "split": split_name}
        for split_name, split_rows in splits.items()
        for row in split_rows
    ]
    write_csv(output_dir / "all_splits.csv", combined, fields + ["split"])
    write_csv(
        output_dir / "duplicate_report.csv",
        duplicates,
        ["sha256", "class_name", "image_path", "action"],
    )
    write_csv(
        output_dir / "invalid_images.csv",
        invalid_rows,
        ["image_path", "reason"],
    )

    class_names = sorted(per_class)
    counts = {
        name: dict(sorted(Counter(row["class_name"] for row in split_rows).items()))
        for name, split_rows in splits.items()
    }
    total = len(rows)
    summary = {
        "dataset_directory": str(data_dir),
        "manifest_directory": str(output_dir),
        "seed": seed,
        "total_unique_valid_images": total,
        "invalid_images_skipped": invalid_count,
        "duplicate_images_not_included": sum(
            row["action"] == "duplicate_not_included" for row in duplicates
        ),
        "conflicting_label_images_excluded": sum(
            row["action"] == "excluded_conflicting_labels" for row in duplicates
        ),
        "class_count": len(class_names),
        "classes": class_names,
        "split_counts": {name: len(value) for name, value in splits.items()},
        "class_counts_by_split": counts,
        "split_percentages": {
            name: round(len(value) / total * 100, 2)
            for name, value in splits.items()
        },
        "path_note": "image_path values are relative to dataset_directory",
        "limitations": [
            "Exact SHA-256 duplicates are handled; near-duplicates are not detected.",
            "This is an image-level PlantVillage split, not field validation.",
            "Keep the test manifest untouched until final evaluation.",
        ],
    }
    with (output_dir / "split_summary.json").open("w", encoding="utf-8") as file:
        json.dump(summary, file, indent=2)

    print("\nBHOOMI AI - STRATIFIED DATASET SPLIT")
    print("=" * 58)
    print(f"Unique valid images: {total}")
    print(f"Classes: {len(class_names)}")
    print(f"Invalid images skipped: {invalid_count}")
    print(f"Exact duplicates not included: {summary['duplicate_images_not_included']}")
    print(f"Conflicting-label images excluded: {summary['conflicting_label_images_excluded']}")
    for name, split_rows in splits.items():
        print(f"{name:10s}: {len(split_rows):5d} ({len(split_rows) / total * 100:5.2f}%)")
    print("\nPer-class split counts:")
    for class_name in class_names:
        print(
            f"{class_name}: "
            f"train={counts['train'].get(class_name, 0)}, "
            f"validation={counts['validation'].get(class_name, 0)}, "
            f"test={counts['test'].get(class_name, 0)}"
        )
    print(f"\nManifests saved to: {output_dir.resolve()}")
    print("Files: train.csv, validation.csv, test.csv, all_splits.csv, split_summary.json, duplicate_report.csv, invalid_images.csv")
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
