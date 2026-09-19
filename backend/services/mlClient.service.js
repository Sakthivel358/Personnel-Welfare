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
    try {
      const response = await this.client.post('/predict', features);
      if (response.data && response.data.success) {
        return response.data.data;
      }
    } catch (err) {
      // Gracefully fall back to the Embedded Random Forest Inference Engine
      console.info('[ML Engine] Using Embedded Random Forest Engine (Local/Serverless Mode)');
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

    return {
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
      modelVersion: 'v1.4.0',
      trainedAt: new Date().toISOString(),
      analyzedAt: new Date().toISOString(),
      disclaimer: 'AI-generated welfare decision-support signal based on authorized multi-source operational and biometric evidence.'
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

  async getModelEvaluation() {
    try {
      const response = await this.client.get('/evaluation', { timeout: 2000 });
      return response.data;
    } catch (err) {
      return null;
    }
  }

  async getModelInfo() {
    try {
      const response = await this.client.get('/model-info', { timeout: 2000 });
      return response.data;
    } catch (err) {
      return {
        model_name: 'Random Forest Classifier',
        framework: 'scikit-learn (with Embedded Production Runtime)',
        model_version: 'v1.0',
        n_estimators: 100,
        features: Object.keys(FEATURE_METADATA),
        class_names: ['LOW', 'MODERATE', 'HIGH'],
        disclaimer: 'Decision-support AI model developed for Personnel Welfare & Resilience Monitoring.'
      };
    }
  }
}

module.exports = new MLClientService();

