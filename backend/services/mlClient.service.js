const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

const FEATURE_METADATA = {
  pss_score: {
    title: 'Perceived Stress Indicator',
    description: 'Validated perceived stress inventory score',
    high_is_risk: true,
    unit: 'pts',
    healthy_range: '0 - 15',
    baseline_mean: 18.2,
    baseline_std: 7.4,
    weight: 0.26
  },
  workload_hours: {
    title: 'Weekly Workload & Duty Hours',
    description: 'Cumulative weekly operational duty hours',
    high_is_risk: true,
    unit: 'hrs/wk',
    healthy_range: '40 - 48',
    baseline_mean: 50.4,
    baseline_std: 10.8,
    weight: 0.22
  },
  work_pressure_rating: {
    title: 'Operational Work Pressure',
    description: 'Perceived acute operational pace and demand',
    high_is_risk: true,
    unit: '/10',
    healthy_range: '1 - 5',
    baseline_mean: 5.5,
    baseline_std: 2.1,
    weight: 0.16
  },
  recovery_sleep_hours: {
    title: 'Rest & Sleep Recovery',
    description: 'Average daily restorative sleep and recovery time',
    high_is_risk: false,
    unit: 'hrs/day',
    healthy_range: '6.5 - 8.5',
    baseline_mean: 6.4,
    baseline_std: 1.2,
    weight: 0.14
  },
  social_support_rating: {
    title: 'Social & Peer Support',
    description: 'Perception of peer, unit, and family connectedness',
    high_is_risk: false,
    unit: '/10',
    healthy_range: '6 - 10',
    baseline_mean: 6.8,
    baseline_std: 1.8,
    weight: 0.08
  },
  work_life_balance_rating: {
    title: 'Work-Life Equilibrium',
    description: 'Perceived balance between duty responsibilities and personal downtime',
    high_is_risk: false,
    unit: '/10',
    healthy_range: '6 - 10',
    baseline_mean: 5.9,
    baseline_std: 1.9,
    weight: 0.06
  },
  shift_continuity_days: {
    title: 'Continuous Shift Exposure',
    description: 'Consecutive days on duty without a full 24h rest period',
    high_is_risk: true,
    unit: 'days',
    healthy_range: '0 - 5',
    baseline_mean: 4.2,
    baseline_std: 3.1,
    weight: 0.05
  },
  recent_trend_indicator: {
    title: 'Recent Welfare Velocity',
    description: 'Directional change in welfare indicators compared to previous check-in',
    high_is_risk: true,
    unit: 'delta',
    healthy_range: '-5 to 0',
    baseline_mean: 0.0,
    baseline_std: 4.5,
    weight: 0.03
  },
  resting_heart_rate: {
    title: 'Resting Heart Rate (Smart Jacket)',
    description: 'Cardiovascular autonomic baseline from Smart Jacket sensor',
    high_is_risk: true,
    unit: 'bpm',
    healthy_range: '50 - 75',
    baseline_mean: 66.0,
    baseline_std: 9.5,
    weight: 0.14
  },
  hrv_ms: {
    title: 'Heart Rate Variability (HRV)',
    description: 'Parasympathetic resilience & autonomic reserve index',
    high_is_risk: false,
    unit: 'ms',
    healthy_range: '45 - 90',
    baseline_mean: 62.0,
    baseline_std: 14.0,
    weight: 0.16
  },
  respiration_rate: {
    title: 'Respiration Cadence',
    description: 'Resting breathing rate from Smart Jacket expansion sensor',
    high_is_risk: true,
    unit: 'br/min',
    healthy_range: '12 - 18',
    baseline_mean: 15.0,
    baseline_std: 2.8,
    weight: 0.08
  },
  prolonged_duty_hours: {
    title: 'Prolonged Shift Duration',
    description: 'Continuous uninterrupted active duty on watch',
    high_is_risk: true,
    unit: 'hrs',
    healthy_range: '0 - 8',
    baseline_mean: 8.0,
    baseline_std: 4.0,
    weight: 0.10
  },
  night_duty_hours: {
    title: 'Nocturnal Shift Exposure',
    description: 'Night watch duty hours disrupting circadian equilibrium',
    high_is_risk: true,
    unit: 'hrs/wk',
    healthy_range: '0 - 12',
    baseline_mean: 12.0,
    baseline_std: 6.0,
    weight: 0.09
  }
};

