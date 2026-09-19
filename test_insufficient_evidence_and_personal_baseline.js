/**
 * test_insufficient_evidence_and_personal_baseline.js
 * Comprehensive automated test suite verifying Tasks 25, 26, & 27:
 * - Task 25: Insufficient Evidence Handling (WELFARE CONCERN — UNDETERMINED, EVIDENCE — INSUFFICIENT, "Additional authorized data or a welfare check-in is required.")
 * - Task 26: Personal Baseline (YOUR NORMAL PATTERN vs CURRENT for workload, rest, fatigue, stress indicators)
 * - Task 27: Current vs Historical (Real authorized variance, "Baseline not established yet.", zero hardcoded values)
 */

const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('==================================================================');
  console.log('STARTING TASKS 25, 26 & 27 VERIFICATION SUITE');
  console.log('==================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
    }
  }

  const timestamp = Date.now();

  // -------------------------------------------------------------
  // Test Case 1: User with 0 check-ins (Initial State)
  // -------------------------------------------------------------
  console.log('Test 1: User with 0 check-ins (Insufficient Evidence & Baseline Status)');
  const user1Email = `baseline_zero_${timestamp}@defence.gov.in`;
  const reg1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    fullName: 'Havildar Zero Checkins',
    personnelId: `ZERO${timestamp.toString().slice(-6)}`,
    rank: 'Havildar',
    unit: '10 Para SF',
    email: user1Email,
    password: 'Password@123',
    role: 'personnel'
  });

  const token1 = reg1.body.token || (reg1.body.data && reg1.body.data.token);
  assert(!!token1, 'User 1 registered successfully with valid token');

  // Check /prediction/latest
  const latestZero = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/latest',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });

  assert(latestZero.status === 200, 'Latest prediction returns 200 OK for zero check-ins');
  assert(latestZero.body.data.concernLevel === 'UNDETERMINED', 'Concern level is strictly UNDETERMINED');
  assert(latestZero.body.data.evidenceStrength === 'INSUFFICIENT', 'Evidence strength is strictly INSUFFICIENT');
  assert(latestZero.body.data.welfareConcernDisplay === 'WELFARE CONCERN — UNDETERMINED', 'Displays exact badge: WELFARE CONCERN — UNDETERMINED');
  assert(latestZero.body.data.evidenceDisplay === 'EVIDENCE — INSUFFICIENT', 'Displays exact badge: EVIDENCE — INSUFFICIENT');
  assert(latestZero.body.data.guidanceText.includes('Additional authorized data or a welfare check-in is required'), 'Displays exact guidance text: "Additional authorized data or a welfare check-in is required."');
  assert(latestZero.body.data.prediction.compositeRiskScore === null, 'Composite risk score is null/NA (not guessing)');

  // Check /prediction/personal-baseline with 0 check-ins
  const baselineZero = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/personal-baseline',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });

  assert(baselineZero.status === 200, 'Personal baseline returns 200 OK for zero check-ins');
  assert(baselineZero.body.data.baselineEstablished === false, 'Baseline is not established yet (baselineEstablished === false)');
  assert(baselineZero.body.data.message === 'Baseline not established yet.', 'Displays exact message: "Baseline not established yet."');
  assert(baselineZero.body.data.guidanceText.includes('Additional authorized data or a welfare check-in is required'), 'Guidance includes check-in requirement');
  assert(baselineZero.body.data.yourNormalPattern === null, 'yourNormalPattern is null (no fake demo values)');

  // Check /prediction/what-changed with 0 check-ins
  const whatChangedZero = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/what-changed',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });

  assert(whatChangedZero.body.baselineEstablished === false, 'What-changed returns baselineEstablished: false for zero check-ins');
  assert(whatChangedZero.body.message === 'Baseline not established yet.', 'What-changed displays "Baseline not established yet."');

  // -------------------------------------------------------------
  // Test Case 2: User with 1 check-in
  // -------------------------------------------------------------
  console.log('\nTest 2: User with 1 check-in (Baseline Requires >= 2 Records)');
  const checkin1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token1}`
    }
  }, {
    workload_hours: 42,
    recovery_sleep_hours: 7.5,
    work_pressure_rating: 4,
    shift_continuity_days: 2,
    social_support_rating: 4,
    work_life_balance_rating: 4,
    prolonged_duty_hours: 2,
    night_duty_hours: 0,
    fatigue_physical_strain: 20,
    resting_heart_rate: 68,
    hrv_ms: 65,
    respiration_rate: 14,
    skin_temperature_c: 36.5
  });

  assert(checkin1.status === 201, 'Check-in 1 created successfully');

  const baselineOne = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/personal-baseline',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });

  assert(baselineOne.body.data.baselineEstablished === false, 'Baseline is still not established with 1 check-in');
  assert(baselineOne.body.data.message === 'Baseline not established yet.', 'Displays exact text: "Baseline not established yet."');

  const whatChangedOne = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/what-changed',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });

  assert(whatChangedOne.body.hasComparison === false, 'hasComparison is false with 1 check-in');
  assert(whatChangedOne.body.baselineEstablished === false, 'baselineEstablished is false with 1 check-in');
  assert(whatChangedOne.body.message === 'Baseline not established yet.', 'whatChanged message is "Baseline not established yet."');

  // -------------------------------------------------------------
  // Test Case 3: User with 3 check-ins (Baseline Established)
  // Check-in 1: Workload 42, Sleep 7.5, Fatigue 20, HR 68
  // Check-in 2: Workload 44, Sleep 7.1, Fatigue 24, HR 70
  // Baseline means: Workload 43.0, Sleep 7.3, Fatigue 22.0, HR 69.0
  // Check-in 3 (Current): Workload 58, Sleep 4.5, Fatigue 70, HR 82
  // -------------------------------------------------------------
  console.log('\nTest 3: User with 3 check-ins (Establishing Baseline & Comparing Normal Pattern vs Current)');

  const checkin2 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token1}`
    }
  }, {
    workload_hours: 44,
    recovery_sleep_hours: 7.1,
    work_pressure_rating: 4,
    shift_continuity_days: 3,
    social_support_rating: 4,
    work_life_balance_rating: 4,
    prolonged_duty_hours: 3,
    night_duty_hours: 1,
    fatigue_physical_strain: 24,
    resting_heart_rate: 70,
    hrv_ms: 60,
    respiration_rate: 15,
    skin_temperature_c: 36.6
  });

  assert(checkin2.status === 201, 'Check-in 2 created successfully');

  const checkin3 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token1}`
    }
  }, {
    workload_hours: 58,
    recovery_sleep_hours: 4.5,
    work_pressure_rating: 8,
    shift_continuity_days: 6,
    social_support_rating: 2,
    work_life_balance_rating: 2,
    prolonged_duty_hours: 8,
    night_duty_hours: 6,
    fatigue_physical_strain: 70,
    resting_heart_rate: 82,
    hrv_ms: 38,
    respiration_rate: 19,
    skin_temperature_c: 37.1
  });

  assert(checkin3.status === 201, 'Check-in 3 created successfully');

  // Query /prediction/personal-baseline
  const baselineThree = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/personal-baseline',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });

  assert(baselineThree.status === 200, 'Personal baseline returns 200 OK');
  const pbData = baselineThree.body.data;
  assert(pbData.baselineEstablished === true, 'Baseline is established (baselineEstablished === true)');
  assert(pbData.status === 'BASELINE_ACTIVE', 'Baseline status is BASELINE_ACTIVE');
  assert(pbData.baselineCheckInCount === 2, 'Baseline computed strictly from 2 prior records');

  // Verify YOUR NORMAL PATTERN vs CURRENT for 4 required categories
  console.log('\n  Checking 4 categories in comparisonCategories:');
  const cats = pbData.comparisonCategories;
  assert(!!cats.workload, 'Workload category exists');
  assert(cats.workload.normalPattern.value === 43.0, `Normal Workload is 43.0 hrs/wk (got ${cats.workload.normalPattern.value})`);
  assert(cats.workload.current.value === 58.0, `Current Workload is 58.0 hrs/wk (got ${cats.workload.current.value})`);
  assert(cats.workload.delta === 15.0, `Workload delta is +15.0 (got ${cats.workload.delta})`);
  assert(cats.workload.directionalChange.includes('+15 hrs/wk above your normal pattern'), `Workload directional change description matches`);

  assert(!!cats.rest, 'Rest category exists');
  assert(cats.rest.normalPattern.value === 7.3, `Normal Rest is 7.3 hrs/day (got ${cats.rest.normalPattern.value})`);
  assert(cats.rest.current.value === 4.5, `Current Rest is 4.5 hrs/day (got ${cats.rest.current.value})`);
  assert(cats.rest.delta === -2.8, `Rest delta is -2.8 (got ${cats.rest.delta})`);
  assert(cats.rest.directionalChange.includes('below your normal rest'), `Rest directional change reflects deficit`);

  assert(!!cats.fatigue, 'Fatigue category exists');
  assert(cats.fatigue.normalPattern.value === 22.0, `Normal Fatigue is 22.0 (got ${cats.fatigue.normalPattern.value})`);
  assert(cats.fatigue.current.value === 70.0, `Current Fatigue is 70.0 (got ${cats.fatigue.current.value})`);
  assert(cats.fatigue.delta === 48.0, `Fatigue delta is +48.0 (got ${cats.fatigue.delta})`);
  assert(cats.fatigue.directionalChange.includes('above normal fatigue level'), `Fatigue directional change reflects elevated fatigue`);

  assert(!!cats.stressIndicators, 'Stress Indicators category exists');
  assert(cats.stressIndicators.normalPattern.label.includes('HR: 69 BPM'), `Normal Stress Indicator captures baseline HR: 69 BPM`);
  assert(cats.stressIndicators.current.label.includes('HR: 82 BPM'), `Current Stress Indicator captures current HR: 82 BPM`);
  assert(cats.stressIndicators.directionalChange.includes('elevated heart rate'), `Stress Indicator reflects elevated heart rate marker`);

  // Verify top-level yourNormalPattern vs current objects
  assert(pbData.yourNormalPattern.workload === '43 hrs/wk', 'yourNormalPattern.workload matches expected');
  assert(pbData.yourNormalPattern.rest === '7.3 hrs/day', 'yourNormalPattern.rest matches expected');
  assert(pbData.current.workload === '58 hrs/wk', 'current.workload matches expected');
  assert(pbData.current.rest === '4.5 hrs/day', 'current.rest matches expected');

  // Verify what-changed endpoint has personalBaseline integrated
  const whatChangedThree = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/what-changed',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });

  assert(whatChangedThree.body.hasComparison === true, 'what-changed hasComparison is true');
  assert(whatChangedThree.body.baselineEstablished === true, 'what-changed baselineEstablished is true');
  assert(!!whatChangedThree.body.personalBaseline, 'what-changed embeds personalBaseline');
  assert(whatChangedThree.body.personalBaseline.comparisonCategories.workload.delta === 15.0, 'what-changed embeds authentic workload delta');

  // -------------------------------------------------------------
  // Test Case 4: Insufficient Evidence Check-in Evaluation
  // If authorized input has insufficient evidence (e.g. neither wearable nor PSS available)
  // -------------------------------------------------------------
  console.log('\nTest 4: Evaluating Insufficient Evidence Check-in (Zero-Guessing Enforcement)');
  const user2Email = `insufficient_user_${timestamp}@defence.gov.in`;
  const reg2 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    fullName: 'Subedar Insufficient Tester',
    personnelId: `INSUF${timestamp.toString().slice(-6)}`,
    rank: 'Subedar',
    unit: '15 Kumaon',
    email: user2Email,
    password: 'Password@123',
    role: 'personnel'
  });

  const token2 = reg2.body.token || (reg2.body.data && reg2.body.data.token);

  // Submit check-in with operational data only, NO wearable telemetry and NO PSS questions answered
  const checkinUndet = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token2}`
    }
  }, {
    workload_hours: 45,
    recovery_sleep_hours: 6.0,
    work_pressure_rating: 5,
    shift_continuity_days: 3,
    social_support_rating: 3,
    work_life_balance_rating: 3
    // Missing all wearable and missing all PSS-10
  });

  assert(checkinUndet.status === 201, 'Operational-only check-in created');

  const latestUndet = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/latest',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token2}` }
  });

  assert(latestUndet.body.data.concernLevel === 'UNDETERMINED', 'Concern Level is strictly UNDETERMINED');
  assert(latestUndet.body.data.evidenceStrength === 'INSUFFICIENT', 'Evidence Strength is strictly INSUFFICIENT');
  assert(latestUndet.body.data.welfareConcernDisplay === 'WELFARE CONCERN — UNDETERMINED', 'Exact display: WELFARE CONCERN — UNDETERMINED');
  assert(latestUndet.body.data.evidenceDisplay === 'EVIDENCE — INSUFFICIENT', 'Exact display: EVIDENCE — INSUFFICIENT');
  assert(latestUndet.body.data.guidanceText === 'Additional authorized data or a welfare check-in is required.', 'Exact guidance: "Additional authorized data or a welfare check-in is required."');
  assert(latestUndet.body.data.prediction.compositeRiskScore === null, 'compositeRiskScore is null (not guessing)');

  console.log('\n==================================================================');
  console.log(`TEST SUMMARY: ${passed} / ${total} assertions passed.`);
  console.log('==================================================================');

  if (passed === total) {
    console.log('🎉 ALL TASKS 25, 26, & 27 REQUIREMENTS VERIFIED AND PASSING!\n');
    process.exit(0);
  } else {
    console.error('⚠️ SOME ASSERTIONS FAILED.\n');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test execution error:', err);
  process.exit(1);
});
