"""
WelfareAI Decision Layer
Positioned downstream of ML Model 1 (Wearable + Operational RF) and ML Model 2 (PSS Fallback RF).

Architecture:
AUTHORIZED DATA
       │
 ┌─────┴─────────────────────────┐
 │                               │
 ▼                               ▼
Wearable + Operational           PSS-10 + Operational
(Telemetry Synced)               (Sensor Unavailable)
 │                               │
 ▼                               ▼
ML MODEL 1                       ML MODEL 2
(Wearable + Operational RF)      (PSS-10 Fallback RF)
 └──────────────┬────────────────┘
                │
                ▼
     WELFAREAI DECISION LAYER
                │
 ┌──────────────┼──────────────┐
 ▼              ▼              ▼
Welfare       Evidence        Main
Concern       Strength     Contributors
 └──────────────┬──────────────┘
                │
                ▼
       Human Welfare Review
    (Welfare Officer Triage)
"""

from typing import Dict, Any, List, Optional
from datetime import datetime


class WelfareAIDecisionLayer:
    """
    Evaluates ML Model 1 or Model 2 outputs alongside authorized operational & biometric context
    to formulate the complete WelfareAI Decision synthesis.
    """

    @classmethod
    def evaluate(cls, checkin_data: Dict[str, Any], ml_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes decision layer synthesis on top of raw ML model inference.
        """
        # 1. Evaluate Evidence Strength
        evidence_strength = cls._compute_evidence_strength(checkin_data, ml_result)

        # 2. Evaluate Welfare Concern (with compounding operational risk checks)
        welfare_concern = cls._evaluate_welfare_concern(checkin_data, ml_result, evidence_strength)

        # 3. Formulate Main Contributors
        main_contributors = cls._extract_main_contributors(checkin_data, ml_result)

        # 4. Determine Human Welfare Review Protocol
        human_review = cls._formulate_human_welfare_review(
            checkin_data, ml_result, welfare_concern, evidence_strength, main_contributors
        )

        decision_layer_payload = {
            "welfareConcern": welfare_concern,
            "evidenceStrength": evidence_strength,
            "mainContributors": main_contributors,
            "humanWelfareReview": human_review,
            "evaluatedAt": datetime.now().isoformat(),
            "decisionEngineVersion": "v2.1.0-decision-layer"
        }

        # Return full enriched result preserving top-level backward compatibility
        enriched_result = dict(ml_result)
        enriched_result["decisionLayer"] = decision_layer_payload

        # Ensure top-level fields match the decision layer synthesis
        enriched_result["concernLevel"] = welfare_concern["concernLevel"]
        enriched_result["compositeRiskScore"] = welfare_concern["compositeRiskScore"]
        enriched_result["confidence"] = welfare_concern["confidence"]
        enriched_result["evidenceStrength"] = evidence_strength["level"]
        enriched_result["evidenceStrengthScore"] = evidence_strength["score"]
        enriched_result["requiresHumanReview"] = human_review["requiresHumanReview"]
        enriched_result["humanReviewPriority"] = human_review["priority"]

        return enriched_result

    @staticmethod
    def _compute_evidence_strength(checkin_data: Dict[str, Any], ml_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates the objective evidence strength based on authorized data completeness,
        sensor telemetry presence, and operational verification.
        """
        sources = list(ml_result.get("evidenceSources") or [])
        if not sources:
            sources = ["DUTY", "WORKLOAD", "REST_RECOVERY"]
            if checkin_data.get("pss_score") is not None:
                sources.append("SELF_CHECK")
            if (
                checkin_data.get("wearable_synced")
                or checkin_data.get("resting_heart_rate") is not None
                or checkin_data.get("hrv_ms") is not None
            ):
                sources.append("WEARABLE")

        has_wearable = "WEARABLE" in sources
        has_duty = "DUTY" in sources
        has_workload = "WORKLOAD" in sources
        has_rest = "REST_RECOVERY" in sources
        has_self_check = "SELF_CHECK" in sources

        # Base scoring
        score = 0.0
        details = []

        if has_duty:
            score += 0.20
            details.append("Authorized duty schedule verified")
        if has_workload:
            score += 0.20
            details.append("Operational workload logged")
        if has_rest:
            score += 0.20
            details.append("Rest and recovery data documented")
        if has_self_check:
            score += 0.15
            details.append("Self-check questionnaire provided")
        if has_wearable:
            # Verified biometrics adds substantial evidential weight
            score += 0.25
            details.append("Continuous wearable biometric telemetry synchronized")

        score = round(min(1.0, max(0.1, score)), 2)

        # Categorize level
        if score >= 0.75 and has_wearable:
            level = "HIGH"
            rationale = "Robust multi-source evidence with active continuous wearable biometric telemetry and verified operational logs."
        elif score >= 0.50:
            level = "MODERATE"
            rationale = "Sufficient evidence based on authorized operational logs, rest records, and self-check input."
        else:
            level = "EMERGING"
            rationale = "Preliminary evidence based on sparse or partial operational parameters."

        return {
            "level": level,
            "score": score,
            "sourcesCount": len(sources),
            "sources": sources,
            "hasWearableTelemetry": has_wearable,
            "hasOperationalDuty": has_duty,
            "hasRestRecovery": has_rest,
            "hasSelfCheck": has_self_check,
            "summary": rationale,
            "evidenceDetails": details
        }

    @staticmethod
    def _evaluate_welfare_concern(
        checkin_data: Dict[str, Any],
        ml_result: Dict[str, Any],
        evidence_strength: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Reconciles ML model classification and continuous score with compound operational risk checks.
        """
        raw_concern = ml_result.get("concernLevel", "LOW")
        raw_score = float(ml_result.get("compositeRiskScore", 20.0))
        confidence = float(ml_result.get("confidence", 0.85))
        probabilities = ml_result.get("probabilities", {"LOW": 0.7, "MODERATE": 0.2, "HIGH": 0.1})

        # Operational Compound Strain Checks
        prolonged_duty = float(checkin_data.get("prolonged_duty_hours") or checkin_data.get("duty_duration_hours") or 0.0)
        night_hours = float(checkin_data.get("night_duty_hours") or 0.0)
        workload = float(checkin_data.get("workload_hours") or 45.0)
        sleep = float(checkin_data.get("recovery_sleep_hours") or 7.0)
        consecutive_days = float(checkin_data.get("shift_continuity_days") or checkin_data.get("consecutive_duty_days") or 0.0)

        compound_strain = False
        compound_reasons = []

        # Rule 1: Extreme combined duty fatigue (night duty >= 16h + sleep < 5h + continuous shifts >= 6)
        if night_hours >= 16.0 and sleep < 5.0 and consecutive_days >= 6.0:
            compound_strain = True
            compound_reasons.append("Severe cumulative duty exposure: graveyard duty >= 16h with acute sleep deficit < 5h")

        # Rule 2: Prolonged continuous duty shift >= 16h with elevated workload > 65h
        if prolonged_duty >= 16.0 and workload > 65.0:
            compound_strain = True
            compound_reasons.append("Extreme operational duration: continuous duty >= 16h with weekly workload > 65h")

        final_score = raw_score
        final_concern = raw_concern

        if compound_strain:
            # Compound operational strain elevates risk baseline if not already HIGH
            if final_concern == "LOW":
                final_concern = "MODERATE"
                final_score = max(final_score, 52.0)
            elif final_concern == "MODERATE" and final_score >= 60.0:
                final_concern = "HIGH"
                final_score = max(final_score, 75.0)

        final_score = round(min(100.0, max(0.0, final_score)), 1)

        return {
            "concernLevel": final_concern,
            "rawModelConcern": raw_concern,
            "compositeRiskScore": final_score,
            "confidence": confidence,
            "probabilities": probabilities,
            "modelUsed": ml_result.get("modelUsed", "MODEL_1_WEARABLE_OPERATIONAL"),
            "compoundStrainDetected": compound_strain,
            "compoundReasons": compound_reasons,
            "status": "CRITICAL" if final_score >= 80 else ("ELEVATED" if final_score >= 60 else ("MODERATE" if final_score >= 40 else "BALANCED"))
        }

    @staticmethod
    def _extract_main_contributors(checkin_data: Dict[str, Any], ml_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Synthesizes top primary contributing indicators with categorization and baseline comparisons.
        """
        factors = ml_result.get("contributingFactors") or []
        main_contributors = []

        for f in factors:
            key = f.get("feature_key", "")
            title = f.get("title", key.replace("_", " ").title())
            impact = f.get("impact_level", "LOW")
            is_risk = f.get("is_risk_driver", False)
            user_val = f.get("user_value")
            unit = f.get("unit", "")
            healthy = f.get("healthy_range", "Normal")
            base_mean = f.get("baseline_mean")
            contrib = f.get("contribution_score", 0.0)

            # Categorize factor
            if key in ["resting_heart_rate", "hrv_ms", "respiration_rate", "skin_temperature_c", "fatigue_physical_strain"]:
                category = "WEARABLE_BIOMETRIC"
            elif key in ["prolonged_duty_hours", "night_duty_hours", "shift_continuity_days", "deployment_demand_score"]:
                category = "OPERATIONAL_DUTY"
            elif key in ["workload_hours", "work_pressure_rating"]:
                category = "WORKLOAD_PRESSURE"
            elif key in ["recovery_sleep_hours", "rest_interval_hours", "recovery_pattern_score"]:
                category = "REST_RECOVERY"
            else:
                category = "PSYCHOLOGICAL_EQUILIBRIUM"

            main_contributors.append({
                "featureKey": key,
                "title": title,
                "category": category,
                "userValue": user_val,
                "unit": unit,
                "healthyRange": healthy,
                "baselineMean": base_mean,
                "contributionScore": contrib,
                "impactLevel": impact,
                "isRiskDriver": is_risk,
                "status": f.get("status", "Within Baseline")
            })

        main_contributors.sort(key=lambda x: x["contributionScore"], reverse=True)
        return main_contributors

    @classmethod
    def _formulate_human_welfare_review(
        cls,
        checkin_data: Dict[str, Any],
        ml_result: Dict[str, Any],
        welfare_concern: Dict[str, Any],
        evidence_strength: Dict[str, Any],
        main_contributors: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Determines whether a Human Welfare Review by a Welfare Officer is required,
        and constructs the triage review package.
        """
        concern_level = welfare_concern["concernLevel"]
        risk_score = welfare_concern["compositeRiskScore"]
        compound_strain = welfare_concern["compoundStrainDetected"]
        triggers = []

        requires_review = False
        priority = "STANDARD_MONITORING"
        recommended_action = "Routine monitoring; personnel operating within normal welfare equilibrium."

        # Risk-based review criteria
        if concern_level == "HIGH" or risk_score >= 65.0:
            requires_review = True
            if risk_score >= 80.0:
                priority = "CRITICAL"
                triggers.append(f"Critical composite welfare risk score ({risk_score}%) exceeds acute safety threshold")
            else:
                priority = "HIGH"
                triggers.append(f"High welfare concern signal ({risk_score}%) flagged by {welfare_concern['modelUsed']}")

        # Compound strain triggers
        if compound_strain:
            requires_review = True
            if priority != "CRITICAL":
                priority = "HIGH"
            triggers.extend(welfare_concern.get("compoundReasons", []))

        # Top contributors driving review
        top_risk_drivers = [m for m in main_contributors if m.get("isRiskDriver")]
        for d in top_risk_drivers[:3]:
            triggers.append(f"{d['title']}: {d['userValue']}{d['unit']} ({d['impactLevel']} strain vs baseline {d['baselineMean']})")

        # Formulate tailored officer recommendations
        if requires_review:
            if priority == "CRITICAL":
                recommended_action = (
                    "URGENT WELFARE INTERVENTION: Initiate confidential 1-on-1 check-in within 12 hours. "
                    "Review active duty roster for immediate 24-hour mandatory rest rotation and evaluate medical/counseling referral."
                )
            elif priority == "HIGH":
                recommended_action = (
                    "OFFICER REVIEW REQUIRED: Schedule supportive welfare consultation within 24–48 hours. "
                    "Assess recent shift continuity, night watch exposure, and ensure restorative sleep compliance."
                )
        elif concern_level == "MODERATE":
            priority = "ROUTINE"
            recommended_action = (
                "MONITORED STATUS: Recommend proactive peer support and unit downtime. "
                "Monitor next check-in cycle for directional velocity."
            )
            if float(checkin_data.get("recovery_sleep_hours") or 7.0) < 5.0:
                triggers.append("Moderate concern with sleep recovery deficit < 5.0 hours")

        return {
            "requiresHumanReview": requires_review,
            "priority": priority,
            "status": "PENDING_REVIEW" if requires_review else "MONITORING_ONLY",
            "reviewTriggers": triggers if triggers else ["No adverse triggers detected"],
            "recommendedOfficerAction": recommended_action,
            "assignedRole": "Unit Welfare Officer / Station Resilience Lead",
            "escalationPath": "Medical Officer / Commanding Officer" if priority == "CRITICAL" else "Welfare Officer Review"
        }
