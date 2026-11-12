"""EfficientNet-B0 classifier factory."""
from __future__ import annotations
import torch.nn as nn
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0

def build_model(num_classes: int, pretrained: bool = False) -> nn.Module:
    """Build EfficientNet-B0 with a task-specific classification head."""
    if num_classes < 2:
        raise ValueError("num_classes must be at least 2")
    weights = EfficientNet_B0_Weights.DEFAULT if pretrained else None
    model = efficientnet_b0(weights=weights)
    features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(features, num_classes)
    return model
