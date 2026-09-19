"""
=============================================================================
SIH26186 — AI-Based Predictive Personnel Stress & Welfare Monitoring System
Module: ML Model 1 — Wearable + Operational Random Forest Training Pipeline
Dataset: DEMO / SYNTHETIC DATA — NOT REAL PERSONNEL DATA
=============================================================================
Trains a dedicated Random Forest Model 1 specifically on:
- Wearable biometrics (HR, HRV, respiration, skin temp, activity, posture, fatigue/strain)
- Operational duty variables (workload, work pressure, prolonged duty, night duty, shift continuity)
- Rest & Recovery patterns (sleep hours, rest intervals, circadian recovery pattern)
- Deployment & work post patterns (deployment zone & duty post demand score)
- Optional self-check (PSS-10 perceived stress inventory)
=============================================================================
"""

import os
import json
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix
)
import joblib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
EVAL_DIR = os.path.join(BASE_DIR, "evaluation")
os.makedirs(DATASET_DIR, exist_ok=True)
os.makedirs(EVAL_DIR, exist_ok=True)

DATASET_PATH = os.path.join(DATASET_DIR, "synthetic_prototype_sensor_operational_dataset.csv")
LEGACY_DATASET_PATH = os.path.join(DATASET_DIR, "synthetic_model1_wearable_operational_dataset.csv")
DATASET_METADATA_PATH = os.path.join(DATASET_DIR, "dataset_metadata.json")
MODEL_PATH = os.path.join(BASE_DIR, "model1_wearable_operational.pkl")
PREPROCESSING_PATH = os.path.join(BASE_DIR, "model1_preprocessing.pkl")
METRICS_PATH = os.path.join(EVAL_DIR, "model1_metrics.json")
CONFUSION_MATRIX_PATH = os.path.join(EVAL_DIR, "model1_confusion_matrix.json")

FEATURE_COLUMNS = [
    # Wearable Biometrics
    "resting_heart_rate",         # HR (bpm, 45-125)
    "hrv_ms",                     # HRV (ms, 15-115)
    "respiration_rate",           # Respiration rate (br/min, 10-32)
    "skin_temperature_c",         # Body/Skin temperature (°C, 35.0-39.5)
    "activity_movement_score",    # Activity/Movement (0: Sedentary, 1: Normal, 2: High, 3: Extreme)
    "posture_inactivity_score",   # Posture/Inactivity (0: Mobile, 1: Static sitting, 2: Vigilance, 3: Immobility)
    "fatigue_physical_strain",    # Fatigue/Physical strain index (0-100)

    # Operational Duty & Workload
    "workload_hours",             # Weekly workload duty hours (30-90)
    "work_pressure_rating",       # Work pressure rating (1-10)
    "prolonged_duty_hours",       # Continuous shift duty duration (4-24)
    "shift_continuity_days",      # Consecutive shift duty days (0-21)
    "night_duty_hours",           # Nocturnal duty exposure (0-48)

    # Rest & Recovery
    "recovery_sleep_hours",       # Restorative daily sleep (3.0-10.0)
    "rest_interval_hours",        # Duty rest interval (4-24)
    "recovery_pattern_score",     # Recovery pattern (0: Balanced, 1: Fragmented, 2: Shift Lag, 3: Deficit)

    # Deployment & Environmental Post Patterns
    "deployment_demand_score",    # Sector demand (0: Base, 1: Field Post, 2: Remote/QRT, 3: High Altitude)

    # Psychological & Equilibrium Factors
    "social_support_rating",      # Peer/Family social support (1-10)
    "work_life_balance_rating",   # Work-life equilibrium (1-10)
    "recent_trend_indicator",     # Longitudinal velocity delta (-5 to +5)

    # Optional Self-Check
    "pss_score"                   # Perceived Stress Scale score (0-40)
]

TARGET_COLUMN = "welfare_concern_level"
CLASS_NAMES = ["LOW", "MODERATE", "HIGH"]

