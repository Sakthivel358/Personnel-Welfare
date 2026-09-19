/**
 * Test Suite: ML Model 2 — PSS Fallback Model (Task 18)
 * Verifies:
 * 1. Model 2 architecture & metadata via GET /model2-info
 * 2. Model 2 genuine evaluation metrics via GET /evaluation/model2
 * 3. Dedicated Model 2 inference via POST /predict/model2
 * 4. Automated fallback routing:
 *    - With wearable data -> Model 1 (MODEL_1_WEARABLE_OPERATIONAL)
 *    - Without wearable data -> Model 2 (MODEL_2_PSS_OPERATIONAL)
 * 5. Model 2 behavior with optional PSS-10 omitted
 * 6. Full end-to-end check-in and DB persistence with Model 2
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
  console.log('  RUNNING TESTS: ML MODEL 2 (PSS + OPERATIONAL FALLBACK RANDOM FOREST)');
  console.log('======================================================================\n');

  // Step 1: Model 2 Architecture & Metadata
  console.log('[Step 1] Inspecting Model 2 architecture via GET /model2-info on port 8000...');
  const infoRes = await axios.get(`${ML_BASE}/model2-info`);
  assert(infoRes.status === 200, 'GET /model2-info returns 200 OK');
  assert(infoRes.data.model_name.includes('Model 2') && infoRes.data.model_name.includes('Fallback'), `Model 2 name verified (got: ${infoRes.data.model_name})`);
  assert(infoRes.data.n_estimators === 100, 'Model 2 utilizes 100 ensemble decision trees');
  assert(infoRes.data.features_count === 13, `Model 2 feature count is exactly 13 non-sensor features (got: ${infoRes.data.features_count})`);

  const feats = infoRes.data.features || [];
  assert(feats.includes('pss_score'), 'Model 2 includes PSS-10 / self-check (pss_score)');
  assert(feats.includes('workload_hours'), 'Model 2 includes Workload Hours');
  assert(feats.includes('work_pressure_rating'), 'Model 2 includes Work Pressure');
  assert(feats.includes('prolonged_duty_hours'), 'Model 2 includes Prolonged Duty Duration');
  assert(feats.includes('shift_continuity_days'), 'Model 2 includes Shift Continuity Days');
  assert(feats.includes('night_duty_hours'), 'Model 2 includes Night Duty Hours');
  assert(feats.includes('recovery_sleep_hours'), 'Model 2 includes Recovery Sleep');
  assert(feats.includes('rest_interval_hours'), 'Model 2 includes Rest Interval');
  assert(feats.includes('recovery_pattern_score'), 'Model 2 includes Recovery Pattern');
  assert(feats.includes('deployment_demand_score'), 'Model 2 includes Deployment Sector Demand');
  assert(feats.includes('social_support_rating'), 'Model 2 includes Social Support');
  assert(feats.includes('work_life_balance_rating'), 'Model 2 includes Work-Life Balance');
  assert(feats.includes('recent_trend_indicator'), 'Model 2 includes Recent Trend Indicator');

  // Verify non-sensor constraint: no wearable biometrics in Model 2 schema
  assert(!feats.includes('resting_heart_rate'), 'Model 2 excludes wearable heart rate');
  assert(!feats.includes('hrv_ms'), 'Model 2 excludes wearable HRV');
  assert(!feats.includes('respiration_rate'), 'Model 2 excludes wearable respiration rate');
  assert(!feats.includes('skin_temperature_c'), 'Model 2 excludes wearable skin temperature');
  assert(!feats.includes('fatigue_physical_strain'), 'Model 2 excludes wearable physical strain');

  // Step 2: Model 2 Evaluation Metrics
  console.log('\n[Step 2] Verifying Model 2 evaluation metrics via GET /evaluation/model2...');
  const evalRes = await axios.get(`${ML_BASE}/evaluation/model2`);
  assert(evalRes.status === 200, 'GET /evaluation/model2 returns 200 OK');
  assert(evalRes.data.metrics.accuracy >= 0.75, `Model 2 test accuracy >= 75% (got: ${(evalRes.data.metrics.accuracy * 100).toFixed(2)}%)`);
  assert(evalRes.data.metrics.f1_macro >= 0.70, `Model 2 macro F1-score >= 70% (got: ${(evalRes.data.metrics.f1_macro * 100).toFixed(2)}%)`);
  assert(evalRes.data.is_synthetic_prototype === true, 'Evaluation confirms is_synthetic_prototype: true');
  assert(evalRes.data.real_world_validated === false, 'Evaluation confirms real_world_validated: false');
  assert(evalRes.data.disclaimer.includes('NOT represent real-world'), 'Evaluation contains explicit prototype disclaimer');
  assert(evalRes.data.confusion_matrix.classes.length === 3, 'Confusion matrix covers 3 classes (LOW, MODERATE, HIGH)');

  // Step 3: Direct Model 2 Inference (POST /predict/model2)
  console.log('\n[Step 3] Testing dedicated Model 2 inference (POST /predict/model2)...');
  const lowStressPayload = {
    pss_score: 10,
    workload_hours: 42,
    work_pressure_rating: 4,
    prolonged_duty_hours: 6,
    shift_continuity_days: 1,
    night_duty_hours: 0,
    recovery_sleep_hours: 7.8,
    rest_interval_hours: 14,
    recovery_pattern: 'BALANCED',
    deploymentZone: 'Base Headquarters',
    social_support_rating: 8,
    work_life_balance_rating: 7
  };

  const pred2Low = await axios.post(`${ML_BASE}/predict/model2`, lowStressPayload);
  assert(pred2Low.status === 200, 'POST /predict/model2 low stress returns 200 OK');
  assert(pred2Low.data.data.concernLevel === 'LOW', `Low stress concern level is LOW (got: ${pred2Low.data.data.concernLevel})`);
  assert(pred2Low.data.data.modelUsed === 'MODEL_2_PSS_OPERATIONAL', `modelUsed is MODEL_2_PSS_OPERATIONAL (got: ${pred2Low.data.data.modelUsed})`);
  assert(pred2Low.data.data.evidenceSources.includes('SELF_CHECK'), 'Evidence sources includes SELF_CHECK');
  assert(pred2Low.data.data.evidenceSources.includes('DUTY'), 'Evidence sources includes DUTY');
  assert(pred2Low.data.data.evidenceSources.includes('WORKLOAD'), 'Evidence sources includes WORKLOAD');
  assert(pred2Low.data.data.evidenceSources.includes('REST_RECOVERY'), 'Evidence sources includes REST_RECOVERY');
  assert(!pred2Low.data.data.evidenceSources.includes('WEARABLE'), 'Evidence sources strictly excludes WEARABLE');

  const highStressPayload = {
    pss_score: 34,
    workload_hours: 74,
    work_pressure_rating: 9,
    prolonged_duty_hours: 18,
    shift_continuity_days: 14,
    night_duty_hours: 24,
    recovery_sleep_hours: 3.8,
    rest_interval_hours: 6,
    recovery_pattern: 'DEFICIT',
    deploymentZone: 'Sector North - High Altitude Deployment',
    social_support_rating: 2,
    work_life_balance_rating: 2
  };

  const pred2High = await axios.post(`${ML_BASE}/predict/model2`, highStressPayload);
  assert(pred2High.status === 200, 'POST /predict/model2 high stress returns 200 OK');
  assert(['MODERATE', 'HIGH'].includes(pred2High.data.data.concernLevel), `High stress concern level is elevated (got: ${pred2High.data.data.concernLevel})`);
  assert(pred2High.data.data.compositeRiskScore > 65.0, `High stress composite risk score is elevated (got: ${pred2High.data.data.compositeRiskScore}%)`);
  assert(pred2High.data.data.topDrivers.length > 0, `Top risk drivers identified (${pred2High.data.data.topDrivers.join(', ')})`);

  // Step 4: Verification of Fallback Routing Logic
  console.log('\n[Step 4] Verifying Automated Fallback Routing (POST /predict router)...');

  // Case A: Wearable Telemetry Present -> Must route to Model 1
  const wearableCheckin = {
    resting_heart_rate: 74,
    hrv_ms: 60,
    respiration_rate: 16,
    skin_temperature_c: 36.6,
    fatigue_physical_strain: 20,
    wearable_synced: true,
    workload_hours: 48,
    work_pressure_rating: 5,
    recovery_sleep_hours: 7.0
  };
  const routerWithWearable = await axios.post(`${ML_BASE}/predict`, wearableCheckin);
  assert(routerWithWearable.data.data.modelUsed === 'MODEL_1_WEARABLE_OPERATIONAL', `With wearable data -> routes to Model 1 (got: ${routerWithWearable.data.data.modelUsed})`);
  assert(routerWithWearable.data.data.evidenceSources.includes('WEARABLE'), 'Evidence sources includes WEARABLE');

  // Case B: Wearable Telemetry Absent -> Must route to Model 2 fallback
  const nonWearableCheckin = {
    pss_score: 22,
    workload_hours: 55,
    work_pressure_rating: 6,
    prolonged_duty_hours: 10,
    shift_continuity_days: 4,
    night_duty_hours: 8,
    recovery_sleep_hours: 6.0,
    rest_interval_hours: 10,
    recovery_pattern: 'INTERRUPTED',
    deploymentZone: 'Field Patrol Post'
  };
  const routerWithoutWearable = await axios.post(`${ML_BASE}/predict`, nonWearableCheckin);
  assert(routerWithoutWearable.data.data.modelUsed === 'MODEL_2_PSS_OPERATIONAL', `Without wearable data -> fallback routes to Model 2 (got: ${routerWithoutWearable.data.data.modelUsed})`);
  assert(!routerWithoutWearable.data.data.evidenceSources.includes('WEARABLE'), 'Fallback pathway excludes WEARABLE from evidence sources');

  // Step 5: Model 2 with Optional PSS-10 Omitted (pss_score: null)
  console.log('\n[Step 5] Verifying Model 2 behavior when PSS-10 is skipped (pss_score: null)...');
  const noPssPayload = {
    pss_score: null,
    workload_hours: 50,
    work_pressure_rating: 5,
    prolonged_duty_hours: 8,
    shift_continuity_days: 3,
    night_duty_hours: 4,
    recovery_sleep_hours: 6.5,
    rest_interval_hours: 12,
    recovery_pattern: 'BALANCED'
  };
  const pred2NoPss = await axios.post(`${ML_BASE}/predict/model2`, noPssPayload);
  assert(pred2NoPss.status === 200, 'POST /predict/model2 with pss_score: null succeeds');
  assert(!pred2NoPss.data.data.evidenceSources.includes('SELF_CHECK'), 'Evidence sources omits SELF_CHECK when PSS-10 is null');
  assert(pred2NoPss.data.data.evidenceCount === 3, `Evidence count is exactly 3 operational sources (got: ${pred2NoPss.data.data.evidenceCount})`);

  // Step 6: Backend End-to-End Check-in with Fallback to Model 2
  console.log('\n[Step 6] Verifying Backend Check-in Fallback Persistence (Model 2)...');
  const testId = `CRPF-M2-${Date.now().toString().slice(-4)}`;
  const regRes = await axios.post(`${BACKEND_BASE}/auth/register`, {
    personnelId: testId,
    email: `model2.${Date.now()}@crpf.gov.in`,
    password: 'Password@123',
    fullName: 'Constable Rajesh Rao',
    unit: 'CRPF Battalion 104',
    rank: 'Constable',
    role: 'PERSONNEL'
  });
  const token = regRes.data.token;
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // Submit non-wearable checkin through backend API
  const backendCheckinRes = await axios.post(`${BACKEND_BASE}/checkin`, {
    pss_score: 25,
    workload_hours: 58,
    work_pressure_rating: 7,
    prolonged_duty_hours: 10,
    shift_continuity_days: 5,
    night_duty_hours: 12,
    recovery_sleep_hours: 5.5,
    rest_interval_hours: 8,
    recovery_pattern: 'SHIFT_LAG',
    notes: 'Convoy escort duty in border district'
  }, authHeaders);

  assert(backendCheckinRes.status === 201, 'Backend POST /checkin accepted (Status 201)');
  const predRecord = backendCheckinRes.data.data.prediction;
  assert(predRecord.modelUsed === 'MODEL_2_PSS_OPERATIONAL', `Database persisted modelUsed: MODEL_2_PSS_OPERATIONAL (got: ${predRecord.modelUsed})`);
  assert(predRecord.evidenceSources.includes('SELF_CHECK'), 'Stored prediction includes SELF_CHECK');
  assert(!predRecord.evidenceSources.includes('WEARABLE'), 'Stored prediction excludes WEARABLE');

  // Verify explainability endpoint reflects Model 2
  const expRes = await axios.get(`${BACKEND_BASE}/prediction/explainability`, authHeaders);
  assert(expRes.status === 200, 'GET /prediction/explainability returns 200');
  assert(expRes.data.data.modelUsed === 'MODEL_2_PSS_OPERATIONAL', `Explainability API reflects modelUsed: MODEL_2_PSS_OPERATIONAL (got: ${expRes.data.data.modelUsed})`);

  console.log('\n======================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error in Model 2 test suite:', err);
  process.exit(1);
});
