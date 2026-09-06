# WelfareAI — SIH26186
## AI-Based Predictive Personnel Stress and Welfare Monitoring System for Uniformed Forces
### Ministry of Home Affairs (MHA) | Police II Division / Uniformed Forces

> **Tagline:** *"Detect Early. Explain Clearly. Support Responsibly."*  
> **Core Pipeline:** `PREDICT → EXPLAIN → SUPPORT → FOLLOW-UP → RE-ANALYZE`  
> **Ethical Principle:** Non-clinical, voluntary welfare decision-support. Not a medical diagnosis tool. Not for disciplinary or administrative punishment.

---

## 🛡️ Project Overview & Problem Statement

Uniformed personnel serving in armed and paramilitary forces operate under demanding operational environments characterized by prolonged high-stress deployments, irregular rest cycles, operational separation, and hazardous terrain.

**WelfareAI** is a production-grade, privacy-first predictive welfare and decision-support platform designed for uniformed forces. Built strictly according to the SIH26186 specification, WelfareAI provides real machine-learning prediction, granular feature attribution, personalized welfare guidance, and closed-loop follow-up tracking.

---

## 🌲 Genuine Machine Learning Pipeline ("Where is the AI?")

WelfareAI operates a **real, trained Scikit-Learn Random Forest Classifier** served via a high-performance **Python FastAPI microservice** on port 8000:

```
[ Frontend Client (WelfareAI UI) ]
                │
                ▼ (HTTP POST /api/v1/checkin)
[ Node.js / Express Backend Gateway (:5000) ]
                │
                ▼ (HTTP POST /predict via mlClient.service.js)
[ Python FastAPI Microservice (:8000) ]
                │
                ▼ (StandardScaler Preprocessing)
[ Trained Scikit-Learn RandomForestClassifier (60 Trees, Max Depth 8) ]
                │
                ├───► Multi-Class Probabilities [LOW, MODERATE, HIGH]
                ├───► Composite Risk Score (0–100%)
                ├───► Baseline Attribution & Z-Score Feature Deviations
                └───► Top Contributing Driver Extraction
                │
                ▼ (Structured JSON Inference Response)
[ Node.js Controller & Recommendation Engine ]
                │
                ├───► Persists CheckIn & StressPrediction to Database
                ├───► Generates Factor-Tailored Welfare Action Items
                └───► Automatically Dispatches High-Concern Officer Alert
                │
                ▼
[ Interactive UI Dashboard, What Changed?, & AI Explanation Lab ]
```

### Dataset & Evaluation Metrics
- **Dataset:** Documented synthetic armed forces operational dataset (`ml-service/dataset/synthetic_personnel_welfare_dataset.csv`, 2,000 samples).
- **Model Architecture:** `RandomForestClassifier(n_estimators=60, max_depth=8, class_weight='balanced')`
- **Evaluation Accuracy:** `81.50%`
- **Macro Precision:** `54.88%`
- **Macro Recall:** `54.71%`
- **Macro F1-Score:** `54.80%`

---

## 🔑 Judge Demo Credentials

| Role | Personnel ID / Username | Password | Direct Landing Page |
| :--- | :--- | :--- | :--- |
| **Uniformed Personnel** | `CRPF-9042` | `Password@123` | `http://localhost:5000/dashboard.html` |
| **Welfare Officer** | `WO-101` | `Password@123` | `http://localhost:5000/welfare-officer.html` |
| **System Administrator** | `ADM-001` | `Password@123` | `http://localhost:5000/admin.html` |

---

## 🚀 Key Modules & Feature Highlights

### 1. Personnel Welfare Experience
- **Simplified 5-Field Registration (`/register.html`):** Quick enrollment with automatic bcrypt password hashing and persistent storage.
- **Welfare Check-in Wizard (`/stress-checkin.html`):** 3-step wizard with validated PSS-10 inventory and duty sliders (workload hours, shift continuity, sleep hours, peer support).
- **AI Welfare Analysis (`/ai-analysis.html`):** Live multi-class probabilities, composite risk meter, and model transparency.
- **"What Changed?" Check-in Comparison (`/what-changed.html`):** Side-by-side delta view contrasting current check-in against previous baseline with dynamic change indicators.
- **"Why Is My Risk High?" Explainability (`/why-risk-high.html`):** Granular feature attribution breakdown, baseline z-scores, and "What this result does NOT mean" ethical charter.
- **Recovery Journey (`/recovery-journey.html`):** 6-stage structured de-escalation lifecycle (`BASELINE` &rarr; `STRESS_DETECTED` &rarr; `TRIAGE_REVIEW` &rarr; `INTERVENTION` &rarr; `FOLLOW_UP` &rarr; `RECOVERY_VERIFIED`).
- **Personalized Recommendations (`/recommendations.html`):** Actionable guidance for sleep optimization, workload re-balancing, and peer support.
- **Longitudinal Trajectory (`/trends.html`):** Historical graph with time-filter controls (All / Recent) and tabular logs.
- **Welfare Support & Requests (`/support.html`):** Direct confidential support tickets with auto-generated reference IDs (`REQ-xxxx`).
- **Profile Registry (`/profile.html`):** 6 structured tabs (Personal, Professional, Duty & Work, Welfare & Recovery, Career, Privacy Preferences).

