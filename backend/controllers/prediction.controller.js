const db = require('../models/dbAdapter');
const mlClient = require('../services/mlClient.service');

function formatContributorsSummary(contributors, isUndetermined, evidenceStrength) {
  if (isUndetermined || evidenceStrength === 'INSUFFICIENT' || evidenceStrength === 'INSUFFICIENT EVIDENCE') {
    return 'INSUFFICIENT EVIDENCE';
  }
  if (!contributors || !Array.isArray(contributors) || contributors.length === 0) {
    return 'Within standard baseline thresholds';
  }
  const riskDrivers = contributors.filter(c => c.isRiskDriver || c.impactLevel === 'HIGH' || c.impactLevel === 'MODERATE');
  const chosen = (riskDrivers.length > 0 ? riskDrivers : contributors).slice(0, 4);
  const items = chosen.map(c => {
    if (typeof c === 'string') return c;
    if (c.directionalTitle) return c.directionalTitle;
    const arrow = c.direction === 'DOWN' ? '↓' : '↑';
    return `${arrow} ${(c.title || c.featureKey || 'operational load')}`;
  });
  return items.length > 0 ? items.join(', ') : 'Within standard baseline thresholds';
}

const getLatestPrediction = async (req, res, next) => {
  try {
    const checkIns = await db.CheckIns.find({ userId: req.user._id });
    const personalBaseline = computePersonalBaseline(checkIns);
    const predictions = await db.Predictions.find({ userId: req.user._id });

    const nonMedicalDisclaimer = 'Never a medical diagnosis. The model identifies operational welfare patterns only.';
    const nonDisciplinaryDisclaimer = 'Never a disciplinary decision. An ML prediction must never automatically become a disciplinary action.';

    if (predictions.length === 0) {
      const guidance = 'Additional authorized data or a welfare check-in is required.';
      return res.status(200).json({
        success: true,
        hasPrediction: false,
        welfareConcernDisplay: 'WELFARE CONCERN — UNDETERMINED',
        welfareConcern: 'UNDETERMINED',
        welfareConcernText: 'Welfare Concern: UNDETERMINED',
        evidenceDisplay: 'EVIDENCE — INSUFFICIENT',
        evidenceStrength: 'INSUFFICIENT',
        evidenceNotice: 'INSUFFICIENT EVIDENCE',
        evidenceText: 'Evidence: INSUFFICIENT EVIDENCE',
        dataAvailableCount: 0,
        dataAvailableTotal: 5,
        dataAvailableDisplay: 'DATA AVAILABLE — 0 / 5',
        dataAvailableText: 'Data Available: 0/5',
        dataQuality: 'INSUFFICIENT',
        dataQualityDisplay: 'DATA QUALITY — INSUFFICIENT',
        dataQualityText: 'Data Quality: INSUFFICIENT',
        baselineStatus: personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT_ESTABLISHED',
        baselineStatusDisplay: `BASELINE STATUS — ${personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT ESTABLISHED'}`,
        baselineStatusText: `Baseline Status: ${personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT_ESTABLISHED'}`,
        predictionStatus: 'INSUFFICIENT EVIDENCE',
        predictionStatusDisplay: 'PREDICTION STATUS — INSUFFICIENT EVIDENCE',
        predictionStatusText: 'Prediction Status: INSUFFICIENT EVIDENCE',
        insufficientEvidenceNotice: 'INSUFFICIENT EVIDENCE — Additional authorized data or welfare check-in required.',
        mainContributors: [],
        contributorsSummary: 'INSUFFICIENT EVIDENCE',
        contributorsText: 'Contributors: INSUFFICIENT EVIDENCE',
        personalBaseline,
        personalBaselineStatus: personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT_ESTABLISHED',
        personalBaselineText: personalBaseline.baselineEstablished ? `Personal Baseline: Established (${personalBaseline.totalCheckInCount} check-ins)` : 'Personal Baseline: Baseline not established yet',
        guidanceText: guidance,
        message: guidance,
        statement: nonMedicalDisclaimer,
        medicalDisclaimer: nonMedicalDisclaimer,
        nonMedicalDisclaimer,
        nonDisciplinaryDisclaimer,
        notMedicalDiagnosis: true,
        data: {
          concernLevel: 'UNDETERMINED',
          welfareConcern: 'UNDETERMINED',
          welfareConcernText: 'Welfare Concern: UNDETERMINED',
          evidenceStrength: 'INSUFFICIENT',
          evidence: 'INSUFFICIENT',
          evidenceNotice: 'INSUFFICIENT EVIDENCE',
          evidenceText: 'Evidence: INSUFFICIENT EVIDENCE',
          welfareConcernDisplay: 'WELFARE CONCERN — UNDETERMINED',
          evidenceDisplay: 'EVIDENCE — INSUFFICIENT',
          guidanceText: guidance,
          recommendedNextAction: guidance,
          recommendedAction: guidance,
          dataAvailableCount: 0,
          dataAvailableTotal: 5,
          dataAvailableDisplay: 'DATA AVAILABLE — 0 / 5',
          dataAvailableText: 'Data Available: 0/5',
          dataQuality: 'INSUFFICIENT',
          dataQualityDisplay: 'DATA QUALITY — INSUFFICIENT',
          dataQualityText: 'Data Quality: INSUFFICIENT',
          baselineStatus: personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT_ESTABLISHED',
          baselineStatusDisplay: `BASELINE STATUS — ${personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT ESTABLISHED'}`,
          baselineStatusText: `Baseline Status: ${personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT_ESTABLISHED'}`,
          predictionStatus: 'INSUFFICIENT EVIDENCE',
          predictionStatusDisplay: 'PREDICTION STATUS — INSUFFICIENT EVIDENCE',
          predictionStatusText: 'Prediction Status: INSUFFICIENT EVIDENCE',
          insufficientEvidenceNotice: 'INSUFFICIENT EVIDENCE — Additional authorized data or welfare check-in required.',
          mainContributors: [],
          contributorsSummary: 'INSUFFICIENT EVIDENCE',
          contributorsText: 'Contributors: INSUFFICIENT EVIDENCE',
          personalBaseline,
          personalBaselineStatus: personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT_ESTABLISHED',
          personalBaselineText: personalBaseline.baselineEstablished ? `Personal Baseline: Established (${personalBaseline.totalCheckInCount} check-ins)` : 'Personal Baseline: Baseline not established yet',
          statement: nonMedicalDisclaimer,
          medicalDisclaimer: nonMedicalDisclaimer,
          nonMedicalDisclaimer,
          nonDisciplinaryDisclaimer,
          notMedicalDiagnosis: true,
          prediction: {
            concernLevel: 'UNDETERMINED',
            welfareConcern: 'UNDETERMINED',
            welfareConcernText: 'Welfare Concern: UNDETERMINED',
            welfareConcernDisplay: 'WELFARE CONCERN — UNDETERMINED',
            evidenceStrength: 'INSUFFICIENT',
            evidence: 'INSUFFICIENT',
            evidenceNotice: 'INSUFFICIENT EVIDENCE',
            evidenceText: 'Evidence: INSUFFICIENT EVIDENCE',
            evidenceDisplay: 'EVIDENCE — INSUFFICIENT',
            compositeRiskScore: null,
            dataAvailableCount: 0,
            dataAvailableTotal: 5,
            dataAvailableDisplay: 'DATA AVAILABLE — 0 / 5',
            dataAvailableText: 'Data Available: 0/5',
            dataQuality: 'INSUFFICIENT',
            dataQualityDisplay: 'DATA QUALITY — INSUFFICIENT',
            dataQualityText: 'Data Quality: INSUFFICIENT',
            baselineStatus: personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT_ESTABLISHED',
            baselineStatusDisplay: `BASELINE STATUS — ${personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT ESTABLISHED'}`,
            baselineStatusText: `Baseline Status: ${personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT_ESTABLISHED'}`,
            predictionStatus: 'INSUFFICIENT EVIDENCE',
            predictionStatusDisplay: 'PREDICTION STATUS — INSUFFICIENT EVIDENCE',
            predictionStatusText: 'Prediction Status: INSUFFICIENT EVIDENCE',
            insufficientEvidenceNotice: 'INSUFFICIENT EVIDENCE — Additional authorized data or welfare check-in required.',
            mainContributors: [],
            contributorsSummary: 'INSUFFICIENT EVIDENCE',
            contributorsText: 'Contributors: INSUFFICIENT EVIDENCE',
            personalBaseline,
            personalBaselineStatus: personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT_ESTABLISHED',
            personalBaselineText: personalBaseline.baselineEstablished ? `Personal Baseline: Established (${personalBaseline.totalCheckInCount} check-ins)` : 'Personal Baseline: Baseline not established yet',
            statement: nonMedicalDisclaimer,
            medicalDisclaimer: nonMedicalDisclaimer,
            nonMedicalDisclaimer,
            nonDisciplinaryDisclaimer,
            notMedicalDiagnosis: true,
            guidanceText: guidance,
            recommendedNextAction: guidance,
            recommendedAction: guidance
          },
          recommendations: {
            primaryAction: guidance
          }
        }
      });
    }

    const latest = predictions[predictions.length - 1];
    const recommendations = await db.Recommendations.findOne({ predictionId: latest._id });
    const checkIn = latest.checkInId ? await db.CheckIns.findById(latest.checkInId) : null;
    const count = latest.dataAvailableCount != null ? latest.dataAvailableCount : (latest.decisionLayer && latest.decisionLayer.evidenceStrength ? latest.decisionLayer.evidenceStrength.dataAvailableCount : (latest.evidenceSources || []).length);

    const isUndet = latest.isUndetermined || latest.concernLevel === 'UNDETERMINED';
    const concernLevel = isUndet ? 'UNDETERMINED' : latest.concernLevel;
    const concernDisplay = latest.welfareConcernDisplay || (isUndet ? 'WELFARE CONCERN — UNDETERMINED' : `WELFARE CONCERN — ${latest.concernLevel}`);
    const evidenceLevel = isUndet ? 'INSUFFICIENT' : (latest.evidenceStrength || 'MODERATE');
    const evDisplay = latest.evidenceDisplay || (latest.decisionLayer && latest.decisionLayer.evidenceStrength ? latest.decisionLayer.evidenceStrength.displayLabel : `EVIDENCE — ${evidenceLevel}`);
    const guidance = isUndet ? 'Additional authorized data or a welfare check-in is required.' : null;
    const prototypeNotice = 'Prototype evaluation accuracy is derived from synthetic prototype training data for system architecture and pipeline verification. Prototype accuracy must not be presented or interpreted as real-world clinically or operationally validated accuracy.';

    const rawContribs = (latest.decisionLayer && latest.decisionLayer.mainContributors) || [];
    const contribsSummary = formatContributorsSummary(rawContribs, isUndet, evidenceLevel);
    const contributorsText = `Contributors: ${contribsSummary}`;
    const evidenceNotice = (isUndet || evidenceLevel === 'INSUFFICIENT') ? 'INSUFFICIENT EVIDENCE' : null;
    const evidenceText = (isUndet || evidenceLevel === 'INSUFFICIENT') ? 'Evidence: INSUFFICIENT EVIDENCE' : `Evidence: ${evidenceLevel}`;
    const welfareConcernText = `Welfare Concern: ${concernLevel}`;
    const dataAvailableText = `Data Available: ${count}/5`;
    const personalBaselineStatus = personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT_ESTABLISHED';
    const personalBaselineText = personalBaseline.baselineEstablished 
      ? `Personal Baseline: Established (${personalBaseline.totalCheckInCount} check-ins)` 
      : 'Personal Baseline: Baseline not established yet (requires ≥2 check-ins)';

    let nextAction = 'Continue standard restorative routines and submit daily check-in.';
    if (isUndet) {
      nextAction = 'Additional authorized data or a welfare check-in is required.';
    } else if (recommendations && recommendations.primaryAction) {
      nextAction = recommendations.primaryAction;
    } else if (latest.decisionLayer && latest.decisionLayer.humanWelfareReview && latest.decisionLayer.humanWelfareReview.recommendedOfficerAction) {
      nextAction = latest.decisionLayer.humanWelfareReview.recommendedOfficerAction;
    } else if (latest.concernLevel === 'HIGH') {
      nextAction = 'Prioritize restorative rest, limit continuous high-intensity exertion, and consult unit welfare officer.';
    } else if (latest.concernLevel === 'MODERATE') {
      nextAction = 'Observe active fatigue signs, maintain balanced sleep intervals, and schedule brief recovery period.';
    }

    const dataQuality = latest.dataQuality || (isUndet ? 'INSUFFICIENT' : 'VERIFIED');
    const dataQualityDisplay = latest.dataQualityDisplay || `DATA QUALITY — ${dataQuality}`;
    const dataQualityText = `Data Quality: ${dataQuality}`;
    const baselineStatusDisplay = `BASELINE STATUS — ${personalBaselineStatus === 'ESTABLISHED' ? 'ESTABLISHED' : 'NOT ESTABLISHED'}`;
    const baselineStatusText = `Baseline Status: ${personalBaselineStatus}`;
    const predictionStatus = isUndet ? 'INSUFFICIENT EVIDENCE' : (latest.predictionStatus || 'ACTIVE');
    const predictionStatusDisplay = latest.predictionStatusDisplay || `PREDICTION STATUS — ${predictionStatus}`;
    const predictionStatusText = `Prediction Status: ${predictionStatus}`;
    const insufficientEvidenceNotice = 'INSUFFICIENT EVIDENCE — Additional authorized data or welfare check-in required.';

    return res.status(200).json({
      success: true,
      hasPrediction: true,
      welfareConcernDisplay: concernDisplay,
      welfareConcern: concernLevel,
      welfareConcernText,
      evidenceDisplay: evDisplay,
      evidence: evidenceLevel,
      evidenceStrength: evidenceLevel,
      evidenceNotice,
      evidenceText,
      dataAvailable: latest.dataAvailableDisplay || `DATA AVAILABLE — ${count} / 5`,
      dataAvailableDisplay: latest.dataAvailableDisplay || `DATA AVAILABLE — ${count} / 5`,
      dataAvailableCount: count,
      dataAvailableTotal: 5,
      dataAvailableText,
      dataQuality,
      dataQualityDisplay,
      dataQualityText,
      baselineStatus: personalBaselineStatus,
      baselineStatusDisplay,
      baselineStatusText,
      predictionStatus,
      predictionStatusDisplay,
      predictionStatusText,
      insufficientEvidenceNotice,
      contributors: rawContribs,
      mainContributors: rawContribs,
      contributorsSummary: contribsSummary,
      contributorsText,
      personalBaseline,
      personalBaselineStatus,
      personalBaselineText,
      recommendedNextAction: nextAction,
      recommendedAction: nextAction,
      guidanceText: guidance,
      statement: nonMedicalDisclaimer,
      medicalDisclaimer: nonMedicalDisclaimer,
      nonMedicalDisclaimer,
      nonDisciplinaryDisclaimer,
      notMedicalDiagnosis: true,
      prototypeAccuracyNotice: prototypeNotice,
      realWorldValidatedAccuracy: false,
      datasetLabel: 'Synthetic Prototype Training Data',
      datasetType: 'SYNTHETIC_PROTOTYPE_TRAINING_DATA',
      data: {
        concernLevel,
        welfareConcern: concernLevel,
        welfareConcernText,
        evidenceStrength: evidenceLevel,
        evidence: evidenceLevel,
        evidenceNotice,
        evidenceText,
        welfareConcernDisplay: concernDisplay,
        evidenceDisplay: evDisplay,
        guidanceText: guidance,
        recommendedNextAction: nextAction,
        recommendedAction: nextAction,
        dataAvailableCount: count,
        dataAvailableTotal: 5,
        dataAvailable: latest.dataAvailableDisplay || `DATA AVAILABLE — ${count} / 5`,
        dataAvailableDisplay: latest.dataAvailableDisplay || `DATA AVAILABLE — ${count} / 5`,
        dataAvailableText,
        dataQuality,
        dataQualityDisplay,
        dataQualityText,
        baselineStatus: personalBaselineStatus,
        baselineStatusDisplay,
        baselineStatusText,
        predictionStatus,
        predictionStatusDisplay,
        predictionStatusText,
        insufficientEvidenceNotice,
        contributors: rawContribs,
        mainContributors: rawContribs,
        contributorsSummary: contribsSummary,
        contributorsText,
        personalBaseline,
        personalBaselineStatus,
        personalBaselineText,
        humanReview: latest.humanReview || null,
        statement: nonMedicalDisclaimer,
        medicalDisclaimer: nonMedicalDisclaimer,
        nonMedicalDisclaimer,
        nonDisciplinaryDisclaimer,
        notMedicalDiagnosis: true,
        prototypeAccuracyNotice: prototypeNotice,
        realWorldValidatedAccuracy: false,
        datasetLabel: 'Synthetic Prototype Training Data',
        datasetType: 'SYNTHETIC_PROTOTYPE_TRAINING_DATA',
        prediction: {
          ...latest,
          concernLevel,
          welfareConcern: concernLevel,
          welfareConcernText,
          evidenceStrength: evidenceLevel,
          evidence: evidenceLevel,
          evidenceNotice,
          evidenceText,
          welfareConcernDisplay: concernDisplay,
          evidenceDisplay: evDisplay,
          guidanceText: guidance,
          recommendedNextAction: nextAction,
          recommendedAction: nextAction,
          dataAvailableCount: count,
          dataAvailableTotal: 5,
          dataAvailableDisplay: latest.dataAvailableDisplay || `DATA AVAILABLE — ${count} / 5`,
          dataAvailableText,
          dataQuality,
          dataQualityDisplay,
          dataQualityText,
          baselineStatus: personalBaselineStatus,
          baselineStatusDisplay,
          baselineStatusText,
          predictionStatus,
          predictionStatusDisplay,
          predictionStatusText,
          insufficientEvidenceNotice,
          mainContributors: rawContribs,
          contributorsSummary: contribsSummary,
          contributorsText,
          personalBaseline,
          personalBaselineStatus,
          personalBaselineText,
          statement: nonMedicalDisclaimer,
          medicalDisclaimer: nonMedicalDisclaimer,
          nonMedicalDisclaimer,
          nonDisciplinaryDisclaimer,
          notMedicalDiagnosis: true,
          prototypeAccuracyNotice: prototypeNotice,
          realWorldValidatedAccuracy: false,
          datasetLabel: 'Synthetic Prototype Training Data',
          datasetType: 'SYNTHETIC_PROTOTYPE_TRAINING_DATA'
        },
        decisionLayer: latest.decisionLayer || null,
        recommendations,
        checkIn
      }
    });
  } catch (err) {
    next(err);
  }
};

