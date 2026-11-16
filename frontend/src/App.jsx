
import { useEffect, useRef, useState } from "react";
import {
  Activity, AlertCircle, CheckCircle2, Download, FileText,
  Image as ImageIcon, Info, Leaf, LoaderCircle, ScanSearch,
  ShieldCheck, Sprout, UploadCloud, Wifi, WifiOff, X
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
    title: "Healthy tomato leaf",
    precautions: [
      "Continue regular watering and balanced nutrition.",
      "Inspect plants regularly for early signs of disease.",
      "Maintain suitable spacing and remove weeds."
    ],
    treatment: "No disease treatment is indicated by this prediction."
  },
  {
    match: ["early blight"],
    title: "Early blight",
    precautions: [
      "Remove heavily affected lower leaves.",
      "Avoid watering directly over the leaves.",
      "Maintain good spacing and air circulation.",
      "Remove infected plant debris from the field."
    ],
    treatment: "Fungicide options may be available, but confirm the diagnosis and use only products currently registered for tomato. Follow the product label."
  },
  {
    match: ["late blight"],
    title: "Late blight",
    precautions: [
      "Remove and safely dispose of affected plant parts.",
      "Avoid overhead irrigation.",
      "Check nearby plants frequently for symptoms.",
      "Seek agricultural advice promptly if the disease is spreading."
    ],
    treatment: "Late blight can spread quickly. Ask a local agricultural officer about suitable registered crop-protection products."
  },
  {
    match: ["septoria"],
    title: "Septoria leaf spot",
    precautions: [
      "Remove infected lower leaves.",
      "Avoid splashing soil onto leaves.",
      "Keep plants properly spaced.",
      "Remove plant debris after harvest."
    ],
    treatment: "Confirm the disease before considering a registered fungicide. Follow the label instructions."
  },
  {
    match: ["spider mite", "two spotted"],
    title: "Spider mite damage",
    precautions: [
      "Inspect the underside of leaves for mites and webbing.",
      "Remove badly affected leaves where practical.",
      "Monitor plants regularly, especially during hot and dry weather.",
      "Protect beneficial insects where possible."
    ],
    treatment: "Ask an agricultural expert to confirm mite infestation and recommend an appropriate registered miticide if needed."
  },
  {
    match: ["yellow leaf curl", "leaf curl virus"],
    title: "Tomato yellow leaf curl",
    precautions: [
      "Remove severely affected plants when advised.",
      "Monitor whitefly populations.",
      "Remove weeds that may host insect vectors.",
      "Use healthy seedlings and suitable preventive practices."
    ],
    treatment: "There is no pesticide cure for a viral infection. Management focuses on prevention and controlling insect vectors."
  },
  {
    match: ["mosaic virus", "tomato mosaic"],
    title: "Tomato mosaic virus",
    precautions: [
      "Remove infected plants to reduce spread.",
      "Clean tools and hands after handling affected plants.",
      "Use healthy seeds and seedlings.",
      "Avoid handling healthy plants immediately after infected plants."
    ],
    treatment: "There is no pesticide cure for a viral infection. Follow sanitation and prevention practices."
  },
  {
    match: ["bacterial spot"],
    title: "Bacterial spot",
    precautions: [
      "Avoid working with wet plants.",
      "Remove severely infected plant material.",
      "Use clean tools and healthy seedlings.",
      "Avoid overhead watering."
    ],
    treatment: "Confirm the diagnosis with an agricultural expert. Do not assume fungicides will cure a bacterial infection."
  },
  {
    match: ["leaf mold"],
    title: "Tomato leaf mold",
    precautions: [
      "Improve air circulation between plants.",
      "Avoid excessive humidity around the leaves.",
      "Remove affected leaves where practical.",
      "Avoid overhead irrigation."
    ],
    treatment: "Confirm the disease before using any registered fungicide. Follow local agricultural recommendations."
  },
  {
    match: ["target spot"],
    title: "Target spot",
    precautions: [
      "Remove affected leaves and plant debris.",
      "Maintain adequate spacing.",
      "Avoid keeping foliage wet for long periods.",
      "Inspect plants regularly."
    ],
    treatment: "Confirm the diagnosis before choosing a crop-protection product."
  }
];

