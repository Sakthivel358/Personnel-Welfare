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
        _id: p._id,
        checkInId: p.checkInId || relatedCheckIn._id,
        checkInIndex: index + 1,
        date: p.analyzedAt || p.createdAt || relatedCheckIn.createdAt || relatedCheckIn.checkInDate,
        concernLevel: p.concernLevel,
        compositeRiskScore: p.compositeRiskScore != null ? Number(p.compositeRiskScore) : 0,
        confidence: p.confidence,
        evidenceSources: p.evidenceSources || relatedCheckIn.evidenceSources || ['DUTY', 'WORKLOAD', 'REST_RECOVERY'],
        evidenceCount: p.evidenceCount || (relatedCheckIn.evidenceSources ? relatedCheckIn.evidenceSources.length : 3),
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
        evidenceSources: latest.evidenceSources || ['DUTY', 'WORKLOAD', 'REST_RECOVERY'],
        evidenceCount: latest.evidenceCount || (latest.evidenceSources ? latest.evidenceSources.length : 3),
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

// "What Changed?" Comparison between current and selected (or immediately preceding) check-in
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

    // Tasks 13 & 14: Calculate user's personal historical baseline (across prior check-ins, or all check-ins)
    const priorCheckIns = checkIns.slice(0, checkIns.length - 1);
    const baselineSource = priorCheckIns.length > 0 ? priorCheckIns : checkIns;

    const bWorkloads = baselineSource.map(c => Number(c.workload_hours)).filter(v => !isNaN(v) && v > 0);
    const bSleeps = baselineSource.map(c => Number(c.recovery_sleep_hours)).filter(v => !isNaN(v) && v > 0);
    const bPressures = baselineSource.map(c => Number(c.work_pressure_rating)).filter(v => !isNaN(v) && v > 0);
    const bIntervals = baselineSource.map(c => Number(c.rest_interval_hours)).filter(v => !isNaN(v) && v > 0);
    const bShifts = baselineSource.map(c => Number(c.shift_continuity_days)).filter(v => !isNaN(v));

    const calcArrAvg = arr => arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;

    const avgWorkload = calcArrAvg(bWorkloads);
    const avgSleep = calcArrAvg(bSleeps);
    const avgPressure = calcArrAvg(bPressures);
    const avgRestInterval = calcArrAvg(bIntervals);
    const avgShifts = calcArrAvg(bShifts);

    const currentWorkload = currentCheckIn.workload_hours != null ? Number(currentCheckIn.workload_hours) : null;
    const currentSleep = currentCheckIn.recovery_sleep_hours != null ? Number(currentCheckIn.recovery_sleep_hours) : null;
    const currentPressure = currentCheckIn.work_pressure_rating != null ? Number(currentCheckIn.work_pressure_rating) : null;

    const workloadDeltaFromPersonal = (currentWorkload != null && avgWorkload != null)
      ? Number((currentWorkload - avgWorkload).toFixed(1))
      : 0;

    const sleepDeltaFromPersonal = (currentSleep != null && avgSleep != null)
      ? Number((currentSleep - avgSleep).toFixed(1))
      : 0;

    const pressureDeltaFromPersonal = (currentPressure != null && avgPressure != null)
      ? Number((currentPressure - avgPressure).toFixed(1))
      : 0;

    let personalWorkloadStatus = 'AT_PERSONAL_NORMAL';
    if (workloadDeltaFromPersonal > 4.0) personalWorkloadStatus = 'ELEVATED_ABOVE_NORMAL';
    else if (workloadDeltaFromPersonal < -4.0) personalWorkloadStatus = 'BELOW_NORMAL';

    let personalSleepStatus = 'AT_PERSONAL_NORMAL';
    if (sleepDeltaFromPersonal < -1.0) personalSleepStatus = 'REST_DEFICIT';
    else if (sleepDeltaFromPersonal > 1.0) personalSleepStatus = 'REST_SURPLUS';

    const personalBaseline = {
      baselineCheckInCount: baselineSource.length,
      totalCheckInCount: checkIns.length,
      avgWorkloadHours: avgWorkload,
      avgRecoverySleepHours: avgSleep,
      avgWorkPressure: avgPressure,
      avgRestIntervalHours: avgRestInterval,
      avgShiftContinuityDays: avgShifts,
      comparison: {
        workloadDelta: workloadDeltaFromPersonal,
        workloadStatus: personalWorkloadStatus,
        workloadLabel: workloadDeltaFromPersonal > 0 
          ? `+${workloadDeltaFromPersonal} hrs/wk above your normal pattern (${avgWorkload} hrs/wk avg)`
          : workloadDeltaFromPersonal < 0
          ? `${workloadDeltaFromPersonal} hrs/wk below your normal pattern (${avgWorkload} hrs/wk avg)`
          : `Aligned with your normal pattern (${avgWorkload} hrs/wk avg)`,
        sleepDelta: sleepDeltaFromPersonal,
        sleepStatus: personalSleepStatus,
        sleepLabel: sleepDeltaFromPersonal < 0
          ? `${sleepDeltaFromPersonal} hrs/day below your normal rest (${avgSleep} hrs/day avg)`
          : sleepDeltaFromPersonal > 0
          ? `+${sleepDeltaFromPersonal} hrs/day above your normal rest (${avgSleep} hrs/day avg)`
          : `Aligned with your normal rest pattern (${avgSleep} hrs/day avg)`,
        pressureDelta: pressureDeltaFromPersonal
      }
    };

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
        personalBaselineAvg: avgWorkload,
        deltaFromPersonalBaseline: workloadDeltaFromPersonal,
        ...calcDelta(currentCheckIn.workload_hours, previousCheckIn.workload_hours, true)
      },
      recovery_sleep_hours: {
        title: 'Daily Sleep & Recovery',
        unit: 'hrs/day',
        personalBaselineAvg: avgSleep,
        deltaFromPersonalBaseline: sleepDeltaFromPersonal,
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
      availableCheckIns,
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
