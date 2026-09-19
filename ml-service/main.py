"""
=============================================================================
SIH26186 — AI-Based Predictive Personnel Stress & Welfare Monitoring System
Module: FastAPI ML Microservice
=============================================================================
FastAPI service exposing real Random Forest inference, explainability metrics,
and model health checks.
=============================================================================
"""

import os
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from predict import (
    predict_welfare_risk,
    predict_model1_wearable_operational,
    predict_model2_pss_operational,
    evaluate_decision_layer,
    load_artifacts,
    load_model1_artifacts,
    load_model2_artifacts
)

app = FastAPI(
    title="SIH26186 Personnel Welfare ML Service",
    description="Real Random Forest Inference and Explainability Service for Uniformed Forces Welfare Monitoring (Model 1: Wearable + Operational, Model 2: PSS + Operational Fallback)",
    version="2.0.0"
)

# CORS Middleware: explicitly whitelist trusted origins for credentials support
cors_origins_env = os.environ.get("CORS_ORIGIN", "http://localhost:5000,http://127.0.0.1:5000,http://localhost:8000,http://127.0.0.1:8000")
allowed_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EVAL_DIR = os.path.join(BASE_DIR, "evaluation")
METRICS_PATH = os.path.join(EVAL_DIR, "metrics.json")
CONFUSION_MATRIX_PATH = os.path.join(EVAL_DIR, "confusion_matrix.json")
MODEL1_METRICS_PATH = os.path.join(EVAL_DIR, "model1_metrics.json")
MODEL1_CONFUSION_MATRIX_PATH = os.path.join(EVAL_DIR, "model1_confusion_matrix.json")
MODEL2_METRICS_PATH = os.path.join(EVAL_DIR, "model2_metrics.json")
MODEL2_CONFUSION_MATRIX_PATH = os.path.join(EVAL_DIR, "model2_confusion_matrix.json")

class CheckInInput(BaseModel):
    # Source 4: Optional Self-Check / PSS-10
    pss_score: Optional[float] = Field(default=None, ge=0.0, le=40.0, description="Perceived Stress Scale score (0-40, optional)")
    
    # Source 2: Operational Workload
    workload_hours: Optional[float] = Field(default=None, ge=0.0, le=168.0, description="Weekly duty hours (0-168, optional)")
    work_pressure_rating: Optional[float] = Field(default=None, ge=1.0, le=10.0, description="Subjective pressure rating (1-10, optional)")
    recent_trend_indicator: Optional[float] = Field(default=0.0, ge=-10.0, le=10.0, description="Recent trend delta indicator (-10 to 10)")
    
    # Source 3: Rest & Recovery Patterns
    recovery_sleep_hours: Optional[float] = Field(default=None, ge=0.0, le=24.0, description="Daily sleep/rest hours (0-24, optional)")
    work_life_balance_rating: Optional[float] = Field(default=5.0, ge=1.0, le=10.0, description="Work-life balance rating (1-10)")
    recovery_pattern: Optional[str] = Field(default='CONTINUOUS', description="Recovery pattern (e.g. CONTINUOUS, FRAGMENTED, SLEEP_DEBT)")
    rest_interval_hours: Optional[float] = Field(default=8.0, ge=0.0, le=48.0, description="Unbroken rest interval between watches (hours)")
    
    # Source 1: Duty Exposure
    shift_continuity_days: Optional[float] = Field(default=0.0, ge=0.0, le=60.0, description="Consecutive shift duty days (0-60)")
    prolonged_duty_hours: Optional[float] = Field(default=0.0, ge=0.0, le=48.0, description="Continuous uninterrupted shift duty (hours)")
    night_duty_hours: Optional[float] = Field(default=0.0, ge=0.0, le=80.0, description="Graveyard / night duty exposure in last 7 days (hours)")
    duty_type: Optional[str] = Field(default='Patrol & Active Security', description="Operational duty role or watch profile")
    postingType: Optional[str] = Field(default='Field Operations', description="Service operational posting type")
    deploymentZone: Optional[str] = Field(default='Standard Field Deployment', description="Operational sector or terrain classification")
    
    # Source 4: Self-Check Additional
    social_support_rating: Optional[float] = Field(default=5.0, ge=1.0, le=10.0, description="Social & peer support rating (1-10, optional)")
    
    # Source 5: Smart Jacket & Wearable Biometric Telemetry (Optional)
    resting_heart_rate: Optional[float] = Field(default=None, ge=40.0, le=180.0, description="Resting heart rate in bpm (40-180)")
    hrv_ms: Optional[float] = Field(default=None, ge=10.0, le=160.0, description="Heart rate variability in ms (10-160)")
    respiration_rate: Optional[float] = Field(default=None, ge=8.0, le=45.0, description="Respiration rate in breaths/min (8-45)")
    skin_temperature_c: Optional[float] = Field(default=None, ge=30.0, le=43.0, description="Body/skin temperature in Celsius (30.0-43.0)")
    activity_movement: Optional[str] = Field(default=None, description="Activity movement pattern (e.g. ACTIVE_PATROL, STATIC_GUARD)")
    posture_inactivity: Optional[str] = Field(default=None, description="Posture tracking state (e.g. STANDING_VIGILANCE, PROLONGED_INACTIVITY)")
    fatigue_physical_strain: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Physical strain and fatigue index (0-100)")
    wearable_synced: Optional[bool] = Field(default=False, description="True if telemetry originated from smart jacket sensor")

