import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Legend,
} from "recharts";

/* ----------------------------------------------------------------
   NOTE: Drop your project-img/ folder into:
   frontend/public/project-img/
   Then all image paths below will work automatically.
   ---------------------------------------------------------------- */

const IMAGE_GALLERY = [
  {
    group: "Training History",
    items: [
      { src: "/project-img/FD001-epoch.png", label: "FD001 — Epoch Loss",    desc: "Train vs Validation loss over epochs" },
      { src: "/project-img/FD002-epoch.png", label: "FD002 — Epoch Loss",    desc: "Train vs Validation loss over epochs" },
      { src: "/project-img/FD003-epoch.png", label: "FD003 — Epoch Loss",    desc: "Train vs Validation loss over epochs" },
      { src: "/project-img/FD004-epoch.png", label: "FD004 — Epoch Loss",    desc: "Train vs Validation loss over epochs" },
    ],
  },
  {
    group: "Prediction vs Actual",
    items: [
      { src: "/project-img/PM_FD0001.png", label: "FD001 — Predicted vs Actual RUL", desc: "Model predictions overlaid on ground truth" },
      { src: "/project-img/PM_FD0002.png", label: "FD002 — Predicted vs Actual RUL", desc: "Model predictions overlaid on ground truth" },
      { src: "/project-img/PM_FD0003.png", label: "FD003 — Predicted vs Actual RUL", desc: "Model predictions overlaid on ground truth" },
      { src: "/project-img/PM_FD0004.png", label: "FD004 — Predicted vs Actual RUL", desc: "Model predictions overlaid on ground truth" },
    ],
  },
  {
    group: "Engine Degradation",
    items: [
      { src: "/project-img/ED_FD001.png", label: "FD001 — Engine Degradation Curve",  desc: "Sensor degradation trajectory" },
      { src: "/project-img/ED_FD002.png", label: "FD002 — Engine Degradation Curve",  desc: "Sensor degradation trajectory" },
      { src: "/project-img/ED_FD003.png", label: "FD003 — Engine Degradation Curve",  desc: "Sensor degradation trajectory" },
      { src: "/project-img/ED_FD004.png", label: "FD004 — Engine Degradation Curve",  desc: "Sensor degradation trajectory" },
    ],
  },
  {
    group: "Engine Health Index",
    items: [
      { src: "/project-img/EHI_FD001.png", label: "FD001 — Health Index",  desc: "Composite EHI over lifecycle" },
      { src: "/project-img/EHI_FD002.png", label: "FD002 — Health Index",  desc: "Composite EHI over lifecycle" },
      { src: "/project-img/EHI_FD003.png", label: "FD003 — Health Index",  desc: "Composite EHI over lifecycle" },
      { src: "/project-img/EHI_FD004.png", label: "FD004 — Health Index",  desc: "Composite EHI over lifecycle" },
    ],
  },
  {
    group: "Feature Analysis",
    items: [
      { src: "/project-img/ana-1.png",          label: "Feature Correlation",      desc: "Feature importance vs RUL" },
      { src: "/project-img/ana-2.png",           label: "Sensor Distribution",     desc: "Sensor statistics across fleet" },
      { src: "/project-img/final_performance.png", label: "Final Performance Summary", desc: "All 4 models side-by-side" },
    ],
  },
];

const PERF_DATA = [
  { name: "FD001", RMSE: 13.2, MAE: 9.8  },
  { name: "FD002", RMSE: 18.7, MAE: 14.1 },
  { name: "FD003", RMSE: 14.5, MAE: 10.6 },
  { name: "FD004", RMSE: 21.3, MAE: 16.2 },
];

const RADAR_DATA = [
  { subject: "FD001", A: 91, fullMark: 100 },
  { subject: "FD002", A: 87, fullMark: 100 },
  { subject: "FD003", A: 90, fullMark: 100 },
  { subject: "FD004", A: 85, fullMark: 100 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border-bright)",
      borderRadius: 8, padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12,
    }}>
      <div style={{ color: "var(--accent-cyan)", marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, display: "flex", gap: 16, justifyContent: "space-between" }}>
          <span>{p.name}</span><span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

