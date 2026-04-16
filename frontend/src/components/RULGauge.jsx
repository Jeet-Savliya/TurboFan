import React, { useEffect, useState } from "react";

const STATUS_COLOR = {
  HEALTHY:  "var(--accent-green)",
  WARNING:  "var(--accent-amber)",
  CRITICAL: "var(--accent-red)",
};

const STATUS_GLOW = {
  HEALTHY:  "var(--glow-green)",
  WARNING:  "var(--glow-amber)",
  CRITICAL: "var(--glow-red)",
};

/**
 * Animated SVG arc gauge showing predicted RUL.
 * maxRUL = 125 (clamp used in model)
 */
export default function RULGauge({ rul, status, maxRUL = 125 }) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    let frame;
    let start = null;
    const duration = 1200;
    const target = rul ?? 0;

    function step(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated(target * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [rul]);

  // Arc geometry (180° sweep, bottom-center to top)
  const size = 220;
  const cx = size / 2;
  const cy = size / 2 + 20;
  const r = 85;

  // Start angle = 210°, End angle = -30° (240° sweep)
  const startAngle = 210;
  const sweepAngle = 240;

  const toRad = (deg) => (deg * Math.PI) / 180;

  const polarToXY = (angle) => ({
    x: cx + r * Math.cos(toRad(angle)),
    y: cy + r * Math.sin(toRad(angle)),
  });

  const pct = Math.min(animated / maxRUL, 1);
  const currentAngle = startAngle + sweepAngle * pct;

  const bgStart = polarToXY(startAngle);
  const bgEnd   = polarToXY(startAngle + sweepAngle);
  const fgEnd   = polarToXY(currentAngle);

  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;
  const progressSweep = sweepAngle * pct;
  const fgPath = progressSweep > 0
    ? `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 ${progressSweep > 180 ? 1 : 0} 1 ${fgEnd.x} ${fgEnd.y}`
    : "";

  const color = STATUS_COLOR[status] || STATUS_COLOR.HEALTHY;
  const glow  = STATUS_GLOW[status]  || STATUS_GLOW.HEALTHY;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ filter: status === "CRITICAL" ? "drop-shadow(0 0 12px rgba(255,68,85,0.5))" : "none" }}
      >
        {/* Tick marks */}
        {Array.from({ length: 13 }).map((_, i) => {
          const tickAngle = startAngle + (sweepAngle / 12) * i;
          const inner = polarToXY2(cx, cy, r - 10, tickAngle);
          const outer = polarToXY2(cx, cy, r + 4, tickAngle);
          const tickPct = i / 12;
          return (
            <line
              key={i}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke={tickPct <= pct ? color : "rgba(255,255,255,0.08)"}
              strokeWidth={i % 3 === 0 ? 2 : 1}
            />
          );
        })}

        {/* Track */}
        <path
          d={bgPath}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Progress arc */}
        {fgPath && (
          <path
            d={fgPath}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${color})`,
              transition: "stroke 0.4s ease",
            }}
          />
        )}

        {/* Center value */}
        <text
          x={cx}
          y={cy - 12}
          textAnchor="middle"
          fill={color}
          fontFamily="'Orbitron', monospace"
          fontWeight="700"
          fontSize="36"
        >
          {Math.round(animated)}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          fill="rgba(255,255,255,0.4)"
          fontFamily="'Share Tech Mono', monospace"
          fontSize="11"
          letterSpacing="0.1em"
        >
          CYCLES REMAINING
        </text>

        {/* Min / Max labels */}
        <text
          x={bgStart.x - 6}
          y={bgStart.y + 16}
          textAnchor="middle"
          fill="rgba(255,255,255,0.3)"
          fontFamily="'Share Tech Mono', monospace"
          fontSize="10"
        >0</text>
        <text
          x={bgEnd.x + 6}
          y={bgEnd.y + 16}
          textAnchor="middle"
          fill="rgba(255,255,255,0.3)"
          fontFamily="'Share Tech Mono', monospace"
          fontSize="10"
        >{maxRUL}</text>
      </svg>

      {/* Status badge */}
      <span
        className={`badge badge-${status?.toLowerCase()}`}
        style={{ marginTop: 4 }}
      >
        <span
          style={{
            width: 6, height: 6,
            borderRadius: "50%",
            background: color,
            boxShadow: glow,
            display: "inline-block",
          }}
        />
        {status}
      </span>
    </div>
  );
}

function polarToXY2(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
