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

const DISEASE_GUIDANCE = [
  {
    match: ["healthy"],
    title: "Healthy leaf",
    precautions: ["Keep monitoring leaves weekly for new spots, curling or insects.", "Water near the soil and avoid keeping foliage wet overnight.", "Use clean tools and maintain balanced irrigation and nutrition."],
    treatment: "No pesticide is needed for a healthy result. Avoid preventive spraying unless a local crop adviser identifies a real risk.",
    type: "healthy"
  },
  {
    match: ["early blight"],
    title: "Early blight",
    precautions: ["Remove badly affected lower leaves and crop debris; do not compost diseased material.", "Rotate away from tomato and other solanaceous crops; avoid overhead watering.", "Improve spacing and airflow so leaves dry quickly."],
    treatment: "TNAU lists mancozeb, azoxystrobin and other fungicide options for tomato early blight. These are reference active ingredients only; use a product only if its current Indian label specifically permits tomato and this disease.",
    source: "https://agritech.tnau.ac.in/crop_protection/tomato_diseases_2.html"
  },
  {
    match: ["late blight"],
    title: "Late blight",
    precautions: ["Remove and safely destroy infected leaves and fruit promptly.", "Avoid overhead irrigation; ensure good drainage and airflow.", "Scout frequently during cool, wet or foggy weather. Seek local advice quickly if lesions spread rapidly."],
    treatment: "TNAU lists cyazofamid, mancozeb and other fungicide options for tomato late blight. Confirm the exact formulation and current tomato label before any application.",
    source: "https://agritech.tnau.ac.in/crop_protection/tomato_diseases_8.html"
  },
  {
    match: ["septoria"],
    title: "Septoria leaf spot",
    precautions: ["Remove infected lower leaves and plant debris.", "Use drip or soil-level watering and avoid working among wet plants.", "Rotate crops and keep weeds under control."],
    treatment: "The Government of India's tomato IPM package lists mancozeb for Septoria leaf spot. Check current registration and the product label for tomato before use.",
    source: "https://ppqs.gov.in/sites/default/files/tomato.pdf"
  },
  {
    match: ["spider mite", "two spotted"],
    title: "Two-spotted spider mite",
    precautions: ["Check leaf undersides for mites, eggs and fine webbing.", "Remove heavily infested leaves and reduce dust and plant stress.", "Conserve predatory mites and other beneficial insects; avoid unnecessary broad-spectrum insecticides."],
    treatment: "The Government of India's tomato IPM package lists fenazaquin and spiromesifen for red spider mites. These are miticides, not general insecticides; verify the current tomato label and get local advice before use.",
    source: "https://ppqs.gov.in/sites/default/files/tomato.pdf"
  },
  {
    match: ["yellow leaf curl", "leaf curl virus"],
    title: "Tomato yellow leaf curl virus",
    precautions: ["There is no pesticide that cures a virus-infected plant; remove and dispose of severely infected plants.", "Use healthy seedlings, insect-proof nursery protection and yellow sticky traps to monitor whiteflies.", "Remove nearby weed hosts and avoid moving infested seedlings between plots."],
    treatment: "Manage the whitefly vector, not the virus itself. TNAU describes sticky traps and vector management; use an insecticide only when whiteflies are confirmed and the current label specifically permits tomato and whitefly control.",
    source: "https://agritech.tnau.ac.in/crop_protection/tomato_diseases_6.html"
  },
  {
    match: ["mosaic virus", "tomato mosaic"],
    title: "Tomato mosaic virus",
    precautions: ["No pesticide cures an infected plant; remove and safely dispose of symptomatic plants.", "Wash hands and disinfect tools between plants; avoid handling plants when wet.", "Use certified disease-free seed and resistant varieties where available; control weeds and volunteer tomato plants."],
    treatment: "Do not spray fungicides or insecticides to cure a virus. Focus on sanitation and preventing mechanical spread; ask a local plant pathologist to confirm the diagnosis."
  },
  {
    match: ["bacterial spot"],
    title: "Bacterial spot",
    precautions: ["Use certified disease-free seed and healthy transplants.", "Avoid overhead irrigation and handling plants when wet; reduce splash between plants.", "Remove infected plant debris and disinfect tools between rows."],
    treatment: "Fungicides do not cure bacterial infection. Do not apply antibiotics or household mixtures. Ask a KVK/plant pathologist whether a locally registered copper-based product is appropriate for your crop and stage."
  },
  {
    match: ["leaf mold"],
    title: "Leaf mold",
    precautions: ["Improve ventilation and plant spacing; avoid dense, humid foliage.", "Water at soil level in the morning and remove infected lower leaves.", "Clean crop residues and keep greenhouse surfaces and tools clean."],
    treatment: "No automatic pesticide is recommended from an image prediction alone. Confirm the disease with a local horticulture officer and use only a fungicide whose current Indian label lists tomato and the confirmed disease."
  },
  {
    match: ["target spot"],
    title: "Target spot",
    precautions: ["Remove infected leaves and crop debris; avoid leaving diseased residues in the field.", "Use drip irrigation, good spacing and airflow to reduce leaf wetness.", "Rotate crops and monitor new growth after periods of rain."],
    treatment: "Target spot can resemble other leaf-spot diseases. Confirm the diagnosis before choosing a fungicide; follow only a current product label approved for tomato."
  }
];

