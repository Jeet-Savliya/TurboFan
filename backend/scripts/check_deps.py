"""
check_deps.py — called by /api/debug to verify Python environment
Outputs JSON: { python_version, packages: { name: version|error }, ok: bool }
"""
import sys
import json

packages = {}
required = ["tensorflow", "pandas", "numpy", "sklearn", "h5py"]

for pkg in required:
    try:
        mod = __import__(pkg)
        packages[pkg] = getattr(mod, "__version__", "installed")
    except ImportError as e:
        packages[pkg] = f"MISSING — {e}"

all_ok = all("MISSING" not in v for v in packages.values())

print(json.dumps({
    "python_version": sys.version,
    "packages": packages,
    "all_ok": all_ok,
}))
