import React from "react";

const ARCH_LAYERS = [
  { name: "Input Layer",        detail: "Sequence of 5 cycles × 63 features",              color: "var(--accent-purple)" },
  { name: "LSTM Layer 1",       detail: "128 units, return_sequences=True, Dropout 0.2",   color: "var(--accent-cyan)" },
  { name: "Batch Normalization",detail: "Stabilizes activations between LSTM layers",       color: "var(--text-secondary)" },
  { name: "LSTM Layer 2",       detail: "64 units, return_sequences=False, Dropout 0.2",   color: "var(--accent-cyan)" },
  { name: "Dense Layer",        detail: "32 units, ReLU activation",                        color: "var(--accent-amber)" },
  { name: "Output Layer",       detail: "1 unit — predicted RUL (cycles)",                  color: "var(--accent-green)" },
];

const DATASETS_INFO = [
  { id: "FD001", ops: 1, faults: 1, train: 100, test: 100, desc: "Simplest dataset — ideal baseline for LSTM architecture tuning." },
  { id: "FD002", ops: 6, faults: 1, train: 260, test: 259, desc: "Multi-condition with per-condition normalization essential." },
  { id: "FD003", ops: 1, faults: 2, train: 100, test: 100, desc: "Two degradation modes challenge single-model approaches." },
  { id: "FD004", ops: 6, faults: 2, train: 249, test: 248, desc: "Most complex — combines multi-condition + multi-fault regimes." },
];

const PIPELINE_STEPS = [
  { step: "01", title: "Data Ingestion",       body: "Load 4 sub-datasets from NASA C-MAPSS. Each row is one flight cycle with 21 sensor readings and 3 operating settings." },
  { step: "02", title: "ID Remapping",         body: "Engine IDs are remapped globally (FD001: 1–100, FD002: 1001–1260, etc.) to prevent collisions when merging into a universal training CSV." },
  { step: "03", title: "Condition Scaling",    body: "StandardScaler is applied per operating condition group (set1, set2, set3) to remove condition-induced bias from sensor readings." },
  { step: "04", title: "Rolling Features",     body: "For every sensor, a 5-cycle rolling mean and std are computed, expanding from 21 to 63 features, capturing temporal degradation patterns." },
  { step: "05", title: "RUL Labeling",         body: "Ground-truth RUL is computed as (max_cycle − current_cycle) per engine, then clipped at 125 to implement piecewise-linear degradation labeling." },
  { step: "06", title: "Sequence Creation",    body: "Sliding window of length 5 creates (X, y) pairs. Each sample is [5 × 63] and the label is the RUL at the last timestep." },
  { step: "07", title: "Expert LSTM Training", body: "One LSTM model per dataset. Each is trained independently with Adam optimizer, MSE loss, EarlyStopping, and ReduceLROnPlateau callbacks." },
  { step: "08", title: "Inference",            body: "At test time, the last 5 cycles of the target engine are extracted, preprocessed, and fed into the corresponding expert model to predict RUL." },
];

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h3 style={{
        fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)",
        letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 18,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ color: "var(--accent-cyan)" }}>▸</span> {title}
      </h3>
      {children}
    </div>
  );
}

