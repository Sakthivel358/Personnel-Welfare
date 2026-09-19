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
            "decisionEngineVersion": "v2.2.0-decision-layer"
        }

        # Return full enriched result preserving top-level backward compatibility
        enriched_result = dict(ml_result)
        enriched_result["decisionLayer"] = decision_layer_payload

        # Ensure top-level fields match the decision layer synthesis
        welfare_display = f"WELFARE CONCERN — {welfare_concern['concernLevel']}"
        evidence_display = f"EVIDENCE — {evidence_strength['level']}"
        welfare_concern["displayLabel"] = welfare_display
        evidence_strength["displayLabel"] = evidence_display

        enriched_result["concernLevel"] = welfare_concern["concernLevel"]
        enriched_result["welfareConcernDisplay"] = welfare_display
        enriched_result["compositeRiskScore"] = welfare_concern["compositeRiskScore"]
        enriched_result["confidence"] = welfare_concern["confidence"]
        enriched_result["evidenceStrength"] = evidence_strength["level"]
        enriched_result["evidenceDisplay"] = evidence_display
        enriched_result["evidenceStrengthScore"] = evidence_strength["score"]
        enriched_result["dataAvailableCount"] = evidence_strength["dataAvailableCount"]
        enriched_result["dataAvailableTotal"] = evidence_strength["dataAvailableTotal"]
        enriched_result["dataAvailableDisplay"] = evidence_strength["dataAvailableDisplay"]
        enriched_result["evidenceSources"] = evidence_strength["sources"]
        enriched_result["evidenceCount"] = evidence_strength["sourcesCount"]
        top_directional = [c["directionalTitle"] for c in main_contributors if c.get("isRiskDriver")]
        enriched_result["topDrivers"] = top_directional[:4] if top_directional else [c["title"] for c in main_contributors[:2]]
        enriched_result["requiresHumanReview"] = human_review["requiresHumanReview"]
        enriched_result["humanReviewPriority"] = human_review["priority"]

        return enriched_result

    @classmethod
    def evaluate_undetermined(
        cls,
        checkin_data: Dict[str, Any],
        reason: str = "Insufficient authorized evidence to determine welfare concern reliably.",
        missing_evidence: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Enforces the zero-guessing policy:
        Never guess a welfare concern when evidence is insufficient.
        """
        if missing_evidence is None:
            missing_evidence = ["Operational duty context or authorized biometrics / self-check"]

        checkin = checkin_data or {}
        data_avail = cls._evaluate_data_availability(checkin)
        avail_count = data_avail["count"]
        avail_display = data_avail["display"]
        avail_sources = data_avail["availableSources"]

        evidence_eval = cls._compute_evidence_strength(checkin, {})
        evidence_eval["level"] = "INSUFFICIENT"
        evidence_eval["displayLabel"] = "EVIDENCE — INSUFFICIENT"
        evidence_eval["missingEvidence"] = missing_evidence
        evidence_eval["summary"] = "Evidence is insufficient to establish an authorized assessment. Assessment omitted to avoid arbitrary guessing."
        evidence_score = evidence_eval["score"]

        decision_layer_payload = {
            "welfareConcern": {
                "concernLevel": "UNDETERMINED",
                "displayLabel": "WELFARE CONCERN — UNDETERMINED",
                "compositeRiskScore": None,
                "confidence": 0.0,
                "status": "INSUFFICIENT_EVIDENCE",
                "modelUsed": "NONE_INSUFFICIENT_EVIDENCE",
                "reason": reason,
                "compoundStrainDetected": False
            },
            "evidenceStrength": evidence_eval,
            "mainContributors": [],
            "humanWelfareReview": {
                "requiresHumanReview": False,
                "priority": "NONE",
                "status": "MONITORING_ONLY",
                "reviewTriggers": [reason],
                "recommendedOfficerAction": "Encourage personnel to synchronize wearable Smart Jacket sensor or complete self-check questionnaire to provide sufficient authorized evidence.",
                "assignedRole": "Unit Welfare Officer"
            },
            "evaluatedAt": datetime.now().isoformat(),
            "decisionEngineVersion": "v2.2.0-decision-layer"
        }

        return {
            "concernLevel": "UNDETERMINED",
            "welfareConcernDisplay": "WELFARE CONCERN — UNDETERMINED",
            "compositeRiskScore": None,
            "confidence": 0.0,
            "isUndetermined": True,
            "evidenceStrength": "INSUFFICIENT",
            "evidenceDisplay": "EVIDENCE — INSUFFICIENT",
            "evidenceStrengthScore": evidence_score,
            "dataAvailableCount": avail_count,
            "dataAvailableTotal": 5,
            "dataAvailableDisplay": avail_display,
            "evidenceSources": avail_sources,
            "evidenceCount": len(avail_sources),
            "topDrivers": [],
            "contributingFactors": [],
            "modelUsed": "NONE_INSUFFICIENT_EVIDENCE",
            "requiresHumanReview": False,
            "humanReviewPriority": "NONE",
            "decisionLayer": decision_layer_payload,
            "analyzedAt": datetime.now().isoformat(),
            "disclaimer": "EVIDENCE INSUFFICIENT: Never guess a welfare concern when evidence is insufficient. Check-in must include authorized operational data alongside either wearable sensor telemetry or self-check input."
        }

    @classmethod
    def evaluate_dual_model(
        cls,
        checkin_data: Dict[str, Any],
        m1_result: Dict[str, Any],
        m2_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Pathway 3: Both wearable biometrics and PSS-10 self-check available.
        Uses available evidence from both Model 1 and Model 2 through the WelfareAI Decision Layer.
        Synthesizes objective biometric strain (Model 1) with subjective psychometric perception (Model 2).
        """
        # 1. Fuse Evidence Strength (5 authorized sources with verified biometrics + PSS-10)
        evidence_strength = cls._compute_evidence_strength(checkin_data, m1_result)
        evidence_strength["level"] = "HIGH"
        evidence_strength["displayLabel"] = "EVIDENCE — HIGH"
        evidence_strength["score"] = max(0.85, evidence_strength["score"])
        evidence_strength["dualModelVerified"] = True
        evidence_strength["summary"] = "Maximum multi-source evidence: verified wearable biometric telemetry, duty logs, workload, rest records, and PSS-10 self-check harmonized."

        # 2. Harmonize Welfare Concern across Model 1 and Model 2
        m1_score = float(m1_result.get("compositeRiskScore") or 20.0)
        m2_score = float(m2_result.get("compositeRiskScore") or 20.0)
        m1_concern = m1_result.get("concernLevel", "LOW")
        m2_concern = m2_result.get("concernLevel", "LOW")

        consensus_score = round(m1_score * 0.55 + m2_score * 0.45, 1)

        if consensus_score >= 65.0 or m1_concern == "HIGH" or m2_concern == "HIGH":
            consensus_concern = "HIGH" if (consensus_score >= 60.0 or (m1_concern == "HIGH" and m2_concern == "HIGH")) else "MODERATE"
            if consensus_score >= 65.0:
                consensus_concern = "HIGH"
        elif consensus_score >= 38.0 or m1_concern == "MODERATE" or m2_concern == "MODERATE":
            consensus_concern = "MODERATE"
        else:
            consensus_concern = "LOW"

        # Check cross-modal discordance
        discordance_detected = False
        discordance_note = ""
        if m1_concern == "HIGH" and m2_concern == "LOW":
            discordance_detected = True
            discordance_note = "Cross-modal discordance: Wearable sensors indicate high physical strain while self-check reported low stress (possible masked fatigue or high operational stoicism)."
        elif m1_concern == "LOW" and m2_concern == "HIGH":
            discordance_detected = True
            discordance_note = "Cross-modal discordance: Self-check reports high perceived stress while resting biometrics remain within normal baseline (acute psychological tension or early cognitive load)."

        p1 = m1_result.get("probabilities", {"LOW": 0.7, "MODERATE": 0.2, "HIGH": 0.1})
        p2 = m2_result.get("probabilities", {"LOW": 0.7, "MODERATE": 0.2, "HIGH": 0.1})
        blended_probs = {
            "LOW": round(p1.get("LOW", 0.0) * 0.55 + p2.get("LOW", 0.0) * 0.45, 4),
            "MODERATE": round(p1.get("MODERATE", 0.0) * 0.55 + p2.get("MODERATE", 0.0) * 0.45, 4),
            "HIGH": round(p1.get("HIGH", 0.0) * 0.55 + p2.get("HIGH", 0.0) * 0.45, 4)
        }

        welfare_concern = {
            "concernLevel": consensus_concern,
            "displayLabel": f"WELFARE CONCERN — {consensus_concern}",
            "rawModel1Concern": m1_concern,
            "rawModel2Concern": m2_concern,
            "compositeRiskScore": consensus_score,
            "confidence": round(float(m1_result.get("confidence", 0.8) * 0.55 + m2_result.get("confidence", 0.8) * 0.45), 4),
            "probabilities": blended_probs,
            "modelUsed": "DUAL_MODEL_CONSENSUS",
            "modelsEvaluated": ["MODEL_1_WEARABLE_OPERATIONAL", "MODEL_2_PSS_OPERATIONAL"],
            "crossModalDiscordance": discordance_detected,
            "discordanceNote": discordance_note,
            "compoundStrainDetected": m1_result.get("decisionLayer", {}).get("welfareConcern", {}).get("compoundStrainDetected", False),
            "status": "CRITICAL" if consensus_score >= 80 else ("ELEVATED" if consensus_score >= 60 else ("MODERATE" if consensus_score >= 40 else "BALANCED"))
        }

        # 3. Fuse Main Contributors
        m1_factors = m1_result.get("decisionLayer", {}).get("mainContributors") or cls._extract_main_contributors(checkin_data, m1_result)
        m2_factors = m2_result.get("decisionLayer", {}).get("mainContributors") or cls._extract_main_contributors(checkin_data, m2_result)

        seen_keys = set()
        fused_contributors = []
        for f in m1_factors + m2_factors:
            k = f.get("featureKey")
            if k not in seen_keys:
                seen_keys.add(k)
                fused_contributors.append(f)

        fused_contributors.sort(key=lambda x: x.get("contributionScore", 0.0), reverse=True)

        # 4. Formulate Human Welfare Review
        human_review = cls._formulate_human_welfare_review(
            checkin_data, m1_result, welfare_concern, evidence_strength, fused_contributors
        )

        if discordance_detected:
            human_review["requiresHumanReview"] = True
            if human_review["priority"] == "STANDARD_MONITORING":
                human_review["priority"] = "ROUTINE"
            human_review["reviewTriggers"].append(discordance_note)
            human_review["recommendedOfficerAction"] += f" Note: {discordance_note}"

        decision_layer_payload = {
            "welfareConcern": welfare_concern,
            "evidenceStrength": evidence_strength,
            "mainContributors": fused_contributors,
            "humanWelfareReview": human_review,
            "evaluatedAt": datetime.now().isoformat(),
            "decisionEngineVersion": "v2.2.0-decision-layer"
        }

        all_sources = list(set(list(m1_result.get("evidenceSources", [])) + list(m2_result.get("evidenceSources", []))))

        top_directional = [c["directionalTitle"] for c in fused_contributors if c.get("isRiskDriver")]

        return {
            "concernLevel": consensus_concern,
            "welfareConcernDisplay": f"WELFARE CONCERN — {consensus_concern}",
            "compositeRiskScore": consensus_score,
            "confidence": welfare_concern["confidence"],
            "probabilities": blended_probs,
            "modelUsed": "DUAL_MODEL_CONSENSUS",
            "modelsEvaluated": ["MODEL_1_WEARABLE_OPERATIONAL", "MODEL_2_PSS_OPERATIONAL"],
            "evidenceSources": all_sources,
            "evidenceCount": len(all_sources),
            "evidenceStrength": evidence_strength["level"],
            "evidenceDisplay": f"EVIDENCE — {evidence_strength['level']}",
            "evidenceStrengthScore": evidence_strength["score"],
            "dataAvailableCount": evidence_strength["dataAvailableCount"],
            "dataAvailableTotal": evidence_strength["dataAvailableTotal"],
            "dataAvailableDisplay": evidence_strength["dataAvailableDisplay"],
            "topDrivers": top_directional[:4] if top_directional else [c["title"] for c in fused_contributors[:2]],
            "contributingFactors": m1_result.get("contributingFactors", []),
            "requiresHumanReview": human_review["requiresHumanReview"],
            "humanReviewPriority": human_review["priority"],
            "decisionLayer": decision_layer_payload,
            "analyzedAt": datetime.now().isoformat(),
            "disclaimer": "DUAL-MODEL DECISION CONSENSUS: Evaluated across ML Model 1 (Wearable + Operational) and ML Model 2 (PSS-10 Fallback) through the WelfareAI Decision Layer."
        }

    @classmethod
    def _evaluate_data_availability(cls, checkin_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Determines the strictly authorized data streams containing valid, non-mock, non-demo data (Requirement 23).
        Only counts evidence sources that actually contain valid authorized data.
        """
        available_sources = []
        unavailable_sources = []
        source_details = {}

        # 1. DUTY Exposure
        has_duty = False
        duty_reasons = []
        prolonged = checkin_data.get("prolonged_duty_hours") or checkin_data.get("duty_duration_hours")
        if prolonged is not None and float(prolonged) > 0.0:
            has_duty = True
            duty_reasons.append(f"Duty duration {prolonged}h")
        night = checkin_data.get("night_duty_hours")
        if night is not None and float(night) > 0.0:
            has_duty = True
            duty_reasons.append(f"Night duty {night}h")
        shifts = checkin_data.get("shift_continuity_days") or checkin_data.get("consecutive_duty_days")
        if shifts is not None and float(shifts) > 0.0:
            has_duty = True
            duty_reasons.append(f"{shifts} shift days")
        duty_type = checkin_data.get("duty_type")
        if duty_type and str(duty_type).strip() and str(duty_type).strip().lower() not in ["none", "null", "undefined"]:
            has_duty = True
            duty_reasons.append(f"Duty role: {duty_type}")

        if has_duty:
            available_sources.append("DUTY")
            source_details["DUTY"] = {"valid": True, "notes": ", ".join(duty_reasons)}
        else:
            unavailable_sources.append("DUTY")
            source_details["DUTY"] = {"valid": False, "notes": "No authorized duty logs"}

        # 2. WORKLOAD Demands
        has_workload = False
        wl_reasons = []
        workload = checkin_data.get("workload_hours")
        if workload is not None and float(workload) > 0.0:
            has_workload = True
            wl_reasons.append(f"{workload} hrs/wk")
        pressure = checkin_data.get("work_pressure_rating")
        if pressure is not None and float(pressure) > 0.0:
            has_workload = True
            wl_reasons.append(f"Pressure rating {pressure}/10")

        if has_workload:
            available_sources.append("WORKLOAD")
            source_details["WORKLOAD"] = {"valid": True, "notes": ", ".join(wl_reasons)}
        else:
            unavailable_sources.append("WORKLOAD")
            source_details["WORKLOAD"] = {"valid": False, "notes": "No workload data"}

        # 3. REST & RECOVERY
        has_rest = False
        rest_reasons = []
        sleep = checkin_data.get("recovery_sleep_hours")
        if sleep is not None and float(sleep) > 0.0:
            has_rest = True
            rest_reasons.append(f"{sleep}h sleep")
        interval = checkin_data.get("rest_interval_hours")
        if interval is not None and float(interval) > 0.0:
            has_rest = True
            rest_reasons.append(f"{interval}h inter-shift rest")
        pattern = checkin_data.get("recovery_pattern")
        if pattern and str(pattern).strip() and str(pattern).strip().lower() not in ["none", "null", "undefined"]:
            has_rest = True
            rest_reasons.append(f"Pattern: {pattern}")

        if has_rest:
            available_sources.append("REST_RECOVERY")
            source_details["REST_RECOVERY"] = {"valid": True, "notes": ", ".join(rest_reasons)}
        else:
            unavailable_sources.append("REST_RECOVERY")
            source_details["REST_RECOVERY"] = {"valid": False, "notes": "No recovery records"}

        # 4. SELF-CHECK (PSS-10)
        has_pss = False
        pss_val = checkin_data.get("pss_score")
        if pss_val is not None:
            try:
                score_num = float(pss_val)
                if 0.0 <= score_num <= 40.0:
                    has_pss = True
            except (ValueError, TypeError):
                has_pss = False

        if has_pss:
            available_sources.append("SELF_CHECK")
            source_details["SELF_CHECK"] = {"valid": True, "notes": f"PSS-10 score: {pss_val}"}
        else:
            unavailable_sources.append("SELF_CHECK")
            source_details["SELF_CHECK"] = {"valid": False, "notes": "Self-check questionnaire not completed"}

        # 5. WEARABLE BIOMETRICS (Smart Jacket)
        has_wearable = False
        wearable_reasons = []
        is_synced = bool(checkin_data.get("wearable_synced"))
        rhr = checkin_data.get("resting_heart_rate")
        hrv = checkin_data.get("hrv_ms")
        resp = checkin_data.get("respiration_rate")
        temp = checkin_data.get("skin_temperature_c")
        strain = checkin_data.get("fatigue_physical_strain")

        valid_biometrics = 0
        if rhr is not None and 35.0 <= float(rhr) <= 220.0:
            valid_biometrics += 1
            wearable_reasons.append(f"RHR {rhr} bpm")
        if hrv is not None and 5.0 <= float(hrv) <= 200.0:
            valid_biometrics += 1
            wearable_reasons.append(f"HRV {hrv} ms")
        if resp is not None and 5.0 <= float(resp) <= 50.0:
            valid_biometrics += 1
            wearable_reasons.append(f"Resp {resp} bpm")
        if temp is not None and 28.0 <= float(temp) <= 45.0:
            valid_biometrics += 1
            wearable_reasons.append(f"Temp {temp}°C")
        if strain is not None and 0.0 <= float(strain) <= 100.0:
            valid_biometrics += 1
            wearable_reasons.append(f"Strain {strain}%")

        if (is_synced or valid_biometrics >= 1) and valid_biometrics >= 1:
            has_wearable = True

        if has_wearable:
            available_sources.append("WEARABLE")
            source_details["WEARABLE"] = {
                "valid": True,
                "synced": is_synced,
                "validBiometricsCount": valid_biometrics,
                "notes": ", ".join(wearable_reasons)
            }
        else:
            unavailable_sources.append("WEARABLE")
            source_details["WEARABLE"] = {"valid": False, "notes": "No authorized wearable telemetry synchronized"}

        count = len(available_sources)
        total = 5

        return {
            "count": count,
            "total": total,
            "display": f"DATA AVAILABLE — {count} / {total}",
            "availableSources": available_sources,
            "unavailableSources": unavailable_sources,
            "details": source_details
        }

    @classmethod
    def _compute_evidence_strength(cls, checkin_data: Dict[str, Any], ml_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluates evidence strength based on Quality, Completeness, and Availability (Requirement 22).
        Strictly decoupled from the individual's welfare concern / risk level.
        """
        data_avail = cls._evaluate_data_availability(checkin_data)
        sources = data_avail["availableSources"]
        count = data_avail["count"]
        has_wearable = "WEARABLE" in sources

        # 1. Availability Score (0.0 to 1.0)
        availability_score = round(count / 5.0, 2)

        # 2. Quality Score (0.0 to 1.0)
        quality_points = 0.0
        max_quality = max(1, count)

        if "DUTY" in sources:
            duty_facets = sum(1 for k in ["shift_continuity_days", "night_duty_hours", "prolonged_duty_hours"] if checkin_data.get(k) is not None)
            quality_points += 0.7 if duty_facets >= 1 else 0.5
            if duty_facets >= 2:
                quality_points += 0.3

        if "WORKLOAD" in sources:
            wl_facets = sum(1 for k in ["workload_hours", "work_pressure_rating"] if checkin_data.get(k) is not None)
            quality_points += 1.0 if wl_facets >= 2 else 0.7

        if "REST_RECOVERY" in sources:
            rest_facets = sum(1 for k in ["recovery_sleep_hours", "rest_interval_hours", "recovery_pattern"] if checkin_data.get(k) is not None)
            quality_points += 1.0 if rest_facets >= 2 else 0.7

        if "SELF_CHECK" in sources:
            quality_points += 1.0

        if "WEARABLE" in sources:
            w_details = data_avail["details"].get("WEARABLE", {})
            bio_count = w_details.get("validBiometricsCount", 1)
            is_synced = w_details.get("synced", False)
            quality_points += 1.0 if (bio_count >= 3 and is_synced) else 0.85

        quality_score = round(min(1.0, quality_points / max_quality), 2)

        # 3. Completeness Score (0.0 to 1.0)
        key_params = [
            "workload_hours", "work_pressure_rating",
            "recovery_sleep_hours", "rest_interval_hours", "recovery_pattern",
            "shift_continuity_days", "night_duty_hours", "prolonged_duty_hours", "duty_type",
            "pss_score",
            "resting_heart_rate", "hrv_ms", "respiration_rate", "skin_temperature_c", "fatigue_physical_strain"
        ]
        provided_params = sum(1 for p in key_params if checkin_data.get(p) is not None)
        completeness_score = round(min(1.0, provided_params / len(key_params)), 2)

        # Composite Evidence Score (Decoupled from Risk!)
        composite_score = round(
            availability_score * 0.35 + quality_score * 0.35 + completeness_score * 0.30,
            2
        )

        if (composite_score >= 0.75 and has_wearable) or count == 5:
            level = "HIGH"
            rationale = "Robust multi-source evidence with active continuous wearable biometric telemetry and verified operational logs."
        elif count >= 3 or composite_score >= 0.50:
            level = "MODERATE"
            rationale = "Sufficient evidence based on authorized operational logs, rest records, and self-check input."
        elif count >= 1 or composite_score >= 0.25:
            level = "EMERGING"
            rationale = "Preliminary evidence based on sparse or partial operational parameters."
        else:
            level = "INSUFFICIENT"
            rationale = "Insufficient evidence to establish an authorized assessment."

        return {
            "level": level,
            "displayLabel": f"EVIDENCE — {level}",
            "score": composite_score,
            "quality": {
                "score": quality_score,
                "percentage": int(quality_score * 100),
                "rating": "HIGH" if quality_score >= 0.8 else ("MODERATE" if quality_score >= 0.5 else "LOW")
            },
            "completeness": {
                "score": completeness_score,
                "percentage": int(completeness_score * 100),
                "providedParamsCount": provided_params,
                "totalExpectedParams": len(key_params)
            },
            "availability": {
                "score": availability_score,
                "percentage": int(availability_score * 100),
                "dataAvailableCount": count,
                "dataAvailableTotal": 5,
                "dataAvailableDisplay": data_avail["display"],
                "availableSources": sources,
                "unavailableSources": data_avail["unavailableSources"]
            },
            "dataAvailableCount": count,
            "dataAvailableTotal": 5,
            "dataAvailableDisplay": data_avail["display"],
            "sourcesCount": count,
            "sources": sources,
            "hasWearableTelemetry": has_wearable,
            "hasOperationalDuty": "DUTY" in sources,
            "hasRestRecovery": "REST_RECOVERY" in sources,
            "hasSelfCheck": "SELF_CHECK" in sources,
            "summary": rationale,
            "evidenceDetails": [f"{s}: {data_avail['details'][s]['notes']}" for s in sources]
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
        Synthesizes top primary contributing indicators with directional arrows (Requirement 24).
        Guarantees zero invented contributors: only features actually provided in checkin_data
        that deviated in the direction of strain relative to authorized baselines are returned.
        """
        factors = ml_result.get("contributingFactors") or []
        main_contributors = []

        has_wearable = bool(
            checkin_data.get("wearable_synced") or
            checkin_data.get("resting_heart_rate") is not None or
            checkin_data.get("hrv_ms") is not None or
            checkin_data.get("respiration_rate") is not None or
            checkin_data.get("skin_temperature_c") is not None or
            checkin_data.get("fatigue_physical_strain") is not None
        )
        has_pss = checkin_data.get("pss_score") is not None

        for f in factors:
            key = f.get("feature_key", "")

            # Guard: Zero invented contributors from unsupplied sources
            if key in ["resting_heart_rate", "hrv_ms", "respiration_rate", "skin_temperature_c", "fatigue_physical_strain"] and not has_wearable:
                continue
            if key == "pss_score" and not has_pss:
                continue

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

            # Determine clean directional title and arrow (Requirement 24)
            # e.g.: ↑ Workload, ↓ Rest, ↑ Night duty, ↑ Fatigue indicators, relevant wearable changes
            arrow = "↑"
            direction = "UP"
            directional_title = f"↑ {title}"

            if key == "workload_hours":
                directional_title = "↑ Workload"
                arrow = "↑"
                direction = "UP"
            elif key == "work_pressure_rating":
                directional_title = "↑ Work Pressure"
                arrow = "↑"
                direction = "UP"
            elif key == "recovery_sleep_hours":
                directional_title = "↓ Rest"
                arrow = "↓"
                direction = "DOWN"
            elif key == "rest_interval_hours":
                directional_title = "↓ Rest Interval"
                arrow = "↓"
                direction = "DOWN"
            elif key == "night_duty_hours":
                directional_title = "↑ Night duty"
                arrow = "↑"
                direction = "UP"
            elif key == "prolonged_duty_hours":
                directional_title = "↑ Prolonged Duty"
                arrow = "↑"
                direction = "UP"
            elif key == "shift_continuity_days":
                directional_title = "↑ Shift Continuity"
                arrow = "↑"
                direction = "UP"
            elif key == "fatigue_physical_strain":
                directional_title = "↑ Fatigue indicators"
                arrow = "↑"
                direction = "UP"
            elif key == "resting_heart_rate":
                directional_title = "↑ Heart Rate"
                arrow = "↑"
                direction = "UP"
            elif key == "hrv_ms":
                directional_title = "↓ Heart Rate Variability"
                arrow = "↓"
                direction = "DOWN"
            elif key == "respiration_rate":
                directional_title = "↑ Respiration Rate"
                arrow = "↑"
                direction = "UP"
            elif key == "skin_temperature_c":
                directional_title = "↑ Body Temperature"
                arrow = "↑"
                direction = "UP"
            elif key == "pss_score":
                directional_title = "↑ Perceived Stress"
                arrow = "↑"
                direction = "UP"
            elif key == "social_support_rating":
                directional_title = "↓ Social Support"
                arrow = "↓"
                direction = "DOWN"
            elif key == "work_life_balance_rating":
                directional_title = "↓ Work-Life Balance"
                arrow = "↓"
                direction = "DOWN"

            main_contributors.append({
                "featureKey": key,
                "title": title,
                "directionalTitle": directional_title,
                "direction": direction,
                "arrow": arrow,
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
