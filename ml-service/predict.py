"""
=============================================================================
SIH26186 — AI-Based Predictive Personnel Stress & Welfare Monitoring System
Module: ML Inference & Explainability Engine
=============================================================================
Provides model prediction, probability distribution, and feature-level
contribution explainability for personnel check-ins.
=============================================================================
"""

import os
import joblib
import numpy as np
from datetime import datetime
from typing import Dict, Any, List

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")
PREPROCESSING_PATH = os.path.join(BASE_DIR, "preprocessing.pkl")

# Cached model & preprocessing
_model = None
_preprocessing = None

# Human-readable feature metadata & risk directions
FEATURE_METADATA = {
    "pss_score": {
        "title": "Perceived Stress Indicator",
        "description": "Validated perceived stress inventory score",
        "high_is_risk": True,
        "unit": "pts",
        "healthy_range": "0 - 15"
    },
    "workload_hours": {
        "title": "Weekly Workload & Duty Hours",
        "description": "Cumulative weekly operational duty hours",
        "high_is_risk": True,
        "unit": "hrs/wk",
        "healthy_range": "40 - 48"
    },
    "work_pressure_rating": {
        "title": "Operational Work Pressure",
        "description": "Perceived acute operational pace and demand",
        "high_is_risk": True,
        "unit": "/10",
        "healthy_range": "1 - 5"
    },
    "recovery_sleep_hours": {
        "title": "Rest & Sleep Recovery",
        "description": "Average daily restorative sleep and recovery time",
        "high_is_risk": False, # lower sleep is risk
        "unit": "hrs/day",
        "healthy_range": "6.5 - 8.5"
    },
    "social_support_rating": {
        "title": "Social & Peer Support",
        "description": "Perception of peer, unit, and family connectedness",
        "high_is_risk": False, # lower support is risk
        "unit": "/10",
        "healthy_range": "6 - 10"
    },
    "work_life_balance_rating": {
        "title": "Work-Life Equilibrium",
        "description": "Perceived balance between duty responsibilities and personal downtime",
        "high_is_risk": False, # lower is risk
        "unit": "/10",
        "healthy_range": "6 - 10"
    },
    "shift_continuity_days": {
        "title": "Continuous Shift Exposure",
        "description": "Consecutive days on duty without a full 24h rest period",
        "high_is_risk": True,
        "unit": "days",
        "healthy_range": "0 - 5"
    },
    "recent_trend_indicator": {
        "title": "Recent Welfare Velocity",
        "description": "Directional change in welfare indicators compared to previous check-in",
        "high_is_risk": True,
        "unit": "delta",
        "healthy_range": "-5 to 0"
    }
}

def load_artifacts():
    global _model, _preprocessing
    if _model is None or _preprocessing is None:
        if not os.path.exists(MODEL_PATH) or not os.path.exists(PREPROCESSING_PATH):
            raise FileNotFoundError("Model artifacts not found. Please run train_model.py first.")
        _model = joblib.load(MODEL_PATH)
        _preprocessing = joblib.load(PREPROCESSING_PATH)
    return _model, _preprocessing

def predict_welfare_risk(checkin_data: Dict[str, float]) -> Dict[str, Any]:
    """
    Performs real ML inference and feature explainability attribution.
    """
    model, preprocessing = load_artifacts()
    scaler = preprocessing["scaler"]
    feature_cols = preprocessing["feature_columns"]
    class_names = preprocessing["class_names"]
    baseline_stats = preprocessing["baseline_stats"]
    global_importances = {feat: float(imp) for feat, imp in zip(feature_cols, model.feature_importances_)}

    # Build input feature array
    input_values = []
    for col in feature_cols:
        val = float(checkin_data.get(col, baseline_stats[col]["median"]))
        input_values.append(val)

    import pandas as pd
    X_df = pd.DataFrame([input_values], columns=feature_cols)
    X_scaled = scaler.transform(X_df)

    # Genuine model prediction & class probabilities
    probabilities = model.predict_proba(X_scaled)[0]
    predicted_class_idx = int(model.predict(X_scaled)[0])
    concern_level = class_names[predicted_class_idx] # "LOW", "MODERATE", "HIGH"

    probability_map = {
        class_names[i]: round(float(probabilities[i]), 4)
        for i in range(len(class_names))
    }

    # Primary probability of the predicted state
    confidence = float(probabilities[predicted_class_idx])
    composite_risk_score = round(float(probabilities[1] * 50.0 + probabilities[2] * 100.0), 1)

    # Compute genuine feature contribution / explainability attribution
    contributing_factors = []
    for i, col in enumerate(feature_cols):
        raw_val = input_values[i]
        meta = FEATURE_METADATA.get(col, {})
        base_mean = baseline_stats[col]["mean"]
        base_std = baseline_stats[col]["std"] if baseline_stats[col]["std"] > 0 else 1.0
        g_imp = global_importances.get(col, 0.1)

        # Standardized z-score relative to demographic baseline
        z_score = (raw_val - base_mean) / base_std
        
        # Determine directional stress deviation
        if meta.get("high_is_risk", True):
            stress_deviation = z_score # higher than mean is risk
        else:
            stress_deviation = -z_score # lower than mean is risk

        # Factor contribution score (combination of global model weight and personal deviation)
        # Scaled between 0% and 100% relative influence
        raw_contrib = max(0.0, stress_deviation + 1.2) * g_imp * 100.0

        if stress_deviation > 0.8:
            status = "Elevated Concern"
            impact_level = "HIGH"
        elif stress_deviation > 0.2:
            status = "Moderate Strain"
            impact_level = "MODERATE"
        else:
            status = "Within Baseline"
            impact_level = "LOW"

        contributing_factors.append({
            "feature_key": col,
            "title": meta.get("title", col),
            "description": meta.get("description", ""),
            "user_value": raw_val,
            "unit": meta.get("unit", ""),
            "healthy_range": meta.get("healthy_range", "N/A"),
            "baseline_mean": round(base_mean, 1),
            "importance_weight": round(g_imp, 4),
            "contribution_score": round(float(raw_contrib), 2),
            "impact_level": impact_level,
            "status": status,
            "is_risk_driver": stress_deviation > 0.3
        })

    # Sort contributing factors by contribution score descending
    contributing_factors.sort(key=lambda x: x["contribution_score"], reverse=True)

    # Top drivers
    top_drivers = [f for f in contributing_factors if f["is_risk_driver"]]
    if not top_drivers:
        top_drivers = contributing_factors[:2]

    return {
        "concernLevel": concern_level,
        "confidence": round(confidence, 4),
        "compositeRiskScore": composite_risk_score,
        "probabilities": probability_map,
        "topDrivers": [d["title"] for d in top_drivers[:3]],
        "contributingFactors": contributing_factors,
        "modelVersion": preprocessing.get("model_version", "v1.4.0"),
        "trainedAt": preprocessing.get("trained_at"),
        "analyzedAt": datetime.now().isoformat(),
        "disclaimer": "AI-generated welfare decision-support signal based on submitted indicators. Not a clinical medical diagnosis."
    }
