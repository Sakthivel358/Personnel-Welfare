const db = require('../models/dbAdapter');
const mlClient = require('../services/mlClient.service');

const getLatestPrediction = async (req, res, next) => {
  try {
    const predictions = await db.Predictions.find({ userId: req.user._id });
    if (predictions.length === 0) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No check-in predictions found yet. Please complete your initial check-in.'
      });
    }

    const latest = predictions[predictions.length - 1];
    const recommendations = await db.Recommendations.findOne({ predictionId: latest._id });
    const checkIn = latest.checkInId ? await db.CheckIns.findById(latest.checkInId) : null;

    return res.status(200).json({
      success: true,
      data: {
        prediction: latest,
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
      return {
        checkInIndex: index + 1,
        date: p.analyzedAt || p.createdAt,
        concernLevel: p.concernLevel,
        compositeRiskScore: p.compositeRiskScore,
        confidence: p.confidence,
        pss_score: relatedCheckIn.pss_score || 0,
        workload_hours: relatedCheckIn.workload_hours || 0,
        recovery_sleep_hours: relatedCheckIn.recovery_sleep_hours || 0,
        work_pressure_rating: relatedCheckIn.work_pressure_rating || 0
      };
    });

    return res.status(200).json({
      success: true,
      data: series
    });
  } catch (err) {
    next(err);
  }
};

const getExplainability = async (req, res, next) => {
  try {
    const predictions = await db.Predictions.find({ userId: req.user._id });
    if (predictions.length === 0) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No active prediction available for explainability analysis.'
      });
    }

    const latest = predictions[predictions.length - 1];

    return res.status(200).json({
      success: true,
      data: {
        predictionId: latest._id,
        concernLevel: latest.concernLevel,
        compositeRiskScore: latest.compositeRiskScore,
        topDrivers: latest.topDrivers,
        contributingFactors: latest.contributingFactors || [],
        modelVersion: latest.modelVersion,
        analyzedAt: latest.analyzedAt,
        disclaimer: 'Model-derived contributing indicators from Random Forest baseline attribution. Not proof of individual causation.'
      }
    });
  } catch (err) {
    next(err);
  }
};

// "What Changed?" Comparison between current and immediately preceding check-in
const getWhatChanged = async (req, res, next) => {
  try {
    const checkIns = await db.CheckIns.find({ userId: req.user._id });
    const predictions = await db.Predictions.find({ userId: req.user._id });

    if (checkIns.length < 2) {
      return res.status(200).json({
        success: true,
        hasComparison: false,
        message: 'At least 2 check-ins are required to calculate observed changes.',
        data: checkIns.length === 1 ? { currentCheckIn: checkIns[0] } : null
      });
    }

    const currentCheckIn = checkIns[checkIns.length - 1];
    const previousCheckIn = checkIns[checkIns.length - 2];

    const currentPred = predictions[predictions.length - 1] || {};
    const previousPred = predictions[predictions.length - 2] || {};

    const calcDelta = (currentVal, prevVal, isHigherRisk = true) => {
      const c = Number(currentVal) || 0;
      const p = Number(prevVal) || 0;
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
        ...calcDelta(currentCheckIn.workload_hours, previousCheckIn.workload_hours, true)
      },
      recovery_sleep_hours: {
        title: 'Daily Sleep & Recovery',
        unit: 'hrs/day',
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

    return res.status(200).json({
      success: true,
      hasComparison: true,
      previousDate: previousCheckIn.checkInDate || previousCheckIn.createdAt,
      currentDate: currentCheckIn.checkInDate || currentCheckIn.createdAt,
      previousConcernLevel: previousPred.concernLevel || 'UNASSESSED',
      currentConcernLevel: currentPred.concernLevel || 'UNASSESSED',
      summary: summaryText,
      metrics,
      disclaimer: 'Observed differences represent factual variation between check-in inputs, not proof of individual causation.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getLatestPrediction,
  getPredictionHistory,
  getExplainability,
  getWhatChanged
};
