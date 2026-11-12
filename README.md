# BHOOMI AI
### Intelligence for Every Acre.

BHOOMI AI is an agricultural decision-support project exploring how computer vision can help identify **potential tomato leaf diseases** from photographs. It combines image-quality checks, deep-learning classification, uncertainty-aware responses, and explainability.

> **Important:** This is an experimental software project, not a validated agricultural diagnostic product. Predictions are not definitive diagnoses or pesticide prescriptions. Field validation and qualified agricultural review are required before real-world use.

## Development status

- [x] Repository and Python project foundation
- [x] Image validation and preprocessing module
- [x] EfficientNet-B0 model definition
- [x] Training and evaluation scripts
- [x] FastAPI inference interface with explicit model-unavailable handling
- [x] Initial automated tests
- [ ] Dataset acquisition, license review, and data manifest
- [ ] Baseline training and held-out evaluation
- [ ] Field-image validation and calibration
- [ ] Grad-CAM explanations
- [ ] Frontend, persistence, and deployment

Checked items indicate code has been added; they do not imply a trained or field-validated model.

## Initial scope

The first experiment targets ten tomato categories commonly represented in PlantVillage: bacterial spot, early blight, late blight, leaf mold, Septoria leaf spot, spider mites, target spot, Tomato Yellow Leaf Curl Virus, tomato mosaic virus, and healthy.

Exact class names are read from dataset folders and saved in the checkpoint. Do not mix incompatible label taxonomies.

## Architecture

```text
Leaf photograph
  -> image decoding and validation
  -> resize and normalization
  -> EfficientNet-B0 classifier
  -> confidence threshold and top-k probabilities
  -> decision-support response or expert-review warning
```

A softmax score is not proof that a prediction is correct. Calibration and out-of-distribution testing remain required.

## Repository layout

```text
BHOOMI-AI/
├── backend/app/       # FastAPI application
├── data/              # Local datasets (not committed)
├── docs/              # Design and dataset notes
├── models/            # Local checkpoints (not committed)
├── notebooks/         # Experiments
├── src/bhoomi/        # Reusable ML package
├── tests/             # Automated tests
├── artifacts/         # Local reports (not committed)
├── requirements.txt
└── README.md
```

## Windows setup

Use Python 3.11 in a virtual environment:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

Install PyTorch for your machine using the official selector: https://pytorch.org/get-started/locally/

Then install the remaining dependencies:

```powershell
python -m pip install -r requirements.txt
python -m pytest -q
```

## Dataset layout

The training script expects an ImageFolder-style directory with one subfolder per class:

```text
data/processed/tomato/
├── Tomato___Bacterial_spot/
├── Tomato___Early_blight/
├── Tomato___healthy/
└── ... remaining class folders
```

Keep original downloads under `data/raw/`. Review dataset terms and attribution requirements before redistribution or commercial use. Avoid train/test leakage from duplicates or images originating from the same source.

## Train and evaluate

```powershell
python -m bhoomi.train --data-dir data/processed/tomato --epochs 5 --batch-size 16
python -m bhoomi.evaluate --data-dir data/processed/tomato --checkpoint models/tomato_efficientnet_b0.pth
```

The training script creates a reproducible stratified train/validation split. This is a development baseline, not a substitute for a separately collected field test set.

## Run the API

```powershell
uvicorn backend.app.main:app --reload
```

API documentation: http://127.0.0.1:8000/docs

Set `BHOOMI_MODEL_PATH` to a locally trained checkpoint to enable predictions. Without a checkpoint, health reports inference unavailable and prediction returns HTTP 503.

## Evaluation principles

Report per-class precision, recall, F1-score, support, and confusion matrix. Evaluate on field-style images from a source not used for training. Calibrate confidence and test unknown/non-leaf inputs before considering deployment.

## Safety and privacy

- Never commit API keys, passwords, private images, or raw datasets.
- Treat uploaded images as untrusted input.
- Keep file-size and image-dimension limits enabled.
- Do not provide pesticide dosage or treatment prescriptions from an unvalidated classifier.
- Route uncertain or unsupported cases to a qualified agricultural expert.

Python · PyTorch · Torchvision · Pillow · OpenCV · scikit-learn · FastAPI · pytest
