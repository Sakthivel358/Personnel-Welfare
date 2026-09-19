/**
 * Test Suite: ML Model Monitoring (Requirement 8)
 * Verifies that the ML Model Monitoring endpoints accurately surface:
 * - Both ML models (Model 1: Wearable + Operational RF, Model 2: PSS-10 Fallback RF)
 * - Model versions, training data types, and synthetic prototype labels
 * - Feature availability schemas (20 features for Model 1, 13 features for Model 2)
 * - Precision, Recall, Macro-F1, Accuracy metrics
 * - 3x3 Confusion matrix
 * - Prediction distribution
 * - Data-quality status
 */

const http = require('http');
const assert = require('assert');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING TEST SUITE: ML Model Monitoring (Requirement 8)');
  console.log('================================================================');

  let passed = 0;
  let total = 0;

  function recordPass(testName) {
    passed++;
    total++;
    console.log(`  ✅ PASS: ${testName}`);
  }

  function recordFail(testName, err) {
    total++;
    console.error(`  ❌ FAIL: ${testName}`, err);
  }

  try {
    const res = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/system/transparency',
      method: 'GET'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data, 'Transparency data payload must be present');
    assert.ok(res.body.data.models, 'Models container must be present');

    const { models } = res.body.data;
    const independence = models.independence || res.body.data.independence;
    assert.ok(models.model1, 'Model 1 must be present');
    assert.ok(models.model2, 'Model 2 must be present');
    recordPass('GET /system/transparency returns dual model payload (model1 & model2)');

    // Test Model 1
    const m1 = models.model1;
    assert.ok(m1.version, 'Model 1 must have version');
    assert.ok(m1.modelName.includes('Model 1') || m1.modelName.includes('Wearable'), 'Model 1 must have descriptive name');
    assert.strictEqual(m1.trainingDataType, 'Synthetic Prototype Training Data');
    assert.strictEqual(m1.datasetType, 'SYNTHETIC_PROTOTYPE_TRAINING_DATA');
    assert.strictEqual(m1.isSyntheticPrototype, true);
    assert.strictEqual(m1.realWorldValidated, false);
    assert.ok(m1.dataQualityStatus.includes('Verified'), 'Model 1 must have data quality status');
    assert.ok(m1.dataQualityStatus.includes('0% missingness'), 'Model 1 data quality must specify 0% missingness');

    // Feature availability for Model 1
    assert.ok(m1.featureAvailability, 'Model 1 feature availability must exist');
    assert.strictEqual(m1.featureAvailability.count, 20);
    assert.strictEqual(m1.featureAvailability.hasSensorColumns, true);
    assert.ok(m1.featureAvailability.features.includes('resting_heart_rate'));
    assert.ok(m1.featureAvailability.features.includes('hrv_ms'));
    assert.ok(m1.featureAvailability.features.includes('skin_temperature_c'));
    assert.ok(m1.featureAvailability.features.includes('respiration_rate'));

    // Metrics for Model 1
    assert.ok(m1.performance, 'Model 1 performance metrics must exist');
    assert.strictEqual(typeof m1.performance.accuracy, 'number');
    assert.strictEqual(typeof m1.performance.precisionMacro, 'number');
    assert.strictEqual(typeof m1.performance.recallMacro, 'number');
    assert.strictEqual(typeof m1.performance.macroF1, 'number');
    assert.ok(m1.performance.accuracy >= 0.70 && m1.performance.accuracy <= 1.0);
    assert.ok(m1.performance.macroF1 >= 0.65 && m1.performance.macroF1 <= 1.0);

    // Confusion Matrix for Model 1
    assert.ok(m1.confusionMatrix, 'Model 1 confusion matrix must exist');
    const cm1 = Array.isArray(m1.confusionMatrix) ? m1.confusionMatrix : m1.confusionMatrix.matrix;
    assert.strictEqual(cm1.length, 3, 'Confusion matrix must have 3 rows');
    assert.strictEqual(cm1[0].length, 3, 'Confusion matrix row 1 must have 3 cols');
    assert.strictEqual(cm1[1].length, 3, 'Confusion matrix row 2 must have 3 cols');
    assert.strictEqual(cm1[2].length, 3, 'Confusion matrix row 3 must have 3 cols');

    // Prediction Distribution for Model 1
    assert.ok(m1.predictionDistribution, 'Model 1 prediction distribution must exist');
    assert.strictEqual(typeof m1.predictionDistribution.LOW, 'number');
    assert.strictEqual(typeof m1.predictionDistribution.MODERATE, 'number');
    assert.strictEqual(typeof m1.predictionDistribution.HIGH, 'number');

    // Disclaimer
    assert.ok(m1.prototypeDisclaimer.includes('PROTOTYPE MODEL'));
    assert.ok(m1.prototypeDisclaimer.includes('DO NOT represent real-world clinical'));
    recordPass('Model 1 verifies all monitoring attributes (version, synthetic label, 20 features with sensors, metrics, 3x3 CM, distribution)');

    // Test Model 2
    const m2 = models.model2;
    assert.ok(m2.version, 'Model 2 must have version');
    assert.ok(m2.modelName.includes('Model 2') || m2.modelName.includes('PSS'), 'Model 2 must have descriptive name');
    assert.strictEqual(m2.trainingDataType, 'Synthetic Prototype Training Data');
    assert.strictEqual(m2.datasetType, 'SYNTHETIC_PROTOTYPE_TRAINING_DATA');
    assert.strictEqual(m2.isSyntheticPrototype, true);
    assert.strictEqual(m2.realWorldValidated, false);
    assert.ok(m2.dataQualityStatus.includes('Verified'), 'Model 2 must have data quality status');

    // Feature availability for Model 2
    assert.ok(m2.featureAvailability, 'Model 2 feature availability must exist');
    assert.strictEqual(m2.featureAvailability.count, 13);
    assert.strictEqual(m2.featureAvailability.hasSensorColumns, false);
    assert.ok(m2.featureAvailability.features.includes('pss_score'));
    assert.ok(!m2.featureAvailability.features.includes('resting_heart_rate'), 'Model 2 must NOT have sensor features');

    // Metrics for Model 2
    assert.ok(m2.performance, 'Model 2 performance metrics must exist');
    assert.strictEqual(typeof m2.performance.accuracy, 'number');
    assert.strictEqual(typeof m2.performance.precisionMacro, 'number');
    assert.strictEqual(typeof m2.performance.recallMacro, 'number');
    assert.strictEqual(typeof m2.performance.macroF1, 'number');
    assert.ok(m2.performance.accuracy >= 0.70 && m2.performance.accuracy <= 1.0);
    assert.ok(m2.performance.macroF1 >= 0.65 && m2.performance.macroF1 <= 1.0);

    // Confusion Matrix for Model 2
    assert.ok(m2.confusionMatrix, 'Model 2 confusion matrix must exist');
    const cm2 = Array.isArray(m2.confusionMatrix) ? m2.confusionMatrix : m2.confusionMatrix.matrix;
    assert.strictEqual(cm2.length, 3, 'Confusion matrix must have 3 rows');
    assert.strictEqual(cm2[0].length, 3, 'Confusion matrix row 1 must have 3 cols');

    // Prediction Distribution for Model 2
    assert.ok(m2.predictionDistribution, 'Model 2 prediction distribution must exist');
    assert.strictEqual(typeof m2.predictionDistribution.LOW, 'number');
    assert.strictEqual(typeof m2.predictionDistribution.MODERATE, 'number');
    assert.strictEqual(typeof m2.predictionDistribution.HIGH, 'number');

    // Disclaimer
    assert.ok(m2.prototypeDisclaimer.includes('PROTOTYPE MODEL'));
    recordPass('Model 2 verifies all monitoring attributes (version, synthetic label, 13 features without sensors, metrics, 3x3 CM, distribution)');

    // Model Independence
    assert.strictEqual(independence.strictly_independent, true);
    assert.strictEqual(independence.model1_features_count, 20);
    assert.strictEqual(independence.model2_features_count, 13);
    assert.strictEqual(independence.sensor_columns_in_model2, false);
    recordPass('Model Independence verification confirms distinct feature schemas and pipelines');

  } catch (err) {
    recordFail('GET /system/transparency validation', err);
  }

  console.log('================================================================');
  console.log(`📊 ML MODEL MONITORING RESULTS: ${passed}/${total} Passed (${Math.round((passed/total)*100)}%)`);
  console.log('================================================================\n');

  if (passed !== total) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
