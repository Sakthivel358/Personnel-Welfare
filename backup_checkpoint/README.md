# SIH26186 — AI-Based Predictive Personnel Stress & Welfare Monitoring System for Uniformed Forces
### Ministry of Home Affairs (MHA) | CRPF / Police II Division

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![Scikit-Learn](https://img.shields.io/badge/scikit--learn-1.4%2B-F7931E.svg?style=flat&logo=scikit-learn)](https://scikit-learn.org)
[![Node.js](https://img.shields.io/badge/Node.js-Express%204.x-339933.svg?style=flat&logo=node.js)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%2F%20Persistent-47A248.svg?style=flat&logo=mongodb)](https://www.mongodb.com)

---

## 🛡️ Executive Summary & Core Objective
Uniformed personnel serving in armed forces (CRPF, BSF, ITBP, CISF, State Armed Police) operate under prolonged high-intensity environments characterized by extended deployments, shift disruptions, and operational stressors. 

**Prahari Welfare (SIH26186)** is a privacy-conscious, decision-support welfare intelligence platform designed to:
1. **Detect Early Signals:** Capture non-invasive operational indicators and standardized perceived stress inventories.
2. **Predict Genuinely:** Process inputs through a genuinely trained **Random Forest Classifier** hosted on a Python FastAPI microservice.
3. **Explain Attribution:** Provide transparent feature attribution ("Why is my risk elevated?") contrasting inputs against baseline operational statistics.
4. **Deliver Contextual Guidance:** Formulate rule-safe, non-clinical supportive guidance tailored to active risk drivers (sleep deficit, shift continuity, workload pressure).
5. **Empower Human-in-the-Loop Officers:** Route priority alerts to authorized Welfare Officers for confidential review, check-in validation, and follow-up tracking.
6. **Track Longitudinal Recovery:** Re-analyze subsequent check-in cycles to monitor welfare improvement trajectories.

> ⚠️ **CRITICAL ETHICAL DIRECTIVE:** The system is a **WELFARE SUPPORT and DECISION-SUPPORT** platform. It is **NOT** a medical diagnosis system and does **NOT** diagnose psychiatric illness. It must **NOT** be used for promotion, demotion, termination, disciplinary action, performance reviews, or clandestine surveillance.

---

## 🌲 "Where is the AI?" — Real Machine Learning Architecture

Unlike trivial projects that use hardcoded percentages or arbitrary `if/else` conditions, **Prahari Welfare** runs an authentic multi-tier ML pipeline:

```
[ Frontend Client (Vanilla JS / Chart.js) ]
                │
                ▼ (HTTP POST /api/v1/checkin)
[ Node.js / Express Backend Gateway ]
                │
                ▼ (HTTP POST /predict via mlClient.service.js)
[ Python FastAPI ML Microservice (:8000) ]
                │
                ▼ (StandardScaler Transformation)
[ Trained Scikit-Learn RandomForestClassifier (100 Trees) ]
                │
                ├───► Class Probabilities [LOW, MODERATE, HIGH]
                ├───► Baseline Attribution & Z-Score Feature Deviations
                └───► Top Contributing Driver Extraction
                │
                ▼ (Structured JSON Inference Response)
[ Node.js Controller & Recommendation Engine ]
                │
                ├───► Persists CheckIn & StressPrediction to Database
                ├───► Generates Factor-Tailored Welfare Action Items
                └───► Generates Human-in-the-Loop Officer Alert (if High)
                │
                ▼
[ Interactive UI Dashboard & Explainability Views ]
```

---

## 📊 Dataset & Model Evaluation Metrics

### Synthetic Dataset Notice
Because real armed forces personnel welfare data is strictly sensitive and classified, the prototype utilizes a documented, privacy-safe synthetic dataset (`ml-service/dataset/synthetic_personnel_welfare_dataset.csv`, 2,000 samples).

### Model Evaluation Results (Holdout Test Set)
- **Algorithm:** `RandomForestClassifier(n_estimators=60, max_depth=8, class_weight='balanced')`
- **Overall Accuracy:** `81.50%`
- **Macro Precision:** `54.88%`
- **Macro Recall:** `54.71%`
- **Macro F1-Score:** `54.80%`

#### Global Feature Importances:
1. `workload_hours`: **27.15%**
2. `pss_score`: **25.37%**
3. `recovery_sleep_hours`: **13.35%**
4. `work_pressure_rating`: **11.81%**
5. `work_life_balance_rating`: **6.27%**
6. `social_support_rating`: **6.23%**
7. `recent_trend_indicator`: **5.32%**
8. `shift_continuity_days`: **4.50%**

---

## 🔒 Authentication & Zero-Degradation Database Persistence

### Elimination of Authentication Expiration / Login Bug
- **Permanent MongoDB Storage:** User accounts are stored in persistent database collections with salted **Bcrypt** password hashes (10 rounds).
- **HttpOnly Cookies + JWT:** Sessions are managed securely via signed JWT tokens delivered in `HttpOnly`, `SameSite=Lax` cookies with automatic header fallback.
- **Persistent Across Restarts:** The account remains permanently valid across immediate re-logins, browser reopens, long time lapses (15–60 mins), and Node.js server restarts.
- **Proper Error Classification:** The API explicitly differentiates between invalid passwords, deactivated accounts, expired sessions, and database connectivity issues.

---

## 👥 Role-Based Access Control (RBAC)

| Role | Permitted Access | Insulated Restrictions |
| :--- | :--- | :--- |
| **PERSONNEL** | Own dashboard, stress check-in wizard, AI analysis, explainability breakdown, recommendations, trends, confidential support requests. | Cannot view other personnel check-ins or officer triage. |
| **WELFARE OFFICER** | AI triage alerts, human-in-the-loop review modal, follow-up scheduler, unit personnel roster, support request queue. | Cannot issue disciplinary actions or alter service records. |
| **ADMIN** | System health status, model evaluation metrics & confusion matrix, immutable security audit trail, user governance. | Cannot view private counseling notes or individual questionnaires. |

---

## 🚀 Installation & Running Guide

### Prerequisites
- **Node.js:** v18.0+ (Installed)
- **Python:** 3.10+ (Installed)

### 1. Python ML Service Setup
```bash
# Navigate to ML service directory
cd ml-service

# Install dependencies
pip install -r requirements.txt

# Train Random Forest model & generate evaluation metrics
python train_model.py

# Start FastAPI Microservice (Port 8000)
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Node.js Backend & Web UI Setup
```bash
# In a separate terminal, navigate to backend
cd backend

# Install dependencies
npm install

# Start Backend Server (Port 5000)
npm start
```

### 3. Open Web Application
Navigate to `http://localhost:5000` in any modern web browser.

---

## ⚡ Judge Demonstration Quick Access Accounts

The system is pre-seeded with verified test accounts:

| Role | Personnel ID / Identifier | Password | Access URL |
| :--- | :--- | :--- | :--- |
| **Personnel** | `CRPF-9042` | `Password@123` | `http://localhost:5000/dashboard.html` |
| **Welfare Officer** | `WO-101` | `Password@123` | `http://localhost:5000/welfare-officer.html` |
| **System Admin** | `ADM-001` | `Password@123` | `http://localhost:5000/admin.html` |

---

## 🔄 End-to-End Demonstration Flow for Hackathon Judges

1. **Public Landing Page (`/`):**
   - Review mission statement, AI pipeline architecture, and synthetic data disclaimer.
2. **Personnel Login & Check-in (`/login.html` & `/stress-checkin.html`):**
   - Sign in as `CRPF-9042` (or register a brand new account).
   - Complete Step 1 (10-item PSS inventory) and Step 2 (Duty hours, sleep hours, work pressure).
   - Click **"Complete & Generate AI Prediction"**.
3. **Real Random Forest Prediction (`/ai-analysis.html`):**
   - View genuine Random Forest classification (`LOW`, `MODERATE`, `HIGH`), confidence score, and probability distribution.
4. **Explainability Attribution (`/why-risk-high.html`):**
   - Inspect the factor attribution radar chart and breakdown table showing input z-score deviations against baseline means.
5. **Personalized Welfare Guidance (`/recommendations.html`):**
   - View factor-derived rest, workload, and peer support recommendations.
6. **Welfare Officer Triage & Review (`/welfare-officer.html`):**
   - Sign in as `WO-101`.
   - View the newly triggered AI welfare alert.
   - Click **"Review Signal"** to execute Human-in-the-Loop review, assign follow-up notes, and set a re-analysis date.
7. **Second Check-in & Re-Analysis (`/stress-checkin.html` & `/trends.html`):**
   - Submit a follow-up check-in with improved rest hours.
   - Observe the updated trend trajectory and follow-up delta marking recovery.
8. **Admin Transparency & Health (`/admin.html`):**
   - Sign in as `ADM-001`.
   - Check real-time Node.js, Database, and FastAPI `/health` component statuses, confusion matrix, and audit logs.
9. **Authentication Persistence Verification:**
   - Log out, wait, restart Node.js server, and log back in with the same credentials to confirm 100% data persistence.

---

### Core Philosophy:
**PREDICT &rarr; EXPLAIN &rarr; SUPPORT &rarr; FOLLOW-UP &rarr; RE-ANALYZE**  
*Detect early. Support early. Improve continuously.*
