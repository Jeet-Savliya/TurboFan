import streamlit as st
import pandas as pd
import numpy as np
import tensorflow as tf
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler

# --- CONFIGURATION ---
st.set_page_config(page_title="Jet Engine RUL Predictor", layout="wide", page_icon="✈️")

# --- 1. HELPER FUNCTIONS ---
def scale_by_condition(group, sensor_cols):
    scaler = StandardScaler()
    group[sensor_cols] = scaler.fit_transform(group[sensor_cols])
    return group

@st.cache_resource
def load_expert_model(dataset_name):
    # This loads the specific model based on sidebar selection
    model_path = f"model_{dataset_name}.h5"
    return tf.keras.models.load_model(model_path, compile=False)

# --- 2. SIDEBAR CONTROLS ---
st.sidebar.header("⚙️ Maintenance Settings")
ds_choice = st.sidebar.selectbox("Select Fleet Dataset", ["FD001", "FD002", "FD003", "FD004"])
engine_id = st.sidebar.number_input("Engine ID to Inspect", min_value=1, value=11, step=1)

# --- 3. DATA LOADING & PROCESSING ---
try:
    # Load Expert Model
    model = load_expert_model(ds_choice)
    
    # Load Test Data
    sensor_cols = [f's{i}' for i in range(1, 22)]
    setting_cols = ['set1', 'set2', 'set3']
    cols = ['id', 'cycle'] + setting_cols + sensor_cols
    
    test_df = pd.read_csv(f"../DATASETS/test_{ds_choice}.txt", sep=r'\s+', header=None, names=cols)
    
    # Filter for the specific engine the user wants to see
    engine_df = test_df[test_df['id'] == engine_id].copy()
    
    if engine_df.empty:
        st.warning(f"No data found for Engine #{engine_id} in {ds_choice}")
    else:
        # Re-apply the preprocessing logic from your notebooks
        engine_df = engine_df.groupby(setting_cols, group_keys=False).apply(
            scale_by_condition, sensor_cols=sensor_cols
        )
        
        # Add Rolling Features
        for s in sensor_cols:
            engine_df[f'{s}_mean'] = engine_df[s].rolling(5).mean()
            engine_df[f'{s}_std'] = engine_df[s].rolling(5).std()
        engine_df.bfill(inplace=True)
        
        # Select Features (Matches your 63-feature training set)
        features = [c for c in engine_df.columns if c not in ['id', 'cycle']]
        
        # --- 4. PREDICTION ---
        # Get the latest sequence (last 5 cycles)
        last_5_cycles = engine_df[features].tail(5).values
        
        # Handle padding for very short data if necessary
        if len(last_5_cycles) < 5:
            padding = np.tile(last_5_cycles[0], (5 - len(last_5_cycles), 1))
            last_5_cycles = np.vstack([padding, last_5_cycles])
            
        input_data = last_5_cycles.reshape(1, 5, 63).astype('float32')
        prediction = model.predict(input_data, verbose=0)[0][0]
        prediction = np.clip(prediction, 0, 125)

        # --- 5. DASHBOARD UI ---
        st.title(f"✈️ Engine #{engine_id} Health Dashboard")
        
        m1, m2, m3 = st.columns(3)
        m1.metric("Predicted RUL", f"{int(prediction)} Cycles")
        
        # Color coding the status
        status = "HEALTHY" if prediction > 70 else "WARNING" if prediction > 30 else "CRITICAL"
        color = "green" if status == "HEALTHY" else "orange" if status == "WARNING" else "red"
        m2.markdown(f"Current Status: **:{color}[{status}]**")
        
        m3.metric("Data Points Available", len(engine_df))

        # Visualizing the sensors the user might care about
        st.subheader("Live Sensor Telemetry (Last 50 Cycles)")
        st.line_chart(engine_df[['s11', 's4', 's15']].tail(50))

except Exception as e:
    st.error(f"Failed to initialize dashboard: {e}")