const getPredictionHistory = async (req, res, next) => {
  try {
    const predictions = await db.Predictions.find({ userId: req.user._id });
    const checkIns = await db.CheckIns.find({ userId: req.user._id });

    const checkInMap = {};
    checkIns.forEach(c => {
      checkInMap[String(c._id)] = c;
    });

    const series = predictions.map((p, index) => {
      const relatedCheckIn = checkInMap[String(p.checkInId)] || {};
      const cCount = p.dataAvailableCount != null ? p.dataAvailableCount : (p.evidenceCount || 3);
      return {
        _id: p._id,
        checkInId: p.checkInId || relatedCheckIn._id,
        checkInIndex: index + 1,
        date: p.analyzedAt || p.createdAt || relatedCheckIn.createdAt || relatedCheckIn.checkInDate,
        concernLevel: p.concernLevel,
        welfareConcernDisplay: p.welfareConcernDisplay || `WELFARE CONCERN — ${p.concernLevel}`,
        compositeRiskScore: p.compositeRiskScore != null ? Number(p.compositeRiskScore) : null,
        isUndetermined: Boolean(p.isUndetermined || p.concernLevel === 'UNDETERMINED'),
        confidence: p.confidence,
        modelUsed: p.modelUsed || 'MODEL_1_WEARABLE_OPERATIONAL',
        evidenceSources: p.evidenceSources || relatedCheckIn.evidenceSources || ['DUTY', 'WORKLOAD', 'REST_RECOVERY'],
        evidenceCount: p.evidenceCount || (relatedCheckIn.evidenceSources ? relatedCheckIn.evidenceSources.length : 3),
        evidenceStrength: p.evidenceStrength || 'MODERATE',
        evidenceDisplay: p.evidenceDisplay || `EVIDENCE — ${p.evidenceStrength || 'MODERATE'}`,
        dataAvailableCount: cCount,
        dataAvailableTotal: 5,
        dataAvailableDisplay: p.dataAvailableDisplay || `DATA AVAILABLE — ${cCount} / 5`,
        pss_score: relatedCheckIn.pss_score != null ? Number(relatedCheckIn.pss_score) : null,
        workload_hours: relatedCheckIn.workload_hours != null ? Number(relatedCheckIn.workload_hours) : 0,
        recovery_sleep_hours: relatedCheckIn.recovery_sleep_hours != null ? Number(relatedCheckIn.recovery_sleep_hours) : 0,
        work_pressure_rating: relatedCheckIn.work_pressure_rating != null ? Number(relatedCheckIn.work_pressure_rating) : 0,
        shift_continuity_days: relatedCheckIn.shift_continuity_days != null ? Number(relatedCheckIn.shift_continuity_days) : 0,
        social_support_rating: relatedCheckIn.social_support_rating != null ? Number(relatedCheckIn.social_support_rating) : 0,
        work_life_balance_rating: relatedCheckIn.work_life_balance_rating != null ? Number(relatedCheckIn.work_life_balance_rating) : 0,
        resting_heart_rate: relatedCheckIn.resting_heart_rate != null ? Number(relatedCheckIn.resting_heart_rate) : null,
        hrv_ms: relatedCheckIn.hrv_ms != null ? Number(relatedCheckIn.hrv_ms) : null,
        respiration_rate: relatedCheckIn.respiration_rate != null ? Number(relatedCheckIn.respiration_rate) : null,
        skin_temperature_c: relatedCheckIn.skin_temperature_c != null ? Number(relatedCheckIn.skin_temperature_c) : null,
        activity_movement: relatedCheckIn.activity_movement || null,
        posture_inactivity: relatedCheckIn.posture_inactivity || null,
        fatigue_physical_strain: relatedCheckIn.fatigue_physical_strain != null ? Number(relatedCheckIn.fatigue_physical_strain) : null,
        prolonged_duty_hours: relatedCheckIn.prolonged_duty_hours != null ? Number(relatedCheckIn.prolonged_duty_hours) : null,
        night_duty_hours: relatedCheckIn.night_duty_hours != null ? Number(relatedCheckIn.night_duty_hours) : null,
        recovery_pattern: relatedCheckIn.recovery_pattern || null,
        rest_interval_hours: relatedCheckIn.rest_interval_hours != null ? Number(relatedCheckIn.rest_interval_hours) : null,
        contributingFactors: p.contributingFactors || [],
        topDrivers: p.topDrivers || [],
        notes: relatedCheckIn.notes || ''
      };
    });

    // Calculate personal historical baseline across user's check-ins (Tasks 13 & 14)
    const workloadVals = series.map(s => s.workload_hours).filter(v => v != null && !isNaN(v) && v > 0);
    const sleepVals = series.map(s => s.recovery_sleep_hours).filter(v => v != null && !isNaN(v) && v > 0);
    const pressureVals = series.map(s => s.work_pressure_rating).filter(v => v != null && !isNaN(v) && v > 0);
    const restIntervalVals = series.map(s => s.rest_interval_hours).filter(v => v != null && !isNaN(v) && v > 0);

    const calcSeriesAvg = arr => arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;

    const personalBaseline = {
      recordCount: series.length,
      avgWorkloadHours: calcSeriesAvg(workloadVals),
      avgRecoverySleepHours: calcSeriesAvg(sleepVals),
      avgWorkPressure: calcSeriesAvg(pressureVals),
      avgRestIntervalHours: calcSeriesAvg(restIntervalVals)
    };

    return res.status(200).json({
      success: true,
      data: series,
      personalBaseline
    });
  } catch (err) {
    next(err);
  }
};

