const express = require("express");
const router  = express.Router();
const { spawn } = require("child_process");
const path = require("path");
const fs   = require("fs");

// ── Get project root from config.json ────────────────────────────────────────
function getProjectRoot() {
  try {
    const cfgPath = path.join(__dirname, "../config.json");
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    if (cfg.PROJECT_ROOT && cfg.PROJECT_ROOT !== "PASTE_YOUR_PATH_HERE") {
      return cfg.PROJECT_ROOT;
    }
  } catch {}
  return null;
}

// ── Get the Python command auto-detected by server.js ────────────────────────
function getPython(req) {
  // req may not always be passed — fall back through the app reference
  try {
    return req.app.get("pythonCmd") || "python";
  } catch {
    return "python";
  }
}

// ── Spawn Python and return { stdout, stderr, code } ─────────────────────────
function runPython(pythonCmd, scriptPath, args) {
  return new Promise((resolve) => {
    const proc = spawn(pythonCmd, [scriptPath, ...args]);
    let stdout = "", stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ stdout, stderr, code }));
    proc.on("error", (err)  => resolve({
      stdout: "",
      stderr: `Cannot start "${pythonCmd}": ${err.message}\n\nMake sure Python is installed and added to PATH.\nDownload: https://www.python.org`,
      code: -1,
    }));
  });
}

// ── GET /api/debug ────────────────────────────────────────────────────────────
router.get("/debug", async (req, res) => {
  const projectRoot = getProjectRoot();
  const pythonCmd   = getPython(req);
  const checks      = {};

  // Config check
  checks.config = {
    path:    path.join(__dirname, "../config.json"),
    value:   projectRoot || "NOT SET — edit backend/config.json",
    exists:  !!projectRoot,
  };

  // Project root exists on disk
  if (projectRoot) {
    checks.projectRoot = {
      path:   projectRoot,
      exists: fs.existsSync(projectRoot),
    };
  }

  // Model + dataset files
  ["FD001","FD002","FD003","FD004"].forEach((ds) => {
    const root = projectRoot || "NOT_CONFIGURED";
    const mp   = path.join(root, "APP",      `model_${ds}.h5`);
    const dp   = path.join(root, "DATASETS", `test_${ds}.txt`);
    checks[`model_${ds}`] = { path: mp, exists: projectRoot ? fs.existsSync(mp) : false };
    checks[`test_${ds}`]  = { path: dp, exists: projectRoot ? fs.existsSync(dp) : false };
  });

  // Python + deps
  const pyRes = await runPython(
    pythonCmd,
    path.join(__dirname, "../scripts/check_deps.py"),
    []
  );
  try {
    checks.python = { ...JSON.parse(pyRes.stdout.trim()), cmd: pythonCmd };
  } catch {
    checks.python = {
      cmd:   pythonCmd,
      error: pyRes.stderr || "check_deps.py failed to run",
      all_ok: false,
    };
  }

  const allOk =
    !!projectRoot &&
    checks.projectRoot?.exists &&
    ["FD001","FD002","FD003","FD004"].every((ds) =>
      checks[`model_${ds}`].exists && checks[`test_${ds}`].exists
    ) &&
    checks.python?.all_ok;

  res.json({ ok: allOk, pythonCmd, projectRoot, checks });
});

// ── POST /api/predict ─────────────────────────────────────────────────────────
router.post("/predict", async (req, res) => {
  const { dataset, engineId } = req.body;
  if (!dataset || !engineId)
    return res.status(400).json({ error: "dataset and engineId are required" });

  const projectRoot = getProjectRoot();
  if (!projectRoot)
    return res.status(500).json({
      error: "PROJECT_ROOT not configured",
      hint:  "Edit backend/config.json — set PROJECT_ROOT to the full path of your PROJECT-1 folder",
    });

  const pythonCmd = getPython(req);

  const { stdout, stderr, code } = await runPython(
    pythonCmd,
    path.join(__dirname, "../scripts/predict.py"),
    ["--dataset", dataset, "--engine_id", String(engineId), "--project_root", projectRoot]
  );

  if (code !== 0) {
    const lines   = stderr.trim().split("\n").filter(Boolean);
    const lastErr = lines[lines.length - 1] || "Unknown Python error";
    console.error(`[predict] Python exit ${code}:\n${stderr}`);
    return res.status(500).json({
      error: lastErr,
      hint:  getHint(lastErr),
      debug: stderr.slice(-1500),
    });
  }

  try {
    res.json(JSON.parse(stdout.trim()));
  } catch {
    res.status(500).json({ error: "Could not parse Python output", raw: stdout.slice(0, 400) });
  }
});

// ── GET /api/sensor-data/:dataset/:engineId ───────────────────────────────────
router.get("/sensor-data/:dataset/:engineId", async (req, res) => {
  const { dataset, engineId } = req.params;

  const projectRoot = getProjectRoot();
  if (!projectRoot)
    return res.status(500).json({ error: "PROJECT_ROOT not configured — edit backend/config.json" });

  const pythonCmd = getPython(req);

  const { stdout, stderr, code } = await runPython(
    pythonCmd,
    path.join(__dirname, "../scripts/get_sensor_data.py"),
    ["--dataset", dataset, "--engine_id", engineId, "--project_root", projectRoot]
  );

  if (code !== 0) {
    const lines = stderr.trim().split("\n").filter(Boolean);
    return res.status(500).json({
      error: lines[lines.length - 1] || "Unknown error",
      debug: stderr.slice(-600),
    });
  }

  try {
    res.json(JSON.parse(stdout.trim()));
  } catch {
    res.status(500).json({ error: "Could not parse sensor data output" });
  }
});

// ── GET /api/datasets ─────────────────────────────────────────────────────────
router.get("/datasets", (_req, res) => {
  res.json({
    datasets: [
      { name:"FD001", conditions:1, faultModes:1, trainEngines:100, testEngines:100  },
      { name:"FD002", conditions:6, faultModes:1, trainEngines:260, testEngines:259  },
      { name:"FD003", conditions:1, faultModes:2, trainEngines:100, testEngines:100  },
      { name:"FD004", conditions:6, faultModes:2, trainEngines:249, testEngines:248  },
    ],
  });
});

// ── Hint helper ───────────────────────────────────────────────────────────────
function getHint(msg) {
  const m = msg.toLowerCase();
  if (m.includes("python was not found") || m.includes("cannot start"))
    return "Python not in PATH — reinstall Python from python.org and check 'Add Python to PATH'";
  if (m.includes("no module named 'tensorflow'") || m.includes("no module named tensorflow"))
    return "Run:  pip install tensorflow";
  if (m.includes("no module named 'keras'"))
    return "Run:  pip install keras tensorflow";
  if (m.includes(".h5") && m.includes("no such file"))
    return "Model .h5 not found — check PROJECT_ROOT in backend/config.json";
  if (m.includes("no such file") || m.includes("not found:"))
    return "Path not found — update PROJECT_ROOT in backend/config.json with the correct absolute path";
  if (m.includes("not found in") || m.includes("engine #"))
    return "Engine ID not in dataset — try IDs 1–100 for FD001/FD003, 1–259 for FD002, 1–248 for FD004";
  return "Check backend/config.json — make sure PROJECT_ROOT points to your PROJECT-1 folder";
}

module.exports = router;
