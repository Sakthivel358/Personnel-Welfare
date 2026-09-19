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
          model_name: 'Model 1 (Wearable + Operational Random Forest Prototype)',
          framework: 'scikit-learn',
          model_version: 'v2.0.0-model1-prototype',
          n_estimators: 100,
          is_synthetic_prototype: true,
          real_world_validated: false,
          disclaimer: 'PROTOTYPE MODEL: Trained on synthetic prototype benchmark data for system integration verification. Accuracy does NOT represent real-world clinical or operational validated performance.'
        },
        evaluation: evaluation || null,
        datasetInfo: {
          dataset_name: 'synthetic_prototype_sensor_operational_dataset.csv',
          provenance: 'SYNTHETIC_PROTOTYPE_DATA',
          label: 'DEMO / SYNTHETIC DATA — NOT REAL PERSONNEL OR SENSOR DATA',
          real_world_claim: false,
          disclaimer: 'Trained on clearly labelled synthetic prototype benchmark data. Accuracy metrics reflect synthetic prototype validation and do NOT represent real-world clinical or operational validated performance.'
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
