"""
get_sensor_data.py — returns sensor time-series JSON for a given engine.
Called by Node.js GET /api/sensor-data/:dataset/:engineId
"""

import argparse
import json
import sys
import os
import warnings
warnings.filterwarnings("ignore")

KEY_SENSORS = ["s2","s3","s4","s7","s8","s9","s11","s12","s13","s14","s15","s17","s20","s21"]


def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset",      required=True)
    parser.add_argument("--engine_id",    type=int, required=True)
    parser.add_argument("--project_root", required=True)
    args = parser.parse_args()

    test_path = os.path.join(args.project_root, "DATASETS", f"test_{args.dataset}.txt")
    if not os.path.isfile(test_path):
        die(f"Dataset file not found: {test_path}")

    try:
        import pandas as pd
        from sklearn.preprocessing import StandardScaler
    except ImportError as e:
        die(f"Missing package: {e}  →  run: pip install pandas scikit-learn")

    sensor_cols  = [f"s{i}" for i in range(1, 22)]
    setting_cols = ["set1", "set2", "set3"]
    cols         = ["id", "cycle"] + setting_cols + sensor_cols

    df        = pd.read_csv(test_path, sep=r"\s+", header=None, names=cols)
    engine_df = df[df["id"] == args.engine_id].copy().reset_index(drop=True)

    if engine_df.empty:
        die(f"Engine #{args.engine_id} not found in {args.dataset}")

    # Per-condition scaling (pandas-3.x safe)
    for _, idx in engine_df.groupby(setting_cols).groups.items():
        scaler = StandardScaler()
        engine_df.loc[idx, sensor_cols] = scaler.fit_transform(
            engine_df.loc[idx, sensor_cols]
        )

    cycles = engine_df["cycle"].tolist()
    sensor_data = {}
    for s in KEY_SENSORS:
        vals = engine_df[s].tolist()
        sensor_data[s] = [0.0 if (v != v) else round(float(v), 4) for v in vals]

    settings = {
        c: [round(float(x), 2) for x in engine_df[c].tolist()]
        for c in setting_cols
    }

    print(json.dumps({
        "dataset":     args.dataset,
        "engineId":    args.engine_id,
        "cycles":      cycles,
        "sensors":     sensor_data,
        "settings":    settings,
        "totalCycles": len(cycles),
    }))


if __name__ == "__main__":
    main()