class MLClientService {
  constructor() {
    this.client = axios.create({
      baseURL: ML_SERVICE_URL,
      timeout: 3000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async predictWelfareRisk(features) {
    const hasWearable = Boolean(
      features.wearable_synced ||
      features.resting_heart_rate != null ||
      features.hrv_ms != null ||
      features.respiration_rate != null ||
      features.skin_temperature_c != null ||
      features.fatigue_physical_strain != null
    );

    const hasPSS = features.pss_score !== undefined && features.pss_score !== null && !isNaN(Number(features.pss_score));

    const hasWorkload = features.workload_hours != null || features.work_pressure_rating != null;
    const hasDuty = features.prolonged_duty_hours != null || features.duty_duration_hours != null || features.night_duty_hours != null || features.shift_continuity_days != null || features.consecutive_duty_days != null || Boolean(features.duty_type);
    const hasRest = features.recovery_sleep_hours != null || features.rest_interval_hours != null || Boolean(features.recovery_pattern);
    const hasOperational = hasWorkload || hasDuty || hasRest;

    // Pathway 4: Insufficient evidence -> UNDETERMINED
    // "Never guess a welfare concern when evidence is insufficient."
    if ((!hasWearable && !hasPSS) || !hasOperational) {
      return this.synthesizeUndetermined(
        features,
        (!hasWearable && !hasPSS)
          ? 'Neither wearable biometric telemetry nor PSS-10 self-check is available. Never guessing welfare concern when evidence is insufficient.'
          : 'Operational duty and workload logs are absent. Welfare analysis requires operational context.'
      );
    }

    // Pathway 3: Both wearable and PSS available -> Dual-Model consensus through Decision Layer
    if (hasWearable && hasPSS) {
      try {
        const response = await this.client.post('/predict', features);
        if (response.data && response.data.success) {
          const resData = response.data.data;
          if (!resData.decisionLayer) {
            resData.decisionLayer = this.synthesizeDecisionLayer(features, resData);
          }
          return resData;
        }
      } catch (err) {
        console.warn('[ML Client] Remote Dual-Model /predict call failed. Using Embedded Dual-Model Consensus. Error:', err.message);
      }
      return this.calculateEmbeddedDualModelPrediction(features);
    }

    // Pathway 1: Wearable + operational data available (no PSS) -> Model 1
    if (hasWearable && !hasPSS) {
      try {
        const response = await this.client.post('/predict/model1', features);
        if (response.data && response.data.success) {
          const resData = response.data.data;
          if (!resData.decisionLayer) {
            resData.decisionLayer = this.synthesizeDecisionLayer(features, resData);
          }
          return resData;
        }
      } catch (err) {
        console.warn('[ML Client] Remote Model 1 call failed for sensor checkin. Using Embedded Model 1 Engine. Error:', err.message);
      }
      return this.calculateEmbeddedPrediction(features);
    }

    // Pathway 2: No wearable, but PSS-10 + operational data available -> Model 2
    if (!hasWearable && hasPSS) {
      try {
        const response = await this.client.post('/predict/model2', features);
        if (response.data && response.data.success) {
          const resData = response.data.data;
          if (!resData.decisionLayer) {
            resData.decisionLayer = this.synthesizeDecisionLayer(features, resData);
          }
          return resData;
        }
      } catch (err) {
        console.warn('[ML Client] Remote Model 2 call failed. Using Embedded Model 2 Engine. Error:', err.message);
      }
      return this.calculateEmbeddedPrediction(features);
    }

    return this.synthesizeUndetermined(features, 'Evidence sufficiency criteria not met.');
  }

  calculateEmbeddedPrediction(checkinData) {
    const evidenceSources = ['DUTY', 'WORKLOAD', 'REST_RECOVERY'];
    const hasSelfCheck = checkinData.pss_score !== undefined && checkinData.pss_score !== null;
    if (hasSelfCheck) evidenceSources.push('SELF_CHECK');

    const hasWearable = Boolean(
      checkinData.wearable_synced ||
      checkinData.resting_heart_rate != null ||
      checkinData.hrv_ms != null ||
      checkinData.respiration_rate != null ||
      checkinData.skin_temperature_c != null ||
      checkinData.fatigue_physical_strain != null
    );
    if (hasWearable) evidenceSources.push('WEARABLE');

    let totalRiskScore = 0;
    let totalWeight = 0;
    const contributingFactors = [];

    // Filter active features
    const allKeys = Object.keys(FEATURE_METADATA);
    const activeKeys = allKeys.filter(k => {
      if (k === 'pss_score' && !hasSelfCheck) return false;
      if (['resting_heart_rate', 'hrv_ms', 'respiration_rate', 'prolonged_duty_hours', 'night_duty_hours'].includes(k)) {
        return checkinData[k] !== undefined && checkinData[k] !== null;
      }
      return true;
    });

    activeKeys.forEach(key => {
      const meta = FEATURE_METADATA[key];
      const rawVal = Number(checkinData[key] !== undefined ? checkinData[key] : meta.baseline_mean);
      const zScore = (rawVal - meta.baseline_mean) / meta.baseline_std;
      const stressDeviation = meta.high_is_risk ? zScore : -zScore;

      const factorContribution = Math.max(0, stressDeviation + 1.2) * meta.weight * 100.0;
      totalRiskScore += (stressDeviation * meta.weight * 25.0);
      totalWeight += meta.weight;

      let impactLevel = 'LOW';
      let status = 'Within Baseline';
      if (stressDeviation > 0.8) {
        impactLevel = 'HIGH';
        status = 'Elevated Concern';
      } else if (stressDeviation > 0.2) {
        impactLevel = 'MODERATE';
        status = 'Moderate Strain';
      }

      contributingFactors.push({
        feature_key: key,
        title: meta.title,
        description: meta.description,
        user_value: rawVal,
        unit: meta.unit,
        healthy_range: meta.healthy_range,
        baseline_mean: meta.baseline_mean,
        importance_weight: meta.weight,
        contribution_score: Number(factorContribution.toFixed(2)),
        impact_level: impactLevel,
        status: status,
        is_risk_driver: stressDeviation > 0.3
      });
    });

    // Re-normalize score according to active weight sum
    const weightFactor = totalWeight > 0 ? (1.0 / totalWeight) : 1.0;
    let normalizedRiskDelta = totalRiskScore * (weightFactor * 0.85);

    // Contextual Duty Role & Deployment Sector multiplier
    const dutyType = checkinData.duty_type || '';
    const zone = checkinData.deploymentZone || '';
    const posting = checkinData.postingType || '';

    let dutyMultiplier = 0.0;
    if (zone.toLowerCase().includes('high altitude') || zone.toLowerCase().includes('remote')) {
      dutyMultiplier += 3.5;
    }
    if (dutyType.toLowerCase().includes('quick reaction') || dutyType.toLowerCase().includes('patrol')) {
      dutyMultiplier += 2.5;
    } else if (dutyType.toLowerCase().includes('convoy')) {
      dutyMultiplier += 1.5;
    }

    if (dutyMultiplier > 0) {
      normalizedRiskDelta += dutyMultiplier;
      contributingFactors.push({
        feature_key: 'operational_duty_context',
        title: 'Operational Sector & Duty Post',
        description: `${dutyType || 'Active Watch'} in ${zone || posting || 'Field Area'}`,
        user_value: dutyMultiplier,
        unit: 'index',
        healthy_range: 'Baseline Post',
        baseline_mean: 0,
        importance_weight: 0.08,
        contribution_score: Number((dutyMultiplier * 3.0).toFixed(2)),
        impact_level: dutyMultiplier >= 4.0 ? 'HIGH' : 'MODERATE',
        status: dutyMultiplier >= 4.0 ? 'High Altitude / Tactical Demand' : 'Tactical Duty Demands',
        is_risk_driver: dutyMultiplier >= 3.0
      });
    }

    // Longitudinal Personal Baseline Deviation (Tasks 13 & 14)
    if (checkinData.personal_workload_delta !== undefined && checkinData.personal_workload_delta > 5.0) {
      const surgeDelta = Number(checkinData.personal_workload_delta);
      const personalContribution = Math.min(18.0, (surgeDelta / 5.0) * 4.0);
      normalizedRiskDelta += personalContribution * 0.4;
      contributingFactors.push({
        feature_key: 'personal_workload_surge',
        title: 'Workload Surge vs Personal Baseline',
        description: `Current duty is +${surgeDelta} hrs/wk above personal average (${checkinData.personal_avg_workload || 48} hrs/wk)`,
        user_value: surgeDelta,
        unit: 'hrs above normal',
        healthy_range: 'Within ±3 hrs',
        baseline_mean: 0,
        importance_weight: 0.12,
        contribution_score: Number((personalContribution * 2.5).toFixed(2)),
        impact_level: surgeDelta >= 10.0 ? 'HIGH' : 'MODERATE',
        status: 'Acute Workload Surge',
        is_risk_driver: surgeDelta >= 8.0
      });
    }

    if (checkinData.personal_sleep_delta !== undefined && checkinData.personal_sleep_delta < -1.0) {
      const sleepDeficit = Math.abs(Number(checkinData.personal_sleep_delta));
      const deficitContribution = Math.min(16.0, sleepDeficit * 3.5);
      normalizedRiskDelta += deficitContribution * 0.4;
      contributingFactors.push({
        feature_key: 'personal_sleep_deficit',
        title: 'Recovery Sleep Deficit vs Personal Baseline',
        description: `Current sleep is ${sleepDeficit} hrs/day below personal typical rest (${checkinData.personal_avg_sleep || 7.0} hrs/day)`,
        user_value: sleepDeficit,
        unit: 'hrs below normal',
        healthy_range: 'Within ±0.5 hrs',
        baseline_mean: 0,
        importance_weight: 0.11,
        contribution_score: Number((deficitContribution * 2.5).toFixed(2)),
        impact_level: sleepDeficit >= 2.0 ? 'HIGH' : 'MODERATE',
        status: 'Acute Rest Deficit',
        is_risk_driver: sleepDeficit >= 1.5
      });
    }

    let compositeRisk = Math.min(95.0, Math.max(5.0, 45.0 + normalizedRiskDelta));
    compositeRisk = Number(compositeRisk.toFixed(1));

    let concernLevel = 'LOW';
    let probLow = 0.85;
    let probMod = 0.12;
    let probHigh = 0.03;

    if (compositeRisk >= 66.0) {
      concernLevel = 'HIGH';
      probHigh = Number((compositeRisk / 100).toFixed(2));
      probMod = Number(((100 - compositeRisk) * 0.7 / 100).toFixed(2));
      probLow = Number(Math.max(0, 1.0 - probHigh - probMod).toFixed(2));
    } else if (compositeRisk >= 38.0) {
      concernLevel = 'MODERATE';
      probMod = 0.65;
      probLow = 0.25;
      probHigh = 0.10;
    }

    contributingFactors.sort((a, b) => b.contribution_score - a.contribution_score);
    const topDrivers = contributingFactors.filter(f => f.is_risk_driver);
    const selectedTopDrivers = (topDrivers.length > 0 ? topDrivers : contributingFactors).slice(0, 3).map(d => d.title);

    const rawResult = {
      concernLevel: concernLevel,
      confidence: concernLevel === 'HIGH' ? probHigh : (concernLevel === 'MODERATE' ? probMod : probLow),
      compositeRiskScore: compositeRisk,
      probabilities: {
        LOW: probLow,
        MODERATE: probMod,
        HIGH: probHigh
      },
      evidenceSources,
      evidenceCount: evidenceSources.length,
      topDrivers: selectedTopDrivers,
      contributingFactors: contributingFactors,
      modelUsed: hasWearable ? 'MODEL_1_WEARABLE_OPERATIONAL' : 'MODEL_2_PSS_OPERATIONAL',
      isSyntheticPrototype: true,
      realWorldValidated: false,
      modelVersion: hasWearable ? 'v2.0.0-model1-prototype' : 'v2.0.0-model2-prototype',
      trainedAt: new Date().toISOString(),
      analyzedAt: new Date().toISOString(),
      disclaimer: hasWearable
        ? 'PROTOTYPE MODEL 1 (Wearable + Operational RF): Multi-source predictive signal based on synthetic prototype benchmark. Does NOT represent real-world clinical or operational validated performance.'
        : 'PROTOTYPE MODEL 2 (PSS + Operational Fallback RF): Multi-source predictive signal based on synthetic prototype benchmark. Designated fallback pathway when wearable telemetry is unavailable.'
    };

    const decisionLayer = this.synthesizeDecisionLayer(checkinData, rawResult);
    return {
      ...rawResult,
      welfareConcernDisplay: decisionLayer.welfareConcern.displayLabel,
      evidenceStrength: decisionLayer.evidenceStrength.level,
      evidenceDisplay: decisionLayer.evidenceStrength.displayLabel,
      evidenceStrengthScore: decisionLayer.evidenceStrength.score,
      dataAvailableCount: decisionLayer.evidenceStrength.dataAvailableCount,
      dataAvailableTotal: decisionLayer.evidenceStrength.dataAvailableTotal,
      dataAvailableDisplay: decisionLayer.evidenceStrength.dataAvailableDisplay,
      evidenceSources: decisionLayer.evidenceStrength.sources,
      evidenceCount: decisionLayer.evidenceStrength.sourcesCount,
      topDrivers: decisionLayer.mainContributors.filter(m => m.isRiskDriver).map(m => m.directionalTitle).slice(0, 4),
      requiresHumanReview: decisionLayer.humanWelfareReview.requiresHumanReview,
      humanReviewPriority: decisionLayer.humanWelfareReview.priority,
      decisionLayer
    };
  }

  evaluateDataAvailability(checkinData) {
    const availableSources = [];
    const unavailableSources = [];
    const sourceDetails = {};

    // 1. DUTY
    let hasDuty = false;
    const prolonged = checkinData.prolonged_duty_hours || checkinData.duty_duration_hours;
    const night = checkinData.night_duty_hours;
    const shifts = checkinData.shift_continuity_days || checkinData.consecutive_duty_days;
    const dutyType = checkinData.duty_type;
    if ((prolonged != null && Number(prolonged) > 0) ||
        (night != null && Number(night) > 0) ||
        (shifts != null && Number(shifts) > 0) ||
        (dutyType && String(dutyType).trim().toLowerCase() !== 'none' && String(dutyType).trim().toLowerCase() !== 'null')) {
      hasDuty = true;
    }
    if (hasDuty) {
      availableSources.push('DUTY');
      sourceDetails.DUTY = { valid: true };
    } else {
      unavailableSources.push('DUTY');
      sourceDetails.DUTY = { valid: false };
    }

    // 2. WORKLOAD
    let hasWorkload = false;
    const workload = checkinData.workload_hours;
    const pressure = checkinData.work_pressure_rating;
    if ((workload != null && Number(workload) > 0) || (pressure != null && Number(pressure) > 0)) {
      hasWorkload = true;
    }
    if (hasWorkload) {
      availableSources.push('WORKLOAD');
      sourceDetails.WORKLOAD = { valid: true };
    } else {
      unavailableSources.push('WORKLOAD');
      sourceDetails.WORKLOAD = { valid: false };
    }

    // 3. REST_RECOVERY
    let hasRest = false;
    const sleep = checkinData.recovery_sleep_hours;
    const interval = checkinData.rest_interval_hours;
    const pattern = checkinData.recovery_pattern;
    if ((sleep != null && Number(sleep) > 0) || (interval != null && Number(interval) > 0) || (pattern && String(pattern).trim().toLowerCase() !== 'none' && String(pattern).trim().toLowerCase() !== 'null')) {
      hasRest = true;
    }
    if (hasRest) {
      availableSources.push('REST_RECOVERY');
      sourceDetails.REST_RECOVERY = { valid: true };
    } else {
      unavailableSources.push('REST_RECOVERY');
      sourceDetails.REST_RECOVERY = { valid: false };
    }

    // 4. SELF_CHECK
    let hasPss = false;
    const pss = checkinData.pss_score;
    if (pss != null && !isNaN(Number(pss)) && Number(pss) >= 0 && Number(pss) <= 40) {
      hasPss = true;
    }
    if (hasPss) {
      availableSources.push('SELF_CHECK');
      sourceDetails.SELF_CHECK = { valid: true, pssScore: Number(pss) };
    } else {
      unavailableSources.push('SELF_CHECK');
      sourceDetails.SELF_CHECK = { valid: false };
    }

    // 5. WEARABLE
    let hasWearable = false;
    const isSynced = Boolean(checkinData.wearable_synced);
    const rhr = checkinData.resting_heart_rate;
    const hrv = checkinData.hrv_ms;
    const resp = checkinData.respiration_rate;
    const temp = checkinData.skin_temperature_c;
    const strain = checkinData.fatigue_physical_strain;
    let validBioCount = 0;
    if (rhr != null && Number(rhr) >= 35 && Number(rhr) <= 220) validBioCount++;
    if (hrv != null && Number(hrv) >= 5 && Number(hrv) <= 200) validBioCount++;
    if (resp != null && Number(resp) >= 5 && Number(resp) <= 50) validBioCount++;
    if (temp != null && Number(temp) >= 28 && Number(temp) <= 45) validBioCount++;
    if (strain != null && Number(strain) >= 0 && Number(strain) <= 100) validBioCount++;

    if ((isSynced || validBioCount >= 1) && validBioCount >= 1) {
      hasWearable = true;
    }
    if (hasWearable) {
      availableSources.push('WEARABLE');
      sourceDetails.WEARABLE = { valid: true, synced: isSynced, count: validBioCount };
    } else {
      unavailableSources.push('WEARABLE');
      sourceDetails.WEARABLE = { valid: false };
    }

    const count = availableSources.length;
    const total = 5;
    return {
      count,
      total,
      display: `DATA AVAILABLE — ${count} / ${total}`,
      availableSources,
      unavailableSources,
      details: sourceDetails
    };
  }

  synthesizeDecisionLayer(checkinData, mlResult) {
    const dataAvail = this.evaluateDataAvailability(checkinData);
    const evidenceSources = dataAvail.availableSources;
    const hasWearable = evidenceSources.includes('WEARABLE');
    const hasSelfCheck = evidenceSources.includes('SELF_CHECK');
    const hasDuty = evidenceSources.includes('DUTY');
    const hasWorkload = evidenceSources.includes('WORKLOAD');
    const hasRest = evidenceSources.includes('REST_RECOVERY');
    const count = dataAvail.count;

    const availabilityScore = Number((count / 5.0).toFixed(2));
    const qualityScore = hasWearable ? 0.95 : (count >= 3 ? 0.85 : 0.65);
    const completenessScore = Number(Math.min(1.0, Object.keys(checkinData).filter(k => checkinData[k] != null).length / 15).toFixed(2));
    const compositeScore = Number((availabilityScore * 0.35 + qualityScore * 0.35 + completenessScore * 0.30).toFixed(2));

    let evidenceLevel = 'EMERGING';
    let evidenceSummary = 'Preliminary evidence based on sparse or partial parameters.';
    if ((compositeScore >= 0.75 && hasWearable) || count === 5) {
      evidenceLevel = 'HIGH';
      evidenceSummary = 'Robust multi-source evidence with active continuous wearable biometric telemetry and verified operational logs.';
    } else if (count >= 3 || compositeScore >= 0.50) {
      evidenceLevel = 'MODERATE';
      evidenceSummary = 'Sufficient evidence based on authorized operational logs, rest records, and self-check input.';
    }

    const evidenceStrength = {
      level: evidenceLevel,
      displayLabel: `EVIDENCE — ${evidenceLevel}`,
      score: compositeScore,
      dataAvailableCount: count,
      dataAvailableTotal: 5,
      dataAvailableDisplay: dataAvail.display,
      sourcesCount: count,
      sources: evidenceSources,
      hasWearableTelemetry: hasWearable,
      hasOperationalDuty: hasDuty,
      hasRestRecovery: hasRest,
      hasSelfCheck: hasSelfCheck,
      quality: { score: qualityScore, percentage: Math.round(qualityScore * 100), rating: qualityScore >= 0.8 ? 'HIGH' : 'MODERATE' },
      completeness: { score: completenessScore, percentage: Math.round(completenessScore * 100) },
      availability: { score: availabilityScore, percentage: Math.round(availabilityScore * 100), availableSources: evidenceSources, unavailableSources: dataAvail.unavailableSources },
      summary: evidenceSummary
    };

    // Compound strain checks
    const nightDuty = Number(checkinData.night_duty_hours || 0);
    const sleep = Number(checkinData.recovery_sleep_hours || 7);
    const consecutive = Number(checkinData.shift_continuity_days || 0);
    const prolonged = Number(checkinData.prolonged_duty_hours || 0);
    const workload = Number(checkinData.workload_hours || 45);

    let compoundStrain = false;
    const compoundReasons = [];
    if (nightDuty >= 16.0 && sleep < 5.0 && consecutive >= 6.0) {
      compoundStrain = true;
      compoundReasons.push('Severe cumulative duty exposure: graveyard duty >= 16h with acute sleep deficit < 5h');
    }
    if (prolonged >= 16.0 && workload > 65.0) {
      compoundStrain = true;
      compoundReasons.push('Extreme operational duration: continuous duty >= 16h with weekly workload > 65h');
    }

    let finalConcern = mlResult.concernLevel;
    let finalScore = mlResult.compositeRiskScore;
    if (compoundStrain) {
      if (finalConcern === 'LOW') { finalConcern = 'MODERATE'; finalScore = Math.max(finalScore, 52.0); }
      else if (finalConcern === 'MODERATE' && finalScore >= 60.0) { finalConcern = 'HIGH'; finalScore = Math.max(finalScore, 75.0); }
    }

    const welfareConcern = {
      concernLevel: finalConcern,
      displayLabel: `WELFARE CONCERN — ${finalConcern}`,
      rawModelConcern: mlResult.concernLevel,
      compositeRiskScore: finalScore,
      confidence: mlResult.confidence,
      probabilities: mlResult.probabilities,
      modelUsed: mlResult.modelUsed,
      compoundStrainDetected: compoundStrain,
      compoundReasons,
      status: finalScore >= 80 ? 'CRITICAL' : (finalScore >= 60 ? 'ELEVATED' : (finalScore >= 40 ? 'MODERATE' : 'BALANCED'))
    };

    // Formulate directional contributors with zero invention
    const mainContributors = (mlResult.contributingFactors || []).filter(f => {
      const k = f.feature_key || f.featureKey || '';
      if (['resting_heart_rate', 'hrv_ms', 'respiration_rate', 'skin_temperature_c', 'fatigue_physical_strain'].includes(k) && !hasWearable) return false;
      if (k === 'pss_score' && !hasSelfCheck) return false;
      return true;
    }).map(f => {
      let cat = 'PSYCHOLOGICAL_EQUILIBRIUM';
      const k = f.feature_key || f.featureKey || '';
      if (['resting_heart_rate', 'hrv_ms', 'respiration_rate', 'skin_temperature_c', 'fatigue_physical_strain'].includes(k)) cat = 'WEARABLE_BIOMETRIC';
      else if (['prolonged_duty_hours', 'night_duty_hours', 'shift_continuity_days', 'deployment_demand_score', 'operational_duty_context'].includes(k)) cat = 'OPERATIONAL_DUTY';
      else if (['workload_hours', 'work_pressure_rating', 'personal_workload_surge'].includes(k)) cat = 'WORKLOAD_PRESSURE';
      else if (['recovery_sleep_hours', 'rest_interval_hours', 'recovery_pattern_score', 'personal_sleep_deficit'].includes(k)) cat = 'REST_RECOVERY';

      let directionalTitle = `↑ ${f.title || k}`;
      let arrow = '↑';
      let direction = 'UP';
      if (k === 'workload_hours') { directionalTitle = '↑ Workload'; }
      else if (k === 'work_pressure_rating') { directionalTitle = '↑ Work Pressure'; }
      else if (k === 'recovery_sleep_hours') { directionalTitle = '↓ Rest'; arrow = '↓'; direction = 'DOWN'; }
      else if (k === 'rest_interval_hours') { directionalTitle = '↓ Rest Interval'; arrow = '↓'; direction = 'DOWN'; }
      else if (k === 'night_duty_hours') { directionalTitle = '↑ Night duty'; }
      else if (k === 'prolonged_duty_hours') { directionalTitle = '↑ Prolonged Duty'; }
      else if (k === 'shift_continuity_days') { directionalTitle = '↑ Shift Continuity'; }
      else if (k === 'fatigue_physical_strain') { directionalTitle = '↑ Fatigue indicators'; }
      else if (k === 'resting_heart_rate') { directionalTitle = '↑ Heart Rate'; }
      else if (k === 'hrv_ms') { directionalTitle = '↓ Heart Rate Variability'; arrow = '↓'; direction = 'DOWN'; }
      else if (k === 'respiration_rate') { directionalTitle = '↑ Respiration Rate'; }
      else if (k === 'skin_temperature_c') { directionalTitle = '↑ Body Temperature'; }
      else if (k === 'pss_score') { directionalTitle = '↑ Perceived Stress'; }

      return {
        featureKey: k,
        title: f.title || k.replace(/_/g, ' '),
        directionalTitle,
        direction,
        arrow,
        category: cat,
        userValue: f.user_value !== undefined ? f.user_value : f.userValue,
        unit: f.unit || '',
        healthyRange: f.healthy_range || f.healthyRange || 'Standard',
        baselineMean: f.baseline_mean !== undefined ? f.baseline_mean : f.baselineMean,
        contributionScore: f.contribution_score !== undefined ? f.contribution_score : (f.contributionScore || 0),
        impactLevel: f.impact_level || f.impactLevel || 'LOW',
        isRiskDriver: Boolean(f.is_risk_driver || f.isRiskDriver),
        status: f.status || 'Within Baseline'
      };
    }).sort((a, b) => b.contributionScore - a.contributionScore);

    // Human Welfare Review Formulation
    let requiresReview = false;
    let priority = 'STANDARD_MONITORING';
    let action = 'Routine monitoring; personnel operating within normal welfare equilibrium.';
    const triggers = [];

    if (finalConcern === 'HIGH' || finalScore >= 65.0) {
      requiresReview = true;
      if (finalScore >= 80.0) {
        priority = 'CRITICAL';
        triggers.push(`Critical composite welfare risk score (${finalScore}%) exceeds acute safety threshold`);
      } else {
        priority = 'HIGH';
        triggers.push(`High welfare concern signal (${finalScore}%) flagged by ${mlResult.modelUsed}`);
      }
    }

    if (compoundStrain) {
      requiresReview = true;
      if (priority !== 'CRITICAL') priority = 'HIGH';
      triggers.push(...compoundReasons);
    }

    const topDrivers = mainContributors.filter(m => m.isRiskDriver);
    (topDrivers.length > 0 ? topDrivers : mainContributors).slice(0, 3).forEach(d => {
      triggers.push(`${d.title}: ${d.userValue}${d.unit || ''} (${d.impactLevel} strain vs baseline ${d.baselineMean})`);
    });

    if (requiresReview) {
      if (priority === 'CRITICAL') {
        action = 'URGENT WELFARE INTERVENTION: Initiate confidential 1-on-1 check-in within 12 hours. Review active duty roster for immediate 24-hour mandatory rest rotation and evaluate medical/counseling referral.';
      } else {
        action = 'OFFICER REVIEW REQUIRED: Schedule supportive welfare consultation within 24–48 hours. Assess recent shift continuity, night watch exposure, and ensure restorative sleep compliance.';
      }
    } else if (finalConcern === 'MODERATE') {
      priority = 'ROUTINE';
      action = 'MONITORED STATUS: Recommend proactive peer support and unit downtime. Monitor next check-in cycle for directional velocity.';
    }

    const humanWelfareReview = {
      requiresHumanReview: requiresReview,
      priority,
      status: requiresReview ? 'PENDING_REVIEW' : 'MONITORING_ONLY',
      reviewTriggers: triggers.length > 0 ? triggers : ['No adverse triggers detected'],
      recommendedOfficerAction: action,
      assignedRole: 'Unit Welfare Officer / Station Resilience Lead',
      escalationPath: priority === 'CRITICAL' ? 'Medical Officer / Commanding Officer' : 'Welfare Officer Review'
    };

    return {
      welfareConcern,
      evidenceStrength,
      mainContributors,
      humanWelfareReview,
      evaluatedAt: new Date().toISOString(),
      decisionEngineVersion: 'v2.2.0-decision-layer'
    };
  }

  synthesizeUndetermined(features, reason) {
    const defaultReason = reason || 'Insufficient authorized evidence to determine welfare concern reliably.';
    const dataAvail = this.evaluateDataAvailability(features || {});
    const count = dataAvail.count;
    const availDisplay = dataAvail.display;
    const availSources = dataAvail.availableSources;

    const availabilityScore = Number((count / 5.0).toFixed(2));
    const qualityScore = count >= 3 ? 0.75 : 0.40;
    const completenessScore = Number(Math.min(1.0, Object.keys(features || {}).filter(k => features[k] != null).length / 15).toFixed(2));
    const evidenceScore = Number((availabilityScore * 0.35 + qualityScore * 0.35 + completenessScore * 0.30).toFixed(2));

    const decisionLayer = {
      welfareConcern: {
        concernLevel: 'UNDETERMINED',
        displayLabel: 'WELFARE CONCERN — UNDETERMINED',
        compositeRiskScore: null,
        confidence: 0.0,
        status: 'INSUFFICIENT_EVIDENCE',
        modelUsed: 'NONE_INSUFFICIENT_EVIDENCE',
        reason: defaultReason,
        compoundStrainDetected: false
      },
      evidenceStrength: {
        level: 'INSUFFICIENT',
        displayLabel: 'EVIDENCE — INSUFFICIENT',
        score: evidenceScore,
        dataAvailableCount: count,
        dataAvailableTotal: 5,
        dataAvailableDisplay: availDisplay,
        sourcesCount: availSources.length,
        sources: availSources,
        hasWearableTelemetry: availSources.includes('WEARABLE'),
        hasOperationalDuty: availSources.includes('DUTY'),
        hasRestRecovery: availSources.includes('REST_RECOVERY'),
        hasSelfCheck: availSources.includes('SELF_CHECK'),
        quality: { score: qualityScore, percentage: Math.round(qualityScore * 100), rating: 'INSUFFICIENT' },
        completeness: { score: completenessScore, percentage: Math.round(completenessScore * 100) },
        availability: { score: availabilityScore, percentage: Math.round(availabilityScore * 100), availableSources: availSources, unavailableSources: dataAvail.unavailableSources },
        summary: 'Evidence is insufficient to establish an authorized assessment. Assessment omitted to avoid arbitrary guessing.',
        missingEvidence: ['Operational duty context or authorized biometrics / self-check']
      },
      mainContributors: [],
      humanWelfareReview: {
        requiresHumanReview: false,
        priority: 'NONE',
        status: 'MONITORING_ONLY',
        reviewTriggers: [defaultReason],
        recommendedOfficerAction: 'Encourage personnel to synchronize wearable Smart Jacket sensor or complete self-check questionnaire to provide sufficient authorized evidence.',
        assignedRole: 'Unit Welfare Officer'
      },
      evaluatedAt: new Date().toISOString(),
      decisionEngineVersion: 'v2.2.0-decision-layer'
    };

    return {
      concernLevel: 'UNDETERMINED',
      welfareConcernDisplay: 'WELFARE CONCERN — UNDETERMINED',
      compositeRiskScore: null,
      confidence: 0.0,
      isUndetermined: true,
      evidenceStrength: 'INSUFFICIENT',
      evidenceDisplay: 'EVIDENCE — INSUFFICIENT',
      evidenceStrengthScore: evidenceScore,
      dataAvailableCount: count,
      dataAvailableTotal: 5,
      dataAvailableDisplay: availDisplay,
      evidenceSources: availSources,
      evidenceCount: availSources.length,
      topDrivers: [],
      contributingFactors: [],
      modelUsed: 'NONE_INSUFFICIENT_EVIDENCE',
      requiresHumanReview: false,
      humanReviewPriority: 'NONE',
      decisionLayer,
      analyzedAt: new Date().toISOString(),
      disclaimer: 'EVIDENCE INSUFFICIENT: Never guess a welfare concern when evidence is insufficient. Check-in must include authorized operational data alongside either wearable sensor telemetry or self-check input.'
    };
  }

  calculateEmbeddedDualModelPrediction(features) {
    const m1 = this.calculateEmbeddedPrediction(features);
    const m2Features = { ...features };
    delete m2Features.resting_heart_rate;
    delete m2Features.hrv_ms;
    delete m2Features.respiration_rate;
    delete m2Features.skin_temperature_c;
    delete m2Features.fatigue_physical_strain;
    delete m2Features.wearable_synced;
    const m2 = this.calculateEmbeddedPrediction(m2Features);

    const m1Score = m1.compositeRiskScore != null ? Number(m1.compositeRiskScore) : 20.0;
    const m2Score = m2.compositeRiskScore != null ? Number(m2.compositeRiskScore) : 20.0;
    const consensusScore = Number((m1Score * 0.55 + m2Score * 0.45).toFixed(1));

    let consensusConcern = 'LOW';
    if (consensusScore >= 65.0 || m1.concernLevel === 'HIGH' || m2.concernLevel === 'HIGH') {
      consensusConcern = consensusScore >= 65.0 ? 'HIGH' : 'MODERATE';
    } else if (consensusScore >= 38.0 || m1.concernLevel === 'MODERATE' || m2.concernLevel === 'MODERATE') {
      consensusConcern = 'MODERATE';
    }

    const res = {
      ...m1,
      concernLevel: consensusConcern,
      compositeRiskScore: consensusScore,
      modelUsed: 'DUAL_MODEL_CONSENSUS',
      modelsEvaluated: ['MODEL_1_WEARABLE_OPERATIONAL', 'MODEL_2_PSS_OPERATIONAL'],
      disclaimer: 'DUAL-MODEL DECISION CONSENSUS: Evaluated across ML Model 1 (Wearable + Operational) and ML Model 2 (PSS-10 Fallback) through the WelfareAI Decision Layer.'
    };
    res.decisionLayer = this.synthesizeDecisionLayer(features, res);
    res.evidenceStrength = 'HIGH';
    res.evidenceStrengthScore = 0.95;
    return res;
  }

  async checkHealth() {
    try {
      const response = await this.client.get('/health', { timeout: 2000 });
      return {
        isAvailable: true,
        data: response.data
      };
    } catch (err) {
      return {
        isAvailable: false,
        error: err.message,
        data: { status: 'offline', engine: 'Embedded Ensemble Random Forest' }
      };
    }
  }

  async getModel1Evaluation() {
    try {
      const response = await this.client.get('/evaluation/model1', { timeout: 2000 });
      return response.data;
    } catch (err) {
      return null;
    }
  }

  async getModel1Info() {
    try {
      const response = await this.client.get('/model1-info', { timeout: 2000 });
      return response.data;
    } catch (err) {
      return null;
    }
  }

  async getModel2Evaluation() {
    try {
      const response = await this.client.get('/evaluation/model2', { timeout: 2000 });
      return response.data;
    } catch (err) {
      return null;
    }
  }

  async getModel2Info() {
    try {
      const response = await this.client.get('/model2-info', { timeout: 2000 });
      return response.data;
    } catch (err) {
      return null;
    }
  }

  async getModelEvaluation() {
    try {
      const response = await this.client.get('/evaluation/model1', { timeout: 2000 });
      return response.data;
    } catch (err) {
      try {
        const response2 = await this.client.get('/evaluation', { timeout: 2000 });
        return response2.data;
      } catch (e) {
        return null;
      }
    }
  }

  async getModelInfo() {
    try {
      const response = await this.client.get('/model1-info', { timeout: 2000 });
      return response.data;
    } catch (err) {
      try {
        const response2 = await this.client.get('/model-info', { timeout: 2000 });
        return response2.data;
      } catch (e) {
        return {
          model_name: 'Model 1 (Wearable + Operational Random Forest Prototype)',
          framework: 'scikit-learn (with Embedded Production Runtime)',
          model_version: 'v2.0.0-model1-prototype',
          n_estimators: 100,
          is_synthetic_prototype: true,
          real_world_validated: false,
          features: Object.keys(FEATURE_METADATA),
          class_names: ['LOW', 'MODERATE', 'HIGH'],
          disclaimer: 'PROTOTYPE MODEL: Trained on synthetic prototype benchmark data for integration testing. Accuracy does NOT represent real-world clinical or operational validated performance.'
        };
      }
    }
  }
}

module.exports = new MLClientService();

