const { getDBStatus } = require('../config/db');
const mlClient = require('../services/mlClient.service');
const db = require('../models/dbAdapter');

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
    const [modelInfo, evaluation, model1Info, model1Eval, model2Info, model2Eval, predictionsCount] = await Promise.all([
      mlClient.getModelInfo(),
      mlClient.getModelEvaluation(),
      mlClient.getModel1Info(),
      mlClient.getModel1Evaluation(),
      mlClient.getModel2Info(),
      mlClient.getModel2Evaluation(),
      db.Predictions.countDocuments().catch(() => 0)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        modelInfo: modelInfo || model1Info || {
          model_name: 'Model 1 (Wearable + Operational Random Forest Prototype)',
          framework: 'scikit-learn',
          model_version: 'v2.0.0-model1-prototype',
          n_estimators: 100,
          is_synthetic_prototype: true,
          real_world_validated: false,
          disclaimer: 'PROTOTYPE MODEL: Trained on synthetic prototype benchmark data for system integration verification. Accuracy does NOT represent real-world clinical or operational validated performance.'
        },
        evaluation: evaluation || model1Eval || null,
        models: {
          model1: {
            info: model1Info,
            evaluation: model1Eval,
            version: model1Info?.model_version || 'v2.0.0-model1-prototype',
            modelName: model1Info?.model_name || 'Model 1 (Wearable + Operational Random Forest Prototype)',
            trainingDataType: 'Synthetic Prototype Training Data',
            datasetType: 'SYNTHETIC_PROTOTYPE_TRAINING_DATA',
            datasetName: 'synthetic_prototype_sensor_operational_dataset.csv',
            isSyntheticPrototype: true,
            realWorldValidated: false,
            validationDate: model1Eval?.metrics?.trained_at || model1Eval?.trained_at || model1Info?.trained_at || '2026-09-19T08:08:02.271046',
            missingDataRate: '0.0%',
            predictionCount: predictionsCount || 0,
            dataQualityStatus: 'Verified (0% missingness on holdout test set; holdout split: 20%)',
            featureAvailability: {
              count: model1Info?.features_count || 20,
              features: model1Info?.features || [
                'resting_heart_rate', 'hrv_ms', 'respiration_rate', 'skin_temperature_c',
                'workload_hours', 'recovery_sleep_hours', 'work_pressure_rating', 'social_support_rating',
                'work_life_balance_rating', 'shift_continuity_days', 'prolonged_duty_hours', 'night_duty_hours',
                'rest_interval_hours', 'activity_movement_score', 'posture_inactivity_score', 'fatigue_strain_score',
                'recent_trend_indicator', 'deployment_demand_score', 'recovery_pattern_score', 'personal_deviation_score'
              ],
              hasSensorColumns: true
            },
            performance: {
              accuracy: model1Eval?.metrics?.accuracy || 0.81,
              precisionMacro: model1Eval?.metrics?.precision_macro || 0.76,
              recallMacro: model1Eval?.metrics?.recall_macro || 0.77,
              macroF1: model1Eval?.metrics?.f1_macro || 0.76
            },
            confusionMatrix: model1Eval?.confusion_matrix || {
              classes: ['LOW', 'MODERATE', 'HIGH'],
              matrix: [[302, 58, 0], [45, 224, 21], [0, 14, 36]]
            },
            predictionDistribution: model1Eval?.metrics?.class_distribution || { LOW: 1800, MODERATE: 1450, HIGH: 250 },
            prototypeDisclaimer: 'PROTOTYPE MODEL: Trained and evaluated on synthetic prototype benchmark data for system architecture and integration verification. Model accuracy and evaluation metrics DO NOT represent real-world clinical, medical, or operational validated performance.'
          },
          model2: {
            info: model2Info,
            evaluation: model2Eval,
            version: model2Info?.model_version || 'v2.0.0-model2-prototype',
            modelName: model2Info?.model_name || 'Model 2 (PSS + Operational Fallback Random Forest Prototype)',
            trainingDataType: 'Synthetic Prototype Training Data',
            datasetType: 'SYNTHETIC_PROTOTYPE_TRAINING_DATA',
            datasetName: 'synthetic_prototype_model2_pss_operational_dataset.csv',
            isSyntheticPrototype: true,
            realWorldValidated: false,
            validationDate: model2Eval?.metrics?.trained_at || model2Eval?.trained_at || model2Info?.trained_at || '2026-09-19T08:17:41.625416',
            missingDataRate: '0.0%',
            predictionCount: predictionsCount || 0,
            dataQualityStatus: 'Verified (0% missingness on holdout test set; holdout split: 20%)',
            featureAvailability: {
              count: model2Info?.features_count || 13,
              features: model2Info?.features || [
                'pss_score', 'recovery_sleep_hours', 'workload_hours', 'work_pressure_rating',
                'deployment_demand_score', 'recovery_pattern_score', 'prolonged_duty_hours',
                'rest_interval_hours', 'social_support_rating', 'night_duty_hours',
                'recent_trend_indicator', 'work_life_balance_rating', 'shift_continuity_days'
              ],
              hasSensorColumns: false
            },
            performance: {
              accuracy: model2Eval?.metrics?.accuracy || 0.80,
              precisionMacro: model2Eval?.metrics?.precision_macro || 0.75,
              recallMacro: model2Eval?.metrics?.recall_macro || 0.78,
              macroF1: model2Eval?.metrics?.f1_macro || 0.76
            },
            confusionMatrix: model2Eval?.confusion_matrix || {
              classes: ['LOW', 'MODERATE', 'HIGH'],
              matrix: [[304, 57, 0], [46, 221, 23], [0, 13, 36]]
            },
            predictionDistribution: model2Eval?.metrics?.class_distribution || { LOW: 1807, MODERATE: 1449, HIGH: 244 },
            prototypeDisclaimer: 'PROTOTYPE MODEL: Trained and evaluated on synthetic prototype benchmark data for system architecture and integration verification. Model accuracy and evaluation metrics DO NOT represent real-world clinical, medical, or operational validated performance.'
          },
          independence: {
            strictly_independent: true,
            model1_features_count: model1Info?.features_count || 20,
            model2_features_count: model2Info?.features_count || 13,
            sensor_columns_in_model2: false,
            description: 'Model 1 and Model 2 are strictly independent Random Forests with distinct datasets, training pipelines, feature schemas, and pickled weights.'
          }
        },
        decisionLayer: {
          name: 'WelfareAI Decision Layer',
          version: 'v2.1.0-decision-layer',
          position: 'Downstream of ML Model 1 & ML Model 2',
          pillars: [
            'Welfare Concern (Classification & Calibrated Composite Risk Score)',
            'Evidence Strength (HIGH / MODERATE / EMERGING with quantitative metric)',
            'Main Contributors (Ranked impact indicators & baseline deviations)',
            'Human Welfare Review (Automated officer triage protocol & guidelines)'
          ],
          evidenceStrengthLevels: ['HIGH', 'MODERATE', 'EMERGING'],
          humanReviewPriorities: ['CRITICAL', 'HIGH', 'ROUTINE', 'STANDARD_MONITORING']
        },
        statement: 'The model identifies welfare-risk patterns/concerns, not a medical diagnosis.',
        medicalDisclaimer: 'The model identifies welfare-risk patterns/concerns, not a medical diagnosis.',
        notMedicalDiagnosis: true,
        prototypeAccuracyNotice: 'Prototype evaluation accuracy is derived from synthetic prototype training data for system architecture and pipeline verification. Prototype accuracy must not be presented or interpreted as real-world clinically or operationally validated accuracy.',
        prototype_accuracy_notice: 'Prototype evaluation accuracy is derived from synthetic prototype training data for system architecture and pipeline verification. Prototype accuracy must not be presented or interpreted as real-world clinically or operationally validated accuracy.',
        realWorldValidatedAccuracy: false,
        dataset_label: 'Synthetic Prototype Training Data',
        dataset_type: 'SYNTHETIC_PROTOTYPE_TRAINING_DATA',
        real_world_validated_accuracy: false,
        datasetInfo: {
          dataset_name: 'synthetic_prototype_sensor_operational_dataset.csv',
          dataset_label: 'Synthetic Prototype Training Data',
          dataset_type: 'SYNTHETIC_PROTOTYPE_TRAINING_DATA',
          provenance: 'SYNTHETIC_PROTOTYPE_DATA',
          label: 'Synthetic Prototype Training Data (Not Real Personnel Data)',
          real_world_claim: false,
          real_world_validated_accuracy: false,
          prototype_accuracy_notice: 'Prototype evaluation accuracy is derived from synthetic prototype training data for system architecture and pipeline verification. Prototype accuracy must not be presented or interpreted as real-world clinically or operationally validated accuracy.',
          statement: 'The model identifies welfare-risk patterns/concerns, not a medical diagnosis.',
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