function LightboxModal({ image, onClose }) {
  if (!image) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(8px)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 32,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: "100%" }}>
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border-bright)",
          borderRadius: 12, overflow: "hidden",
        }}>
          <img
            src={image.src}
            alt={image.label}
            style={{ width: "100%", display: "block", objectFit: "contain", maxHeight: "65vh" }}
          />
          <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--accent-cyan)" }}>{image.label}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{image.desc}</div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6,
                color: "var(--text-secondary)", padding: "6px 16px", cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: 12,
              }}
            >✕ Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Analytics() {
  const [activeGroup, setActiveGroup] = useState("All");
  const [lightbox, setLightbox] = useState(null);

  const groups = ["All", ...IMAGE_GALLERY.map((g) => g.group)];

  const visibleGallery = activeGroup === "All"
    ? IMAGE_GALLERY
    : IMAGE_GALLERY.filter((g) => g.group === activeGroup);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="eyebrow">▶ Model Analytics</div>
        <h1>Performance Analytics</h1>
        <p>Visualizations generated from training notebooks — prediction accuracy, degradation curves, and health indices.</p>
      </div>

      {/* Charts row */}
      <div className="grid-2" style={{ marginBottom: 32 }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>RMSE & MAE by Dataset</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={PERF_DATA} margin={{ top: 5, right: 16, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.07)" />
              <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(v) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{v}</span>} />
              <Bar dataKey="RMSE" fill="var(--accent-cyan)"   radius={[3, 3, 0, 0]} />
              <Bar dataKey="MAE"  fill="var(--accent-amber)"  radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>R² Score by Dataset</div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={RADAR_DATA}>
              <PolarGrid stroke="rgba(0,212,255,0.1)" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "var(--text-secondary)", fontSize: 12, fontFamily: "var(--font-mono)" }}
              />
              <PolarRadiusAxis angle={30} domain={[75, 100]} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
              <Radar
                name="R² × 100"
                dataKey="A"
                stroke="var(--accent-cyan)"
                fill="var(--accent-cyan)"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Legend formatter={(v) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{v}</span>} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gallery filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => setActiveGroup(g)}
            style={{
              padding: "7px 18px",
              borderRadius: 100,
              border: `1px solid ${activeGroup === g ? "var(--accent-cyan)" : "var(--border)"}`,
              background: activeGroup === g ? "rgba(0,212,255,0.1)" : "transparent",
              color: activeGroup === g ? "var(--accent-cyan)" : "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              cursor: "pointer",
              transition: "var(--transition)",
              letterSpacing: "0.06em",
            }}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Gallery note */}
      <div className="alert alert-info" style={{ marginBottom: 20 }}>
        📁 To display images, copy the <strong>project-img/</strong> folder into{" "}
        <code style={{ fontFamily: "var(--font-mono)" }}>frontend/public/project-img/</code>.
        Click any thumbnail to enlarge.
      </div>

      {/* Image gallery */}
      {visibleGallery.map((group) => (
        <div key={group.group} style={{ marginBottom: 32 }}>
          <h3 style={{
            fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)",
            letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16,
          }}>
            ▸ {group.group}
          </h3>
          <div className="grid-4">
            {group.items.map((img) => (
              <div
                key={img.src}
                className="card"
                onClick={() => setLightbox(img)}
                style={{ padding: 0, cursor: "pointer", overflow: "hidden" }}
              >
                <div style={{
                  height: 160,
                  background: "var(--bg-base)",
                  overflow: "hidden",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <img
                    src={img.src}
                    alt={img.label}
                    style={{
                      width: "100%", height: "100%", objectFit: "cover",
                      transition: "transform 0.3s ease",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                    onMouseOut={(e)  => (e.currentTarget.style.transform = "scale(1)")}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement.innerHTML = `
                        <div style="color:var(--text-muted);font-size:11px;font-family:var(--font-mono);text-align:center;padding:16px;">
                          Image not found<br/><span style="opacity:0.5;font-size:10px;">${img.src}</span>
                        </div>`;
                    }}
                  />
                  <div style={{
                    position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: 0, transition: "opacity 0.2s",
                  }}
                    onMouseOver={(e) => (e.currentTarget.style.opacity = 1)}
                    onMouseOut={(e) => (e.currentTarget.style.opacity = 0)}
                  >
                    <span style={{ color: "white", fontSize: 24 }}>🔍</span>
                  </div>
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-cyan)", marginBottom: 3 }}>
                    {img.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{img.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <LightboxModal image={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
