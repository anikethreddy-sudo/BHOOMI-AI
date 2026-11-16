import { useEffect, useRef, useState } from "react";
import {
  Activity, AlertCircle, ArrowUpRight, CheckCircle2, Download,
  Image as ImageIcon, Info, Leaf, LoaderCircle, RotateCcw,
  ScanSearch, ShieldCheck, Sprout, UploadCloud, Wifi, WifiOff, X
} from "lucide-react";
import "./App.css";

const API_BASE = "https://bhoomi-ai-backend-ogro.onrender.com";

function formatClass(name = "") {
  return name
    .replace(/^Tomato___/, "")
    .replaceAll("_", " ")
    .replace("Two spotted spider mite", "Two-spotted spider mite");
}

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backendOnline, setBackendOnline] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/health`)
      .then((response) => {
        if (!response.ok) throw new Error("Backend unavailable");
        return response.json();
      })
      .then(() => {
        if (active) setBackendOnline(true);
      })
      .catch(() => {
        if (active) setBackendOnline(false);
      });

    return () => { active = false; };
  }, []);

  function selectFile(selected) {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("Image must be smaller than 10 MB.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult(null);
    setError("");
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    setResult(null);
    setError("");
    setLoading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function analyzeImage() {
    if (!file) {
      setError("Choose a tomato leaf image first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE}/api/v1/predict`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Analysis failed. Please try again.");
      }

      setResult(data);
      setBackendOnline(true);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to BHOOMI AI backend. Start the FastAPI server and try again."
          : err.message
      );
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  }

  function downloadReport() {
    if (!result) return;
    const report = {
      project: "BHOOMI AI",
      generated_at: new Date().toISOString(),
      image: file?.name,
      ...result
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bhoomi-ai-report.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  const prediction = result?.prediction || result?.candidate_prediction;
  const confidence = result ? (result.confidence * 100).toFixed(2) : "0.00";
  const heatmapUrl = result?.heatmap_url
    ? `${API_BASE}${result.heatmap_url}` : "";
  const overlayUrl = result?.overlay_url
    ? `${API_BASE}${result.overlay_url}` : "";

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark"><Sprout size={23} /></span>
          <span>BHOOMI<span className="brand-ai"> AI</span>
            <small>PLANT HEALTH INTELLIGENCE</small>
          </span>
        </a>
        <div className="topbar-right">
          <span className={`connection ${backendOnline ? "online" : "offline"}`}>
            {backendOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
            {backendOnline ? "SYSTEM ONLINE" : "BACKEND OFFLINE"}
          </span>
          <span className="version">MODEL · EFFICIENTNET-B0</span>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span /> AI-POWERED CROP HEALTH ANALYSIS</div>
          <h1>See the signs.<br /><em>Protect the harvest.</em></h1>
          <p>
            Upload a tomato leaf image and let BHOOMI AI analyze its condition
            using deep learning and visual explainability.
          </p>
          <div className="hero-points">
            <span><ShieldCheck size={16} /> 10 tomato classes</span>
            <span><ScanSearch size={16} /> Grad-CAM explainability</span>
            <span><Activity size={16} /> Confidence scoring</span>
          </div>
        </div>
        <div className="hero-art">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-leaf"><Leaf size={112} strokeWidth={1} /></div>
          <div className="art-tag"><span className="pulse-dot" /> AI VISION ACTIVE</div>
          <div className="art-caption">PRECISION<br />IN EVERY PIXEL</div>
        </div>
      </section>

      <section className="workspace">
        <div className="section-heading">
          <div>
            <span className="section-kicker">ANALYSIS WORKSPACE</span>
            <h2>Tomato leaf diagnosis</h2>
          </div>
          <span className="secure-note"><ShieldCheck size={15} /> Secure image processing</span>
        </div>

        <div className="workspace-grid">
          <section className="panel upload-panel">
            <div className="panel-heading">
              <div className="step-number">01</div>
              <div><h3>Upload leaf image</h3><p>Choose a clear photo of a tomato leaf</p></div>
            </div>

            {!preview ? (
              <button
                className="dropzone"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  selectFile(event.dataTransfer.files?.[0]);
                }}
                type="button"
              >
                <span className="upload-icon"><UploadCloud size={29} /></span>
                <strong>Drop your image here</strong>
                <span>or <u>browse files</u> from your device</span>
                <small>JPG, PNG or WEBP · Maximum 10 MB</small>
              </button>
            ) : (
              <div className="preview-box">
                <img src={preview} alt="Selected tomato leaf" />
                <button className="remove-image" onClick={reset} aria-label="Remove image">
                  <X size={17} />
                </button>
                <div className="file-label"><ImageIcon size={15} /> {file?.name}</div>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => selectFile(event.target.files?.[0])}
            />

            {error && <div className="error-message"><AlertCircle size={17} /> {error}</div>}

            <button
              className="analyze-button"
              onClick={analyzeImage}
              disabled={!file || loading}
            >
              {loading
                ? <><LoaderCircle className="spin" size={19} /> Analyzing leaf...</>
                : <><ScanSearch size={19} /> Analyze with BHOOMI AI <ArrowUpRight size={18} /></>}
            </button>
            <div className="upload-footnote"><Info size={14} /> Use a well-lit image with the leaf clearly visible.</div>
          </section>

          <section className="panel result-panel">
            <div className="panel-heading">
              <div className="step-number">02</div>
              <div><h3>Diagnosis report</h3><p>AI prediction and confidence analysis</p></div>
            </div>

            {!result && !loading && (
              <div className="empty-result">
                <div className="empty-icon"><Activity size={31} /></div>
                <strong>Your results will appear here</strong>
                <p>Upload a tomato leaf image and start the analysis to see its predicted condition.</p>
                <div className="empty-line"><span /><span /><span /></div>
              </div>
            )}

            {loading && (
              <div className="loading-result">
                <div className="loading-ring"><LoaderCircle size={35} /></div>
                <strong>Analyzing your leaf</strong>
                <p>Running EfficientNet-B0 inference and generating Grad-CAM explanations.</p>
              </div>
            )}

            {result && (
              <div className="diagnosis">
                <div className="diagnosis-status">
                  <span><CheckCircle2 size={15} /> ANALYSIS COMPLETE</span>
                  <span className="model-label">EFFICIENTNET-B0</span>
                </div>
                <div className="prediction-name">{formatClass(prediction)}</div>
                <p className="prediction-subtitle">
                  {result.status === "prediction"
                    ? "Most likely condition identified by the model."
                    : "Low-confidence result. Expert review is recommended."}
                </p>
                <div className="confidence-row">
                  <span>Model confidence</span>
                  <strong>{confidence}%</strong>
                </div>
                <div className="confidence-track"><span style={{ width: `${confidence}%` }} /></div>

                <div className="top-predictions">
                  <h4>TOP PREDICTIONS</h4>
                  {result.top_k?.slice(0, 3).map((item, index) => (
                    <div className="prediction-item" key={item.class_name}>
                      <span className="prediction-rank">0{index + 1}</span>
                      <span className="prediction-class">{formatClass(item.class_name)}</span>
                      <strong>{(item.probability * 100).toFixed(1)}%</strong>
                    </div>
                  ))}
                </div>
                {result.requires_expert_review && (
                  <div className="review-warning"><AlertCircle size={16} /> Expert review recommended for this result.</div>
                )}
                <button className="download-button" onClick={downloadReport}>
                  <Download size={16} /> Download analysis report
                </button>
              </div>
            )}
          </section>
        </div>
      </section>

      {result && (
        <section className="explain-section">
          <div className="section-heading">
            <div><span className="section-kicker">MODEL EXPLAINABILITY</span><h2>See what the AI sees</h2></div>
            <span className="secure-note">GRAD-CAM VISUALIZATION</span>
          </div>
          <p className="explain-intro">
            These visualizations highlight image regions that influenced the model's prediction.
            They are explanatory aids, not proof of a disease.
          </p>
          <div className="visual-grid">
            <div className="visual-card">
              <div className="visual-image">{preview && <img src={preview} alt="Original leaf" />}</div>
              <div><strong>Original image</strong><span>Uploaded leaf photograph</span></div>
            </div>
            <div className="visual-card">
              <div className="visual-image">{heatmapUrl && <img src={heatmapUrl} alt="Grad-CAM heatmap" />}</div>
              <div><strong>Grad-CAM heatmap</strong><span>Model activation regions</span></div>
            </div>
            <div className="visual-card">
              <div className="visual-image">{overlayUrl && <img src={overlayUrl} alt="Grad-CAM overlay" />}</div>
              <div><strong>Visual explanation</strong><span>Heatmap over original image</span></div>
            </div>
          </div>
        </section>
      )}

      <footer className="footer">
        <div className="footer-brand"><Sprout size={18} /> BHOOMI AI</div>
        <span>AI-assisted tomato leaf disease analysis</span>
        <span>EXPERIMENTAL · NOT A SUBSTITUTE FOR EXPERT DIAGNOSIS</span>
      </footer>
    </main>
  );
}

export default App;

