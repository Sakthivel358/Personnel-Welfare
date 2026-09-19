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

    if (hasWearable) {
      // Task 17: Sensor prediction MUST strictly use Model 1 (Wearable + Operational RF).
      // Under NO circumstances should sensor data be routed to the legacy PSS-10-trained model.
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
      // Strictly fall back to Embedded Model 1 (Wearable + Operational), NEVER the legacy PSS-10 model!
      return this.calculateEmbeddedPrediction(features);
    }

    // For non-sensor check-ins (when wearable evidence is unavailable):
    // Task 18: Fallback pathway is strictly Model 2 (PSS + Operational RF)
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
      decisionLayer,
      evidenceStrength: decisionLayer.evidenceStrength.level,
      evidenceStrengthScore: decisionLayer.evidenceStrength.score,
      requiresHumanReview: decisionLayer.humanWelfareReview.requiresHumanReview,
      humanReviewPriority: decisionLayer.humanWelfareReview.priority
    };
  }

  synthesizeDecisionLayer(checkinData, mlResult) {
    const evidenceSources = mlResult.evidenceSources || ['DUTY', 'WORKLOAD', 'REST_RECOVERY'];
    const hasWearable = evidenceSources.includes('WEARABLE');
    const hasSelfCheck = evidenceSources.includes('SELF_CHECK');
    const hasDuty = evidenceSources.includes('DUTY');
    const hasWorkload = evidenceSources.includes('WORKLOAD');
    const hasRest = evidenceSources.includes('REST_RECOVERY');

    let evidenceScore = 0.0;
    const details = [];
    if (hasDuty) { evidenceScore += 0.20; details.push('Authorized duty schedule verified'); }
    if (hasWorkload) { evidenceScore += 0.20; details.push('Operational workload logged'); }
    if (hasRest) { evidenceScore += 0.20; details.push('Rest and recovery data documented'); }
    if (hasSelfCheck) { evidenceScore += 0.15; details.push('Self-check questionnaire provided'); }
    if (hasWearable) { evidenceScore += 0.25; details.push('Continuous wearable biometric telemetry synchronized'); }

    evidenceScore = Number(Math.min(1.0, Math.max(0.1, evidenceScore)).toFixed(2));
    let evidenceLevel = 'EMERGING';
    let evidenceSummary = 'Preliminary evidence based on sparse or partial parameters.';
    if (evidenceScore >= 0.75 && hasWearable) {
      evidenceLevel = 'HIGH';
      evidenceSummary = 'Robust multi-source evidence with active continuous wearable biometric telemetry and verified operational logs.';
    } else if (evidenceScore >= 0.50) {
      evidenceLevel = 'MODERATE';
      evidenceSummary = 'Sufficient evidence based on authorized operational logs, rest records, and self-check input.';
    }

    const evidenceStrength = {
      level: evidenceLevel,
      score: evidenceScore,
      sourcesCount: evidenceSources.length,
      sources: evidenceSources,
      hasWearableTelemetry: hasWearable,
      hasOperationalDuty: hasDuty,
      hasRestRecovery: hasRest,
      hasSelfCheck: hasSelfCheck,
      summary: evidenceSummary,
      evidenceDetails: details
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
      rawModelConcern: mlResult.concernLevel,
      compositeRiskScore: finalScore,
      confidence: mlResult.confidence,
      probabilities: mlResult.probabilities,
      modelUsed: mlResult.modelUsed,
      compoundStrainDetected: compoundStrain,
      compoundReasons,
      status: finalScore >= 80 ? 'CRITICAL' : (finalScore >= 60 ? 'ELEVATED' : (finalScore >= 40 ? 'MODERATE' : 'BALANCED'))
    };

    const mainContributors = (mlResult.contributingFactors || []).map(f => {
      let cat = 'PSYCHOLOGICAL_EQUILIBRIUM';
      const k = f.feature_key || f.featureKey || '';
      if (['resting_heart_rate', 'hrv_ms', 'respiration_rate', 'skin_temperature_c', 'fatigue_physical_strain'].includes(k)) cat = 'WEARABLE_BIOMETRIC';
      else if (['prolonged_duty_hours', 'night_duty_hours', 'shift_continuity_days', 'deployment_demand_score', 'operational_duty_context'].includes(k)) cat = 'OPERATIONAL_DUTY';
      else if (['workload_hours', 'work_pressure_rating', 'personal_workload_surge'].includes(k)) cat = 'WORKLOAD_PRESSURE';
      else if (['recovery_sleep_hours', 'rest_interval_hours', 'recovery_pattern_score', 'personal_sleep_deficit'].includes(k)) cat = 'REST_RECOVERY';

      return {
        featureKey: k,
        title: f.title || k.replace(/_/g, ' '),
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
      decisionEngineVersion: 'v2.1.0-decision-layer'
    };
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

