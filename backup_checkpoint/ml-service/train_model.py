"""
=============================================================================
SIH26186 — AI-Based Predictive Personnel Stress & Welfare Monitoring System
Module: ML Model Training & Evaluation Pipeline
Dataset: DEMO / SYNTHETIC DATA — NOT REAL PERSONNEL DATA
=============================================================================
This script generates a labeled synthetic personnel welfare dataset,
trains a scikit-learn RandomForestClassifier, evaluates performance metrics,
calculates feature baseline statistics for explainability attribution,
and serializes artifacts for FastAPI prediction inference.
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
    confusion_matrix,
    classification_report
)
import joblib

# Paths setup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
EVAL_DIR = os.path.join(BASE_DIR, "evaluation")
os.makedirs(DATASET_DIR, exist_ok=True)
os.makedirs(EVAL_DIR, exist_ok=True)

DATASET_PATH = os.path.join(DATASET_DIR, "synthetic_personnel_welfare_dataset.csv")
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")
PREPROCESSING_PATH = os.path.join(BASE_DIR, "preprocessing.pkl")
METRICS_PATH = os.path.join(EVAL_DIR, "metrics.json")
CONFUSION_MATRIX_PATH = os.path.join(EVAL_DIR, "confusion_matrix.json")

FEATURE_COLUMNS = [
    "pss_score",                # Perceived Stress Scale score (0-40)
    "workload_hours",           # Weekly duty/workload hours (35-80)
    "work_pressure_rating",     # Subjective work pressure rating (1-10)
    "recovery_sleep_hours",     # Average daily sleep & rest (3.5-9.0)
    "social_support_rating",    # Peer/family support perception (1-10)
    "work_life_balance_rating", # Work-life balance rating (1-10)
    "shift_continuity_days",    # Consecutive shift duty days (0-21)
    "recent_trend_indicator"    # Prior check-in trend delta (-5 to +5)
]

TARGET_COLUMN = "welfare_risk_level"
CLASS_NAMES = ["LOW", "MODERATE", "HIGH"]

def generate_synthetic_dataset(n_samples: int = 3000, random_state: int = 42) -> pd.DataFrame:
    """
    Generates realistic, privacy-safe synthetic personnel welfare data for prototype demonstration.
    DISCLAIMER: DEMO / SYNTHETIC DATA — NOT REAL PERSONNEL DATA.
    """
    np.random.seed(random_state)

    # Base operational distributions
    pss_scores = np.random.normal(loc=18.0, scale=7.5, size=n_samples).clip(0, 40)
    workload_hours = np.random.normal(loc=52.0, scale=10.0, size=n_samples).clip(35, 80)
    work_pressure = np.random.normal(loc=5.5, scale=2.0, size=n_samples).clip(1, 10)
    recovery_sleep = np.random.normal(loc=6.2, scale=1.2, size=n_samples).clip(3.5, 9.0)
    social_support = np.random.normal(loc=6.0, scale=2.1, size=n_samples).clip(1, 10)
    work_life_balance = np.random.normal(loc=5.4, scale=2.0, size=n_samples).clip(1, 10)
    shift_continuity = np.random.exponential(scale=3.5, size=n_samples).clip(0, 21)
    recent_trend = np.random.normal(loc=0.0, scale=2.0, size=n_samples).clip(-5, 5)

    # Compute a continuous composite welfare stress index
    composite_index = (
        0.30 * (pss_scores / 40.0 * 100.0) +
        0.20 * ((workload_hours - 35.0) / 45.0 * 100.0) +
        0.15 * (work_pressure * 10.0) +
        0.15 * ((9.0 - recovery_sleep) / 5.5 * 100.0) +
        0.10 * ((10.0 - social_support) * 10.0) +
        0.05 * ((10.0 - work_life_balance) * 10.0) +
        0.05 * (shift_continuity / 21.0 * 100.0) +
        np.random.normal(0, 4.5, size=n_samples) # Natural stochastic noise
    )

    # Categorize into LOW, MODERATE, HIGH risk signals
    # 0 = LOW (< 42), 1 = MODERATE (42 - 65), 2 = HIGH (> 65)
    labels = np.zeros(n_samples, dtype=int)
    labels[composite_index >= 42.0] = 1
    labels[composite_index >= 66.0] = 2

    df = pd.DataFrame({
        "pss_score": np.round(pss_scores, 1),
        "workload_hours": np.round(workload_hours, 1),
        "work_pressure_rating": np.round(work_pressure, 1),
        "recovery_sleep_hours": np.round(recovery_sleep, 1),
        "social_support_rating": np.round(social_support, 1),
        "work_life_balance_rating": np.round(work_life_balance, 1),
        "shift_continuity_days": np.round(shift_continuity, 0),
        "recent_trend_indicator": np.round(recent_trend, 1),
        TARGET_COLUMN: labels
    })

    # Add metadata comment row or column for transparency
    df["data_label"] = "DEMO / SYNTHETIC DATA — NOT REAL PERSONNEL DATA"
    return df

def train_and_evaluate():
    print("==================================================================", flush=True)
    print("SIH26186 Welfare AI — Random Forest Training & Evaluation Pipeline", flush=True)
    print("==================================================================", flush=True)
    print(f"[{datetime.now().isoformat()}] Generating synthetic welfare dataset...", flush=True)
    df = generate_synthetic_dataset(n_samples=2000, random_state=42)
    df.to_csv(DATASET_PATH, index=False)
    print(f"Dataset saved to: {DATASET_PATH} (Shape: {df.shape})", flush=True)

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    # Calculate baseline feature statistics for attribution explainability
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

    # Train / Test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    print(f"Training samples: {X_train.shape[0]}, Test samples: {X_test.shape[0]}", flush=True)
    print("Class distribution in training set:", flush=True)
    for idx, cname in enumerate(CLASS_NAMES):
        count = int((y_train == idx).sum())
        print(f"  - {cname} (Class {idx}): {count} ({count/len(y_train)*100:.1f}%)", flush=True)

    # Standard Scaler for standardized feature handling
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train Random Forest Classifier
    rf_model = RandomForestClassifier(
        n_estimators=60,
        max_depth=8,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42,
        class_weight="balanced",
        n_jobs=1
    )
    rf_model.fit(X_train_scaled, y_train)

    # Predictions & Evaluation
    y_pred = rf_model.predict(X_test_scaled)
    y_prob = rf_model.predict_proba(X_test_scaled)

    acc = float(accuracy_score(y_test, y_pred))
    prec_macro = float(precision_score(y_test, y_pred, average="macro"))
    rec_macro = float(recall_score(y_test, y_pred, average="macro"))
    f1_macro = float(f1_score(y_test, y_pred, average="macro"))

    prec_per_class = precision_score(y_test, y_pred, average=None).tolist()
    rec_per_class = recall_score(y_test, y_pred, average=None).tolist()
    f1_per_class = f1_score(y_test, y_pred, average=None).tolist()
    cm = confusion_matrix(y_test, y_pred).tolist()

    # Feature importances
    importances = rf_model.feature_importances_
    feature_importance_dict = {
        feat: float(imp) for feat, imp in zip(FEATURE_COLUMNS, importances)
    }
    sorted_importances = dict(sorted(feature_importance_dict.items(), key=lambda item: item[1], reverse=True))

    print("\n--- Model Evaluation Results ---", flush=True)
    print(f"Overall Accuracy:  {acc * 100:.2f}%", flush=True)
    print(f"Macro Precision:   {prec_macro * 100:.2f}%", flush=True)
    print(f"Macro Recall:      {rec_macro * 100:.2f}%", flush=True)
    print(f"Macro F1-Score:    {f1_macro * 100:.2f}%", flush=True)
    print("\nConfusion Matrix:", flush=True)
    for row in cm:
        print(f"  {row}", flush=True)

    print("\nGlobal Feature Importances:", flush=True)
    for feat, val in sorted_importances.items():
        print(f"  - {feat:25s}: {val * 100:.2f}%", flush=True)

    # Serialize evaluation metrics
    metrics_data = {
        "model_name": "RandomForestClassifier",
        "model_version": "v1.4.0-sih26186",
        "trained_at": datetime.now().isoformat(),
        "dataset_type": "SYNTHETIC_DEMO",
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
        "disclaimer": "PROTOTYPE EVALUATION ON SYNTHETIC DEMO DATA. NOT CLINICALLY VALIDATED."
    }

    with open(METRICS_PATH, "w") as f:
        json.dump(metrics_data, f, indent=2)

    with open(CONFUSION_MATRIX_PATH, "w") as f:
        json.dump({"classes": CLASS_NAMES, "matrix": cm}, f, indent=2)

    # Persist model and preprocessing pipeline
    joblib.dump(rf_model, MODEL_PATH)
    joblib.dump({
        "scaler": scaler,
        "feature_columns": FEATURE_COLUMNS,
        "class_names": CLASS_NAMES,
        "baseline_stats": baseline_stats,
        "model_version": "v1.4.0-sih26186",
        "trained_at": datetime.now().isoformat()
    }, PREPROCESSING_PATH)

    print(f"\nModel saved to: {MODEL_PATH}", flush=True)
    print(f"Preprocessing configuration saved to: {PREPROCESSING_PATH}", flush=True)
    print(f"Evaluation metrics saved to: {METRICS_PATH}", flush=True)
    print("Training and evaluation pipeline completed successfully.\n", flush=True)

if __name__ == "__main__":
    train_and_evaluate()