const getExplainability = async (req, res, next) => {
  try {
    const checkIns = await db.CheckIns.find({ userId: req.user._id });
    const personalBaseline = computePersonalBaseline(checkIns);
    const predictions = await db.Predictions.find({ userId: req.user._id });

    const nonMedicalDisclaimer = 'Never a medical diagnosis. The model identifies operational welfare patterns only.';
    const nonDisciplinaryDisclaimer = 'Never a disciplinary decision. An ML prediction must never automatically become a disciplinary action.';

    if (predictions.length === 0) {
      return res.status(200).json({
        success: true,
        data: null,
        welfareConcern: 'UNDETERMINED',
        welfareConcernText: 'Welfare Concern: UNDETERMINED',
        welfareConcernDisplay: 'WELFARE CONCERN — UNDETERMINED',
        evidenceStrength: 'INSUFFICIENT',
        evidenceNotice: 'INSUFFICIENT EVIDENCE',
        evidenceText: 'Evidence: INSUFFICIENT EVIDENCE',
        evidenceDisplay: 'EVIDENCE — INSUFFICIENT',
        dataAvailableCount: 0,
        dataAvailableTotal: 5,
        dataAvailableText: 'Data Available: 0/5',
        dataAvailableDisplay: 'DATA AVAILABLE — 0 / 5',
        dataQuality: 'INSUFFICIENT',
        dataQualityDisplay: 'DATA QUALITY — INSUFFICIENT',
        dataQualityText: 'Data Quality: INSUFFICIENT',
        baselineStatus: personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT_ESTABLISHED',
        baselineStatusDisplay: `BASELINE STATUS — ${personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT ESTABLISHED'}`,
        baselineStatusText: `Baseline Status: ${personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT_ESTABLISHED'}`,
        predictionStatus: 'INSUFFICIENT EVIDENCE',
        predictionStatusDisplay: 'PREDICTION STATUS — INSUFFICIENT EVIDENCE',
        predictionStatusText: 'Prediction Status: INSUFFICIENT EVIDENCE',
        insufficientEvidenceNotice: 'INSUFFICIENT EVIDENCE — Additional authorized data or welfare check-in required.',
        contributorsSummary: 'INSUFFICIENT EVIDENCE',
        contributorsText: 'Contributors: INSUFFICIENT EVIDENCE',
        personalBaseline,
        personalBaselineStatus: personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT_ESTABLISHED',
        personalBaselineText: personalBaseline.baselineEstablished ? `Personal Baseline: Established (${personalBaseline.totalCheckInCount} check-ins)` : 'Personal Baseline: Baseline not established yet',
        nonMedicalDisclaimer,
        nonDisciplinaryDisclaimer,
        message: 'No active prediction available for explainability analysis.'
      });
    }

    const latest = predictions[predictions.length - 1];
    const count = latest.dataAvailableCount != null ? latest.dataAvailableCount : (latest.evidenceCount || 3);
    const isUndet = Boolean(latest.isUndetermined || latest.concernLevel === 'UNDETERMINED');
    const concernLevel = isUndet ? 'UNDETERMINED' : latest.concernLevel;
    const evidenceLevel = isUndet ? 'INSUFFICIENT' : (latest.evidenceStrength || (latest.decisionLayer ? latest.decisionLayer.evidenceStrength.level : 'MODERATE'));
    const evidenceNotice = (isUndet || evidenceLevel === 'INSUFFICIENT') ? 'INSUFFICIENT EVIDENCE' : null;
    const evidenceText = (isUndet || evidenceLevel === 'INSUFFICIENT') ? 'Evidence: INSUFFICIENT EVIDENCE' : `Evidence: ${evidenceLevel}`;
    const rawContribs = (latest.decisionLayer && latest.decisionLayer.mainContributors) || latest.contributingFactors || [];
    const contribsSummary = formatContributorsSummary(rawContribs, isUndet, evidenceLevel);
    const contributorsText = `Contributors: ${contribsSummary}`;
    const dataAvailableText = `Data Available: ${count}/5`;
    const personalBaselineStatus = personalBaseline.baselineEstablished ? 'ESTABLISHED' : 'NOT_ESTABLISHED';
    const personalBaselineText = personalBaseline.baselineEstablished 
      ? `Personal Baseline: Established (${personalBaseline.totalCheckInCount} check-ins)` 
      : 'Personal Baseline: Baseline not established yet (requires ≥2 check-ins)';

    const dataQuality = latest.dataQuality || (isUndet ? 'INSUFFICIENT' : 'VERIFIED');
    const dataQualityDisplay = latest.dataQualityDisplay || `DATA QUALITY — ${dataQuality}`;
    const dataQualityText = `Data Quality: ${dataQuality}`;
    const baselineStatusDisplay = `BASELINE STATUS — ${personalBaselineStatus === 'ESTABLISHED' ? 'ESTABLISHED' : 'NOT ESTABLISHED'}`;
    const baselineStatusText = `Baseline Status: ${personalBaselineStatus}`;
    const predictionStatus = isUndet ? 'INSUFFICIENT EVIDENCE' : (latest.predictionStatus || 'ACTIVE');
    const predictionStatusDisplay = latest.predictionStatusDisplay || `PREDICTION STATUS — ${predictionStatus}`;
    const predictionStatusText = `Prediction Status: ${predictionStatus}`;
    const insufficientEvidenceNotice = 'INSUFFICIENT EVIDENCE — Additional authorized data or welfare check-in required.';

    return res.status(200).json({
      success: true,
      dataQuality,
      dataQualityDisplay,
      dataQualityText,
      baselineStatus: personalBaselineStatus,
      baselineStatusDisplay,
      baselineStatusText,
      predictionStatus,
      predictionStatusDisplay,
      predictionStatusText,
      insufficientEvidenceNotice,
      dataAvailable: latest.dataAvailableDisplay || (latest.decisionLayer && latest.decisionLayer.evidenceStrength ? latest.decisionLayer.evidenceStrength.dataAvailableDisplay : `DATA AVAILABLE — ${count} / 5`),
      dataAvailableCount: count,
      dataAvailableTotal: 5,
      dataAvailableDisplay: latest.dataAvailableDisplay || (latest.decisionLayer && latest.decisionLayer.evidenceStrength ? latest.decisionLayer.evidenceStrength.dataAvailableDisplay : `DATA AVAILABLE — ${count} / 5`),
      dataAvailableText,
      contributors: rawContribs,
      mainContributors: rawContribs,
      contributorsSummary: contribsSummary,
      data: {
        predictionId: latest._id,
        concernLevel,
        welfareConcern: concernLevel,
        welfareConcernText: `Welfare Concern: ${concernLevel}`,
        welfareConcernDisplay: latest.welfareConcernDisplay || (isUndet ? 'WELFARE CONCERN — UNDETERMINED' : `WELFARE CONCERN — ${concernLevel}`),
        compositeRiskScore: latest.compositeRiskScore,
        evidenceSources: latest.evidenceSources || ['DUTY', 'WORKLOAD', 'REST_RECOVERY'],
        evidenceCount: latest.evidenceCount || (latest.evidenceSources ? latest.evidenceSources.length : 3),
        evidenceStrength: evidenceLevel,
        evidence: evidenceLevel,
        evidenceNotice,
        evidenceText,
        evidenceDisplay: latest.evidenceDisplay || `EVIDENCE — ${evidenceLevel}`,
        dataAvailableCount: count,
        dataAvailableTotal: 5,
        dataAvailableText,
        dataAvailable: latest.dataAvailableDisplay || (latest.decisionLayer && latest.decisionLayer.evidenceStrength ? latest.decisionLayer.evidenceStrength.dataAvailableDisplay : `DATA AVAILABLE — ${count} / 5`),
        dataAvailableDisplay: latest.dataAvailableDisplay || (latest.decisionLayer && latest.decisionLayer.evidenceStrength ? latest.decisionLayer.evidenceStrength.dataAvailableDisplay : `DATA AVAILABLE — ${count} / 5`),
        dataQuality,
        dataQualityDisplay,
        dataQualityText,
        baselineStatus: personalBaselineStatus,
        baselineStatusDisplay,
        baselineStatusText,
        predictionStatus,
        predictionStatusDisplay,
        predictionStatusText,
        insufficientEvidenceNotice,
        decisionLayer: latest.decisionLayer || null,
        contributors: rawContribs,
        mainContributors: rawContribs,
        contributingIndicators: rawContribs,
        contributorsSummary: contribsSummary,
        contributorsText,
        personalBaseline,
        personalBaselineStatus,
        personalBaselineText,
        humanReview: latest.humanReview || null,
        recommendedNextAction: isUndet ? 'Additional authorized data or a welfare check-in is required.' : (latest.decisionLayer && latest.decisionLayer.humanWelfareReview ? latest.decisionLayer.humanWelfareReview.recommendedOfficerAction : 'Continue standard restorative routines and submit daily check-in.'),
        recommendedAction: isUndet ? 'Additional authorized data or a welfare check-in is required.' : (latest.decisionLayer && latest.decisionLayer.humanWelfareReview ? latest.decisionLayer.humanWelfareReview.recommendedOfficerAction : 'Continue standard restorative routines and submit daily check-in.'),
        topDrivers: latest.topDrivers,
        contributingFactors: latest.contributingFactors || [],
        modelUsed: latest.modelUsed || 'MODEL_1_WEARABLE_OPERATIONAL',
        statement: nonMedicalDisclaimer,
        medicalDisclaimer: nonMedicalDisclaimer,
        nonMedicalDisclaimer,
        nonDisciplinaryDisclaimer,
        notMedicalDiagnosis: true,
        datasetLabel: 'Synthetic Prototype Training Data',
        datasetType: 'SYNTHETIC_PROTOTYPE_TRAINING_DATA',
        realWorldValidatedAccuracy: false,
        prototypeAccuracyNotice: 'Prototype evaluation accuracy is derived from synthetic prototype training data for system architecture and pipeline verification. Prototype accuracy must not be presented or interpreted as real-world clinically or operationally validated accuracy.',
        disclaimer: 'The model identifies welfare-risk patterns/concerns, not a medical diagnosis. Model-derived contributing indicators reflect statistical baseline variance, not proof of individual causation.'
      }
    });

  } catch (err) {
    next(err);
  }
};

