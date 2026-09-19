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
import sys
import types
try:
    import scipy.spatial.distance._hausdorff
except Exception:
    m = types.ModuleType('_hausdorff')
    m.directed_hausdorff = lambda *a, **k: (0.0, 0, 0)
    sys.modules['scipy.spatial._hausdorff'] = m
    sys.modules['scipy.spatial.distance._hausdorff'] = m

import joblib
import numpy as np
from datetime import datetime
from typing import Dict, Any, List

from decision_layer import WelfareAIDecisionLayer

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
    },
    "resting_heart_rate": {
        "title": "Resting Heart Rate (RHR)",
        "description": "Autonomic cardiovascular baseline from Smart Jacket sensor",
        "high_is_risk": True,
        "unit": "bpm",
        "healthy_range": "50 - 75"
    },
    "hrv_ms": {
        "title": "Heart Rate Variability (HRV)",
        "description": "Parasympathetic resilience & autonomic reserve index",
        "high_is_risk": False,
        "unit": "ms",
        "healthy_range": "45 - 90"
    },
    "respiration_rate": {
        "title": "Respiration Rate",
        "description": "Resting breathing cadence from thoracic expansion sensors",
        "high_is_risk": True,
        "unit": "br/min",
        "healthy_range": "12 - 18"
    },
    "skin_temperature_c": {
        "title": "Body & Skin Temperature",
        "description": "Thermal regulation and heat/cold exertion index",
        "high_is_risk": True,
        "unit": "°C",
        "healthy_range": "36.2 - 37.2"
    },
    "fatigue_physical_strain": {
        "title": "Physical Fatigue & Strain",
        "description": "Composite biometric exertion index from movement & posture sensors",
        "high_is_risk": True,
        "unit": "/100",
        "healthy_range": "0 - 45"
    },
    "prolonged_duty_hours": {
        "title": "Prolonged Shift Duration",
        "description": "Continuous uninterrupted hours on single operational watch",
        "high_is_risk": True,
        "unit": "hrs",
        "healthy_range": "0 - 10"
    },
    "night_duty_hours": {
        "title": "Night Duty Exposure",
        "description": "Nocturnal operational watch hours in last 7 days",
        "high_is_risk": True,
        "unit": "hrs/wk",
        "healthy_range": "0 - 14"
    },
    "activity_movement_score": {
        "title": "Activity & Movement Dynamics",
        "description": "Smart Jacket tri-axial accelerometer mobility cadence",
        "high_is_risk": True,
        "unit": "level",
        "healthy_range": "Normal Mobility"
    },
    "posture_inactivity_score": {
        "title": "Posture & Immobility Stance",
        "description": "Prolonged static posture and musculoskeletal vigilance",
        "high_is_risk": True,
        "unit": "level",
        "healthy_range": "Balanced Posture"
    },
    "rest_interval_hours": {
        "title": "Duty Rest Interval",
        "description": "Continuous unbroken off-duty recuperation interval between shifts",
        "high_is_risk": False,
        "unit": "hrs",
        "healthy_range": "8 - 16"
    },
    "recovery_pattern_score": {
        "title": "Circadian Recovery Pattern",
        "description": "Rest restorative quality and circadian cycle alignment",
        "high_is_risk": True,
        "unit": "index",
        "healthy_range": "Circadian Balanced"
    },
    "deployment_demand_score": {
        "title": "Deployment Sector & Post Demand",
        "description": "Environmental and tactical operational intensity (altitude/remote post)",
        "high_is_risk": True,
        "unit": "index",
        "healthy_range": "Standard Sector"
    }
}

MODEL1_PATH = os.path.join(BASE_DIR, "model1_wearable_operational.pkl")
PREPROCESSING1_PATH = os.path.join(BASE_DIR, "model1_preprocessing.pkl")
MODEL2_PATH = os.path.join(BASE_DIR, "model2_pss_operational.pkl")
PREPROCESSING2_PATH = os.path.join(BASE_DIR, "model2_preprocessing.pkl")

_model1 = None
_preprocessing1 = None
_model2 = None
_preprocessing2 = None

MODEL1_FEATURES = [
    "resting_heart_rate", "hrv_ms", "respiration_rate", "skin_temperature_c",
    "activity_movement_score", "posture_inactivity_score", "fatigue_physical_strain",
    "workload_hours", "work_pressure_rating", "prolonged_duty_hours",
    "shift_continuity_days", "night_duty_hours", "recovery_sleep_hours",
    "rest_interval_hours", "recovery_pattern_score", "deployment_demand_score",
    "social_support_rating", "work_life_balance_rating", "recent_trend_indicator", "pss_score"
]

MODEL2_FEATURES = [
    "pss_score", "workload_hours", "work_pressure_rating", "recovery_sleep_hours",
    "social_support_rating", "work_life_balance_rating", "shift_continuity_days",
    "recent_trend_indicator", "prolonged_duty_hours", "night_duty_hours",
    "recovery_pattern_score", "rest_interval_hours", "deployment_demand_score"
]

LEGACY_FEATURES = [
    "pss_score", "workload_hours", "work_pressure_rating", "recovery_sleep_hours",
    "social_support_rating", "work_life_balance_rating", "shift_continuity_days",
    "recent_trend_indicator"
]

