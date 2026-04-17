"""
predict.py — LSTM RUL inference script called by Node.js backend
Outputs JSON on stdout. All errors exit with code 1 and message on stderr.

Fixes vs original:
- Pandas 3.x: groupby drops key cols → use .loc in-place scaling instead
- Explicit 63-feature list: s1..s21, s1_mean..s21_mean, s1_std..s21_std
- min_periods=1 on rolling to avoid NaN at start
- Clear error messages for each failure mode
"""

import argparse
import json
import sys
import os
import warnings
warnings.filterwarnings("ignore")


def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset",      required=True)
    parser.add_argument("--engine_id",    type=int, required=True)
    parser.add_argument("--project_root", required=True)
    args = parser.parse_args()

    # ── Validate paths ────────────────────────────────────────────────────────
    model_path = os.path.join(args.project_root, "APP",      f"model_{args.dataset}.h5")
    test_path  = os.path.join(args.project_root, "DATASETS", f"test_{args.dataset}.txt")

    if not os.path.isdir(args.project_root):
        die(f"PROJECT_ROOT not found: {args.project_root}  →  update backend/config.json")
    if not os.path.isfile(model_path):
        die(f"Model file not found: {model_path}")
    if not os.path.isfile(test_path):
        die(f"Dataset file not found: {test_path}")

    # ── Imports (after path check so missing TF gives a clear message) ────────
    try:
        import numpy as np
        import pandas as pd
        from sklearn.preprocessing import StandardScaler
    except ImportError as e:
        die(f"Missing package: {e}  →  run: pip install pandas scikit-learn numpy")

    try:
        os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
        import tensorflow as tf
    except ImportError:
        die("tensorflow not installed  →  run: pip install tensorflow")

    # ── Column definitions ────────────────────────────────────────────────────
    sensor_cols  = [f"s{i}" for i in range(1, 22)]
    setting_cols = ["set1", "set2", "set3"]
    cols         = ["id", "cycle"] + setting_cols + sensor_cols

    # Explicit 63 features matching training exactly (21 raw + 21 mean + 21 std)
    features_63 = (
        sensor_cols
        + [f"{s}_mean" for s in sensor_cols]
        + [f"{s}_std"  for s in sensor_cols]
    )

    # ── Load & filter ─────────────────────────────────────────────────────────
    df        = pd.read_csv(test_path, sep=r"\s+", header=None, names=cols)
    engine_df = df[df["id"] == args.engine_id].copy().reset_index(drop=True)

    if engine_df.empty:
        die(f"Engine #{args.engine_id} not found in {args.dataset}  "
            f"(valid: 1–{int(df['id'].max())})")

    # Cast to float to avoid pandas strict casting TypeErrors
    engine_df[sensor_cols] = engine_df[sensor_cols].astype("float64")

    # ── Per-condition scaling (pandas-3.x safe: scale in-place via .loc) ─────
    for _, idx in engine_df.groupby(setting_cols).groups.items():
        scaler = StandardScaler()
        engine_df.loc[idx, sensor_cols] = scaler.fit_transform(
            engine_df.loc[idx, sensor_cols]
        )

    # ── Rolling features (min_periods=1 avoids NaN at the start) ─────────────
    for s in sensor_cols:
        engine_df[f"{s}_mean"] = engine_df[s].rolling(5, min_periods=1).mean()
        engine_df[f"{s}_std"]  = engine_df[s].rolling(5, min_periods=1).std().fillna(0.0)

    # ── Build (1, 5, 63) input tensor ────────────────────────────────────────
    last_5 = engine_df[features_63].tail(5).values
    if len(last_5) < 5:
        padding = np.tile(last_5[0], (5 - len(last_5), 1))
        last_5  = np.vstack([padding, last_5])

    input_tensor = last_5.reshape(1, 5, 63).astype("float32")

    # ── Predict ───────────────────────────────────────────────────────────────
    model    = tf.keras.models.load_model(model_path, compile=False)
    raw_pred = float(model.predict(input_tensor, verbose=0)[0][0])
    rul      = max(0.0, min(125.0, raw_pred))

    status = "HEALTHY" if rul > 70 else "WARNING" if rul > 30 else "CRITICAL"

    print(json.dumps({
        "dataset":       args.dataset,
        "engineId":      args.engine_id,
        "predictedRUL":  round(rul, 2),
        "rawPrediction": round(raw_pred, 2),
        "status":        status,
        "totalCycles":   int(engine_df["cycle"].max()),
        "dataPoints":    len(engine_df),
    }))


if __name__ == "__main__":
    main()
