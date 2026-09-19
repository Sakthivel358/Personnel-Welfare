const db = require('../models/dbAdapter');
const mlClient = require('../services/mlClient.service');
const recommendationService = require('../services/recommendation.service');
const auditService = require('../services/audit.service');

const submitCheckIn = async (req, res, next) => {
  try {
    const {
      // Source 4: Optional Self-check
      pss_score,
      pss_responses,
      social_support_rating,
      notes,
      // Source 2: Operational Workload
      workload_hours,
      work_pressure_rating,
      // Source 3: Rest & Recovery Patterns
      recovery_sleep_hours,
      work_life_balance_rating,
      recovery_pattern,
      rest_interval_hours,
      // Source 1: Duty Exposure
      shift_continuity_days,
      prolonged_duty_hours,
      night_duty_hours,
      duty_type,
      // Source 5: Smart Jacket & Wearable Biometric Telemetry (Optional)
      resting_heart_rate,
      hrv_ms,
      respiration_rate,
      skin_temperature_c,
      activity_movement,
      posture_inactivity,
      fatigue_physical_strain,
      wearable_synced,
      // Idempotency & Offline Sync
      idempotencyKey
    } = req.body;

    // Idempotency check: prevent duplicate check-ins and duplicate ML predictions
    if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim()) {
      const cleanKey = String(idempotencyKey).trim();
      const existingCheckIn = await db.CheckIns.findOne({
        userId: req.user._id,
        idempotencyKey: cleanKey
      });

      if (existingCheckIn) {
        const existingPred = existingCheckIn.predictionId 
          ? await db.Predictions.findById(existingCheckIn.predictionId) 
          : await db.Predictions.findOne({ checkInId: existingCheckIn._id });
        const existingRec = existingPred 
          ? await db.Recommendations.findOne({ predictionId: existingPred._id }) 
          : null;

        return res.status(200).json({
          success: true,
          isDuplicate: true,
          message: 'Check-in already synchronized (idempotent duplicate prevented).',
          data: {
            checkIn: existingCheckIn,
            prediction: existingPred,
            evidenceSources: existingCheckIn.evidenceSources || ['DUTY', 'WORKLOAD', 'REST_RECOVERY'],
            evidenceCount: existingCheckIn.evidenceCount || 3,
            recommendations: existingRec,
            alertGenerated: false
          }
        });
      }
    }


    // Field-level numeric validations (PSS-10 is optional)
    if (pss_score !== undefined && pss_score !== null) {
      const numPss = Number(pss_score);
      if (isNaN(numPss) || numPss < 0 || numPss > 40) {
        return res.status(400).json({
          success: false,
          message: 'Invalid PSS score. Must be between 0 and 40.'
        });
      }
    }

    const cleanWorkload = workload_hours !== undefined ? Number(workload_hours) : 48;
    if (cleanWorkload < 20 || cleanWorkload > 120) {
      return res.status(400).json({
        success: false,
        message: 'Weekly workload hours must be between 20 and 120 hours.'
      });
    }

    const cleanPressure = work_pressure_rating !== undefined ? Number(work_pressure_rating) : 5;
    if (cleanPressure < 1 || cleanPressure > 10) {
      return res.status(400).json({
        success: false,
        message: 'Work pressure rating must be between 1 and 10.'
      });
    }

    const cleanSleep = recovery_sleep_hours !== undefined ? Number(recovery_sleep_hours) : 7.0;
    if (cleanSleep < 2 || cleanSleep > 14) {
      return res.status(400).json({
        success: false,
        message: 'Daily sleep and recovery hours must be between 2 and 14 hours.'
      });
    }

    const cleanSupport = social_support_rating !== undefined ? Number(social_support_rating) : 6;
    const cleanWlb = work_life_balance_rating !== undefined ? Number(work_life_balance_rating) : 6;
    const cleanShifts = shift_continuity_days !== undefined ? Number(shift_continuity_days) : 0;
    const cleanProlonged = prolonged_duty_hours !== undefined ? Number(prolonged_duty_hours) : 0;
    const cleanNight = night_duty_hours !== undefined ? Number(night_duty_hours) : 0;

    // Determine recent trend delta from prior check-in
    const priorCheckIns = await db.CheckIns.find({ userId: req.user._id });
    let recent_trend_indicator = 0.0;
    if (priorCheckIns.length > 0) {
      const lastCheckIn = priorCheckIns[priorCheckIns.length - 1];
      const prevPressure = (lastCheckIn.work_pressure_rating !== undefined && lastCheckIn.work_pressure_rating !== null) ? Number(lastCheckIn.work_pressure_rating) : cleanPressure;
      const pressureDelta = cleanPressure - prevPressure;

      if (pss_score !== undefined && pss_score !== null && lastCheckIn.pss_score !== undefined && lastCheckIn.pss_score !== null) {
        const pssDelta = Number(pss_score) - Number(lastCheckIn.pss_score);
        recent_trend_indicator = Math.min(5, Math.max(-5, (pssDelta / 4.0) + (pressureDelta * 0.5)));
      } else {
        const prevWorkload = lastCheckIn.workload_hours ? Number(lastCheckIn.workload_hours) : cleanWorkload;
        const workloadDelta = cleanWorkload - prevWorkload;
        recent_trend_indicator = Math.min(5, Math.max(-5, (pressureDelta * 0.7) + (workloadDelta / 15.0)));
      }
    }

    // Tasks 13 & 14: Historical Personal Workload & Rest/Recovery Baselines
    let personal_avg_workload = cleanWorkload;
    let personal_avg_sleep = cleanSleep;
    let personal_workload_delta = 0.0;
    let personal_sleep_delta = 0.0;

    if (priorCheckIns.length > 0) {
      const priorWorkloads = priorCheckIns.map(c => Number(c.workload_hours)).filter(v => !isNaN(v) && v > 0);
      if (priorWorkloads.length > 0) {
        personal_avg_workload = Number((priorWorkloads.reduce((a, b) => a + b, 0) / priorWorkloads.length).toFixed(1));
        personal_workload_delta = Number((cleanWorkload - personal_avg_workload).toFixed(1));
      }

      const priorSleeps = priorCheckIns.map(c => Number(c.recovery_sleep_hours)).filter(v => !isNaN(v) && v > 0);
      if (priorSleeps.length > 0) {
        personal_avg_sleep = Number((priorSleeps.reduce((a, b) => a + b, 0) / priorSleeps.length).toFixed(1));
        personal_sleep_delta = Number((cleanSleep - personal_avg_sleep).toFixed(1));
      }
    }

    // Determine active evidence sources
    const evidenceSources = ['DUTY', 'WORKLOAD', 'REST_RECOVERY'];
    const hasSelfCheck = pss_score !== undefined && pss_score !== null;
    if (hasSelfCheck) evidenceSources.push('SELF_CHECK');

    const hasWearable = Boolean(
      wearable_synced ||
      resting_heart_rate != null ||
      hrv_ms != null ||
      respiration_rate != null ||
      skin_temperature_c != null ||
      fatigue_physical_strain != null
    );
    if (hasWearable) evidenceSources.push('WEARABLE');

    // Enrich Duty context with personnel service posting baseline
    const personnelProfile = await db.Personnel.findOne({
      $or: [
        { userId: req.user._id },
        { personnelId: req.user.personnelId }
      ]
    });

    const activeDutyType = duty_type || (personnelProfile && personnelProfile.primaryDuty) || 'Patrol & Active Security';
    const activePostingType = (personnelProfile && personnelProfile.postingType) || 'Field Operations';
    const activeDeploymentZone = (personnelProfile && personnelProfile.deploymentZone) || 'Standard Field Deployment';

    const checkInPayload = {
      pss_score: hasSelfCheck ? Number(pss_score) : null,
      workload_hours: cleanWorkload,
      work_pressure_rating: cleanPressure,
      recovery_sleep_hours: cleanSleep,
      social_support_rating: cleanSupport,
      work_life_balance_rating: cleanWlb,
      shift_continuity_days: cleanShifts,
      prolonged_duty_hours: cleanProlonged,
      night_duty_hours: cleanNight,
      duty_type: activeDutyType,
      postingType: activePostingType,
      deploymentZone: activeDeploymentZone,
      recovery_pattern: recovery_pattern || 'CONTINUOUS',
      rest_interval_hours: rest_interval_hours !== undefined ? Number(rest_interval_hours) : 8.0,
      recent_trend_indicator: Number(recent_trend_indicator.toFixed(1)),
      personal_avg_workload: personal_avg_workload,
      personal_workload_delta: personal_workload_delta,
      personal_avg_sleep: personal_avg_sleep,
      personal_sleep_delta: personal_sleep_delta,
      resting_heart_rate: resting_heart_rate != null ? Number(resting_heart_rate) : null,
      hrv_ms: hrv_ms != null ? Number(hrv_ms) : null,
      respiration_rate: respiration_rate != null ? Number(respiration_rate) : null,
      skin_temperature_c: skin_temperature_c != null ? Number(skin_temperature_c) : null,
      activity_movement: activity_movement || 'NORMAL',
      posture_inactivity: posture_inactivity || 'STANDING_VIGILANCE',
      fatigue_physical_strain: fatigue_physical_strain != null ? Number(fatigue_physical_strain) : null,
      wearable_synced: Boolean(wearable_synced || hasWearable),
      evidence_sources: evidenceSources
    };

    // 1. Call real Random Forest via FastAPI ML Service
    const mlPrediction = await mlClient.predictWelfareRisk(checkInPayload);

    // 2. Persist CheckIn Record in MongoDB / Datastore
    const newCheckIn = await db.CheckIns.create({
      userId: req.user._id,
      personnelId: req.user.personnelId,
      idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : `chk-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      pss_score: checkInPayload.pss_score,

      pss_responses: pss_responses || [],
      workload_hours: checkInPayload.workload_hours,
      work_pressure_rating: checkInPayload.work_pressure_rating,
      recovery_sleep_hours: checkInPayload.recovery_sleep_hours,
      social_support_rating: checkInPayload.social_support_rating,
      work_life_balance_rating: checkInPayload.work_life_balance_rating,
      shift_continuity_days: checkInPayload.shift_continuity_days,
      prolonged_duty_hours: checkInPayload.prolonged_duty_hours,
      night_duty_hours: checkInPayload.night_duty_hours,
      duty_type: checkInPayload.duty_type,
      postingType: checkInPayload.postingType,
      deploymentZone: checkInPayload.deploymentZone,
      recovery_pattern: checkInPayload.recovery_pattern,
      rest_interval_hours: checkInPayload.rest_interval_hours,
      recent_trend_indicator: checkInPayload.recent_trend_indicator,
      personal_avg_workload: checkInPayload.personal_avg_workload,
      personal_workload_delta: checkInPayload.personal_workload_delta,
      personal_avg_sleep: checkInPayload.personal_avg_sleep,
      personal_sleep_delta: checkInPayload.personal_sleep_delta,
      resting_heart_rate: checkInPayload.resting_heart_rate,
      hrv_ms: checkInPayload.hrv_ms,
      respiration_rate: checkInPayload.respiration_rate,
      skin_temperature_c: checkInPayload.skin_temperature_c,
      activity_movement: checkInPayload.activity_movement,
      posture_inactivity: checkInPayload.posture_inactivity,
      fatigue_physical_strain: checkInPayload.fatigue_physical_strain,
      wearable_synced: checkInPayload.wearable_synced,
      evidenceSources,
      evidenceCount: evidenceSources.length,
      notes: notes || '',
      checkInDate: new Date().toISOString()
    });

    // 3. Persist StressPrediction Record
    const decisionLayer = mlPrediction.decisionLayer || null;
    const humanReview = decisionLayer ? decisionLayer.humanWelfareReview : null;
    const isAlertGenerated = humanReview ? humanReview.requiresHumanReview : (mlPrediction.concernLevel === 'HIGH' || mlPrediction.compositeRiskScore >= 65);

    const newPrediction = await db.Predictions.create({
      userId: req.user._id,
      checkInId: newCheckIn._id,
      concernLevel: mlPrediction.concernLevel,
      confidence: mlPrediction.confidence,
      compositeRiskScore: mlPrediction.compositeRiskScore,
      probabilities: mlPrediction.probabilities,
      evidenceSources: mlPrediction.evidenceSources || evidenceSources,
      evidenceCount: (mlPrediction.evidenceSources || evidenceSources).length,
      evidenceStrength: decisionLayer ? decisionLayer.evidenceStrength.level : (mlPrediction.evidenceStrength || 'MODERATE'),
      evidenceStrengthScore: decisionLayer ? decisionLayer.evidenceStrength.score : (mlPrediction.evidenceStrengthScore || 0.6),
      decisionLayer: decisionLayer,
      topDrivers: mlPrediction.topDrivers,
      contributingFactors: mlPrediction.contributingFactors,
      modelUsed: mlPrediction.modelUsed || 'MODEL_1_WEARABLE_OPERATIONAL',
      modelVersion: mlPrediction.modelVersion,
      analyzedAt: mlPrediction.analyzedAt,
      isAlertGenerated: isAlertGenerated,
      requiresHumanReview: isAlertGenerated,
      humanReviewPriority: humanReview ? humanReview.priority : (mlPrediction.compositeRiskScore >= 80 ? 'CRITICAL' : 'HIGH')
    });

    // Link prediction ID back to check-in
    await db.CheckIns.findByIdAndUpdate(newCheckIn._id, { predictionId: newPrediction._id });

    // 4. Generate & Persist Recommendations
    const recData = recommendationService.generateRecommendations(mlPrediction, checkInPayload);
    const newRecommendation = await db.Recommendations.create({
      userId: req.user._id,
      predictionId: newPrediction._id,
      concernLevel: recData.concernLevel,
      primaryAction: recData.primaryAction,
      compositeRiskScore: recData.compositeRiskScore,
      actionItems: recData.actionItems,
      welfareResourceSuggestions: recData.welfareResourceSuggestions
    });

    // 5. Generate Welfare Alert if signal is elevated or Human Review required
    let alertCreated = false;
    if (newPrediction.isAlertGenerated) {
      alertCreated = true;
      const alertPriority = humanReview ? humanReview.priority : (mlPrediction.compositeRiskScore >= 80 ? 'CRITICAL' : 'HIGH');
      const newAlert = await db.Alerts.create({
        personnelId: req.user.personnelId,
        userId: req.user._id,
        predictionId: newPrediction._id,
        priority: alertPriority,
        concernLevel: mlPrediction.concernLevel,
        compositeRiskScore: mlPrediction.compositeRiskScore,
        topDrivers: mlPrediction.topDrivers,
        evidenceStrength: decisionLayer ? decisionLayer.evidenceStrength.level : 'MODERATE',
        evidenceStrengthScore: decisionLayer ? decisionLayer.evidenceStrength.score : 0.6,
        mainContributors: decisionLayer ? decisionLayer.mainContributors.slice(0, 5) : [],
        reviewTriggers: humanReview ? humanReview.reviewTriggers : (mlPrediction.topDrivers || []),
        recommendedOfficerAction: humanReview ? humanReview.recommendedOfficerAction : 'Conduct supportive welfare review and verify restorative downtime.',
        status: 'PENDING_REVIEW',
        officerNotes: '',
        createdAt: new Date().toISOString()
      });

      // Notification for personnel
      await db.Notifications.create({
        userId: req.user._id,
        title: 'Welfare Decision-Support Notice',
        message: `Your check-in indicated elevated welfare strain (${mlPrediction.topDrivers.join(', ')}). Support resources are available in the Welfare tab.`,
        type: 'ALERT',
        link: '/why-risk-high.html',
        isRead: false
      });
    } else {
      // Regular confirmation notification
      await db.Notifications.create({
        userId: req.user._id,
        title: 'Check-in Recorded Successfully',
        message: `Your welfare check-in was processed. Signal: ${mlPrediction.concernLevel} concern level.`,
        type: 'CHECKIN_REMINDER',
        link: '/ai-analysis.html',
        isRead: false
      });
    }

    // 6. Check if user has an active follow-up assigned to update re-analysis
    const activeFollowUp = await db.FollowUps.findOne({
      userId: req.user._id,
      status: { $in: ['SCHEDULED', 'IN_PROGRESS'] }
    });

    if (activeFollowUp) {
      let delta = 'STABLE';
      const initialScore = activeFollowUp.initialRiskScore != null ? Number(activeFollowUp.initialRiskScore) : mlPrediction.compositeRiskScore;
      if (mlPrediction.compositeRiskScore < (initialScore - 8)) {
        delta = 'IMPROVED';
      } else if (mlPrediction.compositeRiskScore > (initialScore + 8)) {
        delta = 'INCREASED';
      }

      await db.FollowUps.findByIdAndUpdate(activeFollowUp._id, {
        reAnalyzedRiskScore: mlPrediction.compositeRiskScore,
        welfareDelta: delta,
        status: 'CHECKIN_COMPLETED',
        completedAt: new Date().toISOString()
      });
    }

    // 7. Audit log
    await auditService.log({
      action: 'CHECKIN_SUBMITTED',
      userId: req.user._id,
      personnelId: req.user.personnelId,
      targetResource: 'CheckIns',
      ipAddress: req.ip,
      details: {
        concernLevel: mlPrediction.concernLevel,
        compositeRiskScore: mlPrediction.compositeRiskScore,
        modelVersion: mlPrediction.modelVersion
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Check-in successfully processed by Random Forest model.',
      data: {
        checkIn: newCheckIn,
        prediction: newPrediction,
        decisionLayer: newPrediction.decisionLayer || mlPrediction.decisionLayer || null,
        evidenceSources: newPrediction.evidenceSources || evidenceSources,
        evidenceCount: newPrediction.evidenceCount || evidenceSources.length,
        evidenceStrength: newPrediction.evidenceStrength,
        recommendations: newRecommendation,
        alertGenerated: alertCreated
      }
    });

  } catch (err) {
    next(err);
  }
};

const getCheckInHistory = async (req, res, next) => {
  try {
    const checkIns = await db.CheckIns.find({ userId: req.user._id });
    const predictions = await db.Predictions.find({ userId: req.user._id });

    const predMap = {};
    predictions.forEach(p => {
      predMap[String(p._id)] = p;
      if (p.checkInId) predMap[String(p.checkInId)] = p;
    });

    const combined = checkIns.map(c => ({
      ...c,
      prediction: predMap[String(c.predictionId)] || predMap[String(c._id)] || null
    }));

    return res.status(200).json({
      success: true,
      data: combined
    });
  } catch (err) {
    next(err);
  }
};

const getCheckInById = async (req, res, next) => {
  try {
    const checkIn = await db.CheckIns.findById(req.params.id);
    if (!checkIn) {
      return res.status(404).json({ success: false, message: 'Check-in record not found.' });
    }

    if (String(checkIn.userId) !== String(req.user._id) && req.user.role === 'PERSONNEL') {
      return res.status(403).json({ success: false, message: 'Unauthorized access to check-in record.' });
    }

    const prediction = await db.Predictions.findOne({ checkInId: checkIn._id });
    const recommendations = prediction ? await db.Recommendations.findOne({ predictionId: prediction._id }) : null;

    return res.status(200).json({
      success: true,
      data: {
        checkIn,
        prediction,
        recommendations
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Synchronize a batch of offline-buffered check-in records.
 * Ensures deduplication by idempotencyKey to prevent duplicate records or ML predictions.
 */
const syncCheckInsBatch = async (req, res, next) => {
  try {
    const rawItems = Array.isArray(req.body) ? req.body : (req.body.items || []);

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No check-in items provided for batch synchronization.'
      });
    }

    const synced = [];
    const duplicates = [];
    const errors = [];

    // Cache existing keys for this user
    const existingCheckIns = await db.CheckIns.find({ userId: req.user._id });
    const existingKeySet = new Set(existingCheckIns.map(c => c.idempotencyKey).filter(Boolean));

    for (const item of rawItems) {
      try {
        const itemKey = item.idempotencyKey ? String(item.idempotencyKey).trim() : null;

        if (itemKey && existingKeySet.has(itemKey)) {
          const existing = existingCheckIns.find(c => c.idempotencyKey === itemKey);
          duplicates.push({
            idempotencyKey: itemKey,
            checkInId: existing ? existing._id : null,
            message: 'Check-in already synchronized (duplicate prevented).'
          });
          continue;
        }

        if (itemKey) {
          existingKeySet.add(itemKey);
        }

        // Simulate request to submitCheckIn logic
        const fakeReq = {
          body: item,
          user: req.user,
          ip: req.ip
        };

        // We can invoke the internal processing by constructing a mock res
        let capturedData = null;
        const fakeRes = {
          status: () => fakeRes,
          json: (payload) => { capturedData = payload; return fakeRes; }
        };

        await submitCheckIn(fakeReq, fakeRes, (err) => {
          if (err) throw err;
        });

        if (capturedData && capturedData.success) {
          if (capturedData.isDuplicate) {
            duplicates.push({
              idempotencyKey: itemKey,
              message: 'Check-in was recognized as existing duplicate.'
            });
          } else {
            synced.push({
              idempotencyKey: itemKey,
              checkIn: capturedData.data.checkIn,
              prediction: capturedData.data.prediction
            });
          }
        } else {
          errors.push({ item, error: capturedData ? capturedData.message : 'Unknown processing error' });
        }
      } catch (itemErr) {
        errors.push({ item, error: itemErr.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Batch synchronization completed: ${synced.length} synced, ${duplicates.length} duplicate(s) prevented, ${errors.length} failed.`,
      syncedCount: synced.length,
      duplicateCount: duplicates.length,
      errorCount: errors.length,
      synced,
      duplicates,
      errors
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { submitCheckIn, syncCheckInsBatch, getCheckInHistory, getCheckInById };