function getDiseaseGuidance(prediction = "") {
  const name = prediction.toLowerCase();

  return DISEASE_GUIDANCE.find((item) =>
    item.match.some((word) => name.includes(word))
  ) || {
    title: formatClass(prediction),
    precautions: [
      "Inspect the plant carefully for visible symptoms.",
      "Check nearby plants for similar symptoms.",
      "Remove severely affected plant material where appropriate.",
      "Consult a local agricultural expert before treatment."
    ],
    treatment: "The predicted class needs confirmation before any treatment is selected."
  };
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function App() {
  const [page, setPage] = useState("Home");
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

    return () => {
      active = false;
    };
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
      setPage("Results");
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

  const prediction = result?.prediction || result?.candidate_prediction || "";
  const confidence = result
    ? (result.confidence * 100).toFixed(2)
    : "0.00";

  const heatmapUrl = result?.heatmap_url
    ? `${API_BASE}${result.heatmap_url}`
    : "";

  const overlayUrl = result?.overlay_url
    ? `${API_BASE}${result.overlay_url}`
    : "";

  const guidance = getDiseaseGuidance(prediction);

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

    const topPredictions = (result.top_k || [])
      .slice(0, 3)
      .map((item) => `
        <tr>
          <td>${escapeHtml(formatClass(item.class_name))}</td>
          <td>${(item.probability * 100).toFixed(1)}%</td>
        </tr>
      `).join("");

    const precautions = guidance.precautions
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");

    const imageHtml = (src, title) => src
      ? `<div class="image-section"><h3>${title}</h3><img src="${src}" /></div>`
      : "";

    const reportWindow = window.open("", "_blank");

    if (!reportWindow) {
      setError("Please allow pop-ups to generate the PDF report.");
      return;
    }

    reportWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>BHOOMI AI Analysis Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #303830;
            max-width: 850px;
            margin: 35px auto;
            padding: 20px;
          }
          h1 { color: #355f3b; margin-bottom: 5px; }
          h2 { color: #355f3b; border-bottom: 1px solid #ddd; padding-bottom: 7px; }
          p, li { line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; }
          td, th { border: 1px solid #ddd; padding: 10px; text-align: left; }
          .result { background: #f1f6ef; padding: 15px; margin: 20px 0; }
          .image-section { display: inline-block; width: 30%; vertical-align: top; margin: 1%; }
          img { max-width: 100%; height: 180px; object-fit: contain; }
          .note { color: #777; font-size: 12px; margin-top: 30px; }
          @media print { body { margin: 10px auto; } }
        </style>
      </head>
      <body>
        <h1>BHOOMI AI</h1>
        <p>Tomato Leaf Disease Detection System</p>
        <hr />

        <h2>Analysis Report</h2>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Image:</strong> ${escapeHtml(file?.name || "Uploaded image")}</p>

        <div class="result">
          <h2>Prediction</h2>
          <h3>${escapeHtml(formatClass(prediction))}</h3>
          <p><strong>Model confidence:</strong> ${confidence}%</p>
          <p><strong>Model:</strong> EfficientNet-B0</p>
        </div>

        <h2>Top Predictions</h2>
        <table>
          <tr><th>Predicted class</th><th>Probability</th></tr>
          ${topPredictions}
        </table>

        <h2>Precautions</h2>
        <ul>${precautions}</ul>
        <p><strong>Crop-care information:</strong> ${escapeHtml(guidance.treatment)}</p>

        <h2>Model Explainability</h2>
        ${imageHtml(preview, "Original Image")}
        ${imageHtml(heatmapUrl, "Grad-CAM Heatmap")}
        ${imageHtml(overlayUrl, "Grad-CAM Overlay")}

        <p class="note">
          This report is generated by an academic project. Model predictions
          are experimental and should not replace confirmation by an
          agricultural expert. Always follow locally approved product labels.
        </p>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 700);
          };
        <\/script>
      </body>
      </html>
    `);

    reportWindow.document.close();
  }

  function navigate(destination) {
    setPage(destination);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => {
          event.preventDefault();
          navigate("Home");
        }}>
          <span className="brand-mark"><Sprout size={22} /></span>
          <span>
            BHOOMI AI
            <small>TOMATO LEAF DISEASE DETECTION</small>
          </span>
        </a>

        <nav className="main-nav">
          {["Home", "Analyze", "Results", "About"].map((item) => (
            <button
              key={item}
              className={page === item ? "nav-link active" : "nav-link"}
              onClick={() => navigate(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <span className={`connection ${backendOnline ? "online" : "offline"}`}>
          {backendOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
          {backendOnline ? "Backend online" : "Backend offline"}
        </span>
      </header>

      {page === "Home" && (
        <section className="home-page">
          <div className="project-heading">
            <span className="section-kicker">B.TECH PROJECT · COMPUTER VISION</span>
            <h1>Tomato Leaf Disease Detection System</h1>
            <p>
              BHOOMI AI is a student-developed project that uses deep learning
              to identify possible diseases in tomato leaf images.
            </p>
            <button className="analyze-button home-button" onClick={() => navigate("Analyze")}>
              <ScanSearch size={18} /> Start analysis
            </button>
          </div>

          <div className="home-details">
            <div className="info-card">
              <Leaf size={23} />
              <h3>10 Tomato Classes</h3>
              <p>The model classifies tomato leaf images into 10 categories.</p>
            </div>
            <div className="info-card">
              <Activity size={23} />
              <h3>EfficientNet-B0</h3>
              <p>A convolutional neural network used for image classification.</p>
            </div>
            <div className="info-card">
              <ScanSearch size={23} />
              <h3>Grad-CAM</h3>
              <p>Visual explanations show image regions influencing predictions.</p>
            </div>
          </div>

          <div className="home-instructions">
            <h2>How to use the project</h2>
            <ol>
              <li>Open the Analyze page.</li>
              <li>Upload a clear tomato leaf photograph.</li>
              <li>Click Analyze to get the model prediction.</li>
              <li>View the result, confidence score and Grad-CAM images.</li>
            </ol>
          </div>
        </section>
      )}

      {page === "Analyze" && (
        <section className="workspace">
          <div className="section-heading">
            <div>
              <span className="section-kicker">IMAGE CLASSIFICATION</span>
              <h2>Analyze a tomato leaf</h2>
            </div>
          </div>

          <div className="workspace-grid">
            <section className="panel upload-panel">
              <div className="panel-heading">
                <div className="step-number">01</div>
                <div>
                  <h3>Upload leaf image</h3>
                  <p>Select a clear photo of a tomato leaf.</p>
                </div>
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
                  <strong>Select a leaf image</strong>
                  <span>Click to browse or drag an image here</span>
                  <small>JPG, PNG or WEBP · Maximum 10 MB</small>
                </button>
              ) : (
                <div className="preview-box">
                  <img src={preview} alt="Selected tomato leaf" />
                  <button className="remove-image" onClick={reset} aria-label="Remove image">
                    <X size={17} />
                  </button>
                  <div className="file-label">
                    <ImageIcon size={15} /> {file?.name}
                  </div>
                </div>
              )}

              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => selectFile(event.target.files?.[0])}
              />

              {error && (
                <div className="error-message">
                  <AlertCircle size={17} /> {error}
                </div>
              )}

              <button
                className="analyze-button"
                onClick={analyzeImage}
                disabled={!file || loading}
              >
                {loading
                  ? <><LoaderCircle className="spin" size={19} /> Analyzing image...</>
                  : <><ScanSearch size={19} /> Analyze image</>}
              </button>

              <div className="upload-footnote">
                <Info size={14} /> Use a well-lit image with the leaf clearly visible.
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div className="step-number">02</div>
                <div>
                  <h3>Analysis information</h3>
                  <p>Your prediction will appear on the Results page.</p>
                </div>
              </div>

              <div className="empty-result">
                <div className="empty-icon"><FileText size={30} /></div>
                <strong>{loading ? "Analysis in progress" : "Ready for analysis"}</strong>
                <p>
                  {loading
                    ? "The model is processing your image. Please wait."
                    : "Upload a tomato leaf image and click Analyze image to continue."}
                </p>
              </div>
            </section>
          </div>
        </section>
      )}

      {page === "Results" && (
        <section className="workspace">
          <div className="section-heading">
            <div>
              <span className="section-kicker">MODEL OUTPUT</span>
              <h2>Analysis results</h2>
            </div>
          </div>

          {!result ? (
            <div className="panel empty-result">
              <div className="empty-icon"><FileText size={30} /></div>
              <strong>No analysis available yet</strong>
              <p>Upload a tomato leaf image and run an analysis first.</p>
              <button className="analyze-button home-button" onClick={() => navigate("Analyze")}>
                Go to Analyze
              </button>
            </div>
          ) : (
            <>
              <section className="panel result-panel">
                <div className="diagnosis">
                  <div className="diagnosis-status">
                    <span><CheckCircle2 size={15} /> ANALYSIS COMPLETE</span>
                    <span className="model-label">EfficientNet-B0</span>
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

                  <div className="confidence-track">
                    <span style={{ width: `${confidence}%` }} />
                  </div>

                  <div className="top-predictions">
                    <h4>TOP PREDICTIONS</h4>
                    {result.top_k?.slice(0, 3).map((item, index) => (
                      <div className="prediction-item" key={item.class_name}>
                        <span className="prediction-rank">0{index + 1}</span>
                        <span className="prediction-class">
                          {formatClass(item.class_name)}
                        </span>
                        <strong>{(item.probability * 100).toFixed(1)}%</strong>
                      </div>
                    ))}
                  </div>

                  {result.requires_expert_review && (
                    <div className="review-warning">
                      <AlertCircle size={16} />
                      Expert review recommended for this result.
                    </div>
                  )}

                  <div className="report-buttons">
                    <button className="download-button" onClick={downloadPdfReport}>
                      <Download size={16} /> Download PDF report
                    </button>
                    <button className="download-button" onClick={downloadJsonReport}>
                      <Download size={16} /> Download JSON data
                    </button>
                  </div>
                </div>
              </section>

              <section className="panel guidance-panel">
                <span className="section-kicker">CROP CARE INFORMATION</span>
                <h2>{guidance.title}</h2>

                <h3>Suggested precautions</h3>
                <ul>
                  {guidance.precautions.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>

                <h3>Plant protection information</h3>
                <p>{guidance.treatment}</p>

                <p className="guidance-warning">
                  Important: This is educational guidance, not a pesticide
                  prescription. AI predictions can be incorrect. Confirm the
                  disease with a qualified agricultural expert or KVK before
                  treatment. Check current Indian registration, crop label,
                  dosage and waiting period before using any pesticide.
                </p>
              </section>

              <section className="explain-section">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">MODEL EXPLAINABILITY</span>
                    <h2>Grad-CAM visualizations</h2>
                  </div>
                </div>

                <p className="explain-intro">
                  These images highlight regions that influenced the model's
                  prediction. They are explanatory aids, not proof of disease.
                </p>

                <div className="visual-grid">
                  <div className="visual-card">
                    <div className="visual-image">
                      {preview && <img src={preview} alt="Original leaf" />}
                    </div>
                    <div><strong>Original image</strong><span>Uploaded leaf photograph</span></div>
                  </div>

                  <div className="visual-card">
                    <div className="visual-image">
                      {heatmapUrl && <img src={heatmapUrl} alt="Grad-CAM heatmap" />}
                    </div>
                    <div><strong>Grad-CAM heatmap</strong><span>Model activation regions</span></div>
                  </div>

                  <div className="visual-card">
                    <div className="visual-image">
                      {overlayUrl && <img src={overlayUrl} alt="Grad-CAM overlay" />}
                    </div>
                    <div><strong>Grad-CAM overlay</strong><span>Heatmap over original image</span></div>
                  </div>
                </div>
              </section>
            </>
          )}
        </section>
      )}

      {page === "About" && (
        <section className="workspace about-page">
          <span className="section-kicker">PROJECT INFORMATION</span>
          <h2>About BHOOMI AI</h2>
          <p>
            BHOOMI AI is an academic project developed to explore how deep
            learning and computer vision can be used for tomato leaf image
            classification.
          </p>

          <div className="about-list">
            <div><strong>Project area</strong><span>Artificial Intelligence and Computer Vision</span></div>
            <div><strong>Model architecture</strong><span>EfficientNet-B0</span></div>
            <div><strong>Classification</strong><span>10 tomato leaf classes</span></div>
            <div><strong>Explainability</strong><span>Grad-CAM heatmap and overlay</span></div>
            <div><strong>Backend</strong><span>Python and FastAPI</span></div>
            <div><strong>Frontend</strong><span>React</span></div>
          </div>

          <p className="guidance-warning">
            The model is experimental and was evaluated using a held-out test
            dataset. Performance on real farm photographs may differ. This
            project is intended as an educational decision-support tool, not
            a replacement for professional agricultural diagnosis.
          </p>
        </section>
      )}

      <footer className="footer">
        <div className="footer-brand"><Sprout size={18} /> BHOOMI AI</div>
        <span>Tomato Leaf Disease Detection System</span>
        <span>Academic project · Experimental predictions</span>
      </footer>
    </main>
  );
}

export default App;
