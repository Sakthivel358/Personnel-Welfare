/**
 * Automated Verification Suite for Five Authorized Evidence Sources & Smart Jacket Telemetry
 * Tests:
 * 1. Operational Only (Duty + Workload + Recovery, No PSS-10) -> 3 Evidence Sources
 * 2. Operational + Self-Check (Duty + Workload + Recovery + PSS-10) -> 4 Evidence Sources
 * 3. Operational + Smart Jacket Telemetry (Duty + Workload + Recovery + Wearable, No PSS-10) -> 4 Evidence Sources
 * 4. Full 5-Source Fusion (Duty + Workload + Recovery + Self-Check + Wearable) -> 5 Evidence Sources
 * 5. History, Explainability, Recommendations, and What Changed API verification
 */

const http = require('http');

const BASE_URL = 'http://127.0.0.1:5000/api/v1';
let authToken = '';

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
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log('   WelfareAI: Five Authorized Evidence Sources & Smart Jacket Suite    ');
  console.log('======================================================================\n');

  // Test 0: Login as Personnel
  console.log('--- Step 0: Authentication as Personnel (CRPF-9042) ---');
  const loginRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    identifier: 'CRPF-9042',
    password: 'Password@123'
  });

  assert(loginRes.status === 200, `Login status 200 (Got ${loginRes.status})`);
  assert(loginRes.data.success === true, 'Login successful');
  const cookies = parseCookies(loginRes.headers['set-cookie']);
  authToken = cookies['token'] || (loginRes.data.data && loginRes.data.data.token);
  assert(Boolean(authToken), 'Auth token acquired');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `token=${authToken}`,
    'Authorization': `Bearer ${authToken}`
  };

  // Test 1: Case A - Operational Evidence ONLY (No PSS-10, No Wearable)
  console.log('\n--- Step 1: Case A - Operational Evidence Only (3 Sources) ---');
  const caseAPayload = {
    pss_score: null, // PSS-10 explicitly omitted / skipped
    workload_hours: 50,
    work_pressure_rating: 6,
    shift_continuity_days: 4,
    prolonged_duty_hours: 8,
    night_duty_hours: 8,
    recovery_sleep_hours: 6.5,
    rest_interval_hours: 10,
    recovery_pattern: 'BALANCED_CIRCADIAN',
    social_support_rating: 7,
    work_life_balance_rating: 6,
    notes: 'Operational check-in without subjective survey'
  };

  const caseARes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: authHeaders
  }, caseAPayload);

  assert(caseARes.status === 201, `Case A status 201 (Got ${caseARes.status})`);
  assert(caseARes.data.success === true, 'Case A check-in accepted');
  assert(caseARes.data.data.evidenceCount === 3, `Case A evidenceCount is 3 (Got ${caseARes.data.data.evidenceCount})`);
  assert(caseARes.data.data.evidenceSources.includes('DUTY'), 'Case A includes DUTY');
  assert(caseARes.data.data.evidenceSources.includes('WORKLOAD'), 'Case A includes WORKLOAD');
  assert(caseARes.data.data.evidenceSources.includes('REST_RECOVERY'), 'Case A includes REST_RECOVERY');
  assert(!caseARes.data.data.evidenceSources.includes('SELF_CHECK'), 'Case A excludes SELF_CHECK');
  assert(!caseARes.data.data.evidenceSources.includes('WEARABLE'), 'Case A excludes WEARABLE');
  assert(caseARes.data.data.prediction.compositeRiskScore >= 0, `Case A valid risk score (${caseARes.data.data.prediction.compositeRiskScore}%)`);

  // Test 2: Case B - Operational + Self-Check (4 Sources: Duty, Workload, Recovery, PSS-10)
  console.log('\n--- Step 2: Case B - Operational + PSS-10 (4 Sources) ---');
  const caseBPayload = {
    pss_score: 22, // PSS-10 provided
    pss_responses: [2, 2, 3, 2, 2, 3, 2, 2, 2, 2],
    workload_hours: 55,
    work_pressure_rating: 7,
    shift_continuity_days: 5,
    prolonged_duty_hours: 10,
    night_duty_hours: 12,
    recovery_sleep_hours: 5.5,
    rest_interval_hours: 8,
    recovery_pattern: 'INTERRUPTED_SLEEP',
    social_support_rating: 5,
    work_life_balance_rating: 4,
    notes: 'Operational check-in with PSS-10 self-report'
  };

  const caseBRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: authHeaders
  }, caseBPayload);

  assert(caseBRes.status === 201, `Case B status 201 (Got ${caseBRes.status})`);
  assert(caseBRes.data.data.evidenceCount === 4, `Case B evidenceCount is 4 (Got ${caseBRes.data.data.evidenceCount})`);
  assert(caseBRes.data.data.evidenceSources.includes('SELF_CHECK'), 'Case B includes SELF_CHECK');
  assert(!caseBRes.data.data.evidenceSources.includes('WEARABLE'), 'Case B excludes WEARABLE');

  // Test 3: Case C - Operational + Smart Jacket Telemetry (4 Sources, No PSS-10)
  console.log('\n--- Step 3: Case C - Operational + Smart Jacket (4 Sources, No PSS-10) ---');
  const caseCPayload = {
    pss_score: null, // No PSS-10
    workload_hours: 60,
    work_pressure_rating: 8,
    shift_continuity_days: 7,
    prolonged_duty_hours: 14, // Extended prolonged duty
    night_duty_hours: 20, // Night duty
    recovery_sleep_hours: 5.0,
    rest_interval_hours: 6,
    recovery_pattern: 'SHIFT_LAG',
    social_support_rating: 5,
    work_life_balance_rating: 4,
    // Smart Jacket Telemetry
    resting_heart_rate: 88,
    hrv_ms: 32,
    respiration_rate: 22,
    skin_temperature_c: 37.8,
    activity_movement: 'HIGH_MOBILITY_TACTICAL',
    posture_inactivity: 'PROLONGED_STANDING',
    fatigue_physical_strain: 74,
    wearable_synced: true,
    notes: 'Smart Jacket telemetry with high operational deployment'
  };

  const caseCRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: authHeaders
  }, caseCPayload);

  assert(caseCRes.status === 201, `Case C status 201 (Got ${caseCRes.status})`);
  assert(caseCRes.data.data.evidenceCount === 4, `Case C evidenceCount is 4 (Got ${caseCRes.data.data.evidenceCount})`);
  assert(caseCRes.data.data.evidenceSources.includes('WEARABLE'), 'Case C includes WEARABLE');
  assert(!caseCRes.data.data.evidenceSources.includes('SELF_CHECK'), 'Case C excludes SELF_CHECK');
  assert(caseCRes.data.data.checkIn.resting_heart_rate === 88, 'Case C recorded RHR 88');
  assert(caseCRes.data.data.checkIn.fatigue_physical_strain === 74, 'Case C recorded fatigue strain 74');

  // Verify recommendations trigger for prolonged duty and autonomic strain
  const caseCRecs = caseCRes.data.data.recommendations.actionItems;
  const hasDutyRelief = caseCRecs.some(r => r.category && r.category.includes('Operational Duty'));
  const hasPhysioStrain = caseCRecs.some(r => r.category && r.category.includes('Physiological Strain'));
  assert(hasDutyRelief, 'Case C triggers Continuous Deployment Duty Relief recommendation (>=12h continuous)');
  assert(hasPhysioStrain, 'Case C triggers Physiological Strain recommendation (elevated HR/strain)');

  // Test 4: Case D - All Five Authorized Evidence Sources Fused
  console.log('\n--- Step 4: Case D - Full 5-Source Evidence Fusion ---');
  const caseDPayload = {
    // 1 & 2: Duty & Workload
    workload_hours: 75,
    work_pressure_rating: 9,
    shift_continuity_days: 10,
    prolonged_duty_hours: 16,
    night_duty_hours: 24,
    // 3: Rest & Recovery
    recovery_sleep_hours: 4.5,
    rest_interval_hours: 5,
    recovery_pattern: 'EXTENDED_DEFICIT',
    social_support_rating: 3,
    work_life_balance_rating: 2,
    // 4: Self-Check (PSS-10)
    pss_score: 30,
    pss_responses: [3, 3, 4, 1, 1, 4, 1, 1, 4, 4],
    // 5: Smart Jacket Biometrics
    resting_heart_rate: 98,
    hrv_ms: 22,
    respiration_rate: 26,
    skin_temperature_c: 38.4,
    activity_movement: 'HIGH_MOBILITY_TACTICAL',
    posture_inactivity: 'IMMOBILE_FATIGUE',
    fatigue_physical_strain: 88,
    wearable_synced: true,
    notes: 'Full 5-source severe deployment scenario'
  };

  const caseDRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: authHeaders
  }, caseDPayload);

  assert(caseDRes.status === 201, `Case D status 201 (Got ${caseDRes.status})`);
  assert(caseDRes.data.data.evidenceCount === 5, `Case D evidenceCount is 5 (Got ${caseDRes.data.data.evidenceCount})`);
  assert(caseDRes.data.data.evidenceSources.includes('DUTY'), 'Case D includes DUTY');
  assert(caseDRes.data.data.evidenceSources.includes('WORKLOAD'), 'Case D includes WORKLOAD');
  assert(caseDRes.data.data.evidenceSources.includes('REST_RECOVERY'), 'Case D includes REST_RECOVERY');
  assert(caseDRes.data.data.evidenceSources.includes('SELF_CHECK'), 'Case D includes SELF_CHECK');
  assert(caseDRes.data.data.evidenceSources.includes('WEARABLE'), 'Case D includes WEARABLE');
  assert(caseDRes.data.data.prediction.concernLevel === 'HIGH', `Case D concernLevel is HIGH (Got ${caseDRes.data.data.prediction.concernLevel})`);

  // Thermal warning recommendation check
  const caseDRecs = caseDRes.data.data.recommendations.actionItems;
  const hasThermalWarning = caseDRecs.some(r => r.category && r.category.includes('Thermal'));
  assert(hasThermalWarning, 'Case D triggers Thermal Regulation warning (skin temp 38.4°C >= 38.0°C)');

  // Test 5: Verify Explainability API returns evidenceSources
  console.log('\n--- Step 5: Explainability & History API Verification ---');
  const explainRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/predictions/explainability',
    method: 'GET',
    headers: authHeaders
  });

  assert(explainRes.status === 200, 'Explainability API status 200');
  assert(explainRes.data.data.evidenceCount === 5, `Explainability reflects 5 evidence sources (Got ${explainRes.data.data.evidenceCount})`);
  assert(Array.isArray(explainRes.data.data.evidenceSources), 'Explainability returns evidenceSources array');

  // Test 6: Verify What Changed API handles Smart Jacket and Duty metrics
  console.log('\n--- Step 6: What-Changed Comparison API Verification ---');
  const whatChangedRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/predictions/what-changed',
    method: 'GET',
    headers: authHeaders
  });

  assert(whatChangedRes.status === 200, 'What-Changed API status 200');
  assert(whatChangedRes.data.hasComparison === true, 'What-Changed has comparison data');
  assert(whatChangedRes.data.metrics.resting_heart_rate !== undefined, 'What-Changed contains resting_heart_rate metric');
  assert(whatChangedRes.data.metrics.hrv_ms !== undefined, 'What-Changed contains hrv_ms metric');
  assert(whatChangedRes.data.metrics.fatigue_physical_strain !== undefined, 'What-Changed contains fatigue_physical_strain metric');
  assert(whatChangedRes.data.metrics.prolonged_duty_hours !== undefined, 'What-Changed contains prolonged_duty_hours metric');

  // Test 7: Verify History API includes Smart Jacket and Duty metrics
  console.log('\n--- Step 7: Prediction History API Verification ---');
  const historyRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/predictions/history',
    method: 'GET',
    headers: authHeaders
  });

  assert(historyRes.status === 200, 'History API status 200');
  assert(Array.isArray(historyRes.data.data), 'History returns array');
  const latestEntry = historyRes.data.data[historyRes.data.data.length - 1];
  assert(latestEntry.evidenceCount === 5, `Latest history entry has 5 evidence sources (Got ${latestEntry.evidenceCount})`);
  assert(latestEntry.resting_heart_rate === 98, 'Latest history entry preserves Smart Jacket RHR');
  assert(latestEntry.prolonged_duty_hours === 16, 'Latest history entry preserves prolonged duty hours');

  console.log('\n======================================================================');
  console.log(`Test Execution Summary: ${passedTests} Passed, ${failedTests} Failed.`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
