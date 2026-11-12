"""Train an EfficientNet-B0 tomato classifier."""
from __future__ import annotations
import argparse
from pathlib import Path
import torch
from torch import nn
from tqdm import tqdm
from .data import build_dataloaders
from .model import build_model

def run_training(data_dir: Path, output: Path, epochs: int, batch_size: int, seed: int):
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    train_loader, val_loader, classes = build_dataloaders(
        data_dir, batch_size=batch_size, seed=seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_model(len(classes), pretrained=False).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4, weight_decay=1e-4)
    criterion = nn.CrossEntropyLoss()
    best_accuracy = -1.0
    output.parent.mkdir(parents=True, exist_ok=True)
    for epoch in range(epochs):
        model.train()
        loss_sum = 0.0
        seen = 0
        for images, labels in tqdm(train_loader, desc=f"Epoch {epoch + 1}/{epochs}"):
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(images), labels)
            loss.backward()
            optimizer.step()
            loss_sum += loss.item() * labels.size(0)
            seen += labels.size(0)
        model.eval()
        correct = total = 0
        with torch.inference_mode():
            for images, labels in val_loader:
                labels = labels.to(device)
                predictions = model(images.to(device)).argmax(dim=1)
                correct += int((predictions == labels).sum().item())
                total += labels.size(0)
        accuracy = correct / total if total else 0.0
        print(f"epoch={epoch + 1} train_loss={loss_sum / max(seen, 1):.4f} validation_accuracy={accuracy:.4f}")
        if accuracy > best_accuracy:
            best_accuracy = accuracy
            torch.save({"architecture": "efficientnet_b0", "classes": classes,
                        "model_state_dict": model.state_dict(),
                        "validation_accuracy": best_accuracy, "seed": seed}, output)
            print(f"Saved best checkpoint: {output}")
    print("Training complete. Validation metrics are development metrics only.")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("models/tomato_efficientnet_b0.pth"))
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1:
        parser.error("--epochs and --batch-size must be positive")
    run_training(args.data_dir, args.output, args.epochs, args.batch_size, args.seed)

if __name__ == "__main__":
    main()
