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

from predict import predict_welfare_risk, load_artifacts

app = FastAPI(
    title="SIH26186 Personnel Welfare ML Service",
    description="Real Random Forest Inference and Explainability Service for Uniformed Forces Welfare Monitoring",
    version="1.4.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EVAL_DIR = os.path.join(BASE_DIR, "evaluation")
METRICS_PATH = os.path.join(EVAL_DIR, "metrics.json")
CONFUSION_MATRIX_PATH = os.path.join(EVAL_DIR, "confusion_matrix.json")

class CheckInInput(BaseModel):
    pss_score: float = Field(..., ge=0.0, le=40.0, description="Perceived Stress Scale score (0-40)")
    workload_hours: float = Field(..., ge=20.0, le=120.0, description="Weekly duty hours (20-120)")
    work_pressure_rating: float = Field(..., ge=1.0, le=10.0, description="Subjective pressure rating (1-10)")
    recovery_sleep_hours: float = Field(..., ge=2.0, le=14.0, description="Daily sleep/rest hours (2-14)")
    social_support_rating: float = Field(..., ge=1.0, le=10.0, description="Social & peer support rating (1-10)")
    work_life_balance_rating: float = Field(..., ge=1.0, le=10.0, description="Work-life balance rating (1-10)")
    shift_continuity_days: float = Field(default=0.0, ge=0.0, le=60.0, description="Consecutive shift duty days (0-60)")
    recent_trend_indicator: float = Field(default=0.0, ge=-10.0, le=10.0, description="Recent trend delta indicator (-10 to 10)")

@app.on_event("startup")
async def startup_event():
    try:
        load_artifacts()
        print("ML Service: Model & Preprocessing artifacts loaded successfully.")
    except Exception as e:
        print(f"ML Service Startup Warning: Artifacts not yet loaded ({e}).")

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Genuine health check for the ML service, verifying model file accessibility and memory status.
    """
    model_loaded = False
    details = {}
    try:
        model, prep = load_artifacts()
        model_loaded = True
        details = {
            "model_type": type(model).__name__,
            "n_estimators": getattr(model, "n_estimators", 100),
            "features_count": len(prep.get("feature_columns", [])),
            "model_version": prep.get("model_version", "v1.0"),
            "trained_at": prep.get("trained_at")
        }
    except Exception as e:
        model_loaded = False
        details["error"] = str(e)

    return {
        "status": "healthy" if model_loaded else "degraded",
        "service": "WelfareAI-FastAPI-ML-Engine",
        "model_loaded": model_loaded,
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
