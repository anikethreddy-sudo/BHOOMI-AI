"""Dataset loading and deterministic stratified splitting."""
from __future__ import annotations
from pathlib import Path
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms

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

def build_dataloaders(data_dir: str | Path, batch_size: int = 16,
                      validation_fraction: float = 0.2, seed: int = 42,
                      num_workers: int = 0):
    """Create train/validation loaders with stratification and stable labels."""
    data_dir = Path(data_dir)
    if not data_dir.is_dir():
        raise FileNotFoundError(f"Dataset directory not found: {data_dir}")
    base = datasets.ImageFolder(data_dir)
    if len(base.classes) < 2:
        raise ValueError("Dataset must contain at least two class folders.")
    indices = list(range(len(base)))
    train_ids, val_ids = train_test_split(
        indices, test_size=validation_fraction, random_state=seed,
        stratify=base.targets
    )
    train_set = datasets.ImageFolder(data_dir, transform=build_transforms(True))
    val_set = datasets.ImageFolder(data_dir, transform=build_transforms(False))
    train_loader = DataLoader(Subset(train_set, train_ids), batch_size=batch_size,
                              shuffle=True, num_workers=num_workers)
    val_loader = DataLoader(Subset(val_set, val_ids), batch_size=batch_size,
                            shuffle=False, num_workers=num_workers)
    return train_loader, val_loader, base.classes