export default function About() {
  return (
    <div className="fade-in" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div className="eyebrow">▶ Project Documentation</div>
        <h1>About This Project</h1>
        <p style={{ fontSize: 15, lineHeight: 1.7 }}>
          Deep Temporal Analytics for Remaining Useful Life Estimation:
          An Expert LSTM Ensemble Approach for Multi-Condition Turbofan Engines
        </p>
      </div>

      {/* Abstract */}
      <div className="card" style={{ marginBottom: 32, borderLeft: "3px solid var(--accent-cyan)" }}>
        <div className="card-title">Abstract</div>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.8, marginTop: 8 }}>
          This project addresses the Predictive Maintenance problem by training an <strong style={{ color: "var(--text-primary)" }}>Expert LSTM Ensemble</strong> on
          the NASA C-MAPSS turbofan engine dataset. Rather than training a single model across all 4 sub-datasets,
          we train one specialized LSTM per dataset, exploiting the fact that each sub-dataset has distinct
          operating regimes and fault modes. Per-condition feature normalization and temporal rolling features
          allow the models to capture engine degradation dynamics accurately. The ensemble achieves
          R² scores above 0.85 across all four datasets.
        </p>
      </div>

      {/* Dataset table */}
      <Section title="C-MAPSS Datasets">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {DATASETS_INFO.map((d) => (
            <div className="card" key={d.id} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 18, color: "var(--accent-cyan)",
                fontWeight: 700, minWidth: 56,
              }}>
                {d.id}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                  <span className="tag tag-cyan">{d.ops} Op. Cond.</span>
                  <span className="tag tag-cyan">{d.faults} Fault Mode{d.faults > 1 ? "s" : ""}</span>
                  <span className="tag tag-cyan">{d.train} Train Engines</span>
                  <span className="tag tag-cyan">{d.test} Test Engines</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{d.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Pipeline */}
      <Section title="Data Pipeline & Methodology">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {PIPELINE_STEPS.map((s, i) => (
            <div key={s.step} style={{ display: "flex", gap: 16, position: "relative" }}>
              {/* Connector line */}
              {i < PIPELINE_STEPS.length - 1 && (
                <div style={{
                  position: "absolute", left: 19, top: 40, width: 2, height: "calc(100% - 4px)",
                  background: "var(--border)",
                }} />
              )}
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "var(--bg-base)", border: "2px solid var(--accent-cyan-dim)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: "var(--accent-cyan)", flexShrink: 0,
                zIndex: 1,
              }}>
                {s.step}
              </div>
              <div className="card" style={{ flex: 1, marginBottom: 8 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>
                  {s.title}
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Architecture */}
      <Section title="LSTM Model Architecture">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {ARCH_LAYERS.map((layer, i) => (
            <div
              key={layer.name}
              style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "14px 20px",
                borderBottom: i < ARCH_LAYERS.length - 1 ? "1px solid var(--border)" : "none",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
              }}
            >
              <div style={{
                width: 6, height: 36, borderRadius: 3,
                background: layer.color,
                boxShadow: `0 0 8px ${layer.color}66`,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>
                  {layer.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                  {layer.detail}
                </div>
              </div>
              {i < ARCH_LAYERS.length - 1 && (
                <span style={{ color: "var(--text-muted)", fontSize: 16 }}>↓</span>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, fontSize: 13, color: "var(--text-secondary)" }}>
          Training: <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>Adam</strong> optimizer,{" "}
          <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>MSE</strong> loss,{" "}
          <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>EarlyStopping</strong> patience=10,{" "}
          <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>ReduceLROnPlateau</strong> factor=0.5
        </div>
      </Section>

      {/* Tech stack */}
      <Section title="Technology Stack">
        <div className="grid-3">
          {[
            { label: "Model", items: ["TensorFlow / Keras", "LSTM Layers", "EarlyStopping"] },
            { label: "Data", items: ["Pandas", "NumPy", "Scikit-learn (Scaler)"] },
            { label: "Web App", items: ["React 18", "Node.js / Express", "Recharts"] },
          ].map((col) => (
            <div className="card" key={col.label}>
              <div className="card-title">{col.label}</div>
              {col.items.map((item) => (
                <div key={item} style={{
                  padding: "7px 0", borderBottom: "1px solid var(--border)",
                  fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)",
                }}>
                  <span style={{ color: "var(--accent-cyan)", marginRight: 8 }}>›</span>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      {/* Reference */}
      <Section title="Dataset Reference">
        <div className="card alert-info" style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
          <strong style={{ color: "var(--text-primary)" }}>Source:</strong> A. Saxena and K. Goebel (2008){" "}
          <em>"Turbofan Engine Degradation Simulation Data Set"</em>, NASA Ames Prognostics Data Repository,
          NASA Ames Research Center, Moffett Field, CA.
          <br />
          <strong style={{ color: "var(--text-primary);" }}>Dataset:</strong> C-MAPSS (Commercial Modular Aero-Propulsion System Simulation)
        </div>
      </Section>
    </div>
  );
}