// Helper to compute personal historical baseline using the person's actual authorized data
function computePersonalBaseline(checkIns, targetIndex = null) {
  if (!checkIns || checkIns.length < 2) {
    return {
      baselineEstablished: false,
      status: 'INSUFFICIENT_HISTORY',
      message: 'Baseline not established yet.',
      guidanceText: 'Additional authorized data or a welfare check-in is required.',
      display: 'PERSONAL BASELINE NOT ESTABLISHED',
      baselineStatusDisplay: 'BASELINE STATUS — NOT ESTABLISHED',
      personalBaselineText: 'PERSONAL BASELINE NOT ESTABLISHED',
      notice: 'PERSONAL BASELINE NOT ESTABLISHED',
      baselineCheckInCount: checkIns ? checkIns.length : 0,
      totalCheckInCount: checkIns ? checkIns.length : 0,
      comparisonCategories: null,
      yourNormalPattern: null,
      current: null
    };
  }

  // Chronological order
  const sorted = [...checkIns].sort((a, b) => new Date(a.checkInDate || a.createdAt || 0) - new Date(b.checkInDate || b.createdAt || 0));
  const currentIdx = (targetIndex !== null && targetIndex >= 0 && targetIndex < sorted.length)
    ? targetIndex
    : sorted.length - 1;
  const current = sorted[currentIdx];

  // Prior check-ins forming the baseline
  const priorCheckIns = sorted.filter((_, idx) => idx !== currentIdx);
  if (priorCheckIns.length === 0) {
    return {
      baselineEstablished: false,
      status: 'INSUFFICIENT_HISTORY',
      message: 'Baseline not established yet.',
      guidanceText: 'Additional authorized data or a welfare check-in is required.',
      display: 'PERSONAL BASELINE NOT ESTABLISHED',
      baselineStatusDisplay: 'BASELINE STATUS — NOT ESTABLISHED',
      personalBaselineText: 'PERSONAL BASELINE NOT ESTABLISHED',
      notice: 'PERSONAL BASELINE NOT ESTABLISHED',
      baselineCheckInCount: 0,
      totalCheckInCount: sorted.length,
      comparisonCategories: null,
      yourNormalPattern: null,
      current: null
    };
  }

  const calcMean = (arr, key) => {
    const valid = arr.map(item => item[key]).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
    if (valid.length === 0) return null;
    const sum = valid.reduce((acc, v) => acc + Number(v), 0);
    return Number((sum / valid.length).toFixed(1));
  };

  // 1. Workload Category
  const baseWorkloadHours = calcMean(priorCheckIns, 'workload_hours');
  const baseWorkPressure = calcMean(priorCheckIns, 'work_pressure_rating');
  const baseProlongedDuty = calcMean(priorCheckIns, 'prolonged_duty_hours');

  const currWorkloadHours = current.workload_hours != null ? Number(current.workload_hours) : null;
  const currWorkPressure = current.work_pressure_rating != null ? Number(current.work_pressure_rating) : null;
  const currProlongedDuty = current.prolonged_duty_hours != null ? Number(current.prolonged_duty_hours) : null;

  const workloadDelta = (currWorkloadHours != null && baseWorkloadHours != null)
    ? Number((currWorkloadHours - baseWorkloadHours).toFixed(1))
    : 0;

  // 2. Rest Category
  const baseSleep = calcMean(priorCheckIns, 'recovery_sleep_hours');
  const baseRestInterval = calcMean(priorCheckIns, 'rest_interval_hours');

  const currSleep = current.recovery_sleep_hours != null ? Number(current.recovery_sleep_hours) : null;
  const currRestInterval = current.rest_interval_hours != null ? Number(current.rest_interval_hours) : null;

  const sleepDelta = (currSleep != null && baseSleep != null)
    ? Number((currSleep - baseSleep).toFixed(1))
    : 0;

  // 3. Night-Duty Pattern Category
  const baseNightDuty = calcMean(priorCheckIns, 'night_duty_hours');
  const currNightDuty = current.night_duty_hours != null ? Number(current.night_duty_hours) : null;
  const nightDutyDelta = (currNightDuty != null && baseNightDuty != null)
    ? Number((currNightDuty - baseNightDuty).toFixed(1))
    : 0;

  let nightDutyChange = 'Consistent with your baseline night-duty pattern';
  if (nightDutyDelta > 0) {
    nightDutyChange = `+${nightDutyDelta} hrs night duty above normal (${baseNightDuty || 0} hrs avg)`;
  } else if (nightDutyDelta < 0) {
    nightDutyChange = `${nightDutyDelta} hrs night duty below normal (${baseNightDuty || 0} hrs avg)`;
  }

  // 4. Wearable Trends Category (Vitals & Physiological Strain)
  const baseHr = calcMean(priorCheckIns, 'resting_heart_rate');
  const baseHrv = calcMean(priorCheckIns, 'hrv_ms');
  const baseResp = calcMean(priorCheckIns, 'respiration_rate');
  const baseTemp = calcMean(priorCheckIns, 'skin_temperature_c');

  const currHr = current.resting_heart_rate != null ? Number(current.resting_heart_rate) : null;
  const currHrv = current.hrv_ms != null ? Number(current.hrv_ms) : null;
  const currResp = current.respiration_rate != null ? Number(current.respiration_rate) : null;
  const currTemp = current.skin_temperature_c != null ? Number(current.skin_temperature_c) : null;

  const hrDelta = (currHr != null && baseHr != null) ? Number((currHr - baseHr).toFixed(1)) : null;
  const hrvDelta = (currHrv != null && baseHrv != null) ? Number((currHrv - baseHrv).toFixed(1)) : null;

  let wearableTrendChange = 'Biometric vitals consistent with personal baseline';
  if (hrDelta != null && hrDelta > 5.0) {
    wearableTrendChange = `+${hrDelta} BPM elevated resting heart rate (vs ${baseHr} BPM baseline)`;
  } else if (hrDelta != null && hrDelta < -5.0) {
    wearableTrendChange = `${hrDelta} BPM resting heart rate (vs ${baseHr} BPM baseline)`;
  } else if (hrvDelta != null && hrvDelta < -8.0) {
    wearableTrendChange = `Autonomic recovery reduced (HRV -${Math.abs(hrvDelta)} ms vs normal ${baseHrv} ms)`;
  }

  // 5. Fatigue Category (for backward compatibility)
  const baseFatigue = calcMean(priorCheckIns, 'fatigue_physical_strain');
  const baseShiftContinuity = calcMean(priorCheckIns, 'shift_continuity_days');

  const currFatigue = current.fatigue_physical_strain != null ? Number(current.fatigue_physical_strain) : null;
  const currShiftContinuity = current.shift_continuity_days != null ? Number(current.shift_continuity_days) : null;

  const fatigueDelta = (currFatigue != null && baseFatigue != null)
    ? Number((currFatigue - baseFatigue).toFixed(1))
    : (currNightDuty != null && baseNightDuty != null ? Number((currNightDuty - baseNightDuty).toFixed(1)) : 0);

  // 6. Relevant Stress Indicators Category (for backward compatibility)
  const basePss = calcMean(priorCheckIns, 'pss_score');
  const currPss = current.pss_score != null ? Number(current.pss_score) : null;
  const pssDelta = (currPss != null && basePss != null)
    ? Number((currPss - basePss).toFixed(1))
    : null;

  let workloadStatus = 'AT_PERSONAL_NORMAL';
  if (workloadDelta > 4.0) workloadStatus = 'ELEVATED_ABOVE_NORMAL';
  else if (workloadDelta < -4.0) workloadStatus = 'BELOW_NORMAL';

  let sleepStatus = 'AT_PERSONAL_NORMAL';
  if (sleepDelta < -1.0) sleepStatus = 'REST_DEFICIT';
  else if (sleepDelta > 1.0) sleepStatus = 'REST_SURPLUS';

  let workloadChange = 'Consistent with your normal pattern';
  if (workloadDelta > 0) workloadChange = `+${workloadDelta} hrs/wk above your normal pattern (${baseWorkloadHours} hrs/wk avg)`;
  else if (workloadDelta < 0) workloadChange = `${workloadDelta} hrs/wk below your normal pattern (${baseWorkloadHours} hrs/wk avg)`;

  let restChange = 'Consistent with your normal rest pattern';
  if (sleepDelta < 0) restChange = `${sleepDelta} hrs/day below your normal rest (${baseSleep} hrs/day avg)`;
  else if (sleepDelta > 0) restChange = `+${sleepDelta} hrs/day above your normal rest (${baseSleep} hrs/day avg)`;

  let fatigueChange = 'Consistent with normal fatigue pattern';
  if (currFatigue != null && baseFatigue != null) {
    const diff = Number((currFatigue - baseFatigue).toFixed(1));
    if (diff > 5.0) fatigueChange = `+${diff} pts above normal fatigue level (${baseFatigue} avg)`;
    else if (diff < -5.0) fatigueChange = `${diff} pts below normal fatigue level (${baseFatigue} avg)`;
  } else if (currNightDuty != null && baseNightDuty != null && currNightDuty > baseNightDuty) {
    fatigueChange = `+${Number((currNightDuty - baseNightDuty).toFixed(1))} hrs night duty above normal (${baseNightDuty} hrs avg)`;
  }

  let stressChange = 'Consistent with baseline stress markers';
  if (pssDelta !== null) {
    if (pssDelta > 3.0) stressChange = `+${pssDelta} pts elevated perceived stress (vs ${basePss} normal PSS)`;
    else if (pssDelta < -3.0) stressChange = `${pssDelta} pts reduced perceived stress (vs ${basePss} normal PSS)`;
  } else if (currHr != null && baseHr != null && (currHr - baseHr) > 5) {
    stressChange = `+${Number((currHr - baseHr).toFixed(1))} BPM elevated heart rate (vs ${baseHr} BPM baseline)`;
  }

  return {
    baselineEstablished: true,
    status: 'BASELINE_ACTIVE',
    display: 'BASELINE STATUS — ESTABLISHED',
    message: 'Personal baseline active based on authorized historical records.',
    notice: 'Personal baseline active based on authorized historical records.',
    baselineCheckInCount: priorCheckIns.length,
    totalCheckInCount: sorted.length,
    avgWorkloadHours: baseWorkloadHours,
    avgRecoverySleepHours: baseSleep,
    avgWorkPressure: baseWorkPressure,
    avgRestIntervalHours: baseRestInterval,
    avgShiftContinuityDays: baseShiftContinuity,
    avgNightDutyHours: baseNightDuty,
    avgRestingHeartRate: baseHr,
    avgHrvMs: baseHrv,
    comparison: {
      workloadDelta,
      workloadStatus,
      workloadLabel: workloadChange,
      sleepDelta,
      sleepStatus,
      sleepLabel: restChange,
      nightDutyDelta,
      nightDutyLabel: nightDutyChange,
      wearableDelta: hrDelta != null ? hrDelta : (hrvDelta != null ? hrvDelta : 0),
      wearableLabel: wearableTrendChange,
      hrDelta,
      hrvDelta,
      pressureDelta: (currWorkPressure != null && baseWorkPressure != null) ? Number((currWorkPressure - baseWorkPressure).toFixed(1)) : 0,
      fatigueDelta: (currFatigue != null && baseFatigue != null) ? Number((currFatigue - baseFatigue).toFixed(1)) : 0,
      fatigueLabel: fatigueChange,
      stressDelta: pssDelta,
      stressLabel: stressChange
    },
    comparisonCategories: {
      workload: {
        title: 'Workload vs Personal Baseline',
        category: 'Workload',
        normalPattern: {
          value: baseWorkloadHours,
          unit: 'hrs/wk',
          label: baseWorkloadHours != null ? `${baseWorkloadHours} hrs/wk` : 'N/A'
        },
        current: {
          value: currWorkloadHours,
          unit: 'hrs/wk',
          label: currWorkloadHours != null ? `${currWorkloadHours} hrs/wk` : 'N/A'
        },
        delta: workloadDelta,
        directionalChange: workloadChange
      },
      rest: {
        title: 'Recovery/Rest vs Baseline',
        category: 'Recovery / Rest',
        normalPattern: {
          value: baseSleep,
          unit: 'hrs/day',
          label: baseSleep != null ? `${baseSleep} hrs/day` : 'N/A'
        },
        current: {
          value: currSleep,
          unit: 'hrs/day',
          label: currSleep != null ? `${currSleep} hrs/day` : 'N/A'
        },
        delta: sleepDelta,
        directionalChange: restChange
      },
      nightDuty: {
        title: 'Night-Duty Pattern vs Baseline',
        category: 'Night Duty',
        normalPattern: {
          value: baseNightDuty != null ? baseNightDuty : 0,
          unit: 'hrs/wk',
          label: baseNightDuty != null ? `${baseNightDuty} hrs/wk` : '0 hrs/wk'
        },
        current: {
          value: currNightDuty != null ? currNightDuty : 0,
          unit: 'hrs/wk',
          label: currNightDuty != null ? `${currNightDuty} hrs/wk` : '0 hrs/wk'
        },
        delta: nightDutyDelta,
        directionalChange: nightDutyChange
      },
      wearableTrends: {
        title: 'Relevant Wearable Trends vs Baseline',
        category: 'Wearable Trends',
        normalPattern: {
          value: baseHr != null ? baseHr : null,
          unit: 'BPM',
          label: baseHr != null ? `HR: ${baseHr} BPM${baseHrv != null ? ` | HRV: ${baseHrv} ms` : ''}` : 'N/A'
        },
        current: {
          value: currHr != null ? currHr : null,
          unit: 'BPM',
          label: currHr != null ? `HR: ${currHr} BPM${currHrv != null ? ` | HRV: ${currHrv} ms` : ''}` : 'N/A'
        },
        delta: hrDelta != null ? hrDelta : (hrvDelta != null ? hrvDelta : 0),
        hrDelta,
        hrvDelta,
        directionalChange: wearableTrendChange
      },
      fatigue: {
        title: 'Fatigue',
        normalPattern: {
          value: baseFatigue != null ? baseFatigue : baseNightDuty,
          unit: baseFatigue != null ? '/100' : 'hrs night',
          label: baseFatigue != null ? `${baseFatigue} / 100` : (baseNightDuty != null ? `${baseNightDuty} hrs night` : (baseShiftContinuity != null ? `${baseShiftContinuity}d shift` : 'N/A'))
        },
        current: {
          value: currFatigue != null ? currFatigue : currNightDuty,
          unit: currFatigue != null ? '/100' : 'hrs night',
          label: currFatigue != null ? `${currFatigue} / 100` : (currNightDuty != null ? `${currNightDuty} hrs night` : (currShiftContinuity != null ? `${currShiftContinuity}d shift` : 'N/A'))
        },
        delta: fatigueDelta,
        directionalChange: fatigueChange
      },
      stressIndicators: {
        title: 'Relevant Stress Indicators',
        normalPattern: {
          value: basePss != null ? basePss : baseHr,
          unit: basePss != null ? 'pts' : 'BPM',
          label: basePss != null ? `PSS: ${basePss}` : (baseHr != null ? `HR: ${baseHr} BPM` : 'N/A')
        },
        current: {
          value: currPss != null ? currPss : currHr,
          unit: currPss != null ? 'pts' : 'BPM',
          label: currPss != null ? `PSS: ${currPss}` : (currHr != null ? `HR: ${currHr} BPM` : 'N/A')
        },
        delta: pssDelta,
        directionalChange: stressChange
      }
    },
    yourNormalPattern: {
      workload: baseWorkloadHours != null ? `${baseWorkloadHours} hrs/wk` : 'N/A',
      rest: baseSleep != null ? `${baseSleep} hrs/day` : 'N/A',
      nightDuty: baseNightDuty != null ? `${baseNightDuty} hrs/wk` : '0 hrs/wk',
      wearableTrends: baseHr != null ? `HR: ${baseHr} BPM${baseHrv != null ? ` | HRV: ${baseHrv} ms` : ''}` : 'N/A',
      fatigue: baseFatigue != null ? `${baseFatigue} / 100` : (baseNightDuty != null ? `${baseNightDuty} hrs night` : (baseShiftContinuity != null ? `${baseShiftContinuity}d shift` : 'N/A')),
      stressIndicators: basePss != null ? `PSS: ${basePss}` : (baseHr != null ? `HR: ${baseHr} BPM` : 'N/A')
    },
    current: {
      workload: currWorkloadHours != null ? `${currWorkloadHours} hrs/wk` : 'N/A',
      rest: currSleep != null ? `${currSleep} hrs/day` : 'N/A',
      nightDuty: currNightDuty != null ? `${currNightDuty} hrs/wk` : '0 hrs/wk',
      wearableTrends: currHr != null ? `HR: ${currHr} BPM${currHrv != null ? ` | HRV: ${currHrv} ms` : ''}` : 'N/A',
      fatigue: currFatigue != null ? `${currFatigue} / 100` : (currNightDuty != null ? `${currNightDuty} hrs night` : (currShiftContinuity != null ? `${currShiftContinuity}d shift` : 'N/A')),
      stressIndicators: currPss != null ? `PSS: ${currPss}` : (currHr != null ? `HR: ${currHr} BPM` : 'N/A')
    }
  };
}