@app.on_event("startup")
async def startup_event():
    try:
        load_model1_artifacts()
        print("ML Service: Model 1 (Wearable + Operational RF) loaded successfully.")
    except Exception as e:
        print(f"ML Service Startup Warning: Model 1 artifacts not yet loaded ({e}).")
    try:
        load_model2_artifacts()
        print("ML Service: Model 2 (PSS + Operational Fallback RF) loaded successfully.")
    except Exception as e:
        print(f"ML Service Startup Warning: Model 2 artifacts not yet loaded ({e}).")
    try:
        load_artifacts()
        print("ML Service: Legacy Model artifacts loaded successfully.")
    except Exception as e:
        print(f"ML Service Startup Warning: Legacy artifacts not yet loaded ({e}).")

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Genuine health check for the ML service, verifying model file accessibility and memory status.
    """
    model_loaded = False
    model1_loaded = False
    model2_loaded = False
    details = {}
    try:
        m1, prep1 = load_model1_artifacts()
        model1_loaded = True
        details["model1"] = {
            "model_name": prep1.get("model_name", "Model 1 (Wearable + Operational RF)"),
            "model_type": type(m1).__name__,
            "n_estimators": getattr(m1, "n_estimators", 100),
            "features_count": len(prep1.get("feature_columns", [])),
            "model_version": prep1.get("model_version", "v2.0.0-model1"),
            "trained_at": prep1.get("trained_at")
        }
    except Exception as e1:
        details["model1_error"] = str(e1)

    try:
        m2, prep2 = load_model2_artifacts()
        model2_loaded = True
        details["model2"] = {
            "model_name": prep2.get("model_name", "Model 2 (PSS + Operational Fallback RF)"),
            "model_type": type(m2).__name__,
            "n_estimators": getattr(m2, "n_estimators", 100),
            "features_count": len(prep2.get("feature_columns", [])),
            "model_version": prep2.get("model_version", "v2.0.0-model2-prototype"),
            "trained_at": prep2.get("trained_at")
        }
    except Exception as e2:
        details["model2_error"] = str(e2)

    try:
        model, prep = load_artifacts()
        model_loaded = True
        details["legacy_model"] = {
            "model_type": type(model).__name__,
            "n_estimators": getattr(model, "n_estimators", 100),
            "features_count": len(prep.get("feature_columns", [])),
            "model_version": prep.get("model_version", "v1.0"),
            "trained_at": prep.get("trained_at")
        }
    except Exception as e:
        details["legacy_model_error"] = str(e)

    overall_loaded = model1_loaded or model2_loaded or model_loaded
    return {
        "status": "healthy" if overall_loaded else "degraded",
        "service": "WelfareAI-FastAPI-ML-Engine",
        "model_loaded": overall_loaded,
        "model1_loaded": model1_loaded,
        "model2_loaded": model2_loaded,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/predict", tags=["Prediction"])
async def predict(data: CheckInInput):
    """
    Receives structured check-in parameters and executes the trained Random Forest model.
    Returns:
      - concernLevel: "LOW" | "MODERATE" | "HIGH"
      - confidence: Probability score (0.0 to 1.0)
      - compositeRiskScore: 0 to 100
      - probabilities: Per-class breakdown
      - topDrivers: Primary contributing factors
      - contributingFactors: Full explainability attribution
    """
    try:
        input_dict = data.dict()
        result = predict_welfare_risk(input_dict)
        return {
            "success": True,
            "data": result
        }
    except FileNotFoundError as fe:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML Model artifacts not trained or found. Please ensure training has executed."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference processing failed: {str(e)}"
        )

@app.post("/predict/model1", tags=["Model 1"])
async def predict_model1(data: CheckInInput):
    """
    Executes dedicated Random Forest Model 1 for Wearable + Operational data.
    """
    try:
        input_dict = data.dict()
        result = predict_model1_wearable_operational(input_dict)
        return {
            "success": True,
            "data": result
        }
    except FileNotFoundError as fe:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model 1 artifacts not trained or found. Please ensure train_model1_wearable_operational.py has executed."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model 1 inference failed: {str(e)}"
        )

@app.get("/model1-info", tags=["Model 1"])
async def get_model1_info():
    """
    Returns transparent metadata for Model 1 (Wearable + Operational RF Prototype).
    """
    try:
        m1, prep1 = load_model1_artifacts()
        return {
            "model_name": prep1.get("model_name", "Model 1 (Wearable + Operational Random Forest Prototype)"),
            "framework": "scikit-learn",
            "model_version": prep1.get("model_version", "v2.0.0-model1-prototype"),
            "trained_at": prep1.get("trained_at"),
            "is_synthetic_prototype": True,
            "real_world_validated": False,
            "real_world_validated_accuracy": False,
            "dataset_provenance": "SYNTHETIC_PROTOTYPE_BENCHMARK",
            "dataset_label": "Synthetic Prototype Training Data",
            "dataset_type": "SYNTHETIC_PROTOTYPE_TRAINING_DATA",
            "prototype_accuracy_notice": "Prototype evaluation accuracy is derived from synthetic prototype training data for system architecture and pipeline verification. Prototype accuracy must not be presented or interpreted as real-world clinically or operationally validated accuracy.",
            "statement": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
            "medical_disclaimer": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
            "not_medical_diagnosis": True,
            "n_estimators": getattr(m1, "n_estimators", 100),
            "features_count": len(prep1.get("feature_columns", [])),
            "features": prep1.get("feature_columns", []),
            "class_names": prep1.get("class_names", []),
            "baseline_statistics": prep1.get("baseline_stats", {}),
            "disclaimer": prep1.get("disclaimer", "PROTOTYPE MODEL: Trained on synthetic prototype benchmark data for system integration verification. Accuracy does NOT represent real-world clinical or operational validated performance.")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/evaluation/model1", tags=["Model 1"])
async def get_model1_evaluation():
    """
    Returns actual test evaluation metrics for Model 1 (Accuracy, Precision, Recall, F1, Confusion Matrix).
    """
    if not os.path.exists(MODEL1_METRICS_PATH):
        raise HTTPException(
            status_code=404,
            detail="Model 1 evaluation metrics not found. Run train_model1_wearable_operational.py first."
        )

    with open(MODEL1_METRICS_PATH, "r") as f:
        metrics = json.load(f)

    cm_data = {}
    if os.path.exists(MODEL1_CONFUSION_MATRIX_PATH):
        with open(MODEL1_CONFUSION_MATRIX_PATH, "r") as f:
            cm_data = json.load(f)

    return {
        "status": "success",
        "model": "Model 1 (Wearable + Operational Random Forest Prototype)",
        "is_synthetic_prototype": True,
        "real_world_validated": False,
        "real_world_validated_accuracy": False,
        "dataset_provenance": "SYNTHETIC_PROTOTYPE_BENCHMARK",
        "dataset_label": "Synthetic Prototype Training Data",
        "dataset_type": "SYNTHETIC_PROTOTYPE_TRAINING_DATA",
        "prototype_accuracy_notice": "Prototype evaluation accuracy is derived from synthetic prototype training data for system architecture and pipeline verification. Prototype accuracy must not be presented or interpreted as real-world clinically or operationally validated accuracy.",
        "statement": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
        "medical_disclaimer": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
        "not_medical_diagnosis": True,
        "accuracy": metrics.get("accuracy"),
        "precision_macro": metrics.get("precision_macro"),
        "recall_macro": metrics.get("recall_macro"),
        "f1_macro": metrics.get("f1_macro"),
        "per_class": metrics.get("per_class"),
        "train_samples": metrics.get("train_samples"),
        "test_samples": metrics.get("test_samples"),
        "metrics": metrics,
        "confusion_matrix": cm_data.get("matrix", cm_data),
        "confusion_matrix_details": cm_data,
        "disclaimer": metrics.get("disclaimer", "PROTOTYPE MODEL: Evaluated on synthetic prototype benchmark data. Accuracy does NOT represent real-world clinical or operational validated performance.")
    }

@app.post("/predict/model2", tags=["Model 2"])
async def predict_model2(data: CheckInInput):
    """
    Executes dedicated Random Forest Model 2 for PSS-10 + Operational fallback data.
    """
    try:
        input_dict = data.dict()
        result = predict_model2_pss_operational(input_dict)
        return {
            "success": True,
            "data": result
        }
    except FileNotFoundError as fe:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model 2 artifacts not trained or found. Please ensure train_model2_pss_operational.py has executed."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model 2 inference failed: {str(e)}"
        )

@app.get("/model2-info", tags=["Model 2"])
async def get_model2_info():
    """
    Returns transparent metadata for Model 2 (PSS + Operational Fallback RF Prototype).
    """
    try:
        m2, prep2 = load_model2_artifacts()
        return {
            "model_name": prep2.get("model_name", "Model 2 (PSS + Operational Fallback Random Forest Prototype)"),
            "framework": "scikit-learn",
            "model_version": prep2.get("model_version", "v2.0.0-model2-prototype"),
            "trained_at": prep2.get("trained_at"),
            "is_synthetic_prototype": True,
            "real_world_validated": False,
            "real_world_validated_accuracy": False,
            "dataset_provenance": "SYNTHETIC_PROTOTYPE_BENCHMARK",
            "dataset_label": "Synthetic Prototype Training Data",
            "dataset_type": "SYNTHETIC_PROTOTYPE_TRAINING_DATA",
            "prototype_accuracy_notice": "Prototype evaluation accuracy is derived from synthetic prototype training data for system architecture and pipeline verification. Prototype accuracy must not be presented or interpreted as real-world clinically or operationally validated accuracy.",
            "statement": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
            "medical_disclaimer": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
            "not_medical_diagnosis": True,
            "n_estimators": getattr(m2, "n_estimators", 100),
            "features_count": len(prep2.get("feature_columns", [])),
            "features": prep2.get("feature_columns", []),
            "class_names": prep2.get("class_names", []),
            "baseline_statistics": prep2.get("baseline_stats", {}),
            "disclaimer": prep2.get("disclaimer", "PROTOTYPE MODEL 2: Designated fallback pathway when wearable telemetry is unavailable. Accuracy does NOT represent real-world clinical or operational validated performance.")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/evaluation/model2", tags=["Model 2"])
async def get_model2_evaluation():
    """
    Returns actual test evaluation metrics for Model 2 (Accuracy, Precision, Recall, F1, Confusion Matrix).
    """
    if not os.path.exists(MODEL2_METRICS_PATH):
        raise HTTPException(
            status_code=404,
            detail="Model 2 evaluation metrics not found. Run train_model2_pss_operational.py first."
        )

    with open(MODEL2_METRICS_PATH, "r") as f:
        metrics = json.load(f)

    cm_data = {}
    if os.path.exists(MODEL2_CONFUSION_MATRIX_PATH):
        with open(MODEL2_CONFUSION_MATRIX_PATH, "r") as f:
            cm_data = json.load(f)

    return {
        "status": "success",
        "model": "Model 2 (PSS + Operational Fallback Random Forest Prototype)",
        "is_synthetic_prototype": True,
        "real_world_validated": False,
        "real_world_validated_accuracy": False,
        "dataset_provenance": "SYNTHETIC_PROTOTYPE_BENCHMARK",
        "dataset_label": "Synthetic Prototype Training Data",
        "dataset_type": "SYNTHETIC_PROTOTYPE_TRAINING_DATA",
        "prototype_accuracy_notice": "Prototype evaluation accuracy is derived from synthetic prototype training data for system architecture and pipeline verification. Prototype accuracy must not be presented or interpreted as real-world clinically or operationally validated accuracy.",
        "statement": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
        "medical_disclaimer": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
        "not_medical_diagnosis": True,
        "accuracy": metrics.get("accuracy"),
        "precision_macro": metrics.get("precision_macro"),
        "recall_macro": metrics.get("recall_macro"),
        "f1_macro": metrics.get("f1_macro"),
        "per_class": metrics.get("per_class"),
        "train_samples": metrics.get("train_samples"),
        "test_samples": metrics.get("test_samples"),
        "metrics": metrics,
        "confusion_matrix": cm_data.get("matrix", cm_data),
        "confusion_matrix_details": cm_data,
        "disclaimer": metrics.get("disclaimer", "PROTOTYPE MODEL 2: Evaluated on synthetic prototype benchmark data for fallback verification. Accuracy does NOT represent real-world clinical or operational validated performance.")
    }

@app.get("/models", tags=["Model Registry"])
async def get_models_registry():
    """
    Returns architecture registry showing Model 1 and Model 2 independence,
    including distinct datasets, feature sets, and operational roles.
    """
    m1_info = {}
    m2_info = {}
    try:
        m1, prep1 = load_model1_artifacts()
        m1_info = {
            "model_name": prep1.get("model_name", "Model 1 (Wearable + Operational Random Forest Prototype)"),
            "model_type": type(m1).__name__,
            "version": prep1.get("model_version", "v2.0.0-model1-prototype"),
            "dataset": "dataset/synthetic_prototype_sensor_operational_dataset.csv",
            "training_script": "train_model1_wearable_operational.py",
            "artifact_model": "model1_wearable_operational.pkl",
            "artifact_preprocessing": "model1_preprocessing.pkl",
            "features_count": len(prep1.get("feature_columns", [])),
            "features": prep1.get("feature_columns", []),
            "has_wearable_telemetry": True,
            "role": "Primary welfare assessment pathway utilizing authorized wearable telemetry & operational indicators"
        }
    except Exception as e:
        m1_info = {"error": str(e)}

    try:
        m2, prep2 = load_model2_artifacts()
        m2_info = {
            "model_name": prep2.get("model_name", "Model 2 (PSS + Operational Fallback Random Forest Prototype)"),
            "model_type": type(m2).__name__,
            "version": prep2.get("model_version", "v2.0.0-model2-prototype"),
            "dataset": "dataset/synthetic_prototype_model2_pss_operational_dataset.csv",
            "training_script": "train_model2_pss_operational.py",
            "artifact_model": "model2_pss_operational.pkl",
            "artifact_preprocessing": "model2_preprocessing.pkl",
            "features_count": len(prep2.get("feature_columns", [])),
            "features": prep2.get("feature_columns", []),
            "has_wearable_telemetry": False,
            "role": "Fallback welfare assessment pathway when wearable telemetry is unavailable, relying on PSS-10 & operational factors"
        }
    except Exception as e:
        m2_info = {"error": str(e)}

    return {
        "architecture": "Dual Independent Random Forest Architecture",
        "independence_guarantee": {
            "strictly_independent": True,
            "shared_weights": False,
            "sensor_columns_in_model2": False,
            "distinct_datasets": True,
            "distinct_training_pipelines": True,
            "distinct_pickled_models": True
        },
        "model1": m1_info,
        "model2": m2_info
    }

@app.get("/model-info", tags=["Transparency"])
async def get_model_info():
    """
    Returns transparent information regarding the trained Random Forest model.
    """
    try:
        model, prep = load_artifacts()
        return {
            "model_name": "Random Forest Classifier",
            "framework": "scikit-learn",
            "model_version": prep.get("model_version", "v1.0"),
            "trained_at": prep.get("trained_at"),
            "n_estimators": getattr(model, "n_estimators", 100),
            "features": prep.get("feature_columns", []),
            "class_names": prep.get("class_names", []),
            "baseline_statistics": prep.get("baseline_stats", {}),
            "disclaimer": "Decision-support AI model developed for Personnel Welfare & Resilience Monitoring."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/evaluation", tags=["Transparency"])
async def get_evaluation_metrics():
    """
    Returns actual evaluation metrics (Accuracy, Precision, Recall, F1, Confusion Matrix).
    """
    if not os.path.exists(METRICS_PATH):
        raise HTTPException(
            status_code=404,
            detail="Evaluation metrics not found. Run train_model.py first."
        )
    
    with open(METRICS_PATH, "r") as f:
        metrics = json.load(f)

    cm_data = {}
    if os.path.exists(CONFUSION_MATRIX_PATH):
        with open(CONFUSION_MATRIX_PATH, "r") as f:
            cm_data = json.load(f)

    return {
        "metrics": metrics,
        "confusion_matrix": cm_data
    }

@app.post("/decision-layer/evaluate", tags=["Decision Layer"])
async def evaluate_decision_layer_endpoint(data: CheckInInput):
    """
    Executes the WelfareAI Decision Layer immediately downstream of ML Model 1 or Model 2,
    returning synthesized Welfare Concern, Evidence Strength, Main Contributors,
    and Human Welfare Review triage package.
    """
    try:
        input_dict = data.dict()
        result = predict_welfare_risk(input_dict)
        return {
            "success": True,
            "data": result.get("decisionLayer", result)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Decision Layer evaluation failed: {str(e)}"
        )

@app.get("/decision-layer/info", tags=["Decision Layer"])
async def get_decision_layer_info():
    """
    Returns metadata, criteria, and architecture for the WelfareAI Decision Layer.
    """
    return {
        "engine": "WelfareAI Decision Layer",
        "version": "v2.2.0-decision-layer",
        "role": "Synthesizes final Welfare Concern, Evidence Strength, and Main Contributors downstream of ML Models 1 & 2 to drive Human Welfare Review",
        "architecture_flow": [
            "1. Authorized Multi-Source Ingestion (Wearable, Duty, Workload, Rest, Self-Check)",
            "2. Model Dispatch (Model 1 when wearable telemetry synced; Model 2 fallback when absent)",
            "3. Decision Layer Post-Processing (Compounding operational strain & baseline calibration)",
            "4. Evidence Strength & Data Availability (Quality, Completeness, Availability — DATA AVAILABLE X/5)",
            "5. Main Contributors Attribution Ranking with Directional Indicators (↑ Workload, ↓ Rest)",
            "6. Automated Human Welfare Review Protocol (Officer Triage Alert & Guidelines)"
        ],
        "evidence_strength_pillars": {
            "quality": "Validity and plausibility of authorized signals (biometric ranges, telemetry sync, psychometric validity)",
            "completeness": "Coverage and parameter density across the 5 authorized streams",
            "availability": "Active synchronized streams vs offline/missing (DATA AVAILABLE — X / 5)",
            "decoupled_from_risk": True
        },
        "evidence_strength_levels": {
            "HIGH": "Score >= 0.75: Multi-source evidence with active continuous wearable biometrics + duty logs",
            "MODERATE": "Score >= 0.50: Authorized operational logs, rest records, and self-check input",
            "EMERGING": "Score >= 0.25: Preliminary evidence based on sparse or single-source parameters",
            "INSUFFICIENT": "Score < 0.25: Insufficient evidence; evaluation strictly marked UNDETERMINED"
        },
        "data_availability_rules": {
            "display_format": "DATA AVAILABLE — X / 5",
            "authorized_streams": ["DUTY", "WORKLOAD", "REST_RECOVERY", "SELF_CHECK", "WEARABLE"],
            "strict_counting": "Only count evidence sources that actually contain valid authorized data. Never count fake/demo values."
        },
        "main_contributors_rules": {
            "directional_indicators": "Clear directional arrows: ↑ Workload, ↓ Rest, ↑ Night duty, ↑ Fatigue indicators, wearable changes",
            "zero_invention": "Do not invent contributors; only features actually provided with true strain contribution are returned."
        },
        "model_selection_logic": {
            "pathway_1": "Wearable + operational data available -> Model 1 (Wearable + Operational RF)",
            "pathway_2": "No wearable, but PSS-10 + operational data available -> Model 2 (PSS Fallback RF)",
            "pathway_3": "Both wearable and PSS available -> Dual-Model consensus through WelfareAI Decision Layer",
            "pathway_4": "Insufficient evidence -> UNDETERMINED (Never guess a welfare concern when evidence is insufficient)"
        },
        "zero_guessing_guarantee": True,
        "statement": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
        "medical_disclaimer": "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.",
        "not_medical_diagnosis": True,
        "dataset_label": "Synthetic Prototype Training Data",
        "dataset_type": "SYNTHETIC_PROTOTYPE_TRAINING_DATA",
        "prototype_accuracy_notice": "Prototype evaluation accuracy is derived from synthetic prototype training data for system verification and pipeline testing. Prototype accuracy must not be presented or interpreted as real-world clinically or operationally validated accuracy.",
        "real_world_validated_accuracy": False,
        "review_priorities": ["CRITICAL", "HIGH", "ROUTINE", "STANDARD_MONITORING", "NONE"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