### 2. Welfare Officer & AI Intelligence
- **AI Triage & Alerts (`/welfare-officer.html`):** Real-time queue of elevated welfare signals for human-in-the-loop acknowledgment and follow-up scheduling.
- **Welfare Early-Warning Center (`/early-warning.html`):** 4-quadrant operational categorization:
  1. *New Welfare Signals*
  2. *Rising Risk Velocity*
  3. *Persistent Elevated Strain*
  4. *Improving / De-escalating*
- **Follow-up & Re-Analysis Workflow:** Automated velocity tracking across check-in cycles to measure intervention effectiveness.
- **CSV Data Export:** One-click unit roster export.

### 3. AI Transparency & Admin Governance
- **AI Explanation Lab (`/explanation-lab.html`):** Interactive sandbox for judges and technical evaluators to test real-time model inference, sliders, and SHAP-style attribution.
- **Admin Governance Portal (`/admin.html`):** Component health monitoring (FastAPI, Express, Database), holdout confusion matrix, and immutable audit logs.

---

## 🔒 Security, Privacy & Database Architecture

- **Permanent Database Persistence:** Complete database adapter persisting users, check-ins, predictions, alerts, follow-ups, support tickets, and audit logs.
- **Zero Data Loss on Restart:** Accounts and history persist permanently across logout, browser close, and server restart.
- **Salted Bcrypt Passwords:** 10 salt rounds with zero plaintext storage.
- **HttpOnly Signed JWT Cookies:** Secure token session management with strict RBAC middleware.
- **Non-Disciplinary Charter:** Explicitly insulated from commanding officer discipline, promotion boards, and punitive evaluations.

---

## 🛠️ Installation & Running the Project

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)

### 1. Install Dependencies
```bash
# Backend dependencies
cd backend
npm install

# ML Service dependencies
cd ../ml-service
pip install -r requirements.txt
```

### 2. Start Services
```bash
# Terminal 1: Start Python FastAPI ML Service (Port 8000)
cd ml-service
python -m uvicorn main:app --host 127.0.0.1 --port 8000

# Terminal 2: Start Node.js Backend & Web UI (Port 5000)
cd backend
node server.js
```

### 3. Open the Web Application
Open your browser and navigate to:
```
http://localhost:5000
```

### 4. Run Automated End-to-End Test Suite
```bash
node test_e2e.js
```
*(Runs 30 comprehensive automated tests validating ML microservice, Bcrypt persistence, RBAC, follow-up re-analysis, and audit logging.)*

---

## 🏆 SIH26186 Compliance Matrix

| Requirement | Implementation in WelfareAI | Status |
| :--- | :--- | :--- |
| Real AI / ML Model | Scikit-Learn RandomForestClassifier on FastAPI (port 8000) | ✅ Complete |
| Feature Attribution | Mathematical baseline z-score attribution & Explanation Lab | ✅ Complete |
| "What Changed?" Comparison | Check-in delta analysis with rising/improving factor badges | ✅ Complete |
| Early Warning Center | 4-quadrant operational categorization (New, Rising, Persistent, Improving) | ✅ Complete |
| Recovery Lifecycle | 6-stage structured de-escalation journey | ✅ Complete |
| Permanent Auth & Storage | Salted Bcrypt + HttpOnly JWT with persistent database store | ✅ Complete |
| Human-in-the-loop Officer | Triage alerts, follow-up scheduling, re-analysis velocity tracking | ✅ Complete |
| Strict Ethical Safeguards | Non-clinical, non-disciplinary welfare decision support doctrine | ✅ Complete |
| Interactive Test Suite | 30/30 automated end-to-end test cases passing | ✅ Complete |

---
*Built for SIH26186 — Ministry of Home Affairs (MHA) / Police II Division.*