// "What Changed?" Comparison between current and selected (or immediately preceding) check-in
const getWhatChanged = async (req, res, next) => {
  try {
    const checkIns = await db.CheckIns.find({ userId: req.user._id });
    const predictions = await db.Predictions.find({ userId: req.user._id });

    if (checkIns.length < 2) {
      const pb = computePersonalBaseline(checkIns);
      return res.status(200).json({
        success: true,
        hasComparison: false,
        baselineEstablished: false,
        status: 'INSUFFICIENT_HISTORY',
        display: 'PERSONAL BASELINE NOT ESTABLISHED',
        message: 'Baseline not established yet.',
        guidanceText: 'Additional authorized data or a welfare check-in is required.',
        personalBaseline: pb,
        data: checkIns.length === 1 ? { currentCheckIn: checkIns[0] } : null
      });
    }

    // Sort chronologically ascending
    checkIns.sort((a, b) => new Date(a.checkInDate || a.createdAt || 0) - new Date(b.checkInDate || b.createdAt || 0));

    const currentCheckIn = checkIns[checkIns.length - 1];
    const currentPred = predictions.find(p => String(p.checkInId) === String(currentCheckIn._id)) || predictions[predictions.length - 1] || {};

    const targetId = req.query.id || req.query.compareId || req.query.targetId;
    let previousCheckIn = null;
    let previousPred = null;

    if (targetId) {
      const foundIdx = checkIns.findIndex((c, idx) => 
        String(c._id) === String(targetId) ||
        String(c.predictionId) === String(targetId) ||
        String(idx + 1) === String(targetId) ||
        (predictions[idx] && String(predictions[idx]._id) === String(targetId)) ||
        (c.checkInDate && c.checkInDate.startsWith(String(targetId)))
      );

      if (foundIdx !== -1) {
        if (foundIdx === checkIns.length - 1 && checkIns.length > 1) {
          // If the latest check-in itself was targeted, compare against the immediately preceding
          previousCheckIn = checkIns[checkIns.length - 2];
        } else {
          previousCheckIn = checkIns[foundIdx];
        }
        previousPred = predictions.find(p => String(p.checkInId) === String(previousCheckIn._id)) || predictions[foundIdx] || {};
      }
    }

    if (!previousCheckIn) {
      // Find the most recent check-in before current that has distinct values or timestamp
      for (let i = checkIns.length - 2; i >= 0; i--) {
        const candidate = checkIns[i];
        const isIdentical = candidate.workload_hours === currentCheckIn.workload_hours &&
                            candidate.recovery_sleep_hours === currentCheckIn.recovery_sleep_hours &&
                            candidate.pss_score === currentCheckIn.pss_score &&
                            Math.abs(new Date(candidate.checkInDate || candidate.createdAt) - new Date(currentCheckIn.checkInDate || currentCheckIn.createdAt)) < 60000;
        if (!isIdentical || i === 0) {
          previousCheckIn = candidate;
          previousPred = predictions.find(p => String(p.checkInId) === String(candidate._id)) || predictions[i] || {};
          break;
        }
      }
    }

    // Tasks 26 & 27: Compute authentic personal historical baseline
    const personalBaseline = computePersonalBaseline(checkIns, checkIns.length - 1);

    const calcDelta = (currentVal, prevVal, isHigherRisk = true) => {
      if (currentVal === null || currentVal === undefined || prevVal === null || prevVal === undefined) {
        return {
          previous: (prevVal !== undefined && prevVal !== null) ? Number(prevVal) : null,
          current: (currentVal !== undefined && currentVal !== null) ? Number(currentVal) : null,
          diff: 0,
          direction: 'INSUFFICIENT_DATA',
          welfareImpact: 'NEUTRAL'
        };
      }
      const c = Number(currentVal);
      const p = Number(prevVal);
      const diff = Number((c - p).toFixed(1));
      let direction = 'STABLE';
      let welfareImpact = 'NEUTRAL';

      if (diff > 0.3) {
        direction = 'INCREASED';
        welfareImpact = isHigherRisk ? 'ELEVATING' : 'IMPROVING';
      } else if (diff < -0.3) {
        direction = 'DECREASED';
        welfareImpact = isHigherRisk ? 'IMPROVING' : 'ELEVATING';
      }

      return {
        previous: p,
        current: c,
        diff,
        direction,
        welfareImpact
      };
    };

    const metrics = {
      workload_hours: {
        title: 'Weekly Duty Hours',
        unit: 'hrs/wk',
        personalBaselineAvg: personalBaseline.avgWorkloadHours,
        deltaFromPersonalBaseline: personalBaseline.comparison ? personalBaseline.comparison.workloadDelta : 0,
        ...calcDelta(currentCheckIn.workload_hours, previousCheckIn.workload_hours, true)
      },
      recovery_sleep_hours: {
        title: 'Daily Sleep & Recovery',
        unit: 'hrs/day',
        personalBaselineAvg: personalBaseline.avgRecoverySleepHours,
        deltaFromPersonalBaseline: personalBaseline.comparison ? personalBaseline.comparison.sleepDelta : 0,
        ...calcDelta(currentCheckIn.recovery_sleep_hours, previousCheckIn.recovery_sleep_hours, false)
      },
      work_pressure_rating: {
        title: 'Operational Work Pressure',
        unit: '/10',
        ...calcDelta(currentCheckIn.work_pressure_rating, previousCheckIn.work_pressure_rating, true)
      },
      social_support_rating: {
        title: 'Social & Peer Support',
        unit: '/10',
        ...calcDelta(currentCheckIn.social_support_rating, previousCheckIn.social_support_rating, false)
      },
      work_life_balance_rating: {
        title: 'Work-Life Balance',
        unit: '/10',
        ...calcDelta(currentCheckIn.work_life_balance_rating, previousCheckIn.work_life_balance_rating, false)
      },
      shift_continuity_days: {
        title: 'Continuous Shift Exposure',
        unit: 'days',
        ...calcDelta(currentCheckIn.shift_continuity_days, previousCheckIn.shift_continuity_days, true)
      },
      pss_score: {
        title: 'Perceived Stress Index (PSS)',
        unit: 'pts',
        ...calcDelta(currentCheckIn.pss_score, previousCheckIn.pss_score, true)
      },
      resting_heart_rate: {
        title: 'Resting Heart Rate',
        unit: 'BPM',
        ...calcDelta(currentCheckIn.resting_heart_rate, previousCheckIn.resting_heart_rate, true)
      },
      hrv_ms: {
        title: 'Heart Rate Variability (HRV)',
        unit: 'ms',
        ...calcDelta(currentCheckIn.hrv_ms, previousCheckIn.hrv_ms, false)
      },
      fatigue_physical_strain: {
        title: 'Fatigue & Physical Strain',
        unit: '/100',
        ...calcDelta(currentCheckIn.fatigue_physical_strain, previousCheckIn.fatigue_physical_strain, true)
      },
      prolonged_duty_hours: {
        title: 'Prolonged Duty Hours',
        unit: 'hrs',
        ...calcDelta(currentCheckIn.prolonged_duty_hours, previousCheckIn.prolonged_duty_hours, true)
      },
      night_duty_hours: {
        title: 'Night Duty Hours',
        unit: 'hrs',
        ...calcDelta(currentCheckIn.night_duty_hours, previousCheckIn.night_duty_hours, true)
      },
      compositeRiskScore: {
        title: 'Overall Risk Index',
        unit: '%',
        ...calcDelta(currentPred.compositeRiskScore, previousPred.compositeRiskScore, true)
      }
    };

    // Formulate non-causal summary explanation
    const notableChanges = [];
    if (metrics.recovery_sleep_hours.direction === 'DECREASED') {
      notableChanges.push(`a reduction of ${Math.abs(metrics.recovery_sleep_hours.diff)} hrs/day in recovery sleep`);
    } else if (metrics.recovery_sleep_hours.direction === 'INCREASED') {
      notableChanges.push(`an increase of ${metrics.recovery_sleep_hours.diff} hrs/day in restorative rest`);
    }

    if (metrics.workload_hours.direction === 'INCREASED') {
      notableChanges.push(`an increase of ${metrics.workload_hours.diff} weekly duty hours`);
    } else if (metrics.workload_hours.direction === 'DECREASED') {
      notableChanges.push(`a decrease of ${Math.abs(metrics.workload_hours.diff)} weekly duty hours`);
    }

    if (metrics.work_pressure_rating.direction === 'INCREASED') {
      notableChanges.push(`higher perceived operational pace (+${metrics.work_pressure_rating.diff}/10)`);
    }

    let summaryText = 'Observed indicators remained relatively consistent across the last two check-in periods.';
    if (notableChanges.length > 0) {
      summaryText = `Recent changes show ${notableChanges.join(', ')}. These directional shifts contributed to your updated model prediction.`;
    }

    const availableCheckIns = checkIns.map((c, idx) => {
      const pred = predictions.find(p => String(p.checkInId) === String(c._id)) || {};
      const isCurrent = idx === checkIns.length - 1;
      return {
        id: c._id,
        checkInIndex: idx + 1,
        date: c.checkInDate || c.createdAt,
        riskScore: Math.round(pred.compositeRiskScore || 0),
        concernLevel: pred.concernLevel || 'LOW',
        isCurrent,
        isSelected: String(c._id) === String(previousCheckIn._id)
      };
    });

    return res.status(200).json({
      success: true,
      hasComparison: true,
      baselineEstablished: personalBaseline.baselineEstablished,
      selectedCompareId: previousCheckIn._id,
      previousDate: previousCheckIn.checkInDate || previousCheckIn.createdAt,
      currentDate: currentCheckIn.checkInDate || currentCheckIn.createdAt,
      previousConcernLevel: previousPred.concernLevel || 'UNASSESSED',
      currentConcernLevel: currentPred.concernLevel || 'UNASSESSED',
      previousRiskScore: Math.round(previousPred.compositeRiskScore || 0),
      currentRiskScore: Math.round(currentPred.compositeRiskScore || 0),
      isCustomComparison: Boolean(targetId && String(previousCheckIn._id) !== String(checkIns[checkIns.length - 2]._id)),
      summary: summaryText,
      metrics,
      personalBaseline,
      comparisonCategories: personalBaseline.comparisonCategories,
      availableCheckIns,
      disclaimer: 'Observed differences represent factual variation between check-in inputs, not proof of individual causation.'
    });
  } catch (err) {
    next(err);
  }
};

