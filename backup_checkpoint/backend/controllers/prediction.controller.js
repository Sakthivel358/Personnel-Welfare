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

module.exports = { getLatestPrediction, getPredictionHistory, getExplainability };
