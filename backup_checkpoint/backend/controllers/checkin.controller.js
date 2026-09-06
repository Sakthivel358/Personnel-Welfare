const db = require('../models/dbAdapter');
const mlClient = require('../services/mlClient.service');
const recommendationService = require('../services/recommendation.service');
const auditService = require('../services/audit.service');

const submitCheckIn = async (req, res, next) => {
  try {
    const {
      pss_score,
      pss_responses,
      workload_hours,
      work_pressure_rating,
      recovery_sleep_hours,
      social_support_rating,
      work_life_balance_rating,
      shift_continuity_days,
      notes
    } = req.body;

    // Field-level numeric validations
    if (pss_score === undefined || pss_score < 0 || pss_score > 40) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PSS score. Must be between 0 and 40.'
      });
    }
    if (!workload_hours || workload_hours < 20 || workload_hours > 120) {
      return res.status(400).json({
        success: false,
        message: 'Weekly workload hours must be between 20 and 120 hours.'
      });
    }
    if (!work_pressure_rating || work_pressure_rating < 1 || work_pressure_rating > 10) {
      return res.status(400).json({
        success: false,
        message: 'Work pressure rating must be between 1 and 10.'
      });
    }
    if (!recovery_sleep_hours || recovery_sleep_hours < 2 || recovery_sleep_hours > 14) {
      return res.status(400).json({
        success: false,
        message: 'Daily sleep and recovery hours must be between 2 and 14 hours.'
      });
    }
    if (!social_support_rating || social_support_rating < 1 || social_support_rating > 10) {
      return res.status(400).json({
        success: false,
        message: 'Social support rating must be between 1 and 10.'
      });
    }
    if (!work_life_balance_rating || work_life_balance_rating < 1 || work_life_balance_rating > 10) {
      return res.status(400).json({
        success: false,
        message: 'Work-life balance rating must be between 1 and 10.'
      });
    }

    // Determine recent trend delta from prior check-in
    const priorCheckIns = await db.CheckIns.find({ userId: req.user._id });
    let recent_trend_indicator = 0.0;
    if (priorCheckIns.length > 0) {
      const lastCheckIn = priorCheckIns[priorCheckIns.length - 1];
      const pssDelta = Number(pss_score) - Number(lastCheckIn.pss_score || 18);
      const pressureDelta = Number(work_pressure_rating) - Number(lastCheckIn.work_pressure_rating || 5);
      recent_trend_indicator = Math.min(5, Math.max(-5, (pssDelta / 4.0) + (pressureDelta * 0.5)));
    }

    const checkInPayload = {
      pss_score: Number(pss_score),
      workload_hours: Number(workload_hours),
      work_pressure_rating: Number(work_pressure_rating),
      recovery_sleep_hours: Number(recovery_sleep_hours),
      social_support_rating: Number(social_support_rating),
      work_life_balance_rating: Number(work_life_balance_rating),
      shift_continuity_days: shift_continuity_days !== undefined ? Number(shift_continuity_days) : 0,
      recent_trend_indicator: Number(recent_trend_indicator.toFixed(1))
    };

    // 1. Call real Random Forest via FastAPI ML Service
    const mlPrediction = await mlClient.predictWelfareRisk(checkInPayload);

    // 2. Persist CheckIn Record in MongoDB / Datastore
    const newCheckIn = await db.CheckIns.create({
      userId: req.user._id,
      personnelId: req.user.personnelId,
      pss_score: checkInPayload.pss_score,
      pss_responses: pss_responses || [],
      workload_hours: checkInPayload.workload_hours,
      work_pressure_rating: checkInPayload.work_pressure_rating,
      recovery_sleep_hours: checkInPayload.recovery_sleep_hours,
      social_support_rating: checkInPayload.social_support_rating,
      work_life_balance_rating: checkInPayload.work_life_balance_rating,
      shift_continuity_days: checkInPayload.shift_continuity_days,
      recent_trend_indicator: checkInPayload.recent_trend_indicator,
      notes: notes || '',
      checkInDate: new Date().toISOString()
    });

    // 3. Persist StressPrediction Record
    const newPrediction = await db.Predictions.create({
      userId: req.user._id,
      checkInId: newCheckIn._id,
      concernLevel: mlPrediction.concernLevel,
      confidence: mlPrediction.confidence,
      compositeRiskScore: mlPrediction.compositeRiskScore,
      probabilities: mlPrediction.probabilities,
      topDrivers: mlPrediction.topDrivers,
      contributingFactors: mlPrediction.contributingFactors,
      modelVersion: mlPrediction.modelVersion,
      analyzedAt: mlPrediction.analyzedAt,
      isAlertGenerated: mlPrediction.concernLevel === 'HIGH' || mlPrediction.compositeRiskScore >= 65
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

    // 5. Generate Welfare Alert if signal is elevated
    let alertCreated = false;
    if (newPrediction.isAlertGenerated) {
      alertCreated = true;
      const newAlert = await db.Alerts.create({
        personnelId: req.user.personnelId,
        userId: req.user._id,
        predictionId: newPrediction._id,
        priority: mlPrediction.compositeRiskScore >= 80 ? 'CRITICAL' : 'HIGH',
        concernLevel: mlPrediction.concernLevel,
        compositeRiskScore: mlPrediction.compositeRiskScore,
        topDrivers: mlPrediction.topDrivers,
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
      if (mlPrediction.compositeRiskScore < (activeFollowUp.initialRiskScore - 8)) {
        delta = 'IMPROVED';
      } else if (mlPrediction.compositeRiskScore > (activeFollowUp.initialRiskScore + 8)) {
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

module.exports = { submitCheckIn, getCheckInHistory, getCheckInById };
