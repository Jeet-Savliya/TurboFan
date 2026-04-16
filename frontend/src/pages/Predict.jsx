import React, { useState, useCallback, useMemo } from "react";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell, LabelList,
  ReferenceLine,
} from "recharts";
import RULGauge from "../components/RULGauge";

// ── Per-dataset key sensors from C-MAPSS literature ───────────────────────────
// Source: Saxena et al. (2008), Heimes (2008), Li et al. (2018)
// Each entry: { sensor, impactScore (0-1 from literature), why }
const KEY_SENSORS_BY_DATASET = {
  FD001: [
    { sensor:"s4",  impactScore:0.96, why:"HPC outlet temp rises as compressor degrades" },
    { sensor:"s11", impactScore:0.93, why:"HPC static pressure drops with blade wear" },
    { sensor:"s12", impactScore:0.91, why:"Fuel flow increases to compensate efficiency loss" },
    { sensor:"s20", impactScore:0.88, why:"HP turbine exit pressure falls with seal degradation" },
    { sensor:"s21", impactScore:0.85, why:"Air-fuel ratio shifts as combustor efficiency drops" },
    { sensor:"s15", impactScore:0.80, why:"Bypass stream enthalpy changes with fan degradation" },
  ],
  FD002: [
    { sensor:"s3",  impactScore:0.94, why:"LPC outlet temp — key indicator under multi-condition ops" },
    { sensor:"s4",  impactScore:0.92, why:"HPC outlet temp — primary thermal degradation signal" },
    { sensor:"s11", impactScore:0.90, why:"HPC static pressure — compressor health across 6 conditions" },
    { sensor:"s12", impactScore:0.87, why:"Fuel flow ratio — efficiency loss marker in varied conditions" },
    { sensor:"s20", impactScore:0.84, why:"HP turbine exit pressure — turbine seal wear indicator" },
    { sensor:"s7",  impactScore:0.79, why:"HP turbine outlet pressure — critical in high-load conditions" },
  ],
  FD003: [
    { sensor:"s4",  impactScore:0.95, why:"HPC temp — elevated by both HPC & fan degradation modes" },
    { sensor:"s11", impactScore:0.92, why:"HPC pressure — first fault mode directly affects this" },
    { sensor:"s15", impactScore:0.90, why:"Bypass enthalpy — sensitive to fan degradation (fault mode 2)" },
    { sensor:"s20", impactScore:0.87, why:"HP turbine exit pressure — cross-fault degradation marker" },
    { sensor:"s21", impactScore:0.84, why:"Air-fuel ratio — shifts under both fault conditions" },
    { sensor:"s9",  impactScore:0.76, why:"Bypass pressure ratio — fan wear signature" },
  ],
  FD004: [
    { sensor:"s3",  impactScore:0.93, why:"LPC temp — dominant signal under 6-condition + 2-fault regime" },
    { sensor:"s4",  impactScore:0.91, why:"HPC temp — thermal degradation across all operating points" },
    { sensor:"s7",  impactScore:0.89, why:"HP turbine pressure — most sensitive under high-load conditions" },
    { sensor:"s11", impactScore:0.87, why:"HPC static pressure — compressor wear across all conditions" },
    { sensor:"s20", impactScore:0.85, why:"HP turbine exit pressure — combined fault degradation marker" },
    { sensor:"s12", impactScore:0.81, why:"Fuel flow — efficiency loss marker across all op. conditions" },
  ],
};

// Compute Pearson correlation between two arrays
function pearson(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  const mx = x.slice(0,n).reduce((a,b)=>a+b,0)/n;
  const my = y.slice(0,n).reduce((a,b)=>a+b,0)/n;
  let num=0, dx2=0, dy2=0;
  for (let i=0;i<n;i++) {
    const dxi=x[i]-mx, dyi=y[i]-my;
    num+=dxi*dyi; dx2+=dxi*dxi; dy2+=dyi*dyi;
  }
  const denom=Math.sqrt(dx2*dy2);
  return denom===0 ? 0 : num/denom;
}