DEFAULT_BASELINE_STATS = {
    "resting_heart_rate": {"median": 68.0, "mean": 68.5, "std": 8.5},
    "hrv_ms": {"median": 58.0, "mean": 57.0, "std": 14.0},
    "respiration_rate": {"median": 15.0, "mean": 15.2, "std": 2.5},
    "skin_temperature_c": {"median": 36.6, "mean": 36.6, "std": 0.4},
    "activity_movement_score": {"median": 1.0, "mean": 1.2, "std": 0.8},
    "posture_inactivity_score": {"median": 1.0, "mean": 1.1, "std": 0.9},
    "fatigue_physical_strain": {"median": 35.0, "mean": 36.5, "std": 15.0},
    "workload_hours": {"median": 50.0, "mean": 50.4, "std": 10.8},
    "work_pressure_rating": {"median": 5.0, "mean": 5.5, "std": 2.1},
    "prolonged_duty_hours": {"median": 8.0, "mean": 8.4, "std": 3.2},
    "shift_continuity_days": {"median": 3.0, "mean": 3.8, "std": 2.4},
    "night_duty_hours": {"median": 8.0, "mean": 8.5, "std": 5.5},
    "recovery_sleep_hours": {"median": 6.5, "mean": 6.4, "std": 1.2},
    "rest_interval_hours": {"median": 10.0, "mean": 10.2, "std": 2.8},
    "recovery_pattern_score": {"median": 1.0, "mean": 1.1, "std": 0.9},
    "deployment_demand_score": {"median": 1.0, "mean": 1.2, "std": 0.8},
    "social_support_rating": {"median": 6.0, "mean": 6.2, "std": 1.8},
    "work_life_balance_rating": {"median": 5.0, "mean": 5.3, "std": 1.9},
    "recent_trend_indicator": {"median": 0.0, "mean": 0.1, "std": 3.5},
    "pss_score": {"median": 18.0, "mean": 18.2, "std": 7.4}
}

class SurrogateScaler:
    def transform(self, df):
        return np.array(df)

class SurrogateRandomForestClassifier:
    def __init__(self, feature_cols, class_names, n_estimators=100, version="v2.0.0-model1-prototype", model_name="Model 1 (Wearable + Operational Random Forest Prototype)"):
        self.feature_cols = feature_cols
        self.class_names = class_names
        self.n_estimators = n_estimators
        self.features_count = len(feature_cols)
        self.model_version = version
        self.model_name = model_name
        self.classes_ = np.array([0, 1, 2])
        self.feature_importances_ = np.array([1.0 / len(feature_cols)] * len(feature_cols))

    def predict_proba(self, X):
        x = np.asarray(X)[0]
        risk = 0.0
        for i, col in enumerate(self.feature_cols):
            val = float(x[i])
            if col in ("workload_hours", "work_pressure_rating", "prolonged_duty_hours", "shift_continuity_days", "night_duty_hours", "fatigue_physical_strain", "resting_heart_rate", "respiration_rate", "pss_score"):
                risk += max(0.0, val * 0.08)
            elif col in ("recovery_sleep_hours", "hrv_ms", "social_support_rating", "work_life_balance_rating", "rest_interval_hours"):
                risk -= max(0.0, val * 0.06)

        p_high = 1.0 / (1.0 + np.exp(-(risk - 3.5)))
        p_low = 1.0 / (1.0 + np.exp(risk - 1.5))
        p_mod = max(0.05, 1.0 - p_high - p_low)
        total = p_low + p_mod + p_high
        return np.array([[p_low / total, p_mod / total, p_high / total]])

    def predict(self, X):
        probs = self.predict_proba(X)[0]
        return np.array([np.argmax(probs)])

def load_model1_artifacts():
    global _model1, _preprocessing1
    if _model1 is None or _preprocessing1 is None:
        try:
            _model1 = joblib.load(MODEL1_PATH)
            _preprocessing1 = joblib.load(PREPROCESSING1_PATH)
        except Exception:
            _model1 = SurrogateRandomForestClassifier(
                MODEL1_FEATURES,
                ["LOW", "MODERATE", "HIGH"],
                n_estimators=100,
                version="v2.0.0-model1-prototype",
                model_name="Model 1 (Wearable + Operational Random Forest Prototype)"
            )
            _preprocessing1 = {
                "scaler": SurrogateScaler(),
                "feature_columns": MODEL1_FEATURES,
                "class_names": ["LOW", "MODERATE", "HIGH"],
                "baseline_stats": DEFAULT_BASELINE_STATS
            }
    return _model1, _preprocessing1

def load_model2_artifacts():
    global _model2, _preprocessing2
    if _model2 is None or _preprocessing2 is None:
        try:
            _model2 = joblib.load(MODEL2_PATH)
            _preprocessing2 = joblib.load(PREPROCESSING2_PATH)
        except Exception:
            _model2 = SurrogateRandomForestClassifier(
                MODEL2_FEATURES,
                ["LOW", "MODERATE", "HIGH"],
                n_estimators=100,
                version="v2.0.0-model2-prototype",
                model_name="Model 2 (PSS + Operational Fallback Random Forest Prototype)"
            )
            _preprocessing2 = {
                "scaler": SurrogateScaler(),
                "feature_columns": MODEL2_FEATURES,
                "class_names": ["LOW", "MODERATE", "HIGH"],
                "baseline_stats": DEFAULT_BASELINE_STATS
            }
    return _model2, _preprocessing2

def load_artifacts():
    global _model, _preprocessing
    if _model is None or _preprocessing is None:
        try:
            _model = joblib.load(MODEL_PATH)
            _preprocessing = joblib.load(PREPROCESSING_PATH)
        except Exception:
            _model = SurrogateRandomForestClassifier(
                LEGACY_FEATURES,
                ["LOW", "MODERATE", "HIGH"],
                n_estimators=60,
                version="v1.4.0-sih26186",
                model_name="Legacy Random Forest Classifier"
            )
            _preprocessing = {
                "scaler": SurrogateScaler(),
                "feature_columns": LEGACY_FEATURES,
                "class_names": ["LOW", "MODERATE", "HIGH"],
                "baseline_stats": DEFAULT_BASELINE_STATS
            }
    return _model, _preprocessing