function getDiseaseGuidance(prediction) {
  const name = String(prediction || "").toLowerCase().replaceAll("_", " ");
  return DISEASE_GUIDANCE.find((item) => item.match.some((term) => name.includes(term))) || {
    title: formatClass(prediction || "Uncertain result"),
    precautions: ["Check the whole plant, including leaf undersides, stems and nearby plants.", "Avoid overhead watering and remove fallen or severely affected leaves.", "Ask a local KVK or plant pathologist to confirm the disease before treatment."],
    treatment: "No pesticide can be safely selected from this AI result alone. Confirm the diagnosis and check current Indian registration and label directions before any spray."
  };
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

  function downloadJsonReport() {
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

  function downloadPdfReport() {
    if (!result) return;
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      setError("Allow pop-ups to create your PDF report.");
      return;
    }
    const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
    const topPredictions = (result.top_k || []).slice(0, 3).map((item, index) => `
      <tr><td>${index + 1}</td><td>${safe(formatClass(item.class_name))}</td>
      <td>${(Number(item.probability) * 100).toFixed(1)}%</td></tr>
    `).join("");
    const generated = new Date().toLocaleString();
    reportWindow.document.write(`
      <!doctype html><html><head><meta charset="utf-8"><title>BHOOMI AI Analysis Report</title>
      <style>
        *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#252a22;margin:36px;line-height:1.5}
        header{border-bottom:3px solid #a3d65c;padding-bottom:16px;margin-bottom:24px}
        h1{margin:0;font-size:28px}header p,.muted{color:#687064;font-size:12px}
        .result{background:#f3f7ee;border:1px solid #dce8cf;border-radius:10px;padding:18px;margin:18px 0}
        .label{font-size:11px;letter-spacing:1px;color:#687064;font-weight:bold}
        .prediction{font-size:23px;font-weight:bold;margin:6px 0}
        .confidence{font-size:18px;font-weight:bold;color:#527d24}
        table{width:100%;border-collapse:collapse;margin-top:10px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e5e8e1}
        th{background:#f5f6f2;font-size:12px}.images{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:14px}
        .images figure{margin:0}.images img{width:100%;max-height:260px;object-fit:contain;border:1px solid #e1e5dc;border-radius:8px}
        figcaption{font-size:12px;color:#687064;margin-top:5px}.note{margin-top:26px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#687064}
        @media print{body{margin:18mm}.result{break-inside:avoid}.images{break-inside:avoid}}
      </style></head><body>
      <header><h1>BHOOMI AI</h1><p>Tomato Leaf Analysis · EfficientNet-B0 · Generated ${safe(generated)}</p></header>
      <div class="result"><div class="label">MOST LIKELY CONDITION</div>
      <div class="prediction">${safe(formatClass(prediction))}</div>
      <div class="confidence">Model confidence: ${safe(confidence)}%</div>
      <p class="muted">Uploaded file: ${safe(file?.name || "Not available")}</p></div>
      <h2>Top predictions</h2><table><thead><tr><th>#</th><th>Predicted class</th><th>Probability</th></tr></thead>
      <tbody>${topPredictions || "<tr><td colspan='3'>No additional predictions returned.</td></tr>"}</tbody></table>
      <h2>Visual explanation</h2><div class="images">
      ${preview ? `<figure><img src="${safe(preview)}"><figcaption>Original leaf image</figcaption></figure>` : ""}
      ${heatmapUrl ? `<figure><img src="${safe(heatmapUrl)}"><figcaption>Grad-CAM heatmap</figcaption></figure>` : ""}
      ${overlayUrl ? `<figure><img src="${safe(overlayUrl)}"><figcaption>Grad-CAM overlay</figcaption></figure>` : ""}
      </div>
      <p class="note">Educational prototype only. Model predictions are experimental and should not replace diagnosis or advice from an agricultural expert. Grad-CAM visualizations are explanatory aids, not proof of disease.</p>
      </body></html>`);
    reportWindow.document.close();
    reportWindow.addEventListener("load", () => {
      reportWindow.focus();
      reportWindow.print();
    });
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
                  <div className="report-actions">
                    <button className="download-button" onClick={downloadPdfReport}><Download size={16} /> Download PDF report</button>
                    <button className="download-button" onClick={downloadJsonReport}><FileText size={16} /> Download JSON data</button>
                  </div>
                </div>
              </section>

              <section className="panel disease-guidance">
                <div className="panel-heading">
                  <div className="step-number">03</div>
                  <div><h3>Precautions & crop care</h3><p>Suggested next steps for this predicted condition</p></div>
                </div>
                {(() => {
                  const guidance = getDiseaseGuidance(prediction);
                  return (
                    <div className="guidance-content">
                      <h3>{guidance.title}</h3>
                      <h4>What you should do</h4>
                      <ul>{guidance.precautions.map((item) => <li key={item}>{item}</li>)}</ul>
                      <h4>Plant protection / pesticide information</h4>
                      <p>{guidance.treatment}</p>
                      {guidance.source && <a href={guidance.source} target="_blank" rel="noreferrer">View agricultural reference ↗</a>}
                      <div className="review-warning"><AlertCircle size={16} /> Important: AI image predictions can be wrong. Do not spray based only on this result. Confirm the disease, check the current CIB&amp;RC-approved product label for tomato, dose, waiting period and protective equipment, and consult your local KVK/agriculture officer.</div>
                    </div>
                  );
                })()}
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
