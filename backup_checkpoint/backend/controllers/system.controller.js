const { getDBStatus } = require('../config/db');
const mlClient = require('../services/mlClient.service');

const getSystemHealth = async (req, res, next) => {
  try {
    const dbStatus = getDBStatus();
    const mlHealth = await mlClient.checkHealth();

    const isAllHealthy = dbStatus.isConnected && mlHealth.isAvailable;

    return res.status(200).json({
      success: true,
      status: isAllHealthy ? 'OPERATIONAL' : 'DEGRADED',
      components: {
        backend: {
          status: 'UP',
          uptime: process.uptime(),
          version: '1.4.0'
        },
        database: dbStatus,
        mlMicroservice: mlHealth
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};

const getModelTransparency = async (req, res, next) => {
  try {
    const [modelInfo, evaluation] = await Promise.all([
      mlClient.getModelInfo(),
      mlClient.getModelEvaluation()
    ]);

    return res.status(200).json({
      success: true,
      data: {
        modelInfo: modelInfo || {
          model_name: 'Random Forest Classifier',
          framework: 'scikit-learn',
          model_version: 'v1.4.0-sih26186',
          n_estimators: 60,
          disclaimer: 'DEMO / SYNTHETIC DATA — Decision-support model.'
        },
        evaluation: evaluation || {
          metrics: {
            accuracy: 0.815,
            precision_macro: 0.5488,
            recall_macro: 0.5471,
            f1_macro: 0.5480
          }
        },
        pipeline: {
          step1: 'Personnel Check-In Form (Front-end)',
          step2: 'Data Validation & Normalization (Node.js/Express)',
          step3: 'Inference Request to FastAPI (port 8000)',
          step4: 'StandardScaler Transformation & RandomForest Classifier',
          step5: 'Feature Baseline Attribution & Explainability',
          step6: 'Contextual Welfare Recommendation Engine',
          step7: 'Human-in-the-loop Alert Routing to Welfare Officer',
          step8: 'Follow-up Tracking & Longitudinal Trend Analysis'
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSystemHealth, getModelTransparency };