def generate_synthetic_dataset(n_samples: int = 3500, random_state: int = 42) -> pd.DataFrame:
    """
    Generates realistic synthetic wearable + operational welfare data with physiological correlations.
    DISCLAIMER: DEMO / SYNTHETIC DATA — NOT REAL PERSONNEL DATA.
    """
    np.random.seed(random_state)

    # 1. Operational duty context
    workload = np.random.normal(loc=52.0, scale=10.0, size=n_samples).clip(30, 90)
    work_pressure = np.random.normal(loc=5.5, scale=2.0, size=n_samples).clip(1, 10)
    prolonged_duty = np.random.exponential(scale=4.0, size=n_samples).clip(4, 24)
    shift_continuity = np.random.exponential(scale=3.5, size=n_samples).clip(0, 21)
    night_duty = np.random.exponential(scale=6.0, size=n_samples).clip(0, 48)
    deployment_demand = np.random.choice([0, 1, 2, 3], p=[0.35, 0.35, 0.18, 0.12], size=n_samples)

    # 2. Rest & Recovery correlated with operational demands
    sleep_base = 7.5 - (workload - 40.0) * 0.04 - (night_duty * 0.03) + np.random.normal(0, 0.8, n_samples)
    recovery_sleep = sleep_base.clip(3.0, 10.0)
    rest_interval = (14.0 - (prolonged_duty - 8.0) * 0.4 + np.random.normal(0, 2.0, n_samples)).clip(4, 24)
    recovery_pattern = np.where(recovery_sleep < 5.0, np.random.choice([2, 3], size=n_samples),
                       np.where(recovery_sleep < 6.5, np.random.choice([1, 2], size=n_samples), 0))

    # 3. Wearable biometrics correlated with operational strain & autonomic arousal
    autonomic_stress = (
        (workload - 40.0) / 40.0 * 0.25 +
        (work_pressure / 10.0) * 0.20 +
        ((8.0 - recovery_sleep) / 5.0) * 0.25 +
        (prolonged_duty / 24.0) * 0.15 +
        (deployment_demand / 3.0) * 0.15
    ).clip(0, 1.2)

    resting_hr = 64.0 + autonomic_stress * 32.0 + np.random.normal(0, 6.0, n_samples)
    resting_hr = resting_hr.clip(48, 122)

    hrv = 75.0 - autonomic_stress * 45.0 + np.random.normal(0, 8.0, n_samples)
    hrv = hrv.clip(16, 110)

    respiration = 14.0 + autonomic_stress * 9.0 + np.random.normal(0, 2.2, n_samples)
    respiration = respiration.clip(10, 32)

    skin_temp = 36.4 + (autonomic_stress * 1.4) + np.random.normal(0, 0.4, n_samples)
    skin_temp = skin_temp.clip(35.2, 39.2)

    fatigue_strain = (autonomic_stress * 70.0 + (prolonged_duty / 24.0) * 20.0 + np.random.normal(0, 8.0, n_samples)).clip(5, 98)

    activity_movement = np.where(fatigue_strain > 70, np.random.choice([0, 3], size=n_samples),
                        np.where(fatigue_strain > 40, np.random.choice([1, 2], size=n_samples), 1))

    posture_inactivity = np.where(prolonged_duty > 12, np.random.choice([2, 3], size=n_samples),
                         np.where(prolonged_duty > 8, np.random.choice([1, 2], size=n_samples), 0))

    # 4. Psychological & Equilibrium
    social_support = np.random.normal(loc=6.2, scale=2.0, size=n_samples).clip(1, 10)
    work_life_balance = (8.0 - (workload / 90.0 * 5.0) + np.random.normal(0, 1.5, n_samples)).clip(1, 10)
    recent_trend = np.random.normal(loc=0.0, scale=2.2, size=n_samples).clip(-5, 5)

    # 5. Optional PSS-10
    pss_scores = (12.0 + autonomic_stress * 20.0 + np.random.normal(0, 5.0, n_samples)).clip(0, 40)

    # 6. Multi-Source Ground Truth Composite Welfare Index
    composite_index = (
        # Wearable Biometrics (32%)
        0.10 * ((resting_hr - 50.0) / 70.0 * 100.0) +
        0.10 * ((110.0 - hrv) / 90.0 * 100.0) +
        0.05 * ((respiration - 12.0) / 18.0 * 100.0) +
        0.07 * fatigue_strain +
        # Operational Duty & Workload (34%)
        0.12 * ((workload - 30.0) / 60.0 * 100.0) +
        0.08 * (work_pressure * 10.0) +
        0.08 * ((prolonged_duty - 4.0) / 20.0 * 100.0) +
        0.06 * (night_duty / 48.0 * 100.0) +
        # Rest & Recovery (22%)
        0.12 * ((9.5 - recovery_sleep) / 6.0 * 100.0) +
        0.05 * ((20.0 - rest_interval) / 16.0 * 100.0) +
        0.05 * (recovery_pattern / 3.0 * 100.0) +
        # Deployment & Self-check (12%)
        0.06 * (deployment_demand / 3.0 * 100.0) +
        0.06 * (pss_scores / 40.0 * 100.0) +
        np.random.normal(0, 3.5, size=n_samples)
    )

    # Class assignment: LOW (< 34.0), MODERATE (34.0 - 47.0), HIGH (>= 47.0)
    labels = np.zeros(n_samples, dtype=int)
    labels[composite_index >= 34.0] = 1
    labels[composite_index >= 47.0] = 2

    df = pd.DataFrame({
        "resting_heart_rate": np.round(resting_hr, 1),
        "hrv_ms": np.round(hrv, 1),
        "respiration_rate": np.round(respiration, 1),
        "skin_temperature_c": np.round(skin_temp, 1),
        "activity_movement_score": activity_movement,
        "posture_inactivity_score": posture_inactivity,
        "fatigue_physical_strain": np.round(fatigue_strain, 1),
        "workload_hours": np.round(workload, 1),
        "work_pressure_rating": np.round(work_pressure, 1),
        "prolonged_duty_hours": np.round(prolonged_duty, 1),
        "shift_continuity_days": np.round(shift_continuity, 0),
        "night_duty_hours": np.round(night_duty, 1),
        "recovery_sleep_hours": np.round(recovery_sleep, 1),
        "rest_interval_hours": np.round(rest_interval, 1),
        "recovery_pattern_score": recovery_pattern,
        "deployment_demand_score": deployment_demand,
        "social_support_rating": np.round(social_support, 1),
        "work_life_balance_rating": np.round(work_life_balance, 1),
        "recent_trend_indicator": np.round(recent_trend, 1),
        "pss_score": np.round(pss_scores, 1),
        TARGET_COLUMN: labels,
        "dataset_type": "SYNTHETIC_PROTOTYPE_BENCHMARK",
        "provenance": "SYNTHETIC_PROTOTYPE_DATA_NOT_REAL_PERSONNEL_DATA",
        "data_label": "DEMO / SYNTHETIC DATA — NOT REAL PERSONNEL OR SENSOR DATA"
    })

    return df

