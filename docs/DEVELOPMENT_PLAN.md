# BHOOMI AI development plan

## Phase 1 — Reliable ML foundation
- [x] Python package and dependency baseline
- [x] Safe image decoding and dimensions / upload limits
- [x] EfficientNet-B0 model factory
- [x] Reproducible stratified train/validation split
- [x] Training checkpoint format
- [x] Per-class evaluation report
- [x] API refuses predictions without a trained checkpoint
- [x] Initial image-validation tests

## Phase 2 — Dataset governance and baseline
- Acquire tomato image datasets from original sources.
- Record source URL, license, retrieval date, class mapping, and file hashes.
- Keep source datasets out of Git.
- Detect corrupt files and exact/near duplicates.
- Create a source-aware train/validation/test manifest.
- Train a baseline before tuning larger architectures.

## Phase 3 — Reliability and explainability
- Evaluate on a field-style dataset not used for training.
- Report per-class precision, recall, F1, confusion matrix, and confidence intervals.
- Calibrate probabilities on validation data.
- Add unknown-input / out-of-distribution rejection and failure analysis.
- Add Grad-CAM explanations with clear limitations.

## Phase 4 — Product experience
- Farmer-oriented React interface and accessible upload flow.
- Scan history with consent and retention controls.
- Evidence-backed guidance reviewed by agricultural specialists.
- Localization and low-bandwidth support.

## Phase 5 — Production readiness
- Authentication, rate limits, secure storage, observability, and deployment.
- Security, privacy, load, and abuse testing.
- Pilot with consent and expert oversight before real-world claims.

## Release gates
A model must not be described as field-ready based only on a random split of controlled PlantVillage images. No disease guidance or severity score should be presented as validated until independently reviewed and evaluated on representative field data.
