import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const DATASET_DETAIL = {
  FD001: { color: "var(--accent-cyan)",   icon: "◈", conditions: "1 Op. Condition",  faults: "1 Fault Mode",  engines: 100 },
  FD002: { color: "var(--accent-amber)",  icon: "◆", conditions: "6 Op. Conditions", faults: "1 Fault Mode",  engines: 260 },
  FD003: { color: "var(--accent-green)",  icon: "◇", conditions: "1 Op. Condition",  faults: "2 Fault Modes", engines: 100 },
  FD004: { color: "var(--accent-purple)", icon: "◉", conditions: "6 Op. Conditions", faults: "2 Fault Modes", engines: 249 },
};

const MODEL_METRICS = [
  { dataset: "FD001", rmse: "13.2",  mae: "9.8",  r2: "0.91" },
  { dataset: "FD002", rmse: "18.7",  mae: "14.1", r2: "0.87" },
  { dataset: "FD003", rmse: "14.5",  mae: "10.6", r2: "0.90" },
  { dataset: "FD004", rmse: "21.3",  mae: "16.2", r2: "0.85" },
];

export default function Dashboard() {
  const [datasets, setDatasets] = useState([]);
  const [apiOnline, setApiOnline] = useState(null);

  useEffect(() => {
    axios.get("/api/datasets")
      .then((r) => { setDatasets(r.data.datasets); setApiOnline(true); })
      .catch(() => {
        setApiOnline(false);
        setDatasets(Object.keys(DATASET_DETAIL).map((k) => ({ name: k })));
      });
  }, []);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="eyebrow">▶ System Overview</div>
        <h1>Turbofan Engine Health<br />Monitoring Center</h1>
        <p>
          LSTM Ensemble models trained on NASA C-MAPSS data — predicting
          Remaining Useful Life across 4 multi-condition fleet datasets.
        </p>
      </div>

      {/* API status banner */}
      {apiOnline === false && (
        <div className="alert alert-error" style={{ marginBottom: 24 }}>
          ⚠ Backend offline. Start Node server: <code style={{ fontFamily: "var(--font-mono)" }}>npm run dev</code>
          &nbsp;in the <code>/backend</code> directory.
        </div>
      )}

      {/* KPI row */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="card-title">Expert Models</div>
          <div className="card-value">4</div>
          <div className="card-sub">One per fleet dataset</div>
        </div>
        <div className="card">
          <div className="card-title">Total Sensors</div>
          <div className="card-value">21</div>
          <div className="card-sub">+ 42 rolling features</div>
        </div>
        <div className="card">
          <div className="card-title">Sequence Length</div>
          <div className="card-value">5</div>
          <div className="card-sub">Cycles per inference</div>
        </div>
        <div className="card">
          <div className="card-title">Feature Dims</div>
          <div className="card-value">63</div>
          <div className="card-sub">Per timestep input</div>
        </div>
      </div>

      {/* Dataset cards */}
      <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
        ▸ Fleet Datasets — NASA C-MAPSS
      </h3>
      <div className="grid-4" style={{ marginBottom: 32 }}>
        {Object.entries(DATASET_DETAIL).map(([name, meta]) => (
          <div className="card" key={name} style={{ borderTop: `2px solid ${meta.color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="card-title">{name}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: meta.color, fontWeight: 700 }}>
                  {meta.engines}
                </div>
                <div className="card-sub">Train engines</div>
              </div>
              <span style={{ fontSize: 24, color: meta.color, opacity: 0.6 }}>{meta.icon}</span>
            </div>
            <hr className="section-divider" style={{ margin: "14px 0" }} />
            <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 4 }}>
              <span>⚙ {meta.conditions}</span>
              <span>⚠ {meta.faults}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Model performance table */}
      <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
        ▸ Model Performance Summary
      </h3>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(0,212,255,0.05)" }}>
              {["Dataset", "RMSE ↓", "MAE ↓", "R² ↑", "Status"].map((h) => (
                <th key={h} style={{
                  padding: "14px 20px", textAlign: "left",
                  fontFamily: "var(--font-mono)", fontSize: 10,
                  color: "var(--text-muted)", letterSpacing: "0.1em",
                  textTransform: "uppercase", borderBottom: "1px solid var(--border)",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODEL_METRICS.map((m, i) => {
              const color = DATASET_DETAIL[m.dataset].color;
              return (
                <tr key={m.dataset} style={{ borderBottom: i < MODEL_METRICS.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 13, color, fontWeight: 600 }}>{m.dataset}</span>
                  </td>
                  <td style={{ padding: "14px 20px", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{m.rmse}</td>
                  <td style={{ padding: "14px 20px", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{m.mae}</td>
                  <td style={{ padding: "14px 20px", fontFamily: "var(--font-mono)", color: "var(--accent-green)" }}>{m.r2}</td>
                  <td style={{ padding: "14px 20px" }}>
                    <span className="badge badge-healthy" style={{ fontSize: 10 }}>Ready</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CTA */}
      <div style={{ marginTop: 32, display: "flex", gap: 14 }}>
        <Link to="/predict" className="btn btn-primary">⚡ Run RUL Prediction</Link>
        <Link to="/analytics" className="btn btn-outline">📊 View Analytics</Link>
      </div>
    </div>
  );
}