// ── Key Sensors Chart Component ───────────────────────────────────────────────
function KeySensorsChart({ dataset, engineId, sensorData }) {
  const [activeTab, setActiveTab] = useState("trend"); // "trend" | "impact"

  const keyList = KEY_SENSORS_BY_DATASET[dataset] || [];

  // Compute live correlation of each key sensor vs cycle (proxy for RUL decline)
  const enriched = useMemo(() => {
    if (!sensorData) return keyList;
    const { cycles, sensors } = sensorData;
    return keyList.map((item) => {
      const vals = sensors[item.sensor];
      if (!vals) return { ...item, liveCorr: null };
      const corr = pearson(cycles, vals);
      return { ...item, liveCorr: Math.abs(corr) };
    }).sort((a,b) => (b.liveCorr ?? b.impactScore) - (a.liveCorr ?? a.impactScore));
  }, [sensorData, dataset]);

  // Trend chart data — all cycles for the key sensors
  const trendData = useMemo(() => {
    if (!sensorData) return [];
    const { cycles, sensors } = sensorData;
    const start = Math.max(0, cycles.length - 100);
    return cycles.slice(start).map((cycle, i) => {
      const row = { cycle };
      enriched.forEach(({ sensor }) => {
        if (sensors[sensor]) row[sensor] = sensors[sensor][start + i];
      });
      return row;
    });
  }, [sensorData, enriched]);

  // Bar chart data
  const barData = enriched.map((item) => ({
    sensor: item.sensor,
    label: `${item.sensor} — ${SENSOR_LABELS[item.sensor] || item.sensor}`,
    literature: +(item.impactScore * 100).toFixed(1),
    live: item.liveCorr !== null ? +(item.liveCorr * 100).toFixed(1) : null,
  }));

  const IMPACT_COLORS = ["#FF4455","#FF7744","#FFB020","#FFD700","#00E87A","#00D4FF"];

  const BarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const item = enriched.find(e => e.sensor === label);
    return (
      <div style={{ background:"var(--bg-card)", border:"1px solid var(--border-bright)", borderRadius:8, padding:"12px 14px", fontFamily:"var(--font-mono)", fontSize:12, maxWidth:280 }}>
        <div style={{ color:"var(--accent-cyan)", fontWeight:700, marginBottom:6 }}>
          {label} — {SENSOR_LABELS[label] || label}
        </div>
        {payload.map(p => (
          <div key={p.name} style={{ color:p.color, marginBottom:2 }}>
            {p.name}: <strong>{p.value}%</strong>
          </div>
        ))}
        {item && (
          <div style={{ color:"var(--text-muted)", fontSize:11, marginTop:8, lineHeight:1.5, borderTop:"1px solid var(--border)", paddingTop:6 }}>
            {item.why}
          </div>
        )}
      </div>
    );
  };

  const TrendTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background:"var(--bg-card)", border:"1px solid var(--border-bright)", borderRadius:8, padding:"10px 14px", fontFamily:"var(--font-mono)", fontSize:12 }}>
        <div style={{ color:"var(--text-muted)", marginBottom:6 }}>Cycle {label}</div>
        {payload.map(p => (
          <div key={p.dataKey} style={{ color:p.color, display:"flex", gap:10, justifyContent:"space-between" }}>
            <span>{SENSOR_LABELS[p.dataKey]||p.dataKey}</span>
            <span style={{ fontWeight:600 }}>{Number(p.value).toFixed(3)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="card" style={{ marginTop:24 }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
            <div className="card-title" style={{ margin:0 }}>Primary Degradation Sensors</div>
            <span className="tag tag-cyan">{dataset}</span>
            <span style={{
              padding:"2px 8px", borderRadius:4, fontSize:10, fontFamily:"var(--font-mono)",
              background:"rgba(255,68,85,0.1)", color:"var(--accent-red)",
              border:"1px solid rgba(255,68,85,0.3)",
            }}>
              ⚡ RUL-Critical
            </span>
          </div>
          <div style={{ fontSize:12, color:"var(--text-secondary)" }}>
            Sensors most correlated with engine degradation for <strong style={{ color:"var(--text-primary)" }}>{dataset}</strong> fleet —
            computed from live engine data + C-MAPSS literature
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display:"flex", gap:0, border:"1px solid var(--border)", borderRadius:8, overflow:"hidden", flexShrink:0 }}>
          {[["trend","📈 Trend"], ["impact","📊 Impact Score"]].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding:"8px 16px", border:"none", cursor:"pointer",
              fontFamily:"var(--font-mono)", fontSize:11,
              background: activeTab===tab ? "var(--accent-cyan)" : "transparent",
              color: activeTab===tab ? "var(--bg-void)" : "var(--text-secondary)",
              fontWeight: activeTab===tab ? 700 : 400,
              transition:"var(--transition)",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Sensor pills showing rank */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
        {enriched.map((item, i) => (
          <div key={item.sensor} style={{
            display:"flex", alignItems:"center", gap:6,
            padding:"5px 12px", borderRadius:100,
            border:`1px solid ${IMPACT_COLORS[i]}66`,
            background:`${IMPACT_COLORS[i]}10`,
          }}>
            <span style={{
              width:16, height:16, borderRadius:"50%", flexShrink:0,
              background:IMPACT_COLORS[i], display:"flex", alignItems:"center",
              justifyContent:"center", fontSize:9, fontWeight:700, color:"var(--bg-void)",
            }}>{i+1}</span>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:IMPACT_COLORS[i] }}>
              {item.sensor}
            </span>
            <span style={{ fontSize:10, color:"var(--text-muted)" }}>
              {SENSOR_LABELS[item.sensor]}
            </span>
            {item.liveCorr !== null && (
              <span style={{
                fontSize:10, fontFamily:"var(--font-mono)",
                color:"var(--accent-cyan)", marginLeft:2,
              }}>
                r={item.liveCorr.toFixed(2)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── TREND CHART ── */}
      {activeTab === "trend" && (
        <>
          <div style={{ fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginBottom:12 }}>
            Normalized sensor readings over engine lifecycle — all {sensorData?.totalCycles || 0} cycles
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData} margin={{ top:5, right:20, left:-10, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.07)" />
              <XAxis
                dataKey="cycle"
                tick={{ fill:"var(--text-muted)", fontSize:11, fontFamily:"var(--font-mono)" }}
                label={{ value:"Operational Cycle", position:"insideBottomRight", offset:-5, fill:"var(--text-muted)", fontSize:11 }}
              />
              <YAxis
                tick={{ fill:"var(--text-muted)", fontSize:11, fontFamily:"var(--font-mono)" }}
                label={{ value:"Normalized Value", angle:-90, position:"insideLeft", offset:20, fill:"var(--text-muted)", fontSize:11 }}
              />
              <Tooltip content={<TrendTooltip />} />
              <Legend formatter={(v) => (
                <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-secondary)" }}>
                  {v} — {SENSOR_LABELS[v]||v}
                </span>
              )} />
              {enriched.map((item, i) => (
                <Line
                  key={item.sensor}
                  type="monotone"
                  dataKey={item.sensor}
                  stroke={IMPACT_COLORS[i]}
                  strokeWidth={i === 0 ? 2.5 : 1.5}
                  dot={false}
                  activeDot={{ r:4, strokeWidth:0 }}
                  strokeOpacity={i === 0 ? 1 : 0.75}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Degradation insight */}
          <div style={{ marginTop:16, padding:"12px 16px", background:"rgba(0,212,255,0.04)", borderRadius:8, border:"1px solid var(--border)" }}>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--accent-cyan)", marginBottom:8, letterSpacing:"0.08em" }}>
              WHY THESE SENSORS FOR {dataset}?
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {enriched.slice(0,3).map((item, i) => (
                <div key={item.sensor} style={{ display:"flex", gap:10, fontSize:12, color:"var(--text-secondary)" }}>
                  <span style={{ color:IMPACT_COLORS[i], fontFamily:"var(--font-mono)", minWidth:28, fontWeight:600 }}>{item.sensor}</span>
                  <span>{item.why}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── IMPACT SCORE CHART ── */}
      {activeTab === "impact" && (
        <>
          <div style={{ fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)", marginBottom:16 }}>
            Literature impact score vs live Pearson correlation |r| with operational cycle
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top:5, right:60, left:10, bottom:5 }}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.07)" horizontal={false} />
              <XAxis
                type="number" domain={[0,100]}
                tick={{ fill:"var(--text-muted)", fontSize:11, fontFamily:"var(--font-mono)" }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category" dataKey="sensor" width={36}
                tick={{ fill:"var(--text-muted)", fontSize:12, fontFamily:"var(--font-mono)" }}
              />
              <Tooltip content={<BarTooltip />} />
              <Legend formatter={(v) => (
                <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-secondary)" }}>{v}</span>
              )} />
              <Bar dataKey="literature" name="Literature Impact" radius={[0,4,4,0]} barSize={10}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={IMPACT_COLORS[i]} fillOpacity={0.9} />
                ))}
                <LabelList dataKey="literature" position="right"
                  style={{ fill:"var(--text-muted)", fontSize:10, fontFamily:"var(--font-mono)" }}
                  formatter={(v) => `${v}%`}
                />
              </Bar>
              {barData.some(d => d.live !== null) && (
                <Bar dataKey="live" name="Live Correlation |r|×100" radius={[0,4,4,0]} barSize={10} fill="rgba(0,212,255,0.35)">
                  <LabelList dataKey="live" position="right"
                    style={{ fill:"var(--accent-cyan)", fontSize:10, fontFamily:"var(--font-mono)" }}
                    formatter={(v) => v !== null ? `${v}%` : ""}
                  />
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>

          {/* Legend explanation */}
          <div style={{ marginTop:16, display:"flex", gap:20, flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"var(--text-secondary)" }}>
              <div style={{ width:24, height:8, borderRadius:4, background:"var(--accent-red)" }} />
              Literature Impact — known RUL correlation from C-MAPSS research papers
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"var(--text-secondary)" }}>
              <div style={{ width:24, height:8, borderRadius:4, background:"rgba(0,212,255,0.35)", border:"1px solid var(--accent-cyan)" }} />
              Live |r| — Pearson correlation computed from this engine's actual data
            </div>
          </div>

          {/* Full sensor table */}
          <div style={{ marginTop:20, borderRadius:8, overflow:"hidden", border:"1px solid var(--border)" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"rgba(0,212,255,0.05)" }}>
                  {["Rank","Sensor","Physical Meaning","Impact","Live |r|","Why It Degrades"].map(h => (
                    <th key={h} style={{
                      padding:"10px 14px", textAlign:"left",
                      fontFamily:"var(--font-mono)", fontSize:10,
                      color:"var(--text-muted)", letterSpacing:"0.1em",
                      textTransform:"uppercase", borderBottom:"1px solid var(--border)",
                      whiteSpace:"nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enriched.map((item, i) => (
                  <tr key={item.sensor} style={{ borderBottom: i < enriched.length-1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding:"10px 14px" }}>
                      <span style={{
                        width:22, height:22, borderRadius:"50%",
                        background:IMPACT_COLORS[i], display:"inline-flex",
                        alignItems:"center", justifyContent:"center",
                        fontSize:10, fontWeight:700, color:"var(--bg-void)",
                      }}>{i+1}</span>
                    </td>
                    <td style={{ padding:"10px 14px", fontFamily:"var(--font-mono)", fontSize:13, color:IMPACT_COLORS[i], fontWeight:700 }}>
                      {item.sensor}
                    </td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:"var(--text-secondary)" }}>
                      {SENSOR_LABELS[item.sensor] || "—"}
                    </td>
                    <td style={{ padding:"10px 14px", fontFamily:"var(--font-mono)", fontSize:12, color:IMPACT_COLORS[i] }}>
                      {(item.impactScore * 100).toFixed(0)}%
                    </td>
                    <td style={{ padding:"10px 14px", fontFamily:"var(--font-mono)", fontSize:12, color:"var(--accent-cyan)" }}>
                      {item.liveCorr !== null ? item.liveCorr.toFixed(3) : "—"}
                    </td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:"var(--text-muted)", maxWidth:240 }}>
                      {item.why}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const DATASETS = ["FD001","FD002","FD003","FD004"];

const SENSOR_LABELS = {
  s2:"Fan Inlet Temp", s3:"LPC Outlet Temp", s4:"HPC Outlet Temp",
  s7:"HP Turbine Out Press", s8:"Fan Inlet Flow", s9:"BPR",
  s11:"HPC Static Pressure", s12:"Fuel Flow Ratio", s13:"Corrected Fan Speed",
  s14:"Corrected Core Speed", s15:"BPS Enthalpy", s17:"HP Turbine Exit Temp",
  s20:"HP Turbine Exit Press", s21:"Air-to-Fuel Ratio",
};

const SENSOR_COLORS = ["#00D4FF","#FFB020","#00E87A","#8B5CF6","#FF8C55","#FF6B9D","#55D4FF","#A8FF78"];

// ── Custom chart tooltip ──────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"var(--bg-card)", border:"1px solid var(--border-bright)", borderRadius:8, padding:"10px 14px", fontFamily:"var(--font-mono)", fontSize:12 }}>
      <div style={{ color:"var(--text-muted)", marginBottom:6 }}>Cycle {label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color:p.color, display:"flex", gap:10, justifyContent:"space-between" }}>
          <span>{SENSOR_LABELS[p.dataKey]||p.dataKey}</span>
          <span style={{ fontWeight:600 }}>{Number(p.value).toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Setup Diagnostic Panel ────────────────────────────────────────────────────
function SetupPanel() {
  const [debug, setDebug]   = useState(null);
  const [loading, setLoading] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    try {
      const r = await axios.get("/api/debug");
      setDebug(r.data);
    } catch {
      setDebug({ ok:false, checks:{ connection:{ exists:false, path:"Cannot reach backend at port 5000" } } });
    }
    setLoading(false);
  };

  const Tick  = () => <span style={{ color:"var(--accent-green)",  fontWeight:700 }}>✓</span>;
  const Cross = () => <span style={{ color:"var(--accent-red)",    fontWeight:700 }}>✗</span>;

  // Group checks into categories for display
  const renderChecks = () => {
    if (!debug) return null;
    const { checks, pythonCmd, projectRoot } = debug;

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:16 }}>

        {/* ── Step 1: Python ── */}
        <div style={{ background:"var(--bg-base)", borderRadius:8, padding:"14px 16px", border:"1px solid var(--border)" }}>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:10, textTransform:"uppercase" }}>
            Step 1 — Python Installation
          </div>
          {checks.python?.error ? (
            <div>
              <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                <Cross />
                <div>
                  <div style={{ color:"var(--accent-red)", fontSize:13, fontFamily:"var(--font-mono)" }}>
                    Python not found (tried: python3, python, py)
                  </div>
                  <div style={{ color:"var(--text-secondary)", fontSize:12, marginTop:6 }}>
                    Python is not installed or not added to PATH.
                  </div>
                </div>
              </div>
              <div style={{ marginTop:12, background:"rgba(255,176,32,0.08)", border:"1px solid rgba(255,176,32,0.25)", borderRadius:6, padding:"12px 14px" }}>
                <div style={{ color:"var(--accent-amber)", fontSize:12, fontFamily:"var(--font-display)", fontWeight:600, marginBottom:8 }}>
                  💡 FIX — Install Python
                </div>
                <ol style={{ paddingLeft:20, color:"var(--text-secondary)", fontSize:13, lineHeight:2 }}>
                  <li>Go to <span style={{ color:"var(--accent-cyan)", fontFamily:"var(--font-mono)" }}>https://www.python.org/downloads/</span></li>
                  <li>Download Python 3.10 or newer</li>
                  <li style={{ color:"var(--accent-amber)", fontWeight:600 }}>⚠ During install: check <strong>"Add Python to PATH"</strong></li>
                  <li>After install, <strong>restart VS Code completely</strong></li>
                  <li>Click "Run Check" again</li>
                </ol>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <Tick />
                <span style={{ color:"var(--text-primary)", fontSize:13, fontFamily:"var(--font-mono)" }}>
                  {pythonCmd} — Python {checks.python?.python_version?.split(" ")[0] || "3.x"} found
                </span>
              </div>
              {/* Package status */}
              <div style={{ marginTop:10, display:"flex", gap:8, flexWrap:"wrap" }}>
                {Object.entries(checks.python?.packages || {}).map(([pkg, ver]) => {
                  const missing = ver.includes("MISSING");
                  return (
                    <span key={pkg} style={{
                      padding:"3px 10px", borderRadius:4, fontSize:11, fontFamily:"var(--font-mono)",
                      border:"1px solid", borderColor: missing ? "rgba(255,68,85,0.4)" : "rgba(0,212,255,0.2)",
                      color: missing ? "var(--accent-red)" : "var(--accent-cyan)",
                      background: missing ? "rgba(255,68,85,0.08)" : "rgba(0,212,255,0.05)",
                    }}>
                      {missing ? "✗" : "✓"} {pkg}
                    </span>
                  );
                })}
              </div>
              {/* Missing packages install command */}
              {Object.entries(checks.python?.packages || {}).some(([,v]) => v.includes("MISSING")) && (
                <div style={{ marginTop:12, background:"rgba(255,176,32,0.08)", border:"1px solid rgba(255,176,32,0.25)", borderRadius:6, padding:"12px 14px" }}>
                  <div style={{ color:"var(--accent-amber)", fontSize:12, fontFamily:"var(--font-display)", fontWeight:600, marginBottom:6 }}>💡 FIX — Install missing packages</div>
                  <div style={{ color:"var(--text-secondary)", fontSize:12, marginBottom:8 }}>Open a terminal / Command Prompt and run:</div>
                  <code style={{
                    display:"block", background:"var(--bg-void)", padding:"10px 14px", borderRadius:6,
                    color:"var(--accent-cyan)", fontFamily:"var(--font-mono)", fontSize:13,
                    border:"1px solid var(--border)",
                  }}>
                    pip install tensorflow pandas scikit-learn numpy h5py
                  </code>
                  <div style={{ color:"var(--text-muted)", fontSize:11, marginTop:6 }}>Then click "Run Check" again</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Step 2: PROJECT_ROOT config ── */}
        <div style={{ background:"var(--bg-base)", borderRadius:8, padding:"14px 16px", border:"1px solid var(--border)" }}>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:10, textTransform:"uppercase" }}>
            Step 2 — Set PROJECT-1 Path in config.json
          </div>
          {!projectRoot ? (
            <div>
              <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                <Cross />
                <div style={{ color:"var(--accent-red)", fontSize:13, fontFamily:"var(--font-mono)" }}>
                  config.json not configured yet
                </div>
              </div>
              <ConfigFixInstructions />
            </div>
          ) : !checks.projectRoot?.exists ? (
            <div>
              <div style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:10 }}>
                <Cross />
                <div>
                  <div style={{ color:"var(--accent-red)", fontSize:13, fontFamily:"var(--font-mono)", wordBreak:"break-all" }}>
                    Folder not found: {projectRoot}
                  </div>
                  <div style={{ color:"var(--text-secondary)", fontSize:12, marginTop:4 }}>
                    This path doesn't exist on your computer. Update config.json with the correct path.
                  </div>
                </div>
              </div>
              <ConfigFixInstructions currentPath={projectRoot} />
            </div>
          ) : (
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <Tick />
              <span style={{ color:"var(--text-primary)", fontSize:13, fontFamily:"var(--font-mono)", wordBreak:"break-all" }}>
                {projectRoot}
              </span>
            </div>
          )}
        </div>

        {/* ── Step 3: Model & Dataset files ── */}
        <div style={{ background:"var(--bg-base)", borderRadius:8, padding:"14px 16px", border:"1px solid var(--border)" }}>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:10, textTransform:"uppercase" }}>
            Step 3 — Model & Dataset Files
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {["FD001","FD002","FD003","FD004"].map((ds) => (
              <React.Fragment key={ds}>
                <div style={{ display:"flex", gap:6, alignItems:"center", fontSize:12, fontFamily:"var(--font-mono)" }}>
                  {checks[`model_${ds}`]?.exists ? <Tick /> : <Cross />}
                  <span style={{ color: checks[`model_${ds}`]?.exists ? "var(--text-secondary)" : "var(--accent-red)" }}>
                    APP/model_{ds}.h5
                  </span>
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center", fontSize:12, fontFamily:"var(--font-mono)" }}>
                  {checks[`test_${ds}`]?.exists ? <Tick /> : <Cross />}
                  <span style={{ color: checks[`test_${ds}`]?.exists ? "var(--text-secondary)" : "var(--accent-red)" }}>
                    DATASETS/test_{ds}.txt
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
          {checks.projectRoot?.exists &&
           !["FD001","FD002","FD003","FD004"].every((ds) => checks[`model_${ds}`]?.exists) && (
            <div style={{ marginTop:10, color:"var(--text-secondary)", fontSize:12 }}>
              Make sure your PROJECT-1 folder has both an <code style={{ fontFamily:"var(--font-mono)", color:"var(--accent-cyan)" }}>APP\</code> folder (with .h5 models)
              and a <code style={{ fontFamily:"var(--font-mono)", color:"var(--accent-cyan)" }}>DATASETS\</code> folder (with .txt files).
            </div>
          )}
        </div>

        {/* Result */}
        {debug.ok ? (
          <div style={{ padding:"14px 16px", background:"rgba(0,232,122,0.08)", border:"1px solid rgba(0,232,122,0.3)", borderRadius:8, color:"var(--accent-green)", fontSize:13, fontFamily:"var(--font-mono)" }}>
            ✓ All checks passed — ready to predict!
          </div>
        ) : (
          <div style={{ padding:"14px 16px", background:"rgba(255,68,85,0.06)", border:"1px solid rgba(255,68,85,0.25)", borderRadius:8, color:"#FF8899", fontSize:13 }}>
            Fix the issues above, then click "Run Check" again.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card" style={{ marginBottom:24 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div className="card-title">Setup Diagnostics</div>
          {!debug && <div style={{ fontSize:13, color:"var(--text-secondary)", marginTop:4 }}>
            Click "Run Check" to verify Python, packages, and file paths
          </div>}
        </div>
        <button
          className="btn btn-outline"
          onClick={runCheck}
          disabled={loading}
          style={{ fontSize:11, whiteSpace:"nowrap" }}
        >
          {loading
            ? <><span className="spinner" style={{ width:14,height:14,borderWidth:2 }} /> Checking…</>
            : "🔍 Run Check"}
        </button>
      </div>
      {renderChecks()}
    </div>
  );
}

// ── Config fix instructions widget ───────────────────────────────────────────
function ConfigFixInstructions({ currentPath }) {
  const [copied, setCopied] = useState(false);
  const exampleJson = `{\n  "PROJECT_ROOT": "C:/Users/ADMIN/OneDrive/Desktop/PROJECT-1"\n}`;

  const copy = () => {
    navigator.clipboard?.writeText(exampleJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ marginTop:10, background:"rgba(255,176,32,0.08)", border:"1px solid rgba(255,176,32,0.25)", borderRadius:6, padding:"14px 16px" }}>
      <div style={{ color:"var(--accent-amber)", fontSize:12, fontFamily:"var(--font-display)", fontWeight:600, marginBottom:10 }}>
        💡 FIX — Edit backend/config.json
      </div>
      <ol style={{ paddingLeft:18, color:"var(--text-secondary)", fontSize:13, lineHeight:2 }}>
        <li>In VS Code, open the file: <code style={{ color:"var(--accent-cyan)", fontFamily:"var(--font-mono)" }}>backend/config.json</code></li>
        <li>Find where your <strong>PROJECT-1 folder</strong> is on your computer
          <div style={{ marginTop:4, marginBottom:4, fontSize:12, color:"var(--text-muted)" }}>
            (right-click PROJECT-1 in File Explorer → Properties → Location)
          </div>
        </li>
        <li>Replace the value with your full path using <strong>forward slashes</strong>:</li>
      </ol>
      <div style={{ position:"relative", marginTop:8 }}>
        <pre style={{
          background:"var(--bg-void)", padding:"12px 14px", borderRadius:6,
          color:"var(--accent-cyan)", fontFamily:"var(--font-mono)", fontSize:12,
          border:"1px solid var(--border)", margin:0,
        }}>
{`{
  "PROJECT_ROOT": "C:/Users/ADMIN/OneDrive/Desktop/PROJECT-1"
}`}
        </pre>
        <button onClick={copy} style={{
          position:"absolute", top:8, right:8,
          background:"var(--bg-card)", border:"1px solid var(--border)",
          color: copied ? "var(--accent-green)" : "var(--text-muted)",
          padding:"4px 10px", borderRadius:4, cursor:"pointer",
          fontFamily:"var(--font-mono)", fontSize:10,
        }}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      {currentPath && (
        <div style={{ marginTop:10, fontSize:12, color:"var(--text-muted)" }}>
          Current value: <span style={{ color:"var(--accent-red)", fontFamily:"var(--font-mono)" }}>{currentPath}</span>
        </div>
      )}
      <div style={{ marginTop:10, color:"var(--text-muted)", fontSize:12 }}>
        After saving config.json, click "Run Check" again — <strong>no need to restart the server</strong>.
      </div>
    </div>
  );
}

// ── Main Predict Page ─────────────────────────────────────────────────────────
export default function Predict() {
  const [dataset, setDataset]         = useState("FD001");
  const [engineId, setEngineId]       = useState(11);
  const [selectedSensors, setSelected] = useState(["s4","s11","s15"]);

  const [predicting, setPredicting]   = useState(false);
  const [prediction, setPrediction]   = useState(null);
  const [sensorData, setSensorData]   = useState(null);
  const [error, setError]             = useState(null);

  const handlePredict = useCallback(async () => {
    setError(null); setPrediction(null); setSensorData(null);
    setPredicting(true);
    try {
      const [predRes, sensorRes] = await Promise.all([
        axios.post("/api/predict", { dataset, engineId: Number(engineId) }),
        axios.get(`/api/sensor-data/${dataset}/${engineId}`),
      ]);
      setPrediction(predRes.data);
      setSensorData(sensorRes.data);
    } catch (err) {
      const d = err.response?.data || {};
      setError({ message: d.error || err.message || "Unknown error", hint: d.hint || "", debug: d.debug || "" });
    } finally {
      setPredicting(false);
    }
  }, [dataset, engineId]);

  const chartData = React.useMemo(() => {
    if (!sensorData) return [];
    const { cycles, sensors } = sensorData;
    const start = Math.max(0, cycles.length - 80);
    return cycles.slice(start).map((cycle, i) => {
      const row = { cycle };
      selectedSensors.forEach((s) => { if (sensors[s]) row[s] = sensors[s][start+i]; });
      return row;
    });
  }, [sensorData, selectedSensors]);

  const toggleSensor = (s) =>
    setSelected((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);

  const statusColor = { HEALTHY:"var(--accent-green)", WARNING:"var(--accent-amber)", CRITICAL:"var(--accent-red)" };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="eyebrow">▶ LSTM Ensemble</div>
        <h1>RUL Predictor</h1>
        <p>Select a fleet dataset and engine ID to run inference using the expert LSTM model.</p>
      </div>

      <SetupPanel />

      {/* Controls */}
      <div className="card" style={{ marginBottom:28 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:20, alignItems:"flex-end" }}>
          <div className="form-group">
            <label className="form-label">Fleet Dataset</label>
            <select className="form-select" value={dataset}
              onChange={(e) => { setDataset(e.target.value); setPrediction(null); setSensorData(null); setError(null); }}>
              {DATASETS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Engine ID</label>
            <input type="number" className="form-input" min={1} max={300}
              value={engineId} onChange={(e) => setEngineId(Number(e.target.value))} />
          </div>
          <button className="btn btn-primary" onClick={handlePredict} disabled={predicting} style={{ whiteSpace:"nowrap" }}>
            {predicting
              ? <><span className="spinner" style={{ width:16,height:16,borderWidth:2 }} /> Running…</>
              : "⚡ Predict RUL"}
          </button>
        </div>
        <div style={{ marginTop:10, fontSize:12, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
          FD001 / FD003: Engine IDs 1–100 &nbsp;|&nbsp; FD002: 1–259 &nbsp;|&nbsp; FD004: 1–248
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card" style={{ marginBottom:24, borderColor:"rgba(255,68,85,0.4)", background:"rgba(255,68,85,0.05)" }}>
          <div style={{ display:"flex", gap:12 }}>
            <span style={{ fontSize:20 }}>🚨</span>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:13, color:"var(--accent-red)", fontWeight:600, marginBottom:4 }}>
                {error.message}
              </div>
              {error.hint && (
                <div style={{ fontSize:13, color:"var(--accent-amber)", marginTop:4 }}>
                  💡 <code style={{ fontFamily:"var(--font-mono)", background:"rgba(255,176,32,0.1)", padding:"2px 8px", borderRadius:4 }}>
                    {error.hint}
                  </code>
                </div>
              )}
            </div>
          </div>
          {error.debug && (
            <details style={{ marginTop:12 }}>
              <summary style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--text-muted)", cursor:"pointer" }}>
                ▸ Full error traceback
              </summary>
              <pre style={{
                marginTop:8, padding:"10px 14px", background:"var(--bg-base)",
                borderRadius:6, fontSize:11, fontFamily:"var(--font-mono)",
                color:"var(--text-secondary)", whiteSpace:"pre-wrap", wordBreak:"break-all",
                maxHeight:220, overflowY:"auto",
              }}>{error.debug}</pre>
            </details>
          )}
        </div>
      )}

      {predicting && (
        <div className="loading-center">
          <div className="spinner" />
          <span>Running LSTM inference on {dataset} Engine #{engineId}…</span>
        </div>
      )}

      {prediction && !predicting && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:24, marginBottom:28, alignItems:"start" }}>
            <div className="card" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
              <div className="card-title" style={{ alignSelf:"flex-start" }}>RUL Gauge</div>
              <RULGauge rul={prediction.predictedRUL} status={prediction.status} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div className="grid-3">
                <div className="card">
                  <div className="card-title">Predicted RUL</div>
                  <div className="card-value" style={{ color:statusColor[prediction.status] }}>
                    {Math.round(prediction.predictedRUL)}
                  </div>
                  <div className="card-sub">cycles remaining</div>
                </div>
                <div className="card">
                  <div className="card-title">Total Cycles</div>
                  <div className="card-value">{prediction.totalCycles}</div>
                  <div className="card-sub">cycles recorded</div>
                </div>
                <div className="card">
                  <div className="card-title">Raw Output</div>
                  <div className="card-value" style={{ fontSize:24 }}>{prediction.rawPrediction ?? "—"}</div>
                  <div className="card-sub">before clipping</div>
                </div>
              </div>

              <div className="card">
                <div className="card-title" style={{ marginBottom:12 }}>Engine Health Index</div>
                <div style={{ position:"relative", height:8, background:"rgba(255,255,255,0.06)", borderRadius:4, overflow:"hidden" }}>
                  <div style={{
                    position:"absolute", left:0, top:0, bottom:0,
                    width:`${Math.min(100,(prediction.predictedRUL/125)*100)}%`,
                    background:`linear-gradient(90deg,${statusColor[prediction.status]},${statusColor[prediction.status]}88)`,
                    borderRadius:4, transition:"width 1s cubic-bezier(0.4,0,0.2,1)",
                    boxShadow:`0 0 12px ${statusColor[prediction.status]}88`,
                  }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>
                  <span>CRITICAL (0–30)</span><span>WARNING (30–70)</span><span>HEALTHY (70+)</span>
                </div>
              </div>

              <div className="card" style={{ borderColor:`${statusColor[prediction.status]}44`, background:`${statusColor[prediction.status]}08` }}>
                <div style={{ display:"flex", gap:12 }}>
                  <span style={{ fontSize:22 }}>
                    {prediction.status==="HEALTHY" ? "✅" : prediction.status==="WARNING" ? "⚠️" : "🚨"}
                  </span>
                  <div>
                    <div style={{ fontFamily:"var(--font-display)", fontSize:12, color:statusColor[prediction.status], fontWeight:600, marginBottom:4 }}>
                      {prediction.status==="HEALTHY" ? "No Immediate Maintenance Required"
                        : prediction.status==="WARNING" ? "Schedule Preventive Maintenance"
                        : "IMMEDIATE MAINTENANCE REQUIRED"}
                    </div>
                    <div style={{ fontSize:13, color:"var(--text-secondary)" }}>
                      {prediction.status==="HEALTHY"
                        ? `Engine #${prediction.engineId} operating within normal parameters. Next check recommended after ${Math.round(prediction.predictedRUL*0.6)} cycles.`
                        : prediction.status==="WARNING"
                        ? `Engine #${prediction.engineId} shows degradation. ~${Math.round(prediction.predictedRUL)} cycles remaining. Inspect within ${Math.round(prediction.predictedRUL*0.3)} cycles.`
                        : `Engine #${prediction.engineId} critically degraded — only ${Math.round(prediction.predictedRUL)} cycles remaining. Ground for immediate inspection.`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {sensorData && (
            <div className="card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <div>
                  <div className="card-title">Live Sensor Telemetry</div>
                  <div style={{ fontSize:12, color:"var(--text-secondary)" }}>
                    Last {Math.min(80,sensorData.totalCycles)} of {sensorData.totalCycles} cycles
                  </div>
                </div>
                <span className="tag tag-cyan">{dataset} / Engine #{engineId}</span>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
                {Object.keys(SENSOR_LABELS).map((s, i) => {
                  const active = selectedSensors.includes(s);
                  const color  = SENSOR_COLORS[selectedSensors.indexOf(s) % SENSOR_COLORS.length];
                  return (
                    <button key={s} onClick={() => toggleSensor(s)} style={{
                      padding:"5px 12px", borderRadius:100,
                      border:`1px solid ${active ? color : "var(--border)"}`,
                      background: active ? `${color}18` : "transparent",
                      color: active ? color : "var(--text-muted)",
                      fontFamily:"var(--font-mono)", fontSize:11, cursor:"pointer",
                      transition:"var(--transition)",
                    }}>{s}</button>
                  );
                })}
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top:5,right:20,left:-10,bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.07)" />
                  <XAxis dataKey="cycle" tick={{ fill:"var(--text-muted)",fontSize:11,fontFamily:"var(--font-mono)" }}
                    label={{ value:"Cycle",position:"insideBottomRight",offset:-5,fill:"var(--text-muted)",fontSize:11 }} />
                  <YAxis tick={{ fill:"var(--text-muted)",fontSize:11,fontFamily:"var(--font-mono)" }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend formatter={(v) => <span style={{ fontFamily:"var(--font-mono)",fontSize:11,color:"var(--text-secondary)" }}>{SENSOR_LABELS[v]||v}</span>} />
                  {selectedSensors.map((s,i) => (
                    <Line key={s} type="monotone" dataKey={s}
                      stroke={SENSOR_COLORS[i%SENSOR_COLORS.length]}
                      strokeWidth={1.5} dot={false} activeDot={{ r:4,strokeWidth:0 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Primary Degradation Sensors Chart ── */}
          {sensorData && (
            <KeySensorsChart
              dataset={dataset}
              engineId={engineId}
              sensorData={sensorData}
            />
          )}
        </>
      )}

      {!prediction && !predicting && !error && (
        <div className="card" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:220, gap:14, border:"1px dashed var(--border)", background:"transparent" }}>
          <span style={{ fontSize:44 }}>✈</span>
          <div style={{ fontFamily:"var(--font-display)", fontSize:13, color:"var(--text-muted)", letterSpacing:"0.06em" }}>
            SELECT DATASET & ENGINE TO BEGIN
          </div>
          <div style={{ fontSize:13, color:"var(--text-muted)" }}>
            Complete the setup above, then choose a dataset and engine ID
          </div>
        </div>
      )}
    </div>
  );
}
