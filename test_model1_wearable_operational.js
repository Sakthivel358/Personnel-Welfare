/**
 * Automated Verification Suite for:
 * Task 16: ML Model 1 — Wearable + Operational Model
 * 
 * Verifies:
 * 1. Dedicated Random Forest Model 1 trained on wearable & operational data.
 * 2. Model 1 architecture, feature columns, and test set evaluation metrics.
 * 3. Model 1 inference with wearable biometrics, duty duration, night duty, workload, rest/recovery, deployment, and optional self-check.
 * 4. Outputs: Low / Moderate / High Concern, evidence information, and main contributing indicators.
 * 5. Backend integration and explainability passthrough.
 */

const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const list = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
  const cookies = {};
  list.forEach(c => {
    const parts = c.split(';')[0].split('=');
    cookies[parts[0].trim()] = parts[1] ? parts[1].trim() : '';
  });
  return cookies;
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log('  PASS: ' + message);
    passedTests++;
  } else {
    console.error('  FAIL: ' + message);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n======================================================================');
  console.log('  RUNNING TESTS: ML MODEL 1 (WEARABLE + OPERATIONAL RANDOM FOREST)');
  console.log('======================================================================\n');

  // --- Step 1: Model 1 Microservice Metadata & Feature Schema ---
  console.log('[Step 1] Inspecting Model 1 architecture via GET /model1-info on port 8000...');
  const m1InfoRes = await request({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/model1-info',
    method: 'GET'
  });

  assert(m1InfoRes.status === 200, 'GET /model1-info returns 200 OK');
  const m1Info = m1InfoRes.data;
  assert(m1Info.model_name.includes('Model 1') && m1Info.model_name.includes('Wearable + Operational'), `Model name is Model 1 (got: ${m1Info.model_name})`);
  assert(m1Info.n_estimators === 100, 'Model 1 utilizes 100 ensemble decision trees');
  assert(m1Info.features_count === 20, `Model 1 feature count is 20 (got: ${m1Info.features_count})`);

  // Verify all required inputs are present in feature schema
  const feats = m1Info.features || [];
  assert(feats.includes('resting_heart_rate'), 'Model 1 includes HR (resting_heart_rate)');
  assert(feats.includes('hrv_ms'), 'Model 1 includes HRV (hrv_ms)');
  assert(feats.includes('respiration_rate'), 'Model 1 includes Respiration Rate');
  assert(feats.includes('skin_temperature_c'), 'Model 1 includes Body/Skin Temperature');
  assert(feats.includes('activity_movement_score'), 'Model 1 includes Activity/Movement');
  assert(feats.includes('posture_inactivity_score'), 'Model 1 includes Posture/Inactivity');
  assert(feats.includes('fatigue_physical_strain'), 'Model 1 includes Fatigue/Physical Strain');
  assert(feats.includes('prolonged_duty_hours'), 'Model 1 includes Duty Duration (prolonged_duty_hours)');
  assert(feats.includes('night_duty_hours'), 'Model 1 includes Night Duty');
  assert(feats.includes('workload_hours'), 'Model 1 includes Workload');
  assert(feats.includes('recovery_sleep_hours'), 'Model 1 includes Rest/Recovery Sleep');
  assert(feats.includes('rest_interval_hours'), 'Model 1 includes Rest Interval');
  assert(feats.includes('recovery_pattern_score'), 'Model 1 includes Recovery Pattern');
  assert(feats.includes('deployment_demand_score'), 'Model 1 includes Deployment / Work Post Patterns');
  assert(feats.includes('pss_score'), 'Model 1 includes Optional Self-Check (pss_score)');

  // --- Step 2: Model 1 Genuine Test Set Evaluation Metrics ---
  console.log('\n[Step 2] Verifying Model 1 evaluation metrics via GET /evaluation/model1...');
  const m1EvalRes = await request({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/evaluation/model1',
    method: 'GET'
  });

  assert(m1EvalRes.status === 200, 'GET /evaluation/model1 returns 200 OK');
  const m1Eval = m1EvalRes.data;
  assert(m1Eval.metrics && m1Eval.metrics.accuracy >= 0.80, `Model 1 test accuracy >= 80% (got: ${(m1Eval.metrics.accuracy * 100).toFixed(2)}%)`);
  assert(m1Eval.metrics.f1_macro >= 0.70, `Model 1 macro F1-score >= 0.70 (got: ${(m1Eval.metrics.f1_macro * 100).toFixed(2)}%)`);
  assert(m1Eval.confusion_matrix && Array.isArray(m1Eval.confusion_matrix.matrix), 'Confusion matrix returned');

  // --- Step 3: Dedicated Model 1 Inference (Low Strain Operational Scenario) ---
  console.log('\n[Step 3] Testing Model 1 inference with Low-Strain Wearable + Operational Data...');
  const lowStrainRes = await request({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/predict/model1',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    resting_heart_rate: 58.0,
    hrv_ms: 78.0,
    respiration_rate: 13.0,
    skin_temperature_c: 36.4,
    activity_movement: 'NORMAL',
    posture_inactivity: 'NORMAL',
    fatigue_physical_strain: 18.0,
    workload_hours: 42.0,
    work_pressure_rating: 3.0,
    prolonged_duty_hours: 6.0,
    shift_continuity_days: 2.0,
    night_duty_hours: 0.0,
    recovery_sleep_hours: 8.0,
    rest_interval_hours: 14.0,
    recovery_pattern: 'BALANCED_CIRCADIAN',
    deploymentZone: 'Standard Field Base',
    duty_type: 'Headquarters Administration',
    social_support_rating: 8.0,
    work_life_balance_rating: 8.0,
    pss_score: 8.0
  });

  assert(lowStrainRes.status === 200, 'POST /predict/model1 returns 200 OK');
  const lowData = lowStrainRes.data.data;
  assert(lowData.concernLevel === 'LOW', `Low strain correctly predicted as LOW (got: ${lowData.concernLevel})`);
  assert(lowData.compositeRiskScore < 40.0, `Composite risk score is low (got: ${lowData.compositeRiskScore}%)`);
  assert(lowData.modelUsed === 'MODEL_1_WEARABLE_OPERATIONAL', `modelUsed is MODEL_1_WEARABLE_OPERATIONAL (got: ${lowData.modelUsed})`);
  assert(lowData.evidenceSources.includes('WEARABLE'), 'Evidence sources includes WEARABLE');
  assert(lowData.evidenceSources.includes('DUTY'), 'Evidence sources includes DUTY');
  assert(lowData.evidenceSources.includes('WORKLOAD'), 'Evidence sources includes WORKLOAD');
  assert(lowData.evidenceSources.includes('REST_RECOVERY'), 'Evidence sources includes REST_RECOVERY');
  assert(lowData.evidenceSources.includes('SELF_CHECK'), 'Evidence sources includes SELF_CHECK');
  assert(lowData.evidenceCount === 5, 'Evidence count is 5 sources');
  assert(Array.isArray(lowData.topDrivers), 'topDrivers returned as array');
  assert(Array.isArray(lowData.contributingFactors) && lowData.contributingFactors.length > 0, 'contributingFactors returned with factor attributions');

  // --- Step 4: Dedicated Model 1 Inference (Acute Wearable + Duty Strain Scenario) ---
  console.log('\n[Step 4] Testing Model 1 inference with High-Strain Wearable + Operational Data...');
  const highStrainRes = await request({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/predict/model1',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    resting_heart_rate: 98.0,
    hrv_ms: 22.0,
    respiration_rate: 24.0,
    skin_temperature_c: 37.8,
    activity_movement: 'EXTREME_EXERTION',
    posture_inactivity: 'STANDING_VIGILANCE',
    fatigue_physical_strain: 86.0,
    workload_hours: 68.0,
    work_pressure_rating: 9.0,
    prolonged_duty_hours: 16.0,
    shift_continuity_days: 8.0,
    night_duty_hours: 24.0,
    recovery_sleep_hours: 4.5,
    rest_interval_hours: 5.0,
    recovery_pattern: 'EXTENDED_DEFICIT',
    deploymentZone: 'High Altitude Remote Outpost',
    duty_type: 'Quick Reaction Team (QRT)',
    social_support_rating: 4.0,
    work_life_balance_rating: 2.0,
    pss_score: 28.0
  });

  assert(highStrainRes.status === 200, 'POST /predict/model1 high strain returns 200');
  const highData = highStrainRes.data.data;
  assert(highData.concernLevel === 'HIGH' || highData.concernLevel === 'MODERATE', `High strain yields elevated concern (got: ${highData.concernLevel})`);
  assert(highData.compositeRiskScore >= 50.0, `Composite risk score is elevated (got: ${highData.compositeRiskScore}%)`);
  assert(highData.topDrivers.length >= 2, `Top risk drivers identified (got: ${highData.topDrivers.join(', ')})`);

  // --- Step 5: Model 1 with Omitted (Optional) PSS-10 ---
  console.log('\n[Step 5] Testing Model 1 inference without Self-Check (pss_score: null)...');
  const noPssRes = await request({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/predict/model1',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    resting_heart_rate: 64.0,
    hrv_ms: 60.0,
    respiration_rate: 15.0,
    skin_temperature_c: 36.6,
    activity_movement: 'NORMAL',
    posture_inactivity: 'NORMAL',
    fatigue_physical_strain: 30.0,
    workload_hours: 48.0,
    work_pressure_rating: 5.0,
    prolonged_duty_hours: 8.0,
    shift_continuity_days: 3.0,
    night_duty_hours: 0.0,
    recovery_sleep_hours: 7.0,
    rest_interval_hours: 10.0,
    recovery_pattern: 'BALANCED_CIRCADIAN',
    deploymentZone: 'Standard Field Base',
    duty_type: 'Patrol & Active Security',
    social_support_rating: 6.0,
    work_life_balance_rating: 6.0,
    pss_score: null // Omitted optional self-check
  });

  assert(noPssRes.status === 200, 'Model 1 processes check-in without PSS-10 successfully');
  const noPssData = noPssRes.data.data;
  assert(!noPssData.evidenceSources.includes('SELF_CHECK'), 'evidenceSources excludes SELF_CHECK');
  assert(noPssData.evidenceSources.includes('WEARABLE'), 'evidenceSources includes WEARABLE');
  assert(noPssData.evidenceCount === 4, `evidenceCount is 4 (got: ${noPssData.evidenceCount})`);
  const pssFactor = noPssData.contributingFactors.find(f => f.feature_key === 'pss_score');
  assert(!pssFactor, 'contributingFactors does not expose omitted pss_score');

  // --- Step 6: End-to-End Check-In Submission via Backend (Port 5000) ---
  console.log('\n[Step 6] Testing Backend End-to-End Check-in with Model 1 Integration...');
  const uniqueId = `m1_test_${Date.now()}`;
  const regRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: `CRPF-${uniqueId.substring(8)}`,
    fullName: 'Model 1 Test Personnel',
    email: `${uniqueId}@welfare.gov.in`,
    password: 'Password@123',
    confirmPassword: 'Password@123',
    role: 'PERSONNEL',
    rank: 'Head Constable',
    force: 'CRPF'
  });

  assert(regRes.status === 201 || regRes.status === 200, 'Registered test personnel');
  const cookies = parseCookies(regRes.headers['set-cookie']);
  const token = cookies.token || (regRes.data && regRes.data.data && regRes.data.data.token);
  assert(token, 'Acquired session token');

  const checkinRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `token=${token}`
    }
  }, {
    duty_type: 'Quick Reaction Team (QRT)',
    workload_hours: 58.0,
    work_pressure_rating: 7.0,
    prolonged_duty_hours: 12.0,
    shift_continuity_days: 5.0,
    night_duty_hours: 16.0,
    recovery_sleep_hours: 5.5,
    rest_interval_hours: 8.0,
    recovery_pattern: 'SHIFT_LAG',
    resting_heart_rate: 82.0,
    hrv_ms: 36.0,
    respiration_rate: 19.0,
    skin_temperature_c: 36.9,
    fatigue_physical_strain: 62.0,
    wearable_synced: true,
    pss_score: null
  });

  assert(checkinRes.status === 201, 'POST /api/v1/checkin succeeds (Status 201)');
  const chkData = checkinRes.data.data;
  assert(chkData.prediction.modelUsed === 'MODEL_1_WEARABLE_OPERATIONAL', `Check-in prediction persisted modelUsed: ${chkData.prediction.modelUsed}`);
  assert(chkData.evidenceSources.includes('WEARABLE'), 'Check-in response confirmed WEARABLE evidence source');

  // --- Step 7: Explainability Endpoint returns Model 1 Metadata ---
  console.log('\n[Step 7] Verifying /prediction/explainability exposes Model 1 attribution...');
  const expRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/prediction/explainability',
    method: 'GET',
    headers: { 'Cookie': `token=${token}` }
  });

  assert(expRes.status === 200, 'GET /prediction/explainability returns 200');
  const expData = expRes.data.data;
  assert(expData.modelUsed === 'MODEL_1_WEARABLE_OPERATIONAL', `Explainability returned modelUsed: ${expData.modelUsed}`);
  assert(Array.isArray(expData.topDrivers) && expData.topDrivers.length > 0, 'Explainability includes top drivers');
  assert(Array.isArray(expData.contributingFactors) && expData.contributingFactors.length > 0, 'Explainability includes contributing factors');

  console.log('\n======================================================================');
  console.log(`  VERIFICATION RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