const getPersonalBaseline = async (req, res, next) => {
  try {
    const checkIns = await db.CheckIns.find({ userId: req.user._id });
    const baseline = computePersonalBaseline(checkIns);
    return res.status(200).json({
      success: true,
      data: baseline
    });
  } catch (err) {
    next(err);
  }
};

const getRecommendations = async (req, res, next) => {
  try {
    const predictions = await db.Predictions.find({ userId: req.user._id });
    if (predictions.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const latest = predictions[predictions.length - 1];
    let rec = await db.Recommendations.findOne({ predictionId: latest._id });
    if (!rec) {
      rec = {
        primaryAction: latest.recommendedAction || 'Maintain regular rest intervals and pacing.',
        concernLevel: latest.concernLevel,
        actionItems: [
          { category: 'Rest & Recovery', title: 'Schedule Rest Interval', description: latest.recommendedAction || 'Maintain duty balance.', priority: latest.concernLevel === 'HIGH' ? 'HIGH' : 'MEDIUM' },
          { category: 'Duty Pacing', title: 'Hydration & Shift Moderation', description: 'Ensure adequate operational pacing between continuous watch hours.', priority: 'MEDIUM' }
        ]
      };
    }
    const items = rec.actionItems || [rec];
    return res.status(200).json({
      success: true,
      data: items,
      recommendation: rec
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getLatestPrediction,
  getPredictionHistory,
  getExplainability,
  getWhatChanged,
  getPersonalBaseline,
  computePersonalBaseline,
  getRecommendations
};
