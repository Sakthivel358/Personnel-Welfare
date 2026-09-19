/**
 * Task 17 Verification Suite:
 * 1. Proper sensor/operational training dataset structure.
 * 2. Feature structure alignment between training and prediction.
 * 3. Strict prohibition against using existing PSS-10 model for sensor predictions.
 * 4. Clearly labelled synthetic prototype data and non-claim disclaimers (does NOT claim real-world validated performance).
 */

const axios = require('./backend/node_modules/axios');
const fs = require('fs');
const path = require('path');

const ML_BASE = 'http://127.0.0.1:8000';
const BACKEND_BASE = 'http://127.0.0.1:5000/api/v1';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================================');
  console.log('  RUNNING TESTS: TASK 17 — TRAIN MODEL 1 CORRECTLY');
  console.log('======================================================================\n');

  // 1. Dataset Verification
  console.log('[Step 1] Verifying clearly labelled synthetic prototype dataset...');
  const datasetPath = path.join(__dirname, 'ml-service', 'dataset', 'synthetic_prototype_sensor_operational_dataset.csv');
  assert(fs.existsSync(datasetPath), `Synthetic prototype dataset exists at: ${datasetPath}`);

  const metadataPath = path.join(__dirname, 'ml-service', 'dataset', 'dataset_metadata.json');
  assert(fs.existsSync(metadataPath), `Dataset metadata file exists at: ${metadataPath}`);

  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  assert(metadata.provenance === 'SYNTHETIC_PROTOTYPE_DATA', `Metadata provenance is SYNTHETIC_PROTOTYPE_DATA (got: ${metadata.provenance})`);
  assert(metadata.real_world_validated === false, 'Metadata explicitly states real_world_validated is false');
  assert(metadata.real_world_claim === false, 'Metadata explicitly states real_world_claim is false');
  assert(metadata.disclaimer.includes('DO NOT represent real-world') || metadata.disclaimer.includes('Does NOT represent real-world'), 'Metadata contains explicit non-claim disclaimer');

  const datasetFirstLine = fs.readFileSync(datasetPath, 'utf8').split('\n')[0];
  const requiredFeatures = [
    'resting_heart_rate',
    'hrv_ms',
    'respiration_rate',
    'skin_temperature_c',
    'activity_movement_score',
    'posture_inactivity_score',
    'fatigue_physical_strain',
    'workload_hours',
    'work_pressure_rating',
    'prolonged_duty_hours',
    'shift_continuity_days',
    'night_duty_hours',
    'recovery_sleep_hours',
    'rest_interval_hours',
    'recovery_pattern_score',
    'deployment_demand_score',
    'social_support_rating',
    'work_life_balance_rating',
    'recent_trend_indicator',
    'pss_score'
  ];
  for (const feat of requiredFeatures) {
    assert(datasetFirstLine.includes(feat), `Dataset header includes feature: ${feat}`);
  }
  assert(datasetFirstLine.includes('dataset_type'), 'Dataset header includes dataset_type column');
  assert(datasetFirstLine.includes('provenance'), 'Dataset header includes provenance column');

  // 2. Feature Structure Alignment Verification
  console.log('\n[Step 2] Verifying Model 1 feature structure alignment between training & inference...');
  const infoRes = await axios.get(`${ML_BASE}/model1-info`);
  assert(infoRes.status === 200, 'GET /model1-info returns 200');
  assert(infoRes.data.features_count === 20, `Model 1 feature count is 20 (got: ${infoRes.data.features_count})`);
  assert(JSON.stringify(infoRes.data.features) === JSON.stringify(requiredFeatures), 'Model 1 feature columns match training dataset columns exactly');

  // 3. Non-Claim Disclaimers in Model Transparency & Metrics
  console.log('\n[Step 3] Verifying non-claim disclaimers (does not claim real-world validated performance)...');
  assert(infoRes.data.is_synthetic_prototype === true, 'Model 1 info confirms is_synthetic_prototype: true');
  assert(infoRes.data.real_world_validated === false, 'Model 1 info confirms real_world_validated: false');
  assert(infoRes.data.disclaimer.includes('NOT represent real-world'), 'Model 1 info disclaimer does NOT claim real-world validated performance');

  const evalRes = await axios.get(`${ML_BASE}/evaluation/model1`);
  assert(evalRes.status === 200, 'GET /evaluation/model1 returns 200');
  assert(evalRes.data.is_synthetic_prototype === true, 'Evaluation confirms is_synthetic_prototype: true');
  assert(evalRes.data.real_world_validated === false, 'Evaluation confirms real_world_validated: false');
  assert(evalRes.data.disclaimer.includes('NOT represent real-world'), 'Evaluation disclaimer does NOT claim real-world validated performance');
  assert(evalRes.data.metrics.accuracy > 0.75, `Evaluation accuracy reported (${(evalRes.data.metrics.accuracy * 100).toFixed(1)}%) with prototype disclaimer`);

  // 4. Do NOT use the existing PSS-10-trained model for sensor prediction
  console.log('\n[Step 4] Enforcing strict rule: Do NOT use existing PSS-10-trained model for sensor prediction...');
  
  // Test A: POST /predict with sensor telemetry MUST use MODEL_1_WEARABLE_OPERATIONAL, NOT legacy model
  const sensorPayload = {
    resting_heart_rate: 82,
    hrv_ms: 45,
    respiration_rate: 18,
    skin_temperature_c: 36.8,
    activity_movement: 'NORMAL',
    posture_inactivity: 'STANDING_VIGILANCE',
    fatigue_physical_strain: 35,
    workload_hours: 50,
    work_pressure_rating: 6,
    prolonged_duty_hours: 8,
    shift_continuity_days: 3,
    night_duty_hours: 4,
    recovery_sleep_hours: 6.5,
    rest_interval_hours: 12,
    recovery_pattern: 'BALANCED',
    deploymentZone: 'Sector North - High Altitude'
  };

  const predictRes = await axios.post(`${ML_BASE}/predict`, sensorPayload);
  assert(predictRes.status === 200, 'POST /predict returns 200');
  assert(predictRes.data.data.modelUsed === 'MODEL_1_WEARABLE_OPERATIONAL', `Sensor check-in executed with Model 1 (got: ${predictRes.data.data.modelUsed})`);
  assert(predictRes.data.data.isSyntheticPrototype === true, 'Prediction returns isSyntheticPrototype: true');
  assert(predictRes.data.data.realWorldValidated === false, 'Prediction returns realWorldValidated: false');
  assert(predictRes.data.data.disclaimer.includes('NOT represent real-world'), 'Prediction disclaimer states performance does NOT represent real-world validated performance');

  // Test B: Verify direct /predict/model1 handles direct numeric score structure
  const directScorePayload = {
    resting_heart_rate: 76,
    hrv_ms: 58,
    respiration_rate: 16,
    skin_temperature_c: 36.6,
    activity_movement_score: 1,
    posture_inactivity_score: 1,
    fatigue_physical_strain: 25,
    workload_hours: 45,
    work_pressure_rating: 5,
    prolonged_duty_hours: 6,
    shift_continuity_days: 2,
    night_duty_hours: 0,
    recovery_sleep_hours: 7.2,
    rest_interval_hours: 14,
    recovery_pattern_score: 0,
    deployment_demand_score: 1,
    social_support_rating: 7,
    work_life_balance_rating: 6,
    recent_trend_indicator: 0,
    pss_score: null
  };

  const directScoreRes = await axios.post(`${ML_BASE}/predict/model1`, directScorePayload);
  assert(directScoreRes.status === 200, 'POST /predict/model1 with direct score structure returns 200');
  assert(directScoreRes.data.data.modelUsed === 'MODEL_1_WEARABLE_OPERATIONAL', 'Direct score payload uses MODEL_1_WEARABLE_OPERATIONAL');
  assert(directScoreRes.data.data.evidenceSources.includes('WEARABLE'), 'Evidence sources includes WEARABLE');
  assert(!directScoreRes.data.data.evidenceSources.includes('SELF_CHECK'), 'Omitted PSS-10 is not counted in evidence sources');

  // 5. Backend ML Client & Transparency Endpoint
  console.log('\n[Step 5] Verifying backend transparency and system endpoints...');
  const sysTransRes = await axios.get(`${BACKEND_BASE}/system/transparency`);
  assert(sysTransRes.status === 200, 'GET /api/v1/system/transparency returns 200');
  assert(sysTransRes.data.data.modelInfo.is_synthetic_prototype === true, 'Backend transparency exposes is_synthetic_prototype: true');
  assert(sysTransRes.data.data.modelInfo.real_world_validated === false, 'Backend transparency exposes real_world_validated: false');
  assert(sysTransRes.data.data.datasetInfo !== undefined, 'Backend transparency exposes datasetInfo block');
  assert(sysTransRes.data.data.datasetInfo.real_world_claim === false, 'Backend transparency explicitly states real_world_claim: false');

  // 6. End-to-End Sensor Check-in Verification
  console.log('\n[Step 6] Verifying authenticated end-to-end check-in with sensor data...');
  const testId = `CRPF-T17-${Date.now().toString().slice(-4)}`;
  const regRes = await axios.post(`${BACKEND_BASE}/auth/register`, {
    personnelId: testId,
    email: `task17.${Date.now()}@crpf.gov.in`,
    password: 'Password@123',
    fullName: 'Naik Sandeep Singh',
    unit: 'CRPF Battalion 104',
    rank: 'Naik',
    role: 'PERSONNEL'
  });
  const token = regRes.data.token;
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const checkinRes = await axios.post(`${BACKEND_BASE}/checkin`, {
    resting_heart_rate: 94,
    hrv_ms: 24,
    respiration_rate: 22,
    skin_temperature_c: 37.4,
    activity_movement: 'HIGH',
    posture_inactivity: 'IMMOBILE_FATIGUE',
    fatigue_physical_strain: 78,
    workload_hours: 68,
    work_pressure_rating: 9,
    prolonged_duty_hours: 14,
    shift_continuity_days: 10,
    night_duty_hours: 16,
    recovery_sleep_hours: 4.2,
    rest_interval_hours: 6,
    recovery_pattern: 'DEFICIT',
    wearable_synced: true,
    pss_score: null
  }, authHeaders);

  assert(checkinRes.status === 201, 'POST /api/v1/checkin with sensor data returns 201');
  const pred = checkinRes.data.data.prediction;
  assert(pred.modelUsed === 'MODEL_1_WEARABLE_OPERATIONAL', `Stored prediction modelUsed: ${pred.modelUsed}`);
  assert(pred.evidenceSources.includes('WEARABLE'), 'Stored prediction confirms WEARABLE evidence source');
  assert(pred.evidenceSources.includes('DUTY'), 'Stored prediction confirms DUTY evidence source');
  assert(pred.topDrivers.length > 0, `Top drivers identified (${pred.topDrivers.join(', ')})`);

  console.log('\n======================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