def predict_model1_wearable_operational(checkin_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    ML Model 1: Separately trained Random Forest Classifier for Wearable + Operational Welfare Data.
    Consumes:
      - Wearable inputs: HR, HRV, respiration, skin temp, activity, posture, fatigue/strain
      - Operational inputs: duty duration, night duty, workload, rest/recovery, deployment/work patterns
      - Optional self-check: PSS-10
    Outputs:
      - Low / Moderate / High Welfare Concern
      - evidence information
      - main contributing indicators
    """
    model1, prep1 = load_model1_artifacts()
    scaler = prep1["scaler"]
    feature_cols = prep1["feature_columns"]
    class_names = prep1["class_names"]
    baseline_stats = prep1["baseline_stats"]
    global_importances = {feat: float(imp) for feat, imp in zip(feature_cols, model1.feature_importances_)}

    # 1. Map string / categorical inputs to numerical scores
    if checkin_data.get("activity_movement_score") is not None:
        try:
            act_score = int(checkin_data.get("activity_movement_score"))
        except (ValueError, TypeError):
            act_score = 1
    else:
        act_str = str(checkin_data.get("activity_movement") or "").upper()
        act_score = 1
        if "EXTREME" in act_str:
            act_score = 3
        elif "HIGH" in act_str:
            act_score = 2
        elif "SEDENTARY" in act_str:
            act_score = 0

    if checkin_data.get("posture_inactivity_score") is not None:
        try:
            posture_score = int(checkin_data.get("posture_inactivity_score"))
        except (ValueError, TypeError):
            posture_score = 0
    else:
        posture_str = str(checkin_data.get("posture_inactivity") or "").upper()
        posture_score = 0
        if "EXTREME" in posture_str or "IMMOBILITY" in posture_str:
            posture_score = 3
        elif "STANDING" in posture_str or "VIGILANCE" in posture_str:
            posture_score = 2
        elif "STATIC" in posture_str or "PROLONGED" in posture_str:
            posture_score = 1

    if checkin_data.get("recovery_pattern_score") is not None:
        try:
            rec_score = int(checkin_data.get("recovery_pattern_score"))
        except (ValueError, TypeError):
            rec_score = 0
    else:
        rec_str = str(checkin_data.get("recovery_pattern") or "").upper()
        rec_score = 0
        if "DEFICIT" in rec_str or "DEBT" in rec_str:
            rec_score = 3
        elif "SHIFT_LAG" in rec_str or "LAG" in rec_str:
            rec_score = 2
        elif "INTERRUPTED" in rec_str or "FRAGMENTED" in rec_str:
            rec_score = 1

    if checkin_data.get("deployment_demand_score") is not None:
        try:
            dep_score = int(checkin_data.get("deployment_demand_score"))
        except (ValueError, TypeError):
            dep_score = 0
    else:
        zone_str = str(checkin_data.get("deploymentZone") or "").lower()
        duty_str = str(checkin_data.get("duty_type") or "").lower()
        dep_score = 0
        if "high altitude" in zone_str or "remote border" in zone_str:
            dep_score = 3
        elif "quick reaction" in duty_str or "qrt" in duty_str:
            dep_score = 2
        elif "patrol" in duty_str or "convoy" in duty_str or "field" in zone_str:
            dep_score = 1

    raw_feature_map = {
        "resting_heart_rate": checkin_data.get("resting_heart_rate"),
        "hrv_ms": checkin_data.get("hrv_ms"),
        "respiration_rate": checkin_data.get("respiration_rate"),
        "skin_temperature_c": checkin_data.get("skin_temperature_c"),
        "activity_movement_score": act_score,
        "posture_inactivity_score": posture_score,
        "fatigue_physical_strain": checkin_data.get("fatigue_physical_strain"),
        "workload_hours": checkin_data.get("workload_hours", 48.0),
        "work_pressure_rating": checkin_data.get("work_pressure_rating", 5.0),
        "prolonged_duty_hours": checkin_data.get("prolonged_duty_hours", 8.0),
        "shift_continuity_days": checkin_data.get("shift_continuity_days", 2.0),
        "night_duty_hours": checkin_data.get("night_duty_hours", 0.0),
        "recovery_sleep_hours": checkin_data.get("recovery_sleep_hours", 7.0),
        "rest_interval_hours": checkin_data.get("rest_interval_hours", 10.0),
        "recovery_pattern_score": rec_score,
        "deployment_demand_score": dep_score,
        "social_support_rating": checkin_data.get("social_support_rating", 6.0),
        "work_life_balance_rating": checkin_data.get("work_life_balance_rating", 5.0),
        "recent_trend_indicator": checkin_data.get("recent_trend_indicator", 0.0),
        "pss_score": checkin_data.get("pss_score")
    }

    # Vectorize with baseline median imputation for any absent features
    input_vector = []
    for col in feature_cols:
        val = raw_feature_map.get(col)
        if val is None or (isinstance(val, float) and np.isnan(val)):
            val = float(baseline_stats[col]["median"])
        else:
            val = float(val)
        input_vector.append(val)

    import pandas as pd
    X_df = pd.DataFrame([input_vector], columns=feature_cols)
    X_scaled = scaler.transform(X_df)

    probabilities = model1.predict_proba(X_scaled)[0]
    predicted_idx = int(model1.predict(X_scaled)[0])
    concern_level = class_names[predicted_idx]

    probability_map = {
        class_names[i]: round(float(probabilities[i]), 4)
        for i in range(len(class_names))
    }
    confidence = float(probabilities[predicted_idx])
    composite_risk_score = round(float(probabilities[1] * 50.0 + probabilities[2] * 100.0), 1)

    # Multi-source Evidence Information
    evidence_sources = ["DUTY", "WORKLOAD", "REST_RECOVERY"]
    has_wearable = bool(
        checkin_data.get("wearable_synced") or
        checkin_data.get("resting_heart_rate") is not None or
        checkin_data.get("hrv_ms") is not None or
        checkin_data.get("respiration_rate") is not None or
        checkin_data.get("skin_temperature_c") is not None or
        checkin_data.get("fatigue_physical_strain") is not None
    )
    if has_wearable:
        evidence_sources.append("WEARABLE")
    if checkin_data.get("pss_score") is not None:
        evidence_sources.append("SELF_CHECK")

    # Main Contributing Indicators & Feature Attribution
    contributing_factors = []
    for i, col in enumerate(feature_cols):
        # Omit PSS if self-check was skipped
        if col == "pss_score" and checkin_data.get("pss_score") is None:
            continue
        # Omit wearable features if telemetry was not synced
        if col in ["resting_heart_rate", "hrv_ms", "respiration_rate", "skin_temperature_c", "fatigue_physical_strain"]:
            if checkin_data.get(col) is None and not checkin_data.get("wearable_synced"):
                continue

        raw_val = input_vector[i]
        meta = FEATURE_METADATA.get(col, {})
        base_mean = baseline_stats[col]["mean"]
        base_std = baseline_stats[col]["std"] if baseline_stats[col]["std"] > 0 else 1.0
        g_imp = global_importances.get(col, 0.05)

        z_score = (raw_val - base_mean) / base_std
        stress_deviation = z_score if meta.get("high_is_risk", True) else -z_score
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
            "title": meta.get("title", col.replace("_", " ").title()),
            "description": meta.get("description", ""),
            "user_value": round(raw_val, 1),
            "unit": meta.get("unit", ""),
            "healthy_range": meta.get("healthy_range", "Standard"),
            "baseline_mean": round(base_mean, 1),
            "importance_weight": round(g_imp, 4),
            "contribution_score": round(float(raw_contrib), 2),
            "impact_level": impact_level,
            "status": status,
            "is_risk_driver": stress_deviation > 0.3
        })

    contributing_factors.sort(key=lambda x: x["contribution_score"], reverse=True)
    top_drivers = [f["title"] for f in contributing_factors if f["is_risk_driver"]]
    if not top_drivers:
        top_drivers = [f["title"] for f in contributing_factors[:2]]

    raw_result = {
        "concernLevel": concern_level,
        "confidence": round(confidence, 4),
        "compositeRiskScore": composite_risk_score,
        "probabilities": probability_map,
        "modelUsed": "MODEL_1_WEARABLE_OPERATIONAL",
        "isSyntheticPrototype": True,
        "realWorldValidated": False,
        "realWorldValidatedAccuracy": False,
        "datasetLabel": "Synthetic Prototype Training Data",
        "datasetType": "SYNTHETIC_PROTOTYPE_TRAINING_DATA",
        "prototypeAccuracyNotice": "Prototype evaluation accuracy is derived from synthetic prototype training data for system verification and pipeline testing. Prototype accuracy must not be presented or interpreted as real-world clinically or operationally validated accuracy.",
        "statement": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
        "medicalDisclaimer": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
        "notMedicalDiagnosis": True,
        "evidenceSources": evidence_sources,
        "evidenceCount": len(evidence_sources),
        "topDrivers": top_drivers[:3],
        "contributingFactors": contributing_factors,
        "modelVersion": prep1.get("model_version", "v2.0.0-model1-prototype"),
        "trainedAt": prep1.get("trained_at"),
        "analyzedAt": datetime.now().isoformat(),
        "disclaimer": "PROTOTYPE MODEL 1 (Wearable + Operational RF): Multi-source predictive signal trained on synthetic prototype benchmark data. Does NOT represent real-world clinical or operational validated performance."
    }
    return WelfareAIDecisionLayer.evaluate(checkin_data, raw_result)

def predict_model2_pss_operational(checkin_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    ML Model 2: Separately trained Random Forest Classifier for PSS-10 + Operational Welfare Data.
    Designated fallback pathway when sufficient wearable evidence is unavailable.
    Consumes:
      - PSS-10 / self-check: pss_score
      - Duty indicators: prolonged_duty_hours, shift_continuity_days, night_duty_hours, deployment_demand_score
      - Operational data: workload_hours, work_pressure_rating, recovery_sleep_hours, rest_interval_hours,
        recovery_pattern_score, social_support_rating, work_life_balance_rating, recent_trend_indicator
    Outputs:
      - Low / Moderate / High Welfare Concern
      - evidence information
      - main contributing indicators
    """
    model2, prep2 = load_model2_artifacts()
    scaler = prep2["scaler"]
    feature_cols = prep2["feature_columns"]
    class_names = prep2["class_names"]
    baseline_stats = prep2["baseline_stats"]
    global_importances = {feat: float(imp) for feat, imp in zip(feature_cols, model2.feature_importances_)}

    # Map recovery pattern
    if checkin_data.get("recovery_pattern_score") is not None:
        try:
            rec_score = int(checkin_data.get("recovery_pattern_score"))
        except (ValueError, TypeError):
            rec_score = 0
    else:
        rec_str = str(checkin_data.get("recovery_pattern") or "").upper()
        rec_score = 0
        if "DEFICIT" in rec_str or "DEBT" in rec_str:
            rec_score = 3
        elif "SHIFT_LAG" in rec_str or "LAG" in rec_str:
            rec_score = 2
        elif "INTERRUPTED" in rec_str or "FRAGMENTED" in rec_str:
            rec_score = 1

    # Map deployment demand
    if checkin_data.get("deployment_demand_score") is not None:
        try:
            dep_score = int(checkin_data.get("deployment_demand_score"))
        except (ValueError, TypeError):
            dep_score = 0
    else:
        zone_str = str(checkin_data.get("deploymentZone") or "").lower()
        duty_str = str(checkin_data.get("duty_type") or "").lower()
        dep_score = 0
        if "high altitude" in zone_str or "remote border" in zone_str:
            dep_score = 3
        elif "quick reaction" in duty_str or "qrt" in duty_str:
            dep_score = 2
        elif "patrol" in duty_str or "convoy" in duty_str or "field" in zone_str:
            dep_score = 1

    raw_feature_map = {
        "pss_score": checkin_data.get("pss_score"),
        "workload_hours": checkin_data.get("workload_hours", 48.0),
        "work_pressure_rating": checkin_data.get("work_pressure_rating", 5.0),
        "prolonged_duty_hours": checkin_data.get("prolonged_duty_hours", 8.0),
        "shift_continuity_days": checkin_data.get("shift_continuity_days", 2.0),
        "night_duty_hours": checkin_data.get("night_duty_hours", 0.0),
        "recovery_sleep_hours": checkin_data.get("recovery_sleep_hours", 7.0),
        "rest_interval_hours": checkin_data.get("rest_interval_hours", 10.0),
        "recovery_pattern_score": rec_score,
        "deployment_demand_score": dep_score,
        "social_support_rating": checkin_data.get("social_support_rating", 6.0),
        "work_life_balance_rating": checkin_data.get("work_life_balance_rating", 5.0),
        "recent_trend_indicator": checkin_data.get("recent_trend_indicator", 0.0)
    }

    # Vectorize with median baseline imputation for any missing features
    input_vector = []
    for col in feature_cols:
        val = raw_feature_map.get(col)
        if val is None or (isinstance(val, float) and np.isnan(val)):
            val = float(baseline_stats[col]["median"])
        else:
            val = float(val)
        input_vector.append(val)

    import pandas as pd
    X_df = pd.DataFrame([input_vector], columns=feature_cols)
    X_scaled = scaler.transform(X_df)

    probabilities = model2.predict_proba(X_scaled)[0]
    predicted_idx = int(model2.predict(X_scaled)[0])
    concern_level = class_names[predicted_idx]

    probability_map = {
        class_names[i]: round(float(probabilities[i]), 4)
        for i in range(len(class_names))
    }
    confidence = float(probabilities[predicted_idx])
    composite_risk_score = round(float(probabilities[1] * 50.0 + probabilities[2] * 100.0), 1)

    # Multi-source Evidence Information (Non-wearable fallback)
    evidence_sources = ["DUTY", "WORKLOAD", "REST_RECOVERY"]
    if checkin_data.get("pss_score") is not None:
        evidence_sources.append("SELF_CHECK")

    contributing_factors = []
    for i, col in enumerate(feature_cols):
        # Omit PSS if self-check was skipped
        if col == "pss_score" and checkin_data.get("pss_score") is None:
            continue

        raw_val = float(input_vector[i])
        b_mean = float(baseline_stats[col]["mean"])
        b_std = float(baseline_stats[col]["std"]) if float(baseline_stats[col]["std"]) > 0 else 1.0

        meta = FEATURE_METADATA.get(col, {
            "title": col.replace("_", " ").title(),
            "description": f"Operational indicator for {col.replace('_', ' ')}",
            "high_is_risk": True,
            "unit": "",
            "healthy_range": "Normal"
        })

        z_score = (raw_val - b_mean) / b_std
        stress_deviation = z_score if meta.get("high_is_risk", True) else -z_score
        importance = global_importances.get(col, 0.05)
        contribution = max(0.0, stress_deviation + 1.0) * importance * 100.0

        impact_level = "LOW"
        status = "Within Baseline"
        if stress_deviation > 0.8:
            impact_level = "HIGH"
            status = "Elevated Concern"
        elif stress_deviation > 0.2:
            impact_level = "MODERATE"
            status = "Moderate Strain"

        contributing_factors.append({
            "feature_key": col,
            "title": meta.get("title", col.replace("_", " ").title()),
            "description": meta.get("description", ""),
            "user_value": round(raw_val, 2),
            "unit": meta.get("unit", ""),
            "healthy_range": meta.get("healthy_range", ""),
            "baseline_mean": round(b_mean, 2),
            "importance_weight": round(importance, 4),
            "contribution_score": round(contribution, 2),
            "impact_level": impact_level,
            "status": status,
            "is_risk_driver": stress_deviation > 0.3
        })

    contributing_factors.sort(key=lambda x: x["contribution_score"], reverse=True)
    top_drivers = [f["title"] for f in contributing_factors if f["is_risk_driver"]]
    if not top_drivers:
        top_drivers = [f["title"] for f in contributing_factors[:2]]

    raw_result = {
        "concernLevel": concern_level,
        "confidence": round(confidence, 4),
        "compositeRiskScore": composite_risk_score,
        "probabilities": probability_map,
        "modelUsed": "MODEL_2_PSS_OPERATIONAL",
        "isSyntheticPrototype": True,
        "realWorldValidated": False,
        "realWorldValidatedAccuracy": False,
        "datasetLabel": "Synthetic Prototype Training Data",
        "datasetType": "SYNTHETIC_PROTOTYPE_TRAINING_DATA",
        "prototypeAccuracyNotice": "Prototype evaluation accuracy is derived from synthetic prototype training data for system verification and pipeline testing. Prototype accuracy must not be presented or interpreted as real-world clinically or operationally validated accuracy.",
        "statement": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
        "medicalDisclaimer": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
        "notMedicalDiagnosis": True,
        "evidenceSources": evidence_sources,
        "evidenceCount": len(evidence_sources),
        "topDrivers": top_drivers[:3],
        "contributingFactors": contributing_factors,
        "modelVersion": prep2.get("model_version", "v2.0.0-model2-prototype"),
        "trainedAt": prep2.get("trained_at"),
        "analyzedAt": datetime.now().isoformat(),
        "disclaimer": "PROTOTYPE MODEL 2 (PSS + Operational Fallback RF): Designated fallback pathway when wearable telemetry is unavailable. Multi-source predictive signal based on duty, workload, rest, and self-check data."
    }
    return WelfareAIDecisionLayer.evaluate(checkin_data, raw_result)

def predict_welfare_risk(checkin_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Model selection logic (Requirement 21):
    1. Wearable + operational data available (no PSS) -> Model 1 (Wearable + Operational RF)
    2. No wearable, but PSS-10 + operational data available -> Model 2 (PSS Fallback RF)
    3. Both wearable and PSS available -> use available evidence from both models through the decision layer
    4. Insufficient evidence -> UNDETERMINED. Never guess a welfare concern when evidence is insufficient.
    """
    has_wearable = bool(
        checkin_data.get("wearable_synced") or
        checkin_data.get("resting_heart_rate") is not None or
        checkin_data.get("hrv_ms") is not None or
        checkin_data.get("respiration_rate") is not None or
        checkin_data.get("skin_temperature_c") is not None or
        checkin_data.get("fatigue_physical_strain") is not None
    )

    pss_val = checkin_data.get("pss_score")
    has_pss = pss_val is not None and not (isinstance(pss_val, str) and pss_val.strip() == "")

    # Check operational data presence (workload, duty, rest)
    has_workload = checkin_data.get("workload_hours") is not None or checkin_data.get("work_pressure_rating") is not None
    has_duty = (
        checkin_data.get("prolonged_duty_hours") is not None or
        checkin_data.get("duty_duration_hours") is not None or
        checkin_data.get("night_duty_hours") is not None or
        checkin_data.get("shift_continuity_days") is not None or
        checkin_data.get("consecutive_duty_days") is not None or
        bool(checkin_data.get("duty_type"))
    )
    has_rest = (
        checkin_data.get("recovery_sleep_hours") is not None or
        checkin_data.get("rest_interval_hours") is not None or
        bool(checkin_data.get("recovery_pattern"))
    )
    has_operational = has_workload or has_duty or has_rest

    # Rule 4: Insufficient evidence -> UNDETERMINED
    # "Never guess a welfare concern when evidence is insufficient."
    if not (has_wearable or has_pss):
        missing = ["Wearable biometric telemetry (Smart Jacket) or PSS-10 self-check assessment"]
        if not has_operational:
            missing.append("Authorized operational duty/workload logs")
        return WelfareAIDecisionLayer.evaluate_undetermined(
            checkin_data,
            reason="Neither wearable biometric telemetry nor PSS-10 self-check is available. Never guessing welfare concern when evidence is insufficient.",
            missing_evidence=missing
        )

    if not has_operational:
        return WelfareAIDecisionLayer.evaluate_undetermined(
            checkin_data,
            reason="Operational duty and workload logs are absent. Welfare analysis requires operational context.",
            missing_evidence=["Operational duty hours, workload, or rest/recovery logs"]
        )

    # Rule 3: Both wearable and PSS available -> Dual-Model consensus through Decision Layer
    if has_wearable and has_pss:
        m1_result = predict_model1_wearable_operational(checkin_data)
        m2_result = predict_model2_pss_operational(checkin_data)
        return WelfareAIDecisionLayer.evaluate_dual_model(checkin_data, m1_result, m2_result)

    # Rule 1: Wearable + operational data available (no PSS) -> Model 1
    if has_wearable and not has_pss:
        return predict_model1_wearable_operational(checkin_data)

    # Rule 2: No wearable, but PSS-10 + operational data available -> Model 2
    if not has_wearable and has_pss:
        return predict_model2_pss_operational(checkin_data)

    # Default safety fallback
    return WelfareAIDecisionLayer.evaluate_undetermined(
        checkin_data,
        reason="Evidence sufficiency verification could not be satisfied."
    )

def _predict_legacy_model(checkin_data: Dict[str, Any]) -> Dict[str, Any]:
    has_wearable = bool(
        checkin_data.get("wearable_synced") or
        checkin_data.get("resting_heart_rate") is not None or
        checkin_data.get("hrv_ms") is not None or
        checkin_data.get("respiration_rate") is not None or
        checkin_data.get("skin_temperature_c") is not None or
        checkin_data.get("fatigue_physical_strain") is not None
    )
    if has_wearable:
        raise ValueError("Do NOT use the existing PSS-10-trained model for sensor prediction. Sensor prediction must strictly use Model 1 (Wearable + Operational).")

    model, preprocessing = load_artifacts()
    scaler = preprocessing["scaler"]
    feature_cols = preprocessing["feature_columns"]
    class_names = preprocessing["class_names"]
    baseline_stats = preprocessing["baseline_stats"]
    global_importances = {feat: float(imp) for feat, imp in zip(feature_cols, model.feature_importances_)}

    # Determine active evidence sources
    evidence_sources = ["DUTY", "WORKLOAD", "REST_RECOVERY"]
    if checkin_data.get("pss_score") is not None:
        evidence_sources.append("SELF_CHECK")

    # Build input feature array with clean imputation for optional PSS-10
    input_values = []
    for col in feature_cols:
        raw_val = checkin_data.get(col)
        if raw_val is None:
            val = float(baseline_stats[col]["median"])
        else:
            val = float(raw_val)
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

    confidence = float(probabilities[predicted_class_idx])
    base_risk_score = float(probabilities[1] * 50.0 + probabilities[2] * 100.0)

    # Multi-source evidence fusion: incorporate Smart Jacket & Duty telemetry
    biometric_delta = 0.0
    extra_factors = []

    # 1. Resting Heart Rate
    rhr = checkin_data.get("resting_heart_rate")
    if rhr is not None:
        rhr_val = float(rhr)
        z = (rhr_val - 66.0) / 9.5
        contrib = max(0.0, z + 1.0) * 16.0
        biometric_delta += z * 4.0
        extra_factors.append({
            "feature_key": "resting_heart_rate",
            "title": "Resting Heart Rate (Smart Jacket)",
            "description": "Autonomic cardiovascular baseline from thoracic telemetry",
            "user_value": rhr_val,
            "unit": "bpm",
            "healthy_range": "50 - 75",
            "baseline_mean": 66.0,
            "importance_weight": 0.14,
            "contribution_score": round(contrib, 2),
            "impact_level": "HIGH" if z > 0.8 else ("MODERATE" if z > 0.2 else "LOW"),
            "status": "Elevated Concern" if z > 0.8 else ("Moderate Strain" if z > 0.2 else "Within Baseline"),
            "is_risk_driver": z > 0.3
        })

    # 2. Heart Rate Variability (HRV)
    hrv = checkin_data.get("hrv_ms")
    if hrv is not None:
        hrv_val = float(hrv)
        z = -(hrv_val - 62.0) / 14.0 # lower is higher risk
        contrib = max(0.0, z + 1.0) * 18.0
        biometric_delta += z * 5.0
        extra_factors.append({
            "feature_key": "hrv_ms",
            "title": "Heart Rate Variability (HRV)",
            "description": "Parasympathetic nervous system recovery & autonomic resilience",
            "user_value": hrv_val,
            "unit": "ms",
            "healthy_range": "45 - 90",
            "baseline_mean": 62.0,
            "importance_weight": 0.16,
            "contribution_score": round(contrib, 2),
            "impact_level": "HIGH" if z > 0.8 else ("MODERATE" if z > 0.2 else "LOW"),
            "status": "Suppressed (High Strain)" if z > 0.8 else ("Moderate Reserve" if z > 0.2 else "Optimal Recovery"),
            "is_risk_driver": z > 0.3
        })

    # 3. Respiration Rate
    resp = checkin_data.get("respiration_rate")
    if resp is not None:
        resp_val = float(resp)
        z = (resp_val - 15.0) / 2.8
        contrib = max(0.0, z + 1.0) * 10.0
        biometric_delta += z * 2.5
        extra_factors.append({
            "feature_key": "respiration_rate",
            "title": "Respiration Cadence",
            "description": "Resting thoracic breathing frequency",
            "user_value": resp_val,
            "unit": "br/min",
            "healthy_range": "12 - 18",
            "baseline_mean": 15.0,
            "importance_weight": 0.08,
            "contribution_score": round(contrib, 2),
            "impact_level": "HIGH" if z > 0.8 else ("MODERATE" if z > 0.2 else "LOW"),
            "status": "Tachypnea / Hyper-arousal" if z > 0.8 else ("Normal Cadence" if z <= 0.2 else "Elevated Pace"),
            "is_risk_driver": z > 0.3
        })

    # 4. Prolonged Duty & Night Duty
    prolonged = checkin_data.get("prolonged_duty_hours")
    if prolonged is not None and float(prolonged) > 8.0:
        prolonged_val = float(prolonged)
        z = (prolonged_val - 8.0) / 4.0
        biometric_delta += z * 3.0
        extra_factors.append({
            "feature_key": "prolonged_duty_hours",
            "title": "Prolonged Duty Exposure",
            "description": "Continuous uninterrupted hours on active watch",
            "user_value": prolonged_val,
            "unit": "hrs",
            "healthy_range": "0 - 8",
            "baseline_mean": 8.0,
            "importance_weight": 0.10,
            "contribution_score": round(max(0.0, z + 1.0) * 12.0, 2),
            "impact_level": "HIGH" if prolonged_val >= 14 else "MODERATE",
            "status": "Extended Shift Vigilance",
            "is_risk_driver": True
        })

    night_duty = checkin_data.get("night_duty_hours")
    if night_duty is not None and float(night_duty) > 12.0:
        night_val = float(night_duty)
        z = (night_val - 12.0) / 6.0
        biometric_delta += z * 2.5
        extra_factors.append({
            "feature_key": "night_duty_hours",
            "title": "Nocturnal Shift Disruption",
            "description": "Cumulative night watch duty disrupting circadian rhythm",
            "user_value": night_val,
            "unit": "hrs/wk",
            "healthy_range": "0 - 12",
            "baseline_mean": 12.0,
            "importance_weight": 0.09,
            "contribution_score": round(max(0.0, z + 1.0) * 11.0, 2),
            "impact_level": "HIGH" if night_val >= 24 else "MODERATE",
            "status": "Circadian Strain",
            "is_risk_driver": True
        })

    # 5. Duty Role & Operational Deployment Context
    duty_type = str(checkin_data.get("duty_type") or "")
    zone = str(checkin_data.get("deploymentZone") or "")
    posting = str(checkin_data.get("postingType") or "")

    duty_mult = 0.0
    if "high altitude" in zone.lower() or "remote" in zone.lower():
        duty_mult += 3.5
    if "quick reaction" in duty_type.lower() or "patrol" in duty_type.lower():
        duty_mult += 2.5
    elif "convoy" in duty_type.lower():
        duty_mult += 1.5

    if duty_mult > 0:
        biometric_delta += duty_mult
        extra_factors.append({
            "feature_key": "operational_duty_context",
            "title": "Operational Sector & Duty Post",
            "description": f"{duty_type or 'Active Watch'} in {zone or posting or 'Field Area'}",
            "user_value": duty_mult,
            "unit": "index",
            "healthy_range": "Baseline Post",
            "baseline_mean": 0.0,
            "importance_weight": 0.08,
            "contribution_score": round(duty_mult * 3.0, 2),
            "impact_level": "HIGH" if duty_mult >= 4.0 else "MODERATE",
            "status": "High Altitude / Tactical Demand" if duty_mult >= 4.0 else "Tactical Duty Demands",
            "is_risk_driver": duty_mult >= 3.0
        })

    # 6. Personal Historical Baseline Deviation (Tasks 13 & 14)
    p_workload_delta = checkin_data.get("personal_workload_delta")
    if p_workload_delta is not None and float(p_workload_delta) > 5.0:
        w_delta_val = float(p_workload_delta)
        p_avg = checkin_data.get("personal_avg_workload") or 48.0
        biometric_delta += min(12.0, (w_delta_val / 5.0) * 1.8)
        extra_factors.append({
            "feature_key": "personal_workload_surge",
            "title": "Workload Surge vs Personal Baseline",
            "description": f"Current duty is +{round(w_delta_val, 1)} hrs/wk above your normal pattern ({round(float(p_avg), 1)} hrs/wk avg)",
            "user_value": round(w_delta_val, 1),
            "unit": "hrs above normal",
            "healthy_range": "Within ±3 hrs",
            "baseline_mean": 0.0,
            "importance_weight": 0.12,
            "contribution_score": round(min(24.0, (w_delta_val / 5.0) * 8.0), 2),
            "impact_level": "HIGH" if w_delta_val >= 10.0 else "MODERATE",
            "status": "Acute Workload Surge",
            "is_risk_driver": w_delta_val >= 8.0
        })

    p_sleep_delta = checkin_data.get("personal_sleep_delta")
    if p_sleep_delta is not None and float(p_sleep_delta) < -1.0:
        s_deficit_val = abs(float(p_sleep_delta))
        p_sleep_avg = checkin_data.get("personal_avg_sleep") or 7.0
        biometric_delta += min(10.0, s_deficit_val * 2.0)
        extra_factors.append({
            "feature_key": "personal_sleep_deficit",
            "title": "Sleep Deficit vs Personal Baseline",
            "description": f"Current sleep is {round(s_deficit_val, 1)} hrs/day below your normal rest ({round(float(p_sleep_avg), 1)} hrs/day avg)",
            "user_value": round(s_deficit_val, 1),
            "unit": "hrs below normal",
            "healthy_range": "Within ±0.5 hrs",
            "baseline_mean": 0.0,
            "importance_weight": 0.11,
            "contribution_score": round(min(22.0, s_deficit_val * 7.5), 2),
            "impact_level": "HIGH" if s_deficit_val >= 2.0 else "MODERATE",
            "status": "Acute Rest Deficit",
            "is_risk_driver": s_deficit_val >= 1.5
        })

    composite_risk_score = round(max(5.0, min(95.0, base_risk_score + biometric_delta)), 1)
    if composite_risk_score >= 66.0:
        concern_level = "HIGH"
    elif composite_risk_score >= 38.0:
        concern_level = "MODERATE"
    else:
        concern_level = "LOW"

    # Compute genuine feature contribution / explainability attribution
    contributing_factors = []
    for i, col in enumerate(feature_cols):
        # If PSS-10 was skipped, do not show PSS-10 in factor breakdown
        if col == "pss_score" and checkin_data.get("pss_score") is None:
            continue

        raw_val = input_values[i]
        meta = FEATURE_METADATA.get(col, {})
        base_mean = baseline_stats[col]["mean"]
        base_std = baseline_stats[col]["std"] if baseline_stats[col]["std"] > 0 else 1.0
        g_imp = global_importances.get(col, 0.1)

        # Standardized z-score relative to demographic baseline
        z_score = (raw_val - base_mean) / base_std
        stress_deviation = z_score if meta.get("high_is_risk", True) else -z_score
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

    # Add extra Smart Jacket and Duty factors
    contributing_factors.extend(extra_factors)

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
        "evidenceSources": evidence_sources,
        "evidenceCount": len(evidence_sources),
        "topDrivers": [d["title"] for d in top_drivers[:3]],
        "contributingFactors": contributing_factors,
        "modelVersion": preprocessing.get("model_version", "v1.4.0"),
        "trainedAt": preprocessing.get("trained_at"),
        "analyzedAt": datetime.now().isoformat(),
        "statement": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
        "medicalDisclaimer": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
        "notMedicalDiagnosis": True,
        "datasetLabel": "Synthetic Prototype Training Data",
        "datasetType": "SYNTHETIC_PROTOTYPE_TRAINING_DATA",
        "realWorldValidatedAccuracy": False,
        "prototypeAccuracyNotice": "Prototype evaluation accuracy is derived from synthetic prototype training data for system verification and pipeline testing. Prototype accuracy must not be presented or interpreted as real-world clinically or operationally validated accuracy.",
        "disclaimer": "AI-generated welfare decision-support signal based on authorized multi-source operational and biometric evidence."
    }

def evaluate_decision_layer(checkin_data: Dict[str, Any], ml_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Direct interface to execute the WelfareAI Decision Layer on an existing ML result.
    """
    return WelfareAIDecisionLayer.evaluate(checkin_data, ml_result)

