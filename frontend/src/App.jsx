import { useEffect, useRef, useState } from "react";
import {
  Activity, AlertCircle, ArrowUpRight, CheckCircle2, Download,
  FileText, Home, Image as ImageIcon, Info, Leaf, LoaderCircle,
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
  const [page, setPage] = useState("home");
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
      setPage("results");
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to BHOOMI AI backend. Please wait for the server and try again."
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
  const heatmapUrl = result?.heatmap_url ? `${API_BASE}${result.heatmap_url}` : "";
  const overlayUrl = result?.overlay_url ? `${API_BASE}${result.overlay_url}` : "";

  function Navigation() {
    return (
      <nav className="page-nav" aria-label="Main navigation">
        <button className={page === "home" ? "nav-link active" : "nav-link"} onClick={() => setPage("home")}>
          <Home size={15} /> Home
        </button>
        <button className={page === "analyze" ? "nav-link active" : "nav-link"} onClick={() => setPage("analyze")}>
          <ScanSearch size={15} /> Analyze
        </button>
        <button className={page === "results" ? "nav-link active" : "nav-link"} onClick={() => setPage("results")}>
          <FileText size={15} /> Results
        </button>
      </nav>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage("home"); }}>
          <span className="brand-mark"><Sprout size={23} /></span>
          <span>BHOOMI<span className="brand-ai"> AI</span>
            <small>PLANT HEALTH INTELLIGENCE</small>
          </span>
        </a>
        <Navigation />
        <div className="topbar-right">
          <span className={`connection ${backendOnline ? "online" : "offline"}`}>
            {backendOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
            {backendOnline ? "SYSTEM ONLINE" : "BACKEND OFFLINE"}
          </span>
          <span className="version">MODEL · EFFICIENTNET-B0</span>
        </div>
      </header>

      {page === "home" && (
        <section className="home-page">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span /> B.TECH PROJECT · AI & COMPUTER VISION</div>
              <h1>See the signs.<br /><em>Protect the harvest.</em></h1>
              <p>
                BHOOMI AI is a student-built crop health project that uses an
                EfficientNet-B0 deep learning model to analyze tomato leaf images.
              </p>
              <div className="hero-points">
                <span><ShieldCheck size={16} /> 10 tomato classes</span>
                <span><ScanSearch size={16} /> Grad-CAM explainability</span>
                <span><Activity size={16} /> Confidence scoring</span>
              </div>
              <button className="primary-action" onClick={() => setPage("analyze")}>
                Start leaf analysis <ArrowUpRight size={17} />
              </button>
            </div>
            <div className="hero-art">
              <div className="art-orbit orbit-one" />
              <div className="art-orbit orbit-two" />
              <div className="art-leaf"><Leaf size={112} strokeWidth={1} /></div>
              <div className="art-tag"><span className="pulse-dot" /> AI VISION ACTIVE</div>
              <div className="art-caption">STUDENT PROJECT<br />MODEL · EFFICIENTNET-B0</div>
            </div>
          </section>

          <section className="home-info">
            <div className="section-heading">
              <div><span className="section-kicker">ABOUT THE PROJECT</span><h2>What BHOOMI AI does</h2></div>
            </div>
            <div className="info-grid">
              <article className="info-card">
                <span className="info-icon"><ImageIcon size={21} /></span>
                <h3>1. Upload an image</h3>
                <p>Select a clear tomato leaf photo in JPG, PNG or WEBP format.</p>
              </article>
              <article className="info-card">
                <span className="info-icon"><Activity size={21} /></span>
                <h3>2. AI prediction</h3>
                <p>The trained model predicts the most likely class and shows confidence scores.</p>
              </article>
              <article className="info-card">
                <span className="info-icon"><ScanSearch size={21} /></span>
                <h3>3. Visual explanation</h3>
                <p>Grad-CAM images show the regions that influenced the model prediction.</p>
              </article>
            </div>
            <p className="project-note">
              This is an educational prototype. Model predictions are experimental and should not replace advice from an agricultural expert.
            </p>
          </section>
        </section>
      )}

      {page === "analyze" && (
        <section className="page-content">
          <div className="page-title">
            <span className="section-kicker">PAGE 02 · IMAGE ANALYSIS</span>
            <h1>Analyze a tomato leaf</h1>
            <p>Upload a clear leaf image and run the trained EfficientNet-B0 model.</p>
          </div>
          <section className="panel upload-panel single-panel">
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
                <button className="remove-image" onClick={reset} aria-label="Remove image"><X size={17} /></button>
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

            <button className="analyze-button" onClick={analyzeImage} disabled={!file || loading}>
              {loading
                ? <><LoaderCircle className="spin" size={19} /> Analyzing leaf...</>
                : <><ScanSearch size={19} /> Analyze with BHOOMI AI <ArrowUpRight size={18} /></>}
            </button>
            <div className="upload-footnote"><Info size={14} /> Use a well-lit image with the leaf clearly visible.</div>
          </section>
          <div className="page-help">
            <ShieldCheck size={16} /> Your image is sent to the BHOOMI AI backend for analysis.
          </div>
        </section>
      )}

      {page === "results" && (
        <section className="page-content results-page">
          <div className="page-title">
            <span className="section-kicker">PAGE 03 · MODEL OUTPUT</span>
            <h1>Diagnosis results</h1>
            <p>Prediction, confidence scores and Grad-CAM visual explanations.</p>
          </div>

          {!result ? (
            <section className="panel no-results">
              <div className="empty-icon"><Activity size={31} /></div>
              <h3>No analysis yet</h3>
              <p>Upload a tomato leaf image first. Your prediction and explanation will appear here.</p>
              <button className="primary-action" onClick={() => setPage("analyze")}>Go to image analysis <ArrowUpRight size={17} /></button>
            </section>
          ) : (
            <>
              <section className="panel report-panel">
                <div className="panel-heading">
                  <div className="step-number">02</div>
                  <div><h3>AI diagnosis report</h3><p>Prediction generated by EfficientNet-B0</p></div>
                  <span className="report-status"><CheckCircle2 size={14} /> ANALYSIS COMPLETE</span>
                </div>
                <div className="diagnosis">
                  <div className="diagnosis-status">
                    <span><CheckCircle2 size={15} /> MOST LIKELY CONDITION</span>
                    <span className="model-label">EFFICIENTNET-B0</span>
                  </div>
                  <div className="prediction-name">{formatClass(prediction)}</div>
                  <p className="prediction-subtitle">
                    {result.status === "prediction"
                      ? "Most likely condition identified by the model."
                      : "Low-confidence result. Expert review is recommended."}
                  </p>
                  <div className="confidence-row"><span>Model confidence</span><strong>{confidence}%</strong></div>
                  <div className="confidence-track"><span style={{ width: `${confidence}%` }} /></div>
                  <div className="top-predictions">
                    <h4>TOP 3 PREDICTIONS</h4>
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
                  <button className="download-button" onClick={downloadReport}><Download size={16} /> Download analysis report</button>
                </div>
              </section>

              <section className="explain-section results-explain">
                <div className="section-heading">
                  <div><span className="section-kicker">MODEL EXPLAINABILITY</span><h2>Grad-CAM visual explanation</h2></div>
                </div>
                <p className="explain-intro">
                  These images highlight regions that influenced the model's prediction. They are explanatory aids, not proof of a disease.
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
                    <div><strong>Grad-CAM overlay</strong><span>Heatmap over original image</span></div>
                  </div>
                </div>
              </section>
            </>
          )}
        </section>
      )}

      <footer className="footer">
        <div className="footer-brand"><Sprout size={18} /> BHOOMI AI</div>
        <span>Student project · AI-assisted tomato leaf analysis</span>
        <span>EXPERIMENTAL · NOT A SUBSTITUTE FOR EXPERT DIAGNOSIS</span>
      </footer>
    </main>
  );
}

export default App;
