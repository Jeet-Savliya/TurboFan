const express = require("express");
const cors    = require("cors");
const { execSync } = require("child_process");
const apiRoutes = require("./routes/api");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Auto-detect Python command ────────────────────────────────────────────────
// Windows uses "python", Linux/Mac use "python3". We try both.
function detectPython() {
  const candidates = ["python3", "python", "py"];
  for (const cmd of candidates) {
    try {
      const out = execSync(`${cmd} --version 2>&1`).toString();
      if (out.toLowerCase().includes("python 3")) {
        console.log(`✅ Python found: "${cmd}" (${out.trim()})`);
        return cmd;
      }
    } catch {}
  }
  return null;
}

const pythonCmd = detectPython();
if (!pythonCmd) {
  console.warn("⚠️  Python 3 not found in PATH. Make sure Python is installed and added to PATH.");
  console.warn("    Download from https://www.python.org — check 'Add to PATH' during install.");
}

// Export so api.js can use it
app.set("pythonCmd", pythonCmd || "python");

// Middleware
app.use(cors({ origin: ["http://localhost:3000", "http://127.0.0.1:3000"] }));
app.use(express.json());

// Routes
app.use("/api", apiRoutes);

// Health
app.get("/health", (_req, res) => {
  res.json({ status: "ok", pythonCmd, timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 RUL Backend running → http://localhost:${PORT}`);
  console.log(`   Debug check        → http://localhost:${PORT}/api/debug\n`);
});
