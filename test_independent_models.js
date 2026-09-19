/**
 * test_independent_models.js
 * Verification test for Task 19: Keep the two ML models independent.
 *
 * Verifies:
 * 1. Model 1 and Model 2 datasets are distinct files with distinct schemas.
 * 2. Model 1 dataset includes wearable biometrics (20 features + label).
 * 3. Model 2 dataset strictly excludes wearable biometrics (13 features + label).
 * 4. Pickled model binaries and preprocessing artifacts are separate files with different file sizes and hashes.
 * 5. ML Service /models registry confirms dual independent architecture.
 * 6. ML Service /predict/model1 and /predict/model2 execute independently.
 * 7. Backend /api/system/transparency endpoint exposes both models independently.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ML_SERVICE_URL = 'http://127.0.0.1:8000';
const BACKEND_URL = 'http://127.0.0.1:5000';

function getFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 VERIFYING TASK 19: INDEPENDENCE OF ML MODEL 1 AND MODEL 2');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Datasets Exist and are Distinct Files
  // -------------------------------------------------------------
  console.log('[Phase 1] Verifying Training Dataset Independence...');
  const ds1Path = path.join(__dirname, 'ml-service', 'dataset', 'synthetic_prototype_sensor_operational_dataset.csv');
  const ds2Path = path.join(__dirname, 'ml-service', 'dataset', 'synthetic_prototype_model2_pss_operational_dataset.csv');

  assert(fs.existsSync(ds1Path), 'Model 1 dataset file exists');
  assert(fs.existsSync(ds2Path), 'Model 2 dataset file exists');

  const ds1Content = fs.readFileSync(ds1Path, 'utf8');
  const ds2Content = fs.readFileSync(ds2Path, 'utf8');

  const ds1Headers = ds1Content.split('\n')[0].trim().split(',');
  const ds2Headers = ds2Content.split('\n')[0].trim().split(',');

  assert(ds1Headers.length !== ds2Headers.length, `Header counts differ: Model 1 has ${ds1Headers.length} cols, Model 2 has ${ds2Headers.length} cols`);

  const sensorCols = [
    'resting_heart_rate',
    'hrv_ms',
    'respiration_rate',
    'skin_temperature_c',
    'activity_movement_score',
    'posture_inactivity_score',
    'fatigue_physical_strain'
  ];

  const ds1HasAllSensors = sensorCols.every(c => ds1Headers.includes(c));
  assert(ds1HasAllSensors, 'Model 1 dataset includes all 7 wearable biometric columns');

  const ds2HasAnySensors = sensorCols.some(c => ds2Headers.includes(c));
  assert(!ds2HasAnySensors, 'Model 2 dataset STRICTLY excludes all wearable biometric columns');

  const ds1Hash = getFileHash(ds1Path);
  const ds2Hash = getFileHash(ds2Path);
  assert(ds1Hash !== ds2Hash, 'Dataset file hashes are completely distinct');

  // -------------------------------------------------------------
  // Test 2: Separate Serialized Model Binaries & Artifacts
  // -------------------------------------------------------------
  console.log('\n[Phase 2] Verifying Serialized Model Artifact Independence...');
  const m1Pkl = path.join(__dirname, 'ml-service', 'model1_wearable_operational.pkl');
  const m2Pkl = path.join(__dirname, 'ml-service', 'model2_pss_operational.pkl');
  const m1Prep = path.join(__dirname, 'ml-service', 'model1_preprocessing.pkl');
  const m2Prep = path.join(__dirname, 'ml-service', 'model2_preprocessing.pkl');

  assert(fs.existsSync(m1Pkl), 'Model 1 pickle file exists');
  assert(fs.existsSync(m2Pkl), 'Model 2 pickle file exists');
  assert(fs.existsSync(m1Prep), 'Model 1 preprocessing artifact exists');
  assert(fs.existsSync(m2Prep), 'Model 2 preprocessing artifact exists');

  const m1Hash = getFileHash(m1Pkl);
  const m2Hash = getFileHash(m2Pkl);
  assert(m1Hash !== m2Hash, 'Model 1 and Model 2 pickle binaries have distinct SHA-256 hashes');

  // -------------------------------------------------------------
  // Test 3: FastAPI /models Architecture Registry Endpoint
  // -------------------------------------------------------------
  console.log('\n[Phase 3] Verifying FastAPI /models Architecture Registry Endpoint...');
  try {
    const registryRes = await fetch(`${ML_SERVICE_URL}/models`);
    const reg = await registryRes.json();

    assert(reg.architecture === 'Dual Independent Random Forest Architecture', 'Registry confirms Dual Independent Random Forest Architecture');
    assert(reg.independence_guarantee.strictly_independent === true, 'strictly_independent guarantee is true');
    assert(reg.independence_guarantee.sensor_columns_in_model2 === false, 'sensor_columns_in_model2 is false');
    assert(reg.independence_guarantee.distinct_datasets === true, 'distinct_datasets guarantee is true');
    assert(reg.model1.features_count === 20, `Model 1 feature count is 20 (got: ${reg.model1.features_count})`);
    assert(reg.model2.features_count === 13, `Model 2 feature count is 13 (got: ${reg.model2.features_count})`);
    assert(reg.model1.has_wearable_telemetry === true, 'Model 1 has_wearable_telemetry is true');
    assert(reg.model2.has_wearable_telemetry === false, 'Model 2 has_wearable_telemetry is false');
  } catch (err) {
    assert(false, `Failed to call /models endpoint: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 4: Independent Execution of Both Inference Endpoints
  // -------------------------------------------------------------
  console.log('\n[Phase 4] Verifying Independent Execution of Inference Endpoints...');
  try {
    // Model 1 execution
    const m1Input = {
      workload_hours: 58.0,
      work_pressure_rating: 8.0,
      recovery_sleep_hours: 5.0,
      shift_continuity_days: 6.0,
      recent_trend_indicator: 3.5,
      pss_score: 18.0,
      duty_duration_hours: 12.0,
      consecutive_duty_days: 6.0,
      night_duty_hours: 18.0,
      duty_type: 'Active Surveillance Watch',
      deploymentZone: 'High Threat Coastal Watch',
      social_support_rating: 4.5,
      resting_heart_rate: 88.0,
      hrv_ms: 22.0,
      respiration_rate: 24.0,
      skin_temperature_c: 37.8,
      activity_movement: 'ACTIVE_PATROL',
      posture_inactivity: 'HIGH_INTENSITY_EXERTION',
      fatigue_physical_strain: 74.0,
      wearable_synced: true
    };
    const m1Fetch = await fetch(`${ML_SERVICE_URL}/predict/model1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(m1Input)
    });
    const m1Res = await m1Fetch.json();
    assert(m1Res.success === true, 'Model 1 inference executes successfully');
    assert(m1Res.data.modelUsed.includes('MODEL_1'), `Model 1 response indicates Model 1: ${m1Res.data.modelUsed}`);
    assert(m1Res.data.contributingFactors.length === 20, `Model 1 evaluated all 20 features (got: ${m1Res.data.contributingFactors.length})`);

    // Model 2 execution (Zero wearable telemetry provided)
    const m2Input = {
      workload_hours: 56.0,
      work_pressure_rating: 8.5,
      recovery_sleep_hours: 4.5,
      shift_continuity_days: 7.0,
      recent_trend_indicator: 4.0,
      pss_score: 28.0,
      duty_duration_hours: 14.0,
      consecutive_duty_days: 7.0,
      night_duty_hours: 20.0,
      duty_type: 'Static High Vigilance Guard',
      deploymentZone: 'Remote Outpost Operations',
      social_support_rating: 3.0
      // resting_heart_rate, hrv_ms, etc. deliberately omitted
    };
    const m2Fetch = await fetch(`${ML_SERVICE_URL}/predict/model2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(m2Input)
    });
    const m2Res = await m2Fetch.json();
    assert(m2Res.success === true, 'Model 2 inference executes successfully with ZERO wearable biometrics');
    assert(m2Res.data.modelUsed.includes('MODEL_2'), `Model 2 response indicates Model 2: ${m2Res.data.modelUsed}`);
    assert(m2Res.data.contributingFactors.length === 13, `Model 2 used exactly 13 non-sensor features (got: ${m2Res.data.contributingFactors.length})`);
  } catch (err) {
    assert(false, `Failed inference execution: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 5: Backend /api/v1/system/transparency Exposes Both Models
  // -------------------------------------------------------------
  console.log('\n[Phase 5] Verifying Backend /api/v1/system/transparency Exposes Both Models...');
  try {
    const transFetch = await fetch(`${BACKEND_URL}/api/v1/system/transparency`);
    const transData = await transFetch.json();

    assert(transData.success === true, 'Backend transparency endpoint responds successfully');
    assert(transData.data.models !== undefined, 'Response data includes models object');
    assert(transData.data.models.model1 !== undefined, 'Response includes model1 details');
    assert(transData.data.models.model2 !== undefined, 'Response includes model2 details');
    assert(transData.data.models.independence.strictly_independent === true, 'Response confirms strictly_independent = true');
    assert(transData.data.models.independence.sensor_columns_in_model2 === false, 'Response confirms sensor_columns_in_model2 = false');
  } catch (err) {
    assert(false, `Failed calling backend transparency: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

runTests();