def train_and_evaluate_model1():
    print("==================================================================", flush=True)
    print("SIH26186 — Training ML Model 1 (Wearable + Operational RF Prototype)", flush=True)
    print("==================================================================", flush=True)
    print(f"[{datetime.now().isoformat()}] Generating synthetic prototype dataset (N=3500)...", flush=True)
    df = generate_synthetic_dataset(n_samples=3500, random_state=42)
    df.to_csv(DATASET_PATH, index=False)
    df.to_csv(LEGACY_DATASET_PATH, index=False)
    print(f"Dataset saved to: {DATASET_PATH} (Shape: {df.shape})", flush=True)

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    dataset_metadata = {
        "dataset_name": "synthetic_prototype_sensor_operational_dataset.csv",
        "dataset_version": "v2.0.0-prototype",
        "created_at": datetime.now().isoformat(),
        "samples_count": int(len(df)),
        "provenance": "SYNTHETIC_PROTOTYPE_DATA",
        "real_world_validated": False,
        "real_world_claim": False,
        "feature_columns": FEATURE_COLUMNS,
        "target_column": TARGET_COLUMN,
        "class_distribution": {
            "LOW": int((y == 0).sum()),
            "MODERATE": int((y == 1).sum()),
            "HIGH": int((y == 2).sum())
        },
        "description": "Clearly labelled synthetic prototype dataset for wearable sensor and operational duty stress prediction. Real authorized sensor data is unavailable.",
        "disclaimer": "PROTOTYPE DATA: This synthetic dataset was algorithmically generated to verify data schemas, physiological ranges, and integration pipelines. Model accuracy derived from this dataset DO NOT represent real-world clinical or operational validated performance."
    }
    with open(DATASET_METADATA_PATH, "w") as f:
        json.dump(dataset_metadata, f, indent=2)
    print(f"Dataset metadata saved to: {DATASET_METADATA_PATH}", flush=True)

    baseline_stats = {
        col: {
            "mean": float(X[col].mean()),
            "std": float(X[col].std()),
            "min": float(X[col].min()),
            "max": float(X[col].max()),
            "median": float(X[col].median())
        }
        for col in FEATURE_COLUMNS
    }

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    print(f"Training samples: {X_train.shape[0]}, Test samples: {X_test.shape[0]}", flush=True)
    for idx, cname in enumerate(CLASS_NAMES):
        count = int((y_train == idx).sum())
        print(f"  - {cname} (Class {idx}): {count} ({count/len(y_train)*100:.1f}%)", flush=True)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train Random Forest Model 1
    rf_model1 = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        class_weight="balanced",
        n_jobs=1
    )
    rf_model1.fit(X_train_scaled, y_train)

    y_pred = rf_model1.predict(X_test_scaled)
    acc = float(accuracy_score(y_test, y_pred))
    prec_macro = float(precision_score(y_test, y_pred, average="macro"))
    rec_macro = float(recall_score(y_test, y_pred, average="macro"))
    f1_macro = float(f1_score(y_test, y_pred, average="macro"))

    prec_per_class = precision_score(y_test, y_pred, average=None).tolist()
    rec_per_class = recall_score(y_test, y_pred, average=None).tolist()
    f1_per_class = f1_score(y_test, y_pred, average=None).tolist()
    cm = confusion_matrix(y_test, y_pred).tolist()

    importances = rf_model1.feature_importances_
    feature_importance_dict = {
        feat: float(imp) for feat, imp in zip(FEATURE_COLUMNS, importances)
    }
    sorted_importances = dict(sorted(feature_importance_dict.items(), key=lambda item: item[1], reverse=True))

    print("\n--- Model 1 Prototype Evaluation Results ---", flush=True)
    print(f"Overall Accuracy:  {acc * 100:.2f}%", flush=True)
    print(f"Macro Precision:   {prec_macro * 100:.2f}%", flush=True)
    print(f"Macro Recall:      {rec_macro * 100:.2f}%", flush=True)
    print(f"Macro F1-Score:    {f1_macro * 100:.2f}%", flush=True)

    print("\nTop 7 Global Feature Importances:", flush=True)
    for feat, val in list(sorted_importances.items())[:7]:
        print(f"  - {feat:25s}: {val * 100:.2f}%", flush=True)

    metrics_data = {
        "model_name": "Model 1 (Wearable + Operational Random Forest Prototype)",
        "model_version": "v2.0.0-model1-prototype",
        "trained_at": datetime.now().isoformat(),
        "is_synthetic_prototype": True,
        "real_world_validated": False,
        "dataset_provenance": "SYNTHETIC_PROTOTYPE_BENCHMARK",
        "dataset_name": "synthetic_prototype_sensor_operational_dataset.csv",
        "dataset_samples": int(len(df)),
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "accuracy": acc,
        "precision_macro": prec_macro,
        "recall_macro": rec_macro,
        "f1_macro": f1_macro,
        "per_class": {
            "LOW": {"precision": prec_per_class[0], "recall": rec_per_class[0], "f1": f1_per_class[0]},
            "MODERATE": {"precision": prec_per_class[1], "recall": rec_per_class[1], "f1": f1_per_class[1]},
            "HIGH": {"precision": prec_per_class[2], "recall": rec_per_class[2], "f1": f1_per_class[2]}
        },
        "feature_importances": sorted_importances,
        "class_distribution": {
            "LOW": int((y == 0).sum()),
            "MODERATE": int((y == 1).sum()),
            "HIGH": int((y == 2).sum())
        },
        "features_count": len(FEATURE_COLUMNS),
        "disclaimer": "PROTOTYPE MODEL: Trained and evaluated on synthetic prototype benchmark data for system architecture and integration verification. Model accuracy and evaluation metrics DO NOT represent real-world clinical, medical, or operational validated performance."
    }

    with open(METRICS_PATH, "w") as f:
        json.dump(metrics_data, f, indent=2)

    with open(CONFUSION_MATRIX_PATH, "w") as f:
        json.dump({"classes": CLASS_NAMES, "matrix": cm}, f, indent=2)

    # Persist model artifacts
    joblib.dump(rf_model1, MODEL_PATH)
    joblib.dump({
        "scaler": scaler,
        "feature_columns": FEATURE_COLUMNS,
        "class_names": CLASS_NAMES,
        "baseline_stats": baseline_stats,
        "model_version": "v2.0.0-model1-prototype",
        "model_name": "Model 1 (Wearable + Operational Random Forest Prototype)",
        "is_synthetic_prototype": True,
        "real_world_validated": False,
        "dataset_provenance": "SYNTHETIC_PROTOTYPE_BENCHMARK",
        "disclaimer": "PROTOTYPE MODEL: Trained on synthetic prototype data for integration testing. Does NOT represent real-world validated performance.",
        "trained_at": datetime.now().isoformat()
    }, PREPROCESSING_PATH)

    print(f"\nModel 1 saved to: {MODEL_PATH}", flush=True)
    print(f"Preprocessing configuration saved to: {PREPROCESSING_PATH}", flush=True)
    print(f"Evaluation metrics saved to: {METRICS_PATH}", flush=True)
    print("Model 1 training and evaluation completed successfully!\n", flush=True)

if __name__ == "__main__":
    train_and_evaluate_model1()
