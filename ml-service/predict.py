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

    # Determine active evidence sources
    evidence_sources = ["DUTY", "WORKLOAD", "REST_RECOVERY"]
    if checkin_data.get("pss_score") is not None:
        evidence_sources.append("SELF_CHECK")

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
        "disclaimer": "AI-generated welfare decision-support signal based on authorized multi-source operational and biometric evidence."
    }
